<?php

namespace App\Models;

use App\Services\V5\Domain\CustomerRequestCaseRegistry;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;

class CustomerRequestCase extends Model
{
    use SoftDeletes;

    protected $table = 'customer_request_cases';

    protected $fillable = [
        'request_code',
        'legacy_customer_request_id',
        'customer_id',
        'customer_personnel_id',
        'support_service_group_id',
        'project_id',
        'project_item_id',
        'product_id',
        'received_by_user_id',
        'dispatcher_user_id',
        'performer_user_id',
        'requester_name_snapshot',
        'summary',
        'description',
        'priority',
        'source_channel',
        'current_status_code',
        'current_status_instance_id',
        'received_at',
        'completed_at',
        'reported_to_customer_at',
        'current_status_changed_at',
        'estimated_hours',
        'estimated_by_user_id',
        'estimated_at',
        'total_hours_spent',
        'dispatch_route',
        'dispatched_at',
        'performer_accepted_at',
        'warn_70_sent',
        'warn_90_sent',
        'warn_100_sent',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'received_at' => 'datetime',
        'completed_at' => 'datetime',
        'reported_to_customer_at' => 'datetime',
        'current_status_changed_at' => 'datetime',
        'estimated_at' => 'datetime',
        'dispatched_at' => 'datetime',
        'performer_accepted_at' => 'datetime',
        'estimated_hours' => 'decimal:2',
        'total_hours_spent' => 'decimal:2',
        'warn_70_sent' => 'boolean',
        'warn_90_sent' => 'boolean',
        'warn_100_sent' => 'boolean',
    ];

    // ── Query scopes ─────────────────────────────────────────────────────────

    public function scopeByStatus(Builder $query, string $statusCode): Builder
    {
        return $query->where('current_status_code', $statusCode);
    }

    public function scopeByPerformer(Builder $query, int $userId): Builder
    {
        return $query->where('performer_user_id', $userId);
    }

    public function scopeByDispatcher(Builder $query, int $userId): Builder
    {
        return $query->where('dispatcher_user_id', $userId);
    }

    public function scopeByProject(Builder $query, int $projectId): Builder
    {
        return $query->where('project_id', $projectId);
    }

    public function scopeInGroup(Builder $query, string $group): Builder
    {
        $statuses = CustomerRequestCaseRegistry::getStatusCodesForGroup($group);
        if ($statuses === []) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('current_status_code', $statuses);
    }

    public function scopeOverdue(Builder $query): Builder
    {
        if (! Schema::hasColumn($this->getTable(), 'sla_due_date')) {
            return $query->whereRaw('1 = 0');
        }

        return $query
            ->whereNotNull('sla_due_date')
            ->where('sla_due_date', '<', now())
            ->whereNotIn('current_status_code', ['completed', 'customer_notified', 'not_executed']);
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'received_by_user_id');
    }

    public function dispatcher(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'dispatcher_user_id');
    }

    public function performer(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'performer_user_id');
    }

    /**
     * Người tiếp nhận yêu cầu từ khách hàng = canonical "creator" trong business context.
     * received_by_user_id là canonical creator field (V4 plan FIX ISSUE-2 R2).
     * Note: created_by vẫn giữ nguyên cho audit trail.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'received_by_user_id');
    }

    public function currentStatusInstance(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestStatusInstance::class, 'current_status_instance_id');
    }

    public function worklogs(): HasMany
    {
        return $this->hasMany(CustomerRequestWorklog::class, 'request_case_id');
    }

    public function estimates(): HasMany
    {
        return $this->hasMany(CustomerRequestEstimate::class, 'request_case_id');
    }

    public function pendingDispatchRows(): HasMany
    {
        return $this->hasMany(CustomerRequestPendingDispatch::class, 'request_case_id');
    }

    public function dispatchedRows(): HasMany
    {
        return $this->hasMany(CustomerRequestDispatched::class, 'request_case_id');
    }

    public function codingRows(): HasMany
    {
        return $this->hasMany(CustomerRequestCoding::class, 'request_case_id');
    }

    public function dmsTransferRows(): HasMany
    {
        return $this->hasMany(CustomerRequestDmsTransfer::class, 'request_case_id');
    }
}
