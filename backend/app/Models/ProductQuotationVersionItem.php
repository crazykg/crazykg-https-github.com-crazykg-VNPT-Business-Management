<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductQuotationVersionItem extends Model
{
    public $timestamps = false;

    protected $table = 'product_quotation_version_items';

    protected $fillable = [
        'version_id',
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

    public function version(): BelongsTo
    {
        return $this->belongsTo(ProductQuotationVersion::class, 'version_id');
    }
}
