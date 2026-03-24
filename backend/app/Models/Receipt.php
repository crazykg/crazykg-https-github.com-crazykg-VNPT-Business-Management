<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Receipt extends Model
{
    use SoftDeletes;

    protected $table = 'receipts';

    protected $fillable = [
        'receipt_code',
        'invoice_id',
        'contract_id',
        'customer_id',
        'receipt_date',
        'amount',
        'payment_method',
        'bank_name',
        'bank_account',
        'transaction_ref',
        'status',
        'is_reversed',
        'is_reversal_offset',
        'original_receipt_id',
        'notes',
        'confirmed_by',
        'confirmed_at',
        'data_scope',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'receipt_date'       => 'date:Y-m-d',
        'confirmed_at'       => 'datetime',
        'amount'             => 'float',
        'is_reversed'        => 'boolean',
        'is_reversal_offset' => 'boolean',
    ];

    // ── Relationships ──────────────────────────────────────────────────────────

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function confirmedBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'confirmed_by');
    }

    /** The original receipt that this offset entry cancels (only set when is_reversal_offset = true). */
    public function originalReceipt(): BelongsTo
    {
        return $this->belongsTo(self::class, 'original_receipt_id');
    }
}
