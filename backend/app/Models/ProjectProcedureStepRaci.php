<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectProcedureStepRaci extends Model
{
    protected $table = 'project_procedure_step_raci';

    protected $fillable = [
        'step_id',
        'user_id',
        'raci_role',
        'created_by',
    ];

    public function step(): BelongsTo
    {
        return $this->belongsTo(ProjectProcedureStep::class, 'step_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'user_id');
    }
}
