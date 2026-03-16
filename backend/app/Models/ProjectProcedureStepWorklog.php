<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
}
