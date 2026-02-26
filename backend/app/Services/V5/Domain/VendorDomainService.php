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

        $rows = Vendor::query()
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
            $rules['uuid'][] = Rule::unique('vendors', 'uuid');
        }
        if ($this->support->hasColumn('vendors', 'vendor_code')) {
            $rules['vendor_code'][] = Rule::unique('vendors', 'vendor_code');
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
            $rules['uuid'][] = Rule::unique('vendors', 'uuid')->ignore($vendor->id);
        }
        if ($this->support->hasColumn('vendors', 'vendor_code')) {
            $rules['vendor_code'][] = Rule::unique('vendors', 'vendor_code')->ignore($vendor->id);
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
