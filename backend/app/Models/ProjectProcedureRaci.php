<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectProcedureRaci extends Model
{
    protected $table = 'project_procedure_raci';

    protected $fillable = [
        'procedure_id',
        'user_id',
        'raci_role',
        'note',
        'created_by',
        'updated_by',
    ];

    public function procedure(): BelongsTo
    {
        return $this->belongsTo(ProjectProcedure::class, 'procedure_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'user_id');
    }
}
