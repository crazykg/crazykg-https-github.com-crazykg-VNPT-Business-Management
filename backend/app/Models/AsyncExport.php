<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AsyncExport extends Model
{
    public const STATUS_QUEUED = 'QUEUED';
    public const STATUS_PROCESSING = 'PROCESSING';
    public const STATUS_DONE = 'DONE';
    public const STATUS_FAILED = 'FAILED';
    public const STATUS_EXPIRED = 'EXPIRED';

    protected $table = 'async_exports';

    protected $fillable = [
        'uuid',
        'module',
        'format',
        'status',
        'filters_json',
        'file_path',
        'file_name',
        'requested_by',
        'error_message',
        'started_at',
        'finished_at',
        'expires_at',
    ];

    protected $casts = [
        'requested_by' => 'integer',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
