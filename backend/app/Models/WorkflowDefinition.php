<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

/**
 * Class WorkflowDefinition
 * 
 * Model đại diện cho định nghĩa workflow (luồng xử lý)
 * 
 * @package App\Models
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property string $process_type
 * @property bool $is_active
 * @property bool $is_default
 * @property string $version
 * @property array|null $config
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $activated_at
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 */
class WorkflowDefinition extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'workflow_definitions';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'code',
        'name',
        'description',
        'process_type',
        'is_active',
        'is_default',
        'version',
        'config',
        'created_by',
        'updated_by',
        'activated_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'config' => 'array',
        'activated_at' => 'datetime',
    ];

    /**
     * The model's default values for attributes.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'process_type' => 'customer_request',
        'is_active' => false,
        'is_default' => false,
        'version' => '1.0',
    ];

    /**
     * Get the transitions for the workflow.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany<\App\Models\WorkflowTransition>
     */
    public function transitions(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class, 'workflow_definition_id');
    }

    /**
     * Get only active transitions.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany<\App\Models\WorkflowTransition>
     */
    public function activeTransitions(): HasMany
    {
        return $this->transitions()->where('is_active', true);
    }

    /**
     * Get the creator of the workflow.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<\App\Models\InternalUser, self>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }

    /**
     * Get the updater of the workflow.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<\App\Models\InternalUser, self>
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'updated_by');
    }

    /**
     * Scope a query to only include active workflows.
     *
     * @param \Illuminate\Database\Eloquent\Builder<self> $query
     * @param string|null $processType
     * @return \Illuminate\Database\Eloquent\Builder<self>
     */
    public function scopeActive($query, ?string $processType = null)
    {
        $query->where('is_active', true);
        
        if ($processType !== null) {
            $query->where('process_type', $processType);
        }
        
        return $query;
    }

    /**
     * Scope a query to only include default workflows.
     *
     * @param \Illuminate\Database\Eloquent\Builder<self> $query
     * @param string|null $processType
     * @return \Illuminate\Database\Eloquent\Builder<self>
     */
    public function scopeDefault($query, ?string $processType = null)
    {
        $query->where('is_default', true);
        
        if ($processType !== null) {
            $query->where('process_type', $processType);
        }
        
        return $query;
    }

    /**
     * Scope a query to only include workflows for a specific process type.
     *
     * @param \Illuminate\Database\Eloquent\Builder<self> $query
     * @param string $processType
     * @return \Illuminate\Database\Eloquent\Builder<self>
     */
    public function scopeForProcessType($query, string $processType)
    {
        return $query->where('process_type', $processType);
    }

    /**
     * Get transitions for a specific from_status_code.
     *
     * @param string $fromStatusCode
     * @return \Illuminate\Database\Eloquent\Collection<int, WorkflowTransition>
     */
    public function getTransitionsFrom(string $fromStatusCode)
    {
        return $this->activeTransitions()
            ->where('from_status_code', $fromStatusCode)
            ->orderBy('sort_order')
            ->get();
    }

    /**
     * Check if a transition is allowed.
     *
     * @param string $fromStatusCode
     * @param string $toStatusCode
     * @return bool
     */
    public function isTransitionAllowed(string $fromStatusCode, string $toStatusCode): bool
    {
        return $this->activeTransitions()
            ->where('from_status_code', $fromStatusCode)
            ->where('to_status_code', $toStatusCode)
            ->exists();
    }

    /**
     * Get allowed roles for a transition.
     *
     * @param string $fromStatusCode
     * @param string $toStatusCode
     * @return array<int, string>|null
     */
    public function getAllowedRoles(string $fromStatusCode, string $toStatusCode): ?array
    {
        $transition = $this->activeTransitions()
            ->where('from_status_code', $fromStatusCode)
            ->where('to_status_code', $toStatusCode)
            ->first();
        
        return $transition?->allowed_roles;
    }

    /**
     * Activate this workflow and deactivate all others of the same process type.
     *
     * @return bool
     */
    public function activate(): bool
    {
        return DB::transaction(function () {
            // Deactivate all other workflows of the same process type
            static::where('process_type', $this->process_type)
                ->where('id', '!=', $this->id)
                ->update([
                    'is_active' => false,
                    'updated_at' => now(),
                ]);

            // Activate this workflow
            $this->update([
                'is_active' => true,
                'activated_at' => now(),
            ]);

            return true;
        });
    }

    /**
     * Deactivate this workflow.
     *
     * @return bool
     */
    public function deactivate(): bool
    {
        return $this->update([
            'is_active' => false,
            'activated_at' => null,
        ]);
    }

    /**
     * Get the active workflow for a process type.
     *
     * @param string $processType
     * @return self|null
     */
    public static function getActiveForProcessType(string $processType): ?self
    {
        return static::where('process_type', $processType)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Get the default workflow for a process type.
     *
     * @param string $processType
     * @return self|null
     */
    public static function getDefaultForProcessType(string $processType): ?self
    {
        return static::where('process_type', $processType)
            ->where('is_default', true)
            ->first();
    }

    /**
     * Get full workflow data with transitions.
     *
     * @return array<string, mixed>
     */
    public function getFullData(): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'process_type' => $this->process_type,
            'is_active' => $this->is_active,
            'is_default' => $this->is_default,
            'version' => $this->version,
            'config' => $this->config,
            'activated_at' => $this->activated_at,
            'transitions' => $this->activeTransitions()
                ->orderBy('sort_order')
                ->get()
                ->map(fn (WorkflowTransition $t) => $t->getFullData())
                ->toArray(),
        ];
    }
}
