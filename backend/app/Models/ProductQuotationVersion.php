<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductQuotationVersion extends Model
{
    public $timestamps = false;

    protected $table = 'product_quotation_versions';

    protected $fillable = [
        'quotation_id',
        'version_no',
        'template_key',
        'status',
        'filename',
        'quote_date',
        'recipient_name',
        'sender_city',
        'scope_summary',
        'vat_rate',
        'validity_days',
        'notes_text',
        'contact_line',
        'closing_message',
        'signatory_title',
        'signatory_unit',
        'signatory_name',
        'subtotal',
        'vat_amount',
        'total_amount',
        'total_in_words',
        'uses_multi_vat_template',
        'content_hash',
        'printed_at',
        'printed_by',
        'metadata',
        'created_at',
    ];

    protected $casts = [
        'version_no' => 'integer',
        'quote_date' => 'date:Y-m-d',
        'vat_rate' => 'float',
        'validity_days' => 'integer',
        'subtotal' => 'float',
        'vat_amount' => 'float',
        'total_amount' => 'float',
        'uses_multi_vat_template' => 'boolean',
        'printed_at' => 'datetime',
        'created_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(ProductQuotation::class, 'quotation_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ProductQuotationVersionItem::class, 'version_id')->orderBy('sort_order')->orderBy('id');
    }
}
