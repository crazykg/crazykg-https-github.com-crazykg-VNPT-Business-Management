<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomerRequestPlan extends Model
{
    use SoftDeletes;

    protected $table = 'customer_request_plans';

    protected $fillable = [
        'plan_code',
        'plan_type',
        'period_start',
        'period_end',
        'dispatcher_user_id',
        'status',
        'note',
        'total_planned_hours',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'total_planned_hours' => 'float',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(CustomerRequestPlanItem::class, 'plan_id');
    }

    public function dispatcher(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'dispatcher_user_id');
    }
}
