<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProgrammingRequest extends Model
{
    use SoftDeletes;

    protected $table = 'programming_requests';

    protected $fillable = [
        'uuid',
        'req_code',
        'req_name',
        'ticket_code',
        'task_link',
        'parent_id',
        'depth',
        'reference_request_id',
        'source_type',
        'req_type',
        'service_group_id',
        'support_request_id',
        'priority',
        'overall_progress',
        'status',
        'description',
        'doc_link',
        'customer_id',
        'requested_date',
        'reporter_name',
        'reporter_contact_id',
        'receiver_id',
        'project_id',
        'product_id',
        'project_item_id',
        'analyze_estimated_hours',
        'analyze_start_date',
        'analyze_end_date',
        'analyze_extend_date',
        'analyzer_id',
        'analyze_progress',
        'code_estimated_hours',
        'code_start_date',
        'code_end_date',
        'code_extend_date',
        'code_actual_date',
        'coder_id',
        'code_progress',
        'upcode_status',
        'upcode_date',
        'upcoder_id',
        'noti_status',
        'noti_date',
        'notifier_id',
        'notified_internal_id',
        'notified_customer_id',
        'noti_doc_link',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'parent_id' => 'integer',
        'depth' => 'integer',
        'reference_request_id' => 'integer',
        'service_group_id' => 'integer',
        'support_request_id' => 'integer',
        'priority' => 'integer',
        'overall_progress' => 'integer',
        'customer_id' => 'integer',
        'reporter_contact_id' => 'integer',
        'receiver_id' => 'integer',
        'project_id' => 'integer',
        'product_id' => 'integer',
        'project_item_id' => 'integer',
        'analyze_estimated_hours' => 'decimal:2',
        'analyze_progress' => 'integer',
        'code_estimated_hours' => 'decimal:2',
        'coder_id' => 'integer',
        'code_progress' => 'integer',
        'upcoder_id' => 'integer',
        'notifier_id' => 'integer',
        'notified_internal_id' => 'integer',
        'notified_customer_id' => 'integer',
        'created_by' => 'integer',
        'updated_by' => 'integer',
        'requested_date' => 'date',
        'analyze_start_date' => 'date',
        'analyze_end_date' => 'date',
        'analyze_extend_date' => 'date',
        'code_start_date' => 'date',
        'code_end_date' => 'date',
        'code_extend_date' => 'date',
        'code_actual_date' => 'date',
        'upcode_date' => 'date',
        'noti_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function serviceGroup(): BelongsTo
    {
        return $this->belongsTo(SupportServiceGroup::class, 'service_group_id');
    }

    public function reporterContact(): BelongsTo
    {
        return $this->belongsTo(CustomerPersonnel::class, 'reporter_contact_id');
    }

    public function notifiedCustomer(): BelongsTo
    {
        return $this->belongsTo(CustomerPersonnel::class, 'notified_customer_id');
    }

    public function projectItem(): BelongsTo
    {
        return $this->belongsTo(ProjectItem::class, 'project_item_id');
    }

    public function supportRequest(): BelongsTo
    {
        return $this->belongsTo(SupportRequest::class, 'support_request_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'receiver_id');
    }

    public function analyzer(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'analyzer_id');
    }

    public function coder(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'coder_id');
    }

    public function upcoder(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'upcoder_id');
    }

    public function notifier(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'notifier_id');
    }

    public function notifiedInternal(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'notified_internal_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function referenceRequest(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reference_request_id');
    }

    public function worklogs(): HasMany
    {
        return $this->hasMany(ProgrammingRequestWorklog::class, 'programming_request_id');
    }
}
