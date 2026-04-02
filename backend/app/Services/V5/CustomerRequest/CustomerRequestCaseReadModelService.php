<?php

namespace App\Services\V5\CustomerRequest;

use App\Models\CustomerRequestCase;
use App\Models\CustomerRequestStatusInstance;
use App\Services\V5\V5DomainSupportService;
use RuntimeException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CustomerRequestCaseReadModelService
{
    /**
     * @var array<string, string|null>
     */
    private array $lookupCache = [];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly CustomerRequestCaseReadQueryService $readQuery,
        private readonly CustomerRequestCaseMetadataService $metadataService,
    ) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function loadWorklogsForInstance(int $statusInstanceId): array
    {
        return DB::table('customer_request_worklogs as wl')
            ->leftJoin('internal_users as performer', 'performer.id', '=', 'wl.performed_by_user_id')
            ->where('wl.status_instance_id', $statusInstanceId)
            ->orderByDesc('wl.work_started_at')
            ->orderByDesc('wl.id')
            ->select([
                'wl.*',
                'performer.full_name as performed_by_name',
                'performer.user_code as performed_by_code',
            ])
            ->get()
            ->map(fn (object $row): array => $this->serializeWorklogRow($row))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function loadStatusRow(string $table, mixed $rowId): ?array
    {
        $resolvedRowId = $this->support->parseNullableInt($rowId);
        if ($resolvedRowId === null || ! $this->support->hasTable($table)) {
            return null;
        }

        $row = DB::table($table)
            ->where('id', $resolvedRowId)
            ->first();

        return $row === null ? null : (array) $row;
    }

    /**
     * @param array<string, mixed> $statusDefinition
     * @param array<string, mixed> $statusRow
     * @return array<string, mixed>
     */
    public function serializeStatusRow(array $statusDefinition, array $statusRow): array
    {
        $data = [];
        foreach ($statusRow as $key => $value) {
            $data[$key] = $value;
        }

        foreach ($statusDefinition['form_fields'] as $field) {
            $fieldName = (string) $field['name'];
            $fieldType = (string) ($field['type'] ?? 'text');
            $fieldValue = $data[$fieldName] ?? null;
            if ($fieldValue === null) {
                continue;
            }

            $resolvedName = match ($fieldType) {
                'user_select' => $this->lookupName('internal_users', (int) $fieldValue, 'full_name'),
                'customer_select' => $this->lookupName('customers', (int) $fieldValue, 'customer_name'),
                'customer_personnel_select' => $this->lookupName('customer_personnel', (int) $fieldValue, 'full_name'),
                'support_group_select' => $this->lookupName('support_service_groups', (int) $fieldValue, 'group_name'),
                default => null,
            };

            if ($resolvedName !== null) {
                $data["{$fieldName}_name"] = $resolvedName;
            }
        }

        return [
            'status_code' => (string) $statusDefinition['status_code'],
            'process_code' => (string) $statusDefinition['status_code'],
            'process_label' => (string) $statusDefinition['status_name_vi'],
            'table_name' => (string) $statusDefinition['table_name'],
            'data' => $data,
        ];
    }

    /**
     * @param array<string, mixed> $case
     * @param array<string, mixed>|null $statusRow
     * @return array<string, mixed>
     */
    public function buildListValues(array $statusDefinition, array $case, ?array $statusRow): array
    {
        $values = [];
        $statusRowData = $statusRow === null ? [] : ($this->serializeStatusRow($statusDefinition, $statusRow)['data'] ?? []);

        foreach ($statusDefinition['list_columns'] as $column) {
            $key = (string) ($column['key'] ?? '');
            if ($key === '') {
                continue;
            }
            $values[$key] = $statusRowData[$key] ?? $case[$key] ?? null;
        }

        return $values;
    }

    /**
     * @param object|array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function serializeCaseRow(object|array $row): array
    {
        $record = is_object($row) ? (array) $row : $row;
        $requestCode = (string) ($record['request_code'] ?? '');
        $statusCode = (string) ($record['current_status_code'] ?? '');
        $workflowDefinitionId = $this->support->parseNullableInt($record['workflow_definition_id'] ?? null);
        $statusMeta = $statusCode !== '' ? $this->metadataService->getStatusMeta($statusCode, $workflowDefinitionId) : null;
        $statusName = $this->normalizeNullableString($record['current_status_name_vi'] ?? null)
            ?? $this->normalizeNullableString($statusMeta['status_name_vi'] ?? null)
            ?? $statusCode;
        $ketQua = match ($statusCode) {
            'completed', 'customer_notified' => 'hoan_thanh',
            'not_executed' => 'khong_tiep_nhan',
            default => 'dang_xu_ly',
        };
        $estimatedHours = $this->normalizeNullableDecimal($record['estimated_hours'] ?? null);
        $totalHoursSpent = $this->normalizeNullableDecimal($record['total_hours_spent'] ?? null) ?? 0.0;
        $hoursUsagePct = $this->calculateHoursUsagePct($estimatedHours, $totalHoursSpent);
        $warningLevel = $this->resolveWarningLevel($estimatedHours, $totalHoursSpent);
        $dispatcherUserId = $this->support->parseNullableInt($record['dispatcher_user_id'] ?? null);
        $performerUserId = $this->support->parseNullableInt($record['performer_user_id'] ?? null);
        $isSimpleMode = request()?->query('simple') === '1';

        $nguoiXuLyId = $this->support->parseNullableInt($record['nguoi_xu_ly_id'] ?? null);
        $nguoiXuLyName = $this->normalizeNullableString($record['nguoi_xu_ly_name'] ?? null);
        if ($nguoiXuLyName === null && $nguoiXuLyId !== null && ! $isSimpleMode) {
            $nguoiXuLyName = $this->lookupName('internal_users', $nguoiXuLyId, 'full_name');
        }
        $handlerField = $this->normalizeNullableString($record['handler_field'] ?? null)
            ?? ($statusCode !== '' ? $this->metadataService->resolveHandlerField($statusCode, $workflowDefinitionId) : null);
        [$currentOwnerUserId, $currentOwnerName] = $this->resolveCurrentOwner($record, $statusCode, $handlerField);
        $currentOwnerUserId = $nguoiXuLyId ?? $currentOwnerUserId;
        $currentOwnerName = $nguoiXuLyName ?? ($isSimpleMode ? null : $currentOwnerName);

        $isSimpleMode = request()?->query('simple') === '1';

        // Get allowed next processes from workflow transitions
        $allowedNextProcesses = [];
        if (! $isSimpleMode && $workflowDefinitionId !== null && $statusCode !== '') {
            $allowedNextProcesses = $this->getAllowedNextProcesses($workflowDefinitionId, $statusCode);
        }

        return [
            'id' => (int) ($record['id'] ?? 0),
            'request_code' => $requestCode,
            'ma_yc' => $requestCode,
            'legacy_customer_request_id' => $this->support->parseNullableInt($record['legacy_customer_request_id'] ?? null),
            'customer_id' => $this->support->parseNullableInt($record['customer_id'] ?? null),
            'khach_hang_id' => $this->support->parseNullableInt($record['customer_id'] ?? null),
            'customer_name' => $this->normalizeNullableString($record['customer_name'] ?? null),
            'khach_hang_name' => $this->normalizeNullableString($record['customer_name'] ?? null),
            'project_id' => $this->support->parseNullableInt($record['project_id'] ?? null),
            'project_item_id' => $this->support->parseNullableInt($record['project_item_id'] ?? null),
            'product_id' => $this->support->parseNullableInt($record['product_id'] ?? null),
            'customer_personnel_id' => $this->support->parseNullableInt($record['customer_personnel_id'] ?? null),
            'requester_name' => $this->normalizeNullableString($record['requester_name'] ?? null)
                ?? $this->normalizeNullableString($record['requester_name_snapshot'] ?? null),
            'support_service_group_id' => $this->support->parseNullableInt($record['support_service_group_id'] ?? null),
            'support_service_group_name' => $this->normalizeNullableString($record['support_service_group_name'] ?? null),
            'received_by_user_id' => $this->support->parseNullableInt($record['received_by_user_id'] ?? null),
            'received_by_name' => $this->normalizeNullableString($record['received_by_name'] ?? null),
            'dispatcher_user_id' => $dispatcherUserId,
            'dispatcher_name' => $this->normalizeNullableString($record['dispatcher_name'] ?? null),
            'performer_user_id' => $performerUserId,
            'performer_name' => $this->normalizeNullableString($record['performer_name'] ?? null),
            'received_at' => $this->normalizeNullableString($record['received_at'] ?? null),
            'summary' => (string) ($record['summary'] ?? ''),
            'tieu_de' => (string) ($record['summary'] ?? ''),
            'description' => $this->normalizeNullableString($record['description'] ?? null),
            'mo_ta' => $this->normalizeNullableString($record['description'] ?? null),
            'priority' => (int) ($record['priority'] ?? 2),
            'do_uu_tien' => (int) ($record['priority'] ?? 2),
            'source_channel' => $this->normalizeNullableString($record['source_channel'] ?? null),
            'kenh_tiep_nhan' => $this->normalizeNullableString($record['support_service_group_name'] ?? null),
            'kenh_khac' => $this->normalizeNullableString($record['source_channel'] ?? null),
            'current_status_code' => $statusCode !== '' ? $statusCode : null,
            'current_status_name_vi' => $statusName,
            'current_process_label' => $statusName,
            'trang_thai' => $statusCode !== '' ? $statusCode : null,
            'tien_trinh_hien_tai' => $statusCode !== '' ? $statusCode : null,
            'ket_qua' => $ketQua,
            'completed_at' => $this->normalizeNullableString($record['completed_at'] ?? null),
            'reported_to_customer_at' => $this->normalizeNullableString($record['reported_to_customer_at'] ?? null),
            'estimated_hours' => $estimatedHours,
            'estimated_by_user_id' => $this->support->parseNullableInt($record['estimated_by_user_id'] ?? null),
            'estimated_at' => $this->normalizeNullableString($record['estimated_at'] ?? null),
            'total_hours_spent' => round($totalHoursSpent, 2),
            'hours_usage_pct' => $hoursUsagePct,
            'warning_level' => $warningLevel,
            'over_estimate' => $warningLevel === 'hard',
            'missing_estimate' => $estimatedHours === null || $estimatedHours <= 0,
            'project_name' => $this->normalizeNullableString($record['project_name'] ?? null),
            'customer_personnel_name' => $this->normalizeNullableString($record['requester_name'] ?? null)
                ?? $this->normalizeNullableString($record['requester_name_snapshot'] ?? null),
            'sla_due_at' => $this->normalizeNullableString($record['sla_due_at'] ?? null),
            'sla_status' => $this->buildSlaStatus($record['sla_due_at'] ?? null, $statusCode),
            'current_status_instance_id' => $this->support->parseNullableInt($record['current_status_instance_id'] ?? null),
            'current_entered_at' => $this->normalizeNullableString($record['current_entered_at'] ?? null),
            'current_exited_at' => $this->normalizeNullableString($record['current_exited_at'] ?? null),
            'previous_status_instance_id' => $this->support->parseNullableInt($record['previous_status_instance_id'] ?? null),
            'next_status_instance_id' => $this->support->parseNullableInt($record['next_status_instance_id'] ?? null),
            'current_started_at' => $this->normalizeNullableString($record['current_started_at'] ?? null),
            'current_expected_completed_at' => $this->normalizeNullableString($record['current_expected_completed_at'] ?? null),
            'current_completed_at' => $this->normalizeNullableString($record['current_completed_at'] ?? null),
            'current_status_notes' => $this->normalizeNullableString($record['current_status_notes'] ?? null),
            'current_progress_percent' => (int) ($record['current_progress_percent'] ?? 0),
            'nguoi_xu_ly_id' => $nguoiXuLyId,
            'nguoi_xu_ly_name' => $nguoiXuLyName,
            'current_owner_user_id' => $currentOwnerUserId,
            'current_owner_name' => $currentOwnerName,
            'current_owner_field' => $handlerField,
            'dispatch_route' => $this->normalizeNullableString($record['dispatch_route'] ?? null),
            'dispatched_at' => $this->normalizeNullableString($record['dispatched_at'] ?? null),
            'performer_accepted_at' => $this->normalizeNullableString($record['performer_accepted_at'] ?? null),
            'workflow_definition_id' => $workflowDefinitionId,
            'allowed_next_processes' => $allowedNextProcesses,
            'created_by' => $this->support->parseNullableInt($record['created_by'] ?? null),
            'nguoi_tao_id' => $this->support->parseNullableInt($record['created_by'] ?? null),
            'created_by_name' => $this->normalizeNullableString($record['created_by_name'] ?? null),
            'nguoi_tao_name' => $this->normalizeNullableString($record['created_by_name'] ?? null),
            'updated_by' => $this->support->parseNullableInt($record['updated_by'] ?? null),
            'updated_by_name' => $this->normalizeNullableString($record['updated_by_name'] ?? null),
            'created_at' => $this->normalizeNullableString($record['created_at'] ?? null),
            'updated_at' => $this->normalizeNullableString($record['updated_at'] ?? null),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function buildRelatedPeople(CustomerRequestCase $case): array
    {
        $people = [];
        $seen = [];

        foreach ([
            [
                'user_id' => $this->support->parseNullableInt($case->created_by),
                'vai_tro' => 'nguoi_nhap',
                'trang_thai_bat_dau' => 'new_intake',
            ],
            [
                'user_id' => $this->support->parseNullableInt($case->received_by_user_id),
                'vai_tro' => 'nguoi_tiep_nhan',
                'trang_thai_bat_dau' => 'new_intake',
            ],
            [
                'user_id' => $this->support->parseNullableInt($case->dispatcher_user_id),
                'vai_tro' => 'nguoi_dieu_phoi',
                'trang_thai_bat_dau' => (string) ($case->current_status_code ?? 'new_intake'),
            ],
            [
                'user_id' => $this->support->parseNullableInt($case->performer_user_id),
                'vai_tro' => 'nguoi_thuc_hien',
                'trang_thai_bat_dau' => (string) ($case->current_status_code ?? 'new_intake'),
            ],
        ] as $index => $definition) {
            $userId = $definition['user_id'];
            if ($userId === null) {
                continue;
            }

            $key = $userId.':'.$definition['vai_tro'];
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            $people[] = [
                'id' => $index + 1,
                'request_case_id' => (int) $case->id,
                'user_id' => $userId,
                'user_name' => $this->lookupName('internal_users', $userId, 'full_name'),
                'user_code' => $this->lookupName('internal_users', $userId, 'user_code'),
                'vai_tro' => $definition['vai_tro'],
                'trang_thai_bat_dau' => $definition['trang_thai_bat_dau'],
                'cap_quyen_luc' => $this->normalizeNullableString($case->created_at),
                'thu_hoi_luc' => null,
                'cap_boi_id' => $this->support->parseNullableInt($case->created_by),
                'cap_boi_name' => $this->lookupName('internal_users', (int) ($case->created_by ?? 0), 'full_name'),
                'is_active' => true,
            ];
        }

        $currentHandlerUserId = $this->support->parseNullableInt($case->nguoi_xu_ly_id ?? null);
        if ($currentHandlerUserId !== null) {
            $key = $currentHandlerUserId.':nguoi_xu_ly';
            if (! isset($seen[$key])) {
                $people[] = [
                    'id' => count($people) + 1,
                    'request_case_id' => (int) $case->id,
                    'user_id' => $currentHandlerUserId,
                    'user_name' => $this->lookupName('internal_users', $currentHandlerUserId, 'full_name'),
                    'user_code' => $this->lookupName('internal_users', $currentHandlerUserId, 'user_code'),
                    'vai_tro' => 'nguoi_xu_ly',
                    'trang_thai_bat_dau' => (string) ($case->current_status_code ?? 'new_intake'),
                    'cap_quyen_luc' => $this->normalizeNullableString($case->created_at),
                    'thu_hoi_luc' => null,
                    'cap_boi_id' => $this->support->parseNullableInt($case->created_by),
                    'cap_boi_name' => $this->lookupName('internal_users', (int) ($case->created_by ?? 0), 'full_name'),
                    'is_active' => true,
                ];
            }
        }

        return $people;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeCaseModel(CustomerRequestCase $case): array
    {
        $row = $this->readQuery->baseCaseQuery(null)
            ->where('crc.id', $case->id)
            ->first();

        return $row === null ? $this->serializeCaseRow($case->toArray()) : $this->serializeCaseRow($row);
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeStatusInstance(CustomerRequestStatusInstance $instance): array
    {
        $decisionContextCode = $this->normalizeNullableString($instance->decision_context_code);
        $decisionOutcomeCode = $this->normalizeNullableString($instance->decision_outcome_code);

        return [
            'id' => (int) $instance->id,
            'request_case_id' => (int) $instance->request_case_id,
            'status_code' => (string) $instance->status_code,
            'status_table' => (string) $instance->status_table,
            'status_row_id' => $this->support->parseNullableInt($instance->status_row_id),
            'previous_instance_id' => $this->support->parseNullableInt($instance->previous_instance_id),
            'next_instance_id' => $this->support->parseNullableInt($instance->next_instance_id),
            'decision_context_code' => $decisionContextCode,
            'decision_outcome_code' => $decisionOutcomeCode,
            'decision_source_status_code' => $this->normalizeNullableString($instance->decision_source_status_code),
            'decision_reason_label' => $this->resolveDecisionReasonLabel($decisionContextCode, $decisionOutcomeCode),
            'entered_at' => $this->normalizeNullableString($instance->entered_at),
            'exited_at' => $this->normalizeNullableString($instance->exited_at),
            'is_current' => (bool) $instance->is_current,
            'created_by' => $this->support->parseNullableInt($instance->created_by),
            'updated_by' => $this->support->parseNullableInt($instance->updated_by),
            'created_at' => $this->normalizeNullableString($instance->created_at),
            'updated_at' => $this->normalizeNullableString($instance->updated_at),
        ];
    }

    /**
     * @param object|array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function serializeWorklogRow(object|array $row): array
    {
        $record = is_object($row) ? (array) $row : $row;

        return [
            'id' => (int) ($record['id'] ?? 0),
            'request_case_id' => $this->support->parseNullableInt($record['request_case_id'] ?? null),
            'status_instance_id' => $this->support->parseNullableInt($record['status_instance_id'] ?? null),
            'status_code' => $this->normalizeNullableString($record['status_code'] ?? null),
            'performed_by_user_id' => $this->support->parseNullableInt($record['performed_by_user_id'] ?? null),
            'performed_by_name' => $this->normalizeNullableString($record['performed_by_name'] ?? null),
            'performed_by_code' => $this->normalizeNullableString($record['performed_by_code'] ?? null),
            'work_content' => $this->normalizeNullableString($record['work_content'] ?? null),
            'work_date' => $this->normalizeNullableString($record['work_date'] ?? null),
            'activity_type_code' => $this->normalizeNullableString($record['activity_type_code'] ?? null),
            'is_billable' => array_key_exists('is_billable', $record) ? ($record['is_billable'] === null ? null : (bool) $record['is_billable']) : null,
            'is_auto_transition' => array_key_exists('is_auto_transition', $record) ? ($record['is_auto_transition'] === null ? null : (bool) $record['is_auto_transition']) : null,
            'transition_id' => $this->support->parseNullableInt($record['transition_id'] ?? null),
            'work_started_at' => $this->normalizeNullableString($record['work_started_at'] ?? null),
            'work_ended_at' => $this->normalizeNullableString($record['work_ended_at'] ?? null),
            'hours_spent' => isset($record['hours_spent']) ? (float) $record['hours_spent'] : null,
            'created_at' => $this->normalizeNullableString($record['created_at'] ?? null),
            'updated_at' => $this->normalizeNullableString($record['updated_at'] ?? null),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function loadEstimatesForCase(int $caseId): array
    {
        if (! $this->support->hasTable('customer_request_estimates')) {
            return [];
        }

        return DB::table('customer_request_estimates as estimate')
            ->leftJoin('internal_users as estimator', 'estimator.id', '=', 'estimate.estimated_by_user_id')
            ->where('estimate.request_case_id', $caseId)
            ->orderByDesc('estimate.estimated_at')
            ->orderByDesc('estimate.id')
            ->select([
                'estimate.*',
                DB::raw('estimator.full_name as estimated_by_name'),
                DB::raw('estimator.user_code as estimated_by_code'),
            ])
            ->get()
            ->map(fn (object $row): array => $this->serializeEstimateRow($row))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function loadEstimateById(int $estimateId): ?array
    {
        if (! $this->support->hasTable('customer_request_estimates')) {
            return null;
        }

        $row = DB::table('customer_request_estimates as estimate')
            ->leftJoin('internal_users as estimator', 'estimator.id', '=', 'estimate.estimated_by_user_id')
            ->where('estimate.id', $estimateId)
            ->select([
                'estimate.*',
                DB::raw('estimator.full_name as estimated_by_name'),
                DB::raw('estimator.user_code as estimated_by_code'),
            ])
            ->first();

        return $row === null ? null : $this->serializeEstimateRow($row);
    }

    /**
     * @param object|array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function serializeEstimateRow(object|array $row): array
    {
        $record = is_object($row) ? (array) $row : $row;

        return [
            'id' => (int) ($record['id'] ?? 0),
            'request_case_id' => $this->support->parseNullableInt($record['request_case_id'] ?? null),
            'status_instance_id' => $this->support->parseNullableInt($record['status_instance_id'] ?? null),
            'status_code' => $this->normalizeNullableString($record['status_code'] ?? null),
            'estimated_hours' => $this->normalizeNullableDecimal($record['estimated_hours'] ?? null),
            'estimate_type' => $this->normalizeNullableString($record['estimate_type'] ?? null),
            'estimate_scope' => $this->normalizeNullableString($record['estimate_scope'] ?? null),
            'phase_label' => $this->normalizeNullableString($record['phase_label'] ?? null),
            'note' => $this->normalizeNullableString($record['note'] ?? null),
            'estimated_by_user_id' => $this->support->parseNullableInt($record['estimated_by_user_id'] ?? null),
            'estimated_by_name' => $this->normalizeNullableString($record['estimated_by_name'] ?? null),
            'estimated_by_code' => $this->normalizeNullableString($record['estimated_by_code'] ?? null),
            'estimated_at' => $this->normalizeNullableString($record['estimated_at'] ?? null),
            'created_at' => $this->normalizeNullableString($record['created_at'] ?? null),
            'updated_at' => $this->normalizeNullableString($record['updated_at'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function buildHoursReportPayload(mixed $case): array
    {
        $record = $case instanceof CustomerRequestCase ? $case->toArray() : (is_object($case) ? (array) $case : $case);
        $caseId = $this->support->parseNullableInt($record['id'] ?? null) ?? 0;
        $estimatedHours = $this->normalizeNullableDecimal($record['estimated_hours'] ?? null);
        $totalHoursSpent = $this->normalizeNullableDecimal($record['total_hours_spent'] ?? null) ?? 0.0;
        $hoursUsagePct = $this->calculateHoursUsagePct($estimatedHours, $totalHoursSpent);
        $warningLevel = $this->resolveWarningLevel($estimatedHours, $totalHoursSpent);

        $worklogs = DB::table('customer_request_worklogs as wl')
            ->leftJoin('internal_users as performer', 'performer.id', '=', 'wl.performed_by_user_id')
            ->where('wl.request_case_id', $caseId)
            ->select([
                'wl.*',
                DB::raw('performer.full_name as performed_by_name'),
            ])
            ->get();

        $byPerformer = $worklogs
            ->groupBy(fn (object $row): string => (string) ($row->performed_by_user_id ?? 0))
            ->map(function ($rows, string $performerId): array {
                $first = $rows->first();
                $hours = round((float) $rows->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);

                return [
                    'performed_by_user_id' => $performerId === '0' ? null : (int) $performerId,
                    'performed_by_name' => $this->normalizeNullableString($first->performed_by_name ?? null),
                    'hours_spent' => $hours,
                    'worklog_count' => $rows->count(),
                ];
            })
            ->values()
            ->all();

        $byActivity = $worklogs
            ->groupBy(fn (object $row): string => trim((string) ($row->activity_type_code ?? 'uncategorized')) ?: 'uncategorized')
            ->map(fn ($rows, string $activityCode): array => [
                'activity_type_code' => $activityCode,
                'hours_spent' => round((float) $rows->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2),
                'worklog_count' => $rows->count(),
            ])
            ->values()
            ->all();

        $billableHours = round((float) $worklogs->filter(fn (object $row): bool => (bool) ($row->is_billable ?? false))
            ->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);

        return [
            'request_case_id' => $caseId,
            'estimated_hours' => $estimatedHours,
            'total_hours_spent' => round($totalHoursSpent, 2),
            'remaining_hours' => $estimatedHours === null ? null : round($estimatedHours - $totalHoursSpent, 2),
            'hours_usage_pct' => $hoursUsagePct,
            'warning_level' => $warningLevel,
            'over_estimate' => $warningLevel === 'hard',
            'missing_estimate' => $estimatedHours === null || $estimatedHours <= 0,
            'latest_estimate' => $caseId > 0 ? ($this->loadEstimatesForCase($caseId)[0] ?? null) : null,
            'worklog_count' => $worklogs->count(),
            'billable_hours' => $billableHours,
            'non_billable_hours' => round($totalHoursSpent - $billableHours, 2),
            'by_performer' => $byPerformer,
            'by_activity' => $byActivity,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function loadAttachmentAggregateForCase(int $caseId): array
    {
        if (! $this->support->hasTable('customer_request_status_attachments') || ! $this->support->hasTable('attachments')) {
            return [
                'count' => 0,
                'items' => [],
            ];
        }

        $query = DB::table('customer_request_status_attachments as pivot')
            ->join('customer_request_status_instances as instance', 'instance.id', '=', 'pivot.status_instance_id')
            ->join('attachments as a', 'a.id', '=', 'pivot.attachment_id')
            ->where('pivot.request_case_id', $caseId)
            ->orderByDesc('pivot.id');

        if ($this->support->hasColumn('attachments', 'deleted_at')) {
            $query->whereNull('a.deleted_at');
        }

        $items = $query
            ->select(array_values(array_filter([
                'pivot.id as pivot_id',
                'pivot.status_instance_id',
                'instance.status_code',
                'a.id',
                $this->support->hasColumn('attachments', 'file_name') ? 'a.file_name' : null,
                $this->support->hasColumn('attachments', 'file_url') ? 'a.file_url' : null,
                $this->support->hasColumn('attachments', 'mime_type') ? 'a.mime_type' : null,
                $this->support->hasColumn('attachments', 'file_size') ? 'a.file_size' : null,
                $this->support->hasColumn('attachments', 'created_at') ? 'a.created_at' : null,
            ])))
            ->get()
            ->map(fn (object $row): array => [
                'pivot_id' => (int) ($row->pivot_id ?? 0),
                'status_instance_id' => $this->support->parseNullableInt($row->status_instance_id ?? null),
                'status_code' => $this->normalizeNullableString($row->status_code ?? null),
                'id' => (string) ($row->id ?? ''),
                'fileName' => $this->normalizeNullableString($row->file_name ?? null),
                'fileUrl' => $this->normalizeNullableString($row->file_url ?? null),
                'mimeType' => $this->normalizeNullableString($row->mime_type ?? null),
                'fileSize' => isset($row->file_size) ? (int) $row->file_size : null,
                'createdAt' => $this->normalizeNullableString($row->created_at ?? null),
            ])
            ->values()
            ->all();

        return [
            'count' => count($items),
            'items' => $items,
        ];
    }

    /**
     * @param array<string, mixed> $case
     * @return array<string, mixed>
     */
    public function buildSearchItem(array $case): array
    {
        return [
            'id' => (int) ($case['id'] ?? 0),
            'request_case_id' => (int) ($case['id'] ?? 0),
            'request_code' => $case['request_code'] ?? null,
            'label' => trim((string) (($case['request_code'] ?? '').' - '.($case['summary'] ?? ''))),
            'summary' => $case['summary'] ?? null,
            'customer_name' => $case['customer_name'] ?? null,
            'project_name' => $case['project_name'] ?? null,
            'dispatcher_name' => $case['dispatcher_name'] ?? null,
            'performer_name' => $case['performer_name'] ?? null,
            'nguoi_xu_ly_id' => $case['nguoi_xu_ly_id'] ?? null,
            'nguoi_xu_ly_name' => $case['nguoi_xu_ly_name'] ?? null,
            'current_owner_user_id' => $case['current_owner_user_id'] ?? null,
            'current_owner_name' => $case['current_owner_name'] ?? null,
            'current_owner_field' => $case['current_owner_field'] ?? null,
            'current_status_code' => $case['current_status_code'] ?? null,
            'current_status_name_vi' => $case['current_status_name_vi'] ?? null,
            'updated_at' => $case['updated_at'] ?? null,
        ];
    }

    /**
     * @param array<string, mixed> $record
     * @return array{0:int|null,1:string|null}
     */
    private function resolveCurrentOwner(array $record, string $statusCode, ?string $handlerField): array
    {
        $ownerUserId = null;
        $ownerName = null;

        if ($handlerField !== null) {
            $ownerUserId = $this->support->parseNullableInt($record[$handlerField] ?? null);
            $ownerName = $this->normalizeNullableString($record[$handlerField.'_name'] ?? null);
        }

        if ($ownerUserId === null || $ownerName === null) {
            $fallbackUserId = match ($statusCode) {
                'pending_dispatch' => $this->support->parseNullableInt($record['dispatcher_user_id'] ?? null),
                'assigned_to_receiver', 'receiver_in_progress' => $this->support->parseNullableInt($record['receiver_user_id'] ?? null),
                'in_progress', 'analysis', 'coding', 'dms_transfer', 'completed' => $this->support->parseNullableInt($record['performer_user_id'] ?? null),
                default => $this->support->parseNullableInt($record['received_by_user_id'] ?? null),
            };
            $fallbackName = match ($statusCode) {
                'pending_dispatch' => $this->normalizeNullableString($record['dispatcher_name'] ?? null),
                'assigned_to_receiver', 'receiver_in_progress' => $this->normalizeNullableString($record['receiver_name'] ?? null),
                'in_progress', 'analysis', 'coding', 'dms_transfer', 'completed' => $this->normalizeNullableString($record['performer_name'] ?? null),
                default => $this->normalizeNullableString($record['received_by_name'] ?? null),
            };

            $ownerUserId ??= $fallbackUserId;
            $ownerName ??= $fallbackName;
        }

        if ($ownerName === null && $ownerUserId !== null && ! $isSimpleMode) {
            $ownerName = $this->lookupName('internal_users', $ownerUserId, 'full_name');
        }

        return [$ownerUserId, $ownerName];
    }

    private function lookupName(string $table, int $id, string $column): ?string
    {
        $cacheKey = "{$table}:{$column}:{$id}";
        if (array_key_exists($cacheKey, $this->lookupCache)) {
            return $this->lookupCache[$cacheKey];
        }

        if (! $this->support->hasTable($table) || ! $this->support->hasColumn($table, $column)) {
            return $this->lookupCache[$cacheKey] = null;
        }

        $query = DB::table($table)->where('id', $id);
        if ($this->support->hasColumn($table, 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $this->lookupCache[$cacheKey] = $this->normalizeNullableString($query->value($column));
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        return $this->support->normalizeNullableString($value);
    }

    private function resolveDecisionReasonLabel(?string $contextCode, ?string $outcomeCode): ?string
    {
        if ($contextCode !== 'pm_missing_customer_info_review') {
            return null;
        }

        return match ($outcomeCode) {
            'customer_missing_info' => 'PM xác nhận yêu cầu đang thiếu thông tin từ khách hàng.',
            'other_reason' => 'PM xác nhận yêu cầu không thực hiện vì lý do khác, không phải thiếu thông tin từ khách hàng.',
            default => null,
        };
    }

    private function normalizeNullableDecimal(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        return null;
    }

    private function calculateHoursUsagePct(?float $estimatedHours, float $totalHoursSpent): ?float
    {
        if ($estimatedHours === null || $estimatedHours <= 0) {
            return null;
        }

        return round(($totalHoursSpent / $estimatedHours) * 100, 2);
    }

    private function resolveWarningLevel(?float $estimatedHours, float $totalHoursSpent): string
    {
        if ($estimatedHours === null || $estimatedHours <= 0) {
            return 'missing';
        }

        $usagePct = $this->calculateHoursUsagePct($estimatedHours, $totalHoursSpent) ?? 0.0;
        if ($usagePct >= 100) {
            return 'hard';
        }

        if ($usagePct >= 80) {
            return 'soft';
        }

        return 'normal';
    }

    private function buildSlaStatus(mixed $dueAt, string $statusCode): ?string
    {
        if (in_array($statusCode, ['completed', 'customer_notified', 'not_executed'], true)) {
            return 'closed';
        }

        $normalizedDueAt = $this->readQuery->normalizeDateTime($dueAt);
        if ($normalizedDueAt === null) {
            return null;
        }

        try {
            $due = Carbon::parse($normalizedDueAt);
        } catch (\Throwable) {
            return null;
        }

        if ($due->isPast()) {
            return 'overdue';
        }

        if ($due->lessThanOrEqualTo(now()->addDay())) {
            return 'at_risk';
        }

        return 'on_track';
    }

    /**
     * Get allowed next processes from workflow transitions
     *
     * @param int $workflowDefinitionId
     * @param string $fromStatusCode
     * @return array<int, array<string, mixed>>
     */
    private function getAllowedNextProcesses(int $workflowDefinitionId, string $fromStatusCode): array
    {
        return array_map(function (array $transition): array {
            $toStatus = $transition['to_status'] ?? null;

            return [
                'process_code' => (string) ($transition['to_status_code'] ?? ''),
                'process_name' => (string) ($toStatus['process_label'] ?? $transition['to_status_code'] ?? ''),
                'allowed_roles' => array_values($transition['allowed_roles'] ?? ['all']),
                'transition_meta' => $transition['transition_meta'] ?? [],
            ];
        }, $this->metadataService->getAllowedTransitions($fromStatusCode, $workflowDefinitionId, 'forward'));
    }
}
