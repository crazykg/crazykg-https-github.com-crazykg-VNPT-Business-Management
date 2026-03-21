<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestWorklog extends Model
{
    protected $table = 'customer_request_worklogs';

    protected $fillable = [
        'request_case_id',
        'status_instance_id',
        'status_code',
        'performed_by_user_id',
        'work_content',
        'work_started_at',
        'work_ended_at',
        'work_date',
        'activity_type_code',
        'is_billable',
        'is_auto_transition',
        'transition_id',
        'hours_spent',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'work_started_at' => 'datetime',
        'work_ended_at' => 'datetime',
        'work_date' => 'date',
        'hours_spent' => 'decimal:2',
        'is_billable' => 'boolean',
        'is_auto_transition' => 'boolean',
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
        return $this->belongsTo(InternalUser::class, 'performed_by_user_id');
    }
}
