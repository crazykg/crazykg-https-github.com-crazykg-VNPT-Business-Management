<?php

namespace App\Http\Requests\V5;

use Illuminate\Validation\Rule;

class UpdateCustomerRequestCaseSubStatusRequest extends V5FormRequest
{
    private const CODING_PHASES = ['coding', 'coding_done', 'upcode_pending', 'upcode_deployed', 'suspended'];
    private const DMS_PHASES = ['exchange', 'task_created', 'in_progress', 'completed', 'suspended'];

    public function authorize(): bool
    {
        return $this->authorizeWithPermission('support_requests.write');
    }

    public function rules(): array
    {
        return [
            'updated_by' => ['nullable', 'integer'],
            'coding_phase' => ['sometimes', 'nullable', Rule::in(self::CODING_PHASES)],
            'coding_completed_at' => ['sometimes', 'nullable', 'date'],
            'upcode_at' => ['sometimes', 'nullable', 'date'],
            'upcode_version' => ['sometimes', 'nullable', 'string', 'max:255'],
            'upcode_environment' => ['sometimes', 'nullable', 'string', 'max:255'],
            'dms_phase' => ['sometimes', 'nullable', Rule::in(self::DMS_PHASES)],
            'dms_completed_at' => ['sometimes', 'nullable', 'date'],
            'task_ref' => ['sometimes', 'nullable', 'string', 'max:255'],
            'task_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
        ];
    }
}
