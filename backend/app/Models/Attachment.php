<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attachment extends Model
{
    protected $table = 'attachments';

    protected $fillable = [
        'reference_type',
        'reference_id',
        'file_name',
        'file_url',
        'drive_file_id',
        'file_size',
        'mime_type',
        'storage_disk',
        'storage_path',
        'storage_visibility',
        'is_primary',
        'created_by',
        'updated_by',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }
}
