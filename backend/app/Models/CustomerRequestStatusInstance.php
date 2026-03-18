<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerRequestStatusInstance extends Model
{
    protected $table = 'customer_request_status_instances';

    protected $fillable = [
        'request_case_id',
        'status_code',
        'status_table',
        'status_row_id',
        'previous_instance_id',
        'next_instance_id',
        'entered_at',
        'exited_at',
        'is_current',
        'created_by',
        'updated_by',
    ];
}
