<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProgrammingRequestWorklog extends Model
{
    use SoftDeletes;

    protected $table = 'programming_request_worklogs';

    protected $fillable = [
        'programming_request_id',
        'phase',
        'content',
        'logged_date',
        'hours_estimated',
        'hours_spent',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'programming_request_id' => 'integer',
        'logged_date' => 'date',
        'hours_estimated' => 'decimal:2',
        'hours_spent' => 'decimal:2',
        'created_by' => 'integer',
        'updated_by' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function programmingRequest(): BelongsTo
    {
        return $this->belongsTo(ProgrammingRequest::class, 'programming_request_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'updated_by');
    }
}
