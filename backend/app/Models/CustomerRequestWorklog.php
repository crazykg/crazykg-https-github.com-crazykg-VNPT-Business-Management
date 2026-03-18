<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerRequestWorklog extends Model
{
    protected $table = 'customer_request_worklogs';

    protected $fillable = [
        'request_case_id',
        'status_instance_id',
        'status_code',
        'performed_by_user_id',
        'work_content',
        'work_started_at',
        'work_ended_at',
        'hours_spent',
        'created_by',
        'updated_by',
    ];
}
