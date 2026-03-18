<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProjectProcedure extends Model
{
    use SoftDeletes;

    protected $table = 'project_procedures';

    protected $fillable = [
        'project_id',
        'template_id',
        'procedure_name',
        'overall_progress',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'overall_progress' => 'decimal:2',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(ProjectProcedureTemplate::class, 'template_id');
    }

    public function steps(): HasMany
    {
        return $this->hasMany(ProjectProcedureStep::class, 'procedure_id')
            ->orderBy('sort_order');
    }

    public function recalculateProgress(): void
    {
        $row = $this->steps()
            ->selectRaw('COUNT(*) as total, SUM(progress_status = "HOAN_THANH") as completed')
            ->first();

        $this->update([
            'overall_progress' => ($row && $row->total > 0)
                ? round(($row->completed / $row->total) * 100, 2)
                : 0,
        ]);
    }
}
