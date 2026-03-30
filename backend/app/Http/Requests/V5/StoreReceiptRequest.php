<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class StoreReceiptRequest extends V5FormRequest
{
    private const PAYMENT_METHODS = ['BANK_TRANSFER', 'CASH', 'CARD', 'EWALLET', 'OTHER'];

    public function authorize(): bool
    {
        return $this->authorizeWithPermission('fee_collection.write');
    }

    public function rules(): array
    {
        return [
            'invoice_id' => ['nullable', 'integer'],
            'contract_id' => ['required', 'integer', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'receipt_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', Rule::in(self::PAYMENT_METHODS)],
            'bank_name' => ['nullable', 'string', 'max:200'],
            'bank_account' => ['nullable', 'string', 'max:50'],
            'transaction_ref' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', Rule::in(['CONFIRMED', 'PENDING_CONFIRM'])],
        ];
    }
}
