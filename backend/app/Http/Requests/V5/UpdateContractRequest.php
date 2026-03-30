<?php

namespace App\Http\Requests\V5;

use App\Services\V5\Contract\ContractRenewalService;
use Illuminate\Validation\Rule;

class UpdateContractRequest extends V5FormRequest
{
    private const CONTRACT_STATUSES = ['DRAFT', 'SIGNED', 'RENEWED'];

    private const PAYMENT_CYCLES = ['ONCE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

    private const CONTRACT_TERM_UNITS = ['MONTH', 'DAY'];

    public function authorize(): bool
    {
        return $this->authorizeWithPermission('contracts.write');
    }

    public function rules(): array
    {
        $contractId = (int) $this->route('id');

        $rules = [
            'contract_code' => ['sometimes', 'required', 'string', 'max:100'],
            'contract_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'nullable', 'integer'],
            'project_id' => ['sometimes', 'nullable', 'integer'],
            'project_type_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'value' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'payment_cycle' => ['sometimes', 'nullable', Rule::in(self::PAYMENT_CYCLES)],
            'status' => ['sometimes', 'nullable', Rule::in(self::CONTRACT_STATUSES)],
            'sign_date' => ['sometimes', 'nullable', 'date'],
            'effective_date' => ['sometimes', 'nullable', 'date'],
            'expiry_date' => ['sometimes', 'nullable', 'date'],
            'term_unit' => ['sometimes', 'nullable', 'string', Rule::in(self::CONTRACT_TERM_UNITS)],
            'term_value' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'expiry_date_manual_override' => ['sometimes', 'boolean'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
            'items' => ['sometimes', 'array'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.vat_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.vat_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'parent_contract_id' => ['sometimes', 'nullable', 'integer', 'exists:contracts,id'],
            'addendum_type' => ['sometimes', 'nullable', Rule::in(ContractRenewalService::addendumTypes())],
        ];

        if ($this->support()->hasColumn('contracts', 'contract_code')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_code')->ignore($contractId);
        }
        if ($this->support()->hasColumn('contracts', 'contract_number')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_number')->ignore($contractId);
        }

        return $rules;
    }
}
