<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestCoding extends Model
{
    protected $table = 'customer_request_coding';

    protected $fillable = [
        'request_case_id',
        'status_instance_id',
        'developer_user_id',
        'coding_content',
        'coding_started_at',
        'coding_completed_at',
        'coding_phase',
        'upcode_at',
        'upcode_version',
        'upcode_environment',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'coding_started_at'   => 'datetime',
        'coding_completed_at' => 'datetime',
        'upcode_at'           => 'datetime',
    ];

    public function case(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestCase::class, 'request_case_id');
    }

    public function statusInstance(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestStatusInstance::class, 'status_instance_id');
    }

    public function developer(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'developer_user_id');
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
