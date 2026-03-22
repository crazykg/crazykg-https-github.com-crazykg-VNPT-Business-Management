<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LeadershipDirective extends Model
{
    use SoftDeletes;

    protected $table = 'leadership_directives';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'directive_code',
        'issued_by_user_id',
        'assigned_to_user_id',
        'cc_user_ids',
        'directive_type',
        'content',
        'priority',
        'source_type',
        'source_escalation_id',
        'linked_case_ids',
        'deadline',
        'status',
        'acknowledged_at',
        'completed_at',
        'completion_note',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'cc_user_ids'      => 'array',
        'linked_case_ids'  => 'array',
        'acknowledged_at'  => 'datetime',
        'completed_at'     => 'datetime',
    ];
}
