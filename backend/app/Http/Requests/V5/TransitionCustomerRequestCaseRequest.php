<?php

namespace App\Http\Requests\V5;

class TransitionCustomerRequestCaseRequest extends UpdateCustomerRequestCaseStatusRequest
{
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'to_status_code' => ['required', 'string', 'max:100'],
        ]);
    }
}
