<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DepartmentWeeklyScheduleEntry extends Model
{
    protected $table = 'department_weekly_schedule_entries';

    protected $fillable = [
        'schedule_id',
        'calendar_date',
        'session',
        'sort_order',
        'work_content',
        'location',
        'participant_text',
        'created_by',
        'updated_by',
    ];

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(DepartmentWeeklySchedule::class, 'schedule_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(DepartmentWeeklyScheduleEntryParticipant::class, 'entry_id');
    }
}
