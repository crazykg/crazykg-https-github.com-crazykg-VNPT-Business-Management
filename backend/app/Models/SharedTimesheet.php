<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SharedTimesheet extends Model
{
    protected $table = 'shared_timesheets';

    protected $fillable = [
        'procedure_step_worklog_id',
        'performed_by_user_id',
        'hours_spent',
        'work_date',
        'work_started_at',
        'work_ended_at',
        'activity_description',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'hours_spent' => 'decimal:2',
        'work_date'   => 'date:Y-m-d',
        'work_started_at' => 'datetime',
        'work_ended_at'   => 'datetime',
        'created_at'  => 'datetime',
        'updated_at'  => 'datetime',
    ];

    public function worklog(): BelongsTo
    {
        return $this->belongsTo(ProjectProcedureStepWorklog::class, 'procedure_step_worklog_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }

    public function performer(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'performed_by_user_id');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'updated_by');
    }
}
