<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DunningLog extends Model
{
    protected $table = 'dunning_logs';
    // No SoftDeletes — dunning audit trail must be immutable

    protected $fillable = [
        'invoice_id',
        'customer_id',
        'dunning_level',
        'sent_at',
        'sent_via',
        'message',
        'response_note',
        'created_by',
    ];

    protected $casts = [
        'sent_at'       => 'datetime',
        'dunning_level' => 'integer',
    ];

    // ── Relationships ──────────────────────────────────────────────────────────

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}
