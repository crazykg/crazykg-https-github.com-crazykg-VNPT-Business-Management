<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Services\V5\Workflow\CustomerRequestWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WorkflowConfigDomainService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly CustomerRequestWorkflowService $workflowService
    ) {}

    public function statusCatalogs(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('workflow_status_catalogs')) {
            return $this->support->missingTable('workflow_status_catalogs');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $rows = $this->workflowService->listWorkflowStatusCatalogs($includeInactive);

        return response()->json(['data' => $rows]);
    }

    public function storeStatusCatalog(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('workflow_status_catalogs')) {
            return $this->support->missingTable('workflow_status_catalogs');
        }

        $validated = $request->validate([
            'level' => ['required', 'integer', 'between:1,3'],
            'status_code' => ['required', 'string', 'max:80'],
            'status_name' => ['required', 'string', 'max:150'],
            'parent_id' => ['nullable', 'integer'],
            'canonical_status' => ['nullable', 'string', 'max:50'],
            'canonical_sub_status' => ['nullable', 'string', 'max:50'],
            'flow_step' => ['nullable', 'string', 'max:20'],
            'form_key' => ['nullable', 'string', 'max:120'],
            'is_leaf' => ['nullable', 'boolean'],
            'allow_pending_selection' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $row = $this->workflowService->storeWorkflowStatusCatalog(
            $validated,
            $this->accessAudit->resolveAuthenticatedUserId($request)
        );

        return response()->json(['data' => $row], 201);
    }

    public function updateStatusCatalog(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('workflow_status_catalogs')) {
            return $this->support->missingTable('workflow_status_catalogs');
        }

        $validated = $request->validate([
            'level' => ['sometimes', 'integer', 'between:1,3'],
            'status_code' => ['sometimes', 'string', 'max:80'],
            'status_name' => ['sometimes', 'string', 'max:150'],
            'parent_id' => ['sometimes', 'nullable', 'integer'],
            'canonical_status' => ['sometimes', 'nullable', 'string', 'max:50'],
            'canonical_sub_status' => ['sometimes', 'nullable', 'string', 'max:50'],
            'flow_step' => ['sometimes', 'nullable', 'string', 'max:20'],
            'form_key' => ['sometimes', 'nullable', 'string', 'max:120'],
            'is_leaf' => ['sometimes', 'boolean'],
            'allow_pending_selection' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = $this->workflowService->updateWorkflowStatusCatalog(
            $id,
            $validated,
            $this->accessAudit->resolveAuthenticatedUserId($request)
        );

        return response()->json(['data' => $row]);
    }

    public function statusTransitions(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('workflow_status_transitions')) {
            return $this->support->missingTable('workflow_status_transitions');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $fromStatusCatalogId = $this->support->parseNullableInt($request->query('from_status_catalog_id'));
        $rows = $this->workflowService->listWorkflowStatusTransitions($fromStatusCatalogId, $includeInactive);

        return response()->json(['data' => $rows]);
    }

    public function storeStatusTransition(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('workflow_status_transitions')) {
            return $this->support->missingTable('workflow_status_transitions');
        }

        $validated = $request->validate([
            'from_status_catalog_id' => ['required', 'integer'],
            'to_status_catalog_id' => ['required', 'integer'],
            'action_code' => ['required', 'string', 'max:80'],
            'action_name' => ['required', 'string', 'max:150'],
            'required_role' => ['nullable', 'string', 'max:50'],
            'condition_json' => ['nullable', 'array'],
            'notify_targets_json' => ['nullable', 'array'],
            'notify_targets_json.*' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $row = $this->workflowService->storeWorkflowStatusTransition(
            $validated,
            $this->accessAudit->resolveAuthenticatedUserId($request)
        );

        return response()->json(['data' => $row], 201);
    }

    public function updateStatusTransition(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('workflow_status_transitions')) {
            return $this->support->missingTable('workflow_status_transitions');
        }

        $validated = $request->validate([
            'from_status_catalog_id' => ['sometimes', 'integer'],
            'to_status_catalog_id' => ['sometimes', 'integer'],
            'action_code' => ['sometimes', 'string', 'max:80'],
            'action_name' => ['sometimes', 'string', 'max:150'],
            'required_role' => ['sometimes', 'nullable', 'string', 'max:50'],
            'condition_json' => ['sometimes', 'nullable', 'array'],
            'notify_targets_json' => ['sometimes', 'nullable', 'array'],
            'notify_targets_json.*' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = $this->workflowService->updateWorkflowStatusTransition(
            $id,
            $validated,
            $this->accessAudit->resolveAuthenticatedUserId($request)
        );

        return response()->json(['data' => $row]);
    }

    public function formFieldConfigs(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('workflow_form_field_configs')) {
            return $this->support->missingTable('workflow_form_field_configs');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $statusCatalogId = $this->support->parseNullableInt($request->query('status_catalog_id'));
        $rows = $this->workflowService->listWorkflowFormFieldConfigs($statusCatalogId, $includeInactive);

        return response()->json(['data' => $rows]);
    }

    public function storeFormFieldConfig(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('workflow_form_field_configs')) {
            return $this->support->missingTable('workflow_form_field_configs');
        }

        $validated = $request->validate([
            'status_catalog_id' => ['required', 'integer'],
            'field_key' => ['required', 'string', 'max:120'],
            'field_label' => ['required', 'string', 'max:190'],
            'field_type' => ['nullable', 'string', 'max:50'],
            'required' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'excel_column' => ['nullable', 'string', 'max:5'],
            'options_json' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $guardMessage = $this->validateWorkflowStaticFieldCanonicalKey(
            (string) ($validated['field_label'] ?? ''),
            (string) ($validated['field_key'] ?? '')
        );
        if ($guardMessage !== null) {
            return response()->json(['message' => $guardMessage], 422);
        }

        $row = $this->workflowService->storeWorkflowFormFieldConfig(
            $validated,
            $this->accessAudit->resolveAuthenticatedUserId($request)
        );

        return response()->json(['data' => $row], 201);
    }

    public function updateFormFieldConfig(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('workflow_form_field_configs')) {
            return $this->support->missingTable('workflow_form_field_configs');
        }

        $validated = $request->validate([
            'status_catalog_id' => ['sometimes', 'integer'],
            'field_key' => ['sometimes', 'string', 'max:120'],
            'field_label' => ['sometimes', 'string', 'max:190'],
            'field_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'required' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'excel_column' => ['sometimes', 'nullable', 'string', 'max:5'],
            'options_json' => ['sometimes', 'nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $current = DB::table('workflow_form_field_configs')
            ->where('id', $id)
            ->first();
        if ($current === null) {
            return response()->json(['message' => 'Không tìm thấy field config workflow.'], 404);
        }

        $effectiveFieldLabel = array_key_exists('field_label', $validated)
            ? (string) ($validated['field_label'] ?? '')
            : (string) ($current->field_label ?? '');
        $effectiveFieldKey = array_key_exists('field_key', $validated)
            ? (string) ($validated['field_key'] ?? '')
            : (string) ($current->field_key ?? '');

        $guardMessage = $this->validateWorkflowStaticFieldCanonicalKey(
            $effectiveFieldLabel,
            $effectiveFieldKey
        );
        if ($guardMessage !== null) {
            return response()->json(['message' => $guardMessage], 422);
        }

        $row = $this->workflowService->updateWorkflowFormFieldConfig(
            $id,
            $validated,
            $this->accessAudit->resolveAuthenticatedUserId($request)
        );

        return response()->json(['data' => $row]);
    }

    private function normalizeWorkflowFieldToken(mixed $value): string
    {
        $normalized = Str::ascii(trim((string) ($value ?? '')));
        if ($normalized === '') {
            return '';
        }

        return strtolower((string) preg_replace('/[^a-z0-9]+/', '', $normalized));
    }

    private function resolveWorkflowStaticCanonicalFieldKeyByLabel(string $fieldLabel): ?string
    {
        $token = $this->normalizeWorkflowFieldToken($fieldLabel);
        if ($token === '') {
            return null;
        }

        $map = [
            'idyeucau' => 'request_code',
            'mayeucau' => 'request_code',
            'mayc' => 'request_code',
            'noidung' => 'summary',
            'noidungyeucau' => 'summary',
            'donvi' => 'customer_id',
            'nguoiyeucau' => 'reporter_contact_id',
            'nhomhotro' => 'service_group_id',
            'nguoitiepnhan' => 'receiver_user_id',
            'nguoixuly' => 'assignee_id',
            'ngaytiepnhan' => 'requested_date',
        ];

        return $map[$token] ?? null;
    }

    private function validateWorkflowStaticFieldCanonicalKey(string $fieldLabel, string $fieldKey): ?string
    {
        $canonicalKey = $this->resolveWorkflowStaticCanonicalFieldKeyByLabel($fieldLabel);
        if ($canonicalKey === null) {
            return null;
        }

        $providedKeyToken = $this->normalizeWorkflowFieldToken($fieldKey);
        $canonicalKeyToken = $this->normalizeWorkflowFieldToken($canonicalKey);
        if ($providedKeyToken === $canonicalKeyToken) {
            return null;
        }

        return sprintf(
            'field_label "%s" phải dùng field_key chuẩn là "%s".',
            trim($fieldLabel),
            $canonicalKey
        );
    }
}
