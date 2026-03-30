<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class StoreVendorRequest extends V5FormRequest
{
    public function authorize(): bool
    {
        return $this->authorizeWithPermission('vendors.write');
    }

    public function rules(): array
    {
        $rules = [
            'uuid' => ['nullable', 'string', 'max:100'],
            'vendor_code' => ['required', 'string', 'max:100'],
            'vendor_name' => ['required', 'string', 'max:255'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->support()->hasColumn('vendors', 'uuid')) {
            $uniqueRule = Rule::unique('vendors', 'uuid');
            if ($this->support()->hasColumn('vendors', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['uuid'][] = $uniqueRule;
        }
        if ($this->support()->hasColumn('vendors', 'vendor_code')) {
            $uniqueRule = Rule::unique('vendors', 'vendor_code');
            if ($this->support()->hasColumn('vendors', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['vendor_code'][] = $uniqueRule;
        }

        return $rules;
    }
}
