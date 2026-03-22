<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MonthlyHoursSnapshot extends Model
{
    public $timestamps = false;

    protected $table = 'monthly_hours_snapshots';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'snapshot_month',
        'user_id',
        'user_name',
        'project_id',
        'project_name',
        'customer_id',
        'customer_name',
        'total_hours',
        'billable_hours',
        'non_billable_hours',
        'estimated_hours',
        'request_count',
        'completed_count',
        'hours_by_activity',
        'created_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'total_hours'        => 'float',
        'billable_hours'     => 'float',
        'non_billable_hours' => 'float',
        'estimated_hours'    => 'float',
        'hours_by_activity'  => 'array',
    ];

    const CREATED_AT = 'created_at';

    const UPDATED_AT = null;
}
