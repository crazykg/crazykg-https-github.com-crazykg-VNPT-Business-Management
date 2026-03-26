<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectRevenueSchedule extends Model
{
    protected $table = 'project_revenue_schedules';

    protected $fillable = [
        'project_id',
        'cycle_number',
        'expected_date',
        'expected_amount',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'cycle_number' => 'integer',
        'expected_amount' => 'float',
        'expected_date' => 'date',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
