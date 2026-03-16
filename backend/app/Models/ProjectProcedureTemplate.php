<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectProcedureTemplate extends Model
{
    protected $table = 'project_procedure_templates';

    protected $fillable = [
        'template_code',
        'template_name',
        'description',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function steps(): HasMany
    {
        return $this->hasMany(ProjectProcedureTemplateStep::class, 'template_id')
            ->orderBy('sort_order');
    }

    public function procedures(): HasMany
    {
        return $this->hasMany(ProjectProcedure::class, 'template_id');
    }
}
