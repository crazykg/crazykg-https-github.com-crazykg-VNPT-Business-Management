<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomerRequestCase extends Model
{
    use SoftDeletes;

    protected $table = 'customer_request_cases';

    protected $fillable = [
        'request_code',
        'legacy_customer_request_id',
        'customer_id',
        'customer_personnel_id',
        'support_service_group_id',
        'project_id',
        'project_item_id',
        'product_id',
        'received_by_user_id',
        'requester_name_snapshot',
        'summary',
        'description',
        'priority',
        'source_channel',
        'current_status_code',
        'current_status_instance_id',
        'received_at',
        'completed_at',
        'reported_to_customer_at',
        'current_status_changed_at',
        'created_by',
        'updated_by',
    ];
}
