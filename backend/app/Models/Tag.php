<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Tag extends Model
{
    use SoftDeletes;

    protected $table = 'tags';

    protected $fillable = [
        'name',
        'color',
        'description',
        'usage_count',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'usage_count' => 'integer',
    ];

    /**
     * Available tag colors with their hex values
     */
    public const COLORS = [
        'blue' => '#3B82F6',
        'red' => '#EF4444',
        'green' => '#10B981',
        'yellow' => '#F59E0B',
        'purple' => '#8B5CF6',
        'pink' => '#EC4899',
        'orange' => '#F97316',
        'teal' => '#14B8A6',
        'gray' => '#6B7280',
    ];

    /**
     * Get all cases that have this tag
     */
    public function cases(): BelongsToMany
    {
        return $this->belongsToMany(CustomerRequestCase::class, 'customer_request_case_tags', 'tag_id', 'request_case_id');
    }

    /**
     * Get the user who created this tag
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }

    /**
     * Scope: Popular tags (ordered by usage count)
     */
    public function scopePopular($query, int $limit = 20)
    {
        return $query->orderByDesc('usage_count')->limit($limit);
    }

    /**
     * Scope: Search tags by name
     */
    public function scopeSearch($query, string $keyword)
    {
        return $query->where('name', 'like', "%{$keyword}%");
    }
}
