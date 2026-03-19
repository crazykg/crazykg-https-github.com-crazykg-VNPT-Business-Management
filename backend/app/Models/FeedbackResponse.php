<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class FeedbackResponse extends Model
{
    use SoftDeletes;

    protected $table = 'feedback_responses';

    protected $fillable = [
        'feedback_id',
        'content',
        'is_admin_response',
        'created_by',
    ];

    protected $casts = [
        'is_admin_response' => 'boolean',
    ];

    public function feedbackRequest(): BelongsTo
    {
        return $this->belongsTo(FeedbackRequest::class, 'feedback_id');
    }
}
