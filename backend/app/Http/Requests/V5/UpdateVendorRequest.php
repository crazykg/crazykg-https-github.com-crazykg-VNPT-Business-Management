<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class UpdateVendorRequest extends V5FormRequest
{
    public function authorize(): bool
    {
        return $this->authorizeWithPermission('vendors.write');
    }

    public function rules(): array
    {
        $vendorId = (int) $this->route('id');

        $rules = [
            'uuid' => ['sometimes', 'nullable', 'string', 'max:100'],
            'vendor_code' => ['sometimes', 'required', 'string', 'max:100'],
            'vendor_name' => ['sometimes', 'required', 'string', 'max:255'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->support()->hasColumn('vendors', 'uuid')) {
            $uniqueRule = Rule::unique('vendors', 'uuid')->ignore($vendorId);
            if ($this->support()->hasColumn('vendors', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['uuid'][] = $uniqueRule;
        }
        if ($this->support()->hasColumn('vendors', 'vendor_code')) {
            $uniqueRule = Rule::unique('vendors', 'vendor_code')->ignore($vendorId);
            if ($this->support()->hasColumn('vendors', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['vendor_code'][] = $uniqueRule;
        }

        return $rules;
    }
}
