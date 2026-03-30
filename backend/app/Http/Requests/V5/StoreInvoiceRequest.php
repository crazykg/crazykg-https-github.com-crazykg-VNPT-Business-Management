<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class StoreInvoiceRequest extends V5FormRequest
{
    public function authorize(): bool
    {
        return $this->authorizeWithPermission('fee_collection.write');
    }

    public function rules(): array
    {
        return [
            'contract_id' => ['required', 'integer', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'project_id' => ['nullable', 'integer'],
            'invoice_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:invoice_date'],
            'period_from' => ['nullable', 'date'],
            'period_to' => ['nullable', 'date'],
            'invoice_series' => ['nullable', 'string', 'max:20'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string', 'max:500'],
            'items.*.quantity' => ['required', 'numeric', 'min:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.product_id' => ['nullable', 'integer'],
            'items.*.payment_schedule_id' => ['nullable', 'integer'],
            'items.*.sort_order' => ['nullable', 'integer'],
        ];
    }
}
