<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestEstimate extends Model
{
    protected $table = 'customer_request_estimates';

    protected $fillable = [
        'request_case_id',
        'status_instance_id',
        'status_code',
        'estimated_hours',
        'estimate_type',
        'estimate_scope',
        'phase_label',
        'note',
        'estimated_by_user_id',
        'estimated_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'estimated_hours' => 'decimal:2',
        'estimated_at' => 'datetime',
    ];

    public function case(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestCase::class, 'request_case_id');
    }

    public function statusInstance(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestStatusInstance::class, 'status_instance_id');
    }

    public function estimatedBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'estimated_by_user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'updated_by');
    }
}
