<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    protected $table = 'projects';

    protected $fillable = [
        'project_code',
        'project_name',
        'customer_id',
        'status',
        'data_scope',
        'created_by',
        'updated_by',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'project_id');
    }
}

