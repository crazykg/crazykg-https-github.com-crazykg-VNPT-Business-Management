<?php

namespace App\Http\Requests\V5;

use App\Models\InternalUser;
use App\Services\V5\Contract\ContractRenewalService;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class StoreContractRequest extends V5FormRequest
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
        $signerUserRules = ['required', 'integer'];
        if ($this->support()->hasTable('internal_users') && $this->support()->hasColumn('internal_users', 'id')) {
            $signerUserRules[] = Rule::exists('internal_users', 'id');
        }

        $rules = [
            'contract_code' => ['required', 'string', 'max:100'],
            'contract_name' => ['required', 'string', 'max:255'],
            'signer_user_id' => $signerUserRules,
            'customer_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'project_type_code' => ['nullable', 'string', 'max:100'],
            'value' => ['nullable', 'numeric', 'min:0'],
            'payment_cycle' => ['nullable', Rule::in(self::PAYMENT_CYCLES)],
            'status' => ['nullable', Rule::in(self::CONTRACT_STATUSES)],
            'sign_date' => ['nullable', 'date'],
            'effective_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date'],
            'term_unit' => ['nullable', 'string', Rule::in(self::CONTRACT_TERM_UNITS)],
            'term_value' => ['nullable', 'numeric', 'gt:0'],
            'expiry_date_manual_override' => ['sometimes', 'boolean'],
            'data_scope' => ['nullable', 'string', 'max:255'],
            'items' => ['sometimes', 'array'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.vat_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.vat_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'parent_contract_id' => ['nullable', 'integer', 'exists:contracts,id'],
            'addendum_type' => ['nullable', Rule::in(ContractRenewalService::addendumTypes())],
        ];

        if ($this->support()->hasColumn('contracts', 'contract_code')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_code');
        }
        if ($this->support()->hasColumn('contracts', 'contract_number')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_number');
        }

        return $rules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $signerUserId = $this->support()->parseNullableInt($this->input('signer_user_id'));
            if ($signerUserId === null || $validator->errors()->has('signer_user_id')) {
                return;
            }

            $query = InternalUser::query()->select(['id', 'department_id']);
            if ($this->support()->hasColumn('internal_users', 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            $signer = $query->find($signerUserId);
            if (! $signer instanceof InternalUser) {
                return;
            }

            $departmentId = $this->support()->parseNullableInt($signer->getAttribute('department_id'));
            $departmentExists = $departmentId !== null
                && $this->support()->hasTable('departments')
                && DB::table('departments')
                    ->where('id', $departmentId)
                    ->when(
                        $this->support()->hasColumn('departments', 'deleted_at'),
                        fn ($query) => $query->whereNull('deleted_at')
                    )
                    ->exists();

            if (! $departmentExists) {
                $validator->errors()->add('signer_user_id', 'Người ký hợp đồng chưa được gán phòng ban hợp lệ.');
            }
        });
    }
}
