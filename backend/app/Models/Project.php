<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Project extends Model
{
    use SoftDeletes;

    protected $table = 'projects';

    protected $fillable = [
        'project_code',
        'project_name',
        'customer_id',
        'department_id',
        'status',
        'status_reason',
        'data_scope',
        'start_date',
        'expected_end_date',
        'actual_end_date',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'start_date'        => 'date:Y-m-d',
        'expected_end_date' => 'date:Y-m-d',
        'actual_end_date'   => 'date:Y-m-d',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Department::class, 'department_id');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'project_id');
    }
}
