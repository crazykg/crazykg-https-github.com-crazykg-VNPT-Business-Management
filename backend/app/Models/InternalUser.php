<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class InternalUser extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'internal_users';

    protected $fillable = [
        'uuid',
        'user_code',
        'username',
        'password',
        'full_name',
        'email',
        'gmail',
        'status',
        'department_id',
        'position_id',
        'job_title_raw',
        'date_of_birth',
        'leave_date',
        'telechatbot',
        'gender',
        'vpn_status',
        'ip_address',
        'created_by',
        'updated_by',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class, 'position_id');
    }

    public function partyProfile(): HasOne
    {
        return $this->hasOne(EmployeePartyProfile::class, 'employee_id');
    }
}
