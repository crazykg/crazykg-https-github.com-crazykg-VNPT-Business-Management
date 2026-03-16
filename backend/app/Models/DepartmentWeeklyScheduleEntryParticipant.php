<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DepartmentWeeklyScheduleEntryParticipant extends Model
{
    protected $table = 'department_weekly_schedule_entry_participants';

    protected $fillable = [
        'entry_id',
        'user_id',
        'participant_name_snapshot',
        'sort_order',
    ];

    public function entry(): BelongsTo
    {
        return $this->belongsTo(DepartmentWeeklyScheduleEntry::class, 'entry_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'user_id');
    }
}
