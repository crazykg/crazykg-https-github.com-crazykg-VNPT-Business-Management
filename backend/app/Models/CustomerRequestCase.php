<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

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
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'received_at' => 'datetime',
        'completed_at' => 'datetime',
        'reported_to_customer_at' => 'datetime',
        'current_status_changed_at' => 'datetime',
        'estimated_at' => 'datetime',
        'estimated_hours' => 'decimal:2',
        'total_hours_spent' => 'decimal:2',
    ];

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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
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
}
