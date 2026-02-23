<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Opportunity extends Model
{
    protected $table = 'opportunities';

    protected $fillable = [
        'opp_name',
        'customer_id',
        'amount',
        'stage',
        'data_scope',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'amount' => 'float',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}

