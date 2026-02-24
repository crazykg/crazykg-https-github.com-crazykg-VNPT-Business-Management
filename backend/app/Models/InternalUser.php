<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InternalUser extends Model
{
    protected $table = 'internal_users';

    protected $fillable = [
        'uuid',
        'user_code',
        'username',
        'password',
        'full_name',
        'email',
        'status',
        'department_id',
        'position_id',
        'job_title_raw',
        'date_of_birth',
        'gender',
        'vpn_status',
        'ip_address',
        'created_by',
        'updated_by',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class, 'position_id');
    }
}
