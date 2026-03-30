<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class StoreCustomerRequestCaseEstimateRequest extends V5FormRequest
{
    public function authorize(): bool
    {
        return $this->authorizeWithPermission('support_requests.write');
    }

    public function rules(): array
    {
        return [
            'updated_by' => ['nullable', 'integer'],
            'estimated_hours' => ['required', 'numeric', 'gt:0'],
            'estimate_scope' => ['sometimes', 'nullable', Rule::in(['total', 'remaining', 'phase'])],
            'estimate_type' => ['sometimes', 'nullable', 'string', 'max:100'],
            'estimated_at' => ['sometimes', 'nullable', 'date'],
            'status_instance_id' => ['sometimes', 'nullable', 'integer'],
            'status_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'estimated_by_user_id' => ['sometimes', 'nullable', 'integer'],
            'phase_label' => ['sometimes', 'nullable', 'string', 'max:255'],
            'note' => ['sometimes', 'nullable', 'string'],
            'sync_master' => ['sometimes', 'nullable', 'boolean'],
        ];
    }
}
