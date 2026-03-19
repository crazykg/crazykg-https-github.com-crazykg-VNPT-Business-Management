<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class FeedbackRequest extends Model
{
    use SoftDeletes;

    protected $table = 'feedback_requests';

    protected $fillable = [
        'uuid',
        'title',
        'description',
        'priority',
        'status',
        'created_by',
        'updated_by',
        'status_changed_by',
        'status_changed_at',
    ];

    protected $casts = [
        'status_changed_at' => 'datetime',
    ];

    public function responses(): HasMany
    {
        return $this->hasMany(FeedbackResponse::class, 'feedback_id');
    }
}
