<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    protected $table = 'invoice_items';
    // No SoftDeletes — sync uses hard-delete + re-insert (same pattern as ContractItem)

    protected $fillable = [
        'invoice_id',
        'product_id',
        'description',
        'unit',
        'quantity',
        'unit_price',
        'vat_rate',
        'payment_schedule_id',
        'sort_order',
    ];

    protected $casts = [
        'quantity'   => 'float',
        'unit_price' => 'float',
        'vat_rate'   => 'float',
        'sort_order' => 'integer',
    ];

    // ── Computed attributes ────────────────────────────────────────────────────

    public function getLineTotalAttribute(): float
    {
        return round(($this->quantity ?? 0) * ($this->unit_price ?? 0), 2);
    }

    public function getVatAmountAttribute(): float
    {
        return round($this->line_total * (($this->vat_rate ?? 0) / 100), 2);
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
