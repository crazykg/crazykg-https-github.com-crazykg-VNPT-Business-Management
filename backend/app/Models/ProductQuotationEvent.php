<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductQuotationEvent extends Model
{
    public $timestamps = false;

    protected $table = 'product_quotation_events';

    protected $fillable = [
        'quotation_id',
        'version_id',
        'version_no',
        'event_type',
        'event_status',
        'template_key',
        'filename',
        'content_hash',
        'metadata',
        'url',
        'ip_address',
        'user_agent',
        'created_by',
        'created_at',
    ];

    protected $casts = [
        'version_no' => 'integer',
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(ProductQuotation::class, 'quotation_id');
    }

    public function version(): BelongsTo
    {
        return $this->belongsTo(ProductQuotationVersion::class, 'version_id');
    }
}
