<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductQuotationItem extends Model
{
    protected $table = 'product_quotation_items';

    protected $fillable = [
        'quotation_id',
        'sort_order',
        'product_id',
        'product_name',
        'unit',
        'quantity',
        'unit_price',
        'vat_rate',
        'vat_amount',
        'line_total',
        'total_with_vat',
        'note',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'quantity' => 'float',
        'unit_price' => 'float',
        'vat_rate' => 'float',
        'vat_amount' => 'float',
        'line_total' => 'float',
        'total_with_vat' => 'float',
    ];

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(ProductQuotation::class, 'quotation_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
