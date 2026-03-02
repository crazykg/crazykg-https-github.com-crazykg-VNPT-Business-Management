<?php

namespace App\Http\Requests;

use App\Models\ProgrammingRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StoreProgrammingRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // req_code is generated server-side in ProgrammingRequestController::store().
            // Keep this field permissive to avoid false duplicate validation from client prefill.
            'req_code' => ['nullable', 'string', 'max:50'],
            'req_name' => ['required', 'string', 'max:255'],
            'ticket_code' => ['nullable', 'string', 'max:50'],
            'task_link' => ['nullable', 'string'],
            'parent_id' => ['nullable', 'integer', Rule::exists('programming_requests', 'id')],
            'depth' => ['required', 'integer', 'between:0,2'],
            'reference_request_id' => ['nullable', 'integer', Rule::exists('programming_requests', 'id')],
            'source_type' => ['required', Rule::in(['DIRECT', 'FROM_SUPPORT'])],
            'req_type' => ['required', Rule::in(['FEATURE', 'BUG', 'OPTIMIZE', 'REPORT', 'OTHER'])],
            'service_group_id' => ['nullable', 'integer', Rule::exists('support_service_groups', 'id')],
            'support_request_id' => [
                'nullable',
                'integer',
                Rule::exists('support_requests', 'id'),
                Rule::requiredIf(fn () => strtoupper((string) $this->input('source_type')) === 'FROM_SUPPORT'),
                Rule::prohibitedIf(fn () => strtoupper((string) $this->input('source_type')) === 'DIRECT'),
            ],
            'priority' => ['nullable', 'integer', 'between:1,4'],
            'overall_progress' => ['nullable', 'integer', 'between:0,100'],
            'status' => ['required', Rule::in(['NEW', 'ANALYZING', 'CODING', 'PENDING_UPCODE', 'UPCODED', 'NOTIFIED', 'CLOSED', 'CANCELLED'])],
            'description' => ['nullable', 'string'],
            'doc_link' => ['nullable', 'string'],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')],
            'requested_date' => ['required', 'date'],
            'reporter_name' => ['nullable', 'string', 'max:100'],
            'reporter_contact_id' => ['nullable', 'integer', Rule::exists('customer_personnel', 'id')],
            'receiver_id' => ['nullable', 'integer', Rule::exists('internal_users', 'id')],
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')],
            'product_id' => ['nullable', 'integer', Rule::exists('products', 'id')],
            'project_item_id' => ['required', 'integer', Rule::exists('project_items', 'id')],
            'analyze_estimated_hours' => ['nullable', 'numeric', 'min:0.01'],
            'analyze_start_date' => ['nullable', 'date'],
            'analyze_end_date' => ['nullable', 'date', 'after_or_equal:analyze_start_date'],
            'analyze_extend_date' => ['nullable', 'date', 'after_or_equal:analyze_end_date'],
            'analyzer_id' => ['nullable', 'integer', Rule::exists('internal_users', 'id')],
            'analyze_progress' => ['nullable', 'integer', 'between:0,100'],
            'code_estimated_hours' => ['nullable', 'numeric', 'min:0.01'],
            'code_start_date' => ['nullable', 'date', 'after_or_equal:analyze_end_date'],
            'code_end_date' => ['nullable', 'date', 'after_or_equal:code_start_date'],
            'code_extend_date' => ['nullable', 'date', 'after_or_equal:code_end_date'],
            'code_actual_date' => ['nullable', 'date', 'after_or_equal:code_start_date'],
            'coder_id' => ['nullable', 'integer', Rule::exists('internal_users', 'id')],
            'code_progress' => ['nullable', 'integer', 'between:0,100'],
            'upcode_status' => ['nullable', Rule::in(['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'])],
            'upcode_date' => ['nullable', 'date', 'after_or_equal:code_actual_date'],
            'upcoder_id' => ['nullable', 'integer', Rule::exists('internal_users', 'id')],
            'noti_status' => ['nullable', Rule::in(['PENDING', 'NOTIFIED', 'FAILED'])],
            'noti_date' => ['nullable', 'date', 'after_or_equal:upcode_date'],
            'notifier_id' => ['nullable', 'integer', Rule::exists('internal_users', 'id')],
            'notified_internal_id' => [
                'nullable',
                'integer',
                Rule::exists('internal_users', 'id'),
                Rule::prohibitedIf(fn () => $this->filled('notified_customer_id')),
            ],
            'notified_customer_id' => [
                'nullable',
                'integer',
                Rule::exists('customer_personnel', 'id'),
                Rule::prohibitedIf(fn () => $this->filled('notified_internal_id')),
            ],
            'noti_doc_link' => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $this->validateBusinessRules($validator, null);
        });
    }

    protected function validateBusinessRules(Validator $validator, ?ProgrammingRequest $existing): void
    {
        $this->validateHierarchy($validator, $existing);
        $this->validateProjectItemConsistency($validator, $existing);
        $this->validateStatusTransition($validator, $existing);

        $analyzeEndDate = $this->mergedValue('analyze_end_date', $existing);
        $analyzeExtendDate = $this->mergedValue('analyze_extend_date', $existing);
        $codeEndDate = $this->mergedValue('code_end_date', $existing);
        $codeExtendDate = $this->mergedValue('code_extend_date', $existing);

        if (! empty($analyzeExtendDate) && empty($analyzeEndDate)) {
            $validator->errors()->add('analyze_extend_date', 'analyze_extend_date chỉ hợp lệ khi analyze_end_date đã có.');
        }

        if (! empty($codeExtendDate) && empty($codeEndDate)) {
            $validator->errors()->add('code_extend_date', 'code_extend_date chỉ hợp lệ khi code_end_date đã có.');
        }

        $sourceType = strtoupper((string) $this->mergedValue('source_type', $existing));
        $supportRequestId = $this->parseNullableInt($this->mergedValue('support_request_id', $existing));
        if ($sourceType === 'FROM_SUPPORT' && $supportRequestId === null) {
            $validator->errors()->add('support_request_id', 'support_request_id bắt buộc khi source_type là FROM_SUPPORT.');
        }
        if ($sourceType === 'DIRECT' && $supportRequestId !== null) {
            $validator->errors()->add('support_request_id', 'support_request_id phải NULL khi source_type là DIRECT.');
        }

        $notifiedInternalId = $this->parseNullableInt($this->mergedValue('notified_internal_id', $existing));
        $notifiedCustomerId = $this->parseNullableInt($this->mergedValue('notified_customer_id', $existing));
        if ($notifiedInternalId !== null && $notifiedCustomerId !== null) {
            $validator->errors()->add('notified_internal_id', 'Chỉ được chọn notified_internal_id hoặc notified_customer_id.');
            $validator->errors()->add('notified_customer_id', 'Chỉ được chọn notified_internal_id hoặc notified_customer_id.');
        }

        $this->ensureDateOrder($validator, 'analyze_start_date', 'analyze_end_date', $existing);
        $this->ensureDateOrder($validator, 'analyze_end_date', 'analyze_extend_date', $existing);
        $this->ensureDateOrder($validator, 'analyze_end_date', 'code_start_date', $existing);
        $this->ensureDateOrder($validator, 'code_start_date', 'code_end_date', $existing);
        $this->ensureDateOrder($validator, 'code_end_date', 'code_extend_date', $existing);
        $this->ensureDateOrder($validator, 'code_start_date', 'code_actual_date', $existing);
        $this->ensureDateOrder($validator, 'code_actual_date', 'upcode_date', $existing);
        $this->ensureDateOrder($validator, 'upcode_date', 'noti_date', $existing);
    }

    protected function validateStatusTransition(Validator $validator, ?ProgrammingRequest $existing): void
    {
        if (! $existing || ! $this->has('status')) {
            return;
        }

        $fromStatus = strtoupper(trim((string) ($existing->status ?? '')));
        $toStatus = strtoupper(trim((string) ($this->input('status') ?? '')));

        if ($fromStatus === '' || $toStatus === '' || $fromStatus === $toStatus) {
            return;
        }

        $allowedTransitions = $this->allowedStatusTransitions();
        $allowedTargets = $allowedTransitions[$fromStatus] ?? [];
        if (in_array($toStatus, $allowedTargets, true)) {
            return;
        }

        $validator->errors()->add(
            'status',
            sprintf('Không cho phép chuyển trạng thái từ %s sang %s.', $fromStatus, $toStatus)
        );
    }

    /**
     * @return array<string, array<int, string>>
     */
    protected function allowedStatusTransitions(): array
    {
        return [
            'NEW' => ['ANALYZING', 'CANCELLED'],
            'ANALYZING' => ['CODING', 'CANCELLED'],
            'CODING' => ['PENDING_UPCODE', 'CANCELLED'],
            'PENDING_UPCODE' => ['UPCODED', 'CANCELLED'],
            'UPCODED' => ['NOTIFIED', 'CLOSED'],
            'NOTIFIED' => ['CLOSED'],
            'CLOSED' => [],
            'CANCELLED' => [],
        ];
    }

    protected function validateProjectItemConsistency(Validator $validator, ?ProgrammingRequest $existing): void
    {
        $projectItemId = $this->parseNullableInt($this->mergedValue('project_item_id', $existing));
        if ($projectItemId === null) {
            $validator->errors()->add('project_item_id', 'project_item_id bắt buộc.');
            return;
        }

        $query = DB::table('project_items as pi')
            ->leftJoin('projects as p', 'pi.project_id', '=', 'p.id')
            ->where('pi.id', $projectItemId)
            ->select([
                'pi.project_id',
                'pi.product_id',
                'p.customer_id as project_customer_id',
            ]);

        if (Schema::hasColumn('project_items', 'deleted_at')) {
            $query->whereNull('pi.deleted_at');
        }

        $item = $query->first();
        if (! $item) {
            $validator->errors()->add('project_item_id', 'project_item_id không tồn tại hoặc đã bị xóa.');

            return;
        }

        $expectedProjectId = $this->parseNullableInt($item->project_id ?? null);
        $expectedProductId = $this->parseNullableInt($item->product_id ?? null);
        $expectedCustomerId = $this->parseNullableInt($item->project_customer_id ?? null);

        $projectId = $this->parseNullableInt($this->mergedValue('project_id', $existing));
        if ($projectId !== null && $expectedProjectId !== null && $projectId !== $expectedProjectId) {
            $validator->errors()->add('project_id', 'project_id không khớp với phần mềm triển khai đã chọn.');
        }

        $productId = $this->parseNullableInt($this->mergedValue('product_id', $existing));
        if ($productId !== null && $expectedProductId !== null && $productId !== $expectedProductId) {
            $validator->errors()->add('product_id', 'product_id không khớp với phần mềm triển khai đã chọn.');
        }

        $customerId = $this->parseNullableInt($this->mergedValue('customer_id', $existing));
        if ($customerId !== null && $expectedCustomerId !== null && $customerId !== $expectedCustomerId) {
            $validator->errors()->add('customer_id', 'customer_id không khớp với phần mềm triển khai đã chọn.');
        }
    }

    protected function validateHierarchy(Validator $validator, ?ProgrammingRequest $existing): void
    {
        $currentId = $existing?->id;
        $depth = (int) $this->input('depth', $existing?->depth ?? 0);
        $parentId = $this->parseNullableInt($this->input('parent_id', $existing?->parent_id));
        $referenceId = $this->parseNullableInt($this->input('reference_request_id', $existing?->reference_request_id));

        if ($currentId !== null && $parentId === $currentId) {
            $validator->errors()->add('parent_id', 'parent_id không được tham chiếu chính nó.');
        }

        if ($currentId !== null && $referenceId === $currentId) {
            $validator->errors()->add('reference_request_id', 'reference_request_id không được tham chiếu chính nó.');
        }

        if ($depth === 0 && $parentId !== null) {
            $validator->errors()->add('parent_id', 'depth=0 yêu cầu parent_id phải NULL.');
        }

        if ($depth > 0 && $parentId === null) {
            $validator->errors()->add('parent_id', 'depth>0 yêu cầu parent_id bắt buộc.');
        }

        if ($depth > 0 && $parentId !== null) {
            $parent = ProgrammingRequest::query()->find($parentId);
            if (! $parent) {
                $validator->errors()->add('parent_id', 'parent_id không tồn tại.');

                return;
            }

            $expectedParentDepth = $depth - 1;
            if ((int) $parent->depth !== $expectedParentDepth) {
                $validator->errors()->add('parent_id', sprintf('depth=%d yêu cầu parent depth=%d.', $depth, $expectedParentDepth));
            }
        }
    }

    protected function parseNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    protected function mergedValue(string $field, ?ProgrammingRequest $existing): mixed
    {
        if ($this->has($field)) {
            return $this->input($field);
        }

        return $existing?->{$field};
    }

    protected function ensureDateOrder(Validator $validator, string $fromField, string $toField, ?ProgrammingRequest $existing): void
    {
        $from = $this->toTimestamp($this->mergedValue($fromField, $existing));
        $to = $this->toTimestamp($this->mergedValue($toField, $existing));

        if ($from === null || $to === null) {
            return;
        }

        if ($from > $to) {
            $validator->errors()->add($toField, sprintf('%s phải lớn hơn hoặc bằng %s.', $toField, $fromField));
        }
    }

    protected function toTimestamp(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->getTimestamp();
        }

        $timestamp = strtotime((string) $value);

        return $timestamp === false ? null : $timestamp;
    }
}
