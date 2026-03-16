<?php

namespace App\Services\V5\Domain;

use App\Models\Department;
use App\Models\DepartmentWeeklySchedule;
use App\Models\DepartmentWeeklyScheduleEntry;
use App\Models\DepartmentWeeklyScheduleEntryParticipant;
use App\Models\InternalUser;
use App\Services\V5\V5DomainSupportService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DepartmentWeeklyScheduleDomainService
{
    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $departmentId = $this->support->parseNullableInt($request->query('department_id'));
        $weekStartDate = $this->normalizeDateString($request->query('week_start_date'));

        $query = DepartmentWeeklySchedule::query()
            ->with([
                'department:id,dept_code,dept_name',
                'entries' => fn ($builder) => $builder
                    ->orderBy('calendar_date')
                    ->orderBy('session')
                    ->orderBy('sort_order')
                    ->with([
                        'participants' => fn ($participantQuery) => $participantQuery
                            ->orderBy('sort_order')
                            ->with(['user:id,user_code,full_name,username']),
                    ]),
            ])
            ->orderByDesc('week_start_date')
            ->orderByDesc('id');

        if ($departmentId !== null) {
            $query->where('department_id', $departmentId);
        }

        if ($weekStartDate !== null) {
            $query->where('week_start_date', $weekStartDate);
        }

        $rows = $query
            ->get()
            ->map(fn (DepartmentWeeklySchedule $schedule): array => $this->serializeSchedule($schedule))
            ->values()
            ->all();

        return response()->json(['data' => $rows]);
    }

    public function show(int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $schedule = DepartmentWeeklySchedule::query()
            ->with([
                'department:id,dept_code,dept_name',
                'entries' => fn ($builder) => $builder
                    ->orderBy('calendar_date')
                    ->orderBy('session')
                    ->orderBy('sort_order')
                    ->with([
                        'participants' => fn ($participantQuery) => $participantQuery
                            ->orderBy('sort_order')
                            ->with(['user:id,user_code,full_name,username']),
                    ]),
            ])
            ->findOrFail($id);

        return response()->json(['data' => $this->serializeSchedule($schedule)]);
    }

    public function store(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        [$validated, $errorResponse] = $this->validatePayload($request, null);
        if ($errorResponse !== null) {
            return $errorResponse;
        }

        $departmentId = (int) $validated['department_id'];
        $weekStartDate = (string) $validated['week_start_date'];

        $exists = DepartmentWeeklySchedule::query()
            ->where('department_id', $departmentId)
            ->where('week_start_date', $weekStartDate)
            ->exists();
        if ($exists) {
            return response()->json(['message' => 'Lịch tuần của phòng ban đã tồn tại.'], 422);
        }

        $schedule = DB::transaction(function () use ($validated): DepartmentWeeklySchedule {
            $schedule = new DepartmentWeeklySchedule();
            $schedule->department_id = (int) $validated['department_id'];
            $schedule->week_start_date = (string) $validated['week_start_date'];
            $schedule->created_by = $validated['actor_id'];
            $schedule->updated_by = $validated['actor_id'];
            $schedule->save();

            $this->replaceEntries($schedule, $validated);

            return $schedule;
        });

        $schedule->load([
            'department:id,dept_code,dept_name',
            'entries' => fn ($builder) => $builder
                ->orderBy('calendar_date')
                ->orderBy('session')
                ->orderBy('sort_order')
                ->with([
                    'participants' => fn ($participantQuery) => $participantQuery
                        ->orderBy('sort_order')
                        ->with(['user:id,user_code,full_name,username']),
                ]),
        ]);

        return response()->json(['data' => $this->serializeSchedule($schedule)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $schedule = DepartmentWeeklySchedule::query()->findOrFail($id);

        [$validated, $errorResponse] = $this->validatePayload($request, $schedule);
        if ($errorResponse !== null) {
            return $errorResponse;
        }

        $departmentId = (int) $validated['department_id'];
        $weekStartDate = (string) $validated['week_start_date'];

        $duplicate = DepartmentWeeklySchedule::query()
            ->where('department_id', $departmentId)
            ->where('week_start_date', $weekStartDate)
            ->where('id', '!=', $schedule->id)
            ->exists();
        if ($duplicate) {
            return response()->json(['message' => 'Lịch tuần của phòng ban đã tồn tại.'], 422);
        }

        DB::transaction(function () use ($schedule, $validated): void {
            $schedule->department_id = (int) $validated['department_id'];
            $schedule->week_start_date = (string) $validated['week_start_date'];
            $schedule->updated_by = $validated['actor_id'];
            $schedule->save();

            $this->replaceEntries($schedule, $validated);
        });

        $schedule->load([
            'department:id,dept_code,dept_name',
            'entries' => fn ($builder) => $builder
                ->orderBy('calendar_date')
                ->orderBy('session')
                ->orderBy('sort_order')
                ->with([
                    'participants' => fn ($participantQuery) => $participantQuery
                        ->orderBy('sort_order')
                        ->with(['user:id,user_code,full_name,username']),
                ]),
        ]);

        return response()->json(['data' => $this->serializeSchedule($schedule)]);
    }

    public function destroy(int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $schedule = DepartmentWeeklySchedule::query()->findOrFail($id);
        $schedule->delete();

        return response()->json(['message' => 'Đã xóa lịch tuần phòng ban.']);
    }

    /**
     * @return array{0:?array,1:?JsonResponse}
     */
    private function validatePayload(Request $request, ?DepartmentWeeklySchedule $existing): array
    {
        $validated = $request->validate([
            'department_id' => ['required', 'integer'],
            'week_start_date' => ['required', 'date_format:Y-m-d'],
            'entries' => ['nullable', 'array'],
            'entries.*.calendar_date' => ['required_with:entries', 'date_format:Y-m-d'],
            'entries.*.session' => ['required_with:entries', 'in:MORNING,AFTERNOON'],
            'entries.*.sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'entries.*.work_content' => ['required_with:entries', 'string'],
            'entries.*.location' => ['nullable', 'string', 'max:255'],
            'entries.*.participant_text' => ['nullable', 'string'],
            'entries.*.participants' => ['nullable', 'array'],
            'entries.*.participants.*.user_id' => ['nullable', 'integer'],
            'entries.*.participants.*.sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'created_by' => ['nullable', 'integer'],
            'updated_by' => ['nullable', 'integer'],
        ]);

        $departmentId = $this->support->parseNullableInt($validated['department_id'] ?? null);
        if ($departmentId === null || ! Department::query()->whereKey($departmentId)->exists()) {
            return [null, response()->json(['message' => 'department_id is invalid.'], 422)];
        }

        $weekStartDate = (string) $validated['week_start_date'];
        $calendarDay = DB::table('monthly_calendars')
            ->select(['date', 'day_of_week', 'week_number', 'year'])
            ->where('date', $weekStartDate)
            ->first();
        if ($calendarDay === null) {
            return [null, response()->json(['message' => 'week_start_date phải tồn tại trong monthly_calendars.'], 422)];
        }

        if ((int) ($calendarDay->day_of_week ?? 0) !== 2) {
            return [null, response()->json(['message' => 'week_start_date phải là Thứ Hai.'], 422)];
        }

        $weekStart = CarbonImmutable::createFromFormat('Y-m-d', $weekStartDate)->startOfDay();
        $weekEnd = $weekStart->addDays(6);
        $entries = is_array($validated['entries'] ?? null) ? $validated['entries'] : [];

        foreach ($entries as $entryIndex => $entry) {
            $calendarDate = $this->normalizeDateString($entry['calendar_date'] ?? null);
            if ($calendarDate === null) {
                return [null, response()->json(['message' => "entries.{$entryIndex}.calendar_date is invalid."], 422)];
            }

            $entryDate = CarbonImmutable::createFromFormat('Y-m-d', $calendarDate)->startOfDay();
            if ($entryDate->lt($weekStart) || $entryDate->gt($weekEnd)) {
                return [null, response()->json(['message' => "entries.{$entryIndex}.calendar_date nằm ngoài tuần đã chọn."], 422)];
            }

            $calendarExists = DB::table('monthly_calendars')->where('date', $calendarDate)->exists();
            if (! $calendarExists) {
                return [null, response()->json(['message' => "entries.{$entryIndex}.calendar_date phải tồn tại trong monthly_calendars."], 422)];
            }

            $participants = is_array($entry['participants'] ?? null) ? $entry['participants'] : [];
            foreach ($participants as $participantIndex => $participant) {
                $userId = $this->support->parseNullableInt($participant['user_id'] ?? null);
                if ($userId === null || ! InternalUser::query()->whereKey($userId)->exists()) {
                    return [null, response()->json(['message' => "entries.{$entryIndex}.participants.{$participantIndex}.user_id is invalid."], 422)];
                }
            }
        }

        $actorId = $this->support->parseNullableInt($validated['updated_by'] ?? null)
            ?? $this->support->parseNullableInt($validated['created_by'] ?? null);
        if ($actorId !== null && ! InternalUser::query()->whereKey($actorId)->exists()) {
            return [null, response()->json(['message' => 'actor id is invalid.'], 422)];
        }

        return [[
            'department_id' => $departmentId,
            'week_start_date' => $weekStartDate,
            'entries' => $entries,
            'actor_id' => $actorId,
            'existing_id' => $existing?->id,
        ], null];
    }

    /**
     * @param array{entries:array<int, array<string, mixed>>, actor_id:?int} $validated
     */
    private function replaceEntries(DepartmentWeeklySchedule $schedule, array $validated): void
    {
        DepartmentWeeklyScheduleEntry::query()->where('schedule_id', $schedule->id)->delete();

        $entries = is_array($validated['entries'] ?? null) ? $validated['entries'] : [];
        foreach (array_values($entries) as $entryIndex => $entry) {
            $entryModel = new DepartmentWeeklyScheduleEntry();
            $entryModel->schedule_id = $schedule->id;
            $entryModel->calendar_date = (string) $entry['calendar_date'];
            $entryModel->session = (string) $entry['session'];
            $entryModel->sort_order = (int) ($entry['sort_order'] ?? (($entryIndex + 1) * 10));
            $entryModel->work_content = trim((string) ($entry['work_content'] ?? ''));
            $entryModel->location = $this->support->normalizeNullableString($entry['location'] ?? null);
            $entryModel->participant_text = $this->support->normalizeNullableString($entry['participant_text'] ?? null);
            $entryModel->created_by = $validated['actor_id'];
            $entryModel->updated_by = $validated['actor_id'];
            $entryModel->save();

            $participants = is_array($entry['participants'] ?? null) ? $entry['participants'] : [];
            foreach (array_values($participants) as $participantIndex => $participant) {
                $userId = $this->support->parseNullableInt($participant['user_id'] ?? null);
                if ($userId === null) {
                    continue;
                }

                $snapshot = InternalUser::query()->whereKey($userId)->value('full_name')
                    ?: InternalUser::query()->whereKey($userId)->value('username');

                $participantModel = new DepartmentWeeklyScheduleEntryParticipant();
                $participantModel->entry_id = $entryModel->id;
                $participantModel->user_id = $userId;
                $participantModel->participant_name_snapshot = $this->support->normalizeNullableString($snapshot);
                $participantModel->sort_order = (int) ($participant['sort_order'] ?? (($participantIndex + 1) * 10));
                $participantModel->save();
            }
        }
    }

    private function serializeSchedule(DepartmentWeeklySchedule $schedule): array
    {
        $weekStart = CarbonImmutable::createFromFormat('Y-m-d', (string) $schedule->week_start_date)->startOfDay();
        $weekEnd = $weekStart->addDays(6);

        $calendarRows = DB::table('monthly_calendars')
            ->select(['date', 'day', 'month', 'year', 'week_number', 'day_of_week', 'is_weekend', 'is_working_day', 'is_holiday', 'holiday_name'])
            ->whereBetween('date', [$weekStart->format('Y-m-d'), $weekEnd->format('Y-m-d')])
            ->orderBy('date')
            ->get()
            ->keyBy(fn (object $row): string => (string) $row->date);

        $entries = $schedule->entries
            ->sortBy(fn (DepartmentWeeklyScheduleEntry $entry): string => sprintf(
                '%s-%s-%04d',
                (string) $entry->calendar_date,
                (string) $entry->session,
                (int) ($entry->sort_order ?? 0)
            ))
            ->values();

        $serializedEntries = $entries
            ->map(fn (DepartmentWeeklyScheduleEntry $entry): array => $this->serializeEntry($entry))
            ->values()
            ->all();

        $entryMap = collect($serializedEntries)->groupBy(fn (array $entry): string => sprintf(
            '%s:%s',
            (string) $entry['calendar_date'],
            (string) $entry['session']
        ));

        $days = collect(range(0, 6))->map(function (int $offset) use ($weekStart, $calendarRows, $entryMap): array {
            $date = $weekStart->addDays($offset)->format('Y-m-d');
            $calendar = $calendarRows->get($date);
            $dayOfWeek = (int) ($calendar->day_of_week ?? (($offset === 6) ? 1 : $offset + 2));

            return [
                'date' => $date,
                'day' => (int) ($calendar->day ?? $weekStart->addDays($offset)->day),
                'month' => (int) ($calendar->month ?? $weekStart->addDays($offset)->month),
                'year' => (int) ($calendar->year ?? $weekStart->addDays($offset)->year),
                'day_of_week' => $dayOfWeek,
                'day_name' => $this->resolveDayName($dayOfWeek),
                'is_weekend' => (bool) ($calendar->is_weekend ?? false),
                'is_working_day' => (bool) ($calendar->is_working_day ?? true),
                'is_holiday' => (bool) ($calendar->is_holiday ?? false),
                'holiday_name' => isset($calendar->holiday_name) && (string) $calendar->holiday_name !== '' ? (string) $calendar->holiday_name : null,
                'sessions' => [
                    'MORNING' => array_values(($entryMap->get("{$date}:MORNING") ?? collect())->all()),
                    'AFTERNOON' => array_values(($entryMap->get("{$date}:AFTERNOON") ?? collect())->all()),
                ],
            ];
        })->values()->all();

        $weekNumber = (int) ($calendarRows->first()->week_number ?? $weekStart->isoWeek());
        $year = (int) ($calendarRows->first()->year ?? $weekStart->year);

        return [
            'id' => $schedule->id,
            'department_id' => $schedule->department_id,
            'department_code' => $schedule->department?->dept_code,
            'department_name' => $schedule->department?->dept_name,
            'week_start_date' => $schedule->week_start_date,
            'week_end_date' => $weekEnd->format('Y-m-d'),
            'week_number' => $weekNumber,
            'year' => $year,
            'week_label' => sprintf('Tuần %02d-%d', $weekNumber, $year),
            'date_range_label' => sprintf('(%s - %s)', $weekStart->format('d/m/Y'), $weekEnd->format('d/m/Y')),
            'entries' => $serializedEntries,
            'days' => $days,
            'created_at' => optional($schedule->created_at)?->toISOString(),
            'updated_at' => optional($schedule->updated_at)?->toISOString(),
            'created_by' => $schedule->created_by,
            'updated_by' => $schedule->updated_by,
        ];
    }

    private function serializeEntry(DepartmentWeeklyScheduleEntry $entry): array
    {
        $participants = $entry->participants
            ->sortBy('sort_order')
            ->map(function (DepartmentWeeklyScheduleEntryParticipant $participant): array {
                $label = $participant->user?->full_name
                    ?: $participant->participant_name_snapshot
                    ?: $participant->user?->username;

                return [
                    'id' => $participant->id,
                    'user_id' => $participant->user_id,
                    'user_code' => $participant->user?->user_code,
                    'full_name' => $participant->user?->full_name,
                    'participant_name_snapshot' => $participant->participant_name_snapshot,
                    'sort_order' => (int) ($participant->sort_order ?? 0),
                    'display_name' => $label,
                ];
            })
            ->values()
            ->all();

        $participantNames = array_values(array_filter(array_map(
            fn (array $participant): string => trim((string) ($participant['display_name'] ?? '')),
            $participants
        )));

        $freeText = $this->support->normalizeNullableString($entry->participant_text);
        if ($freeText !== null) {
            $participantNames[] = $freeText;
        }

        return [
            'id' => $entry->id,
            'calendar_date' => $entry->calendar_date,
            'session' => $entry->session,
            'session_label' => $entry->session === 'MORNING' ? 'Sáng' : 'Chiều',
            'sort_order' => (int) ($entry->sort_order ?? 0),
            'work_content' => $entry->work_content,
            'location' => $entry->location,
            'participant_text' => $entry->participant_text,
            'participants' => $participants,
            'participant_display' => implode(', ', $participantNames),
        ];
    }

    private function missingTablesResponse(): ?JsonResponse
    {
        foreach ([
            'monthly_calendars',
            'departments',
            'internal_users',
            'department_weekly_schedules',
            'department_weekly_schedule_entries',
            'department_weekly_schedule_entry_participants',
        ] as $table) {
            if (! $this->support->hasTable($table)) {
                return $this->support->missingTable($table);
            }
        }

        return null;
    }

    private function normalizeDateString(mixed $value): ?string
    {
        $normalized = $this->support->normalizeNullableString($value);
        if ($normalized === null) {
            return null;
        }

        try {
            return CarbonImmutable::createFromFormat('Y-m-d', $normalized)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }

    private function resolveDayName(int $dayOfWeek): string
    {
        return match ($dayOfWeek) {
            2 => 'Hai',
            3 => 'Ba',
            4 => 'Tư',
            5 => 'Năm',
            6 => 'Sáu',
            7 => 'Bảy',
            default => 'CN',
        };
    }
}
