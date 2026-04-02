<?php

namespace App\Services\V5\CustomerRequest;

use App\Models\CustomerRequestCase;
use App\Models\CustomerRequestStatusInstance;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use App\Services\V5\CustomerRequest\CustomerRequestCaseTransitionEvaluator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class CustomerRequestCaseWriteService
{
    private const PM_MISSING_CUSTOMER_INFO_DECISION_CONTEXT_CODE = 'pm_missing_customer_info_review';

    private const PM_MISSING_CUSTOMER_INFO_OUTCOME_CUSTOMER_MISSING_INFO = 'customer_missing_info';

    private const PM_MISSING_CUSTOMER_INFO_OUTCOME_OTHER_REASON = 'other_reason';

    /**
     * @var array<string, array<int, string>>
     */
    private array $tableColumns = [];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly UserAccessService $userAccess,
        private readonly CustomerRequestCaseReadQueryService $readQueryService,
        private readonly CustomerRequestCaseReadModelService $readModelService,
        private readonly CustomerRequestCaseMetadataService $metadataService,
        private readonly CustomerRequestCaseTransitionEvaluator $transitionEvaluator,
    ) {}

    /**
     * @param callable(CustomerRequestCase,string,?int): array<string,mixed> $buildStatusDetailData
     */
    public function store(Request $request, callable $buildStatusDetailData): JsonResponse
    {
        $msg = '[CRC STORE] START - payload keys: ' . json_encode(array_keys($request->all()));
        Log::debug('crc.store.start', ['payload_keys' => array_keys($request->all())]);
        error_log($msg);

        if (($missing = $this->readQueryService->missingTablesResponse()) !== null) {
            Log::debug('crc.store.missing_tables');
            return $missing;
        }

        [$masterPayload, $masterErrors] = $this->normalizeMasterPayload($request, true);
        Log::debug('crc.store.master_payload', [
            'master_payload' => $masterPayload,
            'master_errors' => $masterErrors,
        ]);
        if ($masterErrors !== []) {
            return response()->json(['message' => 'Dữ liệu yêu cầu không hợp lệ.', 'errors' => $masterErrors], 422);
        }

        $workflowDefinitionId = $this->metadataService->resolveWorkflowDefinitionId(
            $this->support->parseNullableInt($masterPayload['workflow_definition_id'] ?? null)
        );
        $statusDefinition = $this->metadataService->getStatusMeta('new_intake', $workflowDefinitionId);
        Log::debug('crc.store.status_definition', [
            'workflow_definition_id' => $workflowDefinitionId,
            'status_definition' => $statusDefinition,
        ]);
        if ($statusDefinition === null) {
            return response()->json(['message' => 'Thiếu cấu hình trạng thái mở đầu.'], 500);
        }

        $actorId = $this->readQueryService->resolveActorId($request);
        $statusSource = $this->extractStatusPayload($request);
        [$statusPayload, $statusErrors] = $this->normalizeStatusPayload($statusDefinition, $statusSource, null, $actorId);
        Log::debug('crc.store.status_payload', [
            'actor_id' => $actorId,
            'status_source' => $statusSource,
            'status_payload' => $statusPayload,
            'status_errors' => $statusErrors,
        ]);
        if ($statusErrors !== []) {
            return response()->json(['message' => 'Dữ liệu trạng thái không hợp lệ.', 'errors' => $statusErrors], 422);
        }

        $createdCase = DB::transaction(function () use ($masterPayload, $statusDefinition, $statusPayload, $actorId, $request, $workflowDefinitionId): CustomerRequestCase {
            Log::debug('crc.store.tx.begin');
            $receivedAt = now()->format('Y-m-d H:i:s');
            $receivedByUserId = $actorId;
            $requestCase = new CustomerRequestCase();
            $requestCase->fill([
                ...$masterPayload,
                'request_code' => $this->generateRequestCode(),
                'workflow_definition_id' => $workflowDefinitionId,
                'current_status_code' => (string) $statusDefinition['status_code'],
                'received_at' => $receivedAt,
                'received_by_user_id' => $receivedByUserId,
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'current_status_changed_at' => now()->format('Y-m-d H:i:s'),
            ]);
            $requestCase->requester_name_snapshot = $this->resolveRequesterSnapshot(
                $this->support->parseNullableInt($requestCase->customer_personnel_id),
                $masterPayload['requester_name_snapshot'] ?? null
            );
            Log::debug('crc.store.before_case_save', [
                'attributes' => $requestCase->getAttributes(),
            ]);
            $requestCase->save();
            Log::debug('crc.store.after_case_save', [
                'case_id' => $requestCase->id,
            ]);

            $transition = $this->createStatusInstanceAndRow(
                $requestCase,
                $statusDefinition,
                $statusPayload,
                $actorId,
                null
            );
            Log::debug('crc.store.after_create_status_instance', $transition);

            $this->syncCaseCurrentStatus($requestCase, $statusDefinition, $transition['instance_id'], $statusPayload, $actorId);
            Log::debug('crc.store.after_sync_current_status');
            $this->syncCurrentStatusRelations(
                (int) $requestCase->id,
                $transition['instance_id'],
                $request,
                $actorId
            );
            Log::debug('crc.store.after_sync_relations');
            $requestCase->save();
            Log::debug('crc.store.after_final_case_save');
            $this->appendAuditLog(
                'INSERT',
                'customer_request_cases',
                (int) $requestCase->id,
                null,
                $this->readModelService->serializeCaseModel($requestCase),
                $actorId
            );
            Log::debug('crc.store.after_audit_log');

            return $requestCase->fresh() ?? $requestCase;
        });

        Log::debug('crc.store.after_transaction', [
            'case_id' => $createdCase->id,
        ]);
        $serializedCase = $this->readModelService->serializeCaseModel($createdCase);
        Log::debug('crc.store.before_response');

        return response()->json([
            'data' => [
                ...$serializedCase,
                'request_case' => $serializedCase,
            ],
        ], 201);
    }

    /**
     * @param callable(CustomerRequestCase,string,?int): array<string,mixed> $buildStatusDetailData
     */
    public function saveStatus(Request $request, int $id, string $statusCode, callable $buildStatusDetailData): JsonResponse
    {
        if (($missing = $this->readQueryService->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->readQueryService->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $workflowDefinitionId = $this->metadataService->resolveWorkflowDefinitionId(
            $this->support->parseNullableInt($case->workflow_definition_id)
        );
        $statusDefinition = $this->metadataService->getStatusMeta($statusCode, $workflowDefinitionId);
        if ($statusDefinition === null) {
            return response()->json(['message' => 'Trạng thái không tồn tại.'], 404);
        }

        $case->workflow_definition_id = $workflowDefinitionId;

        $actorId = $this->readQueryService->resolveActorId($request);
        if (! $this->canWriteCase($case, $actorId)) {
            return response()->json(['message' => 'Bạn không có quyền thao tác yêu cầu này.'], 403);
        }


        [$masterPatch, $masterErrors] = $this->normalizeMasterPayload($request, false);
        if ($masterErrors !== []) {
            return response()->json(['message' => 'Dữ liệu yêu cầu không hợp lệ.', 'errors' => $masterErrors], 422);
        }

        $statusSource = $this->extractStatusPayload($request);
        [$statusPayload, $statusErrors] = $this->normalizeStatusPayload($statusDefinition, $statusSource, $case, $actorId);
        if ($statusErrors !== []) {
            return response()->json(['message' => 'Dữ liệu trạng thái không hợp lệ.', 'errors' => $statusErrors], 422);
        }

        $targetStatusCode = (string) $statusDefinition['status_code'];
        $currentStatusCode = (string) $case->current_status_code;
        $transitionDecisionMetadata = [];

        if ($targetStatusCode !== $currentStatusCode) {
            try {
                $this->assertTransitionAllowed($case, $currentStatusCode, $targetStatusCode);
            } catch (\RuntimeException $exception) {
                return response()->json([
                    'message' => $exception->getMessage(),
                    'errors' => [
                        'to_status_code' => [$exception->getMessage()],
                    ],
                ], 422);
            }

            [$transitionDecisionMetadata, $decisionErrors] = $this->resolveTransitionDecisionMetadata(
                $request,
                $statusSource,
                $case,
                $currentStatusCode,
                $targetStatusCode
            );
            if ($decisionErrors !== []) {
                return response()->json([
                    'message' => 'Dữ liệu decision không hợp lệ.',
                    'errors' => $decisionErrors,
                ], 422);
            }
        }

        $updatedCase = DB::transaction(function () use ($case, $masterPatch, $statusDefinition, $statusPayload, $actorId, $request, $currentStatusCode, $targetStatusCode, $transitionDecisionMetadata): CustomerRequestCase {
            $before = $this->readModelService->serializeCaseModel($case);

            if ($masterPatch !== []) {
                $case->fill($masterPatch);
            }
            $case->requester_name_snapshot = $this->resolveRequesterSnapshot(
                $this->support->parseNullableInt($case->customer_personnel_id),
                $case->requester_name_snapshot
            );

            if ($targetStatusCode === $currentStatusCode) {
                $currentInstance = $this->currentStatusInstance($case);
                if ($currentInstance === null) {
                    throw new \RuntimeException('Thiếu trạng thái hiện tại.');
                }

                $rowId = $this->upsertStatusRow(
                    $statusDefinition,
                    (int) $case->id,
                    (int) $currentInstance->id,
                    $statusPayload,
                    $actorId,
                    $this->support->parseNullableInt($currentInstance->status_row_id)
                );

                DB::table('customer_request_status_instances')
                    ->where('id', $currentInstance->id)
                    ->update($this->filterByTableColumns('customer_request_status_instances', [
                        'status_row_id' => $rowId,
                        'updated_by' => $actorId,
                        'updated_at' => now(),
                    ]));

                $this->syncCaseCurrentStatus($case, $statusDefinition, (int) $currentInstance->id, $statusPayload, $actorId);
                $this->syncCurrentStatusRelations((int) $case->id, (int) $currentInstance->id, $request, $actorId);
            } else {
                $transition = $this->createStatusInstanceAndRow(
                    $case,
                    $statusDefinition,
                    $statusPayload,
                    $actorId,
                    $this->currentStatusInstance($case),
                    $transitionDecisionMetadata
                );

                $this->syncCaseCurrentStatus($case, $statusDefinition, $transition['instance_id'], $statusPayload, $actorId);
                $this->syncCurrentStatusRelations((int) $case->id, $transition['instance_id'], $request, $actorId);
            }

            $case->save();
            $fresh = $case->fresh() ?? $case;

            $this->appendAuditLog(
                'UPDATE',
                'customer_request_cases',
                (int) $fresh->id,
                $before,
                $this->readModelService->serializeCaseModel($fresh),
                $actorId
            );

            return $fresh;
        });

        return response()->json([
            'data' => $buildStatusDetailData($updatedCase, (string) $updatedCase->current_status_code, $actorId),
        ]);
    }

    /**
     * @param callable(CustomerRequestCase,string,?int): array<string,mixed> $buildStatusDetailData
     */
    public function transition(Request $request, int $id, callable $buildStatusDetailData): JsonResponse
    {
        $targetStatusCode = $this->normalizeNullableString(
            $request->input('to_status_code', $request->input('status_code'))
        );
        if ($targetStatusCode === null) {
            return response()->json(['message' => 'to_status_code là bắt buộc.'], 422);
        }

        if (($missing = $this->readQueryService->missingTablesResponse()) !== null) {
            return $missing;
        }

        $actorId = $this->readQueryService->resolveActorId($request);
        $case = $this->findAccessibleCaseModel($id, $actorId);
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        if ((string) $case->current_status_code === $targetStatusCode) {
            return response()->json([
                'message' => 'Không thể chuyển sang chính trạng thái hiện tại.',
                'errors' => [
                    'to_status_code' => ['Không thể chuyển sang chính trạng thái hiện tại.'],
                ],
            ], 422);
        }

        return $this->saveStatus($request, $id, $targetStatusCode, $buildStatusDetailData);
    }

    public function updateSubStatus(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->readQueryService->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->readQueryService->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $actorId = $this->readQueryService->resolveActorId($request);
        if (! $this->canWriteCase($case, $actorId)) {
            return response()->json(['message' => 'Bạn không có quyền cập nhật sub-status.'], 403);
        }

        $statusCode = (string) $case->current_status_code;

        $validCodingPhases = ['coding', 'coding_done', 'upcode_pending', 'upcode_deployed', 'suspended'];
        $validDmsPhases = ['exchange', 'task_created', 'in_progress', 'completed', 'suspended'];

        $updated = false;
        $errors = [];

        if ($statusCode === 'coding' && $request->exists('coding_phase')) {
            $phase = $this->normalizeNullableString($request->input('coding_phase'));
            if ($phase === null || ! in_array($phase, $validCodingPhases, true)) {
                $errors['coding_phase'][] = 'coding_phase không hợp lệ.';
            } else {
                $now = now()->format('Y-m-d H:i:s');
                $payload = ['coding_phase' => $phase, 'updated_by' => $actorId, 'updated_at' => $now];
                if ($phase === 'coding_done' && $request->missing('coding_completed_at')) {
                    $payload['coding_completed_at'] = $now;
                }
                if ($phase === 'upcode_deployed') {
                    if ($request->has('upcode_at')) {
                        $payload['upcode_at'] = $this->readQueryService->normalizeDateTime($request->input('upcode_at')) ?? $now;
                    }
                    if ($request->has('upcode_version')) {
                        $payload['upcode_version'] = $this->normalizeNullableString($request->input('upcode_version'));
                    }
                    if ($request->has('upcode_environment')) {
                        $payload['upcode_environment'] = $this->normalizeNullableString($request->input('upcode_environment'));
                    }
                }
                DB::table('customer_request_coding')
                    ->where('request_case_id', $case->id)
                    ->update($this->filterByTableColumns('customer_request_coding', $payload));
                $updated = true;
            }
        } elseif ($statusCode === 'dms_transfer' && $request->exists('dms_phase')) {
            $phase = $this->normalizeNullableString($request->input('dms_phase'));
            if ($phase === null || ! in_array($phase, $validDmsPhases, true)) {
                $errors['dms_phase'][] = 'dms_phase không hợp lệ.';
            } else {
                $now = now()->format('Y-m-d H:i:s');
                $payload = ['dms_phase' => $phase, 'updated_by' => $actorId, 'updated_at' => $now];
                if ($phase === 'completed' && $request->missing('dms_completed_at')) {
                    $payload['dms_completed_at'] = $now;
                }
                if ($request->has('task_ref')) {
                    $payload['task_ref'] = $this->normalizeNullableString($request->input('task_ref'));
                }
                if ($request->has('task_url')) {
                    $payload['task_url'] = $this->normalizeNullableString($request->input('task_url'));
                }
                DB::table('customer_request_dms_transfer')
                    ->where('request_case_id', $case->id)
                    ->update($this->filterByTableColumns('customer_request_dms_transfer', $payload));
                $updated = true;
            }
        } else {
            return response()->json([
                'message' => "Sub-status chỉ áp dụng cho trạng thái 'coding' hoặc 'dms_transfer'. Trạng thái hiện tại: {$statusCode}.",
            ], 422);
        }

        if ($errors !== []) {
            return response()->json(['message' => 'Dữ liệu không hợp lệ.', 'errors' => $errors], 422);
        }

        if (! $updated) {
            return response()->json(['message' => 'Không có trường nào được cập nhật.'], 422);
        }

        $currentInstance = $this->currentStatusInstance($case);
        if ($currentInstance !== null) {
            $statusDefinition = $this->metadataService->getStatusMeta((string) $case->current_status_code, $this->support->parseNullableInt($case->workflow_definition_id));
            if ($statusDefinition !== null) {
                $statusRow = $this->readModelService->loadStatusRow((string) $statusDefinition['table_name'], $currentInstance->status_row_id);
                $this->syncCaseCurrentStatus(
                    $case,
                    $statusDefinition,
                    (int) $currentInstance->id,
                    $statusRow ?? [],
                    $actorId
                );
                $case->save();
            }
        }

        $case->refresh();

        return response()->json([
            'message' => 'Cập nhật sub-status thành công.',
            'data' => $this->readModelService->serializeCaseModel($case),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->readQueryService->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->readQueryService->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $actorId = $this->readQueryService->resolveActorId($request);
        if ($actorId === null || ! $this->userAccess->isAdmin($actorId)) {
            return response()->json(['message' => 'Bạn không có quyền xóa yêu cầu này.'], 403);
        }

        DB::transaction(function () use ($case, $actorId): void {
            $before = $this->readModelService->serializeCaseModel($case);
            $timestamp = now()->format('Y-m-d H:i:s');

            DB::table('customer_request_cases')
                ->where('id', $case->id)
                ->update($this->filterByTableColumns('customer_request_cases', [
                    'deleted_at' => $timestamp,
                    'updated_by' => $actorId,
                    'updated_at' => $timestamp,
                ]));

            $this->appendAuditLog(
                'DELETE',
                'customer_request_cases',
                (int) $case->id,
                $before,
                null,
                $actorId
            );
        });

        return response()->json(['message' => 'Đã xóa yêu cầu thành công.']);
    }

    public function filterByTableColumns(string $table, array $payload): array
    {
        $allowedColumns = array_flip($this->tableColumns($table));
        $filtered = [];
        foreach ($payload as $key => $value) {
            if (isset($allowedColumns[$key])) {
                $filtered[$key] = $value;
            }
        }

        return $filtered;
    }

    public function resolveRequesterSnapshot(?int $customerPersonnelId, mixed $fallback = null): ?string
    {
        if (
            $customerPersonnelId !== null
            && $this->support->hasTable('customer_personnel')
            && $this->support->hasColumn('customer_personnel', 'full_name')
        ) {
            $name = DB::table('customer_personnel')
                ->where('id', $customerPersonnelId)
                ->when($this->support->hasColumn('customer_personnel', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
                ->value('full_name');
            if (is_string($name) && trim($name) !== '') {
                return trim($name);
            }
        }

        return $this->normalizeNullableString($fallback);
    }

    private function caseModelQuery(): Builder
    {
        return CustomerRequestCase::query()->whereNull('deleted_at');
    }

    private function findAccessibleCaseModel(int $id, ?int $userId): ?CustomerRequestCase
    {
        $query = $this->caseModelQuery()->whereKey($id);

        if ($userId !== null && ! $this->userAccess->isAdmin($userId)) {
            $projectIds = $this->readQueryService->projectIdsForUserByRaciRoles($userId);
            $query->where(function (Builder $builder) use ($userId, $projectIds): void {
                $builder
                    ->where('created_by', $userId)
                    ->orWhere('received_by_user_id', $userId);

                if ($this->support->hasColumn('customer_request_cases', 'dispatcher_user_id')) {
                    $builder->orWhere('dispatcher_user_id', $userId);
                }

                if ($this->support->hasColumn('customer_request_cases', 'performer_user_id')) {
                    $builder->orWhere('performer_user_id', $userId);
                }

                if ($projectIds !== []) {
                    $builder->orWhereIn('project_id', $projectIds);
                }
            });
        }

        return $query->first();
    }

    private function canWriteCase(CustomerRequestCase $case, ?int $userId): bool
    {
        if ($userId === null) {
            return true;
        }

        if ($this->userAccess->isAdmin($userId)) {
            return true;
        }

        $allowedUserIds = array_filter([
            $this->support->parseNullableInt($case->created_by),
            $this->support->parseNullableInt($case->received_by_user_id),
            $this->support->parseNullableInt($case->dispatcher_user_id),
            $this->support->parseNullableInt($case->performer_user_id),
        ]);

        if (in_array($userId, $allowedUserIds, true)) {
            return true;
        }

        $projectId = $this->support->parseNullableInt($case->project_id);

        return $projectId !== null && in_array($projectId, $this->readQueryService->projectIdsForUserByRaciRoles($userId), true);
    }

    /**
     * @return array{0:array<string,mixed>,1:array<string,array<int,string>>}
     */
    private function normalizeMasterPayload(Request $request, bool $requireRequiredFields): array
    {
        $source = $this->extractMasterPayload($request);
        $normalized = [];
        $errors = [];

        foreach ($this->metadataService->getMasterFields() as $field) {
            $name = (string) $field['name'];
            $hasValue = array_key_exists($name, $source) || $request->exists($name);
            if (! $requireRequiredFields && ! $hasValue) {
                continue;
            }

            $value = array_key_exists($name, $source) ? $source[$name] : $request->input($name);
            $normalized[$name] = $this->normalizeFieldValue($field, $value);

            if (($field['required'] ?? false) && $requireRequiredFields && ($normalized[$name] === null || $normalized[$name] === '')) {
                $errors[$name][] = "{$field['label']} là bắt buộc.";
            }
        }

        foreach (['dispatcher_user_id', 'performer_user_id'] as $extraUserField) {
            $hasValue = array_key_exists($extraUserField, $source) || $request->exists($extraUserField);
            if (! $requireRequiredFields && ! $hasValue) {
                continue;
            }

            $value = array_key_exists($extraUserField, $source) ? $source[$extraUserField] : $request->input($extraUserField);
            $normalized[$extraUserField] = $this->support->parseNullableInt($value);
        }

        if ($request->exists('dispatch_route') || array_key_exists('dispatch_route', $source)) {
            $dispatchRouteRaw = array_key_exists('dispatch_route', $source) ? $source['dispatch_route'] : $request->input('dispatch_route');
            $dispatchRoute = $this->normalizeNullableString($dispatchRouteRaw);
            if ($dispatchRoute !== null && ! in_array($dispatchRoute, ['self_handle', 'assign_pm', 'assign_direct'], true)) {
                $errors['dispatch_route'][] = 'dispatch_route phải là self_handle, assign_pm hoặc assign_direct.';
            } else {
                $normalized['dispatch_route'] = $dispatchRoute;
            }
        }

        // Handle workflow_definition_id
        if ($request->exists('workflow_definition_id') || array_key_exists('workflow_definition_id', $source)) {
            $workflowIdRaw = array_key_exists('workflow_definition_id', $source) ? $source['workflow_definition_id'] : $request->input('workflow_definition_id');
            $normalized['workflow_definition_id'] = $this->support->parseNullableInt($workflowIdRaw);
        }

        if ($requireRequiredFields && ($normalized['priority'] ?? null) === null) {
            $normalized['priority'] = 2;
        }

        if (array_key_exists('priority', $normalized) && ! in_array((int) $normalized['priority'], [1, 2, 3, 4], true)) {
            $errors['priority'][] = 'Độ ưu tiên không hợp lệ.';
        }

        foreach ([
            'customer_id' => 'customers',
            'customer_personnel_id' => 'customer_personnel',
            'support_service_group_id' => 'support_service_groups',
            'project_id' => 'projects',
            'project_item_id' => 'project_items',
            'product_id' => 'products',
        ] as $column => $table) {
            $entityId = $this->support->parseNullableInt($normalized[$column] ?? null);
            if ($entityId !== null && $this->support->hasTable($table) && ! DB::table($table)->where('id', $entityId)->exists()) {
                $errors[$column][] = "{$column} không hợp lệ.";
            }
        }

        foreach (['dispatcher_user_id', 'performer_user_id'] as $extraUserField) {
            $entityId = $this->support->parseNullableInt($normalized[$extraUserField] ?? null);
            if ($entityId !== null && $this->support->hasTable('internal_users') && ! DB::table('internal_users')->where('id', $entityId)->exists()) {
                $errors[$extraUserField][] = "{$extraUserField} không hợp lệ.";
            }
        }

        if ($requireRequiredFields || array_key_exists('customer_personnel_id', $normalized) || $request->exists('requester_name_snapshot')) {
            $normalized['requester_name_snapshot'] = $this->resolveRequesterSnapshot(
                $this->support->parseNullableInt($normalized['customer_personnel_id'] ?? null),
                $request->input('requester_name_snapshot')
            );
        }

        return [$this->filterByTableColumns('customer_request_cases', $normalized), $errors];
    }

    /**
     * @param array<string, mixed> $source
     * @param array<string, mixed> $definition
     * @return array{0:array<string,mixed>,1:array<string,array<int,string>>}
     */
    private function normalizeStatusPayload(array $definition, array $source, ?CustomerRequestCase $case, ?int $actorId): array
    {
        $normalized = [];
        $errors = [];
        $existingRow = null;
        $statusCode = (string) ($definition['status_code'] ?? '');
        $workflowDefinitionId = $this->support->parseNullableInt($definition['workflow_definition_id'] ?? ($case?->workflow_definition_id ?? null));
        $handlerField = $this->metadataService->resolveHandlerField($statusCode, $workflowDefinitionId);
        $formFields = array_values($definition['form_fields'] ?? []);
        $tableName = (string) ($definition['table_name'] ?? 'customer_request_cases');

        if ($case !== null && (string) $case->current_status_code === $statusCode) {
            $currentInstance = $this->currentStatusInstance($case);
            if ($currentInstance !== null) {
                $existingRow = $this->readModelService->loadStatusRow($tableName, $currentInstance->status_row_id);
            }
        }

        if (isset($source['handler_user_id']) && $handlerField !== null && ! array_key_exists($handlerField, $source)) {
            $source[$handlerField] = $source['handler_user_id'];
        }

        $explicitCurrentHandlerId = $this->support->parseNullableInt($source['nguoi_xu_ly_id'] ?? null);
        if ($statusCode === 'pending_dispatch' && array_key_exists('dispatch_notes', $source) && ! array_key_exists('dispatch_note', $source)) {
            $source['dispatch_note'] = $source['dispatch_notes'];
        }
        unset($source['handler_user_id']);

        foreach ($formFields as $field) {
            $name = (string) ($field['name'] ?? '');
            if ($name === '') {
                continue;
            }

            $value = $source[$name] ?? ($existingRow[$name] ?? null);
            $normalized[$name] = $this->normalizeFieldValue($field, $value);
        }

        $this->applyStatusDefaults($definition, $normalized, $case, $actorId);

        foreach ($formFields as $field) {
            $name = (string) ($field['name'] ?? '');
            if ($name === '') {
                continue;
            }
            if (($field['required'] ?? false) && (($normalized[$name] ?? null) === null || ($normalized[$name] ?? null) === '')) {
                $errors[$name][] = (($field['label'] ?? $name)).' là bắt buộc.';
            }
        }

        foreach ($formFields as $field) {
            $name = (string) ($field['name'] ?? '');
            if ($name === '') {
                continue;
            }
            $type = (string) ($field['type'] ?? 'text');
            $value = $normalized[$name] ?? null;

            if (in_array($type, ['user_select', 'customer_select', 'customer_personnel_select', 'support_group_select'], true) && $value !== null) {
                $table = match ($type) {
                    'user_select' => 'internal_users',
                    'customer_select' => 'customers',
                    'customer_personnel_select' => 'customer_personnel',
                    'support_group_select' => 'support_service_groups',
                    default => null,
                };
                if ($table !== null && $this->support->hasTable($table) && ! DB::table($table)->where('id', (int) $value)->exists()) {
                    $errors[$name][] = (($field['label'] ?? $name)).' không hợp lệ.';
                }
            }
        }

        $filteredPayload = $this->filterByTableColumns($tableName, $normalized);
        if ($explicitCurrentHandlerId !== null) {
            $filteredPayload['nguoi_xu_ly_id'] = $explicitCurrentHandlerId;
        }

        return [$filteredPayload, $errors];
    }

    /**
     * @param array<string, mixed> $definition
     * @param array<string, mixed> $normalized
     */
    private function applyStatusDefaults(array $definition, array &$normalized, ?CustomerRequestCase $case, ?int $actorId): void
    {
        $statusCode = (string) ($definition['status_code'] ?? '');
        $workflowDefinitionId = $this->support->parseNullableInt($definition['workflow_definition_id'] ?? ($case?->workflow_definition_id ?? null));
        $handlerField = $this->metadataService->resolveHandlerField($statusCode, $workflowDefinitionId);

        if ($handlerField !== null && array_key_exists('handler_user_id', $normalized) && ! array_key_exists($handlerField, $normalized)) {
            $normalized[$handlerField] = $this->support->parseNullableInt($normalized['handler_user_id']);
        }
        unset($normalized['handler_user_id']);

        if ($handlerField !== null) {
            $normalized[$handlerField] = $this->resolveHandlerFieldDefaultValue($statusCode, $handlerField, $normalized, $case, $actorId);
        }

        switch ($statusCode) {
            case 'new_intake':
                $normalized['received_at'] = $this->readQueryService->normalizeDateTime($case?->received_at)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'assigned_to_receiver':
                $normalized['accepted_at'] = $this->readQueryService->normalizeDateTime($normalized['accepted_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'pending_dispatch':
                $normalized['dispatched_at'] = $this->readQueryService->normalizeDateTime($normalized['dispatched_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'receiver_in_progress':
                $normalized['started_at'] = $this->readQueryService->normalizeDateTime($normalized['started_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                $normalized['progress_percent'] = max(0, min(100, (int) ($normalized['progress_percent'] ?? 0)));
                break;
            case 'waiting_customer_feedback':
                $normalized['feedback_requested_at'] = $this->readQueryService->normalizeDateTime($normalized['feedback_requested_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'in_progress':
                $normalized['started_at'] = $this->readQueryService->normalizeDateTime($normalized['started_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                $normalized['progress_percent'] = max(0, min(100, (int) ($normalized['progress_percent'] ?? 0)));
                break;
            case 'not_executed':
                $normalized['decision_at'] = $this->readQueryService->normalizeDateTime($normalized['decision_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'completed':
                $normalized['completed_at'] = $this->readQueryService->normalizeDateTime($normalized['completed_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'customer_notified':
                $normalized['notified_at'] = $this->readQueryService->normalizeDateTime($normalized['notified_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'returned_to_manager':
                $normalized['returned_at'] = $this->readQueryService->normalizeDateTime($normalized['returned_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'coding':
                if (($normalized['coding_phase'] ?? null) === null) {
                    $normalized['coding_phase'] = 'coding';
                }
                break;
            case 'dms_transfer':
                if (($normalized['dms_phase'] ?? null) === null) {
                    $normalized['dms_phase'] = 'exchange';
                }
                break;
        }
    }

    private function resolveHandlerFieldDefaultValue(
        string $statusCode,
        string $handlerField,
        array $normalized,
        ?CustomerRequestCase $case,
        ?int $actorId
    ): ?int {
        $explicitValue = $this->support->parseNullableInt($normalized[$handlerField] ?? null);
        if ($explicitValue !== null) {
            return $explicitValue;
        }

        return match ($statusCode) {
            'new_intake' => $this->support->parseNullableInt($case?->received_by_user_id) ?? $actorId,
            'pending_dispatch' => $actorId,
            'assigned_to_receiver' => $this->support->parseNullableInt($case?->performer_user_id)
                ?? $this->support->parseNullableInt($case?->received_by_user_id)
                ?? $actorId,
            'receiver_in_progress' => $this->support->parseNullableInt($case?->performer_user_id) ?? $actorId,
            'in_progress', 'analysis' => $this->support->parseNullableInt($case?->received_by_user_id) ?? $actorId,
            'not_executed', 'returned_to_manager' => $actorId,
            'completed' => $this->support->parseNullableInt($case?->received_by_user_id) ?? $actorId,
            'customer_notified' => $this->resolveNotificationHandlerUserId($case, $actorId),
            'coding' => $this->support->parseNullableInt($case?->performer_user_id) ?? $actorId,
            'dms_transfer' => $this->support->parseNullableInt($case?->nguoi_xu_ly_id) ?? $actorId,
            default => $this->support->parseNullableInt($case?->{$handlerField} ?? null)
                ?? $this->support->parseNullableInt($case?->nguoi_xu_ly_id)
                ?? $this->support->parseNullableInt($case?->performer_user_id)
                ?? $this->support->parseNullableInt($case?->dispatcher_user_id)
                ?? $this->support->parseNullableInt($case?->received_by_user_id)
                ?? $actorId,
        };
    }

    private function resolveNotificationHandlerUserId(?CustomerRequestCase $case, ?int $actorId): ?int
    {
        $caseProjectId = $this->support->parseNullableInt($case?->project_id);
        if ($caseProjectId !== null) {
            $raciRows = $this->support->fetchProjectRaciAssignmentsByProjectIds([$caseProjectId]);
            $accountable = collect($raciRows)->first(
                static fn (array $row): bool =>
                    (int) ($row['project_id'] ?? 0) === $caseProjectId
                    && (string) ($row['raci_role'] ?? '') === 'A'
            );
            $handlerUserId = $this->support->parseNullableInt($accountable['user_id'] ?? null);
            if ($handlerUserId !== null) {
                return $handlerUserId;
            }
        }

        return $this->support->parseNullableInt($case?->received_by_user_id) ?? $actorId;
    }

    /**
     * @param array<string, mixed> $statusDefinition
     * @param array<string, mixed> $statusPayload
     * @param array<string, mixed> $decisionMetadata
     * @return array{instance_id:int,row_id:int}
     */
    private function createStatusInstanceAndRow(
        CustomerRequestCase $case,
        array $statusDefinition,
        array $statusPayload,
        ?int $actorId,
        ?CustomerRequestStatusInstance $previousInstance,
        array $decisionMetadata = []
    ): array {
        $enteredAt = $this->resolveStatusEnteredAt((string) $statusDefinition['status_code'], $statusPayload, $case);
        $now = now();

        if ($previousInstance !== null) {
            DB::table('customer_request_status_instances')
                ->where('id', $previousInstance->id)
                ->update($this->filterByTableColumns('customer_request_status_instances', [
                    'is_current' => 0,
                    'exited_at' => $enteredAt,
                    'updated_by' => $actorId,
                    'updated_at' => $now,
                ]));
        }

        $instanceId = (int) DB::table('customer_request_status_instances')->insertGetId(
            $this->filterByTableColumns('customer_request_status_instances', [
                'request_case_id' => (int) $case->id,
                'status_code' => (string) $statusDefinition['status_code'],
                'status_table' => (string) $statusDefinition['table_name'],
                'status_row_id' => null,
                'previous_instance_id' => $previousInstance?->id,
                'next_instance_id' => null,
                'decision_context_code' => $decisionMetadata['decision_context_code'] ?? null,
                'decision_outcome_code' => $decisionMetadata['decision_outcome_code'] ?? null,
                'decision_source_status_code' => $decisionMetadata['decision_source_status_code'] ?? null,
                'entered_at' => $enteredAt,
                'exited_at' => null,
                'is_current' => 1,
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'created_at' => $now,
                'updated_at' => $now,
            ])
        );

        $rowId = $this->upsertStatusRow($statusDefinition, (int) $case->id, $instanceId, $statusPayload, $actorId, null);

        DB::table('customer_request_status_instances')
            ->where('id', $instanceId)
            ->update($this->filterByTableColumns('customer_request_status_instances', [
                'status_row_id' => $rowId,
                'updated_by' => $actorId,
                'updated_at' => now(),
            ]));

        if ($previousInstance !== null) {
            DB::table('customer_request_status_instances')
                ->where('id', $previousInstance->id)
                ->update($this->filterByTableColumns('customer_request_status_instances', [
                    'next_instance_id' => $instanceId,
                    'updated_by' => $actorId,
                    'updated_at' => now(),
                ]));
        }

        $instance = CustomerRequestStatusInstance::query()->find($instanceId);
        if ($instance !== null) {
            $this->appendAuditLog(
                'INSERT',
                'customer_request_status_instances',
                $instanceId,
                null,
                $this->readModelService->serializeStatusInstance($instance),
                $actorId
            );
        }

        return [
            'instance_id' => $instanceId,
            'row_id' => $rowId,
        ];
    }

    /**
     * @param array<string, mixed> $statusDefinition
     * @param array<string, mixed> $payload
     */
    private function upsertStatusRow(
        array $statusDefinition,
        int $caseId,
        int $instanceId,
        array $payload,
        ?int $actorId,
        ?int $existingRowId
    ): int {
        $table = (string) $statusDefinition['table_name'];
        if ($this->isMasterBackedStatus($statusDefinition)) {
            return $caseId;
        }

        $filteredPayload = $this->filterByTableColumns($table, [
            ...$payload,
            'request_case_id' => $caseId,
            'status_instance_id' => $instanceId,
            'updated_by' => $actorId,
            'updated_at' => now(),
        ]);

        if ($existingRowId !== null) {
            DB::table($table)
                ->where('id', $existingRowId)
                ->update($filteredPayload);

            return $existingRowId;
        }

        return (int) DB::table($table)->insertGetId($this->filterByTableColumns($table, [
            ...$filteredPayload,
            'created_by' => $actorId,
            'created_at' => now(),
        ]));
    }

    /**
     * @param array<string, mixed> $statusDefinition
     * @param array<string, mixed> $statusPayload
     */
    private function syncCaseCurrentStatus(
        CustomerRequestCase $case,
        array $statusDefinition,
        int $statusInstanceId,
        array $statusPayload,
        ?int $actorId
    ): void {
        $statusCode = (string) ($statusDefinition['status_code'] ?? '');
        $workflowDefinitionId = $this->metadataService->resolveWorkflowDefinitionId(
            $this->support->parseNullableInt($statusDefinition['workflow_definition_id'] ?? ($case->workflow_definition_id ?? null))
        );

        $case->workflow_definition_id = $workflowDefinitionId;
        $case->current_status_code = $statusCode;
        $case->current_status_instance_id = $statusInstanceId;
        $case->current_status_changed_at = now()->format('Y-m-d H:i:s');
        $case->updated_by = $actorId;

        if (array_key_exists('performer_user_id', $statusPayload) && $statusPayload['performer_user_id'] !== null) {
            $case->performer_user_id = $statusPayload['performer_user_id'];
        }

        if (array_key_exists('dispatcher_user_id', $statusPayload) && $statusPayload['dispatcher_user_id'] !== null) {
            $case->dispatcher_user_id = $statusPayload['dispatcher_user_id'];
        }

        if ($this->support->hasColumn('customer_request_cases', 'nguoi_xu_ly_id')) {
            $case->nguoi_xu_ly_id = $this->resolveCurrentHandlerUserId(
                $statusCode,
                $statusPayload,
                $case,
                $actorId,
                $workflowDefinitionId
            );
            \Log::debug('crc.syncCaseCurrentStatus.nguoi_xu_ly_id', [
                'case_id' => $case->id,
                'status_code' => $statusCode,
                'nguoi_xu_ly_id' => $case->nguoi_xu_ly_id,
                'status_payload_has_explicit' => array_key_exists('nguoi_xu_ly_id', $statusPayload),
                'status_payload_nguoi_xu_ly_id' => $statusPayload['nguoi_xu_ly_id'] ?? null,
            ]);
        }

        $this->syncCaseCurrentTrackingFields($case, $statusCode, $statusInstanceId, $statusPayload);

        switch ($statusCode) {
            case 'new_intake':
                if ($case->received_by_user_id === null && array_key_exists('received_by_user_id', $statusPayload)) {
                    $case->received_by_user_id = $statusPayload['received_by_user_id'];
                }
                if ($case->received_at === null && array_key_exists('received_at', $statusPayload)) {
                    $case->received_at = $statusPayload['received_at'];
                }
                break;
            case 'completed':
                $case->completed_at = $statusPayload['completed_at'] ?? $case->completed_at;
                break;
            case 'customer_notified':
                $case->reported_to_customer_at = $statusPayload['notified_at'] ?? $case->reported_to_customer_at;
                break;
        }
    }

    private function syncCaseCurrentTrackingFields(
        CustomerRequestCase $case,
        string $statusCode,
        int $statusInstanceId,
        array $statusPayload
    ): void {
        $instance = CustomerRequestStatusInstance::query()->find($statusInstanceId);

        if ($this->support->hasColumn('customer_request_cases', 'current_entered_at')) {
            $case->current_entered_at = $instance?->entered_at;
        }
        if ($this->support->hasColumn('customer_request_cases', 'current_exited_at')) {
            $case->current_exited_at = $instance?->exited_at;
        }
        if ($this->support->hasColumn('customer_request_cases', 'previous_status_instance_id')) {
            $case->previous_status_instance_id = $instance?->previous_instance_id;
        }
        if ($this->support->hasColumn('customer_request_cases', 'next_status_instance_id')) {
            $case->next_status_instance_id = $instance?->next_instance_id;
        }
        if ($this->support->hasColumn('customer_request_cases', 'current_started_at')) {
            $case->current_started_at = $this->resolveCurrentStartedAt($statusCode, $statusPayload);
        }
        if ($this->support->hasColumn('customer_request_cases', 'current_expected_completed_at')) {
            $case->current_expected_completed_at = $this->resolveCurrentExpectedCompletedAt($statusCode, $statusPayload);
        }
        if ($this->support->hasColumn('customer_request_cases', 'current_completed_at')) {
            $case->current_completed_at = $this->resolveCurrentCompletedAt($statusCode, $statusPayload);
        }
        if ($this->support->hasColumn('customer_request_cases', 'current_status_notes')) {
            $case->current_status_notes = $this->normalizeNullableString($statusPayload['notes'] ?? null);
        }
        if ($this->support->hasColumn('customer_request_cases', 'current_progress_percent')) {
            $case->current_progress_percent = $this->resolveCurrentProgressPercent($statusCode, $statusPayload);
        }
    }

    private function resolveCurrentStartedAt(string $statusCode, array $statusPayload): ?string
    {
        return match ($statusCode) {
            'assigned_to_receiver', 'receiver_in_progress', 'in_progress' => $this->readQueryService->normalizeDateTime($statusPayload['started_at'] ?? null),
            'coding' => $this->readQueryService->normalizeDateTime($statusPayload['coding_started_at'] ?? null),
            'dms_transfer' => $this->readQueryService->normalizeDateTime($statusPayload['dms_started_at'] ?? null),
            default => null,
        };
    }

    private function resolveCurrentExpectedCompletedAt(string $statusCode, array $statusPayload): ?string
    {
        return match ($statusCode) {
            'assigned_to_receiver', 'receiver_in_progress', 'in_progress' => $this->readQueryService->normalizeDateTime($statusPayload['expected_completed_at'] ?? null),
            default => null,
        };
    }

    private function resolveCurrentCompletedAt(string $statusCode, array $statusPayload): ?string
    {
        return match ($statusCode) {
            'analysis' => $this->readQueryService->normalizeDateTime($statusPayload['analysis_completed_at'] ?? null),
            'completed' => $this->readQueryService->normalizeDateTime($statusPayload['completed_at'] ?? null),
            'coding' => $this->readQueryService->normalizeDateTime($statusPayload['coding_completed_at'] ?? null),
            'dms_transfer' => $this->readQueryService->normalizeDateTime($statusPayload['dms_completed_at'] ?? null),
            'customer_notified' => $this->readQueryService->normalizeDateTime($statusPayload['notified_at'] ?? null),
            'not_executed' => $this->readQueryService->normalizeDateTime($statusPayload['decision_at'] ?? null),
            'returned_to_manager' => $this->readQueryService->normalizeDateTime($statusPayload['returned_at'] ?? null),
            default => null,
        };
    }

    private function resolveCurrentProgressPercent(string $statusCode, array $statusPayload): int
    {
        return match ($statusCode) {
            'receiver_in_progress', 'in_progress' => max(0, min(100, (int) ($statusPayload['progress_percent'] ?? 0))),
            default => 0,
        };
    }

    private function resolveCurrentHandlerUserId(
        string $statusCode,
        array $statusPayload,
        CustomerRequestCase $case,
        ?int $actorId,
        ?int $workflowDefinitionId = null
    ): ?int {
        $explicitHandlerId = $this->support->parseNullableInt($statusPayload['nguoi_xu_ly_id'] ?? null);
        if ($explicitHandlerId !== null) {
            return $explicitHandlerId;
        }

        $handlerField = $this->metadataService->resolveHandlerField($statusCode, $workflowDefinitionId);
        if ($handlerField !== null) {
            $resolved = $this->support->parseNullableInt($statusPayload[$handlerField] ?? null)
                ?? $this->support->parseNullableInt($case->{$handlerField} ?? null)
                ?? $this->support->parseNullableInt($case->nguoi_xu_ly_id ?? null)
                ?? $this->support->parseNullableInt($case->performer_user_id ?? null)
                ?? $this->support->parseNullableInt($case->dispatcher_user_id ?? null)
                ?? $this->support->parseNullableInt($case->received_by_user_id ?? null)
                ?? $actorId;

            return $resolved;
        }

        return $this->support->parseNullableInt(
            $case->nguoi_xu_ly_id ?? $case->performer_user_id ?? $case->dispatcher_user_id ?? $case->received_by_user_id ?? $actorId
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allowedTransitionRows(string $statusCode, ?int $workflowDefinitionId = null): array
    {
        return $this->metadataService->getAllowedTransitions($statusCode, $workflowDefinitionId);
    }

    private function syncCurrentStatusRelations(int $caseId, int $statusInstanceId, Request $request, ?int $actorId): void
    {
        $statusPayload = is_array($request->input('status_payload')) ? $request->input('status_payload') : [];

        $refTasks = $request->exists('ref_tasks')
            ? $request->input('ref_tasks')
            : ($statusPayload['ref_tasks'] ?? null);

        if ($refTasks !== null) {
            $items = is_array($refTasks) ? $refTasks : [];
            $this->syncRefTasks($caseId, $statusInstanceId, $items, $actorId);
        }

        $attachments = $request->exists('attachments')
            ? $request->input('attachments')
            : ($statusPayload['attachments'] ?? null);

        if ($attachments !== null) {
            $items = is_array($attachments) ? $attachments : [];
            $this->syncAttachments($caseId, $statusInstanceId, $items, $actorId);
        }
    }

    /**
     * @param array<int, mixed> $items
     */
    private function syncRefTasks(int $caseId, int $statusInstanceId, array $items, ?int $actorId): void
    {
        if (! $this->support->hasTable('customer_request_status_ref_tasks')) {
            return;
        }

        DB::table('customer_request_status_ref_tasks')
            ->where('request_case_id', $caseId)
            ->where('status_instance_id', $statusInstanceId)
            ->delete();

        if (! $this->support->hasTable('request_ref_tasks')) {
            return;
        }

        $requestCode = (string) DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->value('request_code');

        $rows = [];
        $seen = [];
        foreach ($items as $index => $item) {
            if (! is_array($item) && ! is_numeric($item)) {
                continue;
            }
            $refTaskId = is_array($item)
                ? $this->resolveRefTaskIdFromPayload($item, $actorId, (int) $index, $requestCode, $caseId)
                : $this->support->parseNullableInt($item);
            if ($refTaskId === null || isset($seen[$refTaskId])) {
                continue;
            }
            if (! DB::table('request_ref_tasks')->where('id', $refTaskId)->exists()) {
                continue;
            }
            $seen[$refTaskId] = true;
            $rows[] = $this->filterByTableColumns('customer_request_status_ref_tasks', [
                'request_case_id' => $caseId,
                'status_instance_id' => $statusInstanceId,
                'ref_task_id' => $refTaskId,
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($rows !== []) {
            DB::table('customer_request_status_ref_tasks')->insert($rows);
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function resolveRefTaskIdFromPayload(array $payload, ?int $actorId, int $index, string $requestCode = '', int $caseId = 0): ?int
    {
        $refTaskId = $this->support->parseNullableInt($payload['id'] ?? ($payload['ref_task_id'] ?? null));
        $taskSource = strtoupper($this->normalizeNullableString($payload['task_source'] ?? null) ?? 'IT360');
        $taskCode = $this->normalizeNullableString($payload['task_code'] ?? null);
        $taskLink = $this->normalizeNullableString($payload['task_link'] ?? null);
        $taskStatus = $this->normalizeNullableString($payload['task_status'] ?? ($payload['status'] ?? null));
        $taskNote = $this->normalizeNullableString($payload['task_note'] ?? null);
        $sortOrder = $this->support->parseNullableInt($payload['sort_order'] ?? null) ?? $index;

        if ($refTaskId !== null && DB::table('request_ref_tasks')->where('id', $refTaskId)->exists()) {
            if ($taskSource === 'IT360') {
                DB::table('request_ref_tasks')
                    ->where('id', $refTaskId)
                    ->update($this->filterByTableColumns('request_ref_tasks', [
                        'task_source' => $taskSource,
                        'task_code' => $taskCode,
                        'task_link' => $taskLink,
                        'task_status' => $taskStatus,
                        'task_note' => $taskNote,
                        'sort_order' => $sortOrder,
                        'updated_by' => $actorId,
                        'updated_at' => now(),
                    ]));
            }

            return $refTaskId;
        }

        if ($taskCode === null && $taskLink === null) {
            return null;
        }

        if ($taskCode === null) {
            return null;
        }

        if ($taskLink !== null && strtoupper($taskLink) === strtoupper($taskSource)) {
            $taskLink = null;
        }

        if ($taskSource === 'REFERENCE' && $taskCode !== null) {
            $existingReferenceId = $this->support->parseNullableInt(
                DB::table('request_ref_tasks')->where('task_code', $taskCode)->value('id')
            );
            if ($existingReferenceId !== null) {
                return $existingReferenceId;
            }
        }

        $existingIt360Id = null;
        if ($taskSource === 'IT360' && ($taskCode !== null || $taskLink !== null)) {
            $query = DB::table('request_ref_tasks');
            if ($taskCode !== null) {
                $query->where('task_code', $taskCode);
            } else {
                $query->whereNull('task_code');
            }
            if ($taskLink !== null) {
                $query->where('task_link', $taskLink);
            } else {
                $query->whereNull('task_link');
            }
            if ($this->support->hasColumn('request_ref_tasks', 'task_source')) {
                $query->where('task_source', 'IT360');
            }
            $existingIt360Id = $this->support->parseNullableInt($query->value('id'));
        }

        if ($existingIt360Id !== null) {
            DB::table('request_ref_tasks')
                ->where('id', $existingIt360Id)
                ->update($this->filterByTableColumns('request_ref_tasks', [
                    'task_source' => $taskSource,
                    'task_code' => $taskCode,
                    'task_link' => $taskLink,
                    'task_status' => $taskStatus,
                    'task_note' => $taskNote,
                    'sort_order' => $sortOrder,
                    'updated_by' => $actorId,
                    'updated_at' => now(),
                ]));

            return $existingIt360Id;
        }

        return (int) DB::table('request_ref_tasks')->insertGetId($this->filterByTableColumns('request_ref_tasks', [
            'source_type' => 'CASE',
            'source_id' => $caseId > 0 ? $caseId : null,
            'request_code' => $requestCode !== '' ? $requestCode : null,
            'task_source' => $taskSource,
            'task_code' => $taskCode,
            'task_link' => $taskLink,
            'task_status' => $taskStatus,
            'task_note' => $taskNote,
            'sort_order' => $sortOrder,
            'created_by' => $actorId,
            'updated_by' => $actorId,
            'created_at' => now(),
            'updated_at' => now(),
        ]));
    }

    /**
     * @param array<int, mixed> $items
     */
    private function syncAttachments(int $caseId, int $statusInstanceId, array $items, ?int $actorId): void
    {
        if (! $this->support->hasTable('customer_request_status_attachments')) {
            return;
        }

        DB::table('customer_request_status_attachments')
            ->where('request_case_id', $caseId)
            ->where('status_instance_id', $statusInstanceId)
            ->delete();

        if (! $this->support->hasTable('attachments')) {
            return;
        }

        $rows = [];
        $seen = [];
        foreach ($items as $item) {
            if (! is_array($item) && ! is_numeric($item)) {
                continue;
            }
            $attachmentId = is_array($item)
                ? $this->support->parseNullableInt($item['id'] ?? ($item['attachment_id'] ?? null))
                : $this->support->parseNullableInt($item);
            if ($attachmentId === null || isset($seen[$attachmentId])) {
                continue;
            }
            if (! DB::table('attachments')->where('id', $attachmentId)->exists()) {
                continue;
            }
            $seen[$attachmentId] = true;
            $rows[] = $this->filterByTableColumns('customer_request_status_attachments', [
                'request_case_id' => $caseId,
                'status_instance_id' => $statusInstanceId,
                'attachment_id' => $attachmentId,
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($rows !== []) {
            DB::table('customer_request_status_attachments')->insert($rows);
        }
    }

    private function assertTransitionAllowed(CustomerRequestCase $case, string $fromStatusCode, string $toStatusCode): void
    {
        if ($fromStatusCode === $toStatusCode) {
            throw new \RuntimeException('Không thể chuyển sang chính trạng thái hiện tại.');
        }

        if (! $this->isTransitionAllowedForCase($case, $fromStatusCode, $toStatusCode)) {
            throw new \RuntimeException('Không thể chuyển sang trạng thái đích từ trạng thái hiện tại.');
        }
    }

    private function isTransitionAllowed(string $fromStatusCode, string $toStatusCode): bool
    {
        if ($fromStatusCode === $toStatusCode) {
            return false;
        }

        foreach ($this->allowedTransitionRows($fromStatusCode) as $row) {
            if ((string) ($row['to_status_code'] ?? '') === $toStatusCode) {
                return true;
            }
        }

        return false;
    }

    private function isTransitionAllowedForCase(
        CustomerRequestCase $case,
        string $fromStatusCode,
        string $toStatusCode
    ): bool {
        if ($fromStatusCode === $toStatusCode) {
            return false;
        }

        foreach ($this->allowedTransitionRowsForCase($case, $fromStatusCode) as $row) {
            if ((string) ($row['to_status_code'] ?? '') === $toStatusCode) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allowedTransitionRowsForCase(CustomerRequestCase $case, string $statusCode): array
    {
        return $this->transitionEvaluator->filterAllowedTransitionsForCase(
            $case,
            $statusCode,
            $this->allowedTransitionRows($statusCode, $case->workflow_definition_id),
            'forward'
        );
    }

    /**
     * @param array<string, mixed> $statusSource
     * @return array{0:array<string, mixed>,1:array<string,array<int,string>>}
     */
    private function resolveTransitionDecisionMetadata(
        Request $request,
        array $statusSource,
        CustomerRequestCase $case,
        string $fromStatusCode,
        string $toStatusCode
    ): array {
        $derived = $this->transitionEvaluator->buildDecisionMetadataForTransition($case, $fromStatusCode, $toStatusCode);
        if ($derived === []) {
            return [[], []];
        }

        $errors = [];
        foreach ([
            'decision_context_code',
            'decision_outcome_code',
            'decision_source_status_code',
        ] as $field) {
            $providedValue = $this->extractDecisionInput($request, $statusSource, $field);
            if ($providedValue !== null && $providedValue !== (string) ($derived[$field] ?? '')) {
                $errors[$field][] = "{$field} không khớp với luồng decision PM theo XML.";
            }
        }

        return [$derived, $errors];
    }


    private function extractDecisionInput(Request $request, array $statusSource, string $field): ?string
    {
        $value = $statusSource[$field] ?? $request->input($field);

        return $this->normalizeNullableString($value);
    }

    /**
     * @return array<string, mixed>
     */
    private function extractMasterPayload(Request $request): array
    {
        return is_array($request->input('master_payload'))
            ? $request->input('master_payload')
            : $request->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function extractStatusPayload(Request $request): array
    {
        if (is_array($request->input('status_payload'))) {
            return $request->input('status_payload');
        }

        if (is_array($request->input('process_payload'))) {
            return $request->input('process_payload');
        }

        // Nếu không có status_payload/process_payload, lấy tất cả data từ request
        // trừ các field reserved
        $reservedKeys = ['master_payload', 'status_payload', 'process_payload', 'id', 'request_case_id'];
        $payload = [];
        foreach ($request->all() as $key => $value) {
            if (! in_array($key, $reservedKeys, true)) {
                $payload[$key] = $value;
            }
        }

        return $payload;
    }

    /**
     * @param array<string, mixed> $field
     */
    private function normalizeFieldValue(array $field, mixed $value): mixed
    {
        $type = (string) ($field['type'] ?? 'text');

        return match ($type) {
            'number', 'priority', 'user_select', 'customer_select', 'customer_personnel_select', 'support_group_select'
                => $this->support->parseNullableInt($value),
            'datetime' => $this->readQueryService->normalizeDateTime($value),
            default => $this->normalizeNullableString($value),
        };
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        return $this->support->normalizeNullableString($value);
    }

    private function resolveStatusEnteredAt(string $statusCode, array $statusPayload, CustomerRequestCase $case): string
    {
        $candidates = match ($statusCode) {
            'new_intake' => [$statusPayload['received_at'] ?? null, $case->received_at, $case->created_at],
            'waiting_customer_feedback' => [$statusPayload['feedback_requested_at'] ?? null, $case->received_at],
            'in_progress' => [$statusPayload['started_at'] ?? null, $case->received_at],
            'not_executed' => [$statusPayload['decision_at'] ?? null, now()],
            'completed' => [$statusPayload['completed_at'] ?? null, now()],
            'customer_notified' => [$statusPayload['notified_at'] ?? null, now()],
            'returned_to_manager' => [$statusPayload['returned_at'] ?? null, now()],
            default => [now()],
        };

        foreach ($candidates as $candidate) {
            $normalized = $this->readQueryService->normalizeDateTime($candidate);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        return now()->format('Y-m-d H:i:s');
    }

    private function currentStatusInstance(CustomerRequestCase $case): ?CustomerRequestStatusInstance
    {
        $instanceId = $this->support->parseNullableInt($case->current_status_instance_id);
        if ($instanceId !== null) {
            return CustomerRequestStatusInstance::query()->find($instanceId);
        }

        return CustomerRequestStatusInstance::query()
            ->where('request_case_id', $case->id)
            ->where('is_current', 1)
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @return array<int, string>
     */
    private function tableColumns(string $table): array
    {
        if (! isset($this->tableColumns[$table])) {
            $this->tableColumns[$table] = Schema::hasTable($table)
                ? Schema::getColumnListing($table)
                : [];
        }

        return $this->tableColumns[$table];
    }

    private function isMasterBackedStatus(array $statusDefinition): bool
    {
        return (string) ($statusDefinition['table_name'] ?? '') === 'customer_request_cases';
    }

    private function generateRequestCode(): string
    {
        $prefix = 'CRC-'.now()->format('Ym').'-';
        $latest = DB::table('customer_request_cases')
            ->where('request_code', 'like', "{$prefix}%")
            ->orderByDesc('id')
            ->value('request_code');

        $sequence = 1;
        if (is_string($latest) && preg_match('/(\\d+)$/', $latest, $matches) === 1) {
            $sequence = ((int) $matches[1]) + 1;
        }

        return sprintf('%s%04d', $prefix, $sequence);
    }

    /**
     * @param array<string, mixed>|null $oldValues
     * @param array<string, mixed>|null $newValues
     */
    private function appendAuditLog(string $event, string $auditableType, int $auditableId, ?array $oldValues, ?array $newValues, ?int $actorId): void
    {
        if (! $this->support->hasTable('audit_logs')) {
            return;
        }

        try {
            $payload = $this->filterByTableColumns('audit_logs', [
                'uuid' => (string) Str::uuid(),
                'event' => $event,
                'auditable_type' => $auditableType,
                'auditable_id' => $auditableId,
                'old_values' => $oldValues === null ? null : json_encode($oldValues, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'new_values' => $newValues === null ? null : json_encode($newValues, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'created_by' => $actorId,
                'created_at' => now(),
            ]);

            if ($payload !== []) {
                DB::table('audit_logs')->insert($payload);
            }
        } catch (\Throwable) {
            // Không chặn luồng chính nếu audit không ghi được.
        }
    }
}
