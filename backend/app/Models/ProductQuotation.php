<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductQuotation extends Model
{
    use SoftDeletes;

    protected $table = 'product_quotations';

    protected $fillable = [
        'uuid',
        'customer_id',
        'recipient_name',
        'sender_city',
        'quote_date',
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
        'latest_version_no',
        'last_printed_at',
        'last_printed_by',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'quote_date' => 'date:Y-m-d',
        'vat_rate' => 'float',
        'subtotal' => 'float',
        'vat_amount' => 'float',
        'total_amount' => 'float',
        'uses_multi_vat_template' => 'boolean',
        'latest_version_no' => 'integer',
        'last_printed_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ProductQuotationItem::class, 'quotation_id')->orderBy('sort_order')->orderBy('id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(ProductQuotationVersion::class, 'quotation_id')->orderByDesc('version_no');
    }

    public function events(): HasMany
    {
        return $this->hasMany(ProductQuotationEvent::class, 'quotation_id')->orderByDesc('created_at')->orderByDesc('id');
    }
}
