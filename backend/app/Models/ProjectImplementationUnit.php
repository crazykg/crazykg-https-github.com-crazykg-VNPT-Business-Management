<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectImplementationUnit extends Model
{
    protected $table = 'project_implementation_units';

    protected $fillable = [
        'project_id',
        'implementation_user_id',
        'implementation_user_code',
        'implementation_full_name',
        'implementation_unit_code',
        'implementation_unit_name',
        'created_by',
        'updated_by',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'implementation_user_id');
    }
}
