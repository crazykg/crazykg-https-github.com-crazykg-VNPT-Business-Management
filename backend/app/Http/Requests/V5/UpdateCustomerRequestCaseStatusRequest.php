<?php

namespace App\Http\Requests\V5;

class UpdateCustomerRequestCaseStatusRequest extends V5FormRequest
{
    public function authorize(): bool
    {
        return $this->authorizeWithPermission('support_requests.write');
    }

    public function rules(): array
    {
        return [
            'created_by' => ['nullable', 'integer'],
            'updated_by' => ['nullable', 'integer'],
            'master_payload' => ['sometimes', 'nullable', 'array'],
            'status_payload' => ['sometimes', 'nullable', 'array'],
            'process_payload' => ['sometimes', 'nullable', 'array'],
            'ref_tasks' => ['sometimes', 'nullable', 'array'],
            'attachments' => ['sometimes', 'nullable', 'array'],
            'requester_name_snapshot' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
