<?php

namespace App\Services\V5\Domain;

use App\Models\Vendor;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class VendorDomainService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('vendors')) {
            return $this->support->missingTable('vendors');
        }

        $query = Vendor::query()
            ->select($this->support->selectColumns('vendors', [
                'id',
                'uuid',
                'vendor_code',
                'vendor_name',
                'data_scope',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('id')
        ;

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                if ($this->support->hasColumn('vendors', 'vendor_code')) {
                    $builder->orWhere('vendors.vendor_code', 'like', $like);
                }
                if ($this->support->hasColumn('vendors', 'vendor_name')) {
                    $builder->orWhere('vendors.vendor_name', 'like', $like);
                }
            });
        }

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (Vendor $vendor): array => $this->support->serializeVendor($vendor))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Vendor $vendor): array => $this->support->serializeVendor($vendor))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (Vendor $vendor): array => $this->support->serializeVendor($vendor))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('vendors')) {
            return $this->support->missingTable('vendors');
        }

        $rules = [
            'uuid' => ['nullable', 'string', 'max:100'],
            'vendor_code' => ['required', 'string', 'max:100'],
            'vendor_name' => ['required', 'string', 'max:255'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->support->hasColumn('vendors', 'uuid')) {
            $uniqueRule = Rule::unique('vendors', 'uuid');
            if ($this->support->hasColumn('vendors', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['uuid'][] = $uniqueRule;
        }
        if ($this->support->hasColumn('vendors', 'vendor_code')) {
            $uniqueRule = Rule::unique('vendors', 'vendor_code');
            if ($this->support->hasColumn('vendors', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['vendor_code'][] = $uniqueRule;
        }

        $validated = $request->validate($rules);

        $vendor = new Vendor();
        $uuid = $validated['uuid'] ?? (string) Str::uuid();
        $this->support->setAttributeIfColumn($vendor, 'vendors', 'uuid', $uuid);
        $this->support->setAttributeIfColumn($vendor, 'vendors', 'vendor_code', $validated['vendor_code']);
        $this->support->setAttributeIfColumn($vendor, 'vendors', 'vendor_name', $validated['vendor_name']);

        if ($this->support->hasColumn('vendors', 'data_scope')) {
            $this->support->setAttributeIfColumn($vendor, 'vendors', 'data_scope', $validated['data_scope'] ?? null);
        }

        $vendor->save();

        return response()->json(['data' => $this->support->serializeVendor($vendor)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('vendors')) {
            return $this->support->missingTable('vendors');
        }

        $vendor = Vendor::query()->findOrFail($id);

        $rules = [
            'uuid' => ['sometimes', 'nullable', 'string', 'max:100'],
            'vendor_code' => ['sometimes', 'required', 'string', 'max:100'],
            'vendor_name' => ['sometimes', 'required', 'string', 'max:255'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->support->hasColumn('vendors', 'uuid')) {
            $uniqueRule = Rule::unique('vendors', 'uuid')->ignore($vendor->id);
            if ($this->support->hasColumn('vendors', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['uuid'][] = $uniqueRule;
        }
        if ($this->support->hasColumn('vendors', 'vendor_code')) {
            $uniqueRule = Rule::unique('vendors', 'vendor_code')->ignore($vendor->id);
            if ($this->support->hasColumn('vendors', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['vendor_code'][] = $uniqueRule;
        }

        $validated = $request->validate($rules);

        if (array_key_exists('uuid', $validated)) {
            $this->support->setAttributeIfColumn($vendor, 'vendors', 'uuid', $validated['uuid']);
        }
        if (array_key_exists('vendor_code', $validated)) {
            $this->support->setAttributeIfColumn($vendor, 'vendors', 'vendor_code', $validated['vendor_code']);
        }
        if (array_key_exists('vendor_name', $validated)) {
            $this->support->setAttributeIfColumn($vendor, 'vendors', 'vendor_name', $validated['vendor_name']);
        }
        if ($this->support->hasColumn('vendors', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->support->setAttributeIfColumn($vendor, 'vendors', 'data_scope', $validated['data_scope']);
        }

        $vendor->save();

        return response()->json(['data' => $this->support->serializeVendor($vendor)]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('vendors')) {
            return $this->support->missingTable('vendors');
        }

        $vendor = Vendor::query()->findOrFail($id);

        return $this->accessAudit->deleteModel($request, $vendor, 'Vendor');
    }
}
