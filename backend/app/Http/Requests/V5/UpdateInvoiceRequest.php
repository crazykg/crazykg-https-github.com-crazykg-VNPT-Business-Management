<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class UpdateInvoiceRequest extends V5FormRequest
{
    private const STATUSES = ['DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'CANCELLED', 'VOID'];

    public function authorize(): bool
    {
        return $this->authorizeWithPermission('fee_collection.write');
    }

    public function rules(): array
    {
        return [
            'invoice_date' => ['sometimes', 'date'],
            'due_date' => ['sometimes', 'date'],
            'period_from' => ['nullable', 'date'],
            'period_to' => ['nullable', 'date'],
            'invoice_series' => ['nullable', 'string', 'max:20'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'status' => ['sometimes', 'string', Rule::in(self::STATUSES)],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.description' => ['required_with:items', 'string', 'max:500'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.product_id' => ['nullable', 'integer'],
            'items.*.payment_schedule_id' => ['nullable', 'integer'],
            'items.*.sort_order' => ['nullable', 'integer'],
        ];
    }
}
