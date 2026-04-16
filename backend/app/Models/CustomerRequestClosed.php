<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestClosed extends Model
{
    protected $table = 'customer_request_closed';

    protected $fillable = [
        'request_case_id',
        'status_instance_id',
        'closed_by_user_id',
        'closed_at',
        'closure_reason',
        'closure_notes',
        'customer_satisfaction',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'closed_at' => 'datetime',
    ];

    public function case(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestCase::class, 'request_case_id');
    }

    public function statusInstance(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestStatusInstance::class, 'status_instance_id');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'closed_by_user_id');
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
