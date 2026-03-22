<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestPlanItem extends Model
{
    protected $table = 'customer_request_plan_items';

    protected $fillable = [
        'plan_id',
        'request_case_id',
        'performer_user_id',
        'planned_hours',
        'planned_start_date',
        'planned_end_date',
        'priority_order',
        'note',
        'actual_hours',
        'actual_status',
        'carried_to_plan_id',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'planned_hours' => 'float',
        'actual_hours' => 'float',
    ];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestPlan::class, 'plan_id');
    }

    public function requestCase(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestCase::class, 'request_case_id');
    }

    public function performer(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'performer_user_id');
    }
}
