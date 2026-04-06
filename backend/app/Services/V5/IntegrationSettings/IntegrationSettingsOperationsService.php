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
    private const CONTRACT_RENEWAL_SETTINGS_PROVIDER = 'CONTRACT_RENEWAL_SETTINGS';
    private const MIN_CONTRACT_EXPIRY_WARNING_DAYS = 1;
    private const MAX_CONTRACT_EXPIRY_WARNING_DAYS = 365;

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly EmailSmtpIntegrationService $emailSmtp,
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
            ->map(fn (object $item): array => $this->serializeReminderRow((array) $item))
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

    public function storeReminder(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('reminders')) {
            return $this->support->missingTable('reminders');
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['nullable', 'string'],
            'remind_date' => ['required', 'date'],
            'assigned_to' => ['required'],
            'status' => ['nullable', 'string', 'max:50'],
        ]);

        $assignedTo = $this->support->parseNullableInt($validated['assigned_to'] ?? null);
        if ($assignedTo === null) {
            return response()->json([
                'message' => 'assigned_to không hợp lệ.',
            ], 422);
        }

        $now = now();
        $payload = [
            'reminder_title' => trim((string) $validated['title']),
            'content' => $this->support->normalizeNullableString($validated['content'] ?? null),
            'remind_date' => (string) $validated['remind_date'],
            'assigned_to' => $assignedTo,
            'status' => strtoupper(trim((string) ($validated['status'] ?? 'ACTIVE'))),
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $insertPayload = $this->support->filterPayloadByTableColumns('reminders', $payload);
        $insertId = DB::table('reminders')->insertGetId($insertPayload);

        $reminder = DB::table('reminders')
            ->select($this->support->selectColumns('reminders', [
                'id',
                'reminder_title',
                'content',
                'remind_date',
                'assigned_to',
                'status',
                'created_at',
            ]))
            ->where('id', $insertId)
            ->first();

        return response()->json([
            'data' => $this->serializeReminderRow((array) $reminder),
        ], 201);
    }

    public function updateReminder(Request $request, string $id): JsonResponse
    {
        if (! $this->support->hasTable('reminders')) {
            return $this->support->missingTable('reminders');
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'content' => ['nullable', 'string'],
            'remind_date' => ['sometimes', 'required', 'date'],
            'assigned_to' => ['sometimes', 'required'],
            'status' => ['nullable', 'string', 'max:50'],
        ]);

        $existing = DB::table('reminders')->where('id', $id)->first();
        if ($existing === null) {
            return response()->json([
                'message' => 'Không tìm thấy nhắc việc.',
            ], 404);
        }

        $payload = [];

        if (array_key_exists('title', $validated)) {
            $payload['reminder_title'] = trim((string) $validated['title']);
        }
        if (array_key_exists('content', $validated)) {
            $payload['content'] = $this->support->normalizeNullableString($validated['content'] ?? null);
        }
        if (array_key_exists('remind_date', $validated)) {
            $payload['remind_date'] = (string) $validated['remind_date'];
        }
        if (array_key_exists('assigned_to', $validated)) {
            $assignedTo = $this->support->parseNullableInt($validated['assigned_to'] ?? null);
            if ($assignedTo === null) {
                return response()->json([
                    'message' => 'assigned_to không hợp lệ.',
                ], 422);
            }
            $payload['assigned_to'] = $assignedTo;
        }
        if (array_key_exists('status', $validated)) {
            $payload['status'] = strtoupper(trim((string) ($validated['status'] ?? 'ACTIVE')));
        }

        if ($payload === []) {
            return response()->json([
                'data' => $this->serializeReminderRow((array) $existing),
            ]);
        }

        $payload['updated_at'] = now();

        DB::table('reminders')
            ->where('id', $id)
            ->update($this->support->filterPayloadByTableColumns('reminders', $payload));

        $updated = DB::table('reminders')
            ->select($this->support->selectColumns('reminders', [
                'id',
                'reminder_title',
                'content',
                'remind_date',
                'assigned_to',
                'status',
                'created_at',
            ]))
            ->where('id', $id)
            ->first();

        return response()->json([
            'data' => $this->serializeReminderRow((array) $updated),
        ]);
    }

    public function destroyReminder(string $id): JsonResponse
    {
        if (! $this->support->hasTable('reminders')) {
            return $this->support->missingTable('reminders');
        }

        $deleted = DB::table('reminders')
            ->where('id', $id)
            ->delete();

        if ($deleted === 0) {
            return response()->json([
                'message' => 'Không tìm thấy nhắc việc.',
            ], 404);
        }

        return response()->json([
            'message' => 'Đã xóa nhắc việc.',
        ]);
    }

    public function sendReminderEmail(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'recipient_email' => ['required', 'email', 'max:255'],
        ]);

        $recipientEmail = strtolower(trim((string) $validated['recipient_email']));
        if (! str_ends_with($recipientEmail, '@gmail.com')) {
            return response()->json([
                'message' => 'Chỉ hỗ trợ gửi tới địa chỉ Gmail (@gmail.com).',
            ], 422);
        }

        if (! $this->support->hasTable('reminders')) {
            return $this->support->missingTable('reminders');
        }

        $selectColumns = $this->support->selectColumns('reminders', [
            'id',
            'reminder_title',
            'content',
            'remind_date',
            'assigned_to',
            'status',
            'created_at',
        ]);
        if (! in_array('id', $selectColumns, true)) {
            $selectColumns[] = 'id';
        }

        $reminder = DB::table('reminders')
            ->select($selectColumns)
            ->where('id', $id)
            ->first();

        if ($reminder === null) {
            return response()->json([
                'message' => 'Không tìm thấy nhắc việc.',
            ], 404);
        }

        $row = (array) $reminder;
        $mailResult = $this->emailSmtp->sendReminderEmail($row, $recipientEmail);

        if (! ($mailResult['success'] ?? false)) {
            return response()->json([
                'message' => $mailResult['message'] ?? 'Không thể gửi email nhắc việc.',
            ], 422);
        }

        return response()->json([
            'status' => 'SENT',
            'message' => $mailResult['message'] ?? 'Đã gửi email nhắc việc.',
            'recipient_email' => $recipientEmail,
            'sent_at' => $mailResult['sent_at'] ?? now()->toIso8601String(),
            'reminder' => [
                'id' => (string) ($row['id'] ?? ''),
                'title' => (string) ($row['reminder_title'] ?? ''),
                'remindDate' => $this->formatDateColumn($row['remind_date'] ?? null) ?? '',
            ],
        ]);
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

    public function storeUserDeptHistory(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('user_dept_history')) {
            return $this->support->missingTable('user_dept_history');
        }

        $payload = $this->validateUserDeptHistoryPayload($request);
        if ($payload instanceof JsonResponse) {
            return $payload;
        }

        $created = DB::transaction(function () use ($payload): ?array {
            $insertPayload = $this->support->filterPayloadByTableColumns('user_dept_history', [
                'user_id' => $payload['user_id'],
                'from_dept_id' => $payload['from_dept_id'],
                'to_dept_id' => $payload['to_dept_id'],
                'transfer_date' => $payload['transfer_date'],
                'decision_number' => $payload['decision_number'],
                'reason' => $payload['reason'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $historyId = (int) DB::table('user_dept_history')->insertGetId($insertPayload);
            $this->syncTransferUserDepartment($payload['user_id'], $payload['from_dept_id']);

            return $this->loadSerializedUserDeptHistoryRow($historyId);
        });

        if ($created === null) {
            return response()->json(['message' => 'Không thể tạo lịch sử luân chuyển.'], 500);
        }

        return response()->json(['data' => $created], 201);
    }

    public function updateUserDeptHistory(Request $request, string $id): JsonResponse
    {
        if (! $this->support->hasTable('user_dept_history')) {
            return $this->support->missingTable('user_dept_history');
        }

        $historyId = $this->support->parseNullableInt($id);
        if ($historyId === null) {
            return response()->json(['message' => 'id không hợp lệ.'], 422);
        }

        $current = $this->loadUserDeptHistoryRow($historyId);
        if ($current === null) {
            return response()->json(['message' => 'Không tìm thấy lịch sử luân chuyển.'], 404);
        }

        $payload = $this->validateUserDeptHistoryPayload($request, $current);
        if ($payload instanceof JsonResponse) {
            return $payload;
        }

        $currentUserId = $this->support->parseNullableInt($current['user_id'] ?? null);
        $currentFromDeptId = $this->support->parseNullableInt($current['from_dept_id'] ?? null);

        $updated = DB::transaction(function () use ($historyId, $payload, $currentUserId, $currentFromDeptId): ?array {
            $updatePayload = $this->support->filterPayloadByTableColumns('user_dept_history', [
                'user_id' => $payload['user_id'],
                'from_dept_id' => $payload['from_dept_id'],
                'to_dept_id' => $payload['to_dept_id'],
                'transfer_date' => $payload['transfer_date'],
                'decision_number' => $payload['decision_number'],
                'reason' => $payload['reason'],
                'updated_at' => now(),
            ]);

            DB::table('user_dept_history')
                ->where('id', $historyId)
                ->update($updatePayload);

            if ($currentUserId !== null && $currentUserId !== $payload['user_id']) {
                $this->syncTransferUserDepartment($currentUserId, $currentFromDeptId);
            }

            $this->syncTransferUserDepartment($payload['user_id'], $payload['from_dept_id']);

            return $this->loadSerializedUserDeptHistoryRow($historyId);
        });

        if ($updated === null) {
            return response()->json(['message' => 'Không thể cập nhật lịch sử luân chuyển.'], 500);
        }

        return response()->json(['data' => $updated]);
    }

    public function destroyUserDeptHistory(string $id): JsonResponse
    {
        if (! $this->support->hasTable('user_dept_history')) {
            return $this->support->missingTable('user_dept_history');
        }

        $historyId = $this->support->parseNullableInt($id);
        if ($historyId === null) {
            return response()->json(['message' => 'id không hợp lệ.'], 422);
        }

        $current = $this->loadUserDeptHistoryRow($historyId);
        if ($current === null) {
            return response()->json(['message' => 'Không tìm thấy lịch sử luân chuyển.'], 404);
        }

        $userId = $this->support->parseNullableInt($current['user_id'] ?? null);
        $fallbackDeptId = $this->support->parseNullableInt($current['from_dept_id'] ?? null);

        DB::transaction(function () use ($historyId, $userId, $fallbackDeptId): void {
            DB::table('user_dept_history')
                ->where('id', $historyId)
                ->delete();

            if ($userId !== null) {
                $this->syncTransferUserDepartment($userId, $fallbackDeptId);
            }
        });

        return response()->json([
            'message' => 'Đã xóa lịch sử luân chuyển.',
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

    // -------------------------------------------------------------------------
    // Contract Renewal Settings
    // -------------------------------------------------------------------------

    public function contractRenewalSettings(): JsonResponse
    {
        $row = $this->support->hasTable('integration_settings')
            ? DB::table('integration_settings')
                ->where('provider', self::CONTRACT_RENEWAL_SETTINGS_PROVIDER)
                ->first()
            : null;
        $rowArr = $row !== null ? (array) $row : [];

        return response()->json([
            'data' => [
                'provider' => self::CONTRACT_RENEWAL_SETTINGS_PROVIDER,
                'grace_period_days' => (int) ($rowArr['contract_renewal_grace_days'] ?? 0),
                'penalty_rate_per_day' => (float) ($rowArr['contract_renewal_penalty_rate'] ?? 0.0),
                'max_penalty_rate' => (float) ($rowArr['contract_renewal_max_penalty_rate'] ?? 50.0),
                'max_chain_depth' => (int) ($rowArr['contract_renewal_max_chain_depth'] ?? 10),
                'source' => $row !== null ? 'DB' : 'DEFAULT',
                'updated_at' => $rowArr['updated_at'] ?? null,
            ],
        ]);
    }

    public function updateContractRenewalSettings(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('integration_settings')) {
            return response()->json(['message' => 'Bảng integration_settings chưa tồn tại.'], 422);
        }

        if (! $this->support->hasColumn('integration_settings', 'contract_renewal_grace_days')) {
            return response()->json([
                'message' => 'Bảng integration_settings chưa có cột contract_renewal_*. Vui lòng chạy migration mới nhất.',
            ], 422);
        }

        $validated = $request->validate([
            'grace_period_days' => ['required', 'integer', 'min:0', 'max:365'],
            'penalty_rate_per_day' => ['required', 'numeric', 'min:0', 'max:100'],
            'max_penalty_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'max_chain_depth' => ['required', 'integer', 'min:1', 'max:20'],
        ]);

        $actorId = $this->support->parseNullableInt($request->user()?->id ?? null);
        $now = now();

        $payload = [
            'is_enabled' => true,
            'contract_renewal_grace_days' => (int) $validated['grace_period_days'],
            'contract_renewal_penalty_rate' => (float) $validated['penalty_rate_per_day'],
            'contract_renewal_max_penalty_rate' => (float) $validated['max_penalty_rate'],
            'contract_renewal_max_chain_depth' => (int) $validated['max_chain_depth'],
            'updated_at' => $now,
            'updated_by' => $actorId,
        ];

        $existing = DB::table('integration_settings')
            ->where('provider', self::CONTRACT_RENEWAL_SETTINGS_PROVIDER)
            ->first();

        if ($existing === null) {
            $payload['created_at'] = $now;
            $payload['created_by'] = $actorId;
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::CONTRACT_RENEWAL_SETTINGS_PROVIDER],
            $this->support->filterPayloadByTableColumns('integration_settings', $payload)
        );

        return $this->contractRenewalSettings();
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
     * @param array<string, mixed>|null $current
     * @return array{user_id:int,from_dept_id:?int,to_dept_id:int,transfer_date:string,decision_number:?string,reason:?string}|JsonResponse
     */
    private function validateUserDeptHistoryPayload(Request $request, ?array $current = null): array|JsonResponse
    {
        $userTable = $this->resolveEmployeeTable();
        if ($userTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $validated = $request->validate([
            'user_id' => ['required', 'integer'],
            'from_dept_id' => ['nullable', 'integer'],
            'to_dept_id' => ['required', 'integer'],
            'transfer_date' => ['required', 'date'],
            'decision_number' => ['nullable', 'string', 'max:100'],
            'reason' => ['nullable', 'string'],
        ]);

        $userId = $this->support->parseNullableInt($validated['user_id'] ?? null);
        $toDeptId = $this->support->parseNullableInt($validated['to_dept_id'] ?? null);
        $fromDeptId = $this->support->parseNullableInt($validated['from_dept_id'] ?? ($current['from_dept_id'] ?? null));

        if ($userId === null) {
            return response()->json(['message' => 'user_id không hợp lệ.'], 422);
        }
        if (! DB::table($userTable)->where('id', $userId)->exists()) {
            return response()->json(['message' => 'user_id không tồn tại.'], 422);
        }
        if ($toDeptId === null || ! $this->departmentExists($toDeptId)) {
            return response()->json(['message' => 'to_dept_id không hợp lệ.'], 422);
        }
        if ($fromDeptId !== null && ! $this->departmentExists($fromDeptId)) {
            return response()->json(['message' => 'from_dept_id không hợp lệ.'], 422);
        }

        if ($fromDeptId === null) {
            $fromDeptId = $this->resolveEmployeeDepartmentId($userId);
        }

        if ($fromDeptId !== null && $fromDeptId === $toDeptId) {
            return response()->json([
                'message' => 'to_dept_id phải khác from_dept_id.',
            ], 422);
        }

        return [
            'user_id' => $userId,
            'from_dept_id' => $fromDeptId,
            'to_dept_id' => $toDeptId,
            'transfer_date' => (string) $validated['transfer_date'],
            'decision_number' => $this->support->normalizeNullableString($validated['decision_number'] ?? ($current['decision_number'] ?? null)),
            'reason' => $this->support->normalizeNullableString($validated['reason'] ?? ($current['reason'] ?? null)),
        ];
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

    /**
     * @return array<string, mixed>|null
     */
    private function loadUserDeptHistoryRow(int $historyId): ?array
    {
        $record = DB::table('user_dept_history')
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
            ->where('id', $historyId)
            ->first();

        return $record !== null ? (array) $record : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadSerializedUserDeptHistoryRow(int $historyId): ?array
    {
        $record = $this->loadUserDeptHistoryRow($historyId);
        if ($record === null) {
            return null;
        }

        $serialized = $this->serializeUserDeptHistoryRows(collect([(object) $record]))->first();

        return is_array($serialized) ? $serialized : null;
    }

    private function departmentExists(int $departmentId): bool
    {
        return $this->support->hasTable('departments')
            && DB::table('departments')->where('id', $departmentId)->exists();
    }

    private function resolveEmployeeDepartmentId(int $userId): ?int
    {
        $userTable = $this->resolveEmployeeTable();
        if ($userTable === null) {
            return null;
        }

        $departmentColumn = $this->support->hasColumn($userTable, 'department_id')
            ? 'department_id'
            : ($this->support->hasColumn($userTable, 'dept_id') ? 'dept_id' : null);

        if ($departmentColumn === null) {
            return null;
        }

        return $this->support->parseNullableInt(
            DB::table($userTable)
                ->where('id', $userId)
                ->value($departmentColumn)
        );
    }

    private function syncTransferUserDepartment(int $userId, ?int $fallbackDepartmentId = null): void
    {
        $userTable = $this->resolveEmployeeTable();
        if ($userTable === null) {
            return;
        }

        $departmentColumn = $this->support->hasColumn($userTable, 'department_id')
            ? 'department_id'
            : ($this->support->hasColumn($userTable, 'dept_id') ? 'dept_id' : null);

        if ($departmentColumn === null) {
            return;
        }

        $latestDepartmentId = $this->support->parseNullableInt(
            DB::table('user_dept_history')
                ->where('user_id', $userId)
                ->orderByDesc('transfer_date')
                ->orderByDesc('id')
                ->value('to_dept_id')
        );

        $targetDepartmentId = $latestDepartmentId ?? $fallbackDepartmentId;
        if ($targetDepartmentId === null || ! $this->departmentExists($targetDepartmentId)) {
            return;
        }

        $payload = [$departmentColumn => $targetDepartmentId];
        if ($this->support->hasColumn($userTable, 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table($userTable)
            ->where('id', $userId)
            ->update($payload);
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

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function serializeReminderRow(array $row): array
    {
        return [
            'id' => (string) ($row['id'] ?? ''),
            'title' => (string) ($row['reminder_title'] ?? ''),
            'content' => (string) ($row['content'] ?? ''),
            'remindDate' => $this->formatDateColumn($row['remind_date'] ?? null) ?? '',
            'assignedToUserId' => (string) ($row['assigned_to'] ?? ''),
            'createdDate' => $this->formatDateColumn($row['created_at'] ?? null),
            'status' => strtoupper((string) ($row['status'] ?? 'ACTIVE')),
        ];
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
