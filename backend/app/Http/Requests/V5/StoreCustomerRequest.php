<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class StoreCustomerRequest extends V5FormRequest
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
            'uuid' => ['nullable', 'string', 'max:100'],
            'customer_code' => ['nullable', 'string', 'max:100'],
            'customer_name' => ['required', 'string', 'max:255'],
            'tax_code' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string'],
            'customer_sector' => ['nullable', 'string', Rule::in(self::CUSTOMER_SECTORS)],
            'healthcare_facility_type' => ['nullable', 'string', Rule::in(self::HEALTHCARE_FACILITY_TYPES)],
            'bed_capacity' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->support()->hasColumn('customers', 'uuid')) {
            $uniqueRule = Rule::unique('customers', 'uuid');
            if ($this->support()->hasColumn('customers', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['uuid'][] = $uniqueRule;
        }

        return $rules;
    }
}
