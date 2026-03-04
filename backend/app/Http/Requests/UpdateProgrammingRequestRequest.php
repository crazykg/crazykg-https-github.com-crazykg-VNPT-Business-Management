<?php

namespace App\Http\Requests;

use App\Models\ProgrammingRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateProgrammingRequestRequest extends StoreProgrammingRequestRequest
{
    public function rules(): array
    {
        return [
            // req_code is managed server-side and should remain backward compatible for legacy records.
            'req_code' => ['sometimes', 'nullable', 'string', 'max:50'],
            'req_name' => ['sometimes', 'required', 'string', 'max:255'],
            'ticket_code' => ['sometimes', 'nullable', 'string', 'max:50'],
            'task_link' => ['sometimes', 'nullable', 'string'],
            'parent_id' => ['sometimes', 'nullable', 'integer', Rule::exists('programming_requests', 'id')],
            'depth' => ['sometimes', 'required', 'integer', 'between:0,2'],
            'reference_request_id' => ['sometimes', 'nullable', 'integer', Rule::exists('programming_requests', 'id')],
            'source_type' => ['sometimes', 'required', Rule::in(['DIRECT', 'FROM_SUPPORT'])],
            'req_type' => ['sometimes', 'required', Rule::in(['FEATURE', 'BUG', 'OPTIMIZE', 'REPORT', 'OTHER'])],
            'service_group_id' => ['sometimes', 'nullable', 'integer', Rule::exists('support_service_groups', 'id')],
            'support_request_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('support_requests', 'id'),
                Rule::requiredIf(fn () => strtoupper((string) $this->input('source_type')) === 'FROM_SUPPORT'),
                Rule::prohibitedIf(fn () => strtoupper((string) $this->input('source_type')) === 'DIRECT'),
            ],
            'priority' => ['sometimes', 'nullable', 'integer', 'between:1,4'],
            'overall_progress' => ['sometimes', 'nullable', 'integer', 'between:0,100'],
            'status' => ['sometimes', 'required', Rule::in(['NEW', 'ANALYZING', 'CODING', 'PENDING_UPCODE', 'UPCODED', 'NOTIFIED', 'CLOSED', 'CANCELLED'])],
            'description' => ['sometimes', 'nullable', 'string'],
            'doc_link' => ['sometimes', 'nullable', 'string'],
            'customer_id' => ['sometimes', 'nullable', 'integer', Rule::exists('customers', 'id')],
            'requested_date' => ['sometimes', 'required', 'date'],
            'reporter_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'reporter_contact_id' => ['sometimes', 'nullable', 'integer', Rule::exists('customer_personnel', 'id')],
            'receiver_id' => ['sometimes', 'nullable', 'integer', Rule::exists('internal_users', 'id')],
            'project_id' => ['sometimes', 'nullable', 'integer', Rule::exists('projects', 'id')],
            'product_id' => ['sometimes', 'nullable', 'integer', Rule::exists('products', 'id')],
            'project_item_id' => ['sometimes', 'required', 'integer', Rule::exists('project_items', 'id')],
            'analyze_estimated_hours' => ['sometimes', 'nullable', 'numeric', 'min:0.01'],
            'analyze_start_date' => ['sometimes', 'nullable', 'date'],
            'analyze_end_date' => ['sometimes', 'nullable', 'date', 'after_or_equal:analyze_start_date'],
            'analyze_extend_date' => ['sometimes', 'nullable', 'date', 'after_or_equal:analyze_end_date'],
            'analyzer_id' => ['sometimes', 'nullable', 'integer', Rule::exists('internal_users', 'id')],
            'analyze_progress' => ['sometimes', 'nullable', 'integer', 'between:0,100'],
            'code_estimated_hours' => ['sometimes', 'nullable', 'numeric', 'min:0.01'],
            'code_start_date' => ['sometimes', 'nullable', 'date', 'after_or_equal:analyze_end_date'],
            'code_end_date' => ['sometimes', 'nullable', 'date', 'after_or_equal:code_start_date'],
            'code_extend_date' => ['sometimes', 'nullable', 'date', 'after_or_equal:code_end_date'],
            'code_actual_date' => ['sometimes', 'nullable', 'date', 'after_or_equal:code_start_date'],
            'coder_id' => ['sometimes', 'nullable', 'integer', Rule::exists('internal_users', 'id')],
            'code_progress' => ['sometimes', 'nullable', 'integer', 'between:0,100'],
            'upcode_status' => ['sometimes', 'nullable', Rule::in(['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'])],
            'upcode_date' => ['sometimes', 'nullable', 'date', 'after_or_equal:code_actual_date'],
            'upcoder_id' => ['sometimes', 'nullable', 'integer', Rule::exists('internal_users', 'id')],
            'noti_status' => ['sometimes', 'nullable', Rule::in(['PENDING', 'NOTIFIED', 'FAILED'])],
            'noti_date' => ['sometimes', 'nullable', 'date', 'after_or_equal:upcode_date'],
            'notifier_id' => ['sometimes', 'nullable', 'integer', Rule::exists('internal_users', 'id')],
            'notified_internal_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('internal_users', 'id'),
                Rule::prohibitedIf(fn () => $this->filled('notified_customer_id')),
            ],
            'notified_customer_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('customer_personnel', 'id'),
                Rule::prohibitedIf(fn () => $this->filled('notified_internal_id')),
            ],
            'noti_doc_link' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $id = (int) $this->route('id');
            $existing = ProgrammingRequest::query()->find($id);
            if (! $existing) {
                return;
            }

            $this->validateBusinessRules($validator, $existing);
        });
    }
}
