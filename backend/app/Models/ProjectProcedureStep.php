<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectProcedureStep extends Model
{
    protected $table = 'project_procedure_steps';

    protected $fillable = [
        'procedure_id',
        'template_step_id',
        'step_number',
        'parent_step_id',
        'phase',
        'phase_label',
        'step_name',
        'step_detail',
        'lead_unit',
        'support_unit',
        'expected_result',
        'duration_days',
        'progress_status',
        'document_number',
        'document_date',
        'actual_start_date',
        'actual_end_date',
        'step_notes',
        'sort_order',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'document_date'     => 'date:Y-m-d',
        'actual_start_date' => 'date:Y-m-d',
        'actual_end_date'   => 'date:Y-m-d',
    ];

    public function procedure(): BelongsTo
    {
        return $this->belongsTo(ProjectProcedure::class, 'procedure_id');
    }

    public function templateStep(): BelongsTo
    {
        return $this->belongsTo(ProjectProcedureTemplateStep::class, 'template_step_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_step_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_step_id')->orderBy('sort_order');
    }

    public function worklogs(): HasMany
    {
        return $this->hasMany(ProjectProcedureStepWorklog::class, 'step_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(Attachment::class, 'reference_id')
                    ->where('reference_type', 'PROCEDURE_STEP')
                    ->orderBy('created_at', 'desc');
    }
}
