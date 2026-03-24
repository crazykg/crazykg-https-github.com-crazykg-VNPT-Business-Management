<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractItem extends Model
{
    protected $table = 'contract_items';

    protected $fillable = [
        'contract_id',
        'product_id',
        'quantity',
        'unit_price',
        'vat_rate',
        'vat_amount',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'quantity' => 'float',
        'unit_price' => 'float',
        'vat_rate' => 'float',
        'vat_amount' => 'float',
    ];

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
