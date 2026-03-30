<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class StoreProjectRequest extends V5FormRequest
{
    private const PAYMENT_CYCLES = ['ONCE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

    private const RACI_ROLES = ['R', 'A', 'C', 'I'];

    public function authorize(): bool
    {
        return $this->authorizeWithPermission('projects.write');
    }

    public function rules(): array
    {
        $rules = [
            'project_code' => ['required', 'string', 'max:100'],
            'project_name' => ['required', 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:100'],
            'status_reason' => ['nullable', 'string', 'max:2000'],
            'investment_mode' => ['nullable', 'string', 'max:100'],
            'start_date' => ['nullable', 'date'],
            'expected_end_date' => ['nullable', 'date'],
            'actual_end_date' => ['nullable', 'date'],
            'payment_cycle' => ['nullable', 'string', Rule::in(self::PAYMENT_CYCLES)],
            'data_scope' => ['nullable', 'string', 'max:255'],
            'sync_items' => ['sometimes', 'boolean'],
            'sync_raci' => ['sometimes', 'boolean'],
            'items' => ['sometimes', 'array', 'max:500'],
            'items.*' => ['required', 'array'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['nullable', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'raci' => ['sometimes', 'array', 'max:500'],
            'raci.*' => ['required', 'array'],
            'raci.*.user_id' => ['required', 'integer'],
            'raci.*.raci_role' => ['required', Rule::in(self::RACI_ROLES)],
            'raci.*.assigned_date' => ['sometimes', 'nullable', 'date'],
        ];

        if ($this->support()->hasColumn('projects', 'project_code')) {
            $rules['project_code'][] = Rule::unique('projects', 'project_code');
        }

        return $rules;
    }
}
