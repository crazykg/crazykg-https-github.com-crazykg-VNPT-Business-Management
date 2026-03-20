<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuditLogDomainService
{
    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('audit_logs')) {
            return $this->support->missingTable('audit_logs');
        }

        $query = DB::table('audit_logs')
            ->select($this->support->selectColumns('audit_logs', [
                'id',
                'uuid',
                'event',
                'auditable_type',
                'auditable_id',
                'old_values',
                'new_values',
                'url',
                'ip_address',
                'user_agent',
                'created_at',
                'created_by',
            ]));

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                foreach (['id', 'event', 'auditable_type', 'auditable_id', 'url', 'ip_address'] as $column) {
                    if ($this->support->hasColumn('audit_logs', $column)) {
                        $builder->orWhere("audit_logs.{$column}", 'like', $like);
                    }
                }
            });
        }

        $event = strtoupper(trim((string) ($this->support->readFilterParam($request, 'event', '') ?? '')));
        if ($event !== '' && in_array($event, ['INSERT', 'UPDATE', 'DELETE', 'RESTORE'], true) && $this->support->hasColumn('audit_logs', 'event')) {
            $query->where('audit_logs.event', $event);
        }

        $sortBy = $this->support->resolveSortColumn($request, [
            'id' => 'audit_logs.id',
            'event' => 'audit_logs.event',
            'auditable_type' => 'audit_logs.auditable_type',
            'auditable_id' => 'audit_logs.auditable_id',
            'created_by' => 'audit_logs.created_by',
            'created_at' => 'audit_logs.created_at',
        ], 'audit_logs.created_at');
        $sortDir = $this->support->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'audit_logs.id' && $this->support->hasColumn('audit_logs', 'id')) {
            $query->orderBy('audit_logs.id', 'desc');
        }

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => (array) $item)
                    ->values();
                $meta = $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages());
            } else {
                $paginator = $query->paginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => (array) $item)
                    ->values();
                $meta = $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total());
            }
        } else {
            $limit = max(1, min($request->integer('limit', 200), 1000));
            $rows = $query
                ->limit($limit)
                ->get()
                ->map(fn (object $item): array => (array) $item)
                ->values();
            $meta = $this->support->buildPaginationMeta(1, $limit, (int) $rows->count());
        }

        $actorIds = $rows
            ->map(fn (array $row): ?int => $this->support->parseNullableInt($row['created_by'] ?? null))
            ->filter(fn (?int $id): bool => $id !== null)
            ->unique()
            ->values()
            ->all();

        $actorMap = $this->resolveAuditActorMap($actorIds);

        $serializedRows = $rows
            ->map(function (array $row) use ($actorMap): array {
                if (array_key_exists('old_values', $row)) {
                    $row['old_values'] = $this->decodeJsonColumnIfNeeded($row['old_values']);
                }
                if (array_key_exists('new_values', $row)) {
                    $row['new_values'] = $this->decodeJsonColumnIfNeeded($row['new_values']);
                }

                $actorId = $this->support->parseNullableInt($row['created_by'] ?? null);
                $row['actor'] = $actorId !== null ? ($actorMap[(string) $actorId] ?? null) : null;

                return $row;
            })
            ->values();

        return response()->json([
            'data' => $serializedRows,
            'meta' => $meta,
        ]);
    }

    private function decodeJsonColumnIfNeeded(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return $value;
        }

        $decoded = json_decode($value, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return $value;
        }

        return $decoded;
    }

    /**
     * @param array<int, int> $actorIds
     * @return array<string, array<string, mixed>>
     */
    private function resolveAuditActorMap(array $actorIds): array
    {
        if ($actorIds === []) {
            return [];
        }

        $actorTable = null;
        foreach (['internal_users', 'users'] as $table) {
            if ($this->support->hasTable($table)) {
                $actorTable = $table;
                break;
            }
        }

        if ($actorTable === null) {
            return [];
        }

        $columns = $this->support->selectColumns($actorTable, ['id', 'full_name', 'username', 'name']);
        if (! in_array('id', $columns, true)) {
            return [];
        }

        return DB::table($actorTable)
            ->select($columns)
            ->whereIn('id', $actorIds)
            ->get()
            ->map(function (object $record): array {
                $data = (array) $record;

                return [
                    'id' => $data['id'] ?? null,
                    'full_name' => $this->support->firstNonEmpty($data, ['full_name', 'name']),
                    'username' => $this->support->firstNonEmpty($data, ['username']),
                ];
            })
            ->filter(fn (array $record): bool => array_key_exists('id', $record) && $record['id'] !== null)
            ->keyBy(fn (array $record): string => (string) $record['id'])
            ->all();
    }
}
