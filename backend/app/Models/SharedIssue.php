<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SharedIssue extends Model
{
    use SoftDeletes;

    protected $table = 'shared_issues';

    public const STATUSES = ['JUST_ENCOUNTERED', 'IN_PROGRESS', 'RESOLVED'];

    protected $fillable = [
        'procedure_step_worklog_id',
        'issue_content',
        'proposal_content',
        'issue_status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function worklog(): BelongsTo
    {
        return $this->belongsTo(ProjectProcedureStepWorklog::class, 'procedure_step_worklog_id');
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
