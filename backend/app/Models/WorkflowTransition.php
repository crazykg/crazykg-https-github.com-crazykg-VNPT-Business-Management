<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Class WorkflowTransition
 *
 * Model đại diện cho một transition (chuyển tiếp) trong workflow
 *
 * @package App\Models
 * @property int $id
 * @property int $workflow_definition_id
 * @property string $from_status_code
 * @property string $to_status_code
 * @property array|null $allowed_roles
 * @property array|null $required_fields
 * @property array|null $transition_config
 * @property int $sort_order
 * @property bool $is_active
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 */
class WorkflowTransition extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'customer_request_status_transitions';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'workflow_definition_id',
        'from_status_code',
        'to_status_code',
        'allowed_roles',
        'required_fields',
        'transition_config',
        'sort_order',
        'is_active',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'workflow_definition_id' => 'integer',
        'allowed_roles' => 'array',
        'required_fields' => 'array',
        'transition_config' => 'array',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * The model's default values for attributes.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'is_active' => true,
        'sort_order' => 0,
    ];

    /**
     * Get the workflow that owns the transition.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<\App\Models\WorkflowDefinition, self>
     */
    public function workflow(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }

    /**
     * Scope a query to only include active transitions.
     *
     * @param \Illuminate\Database\Eloquent\Builder<self> $query
     * @return \Illuminate\Database\Eloquent\Builder<self>
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope a query to only include transitions for a specific workflow.
     *
     * @param \Illuminate\Database\Eloquent\Builder<self> $query
     * @param int $workflowId
     * @return \Illuminate\Database\Eloquent\Builder<self>
     */
    public function scopeForWorkflow($query, int $workflowId)
    {
        return $query->where('workflow_definition_id', $workflowId);
    }

    /**
     * Scope a query to only include transitions from a specific status.
     *
     * @param \Illuminate\Database\Eloquent\Builder<self> $query
     * @param string $fromStatusCode
     * @return \Illuminate\Database\Eloquent\Builder<self>
     */
    public function scopeFromStatus($query, string $fromStatusCode)
    {
        return $query->where('from_status_code', $fromStatusCode);
    }

    /**
     * Scope a query to only include transitions to a specific status.
     *
     * @param \Illuminate\Database\Eloquent\Builder<self> $query
     * @param string $toStatusCode
     * @return \Illuminate\Database\Eloquent\Builder<self>
     */
    public function scopeToStatus($query, string $toStatusCode)
    {
        return $query->where('to_status_code', $toStatusCode);
    }

    /**
     * Check if a user role can execute this transition.
     *
     * @param string $role
     * @return bool
     */
    public function canExecute(string $role): bool
    {
        $allowedRoles = $this->allowed_roles ?? ['all'];
        
        // If 'all' is in allowed roles, anyone can execute
        if (in_array('all', $allowedRoles, true)) {
            return true;
        }
        
        return in_array($role, $allowedRoles, true);
    }

    /**
     * Check if this is an auto transition.
     *
     * @return bool
     */
    public function isAutoTransition(): bool
    {
        return ($this->transition_config['auto'] ?? false) === true;
    }

    /**
     * Get required fields for this transition.
     *
     * @return array<int, string>
     */
    public function getRequiredFields(): array
    {
        return $this->required_fields ?? [];
    }

    /**
     * Get transition config value.
     *
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    public function getConfigValue(string $key, mixed $default = null): mixed
    {
        return $this->transition_config[$key] ?? $default;
    }

    /**
     * Check if transition has a specific config key.
     *
     * @param string $key
     * @return bool
     */
    public function hasConfig(string $key): bool
    {
        return isset($this->transition_config[$key]);
    }

    /**
     * Get the display name for from_status.
     *
     * @return string
     */
    public function getFromStatusNameAttribute(): string
    {
        // Mapping từ status code → tên tiếng Việt
        $statusNames = [
            'new_intake' => 'Tiếp nhận',
            'assigned_to_receiver' => 'Giao R thực hiện',
            'pending_dispatch' => 'Giao PM/Trả YC cho PM',
            'receiver_in_progress' => 'R Đang thực hiện',
            'not_executed' => 'Không tiếp nhận',
            'waiting_customer_feedback' => 'Chờ khách hàng cung cấp thông tin',
            'analysis' => 'Chuyển BA Phân tích',
            'analysis_completed' => 'Chuyển BA Phân tích hoàn thành',
            'analysis_suspended' => 'Chuyển BA Phân tích tạm ngưng',
            'dms_transfer' => 'Chuyển DMS',
            'dms_task_created' => 'Tạo task',
            'dms_in_progress' => 'DMS Đang thực hiện',
            'dms_suspended' => 'DMS tạm ngưng',
            'coding' => 'Lập trình',
            'coding_in_progress' => 'Dev đang thực hiện',
            'coding_suspended' => 'Dev tạm ngưng',
            'completed' => 'Hoàn thành',
            'customer_notified' => 'Thông báo khách hàng',
        ];
        
        return $statusNames[$this->from_status_code] ?? $this->from_status_code;
    }

    /**
     * Get the display name for to_status.
     *
     * @return string
     */
    public function getToStatusNameAttribute(): string
    {
        // Mapping từ status code → tên tiếng Việt
        $statusNames = [
            'new_intake' => 'Tiếp nhận',
            'assigned_to_receiver' => 'Giao R thực hiện',
            'pending_dispatch' => 'Giao PM/Trả YC cho PM',
            'receiver_in_progress' => 'R Đang thực hiện',
            'not_executed' => 'Không tiếp nhận',
            'waiting_customer_feedback' => 'Chờ khách hàng cung cấp thông tin',
            'analysis' => 'Chuyển BA Phân tích',
            'analysis_completed' => 'Chuyển BA Phân tích hoàn thành',
            'analysis_suspended' => 'Chuyển BA Phân tích tạm ngưng',
            'dms_transfer' => 'Chuyển DMS',
            'dms_task_created' => 'Tạo task',
            'dms_in_progress' => 'DMS Đang thực hiện',
            'dms_suspended' => 'DMS tạm ngưng',
            'coding' => 'Lập trình',
            'coding_in_progress' => 'Dev đang thực hiện',
            'coding_suspended' => 'Dev tạm ngưng',
            'completed' => 'Hoàn thành',
            'customer_notified' => 'Thông báo khách hàng',
        ];
        
        return $statusNames[$this->to_status_code] ?? $this->to_status_code;
    }

    /**
     * Get full transition data with workflow info.
     *
     * @return array<string, mixed>
     */
    public function getFullData(): array
    {
        return [
            'id' => $this->id,
            'workflow_definition_id' => $this->workflow_definition_id,
            'from_status_code' => $this->from_status_code,
            'from_status_name' => $this->from_status_name,
            'to_status_code' => $this->to_status_code,
            'to_status_name' => $this->to_status_name,
            'allowed_roles' => $this->allowed_roles,
            'required_fields' => $this->required_fields,
            'transition_config' => $this->transition_config,
            'sort_order' => $this->sort_order,
            'is_active' => $this->is_active,
            'workflow' => $this->workflow ? [
                'code' => $this->workflow->code,
                'name' => $this->workflow->name,
            ] : null,
        ];
    }

    /**
     * Create a transition from Excel row data.
     *
     * @param int $workflowId
     * @param array<string, mixed> $rowData
     * @return self
     */
    public static function createFromExcelRow(int $workflowId, array $rowData): self
    {
        return static::create([
            'workflow_definition_id' => $workflowId,
            'from_status_code' => $rowData['from_status_code'],
            'to_status_code' => $rowData['to_status_code'],
            'allowed_roles' => json_decode($rowData['allowed_roles'] ?? '["all"]', true),
            'required_fields' => json_decode($rowData['required_fields'] ?? '[]', true),
            'sort_order' => (int) ($rowData['sort_order'] ?? 0),
            'is_active' => ($rowData['is_active'] ?? 'TRUE') === 'TRUE',
        ]);
    }
}
