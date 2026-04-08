<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestWaitingNotification extends Model
{
    protected $table = 'customer_request_waiting_notification';

    protected $fillable = [
        'request_case_id',
        'status_instance_id',
        'notified_by_user_id',
        'notification_channel',
        'notification_content',
        'planned_notification_at',
        'actual_notification_at',
        'customer_feedback',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'planned_notification_at' => 'datetime',
        'actual_notification_at' => 'datetime',
    ];

    public function case(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestCase::class, 'request_case_id');
    }

    public function statusInstance(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestStatusInstance::class, 'status_instance_id');
    }

    public function notifiedBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'notified_by_user_id');
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
