<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ProjectProcedureStepWorklog extends Model
{
    protected $table = 'project_procedure_step_worklogs';

    protected $fillable = [
        'step_id',
        'procedure_id',
        'log_type',
        'content',
        'old_value',
        'new_value',
        'created_by',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function step(): BelongsTo
    {
        return $this->belongsTo(ProjectProcedureStep::class, 'step_id');
    }

    public function procedure(): BelongsTo
    {
        return $this->belongsTo(ProjectProcedure::class, 'procedure_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }

    public function timesheet(): HasOne
    {
        return $this->hasOne(SharedTimesheet::class, 'procedure_step_worklog_id');
    }

    public function issue(): HasOne
    {
        return $this->hasOne(SharedIssue::class, 'procedure_step_worklog_id');
    }
}
