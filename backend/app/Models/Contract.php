<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Contract extends Model
{
    use SoftDeletes;

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
        'parent_contract_id',
        'addendum_type',
        'gap_days',
        'continuity_status',
        'penalty_rate',
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
        'gap_days' => 'integer',
        'penalty_rate' => 'float',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function parentContract(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_contract_id');
    }

    public function childContracts(): HasMany
    {
        return $this->hasMany(self::class, 'parent_contract_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ContractItem::class, 'contract_id');
    }
}
