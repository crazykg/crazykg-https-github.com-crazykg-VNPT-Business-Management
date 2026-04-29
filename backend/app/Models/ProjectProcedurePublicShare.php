<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectProcedurePublicShare extends Model
{
    protected $table = 'project_procedure_public_shares';

    protected $fillable = [
        'procedure_id',
        'token_hash',
        'access_key_hash',
        'created_by',
        'expires_at',
        'revoked_at',
        'last_accessed_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
        'last_accessed_at' => 'datetime',
    ];

    public function procedure(): BelongsTo
    {
        return $this->belongsTo(ProjectProcedure::class, 'procedure_id');
    }
}
