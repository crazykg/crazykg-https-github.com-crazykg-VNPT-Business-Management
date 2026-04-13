<?php

namespace App\Http\Requests\V5;

class StoreProductPackageRequest extends V5FormRequest
{
    public function authorize(): bool
    {
        return $this->authorizeWithPermission('products.write');
    }

    public function rules(): array
    {
        $rules = [
            'product_id' => ['required', 'integer'],
            'package_code' => ['required', 'string', 'max:100'],
            'package_name' => ['nullable', 'string', 'max:255'],
            'standard_price' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
            'attachments' => ['nullable', 'array'],
            'attachments.*.id' => ['nullable', 'string', 'max:100'],
            'attachments.*.fileName' => ['required_with:attachments', 'string', 'max:255'],
            'attachments.*.fileUrl' => ['nullable', 'string'],
            'attachments.*.driveFileId' => ['nullable', 'string', 'max:255'],
            'attachments.*.fileSize' => ['nullable', 'numeric', 'min:0'],
            'attachments.*.mimeType' => ['nullable', 'string', 'max:255'],
            'attachments.*.createdAt' => ['nullable', 'date'],
            'attachments.*.storagePath' => ['nullable', 'string', 'max:1024'],
            'attachments.*.storageDisk' => ['nullable', 'string', 'max:50'],
            'attachments.*.storageVisibility' => ['nullable', 'string', 'max:20'],
            'attachments.*.storageProvider' => ['nullable', 'string', 'max:30'],
        ];

        if ($this->support()->hasColumn('product_packages', 'package_code')) {
            $uniqueRule = \Illuminate\Validation\Rule::unique('product_packages', 'package_code');
            if ($this->support()->hasColumn('product_packages', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['package_code'][] = $uniqueRule;
        }

        return $rules;
    }
}
