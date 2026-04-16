<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class StoreProductRequest extends V5FormRequest
{
    private const SERVICE_GROUP_VALUES = ['GROUP_A', 'GROUP_B', 'GROUP_C'];

    public function authorize(): bool
    {
        return $this->authorizeWithPermission('products.write');
    }

    public function rules(): array
    {
        $rules = [
            'service_group' => ['nullable', 'string', Rule::in(self::SERVICE_GROUP_VALUES)],
            'product_code' => ['required', 'string', 'max:100'],
            'product_name' => ['required', 'string', 'max:255'],
            'product_short_name' => ['nullable', 'string', 'max:255'],
            'domain_id' => ['required', 'integer'],
            'vendor_id' => ['required', 'integer'],
            'standard_price' => ['nullable', 'numeric', 'min:0'],
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

        if ($this->support()->hasColumn('products', 'product_code')) {
            $uniqueRule = Rule::unique('products', 'product_code');
            if ($this->support()->hasColumn('products', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['product_code'][] = $uniqueRule;
        }

        return $rules;
    }
}
