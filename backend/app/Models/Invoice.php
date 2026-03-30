<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use SoftDeletes;

    protected $table = 'invoices';

    protected $fillable = [
        'invoice_code',
        'invoice_series',
        'contract_id',
        'customer_id',
        'project_id',
        'invoice_date',
        'due_date',
        'period_from',
        'period_to',
        'subtotal',
        'vat_rate',
        'vat_amount',
        'total_amount',
        'paid_amount',
        'status',
        'notes',
        'data_scope',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'invoice_date' => 'date:Y-m-d',
        'due_date'     => 'date:Y-m-d',
        'period_from'  => 'date:Y-m-d',
        'period_to'    => 'date:Y-m-d',
        'subtotal'     => 'float',
        'vat_rate'     => 'float',
        'vat_amount'   => 'float',
        'total_amount' => 'float',
        'paid_amount'  => 'float',
    ];

    // ── Computed attributes ────────────────────────────────────────────────────

    /**
     * outstanding = total_amount - paid_amount
     * Computed in PHP (not a DB GENERATED column) for MySQL version compatibility.
     */
    public function getOutstandingAttribute(): float
    {
        return round(($this->total_amount ?? 0) - ($this->paid_amount ?? 0), 2);
    }

    /**
     * is_overdue = due_date < today AND outstanding > 0 AND status not terminal
     * Query-time evaluation only — NEVER persisted as a status value.
     */
    public function getIsOverdueAttribute(): bool
    {
        if (in_array($this->status, ['PAID', 'CANCELLED', 'VOID', 'DRAFT'], true)) {
            return false;
        }

        return $this->due_date !== null
            && $this->due_date->lt(now()->startOfDay())
            && $this->outstanding > 0;
    }

    // ── Query scopes ─────────────────────────────────────────────────────────

    public function scopeOverdue(Builder $query): Builder
    {
        return $query
            ->whereDate('due_date', '<', now()->toDateString())
            ->whereRaw('(COALESCE(total_amount, 0) - COALESCE(paid_amount, 0)) > 0')
            ->whereNotIn('status', ['PAID', 'CANCELLED', 'VOID', 'DRAFT']);
    }

    public function scopeByStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    public function scopeByPeriod(Builder $query, string $from, string $to): Builder
    {
        return $query->whereBetween('invoice_date', [$from, $to]);
    }

    public function scopeByCustomer(Builder $query, int $customerId): Builder
    {
        return $query->where('customer_id', $customerId);
    }

    public function scopeByContract(Builder $query, int $contractId): Builder
    {
        return $query->where('contract_id', $contractId);
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class, 'invoice_id')->orderBy('sort_order');
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(Receipt::class, 'invoice_id');
    }

    public function dunningLogs(): HasMany
    {
        return $this->hasMany(DunningLog::class, 'invoice_id')->orderByDesc('sent_at');
    }
}
