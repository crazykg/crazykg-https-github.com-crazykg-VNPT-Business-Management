<?php

namespace App\Services\V5\CustomerRequest;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerRequestCaseIntakeIoService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly CustomerRequestCaseMetadataService $metadataService,
        private readonly CustomerRequestCaseReadQueryService $readQueryService,
        private readonly CustomerRequestCaseWriteService $writeService,
    ) {}

    public function importIntakeTemplate(Request $request): JsonResponse
    {
        if (($missing = $this->readQueryService->missingTablesResponse()) !== null) {
            return $missing;
        }

        $workflowDefinitionId = $this->metadataService->resolveWorkflowDefinitionId(
            $this->support->parseNullableInt($request->query('workflow_definition_id'))
        );

        if (! $this->metadataService->hasStatusMeta('new_intake', $workflowDefinitionId)) {
            return response()->json([
                'message' => 'Workflow hiện tại chưa có trạng thái new_intake.',
                'error_code' => 'POLICY_VIOLATION',
            ], 422);
        }

        return response()->json([
            'data' => [
                'sheet' => 'YeuCauNhap',
                'task_sheet' => 'YeuCauTasks',
                'lookup_sheets' => ['KhachHang', 'HangMucDuAnSanPham', 'NhanSuLienHe', 'KenhTiepNhan', 'NhanSuNoiBo', 'NhomHoTro'],
                'required_headers' => ['summary', 'project_item_code_or_customer_code'],
                'headers' => [
                    'import_row_code',
                    'customer_code',
                    'project_item_code',
                    'customer_personnel_code',
                    'support_service_group_code',
                    'source_channel',
                    'summary',
                    'description',
                    'priority_label',
                    'receiver_user_code',
                    'creator_user_code',
                ],
                'task_headers' => ['import_row_code', 'task_source', 'task_code', 'task_link', 'task_status'],
                'priority_labels' => ['Thấp', 'Trung bình', 'Cao', 'Khẩn'],
                'task_sources' => ['IT360', 'REFERENCE'],
                'task_statuses' => ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'BLOCKED'],
                'status_policy' => 'new_intake',
            ],
        ]);
    }

    public function exportIntake(Request $request): StreamedResponse
    {
        if (($missing = $this->readQueryService->missingTablesResponse()) !== null) {
            return response()->streamDownload(
                static function () use ($missing): void {
                    echo json_encode($missing->getData(true), JSON_UNESCAPED_UNICODE);
                },
                'customer_request_cases_export_error.json',
                ['Content-Type' => 'application/json; charset=UTF-8']
            );
        }

        $query = DB::table('customer_request_cases as crc')
            ->leftJoin('customers as c', 'c.id', '=', 'crc.customer_id')
            ->leftJoin('projects as p', 'p.id', '=', 'crc.project_id')
            ->leftJoin('project_items as pi', 'pi.id', '=', 'crc.project_item_id')
            ->leftJoin('customer_personnel as cp', 'cp.id', '=', 'crc.customer_personnel_id')
            ->leftJoin('support_service_groups as sg', 'sg.id', '=', 'crc.support_service_group_id')
            ->leftJoin('internal_users as receiver', 'receiver.id', '=', 'crc.received_by_user_id')
            ->leftJoin('internal_users as creator', 'creator.id', '=', 'crc.created_by')
            ->select([
                'crc.id',
                'crc.request_code',
                'crc.summary',
                'crc.description',
                'crc.priority',
                'crc.current_status_code',
                'c.customer_code',
                DB::raw('COALESCE(pi.id, crc.project_item_id) as project_item_code'),
                DB::raw('COALESCE(cp.id, crc.customer_personnel_id) as customer_personnel_code'),
                'sg.group_code as support_service_group_code',
                'crc.source_channel',
                'receiver.user_code as receiver_user_code',
                'creator.user_code as creator_user_code',
                'crc.created_at',
            ])
            ->whereNull('crc.deleted_at')
            ->orderByDesc('crc.updated_at')
            ->orderByDesc('crc.id');

        $q = $this->support->normalizeNullableString($request->query('q'));
        if ($q !== null) {
            $like = '%'.$q.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->where('crc.request_code', 'like', $like)
                    ->orWhere('crc.summary', 'like', $like)
                    ->orWhere('c.customer_code', 'like', $like);
            });
        }

        $statusCode = $this->support->normalizeNullableString($request->query('status_code'));
        if ($statusCode !== null) {
            $query->where('crc.current_status_code', $statusCode);
        }

        $rows = $query->limit(5000)->get();

        $fileName = 'customer_request_intake_'.now()->format('Ymd_His').'.csv';

        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'w');
            if ($output === false) {
                return;
            }

            fwrite($output, "\xEF\xBB\xBF");

            fputcsv($output, [
                'id',
                'request_code',
                'summary',
                'description',
                'priority',
                'current_status_code',
                'customer_code',
                'project_item_code',
                'customer_personnel_code',
                'support_service_group_code',
                'source_channel',
                'receiver_user_code',
                'creator_user_code',
                'created_at',
            ]);

            foreach ($rows as $row) {
                fputcsv($output, [
                    $row->id,
                    $row->request_code,
                    $row->summary,
                    $row->description,
                    $row->priority,
                    $row->current_status_code,
                    $row->customer_code,
                    $row->project_item_code,
                    $row->customer_personnel_code,
                    $row->support_service_group_code,
                    $row->source_channel,
                    $row->receiver_user_code,
                    $row->creator_user_code,
                    $row->created_at,
                ]);
            }

            fclose($output);
        }, $fileName, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function importIntake(Request $request): JsonResponse
    {
        if (($missing = $this->readQueryService->missingTablesResponse()) !== null) {
            return $missing;
        }

        $items = $request->input('items');
        if (! is_array($items)) {
            return response()->json([
                'message' => 'items là bắt buộc và phải là mảng.',
                'error_code' => 'INVALID_TEMPLATE',
            ], 422);
        }

        if (count($items) === 0) {
            return response()->json([
                'message' => 'items không được rỗng.',
                'error_code' => 'INVALID_TEMPLATE',
            ], 422);
        }

        $workflowDefinitionId = $this->metadataService->resolveWorkflowDefinitionId(
            $this->support->parseNullableInt($request->input('workflow_definition_id'))
        );

        if (! $this->metadataService->hasStatusMeta('new_intake', $workflowDefinitionId)) {
            return response()->json([
                'message' => 'Workflow hiện tại chưa có trạng thái new_intake.',
                'error_code' => 'POLICY_VIOLATION',
            ], 422);
        }

        $results = [];
        $errors = [];
        $warnings = [];
        $createdCaseIds = [];
        $successRows = 0;
        $failedRows = 0;

        foreach ($items as $idx => $item) {
            $rowNumber = $idx + 2;
            $rowCode = $this->support->normalizeNullableString(is_array($item) ? ($item['import_row_code'] ?? null) : null);

            if (! is_array($item)) {
                $failedRows++;
                $results[] = [
                    'index' => $idx,
                    'row_number' => $rowNumber,
                    'import_row_code' => $rowCode,
                    'success' => false,
                    'message' => 'Dòng dữ liệu không hợp lệ.',
                ];
                $errors[] = [
                    'row_number' => $rowNumber,
                    'import_row_code' => $rowCode,
                    'field' => 'items',
                    'error_code' => 'INVALID_TEMPLATE',
                    'error_message' => 'Dữ liệu dòng phải là object.',
                ];
                continue;
            }

            $summary = $this->support->normalizeNullableString($item['summary'] ?? null);
            $projectItemCode = $this->support->normalizeNullableString($item['project_item_code'] ?? null);
            $customerCode = $this->support->normalizeNullableString($item['customer_code'] ?? null);
            $customerPersonnelCode = $this->support->normalizeNullableString($item['customer_personnel_code'] ?? null);
            $supportServiceGroupCode = $this->support->normalizeNullableString($item['support_service_group_code'] ?? null);
            $creatorUserCode = $this->support->normalizeNullableString($item['creator_user_code'] ?? null);
            $receiverUserCode = $this->support->normalizeNullableString($item['receiver_user_code'] ?? null);
            $priorityLabel = $this->support->normalizeNullableString($item['priority_label'] ?? null);

            $projectItemId = $this->resolveProjectItemIdByCode($projectItemCode);
            $customerId = $this->resolveCustomerIdByCode($customerCode);
            $customerPersonnelId = $this->resolveCustomerPersonnelIdByCode($customerPersonnelCode);
            $supportServiceGroupId = $this->resolveSupportGroupIdByCode($supportServiceGroupCode);
            $creatorUserId = $this->resolveUserIdByCode($creatorUserCode);
            $receiverUserId = $this->resolveUserIdByCode($receiverUserCode);
            $priorityValue = $this->mapPriorityLabelToNumber($priorityLabel);

            $rowValidationErrors = [];

            if ($summary === null) {
                $rowValidationErrors[] = [
                    'field' => 'summary',
                    'error_code' => 'MISSING_REQUIRED_FIELD',
                    'error_message' => 'summary là bắt buộc.',
                ];
            }

            if ($projectItemCode === null && $customerCode === null) {
                $rowValidationErrors[] = [
                    'field' => 'project_item_code',
                    'error_code' => 'MISSING_REQUIRED_FIELD',
                    'error_message' => 'Cần project_item_code hoặc customer_code.',
                ];
            }

            if ($projectItemCode !== null && $projectItemId === null) {
                $rowValidationErrors[] = [
                    'field' => 'project_item_code',
                    'error_code' => 'REFERENCE_NOT_FOUND',
                    'error_message' => 'Không tìm thấy project_item_code trong hệ thống.',
                ];
            }

            if ($customerCode !== null && $customerId === null) {
                $rowValidationErrors[] = [
                    'field' => 'customer_code',
                    'error_code' => 'REFERENCE_NOT_FOUND',
                    'error_message' => 'Không tìm thấy customer_code trong hệ thống.',
                ];
            }

            if ($customerPersonnelCode !== null && $customerPersonnelId === null) {
                $rowValidationErrors[] = [
                    'field' => 'customer_personnel_code',
                    'error_code' => 'REFERENCE_NOT_FOUND',
                    'error_message' => 'Không tìm thấy customer_personnel_code trong hệ thống.',
                ];
            }

            if ($supportServiceGroupCode !== null && $supportServiceGroupId === null) {
                $rowValidationErrors[] = [
                    'field' => 'support_service_group_code',
                    'error_code' => 'REFERENCE_NOT_FOUND',
                    'error_message' => 'Không tìm thấy support_service_group_code trong hệ thống.',
                ];
            }

            if ($creatorUserCode !== null && $creatorUserId === null) {
                $rowValidationErrors[] = [
                    'field' => 'creator_user_code',
                    'error_code' => 'REFERENCE_NOT_FOUND',
                    'error_message' => 'Không tìm thấy creator_user_code trong hệ thống.',
                ];
            }

            if ($receiverUserCode !== null && $receiverUserId === null) {
                $rowValidationErrors[] = [
                    'field' => 'receiver_user_code',
                    'error_code' => 'REFERENCE_NOT_FOUND',
                    'error_message' => 'Không tìm thấy receiver_user_code trong hệ thống.',
                ];
            }

            if ($priorityLabel !== null && $priorityValue === null) {
                $rowValidationErrors[] = [
                    'field' => 'priority_label',
                    'error_code' => 'INVALID_ENUM_VALUE',
                    'error_message' => 'priority_label không hợp lệ.',
                ];
            }

            if ($rowValidationErrors !== []) {
                $failedRows++;
                $results[] = [
                    'index' => $idx,
                    'row_number' => $rowNumber,
                    'import_row_code' => $rowCode,
                    'success' => false,
                    'message' => 'Dữ liệu không hợp lệ.',
                ];

                foreach ($rowValidationErrors as $validationError) {
                    $errors[] = [
                        'row_number' => $rowNumber,
                        'import_row_code' => $rowCode,
                        'field' => $validationError['field'],
                        'error_code' => $validationError['error_code'],
                        'error_message' => $validationError['error_message'],
                    ];
                }
                continue;
            }

            $masterPayload = [
                'summary' => $summary,
                'description' => $this->support->normalizeNullableString($item['description'] ?? null),
                'source_channel' => $this->support->normalizeNullableString($item['source_channel'] ?? null),
                'priority' => $priorityValue,
                'project_item_id' => $projectItemId,
                'customer_id' => $customerId,
                'customer_personnel_id' => $customerPersonnelId,
                'support_service_group_id' => $supportServiceGroupId,
                'workflow_definition_id' => $workflowDefinitionId,
            ];

            if ($creatorUserId !== null) {
                $masterPayload['created_by'] = $creatorUserId;
            }
            if ($receiverUserId !== null) {
                $masterPayload['received_by_user_id'] = $receiverUserId;
            }

            $statusPayload = [
                'summary' => $summary,
                'description' => $this->support->normalizeNullableString($item['description'] ?? null),
                'to_user_id' => $receiverUserId,
                'ref_tasks' => $this->normalizeRefTasks($item['ref_tasks'] ?? []),
            ];

            if (array_key_exists('status', $item) || array_key_exists('current_status_code', $item)) {
                $warnings[] = [
                    'row_number' => $rowNumber,
                    'import_row_code' => $rowCode,
                    'field' => 'status',
                    'message' => 'Bỏ qua cột status vì import-intake luôn tạo new_intake.',
                ];
            }

            try {
                $requestForStore = Request::create('/api/v5/customer-request-cases/import-intake', 'POST', [
                    'master_payload' => $masterPayload,
                    'status_payload' => $statusPayload,
                ]);
                $requestForStore->setUserResolver($request->getUserResolver());

                $storeResponse = $this->writeService->store(
                    $requestForStore,
                    static fn (...$args): array => []
                );

                $statusCode = $storeResponse->getStatusCode();
                $body = $storeResponse->getData(true);

                if ($statusCode >= 200 && $statusCode < 300) {
                    $successRows++;
                    $caseId = $this->support->parseNullableInt($body['data']['id'] ?? ($body['data']['request_case']['id'] ?? null));
                    if ($caseId !== null) {
                        $createdCaseIds[] = $caseId;
                        $this->persistImportedMasterRelations(
                            $caseId,
                            $projectItemId,
                            $customerId,
                            $customerPersonnelId,
                            $supportServiceGroupId
                        );
                    }

                    $results[] = [
                        'index' => $idx,
                        'row_number' => $rowNumber,
                        'import_row_code' => $rowCode,
                        'success' => true,
                        'action' => 'created',
                        'case_id' => $caseId,
                    ];
                    continue;
                }

                $failedRows++;
                $message = (string) ($body['message'] ?? 'Import thất bại.');
                $results[] = [
                    'index' => $idx,
                    'row_number' => $rowNumber,
                    'import_row_code' => $rowCode,
                    'success' => false,
                    'message' => $message,
                ];

                $rowErrors = $body['errors'] ?? [];
                if (is_array($rowErrors) && $rowErrors !== []) {
                    foreach ($rowErrors as $field => $messages) {
                        if (is_array($messages)) {
                            foreach ($messages as $msg) {
                                $errors[] = [
                                    'row_number' => $rowNumber,
                                    'import_row_code' => $rowCode,
                                    'field' => (string) $field,
                                    'error_code' => 'VALIDATION_FAILED',
                                    'error_message' => (string) $msg,
                                ];
                            }
                        } else {
                            $errors[] = [
                                'row_number' => $rowNumber,
                                'import_row_code' => $rowCode,
                                'field' => (string) $field,
                                'error_code' => 'VALIDATION_FAILED',
                                'error_message' => (string) $messages,
                            ];
                        }
                    }
                } else {
                    $errors[] = [
                        'row_number' => $rowNumber,
                        'import_row_code' => $rowCode,
                        'field' => 'row',
                        'error_code' => 'SYSTEM_ERROR',
                        'error_message' => $message,
                    ];
                }
            } catch (\Throwable $e) {
                $failedRows++;
                $results[] = [
                    'index' => $idx,
                    'row_number' => $rowNumber,
                    'import_row_code' => $rowCode,
                    'success' => false,
                    'message' => 'Lỗi hệ thống khi import dòng.',
                ];
                $errors[] = [
                    'row_number' => $rowNumber,
                    'import_row_code' => $rowCode,
                    'field' => 'row',
                    'error_code' => 'SYSTEM_ERROR',
                    'error_message' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'success' => $failedRows === 0,
            'data' => [
                'total_rows' => count($items),
                'success_rows' => $successRows,
                'failed_rows' => $failedRows,
                'created_case_ids' => $createdCaseIds,
                'results' => $results,
                'errors' => $errors,
                'warnings' => $warnings,
                'error_file_token' => null,
            ],
        ], $failedRows > 0 ? 200 : 201);
    }

    private function mapPriorityLabelToNumber(mixed $value): ?int
    {
        $label = $this->support->normalizeNullableString($value);
        if ($label === null) {
            return 2;
        }

        return match (mb_strtolower($label)) {
            'thấp', 'thap', 'low' => 1,
            'trung bình', 'trung binh', 'medium' => 2,
            'cao', 'high' => 3,
            'khẩn', 'khan', 'urgent' => 4,
            default => null,
        };
    }

    private function resolveCustomerIdByCode(?string $customerCode): ?int
    {
        if ($customerCode === null || ! $this->support->hasTable('customers')) {
            return null;
        }

        if (! $this->support->hasColumn('customers', 'customer_code')) {
            return null;
        }

        $id = DB::table('customers')
            ->where('customer_code', $customerCode)
            ->value('id');

        return $this->support->parseNullableInt($id);
    }

    private function resolveProjectItemIdByCode(?string $projectItemCode): ?int
    {
        if ($projectItemCode === null || ! $this->support->hasTable('project_items')) {
            return null;
        }

        $candidateColumns = ['project_item_code', 'item_code', 'external_code', 'code'];
        foreach ($candidateColumns as $column) {
            if (! $this->support->hasColumn('project_items', $column)) {
                continue;
            }
            $id = DB::table('project_items')
                ->where($column, $projectItemCode)
                ->value('id');
            $resolved = $this->support->parseNullableInt($id);
            if ($resolved !== null) {
                return $resolved;
            }
        }

        if (ctype_digit($projectItemCode)) {
            $id = DB::table('project_items')->where('id', (int) $projectItemCode)->value('id');
            return $this->support->parseNullableInt($id);
        }

        return null;
    }

    private function resolveCustomerPersonnelIdByCode(?string $personnelCode): ?int
    {
        if ($personnelCode === null || ! $this->support->hasTable('customer_personnel')) {
            return null;
        }

        $candidateColumns = ['personnel_code', 'customer_personnel_code', 'contact_code', 'code'];
        foreach ($candidateColumns as $column) {
            if (! $this->support->hasColumn('customer_personnel', $column)) {
                continue;
            }
            $id = DB::table('customer_personnel')
                ->where($column, $personnelCode)
                ->value('id');
            $resolved = $this->support->parseNullableInt($id);
            if ($resolved !== null) {
                return $resolved;
            }
        }

        if (ctype_digit($personnelCode)) {
            $id = DB::table('customer_personnel')->where('id', (int) $personnelCode)->value('id');
            return $this->support->parseNullableInt($id);
        }

        return null;
    }

    private function resolveSupportGroupIdByCode(?string $groupCode): ?int
    {
        if ($groupCode === null || ! $this->support->hasTable('support_service_groups')) {
            return null;
        }

        if ($this->support->hasColumn('support_service_groups', 'group_code')) {
            $id = DB::table('support_service_groups')
                ->where('group_code', $groupCode)
                ->value('id');
            $resolved = $this->support->parseNullableInt($id);
            if ($resolved !== null) {
                return $resolved;
            }
        }

        if ($this->support->hasColumn('support_service_groups', 'group_name')) {
            $id = DB::table('support_service_groups')
                ->where('group_name', $groupCode)
                ->value('id');
            $resolved = $this->support->parseNullableInt($id);
            if ($resolved !== null) {
                return $resolved;
            }
        }

        if (ctype_digit($groupCode)) {
            $id = DB::table('support_service_groups')->where('id', (int) $groupCode)->value('id');
            return $this->support->parseNullableInt($id);
        }

        return null;
    }

    private function resolveUserIdByCode(?string $userCode): ?int
    {
        if ($userCode === null || ! $this->support->hasTable('internal_users')) {
            return null;
        }

        if ($this->support->hasColumn('internal_users', 'user_code')) {
            $id = DB::table('internal_users')
                ->where('user_code', $userCode)
                ->value('id');
            $resolved = $this->support->parseNullableInt($id);
            if ($resolved !== null) {
                return $resolved;
            }
        }

        if ($this->support->hasColumn('internal_users', 'username')) {
            $id = DB::table('internal_users')
                ->where('username', $userCode)
                ->value('id');
            $resolved = $this->support->parseNullableInt($id);
            if ($resolved !== null) {
                return $resolved;
            }
        }

        if (ctype_digit($userCode)) {
            $id = DB::table('internal_users')->where('id', (int) $userCode)->value('id');
            return $this->support->parseNullableInt($id);
        }

        return null;
    }

    private function persistImportedMasterRelations(
        int $caseId,
        ?int $projectItemId,
        ?int $customerId,
        ?int $customerPersonnelId,
        ?int $supportServiceGroupId
    ): void {
        if (! $this->support->hasTable('customer_request_cases')) {
            return;
        }

        $payload = [];
        if ($projectItemId !== null && $this->support->hasColumn('customer_request_cases', 'project_item_id')) {
            $payload['project_item_id'] = $projectItemId;
        }
        if ($customerId !== null && $this->support->hasColumn('customer_request_cases', 'customer_id')) {
            $payload['customer_id'] = $customerId;
        }
        if ($customerPersonnelId !== null && $this->support->hasColumn('customer_request_cases', 'customer_personnel_id')) {
            $payload['customer_personnel_id'] = $customerPersonnelId;
        }
        if ($supportServiceGroupId !== null && $this->support->hasColumn('customer_request_cases', 'support_service_group_id')) {
            $payload['support_service_group_id'] = $supportServiceGroupId;
        }

        if ($payload === []) {
            return;
        }

        DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->when($this->support->hasColumn('customer_request_cases', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->update($payload);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function normalizeRefTasks(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter(array_map(function ($item): ?array {
            if (! is_array($item)) {
                return null;
            }

            return [
                'task_source' => strtoupper($this->support->normalizeNullableString($item['task_source'] ?? 'REFERENCE') ?? 'REFERENCE'),
                'task_code' => $this->support->normalizeNullableString($item['task_code'] ?? null),
                'task_link' => $this->support->normalizeNullableString($item['task_link'] ?? null),
                'task_status' => strtoupper($this->support->normalizeNullableString($item['task_status'] ?? 'TODO') ?? 'TODO'),
            ];
        }, $value)));
    }
}
