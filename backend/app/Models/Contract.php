<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Contract extends Model
{
    protected $table = 'contracts';

    protected $fillable = [
        'contract_code',
        'contract_name',
        'customer_id',
        'project_id',
        'value',
        'status',
        'data_scope',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'value' => 'float',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }
}

