<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5DomainSupportService;
use DateTimeImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MonthlyCalendarDomainService
{
    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('monthly_calendars')) {
            return response()->json(['data' => []], 200);
        }

        $year = $request->query('year') ? (int) $request->query('year') : null;
        $month = $request->query('month') ? (int) $request->query('month') : null;

        $query = DB::table('monthly_calendars')
            ->select($this->support->selectColumns('monthly_calendars', [
                'date',
                'year',
                'month',
                'day',
                'week_number',
                'day_of_week',
                'is_weekend',
                'is_working_day',
                'is_holiday',
                'holiday_name',
                'note',
                'created_at',
                'updated_at',
                'created_by',
                'updated_by',
            ]));

        if ($year !== null && $year > 2000 && $year < 2100) {
            $query->where('year', $year);
        }

        if ($month !== null && $month >= 1 && $month <= 12) {
            $query->where('month', $month);
        }

        $rows = $query
            ->orderBy('date')
            ->get()
            ->map(fn (object $row): array => $this->serializeCalendarDayRecord((array) $row))
            ->values()
            ->all();

        return response()->json(['data' => $rows], 200);
    }

    public function update(Request $request, string $date): JsonResponse
    {
        $parsedDate = DateTimeImmutable::createFromFormat('Y-m-d', $date);
        if ($parsedDate === false || $parsedDate->format('Y-m-d') !== $date) {
            return response()->json(['message' => 'date format phải là YYYY-MM-DD.'], 422);
        }

        $validated = $request->validate([
            'is_working_day' => ['nullable', 'boolean'],
            'is_holiday' => ['nullable', 'boolean'],
            'holiday_name' => ['nullable', 'string', 'max:200'],
            'note' => ['nullable', 'string', 'max:255'],
            'updated_by' => ['nullable', 'integer'],
        ]);

        $updatedById = $this->support->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $existing = DB::table('monthly_calendars')->where('date', $date)->first();

        if ($existing === null) {
            $year = (int) $parsedDate->format('Y');
            $month = (int) $parsedDate->format('n');
            $day = (int) $parsedDate->format('j');
            $dayOfWeek = (int) $parsedDate->format('w');
            $weekNumber = (int) $parsedDate->format('W');
            $isWeekend = $dayOfWeek === 0 || $dayOfWeek === 6;
            $mappedDayOfWeek = $dayOfWeek === 0 ? 1 : $dayOfWeek + 1;

            $isWorkingDay = array_key_exists('is_working_day', $validated)
                ? (bool) $validated['is_working_day']
                : ! $isWeekend;
            $isHoliday = array_key_exists('is_holiday', $validated)
                ? (bool) $validated['is_holiday']
                : false;

            $insertPayload = $this->support->filterPayloadByTableColumns('monthly_calendars', [
                'date' => $date,
                'year' => $year,
                'month' => $month,
                'day' => $day,
                'week_number' => $weekNumber,
                'day_of_week' => $mappedDayOfWeek,
                'is_weekend' => $isWeekend,
                'is_working_day' => $isWorkingDay,
                'is_holiday' => $isHoliday,
                'holiday_name' => $this->support->normalizeNullableString($validated['holiday_name'] ?? null),
                'note' => $this->support->normalizeNullableString($validated['note'] ?? null),
                'created_by' => $updatedById,
                'updated_by' => $updatedById,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('monthly_calendars')->insert($insertPayload);
        } else {
            $updatePayload = [];

            if (array_key_exists('is_working_day', $validated)) {
                $updatePayload['is_working_day'] = (bool) $validated['is_working_day'];
            }
            if (array_key_exists('is_holiday', $validated)) {
                $updatePayload['is_holiday'] = (bool) $validated['is_holiday'];
            }
            if (array_key_exists('holiday_name', $validated)) {
                $updatePayload['holiday_name'] = $this->support->normalizeNullableString($validated['holiday_name'] ?? null);
            }
            if (array_key_exists('note', $validated)) {
                $updatePayload['note'] = $this->support->normalizeNullableString($validated['note'] ?? null);
            }

            if ($updatePayload === []) {
                return response()->json(['message' => 'Không có trường nào thay đổi.'], 422);
            }

            $updatePayload['updated_by'] = $updatedById;
            $updatePayload['updated_at'] = now();

            DB::table('monthly_calendars')
                ->where('date', $date)
                ->update($this->support->filterPayloadByTableColumns('monthly_calendars', $updatePayload));
        }

        $record = $this->loadCalendarDayByDate($date);
        if ($record === null) {
            return response()->json(['message' => 'Calendar day saved but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 200);
    }

    public function generateYear(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'overwrite' => ['nullable', 'boolean'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $year = (int) $validated['year'];
        $overwrite = (bool) ($validated['overwrite'] ?? false);
        $createdById = $this->support->parseNullableInt($validated['created_by'] ?? null);

        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        if (! $this->support->hasTable('monthly_calendars')) {
            return response()->json(['message' => 'monthly_calendars table không tồn tại.'], 500);
        }

        $start = new DateTimeImmutable("{$year}-01-01");
        $end = new DateTimeImmutable("{$year}-12-31");
        $current = $start;
        $inserted = 0;
        $skipped = 0;

        while ($current <= $end) {
            $date = $current->format('Y-m-d');
            $month = (int) $current->format('n');
            $day = (int) $current->format('j');
            $dayOfWeek = (int) $current->format('w');
            $weekNumber = (int) $current->format('W');
            $isWeekend = $dayOfWeek === 0 || $dayOfWeek === 6;
            $mappedDayOfWeek = $dayOfWeek === 0 ? 1 : $dayOfWeek + 1;

            [$isHoliday, $holidayName] = $this->resolveVietnameseFixedHoliday($month, $day);
            $isWorkingDay = ! $isWeekend && ! $isHoliday;

            $exists = DB::table('monthly_calendars')->where('date', $date)->exists();
            if ($exists && ! $overwrite) {
                $skipped++;
                $current = $current->modify('+1 day');
                continue;
            }

            $payload = $this->support->filterPayloadByTableColumns('monthly_calendars', [
                'date' => $date,
                'year' => $year,
                'month' => $month,
                'day' => $day,
                'week_number' => $weekNumber,
                'day_of_week' => $mappedDayOfWeek,
                'is_weekend' => $isWeekend,
                'is_working_day' => $isWorkingDay,
                'is_holiday' => $isHoliday,
                'holiday_name' => $holidayName,
                'note' => null,
                'created_by' => $createdById,
                'updated_by' => $createdById,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($exists) {
                DB::table('monthly_calendars')->where('date', $date)->update($payload);
            } else {
                DB::table('monthly_calendars')->insert($payload);
            }
            $inserted++;

            $current = $current->modify('+1 day');
        }

        return response()->json([
            'message' => "Đã xử lý lịch năm {$year}.",
            'year' => $year,
            'inserted' => $inserted,
            'skipped' => $skipped,
        ], 200);
    }

    private function loadCalendarDayByDate(string $date): ?array
    {
        if (! $this->support->hasTable('monthly_calendars')) {
            return null;
        }

        $record = DB::table('monthly_calendars')
            ->select($this->support->selectColumns('monthly_calendars', [
                'date',
                'year',
                'month',
                'day',
                'week_number',
                'day_of_week',
                'is_weekend',
                'is_working_day',
                'is_holiday',
                'holiday_name',
                'note',
                'created_at',
                'updated_at',
                'created_by',
                'updated_by',
            ]))
            ->where('date', $date)
            ->first();

        return $record !== null ? $this->serializeCalendarDayRecord((array) $record) : null;
    }

    private function serializeCalendarDayRecord(array $record): array
    {
        $isWeekend = (bool) ($record['is_weekend'] ?? false);
        $isWorkingDay = (bool) ($record['is_working_day'] ?? ! $isWeekend);
        $isHoliday = (bool) ($record['is_holiday'] ?? false);

        return [
            'date' => $record['date'] ?? null,
            'year' => isset($record['year']) ? (int) $record['year'] : null,
            'month' => isset($record['month']) ? (int) $record['month'] : null,
            'day' => isset($record['day']) ? (int) $record['day'] : null,
            'week_number' => isset($record['week_number']) ? (int) $record['week_number'] : null,
            'day_of_week' => isset($record['day_of_week']) ? (int) $record['day_of_week'] : null,
            'is_weekend' => $isWeekend,
            'is_working_day' => $isWorkingDay,
            'is_holiday' => $isHoliday,
            'holiday_name' => isset($record['holiday_name']) && (string) $record['holiday_name'] !== ''
                ? (string) $record['holiday_name']
                : null,
            'note' => isset($record['note']) && (string) $record['note'] !== ''
                ? (string) $record['note']
                : null,
            'created_at' => $record['created_at'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function resolveVietnameseFixedHoliday(int $month, int $day): array
    {
        $key = sprintf('%02d-%02d', $month, $day);

        $fixedHolidays = [
            '01-01' => 'Tết Dương lịch',
            '04-30' => 'Ngày Giải phóng miền Nam',
            '05-01' => 'Quốc tế Lao động',
            '09-02' => 'Quốc khánh',
        ];

        if (isset($fixedHolidays[$key])) {
            return [true, $fixedHolidays[$key]];
        }

        return [false, null];
    }

    private function tableRowExists(string $table, int $id): bool
    {
        if (! $this->support->hasTable($table)) {
            return false;
        }

        $query = DB::table($table)->where('id', $id);
        if ($this->support->hasColumn($table, 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query->exists();
    }
}
