<?php

namespace App\Http\Requests\V5;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UpdateDocumentRequest extends V5FormRequest
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
            'id' => ['sometimes', 'required', 'string', 'max:100'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'scope' => ['nullable', 'string'],
            'typeId' => ['sometimes', $isProductPricingScope ? 'nullable' : 'required'],
            'customerId' => ['sometimes', $isProductPricingScope ? 'nullable' : 'required', 'integer'],
            'projectId' => ['sometimes', 'nullable', 'integer'],
            'commissionPolicyText' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'expiryDate' => ['sometimes', 'nullable', 'date'],
            'releaseDate' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'nullable', Rule::in(self::DOCUMENT_STATUSES)],
            'productIds' => ['sometimes', 'nullable', 'array'],
            'productIds.*' => ['integer'],
            'attachments' => ['sometimes', 'nullable', 'array'],
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
            $currentDocumentId = $this->resolveCurrentDocumentId((string) $this->route('id'));
            if ($currentDocumentId !== null) {
                $uniqueRule = $uniqueRule->ignore($currentDocumentId);
            }
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

    private function resolveCurrentDocumentId(string $identifier): ?int
    {
        if (! $this->support()->hasTable('documents')) {
            return null;
        }

        $query = DB::table('documents');
        if ($this->support()->hasColumn('documents', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $query->where(function ($builder) use ($identifier): void {
            if (ctype_digit($identifier)) {
                $builder->orWhere('id', (int) $identifier);
            }

            if ($this->support()->hasColumn('documents', 'document_code')) {
                $builder->orWhere('document_code', $identifier);
            }
        });

        $value = $query->value('id');
        $resolved = $this->support()->parseNullableInt($value);

        return $resolved !== null && $resolved > 0 ? $resolved : null;
    }
}
