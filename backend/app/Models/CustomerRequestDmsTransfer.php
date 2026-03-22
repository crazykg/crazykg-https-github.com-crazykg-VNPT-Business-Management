<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestDmsTransfer extends Model
{
    protected $table = 'customer_request_dms_transfer';

    protected $fillable = [
        'request_case_id',
        'status_instance_id',
        'dms_contact_user_id',
        'exchange_content',
        'task_ref',
        'task_url',
        'dms_phase',
        'dms_started_at',
        'dms_completed_at',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'dms_started_at'   => 'datetime',
        'dms_completed_at' => 'datetime',
    ];

    public function case(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestCase::class, 'request_case_id');
    }

    public function statusInstance(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestStatusInstance::class, 'status_instance_id');
    }

    public function dmsContact(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'dms_contact_user_id');
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
