<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectProcedureTemplateStep extends Model
{
    protected $table = 'project_procedure_template_steps';

    protected $fillable = [
        'template_id',
        'step_number',
        'parent_step_id',
        'phase',
        'step_name',
        'step_detail',
        'lead_unit',
        'support_unit',
        'expected_result',
        'default_duration_days',
        'sort_order',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(ProjectProcedureTemplate::class, 'template_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_step_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_step_id')->orderBy('sort_order');
    }
}
