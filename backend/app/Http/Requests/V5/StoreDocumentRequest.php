<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class StoreDocumentRequest extends V5FormRequest
{
    private const DOCUMENT_STATUSES = ['ACTIVE', 'SUSPENDED', 'EXPIRED'];
    private const DOCUMENT_SCOPE_PRODUCT_PRICING = 'PRODUCT_PRICING';
    private const DOCUMENT_SCOPE_DEFAULT = 'DEFAULT';

    public function authorize(): bool
    {
        return $this->authorizeWithPermission('documents.write');
    }

    public function rules(): array
    {
        $scope = $this->normalizeDocumentScope((string) ($this->input('scope') ?? self::DOCUMENT_SCOPE_DEFAULT));
        $isProductPricingScope = $scope === self::DOCUMENT_SCOPE_PRODUCT_PRICING;

        $rules = [
            'id' => ['required', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
            'scope' => ['nullable', 'string'],
            'typeId' => [$isProductPricingScope ? 'nullable' : 'required'],
            'customerId' => [$isProductPricingScope ? 'nullable' : 'required', 'integer'],
            'projectId' => ['nullable', 'integer'],
            'expiryDate' => ['nullable', 'date'],
            'releaseDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(self::DOCUMENT_STATUSES)],
            'productIds' => ['nullable', 'array'],
            'productIds.*' => ['integer'],
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

        if ($this->support()->hasColumn('documents', 'document_code')) {
            $uniqueRule = Rule::unique('documents', 'document_code');
            if ($this->support()->hasColumn('documents', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['id'][] = $uniqueRule;
        }

        return $rules;
    }

    private function normalizeDocumentScope(string $scope): string
    {
        $normalized = strtoupper(trim($scope));

        return $normalized !== '' ? $normalized : self::DOCUMENT_SCOPE_DEFAULT;
    }
}
