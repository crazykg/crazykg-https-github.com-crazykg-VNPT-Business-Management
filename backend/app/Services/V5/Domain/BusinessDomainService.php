<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BusinessDomainService
{
    private const BUSINESS_CACHE_KEY = 'v5:business_domains:list:v2';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('business_domains')) {
            return $this->support->missingTable('business_domains');
        }

        if ($this->support->shouldPaginate($request)) {
            $query = DB::table('business_domains')
                ->select($this->support->selectColumns('business_domains', [
                    'id',
                    'domain_code',
                    'domain_name',
                    'focal_point_name',
                    'focal_point_phone',
                    'focal_point_email',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]))
                ->orderBy('id');

            $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
            if ($search !== '') {
                $like = '%'.$search.'%';
                $query->where(function ($builder) use ($like): void {
                    $builder->whereRaw('1 = 0');
                    if ($this->support->hasColumn('business_domains', 'domain_code')) {
                        $builder->orWhere('domain_code', 'like', $like);
                    }
                    if ($this->support->hasColumn('business_domains', 'domain_name')) {
                        $builder->orWhere('domain_name', 'like', $like);
                    }
                    if ($this->support->hasColumn('business_domains', 'focal_point_name')) {
                        $builder->orWhere('focal_point_name', 'like', $like);
                    }
                    if ($this->support->hasColumn('business_domains', 'focal_point_phone')) {
                        $builder->orWhere('focal_point_phone', 'like', $like);
                    }
                    if ($this->support->hasColumn('business_domains', 'focal_point_email')) {
                        $builder->orWhere('focal_point_email', 'like', $like);
                    }
                });
            }

            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => (array) $item)
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => (array) $item)
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = collect(Cache::remember(self::BUSINESS_CACHE_KEY, now()->addMinutes(30), function (): array {
            return DB::table('business_domains')
                ->select($this->support->selectColumns('business_domains', [
                    'id',
                    'domain_code',
                    'domain_name',
                    'focal_point_name',
                    'focal_point_phone',
                    'focal_point_email',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]))
                ->orderBy('id')
                ->get()
                ->map(fn (object $item): array => (array) $item)
                ->values()
                ->all();
        }));

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('business_domains')) {
            return $this->support->missingTable('business_domains');
        }

        $rules = [
            'domain_code' => ['required', 'string', 'max:50'],
            'domain_name' => ['required', 'string', 'max:100'],
            'focal_point_name' => ['nullable', 'string', 'max:255'],
            'focal_point_phone' => ['nullable', 'string', 'max:50'],
            'focal_point_email' => ['nullable', 'email:rfc', 'max:255'],
        ];

        if ($this->support->hasColumn('business_domains', 'domain_code')) {
            $rules['domain_code'][] = Rule::unique('business_domains', 'domain_code');
        }

        $validated = $request->validate($rules);

        $insertPayload = [
            'domain_code' => trim((string) $validated['domain_code']),
            'domain_name' => trim((string) $validated['domain_name']),
            'focal_point_name' => $this->support->normalizeNullableString($validated['focal_point_name'] ?? null),
            'focal_point_phone' => $this->support->normalizeNullableString($validated['focal_point_phone'] ?? null),
            'focal_point_email' => $this->support->normalizeNullableString($validated['focal_point_email'] ?? null),
        ];

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            if ($this->support->hasColumn('business_domains', 'created_by')) {
                $insertPayload['created_by'] = $actorId;
            }
            if ($this->support->hasColumn('business_domains', 'updated_by')) {
                $insertPayload['updated_by'] = $actorId;
            }
        }

        if ($this->support->hasColumn('business_domains', 'updated_at')) {
            $insertPayload['updated_at'] = now();
        }

        $insertPayload = $this->support->filterPayloadByTableColumns('business_domains', $insertPayload);
        if ($insertPayload === []) {
            throw new \RuntimeException('Không thể chuẩn bị dữ liệu lưu lĩnh vực.');
        }

        $newId = (int) DB::table('business_domains')->insertGetId($insertPayload);
        Cache::forget(self::BUSINESS_CACHE_KEY);

        $created = DB::table('business_domains')
            ->select($this->support->selectColumns('business_domains', [
                'id',
                'domain_code',
                'domain_name',
                'focal_point_name',
                'focal_point_phone',
                'focal_point_email',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $newId)
            ->first();

        return response()->json([
            'data' => $created !== null ? (array) $created : ['id' => $newId],
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('business_domains')) {
            return $this->support->missingTable('business_domains');
        }

        $business = DB::table('business_domains')->where('id', $id)->first();
        if ($business === null) {
            return response()->json(['message' => 'Business not found.'], 404);
        }

        $rules = [
            'domain_code' => ['sometimes', 'required', 'string', 'max:50'],
            'domain_name' => ['sometimes', 'required', 'string', 'max:100'],
            'focal_point_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'focal_point_phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'focal_point_email' => ['sometimes', 'nullable', 'email:rfc', 'max:255'],
        ];

        if ($this->support->hasColumn('business_domains', 'domain_code')) {
            $rules['domain_code'][] = Rule::unique('business_domains', 'domain_code')->ignore($id);
        }

        $validated = $request->validate($rules);

        $updatePayload = [];
        if (array_key_exists('domain_code', $validated)) {
            $updatePayload['domain_code'] = trim((string) $validated['domain_code']);
        }
        if (array_key_exists('domain_name', $validated)) {
            $updatePayload['domain_name'] = trim((string) $validated['domain_name']);
        }
        if (array_key_exists('focal_point_name', $validated)) {
            $updatePayload['focal_point_name'] = $this->support->normalizeNullableString($validated['focal_point_name']);
        }
        if (array_key_exists('focal_point_phone', $validated)) {
            $updatePayload['focal_point_phone'] = $this->support->normalizeNullableString($validated['focal_point_phone']);
        }
        if (array_key_exists('focal_point_email', $validated)) {
            $updatePayload['focal_point_email'] = $this->support->normalizeNullableString($validated['focal_point_email']);
        }

        if ($updatePayload !== []) {
            $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
            if ($actorId !== null && $this->support->hasColumn('business_domains', 'updated_by')) {
                $updatePayload['updated_by'] = $actorId;
            }
            if ($this->support->hasColumn('business_domains', 'updated_at')) {
                $updatePayload['updated_at'] = now();
            }

            $filteredPayload = $this->support->filterPayloadByTableColumns('business_domains', $updatePayload);
            if ($filteredPayload !== []) {
                DB::table('business_domains')
                    ->where('id', $id)
                    ->update($filteredPayload);
            }
        }

        Cache::forget(self::BUSINESS_CACHE_KEY);

        $updated = DB::table('business_domains')
            ->select($this->support->selectColumns('business_domains', [
                'id',
                'domain_code',
                'domain_name',
                'focal_point_name',
                'focal_point_phone',
                'focal_point_email',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $id)
            ->first();

        return response()->json([
            'data' => $updated !== null ? (array) $updated : (array) $business,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('business_domains')) {
            return $this->support->missingTable('business_domains');
        }

        $business = DB::table('business_domains')->where('id', $id)->first();
        if ($business === null) {
            return response()->json(['message' => 'Business not found.'], 404);
        }

        try {
            DB::table('business_domains')->where('id', $id)->delete();
            Cache::forget(self::BUSINESS_CACHE_KEY);

            return response()->json(['message' => 'Business deleted.']);
        } catch (QueryException) {
            return response()->json([
                'message' => 'Business is referenced by other records and cannot be deleted.',
            ], 422);
        }
    }
}
