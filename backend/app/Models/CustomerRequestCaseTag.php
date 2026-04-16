<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestCaseTag extends Model
{
    protected $table = 'customer_request_case_tags';

    protected $fillable = [
        'request_case_id',
        'tag_id',
        'attached_by',
        'attached_at',
    ];

    protected $casts = [
        'attached_at' => 'datetime',
    ];

    /**
     * Get the case this tag is attached to
     */
    public function case(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestCase::class, 'request_case_id');
    }

    /**
     * Get the tag
     */
    public function tag(): BelongsTo
    {
        return $this->belongsTo(Tag::class, 'tag_id');
    }

    /**
     * Get the user who attached this tag
     */
    public function attachedBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'attached_by');
    }
}
