<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RevenueSnapshot extends Model
{
    protected $table = 'revenue_snapshots';

    protected $fillable = [
        'period_type',
        'period_key',
        'dimension_type',
        'dimension_id',
        'dimension_label',
        'contract_expected',
        'contract_collected',
        'contract_outstanding',
        'contract_count',
        'invoice_issued',
        'invoice_collected',
        'invoice_outstanding',
        'invoice_count',
        'total_expected',
        'total_collected',
        'total_outstanding',
        'target_amount',
        'achievement_pct',
        'snapshot_at',
    ];

    protected $casts = [
        'dimension_id' => 'integer',
        'contract_expected' => 'float',
        'contract_collected' => 'float',
        'contract_outstanding' => 'float',
        'contract_count' => 'integer',
        'invoice_issued' => 'float',
        'invoice_collected' => 'float',
        'invoice_outstanding' => 'float',
        'invoice_count' => 'integer',
        'total_expected' => 'float',
        'total_collected' => 'float',
        'total_outstanding' => 'float',
        'target_amount' => 'float',
        'achievement_pct' => 'float',
        'snapshot_at' => 'datetime',
    ];
}
