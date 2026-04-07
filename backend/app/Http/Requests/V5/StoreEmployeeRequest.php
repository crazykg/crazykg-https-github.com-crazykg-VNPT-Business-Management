<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class StoreEmployeeRequest extends V5FormRequest
{
    private const EMPLOYEE_INPUT_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'TRANSFERRED'];

    public function authorize(): bool
    {
        return $this->authorizeWithPermission('employees.write');
    }

    public function rules(): array
    {
        $employeeTable = $this->support()->resolveEmployeeTable() ?? 'internal_users';

        $rules = [
            'uuid' => ['nullable', 'string', 'max:100'],
            'username' => ['required', 'string', 'max:100'],
            'user_code' => ['nullable', 'string', 'max:100', 'regex:/^(VNPT|CTV)\d{5,}$/i'],
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'status' => ['nullable', Rule::in(self::EMPLOYEE_INPUT_STATUSES)],
            'department_id' => ['required', 'integer'],
            'position_id' => ['nullable', 'integer'],
            'job_title_raw' => ['nullable', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date'],
            'leave_date' => ['nullable', 'date'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'gender' => ['nullable', Rule::in(['MALE', 'FEMALE', 'OTHER'])],
            'vpn_status' => ['nullable', Rule::in(['YES', 'NO'])],
            'ip_address' => ['nullable', 'string', 'max:45'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->support()->hasColumn($employeeTable, 'uuid')) {
            $rules['uuid'][] = Rule::unique($employeeTable, 'uuid');
        }
        if ($this->support()->hasColumn($employeeTable, 'username')) {
            $rules['username'][] = Rule::unique($employeeTable, 'username');
        }
        if ($this->support()->hasColumn($employeeTable, 'user_code')) {
            $rules['user_code'][0] = 'required';
            $rules['user_code'][] = Rule::unique($employeeTable, 'user_code');
        }
        if ($this->support()->hasColumn($employeeTable, 'email')) {
            $rules['email'][] = Rule::unique($employeeTable, 'email');
        }

        return $rules;
    }
}
