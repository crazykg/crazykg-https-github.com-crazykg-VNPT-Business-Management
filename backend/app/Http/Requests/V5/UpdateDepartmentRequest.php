<?php

namespace App\Http\Requests\V5;

class UpdateDepartmentRequest extends V5FormRequest
{
    public function authorize(): bool
    {
        return $this->authorizeWithPermission('departments.write');
    }

    public function rules(): array
    {
        $rules = [
            'dept_code' => ['sometimes', 'required', 'string', 'max:100'],
            'dept_name' => ['sometimes', 'required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer'],
        ];

        if ($this->support()->hasColumn('departments', 'is_active') || $this->support()->hasColumn('departments', 'status')) {
            $rules['is_active'] = ['nullable', 'boolean'];
        }
        if ($this->support()->hasColumn('departments', 'data_scope')) {
            $rules['data_scope'] = ['nullable', 'string', 'max:255'];
        }

        return $rules;
    }
}
