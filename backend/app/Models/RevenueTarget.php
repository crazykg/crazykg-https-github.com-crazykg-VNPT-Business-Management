<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class RevenueTarget extends Model
{
    use SoftDeletes;

    protected $table = 'revenue_targets';

    protected $fillable = [
        'period_type',
        'period_key',
        'period_start',
        'period_end',
        'dept_id',
        'target_type',
        'target_amount',
        'actual_amount',
        'notes',
        'approved_by',
        'approved_at',
        'data_scope',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'dept_id' => 'integer',
        'target_amount' => 'float',
        'actual_amount' => 'float',
        'period_start' => 'date:Y-m-d',
        'period_end' => 'date:Y-m-d',
        'approved_at' => 'datetime',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'dept_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'approved_by');
    }

    /**
     * Check if this target's period is still open (not yet ended).
     */
    public function isPeriodOpen(): bool
    {
        return $this->period_end >= now()->toDateString();
    }

    /**
     * Scope: only active (non-deleted) records.
     */
    public function scopeActive($query)
    {
        return $query->whereNull('deleted_at');
    }
}
