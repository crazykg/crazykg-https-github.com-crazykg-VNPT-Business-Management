<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class UpdateCustomerRequest extends V5FormRequest
{
    private const CUSTOMER_SECTORS = ['HEALTHCARE', 'GOVERNMENT', 'INDIVIDUAL', 'OTHER'];

    private const HEALTHCARE_FACILITY_TYPES = [
        'PUBLIC_HOSPITAL',
        'PRIVATE_HOSPITAL',
        'MEDICAL_CENTER',
        'PRIVATE_CLINIC',
        'TYT_PKDK',
        'OTHER',
        'HOSPITAL_TTYT',
        'TYT_CLINIC',
    ];

    public function authorize(): bool
    {
        return $this->authorizeWithPermission('customers.write');
    }

    public function rules(): array
    {
        $rules = [
            'uuid' => ['sometimes', 'nullable', 'string', 'max:100'],
            'customer_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'customer_name' => ['sometimes', 'required', 'string', 'max:255'],
            'tax_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string'],
            'customer_sector' => ['sometimes', 'nullable', 'string', Rule::in(self::CUSTOMER_SECTORS)],
            'healthcare_facility_type' => ['sometimes', 'nullable', 'string', Rule::in(self::HEALTHCARE_FACILITY_TYPES)],
            'bed_capacity' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:1000000'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->support()->hasColumn('customers', 'uuid')) {
            $uniqueRule = Rule::unique('customers', 'uuid')->ignore($this->route('id'));
            if ($this->support()->hasColumn('customers', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['uuid'][] = $uniqueRule;
        }

        return $rules;
    }
}
