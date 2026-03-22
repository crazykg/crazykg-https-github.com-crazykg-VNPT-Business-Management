<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestDispatched extends Model
{
    protected $table = 'customer_request_dispatched';

    protected $fillable = [
        'request_case_id',
        'status_instance_id',
        'dispatch_decision',
        'performer_user_id',
        'estimated_hours_by_dispatcher',
        'dispatch_note',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'estimated_hours_by_dispatcher' => 'decimal:2',
    ];

    public function case(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestCase::class, 'request_case_id');
    }

    public function statusInstance(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestStatusInstance::class, 'status_instance_id');
    }

    public function performer(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'performer_user_id');
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
