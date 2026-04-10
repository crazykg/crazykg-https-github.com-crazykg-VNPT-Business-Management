<?php

namespace App\Http\Requests\V5;

class StoreCustomerRequestCaseWorklogRequest extends V5FormRequest
{
    public function authorize(): bool
    {
        return $this->authorizeWithPermission('support_requests.write');
    }

    public function rules(): array
    {
        return [
            'updated_by' => ['nullable', 'integer'],
            'status_instance_id' => ['sometimes', 'nullable', 'integer'],
            'performed_by_user_id' => ['sometimes', 'nullable', 'integer'],
            'work_content' => ['required', 'string'],
            'work_started_at' => ['sometimes', 'nullable', 'date'],
            'work_ended_at' => ['sometimes', 'nullable', 'date'],
            'work_date' => ['sometimes', 'nullable', 'date'],
            'activity_type_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'is_billable' => ['sometimes', 'nullable', 'boolean'],
            'is_auto_transition' => ['sometimes', 'nullable', 'boolean'],
            'transition_id' => ['sometimes', 'nullable', 'integer'],
            'hours_spent' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'difficulty_note' => ['sometimes', 'nullable', 'string'],
            'proposal_note' => ['sometimes', 'nullable', 'string'],
            'difficulty_status' => ['sometimes', 'nullable', 'in:none,has_issue,resolved'],
            'detail_status_action' => ['sometimes', 'nullable', 'in:in_progress,paused'],
        ];
    }
}
