<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Employee extends Model
{
    protected $table = 'employees';

    protected $fillable = [
        'uuid',
        'username',
        'full_name',
        'email',
        'status',
        'department_id',
        'position_id',
        'data_scope',
        'created_by',
        'updated_by',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }
}

