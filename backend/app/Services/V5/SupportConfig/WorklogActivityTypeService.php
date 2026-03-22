<?php

namespace App\Services\V5\SupportConfig;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WorklogActivityTypeService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function worklogActivityTypes(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('worklog_activity_types')) {
            return $this->support->missingTable('worklog_activity_types');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $usageById = $this->worklogActivityTypeUsageSummaryById();
        $query = DB::table('worklog_activity_types')
            ->select($this->support->selectColumns('worklog_activity_types', [
                'id',
                'code',
                'name',
                'description',
                'default_is_billable',
                'phase_hint',
                'sort_order',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]));

        if (! $includeInactive && $this->support->hasColumn('worklog_activity_types', 'is_active')) {
            $query->where('is_active', 1);
        }

        if ($this->support->hasColumn('worklog_activity_types', 'sort_order')) {
            $query->orderBy('sort_order');
        }
        if ($this->support->hasColumn('worklog_activity_types', 'name')) {
            $query->orderBy('name');
        }
        if ($this->support->hasColumn('worklog_activity_types', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->appendWorklogActivityTypeUsageMetadata(
                $this->serializeWorklogActivityTypeRecord((array) $item),
                $usageById
            ))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeWorklogActivityType(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('worklog_activity_types')) {
            return $this->support->missingTable('worklog_activity_types');
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'default_is_billable' => ['nullable', 'boolean'],
            'phase_hint' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $code = $this->sanitizeCode((string) ($validated['code'] ?? ''));
        if ($code === '') {
            return response()->json(['message' => 'code is invalid.'], 422);
        }
        if ($this->worklogActivityTypeCodeExists($code)) {
            return response()->json(['message' => 'code has already been taken.'], 422);
        }

        $name = trim((string) ($validated['name'] ?? ''));
        if ($name === '') {
            return response()->json(['message' => 'name is required.'], 422);
        }
        if ($this->worklogActivityTypeNameExists($name)) {
            return response()->json(['message' => 'name has already been taken.'], 422);
        }

        $phaseHint = $this->normalizeWorklogPhaseHint($validated['phase_hint'] ?? null);
        if (array_key_exists('phase_hint', $validated) && $validated['phase_hint'] !== null && $phaseHint === null) {
            return response()->json(['message' => 'phase_hint is invalid.'], 422);
        }

        $createdById = $this->support->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById === null) {
            $createdById = $this->support->parseNullableInt($request->user()?->id ?? null);
        }
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $payload = $this->support->filterPayloadByTableColumns('worklog_activity_types', [
            'code' => $code,
            'name' => $name,
            'description' => $this->support->normalizeNullableString($validated['description'] ?? null),
            'default_is_billable' => array_key_exists('default_is_billable', $validated)
                ? (bool) $validated['default_is_billable']
                : true,
            'phase_hint' => $phaseHint,
            'sort_order' => isset($validated['sort_order']) ? max(0, (int) $validated['sort_order']) : 0,
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ]);

        if ($this->support->hasColumn('worklog_activity_types', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn('worklog_activity_types', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('worklog_activity_types')->insertGetId($payload);
        $record = $this->loadWorklogActivityTypeById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Worklog activity type created but cannot be reloaded.'], 500);
        }

        $record = $this->appendWorklogActivityTypeUsageMetadata(
            $record,
            $this->worklogActivityTypeUsageSummaryById()
        );

        return response()->json(['data' => $record], 201);
    }

    public function updateWorklogActivityType(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('worklog_activity_types')) {
            return $this->support->missingTable('worklog_activity_types');
        }

        $current = DB::table('worklog_activity_types')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Worklog activity type not found.'], 404);
        }

        $validated = $request->validate([
            'code' => ['sometimes', 'nullable', 'string', 'max:50'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'default_is_billable' => ['sometimes', 'boolean'],
            'phase_hint' => ['sometimes', 'nullable', 'string', 'max:50'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $currentCode = $this->sanitizeCode((string) ($current->code ?? ''));
        $nextCode = array_key_exists('code', $validated)
            ? $this->sanitizeCode((string) ($validated['code'] ?? ''))
            : $currentCode;
        if ($nextCode === '') {
            return response()->json(['message' => 'code is invalid.'], 422);
        }

        $name = trim((string) ($validated['name'] ?? ''));
        if ($name === '') {
            return response()->json(['message' => 'name is required.'], 422);
        }

        $usage = $this->worklogActivityTypeUsageSummaryById()[$id] ?? 0;
        if ($nextCode !== $currentCode && (int) $usage > 0) {
            return response()->json(['message' => 'Khong the doi ma loai cong viec da phat sinh du lieu.'], 422);
        }

        if ($this->worklogActivityTypeCodeExists($nextCode, $id)) {
            return response()->json(['message' => 'code has already been taken.'], 422);
        }
        if ($this->worklogActivityTypeNameExists($name, $id)) {
            return response()->json(['message' => 'name has already been taken.'], 422);
        }

        $phaseHint = array_key_exists('phase_hint', $validated)
            ? $this->normalizeWorklogPhaseHint($validated['phase_hint'] ?? null)
            : $this->normalizeWorklogPhaseHint($current->phase_hint ?? null);
        if (array_key_exists('phase_hint', $validated) && $validated['phase_hint'] !== null && $phaseHint === null) {
            return response()->json(['message' => 'phase_hint is invalid.'], 422);
        }

        $updatedById = $this->support->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->support->parseNullableInt($request->user()?->id ?? null);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $payload = [
            'code' => $nextCode,
            'name' => $name,
        ];
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->support->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('default_is_billable', $validated)) {
            $payload['default_is_billable'] = (bool) $validated['default_is_billable'];
        }
        if (array_key_exists('phase_hint', $validated)) {
            $payload['phase_hint'] = $phaseHint;
        }
        if (array_key_exists('sort_order', $validated)) {
            $payload['sort_order'] = max(0, (int) $validated['sort_order']);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->support->filterPayloadByTableColumns('worklog_activity_types', $payload);
        if ($this->support->hasColumn('worklog_activity_types', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('worklog_activity_types')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadWorklogActivityTypeById($id);
        if ($record === null) {
            return response()->json(['message' => 'Worklog activity type not found.'], 404);
        }

        $record = $this->appendWorklogActivityTypeUsageMetadata(
            $record,
            $this->worklogActivityTypeUsageSummaryById()
        );

        return response()->json(['data' => $record]);
    }

    /**
     * @return array<int, int>
     */
    private function worklogActivityTypeUsageSummaryById(): array
    {
        $usageByActivityTypeId = [];

        if (! $this->support->hasTable('request_worklogs') || ! $this->support->hasColumn('request_worklogs', 'activity_type_id')) {
            return $usageByActivityTypeId;
        }

        $query = DB::table('request_worklogs')
            ->selectRaw('activity_type_id, COUNT(*) as total')
            ->whereNotNull('activity_type_id');

        if ($this->support->hasColumn('request_worklogs', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $rows = $query->groupBy('activity_type_id')->get();
        foreach ($rows as $row) {
            $activityTypeId = $this->support->parseNullableInt($row->activity_type_id ?? null);
            if ($activityTypeId === null) {
                continue;
            }

            $usageByActivityTypeId[$activityTypeId] = (int) ($row->total ?? 0);
        }

        return $usageByActivityTypeId;
    }

    /**
     * @param array<int, int> $usageByActivityTypeId
     * @return array<string, mixed>
     */
    private function appendWorklogActivityTypeUsageMetadata(array $record, array $usageByActivityTypeId): array
    {
        $activityTypeId = $this->support->parseNullableInt($record['id'] ?? null);
        $usedInWorklogs = $activityTypeId !== null ? (int) ($usageByActivityTypeId[$activityTypeId] ?? 0) : 0;

        $record['used_in_worklogs'] = $usedInWorklogs;
        $record['is_code_editable'] = $usedInWorklogs === 0;

        return $record;
    }

    private function loadWorklogActivityTypeById(int $id): ?array
    {
        if (! $this->support->hasTable('worklog_activity_types')) {
            return null;
        }

        $record = DB::table('worklog_activity_types')
            ->select($this->support->selectColumns('worklog_activity_types', [
                'id',
                'code',
                'name',
                'description',
                'default_is_billable',
                'phase_hint',
                'sort_order',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $id)
            ->first();

        if ($record === null) {
            return null;
        }

        return $this->serializeWorklogActivityTypeRecord((array) $record);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeWorklogActivityTypeRecord(array $record): array
    {
        $code = $this->sanitizeCode((string) ($record['code'] ?? ''));
        $phaseHint = $this->normalizeWorklogPhaseHint($record['phase_hint'] ?? null);

        return [
            'id' => $record['id'] ?? null,
            'code' => $code,
            'name' => (string) ($record['name'] ?? $code),
            'description' => $record['description'] ?? null,
            'default_is_billable' => (bool) ($record['default_is_billable'] ?? true),
            'phase_hint' => $phaseHint,
            'sort_order' => isset($record['sort_order']) ? (int) $record['sort_order'] : 0,
            'is_active' => (bool) ($record['is_active'] ?? true),
            'used_in_worklogs' => isset($record['used_in_worklogs']) ? (int) $record['used_in_worklogs'] : 0,
            'is_code_editable' => isset($record['is_code_editable']) ? (bool) $record['is_code_editable'] : true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function sanitizeCode(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }

    private function normalizeWorklogPhaseHint(mixed $phaseHint): ?string
    {
        $token = preg_replace('/[^A-Z0-9_]+/', '_', strtoupper(trim((string) ($phaseHint ?? ''))));
        $token = trim((string) $token, '_');
        if ($token === '') {
            return null;
        }

        return in_array($token, ['SUPPORT_HANDLE', 'ANALYZE', 'CODE', 'UPCODE'], true) ? $token : null;
    }

    private function worklogActivityTypeCodeExists(string $code, ?int $ignoreId = null): bool
    {
        if (
            $code === ''
            || ! $this->support->hasTable('worklog_activity_types')
            || ! $this->support->hasColumn('worklog_activity_types', 'code')
        ) {
            return false;
        }

        $query = DB::table('worklog_activity_types')
            ->whereRaw('UPPER(TRIM(code)) = ?', [$code]);

        if ($ignoreId !== null && $this->support->hasColumn('worklog_activity_types', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function worklogActivityTypeNameExists(string $name, ?int $ignoreId = null): bool
    {
        if (
            trim($name) === ''
            || ! $this->support->hasTable('worklog_activity_types')
            || ! $this->support->hasColumn('worklog_activity_types', 'name')
        ) {
            return false;
        }

        $query = DB::table('worklog_activity_types')
            ->whereRaw('UPPER(TRIM(name)) = UPPER(TRIM(?))', [$name]);

        if ($ignoreId !== null && $this->support->hasColumn('worklog_activity_types', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
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
