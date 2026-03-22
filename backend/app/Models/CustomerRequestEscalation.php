<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomerRequestEscalation extends Model
{
    use SoftDeletes;

    protected $table = 'customer_request_escalations';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'escalation_code',
        'request_case_id',
        'raised_by_user_id',
        'raised_at',
        'difficulty_type',
        'severity',
        'description',
        'impact_description',
        'blocked_since',
        'proposed_action',
        'proposed_handler_user_id',
        'proposed_additional_hours',
        'proposed_deadline_extension',
        'status',
        'reviewed_by_user_id',
        'reviewed_at',
        'resolution_decision',
        'resolution_note',
        'resolved_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'raised_at'    => 'datetime',
        'reviewed_at'  => 'datetime',
        'resolved_at'  => 'datetime',
    ];
}
