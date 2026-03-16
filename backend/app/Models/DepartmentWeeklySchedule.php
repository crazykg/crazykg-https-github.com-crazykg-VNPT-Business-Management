<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DepartmentWeeklySchedule extends Model
{
    protected $table = 'department_weekly_schedules';

    protected $fillable = [
        'department_id',
        'week_start_date',
        'created_by',
        'updated_by',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function entries(): HasMany
    {
        return $this->hasMany(DepartmentWeeklyScheduleEntry::class, 'schedule_id');
    }
}
