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
        'payment_cycle',
        'status',
        'sign_date',
        'effective_date',
        'expiry_date',
        'term_unit',
        'term_value',
        'expiry_date_manual_override',
        'data_scope',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'value' => 'float',
        'sign_date' => 'date:Y-m-d',
        'effective_date' => 'date:Y-m-d',
        'expiry_date' => 'date:Y-m-d',
        'term_value' => 'float',
        'expiry_date_manual_override' => 'boolean',
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
