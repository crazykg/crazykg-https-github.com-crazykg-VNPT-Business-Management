<?php

namespace App\Services\V5\IntegrationSettings;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class IntegrationSettingsOperationsService
{
    private const CONTRACT_ALERT_INTEGRATION_PROVIDER = 'CONTRACT_ALERT';
    private const CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER = 'CONTRACT_PAYMENT_ALERT';
    private const MIN_CONTRACT_EXPIRY_WARNING_DAYS = 1;
    private const MAX_CONTRACT_EXPIRY_WARNING_DAYS = 365;

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function reminders(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('reminders')) {
            return $this->support->missingTable('reminders');
        }

        $query = DB::table('reminders')
            ->select($this->support->selectColumns('reminders', [
                'id',
                'reminder_title',
                'content',
                'remind_date',
                'assigned_to',
                'status',
                'created_at',
            ]))
            ->orderByDesc('remind_date')
            ->orderByDesc('id');

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                if ($this->support->hasColumn('reminders', 'reminder_title')) {
                    $builder->orWhere('reminder_title', 'like', $like);
                }
                if ($this->support->hasColumn('reminders', 'content')) {
                    $builder->orWhere('content', 'like', $like);
                }
            });
        }

        $serializeRows = fn ($items) => collect($items)
            ->map(function (object $item): array {
                $row = (array) $item;

                return [
                    'id' => (string) ($row['id'] ?? ''),
                    'title' => (string) ($row['reminder_title'] ?? ''),
                    'content' => (string) ($row['content'] ?? ''),
                    'remindDate' => $this->formatDateColumn($row['remind_date'] ?? null) ?? '',
                    'assignedToUserId' => (string) ($row['assigned_to'] ?? ''),
                    'createdDate' => $this->formatDateColumn($row['created_at'] ?? null),
                    'status' => strtoupper((string) ($row['status'] ?? 'ACTIVE')),
                ];
            })
            ->values();

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = $serializeRows($paginator->items());

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = $serializeRows($paginator->items());

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        return response()->json(['data' => $serializeRows($query->get())]);
    }

    public function userDeptHistory(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('user_dept_history')) {
            return $this->support->missingTable('user_dept_history');
        }

        $query = DB::table('user_dept_history')
            ->select($this->support->selectColumns('user_dept_history', [
                'id',
                'user_id',
                'from_dept_id',
                'to_dept_id',
                'transfer_date',
                'decision_number',
                'reason',
                'created_at',
            ]))
            ->orderByDesc('transfer_date')
            ->orderByDesc('id');

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $serializedRows = $this->serializeUserDeptHistoryRows(collect($paginator->items()));

                return response()->json([
                    'data' => $serializedRows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $serializedRows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $serializedRows = $this->serializeUserDeptHistoryRows(collect($paginator->items()));

            return response()->json([
                'data' => $serializedRows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        return response()->json([
            'data' => $this->serializeUserDeptHistoryRows($query->get()),
        ]);
    }

    public function contractExpiryAlertSettings(): JsonResponse
    {
        $settingsRow = $this->loadContractExpiryAlertSettingsRow();

        return response()->json([
            'data' => [
                'provider' => self::CONTRACT_ALERT_INTEGRATION_PROVIDER,
                'warning_days' => $this->support->resolveContractExpiryWarningDays(),
                'source' => $settingsRow !== null ? 'DB' : 'DEFAULT',
                'updated_at' => $settingsRow['updated_at'] ?? null,
            ],
        ]);
    }

    public function updateContractExpiryAlertSettings(Request $request): JsonResponse
    {
        if (
            ! $this->support->hasTable('integration_settings')
            || ! $this->support->hasColumn('integration_settings', 'contract_expiry_warning_days')
        ) {
            return response()->json([
                'message' => 'Bảng integration_settings chưa có cột contract_expiry_warning_days. Vui lòng chạy migration mới nhất.',
            ], 422);
        }

        $validated = $request->validate([
            'warning_days' => [
                'required',
                'integer',
                'min:'.self::MIN_CONTRACT_EXPIRY_WARNING_DAYS,
                'max:'.self::MAX_CONTRACT_EXPIRY_WARNING_DAYS,
            ],
        ]);

        $warningDays = (int) $validated['warning_days'];
        $actorId = $this->support->parseNullableInt($request->user()?->id ?? null);
        $now = now();

        $payload = [
            'is_enabled' => true,
            'contract_expiry_warning_days' => $warningDays,
            'updated_at' => $now,
            'updated_by' => $actorId,
        ];

        $existing = $this->loadContractExpiryAlertSettingsRow();
        if ($existing === null) {
            $payload['created_at'] = $now;
            $payload['created_by'] = $actorId;
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::CONTRACT_ALERT_INTEGRATION_PROVIDER],
            $this->support->filterPayloadByTableColumns('integration_settings', $payload)
        );

        return $this->contractExpiryAlertSettings();
    }

    public function contractPaymentAlertSettings(): JsonResponse
    {
        $settingsRow = $this->loadContractPaymentAlertSettingsRow();

        return response()->json([
            'data' => [
                'provider' => self::CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER,
                'warning_days' => $this->support->resolveContractPaymentWarningDays(),
                'source' => $settingsRow !== null ? 'DB' : 'DEFAULT',
                'updated_at' => $settingsRow['updated_at'] ?? null,
            ],
        ]);
    }

    public function updateContractPaymentAlertSettings(Request $request): JsonResponse
    {
        if (
            ! $this->support->hasTable('integration_settings')
            || ! $this->support->hasColumn('integration_settings', 'contract_payment_warning_days')
        ) {
            return response()->json([
                'message' => 'Bảng integration_settings chưa có cột contract_payment_warning_days. Vui lòng chạy migration mới nhất.',
            ], 422);
        }

        $validated = $request->validate([
            'warning_days' => [
                'required',
                'integer',
                'min:'.self::MIN_CONTRACT_EXPIRY_WARNING_DAYS,
                'max:'.self::MAX_CONTRACT_EXPIRY_WARNING_DAYS,
            ],
        ]);

        $warningDays = (int) $validated['warning_days'];
        $actorId = $this->support->parseNullableInt($request->user()?->id ?? null);
        $now = now();

        $payload = [
            'is_enabled' => true,
            'contract_payment_warning_days' => $warningDays,
            'updated_at' => $now,
            'updated_by' => $actorId,
        ];

        $existing = $this->loadContractPaymentAlertSettingsRow();
        if ($existing === null) {
            $payload['created_at'] = $now;
            $payload['created_by'] = $actorId;
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER],
            $this->support->filterPayloadByTableColumns('integration_settings', $payload)
        );

        return $this->contractPaymentAlertSettings();
    }

    /**
     * @param Collection<int, object> $rows
     * @return Collection<int, array<string, mixed>>
     */
    private function serializeUserDeptHistoryRows(Collection $rows): Collection
    {
        $userIds = $rows
            ->pluck('user_id')
            ->filter(fn (mixed $value): bool => $value !== null && $value !== '')
            ->map(fn (mixed $value): int => (int) $value)
            ->unique()
            ->values()
            ->all();

        $deptIds = $rows
            ->flatMap(fn (object $item): array => [
                $item->from_dept_id ?? null,
                $item->to_dept_id ?? null,
            ])
            ->filter(fn (mixed $value): bool => $value !== null && $value !== '')
            ->map(fn (mixed $value): int => (int) $value)
            ->unique()
            ->values()
            ->all();

        $userMap = $this->resolveTransferUserMap($userIds);
        $deptMap = $this->resolveTransferDepartmentMap($deptIds);

        return $rows
            ->map(function (object $item): array {
                $row = (array) $item;

                return [
                    'id' => (string) ($row['id'] ?? ''),
                    'userId' => (string) ($row['user_id'] ?? ''),
                    'fromDeptId' => (string) ($row['from_dept_id'] ?? ''),
                    'toDeptId' => (string) ($row['to_dept_id'] ?? ''),
                    'transferDate' => $this->formatDateColumn($row['transfer_date'] ?? null) ?? '',
                    'reason' => (string) ($row['reason'] ?? ''),
                    'createdDate' => $this->formatDateColumn($row['created_at'] ?? null),
                    'decisionNumber' => (string) ($row['decision_number'] ?? ''),
                ];
            })
            ->map(function (array $row) use ($userMap, $deptMap): array {
                $userId = (string) ($row['userId'] ?? '');
                $fromDeptId = (string) ($row['fromDeptId'] ?? '');
                $toDeptId = (string) ($row['toDeptId'] ?? '');

                $user = $userMap[$userId] ?? null;
                $fromDept = $deptMap[$fromDeptId] ?? null;
                $toDept = $deptMap[$toDeptId] ?? null;

                $userCode = $this->normalizeEmployeeCode(
                    (string) ($user['user_code'] ?? ''),
                    $user['id'] ?? $userId
                );
                $userName = (string) $this->support->firstNonEmpty($user ?? [], ['full_name', 'username'], '');

                return [
                    ...$row,
                    'userCode' => $userCode,
                    'userName' => $userName,
                    'fromDeptCode' => $fromDept['dept_code'] ?? null,
                    'fromDeptName' => $fromDept['dept_name'] ?? null,
                    'toDeptCode' => $toDept['dept_code'] ?? null,
                    'toDeptName' => $toDept['dept_name'] ?? null,
                ];
            })
            ->values();
    }

    /**
     * @param array<int, int> $userIds
     * @return array<string, array<string, string>>
     */
    private function resolveTransferUserMap(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        $userTable = $this->resolveEmployeeTable();
        if ($userTable === null) {
            return [];
        }

        $columns = $this->support->selectColumns($userTable, ['id', 'user_code', 'full_name', 'username', 'name']);
        if (! in_array('id', $columns, true)) {
            return [];
        }

        return DB::table($userTable)
            ->select($columns)
            ->whereIn('id', $userIds)
            ->get()
            ->map(function (object $record): array {
                $data = (array) $record;

                return [
                    'id' => (string) ($data['id'] ?? ''),
                    'user_code' => (string) $this->support->firstNonEmpty($data, ['user_code', 'username', 'id'], ''),
                    'full_name' => (string) $this->support->firstNonEmpty($data, ['full_name', 'name'], ''),
                    'username' => (string) $this->support->firstNonEmpty($data, ['username'], ''),
                ];
            })
            ->filter(fn (array $record): bool => $record['id'] !== '')
            ->keyBy('id')
            ->all();
    }

    /**
     * @param array<int, int> $deptIds
     * @return array<string, array<string, string>>
     */
    private function resolveTransferDepartmentMap(array $deptIds): array
    {
        if ($deptIds === [] || ! $this->support->hasTable('departments')) {
            return [];
        }

        $columns = $this->support->selectColumns('departments', ['id', 'dept_code', 'dept_name']);
        if (! in_array('id', $columns, true)) {
            return [];
        }

        return DB::table('departments')
            ->select($columns)
            ->whereIn('id', $deptIds)
            ->get()
            ->map(function (object $record): array {
                $data = (array) $record;

                return [
                    'id' => (string) ($data['id'] ?? ''),
                    'dept_code' => (string) ($data['dept_code'] ?? ''),
                    'dept_name' => (string) ($data['dept_name'] ?? ''),
                ];
            })
            ->filter(fn (array $record): bool => $record['id'] !== '')
            ->keyBy('id')
            ->all();
    }

    private function resolveEmployeeTable(): ?string
    {
        if ($this->support->hasTable('internal_users')) {
            return 'internal_users';
        }

        return $this->support->hasTable('users') ? 'users' : null;
    }

    private function loadContractExpiryAlertSettingsRow(): ?array
    {
        if (! $this->support->hasTable('integration_settings')) {
            return null;
        }

        $record = DB::table('integration_settings')
            ->select($this->support->selectColumns('integration_settings', [
                'provider',
                'contract_expiry_warning_days',
                'updated_at',
            ]))
            ->where('provider', self::CONTRACT_ALERT_INTEGRATION_PROVIDER)
            ->first();

        return $record !== null ? (array) $record : null;
    }

    private function loadContractPaymentAlertSettingsRow(): ?array
    {
        if (! $this->support->hasTable('integration_settings')) {
            return null;
        }

        $record = DB::table('integration_settings')
            ->select($this->support->selectColumns('integration_settings', [
                'provider',
                'contract_payment_warning_days',
                'updated_at',
            ]))
            ->where('provider', self::CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER)
            ->first();

        return $record !== null ? (array) $record : null;
    }

    private function formatDateColumn(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $text, $matches) === 1) {
            return $matches[0];
        }

        return $text;
    }

    private function normalizeEmployeeCode(string $rawCode, mixed $id): string
    {
        $code = strtoupper(trim($rawCode));
        if ($code !== '' && preg_match('/^(VNPT|CTV)\d{5,}$/', $code) === 1) {
            return $code;
        }

        if (preg_match('/^NV(\d+)$/', $code, $matches) === 1) {
            return 'VNPT'.str_pad((string) $matches[1], 6, '0', STR_PAD_LEFT);
        }

        if (preg_match('/^CTV(\d+)$/', $code, $matches) === 1) {
            return 'CTV'.str_pad((string) $matches[1], 6, '0', STR_PAD_LEFT);
        }

        $idDigits = preg_replace('/\D+/', '', (string) $id);
        if ($idDigits !== '') {
            return 'VNPT'.str_pad($idDigits, 6, '0', STR_PAD_LEFT);
        }

        return $code !== '' ? $code : 'VNPT000000';
    }
}
