<?php

namespace App\Services\V5\SupportConfig;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductUnitMasterService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
    ) {}

    public function productUnitMasters(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('product_unit_masters')) {
            return $this->support->missingTable('product_unit_masters');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $usageByName = $this->productUnitUsageSummaryByName();
        $query = DB::table('product_unit_masters')
            ->select($this->support->selectColumns('product_unit_masters', [
                'id',
                'unit_code',
                'unit_name',
                'description',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]));

        if (! $includeInactive && $this->support->hasColumn('product_unit_masters', 'is_active')) {
            $query->where('is_active', 1);
        }

        if ($this->support->hasColumn('product_unit_masters', 'unit_name')) {
            $query->orderBy('unit_name');
        }
        if ($this->support->hasColumn('product_unit_masters', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->serializeProductUnitMasterRecord((array) $item, $usageByName))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeProductUnitMaster(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('product_unit_masters')) {
            return $this->support->missingTable('product_unit_masters');
        }

        $validated = $request->validate([
            'unit_code' => ['required', 'string', 'max:50'],
            'unit_name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $unitCode = $this->sanitizeCode((string) ($validated['unit_code'] ?? ''));
        if ($unitCode === '') {
            return response()->json(['message' => 'unit_code is invalid.'], 422);
        }
        if ($this->productUnitCodeExists($unitCode)) {
            return response()->json(['message' => 'unit_code has already been taken.'], 422);
        }

        $unitName = trim((string) ($validated['unit_name'] ?? ''));
        if ($unitName === '') {
            return response()->json(['message' => 'unit_name is required.'], 422);
        }
        if ($this->productUnitNameExists($unitName)) {
            return response()->json(['message' => 'unit_name has already been taken.'], 422);
        }

        $createdById = $this->support->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById === null) {
            $createdById = $this->accessAudit->resolveAuthenticatedUserId($request);
        }
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $payload = $this->support->filterPayloadByTableColumns('product_unit_masters', [
            'unit_code' => $unitCode,
            'unit_name' => $unitName,
            'description' => $this->support->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ]);

        if ($this->support->hasColumn('product_unit_masters', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn('product_unit_masters', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('product_unit_masters')->insertGetId($payload);
        $record = $this->loadProductUnitMasterById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Product unit master created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function updateProductUnitMaster(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('product_unit_masters')) {
            return $this->support->missingTable('product_unit_masters');
        }

        $current = DB::table('product_unit_masters')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Product unit master not found.'], 404);
        }

        $validated = $request->validate([
            'unit_code' => ['required', 'string', 'max:50'],
            'unit_name' => ['required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $unitCode = $this->sanitizeCode((string) ($validated['unit_code'] ?? ''));
        if ($unitCode === '') {
            return response()->json(['message' => 'unit_code is invalid.'], 422);
        }
        if ($this->productUnitCodeExists($unitCode, $id)) {
            return response()->json(['message' => 'unit_code has already been taken.'], 422);
        }

        $currentUnitName = trim((string) ($current->unit_name ?? ''));
        $unitName = trim((string) ($validated['unit_name'] ?? ''));
        if ($unitName === '') {
            return response()->json(['message' => 'unit_name is required.'], 422);
        }
        if ($this->productUnitNameExists($unitName, $id)) {
            return response()->json(['message' => 'unit_name has already been taken.'], 422);
        }

        $usageByName = $this->productUnitUsageSummaryByName();
        $currentUsage = $usageByName[$this->normalizeUsageKey($currentUnitName)] ?? 0;
        if ($unitName !== $currentUnitName && (int) $currentUsage > 0) {
            return response()->json(['message' => 'Khong the doi ten don vi tinh da phat sinh san pham.'], 422);
        }

        $updatedById = $this->support->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->accessAudit->resolveAuthenticatedUserId($request);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $payload = [
            'unit_code' => $unitCode,
            'unit_name' => $unitName,
        ];
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->support->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->support->filterPayloadByTableColumns('product_unit_masters', $payload);
        if ($this->support->hasColumn('product_unit_masters', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('product_unit_masters')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadProductUnitMasterById($id);
        if ($record === null) {
            return response()->json(['message' => 'Product unit master not found.'], 404);
        }

        return response()->json(['data' => $record]);
    }

    /**
     * @return array<string, int>
     */
    private function productUnitUsageSummaryByName(): array
    {
        if (! $this->support->hasTable('products') || ! $this->support->hasColumn('products', 'unit')) {
            return [];
        }

        $usageByName = [];
        DB::table('products')
            ->select($this->support->selectColumns('products', ['unit']))
            ->get()
            ->each(function (object $row) use (&$usageByName): void {
                $key = $this->normalizeUsageKey($row->unit ?? null);
                if ($key === '') {
                    return;
                }

                $usageByName[$key] = ($usageByName[$key] ?? 0) + 1;
            });

        return $usageByName;
    }

    /**
     * @param array<string, mixed> $record
     * @param array<string, int> $usageByName
     * @return array<string, mixed>
     */
    private function serializeProductUnitMasterRecord(array $record, array $usageByName = []): array
    {
        $unitName = trim((string) ($record['unit_name'] ?? ''));
        $usedInProducts = (int) ($usageByName[$this->normalizeUsageKey($unitName)] ?? 0);

        return [
            'id' => isset($record['id']) ? (int) $record['id'] : null,
            'unit_code' => $this->sanitizeCode((string) ($record['unit_code'] ?? '')),
            'unit_name' => $unitName,
            'description' => $this->support->normalizeNullableString($record['description'] ?? null),
            'is_active' => array_key_exists('is_active', $record) ? (bool) $record['is_active'] : true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $this->support->parseNullableInt($record['created_by'] ?? null),
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $this->support->parseNullableInt($record['updated_by'] ?? null),
            'used_in_products' => $usedInProducts,
            'is_name_editable' => $usedInProducts === 0,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadProductUnitMasterById(int $id): ?array
    {
        if (
            $id <= 0
            || ! $this->support->hasTable('product_unit_masters')
            || ! $this->support->hasColumn('product_unit_masters', 'id')
        ) {
            return null;
        }

        $row = DB::table('product_unit_masters')
            ->select($this->support->selectColumns('product_unit_masters', [
                'id',
                'unit_code',
                'unit_name',
                'description',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $id)
            ->first();

        if ($row === null) {
            return null;
        }

        return $this->serializeProductUnitMasterRecord((array) $row, $this->productUnitUsageSummaryByName());
    }

    private function sanitizeCode(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }

    private function productUnitCodeExists(string $unitCode, ?int $ignoreId = null): bool
    {
        if (
            $unitCode === ''
            || ! $this->support->hasTable('product_unit_masters')
            || ! $this->support->hasColumn('product_unit_masters', 'unit_code')
        ) {
            return false;
        }

        $query = DB::table('product_unit_masters')
            ->whereRaw('UPPER(TRIM(unit_code)) = ?', [$unitCode]);

        if ($ignoreId !== null && $this->support->hasColumn('product_unit_masters', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function productUnitNameExists(string $unitName, ?int $ignoreId = null): bool
    {
        if (
            $unitName === ''
            || ! $this->support->hasTable('product_unit_masters')
            || ! $this->support->hasColumn('product_unit_masters', 'unit_name')
        ) {
            return false;
        }

        $query = DB::table('product_unit_masters')
            ->whereRaw('LOWER(TRIM(unit_name)) = ?', [$this->normalizeUsageKey($unitName)]);

        if ($ignoreId !== null && $this->support->hasColumn('product_unit_masters', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function normalizeUsageKey(mixed $value): string
    {
        $trimmed = trim((string) ($value ?? ''));
        if ($trimmed === '') {
            return '';
        }

        return function_exists('mb_strtolower')
            ? mb_strtolower($trimmed, 'UTF-8')
            : strtolower($trimmed);
    }

    private function tableRowExists(string $table, ?int $id): bool
    {
        if ($id === null || $id <= 0 || ! $this->support->hasTable($table) || ! $this->support->hasColumn($table, 'id')) {
            return false;
        }

        return DB::table($table)->where('id', $id)->exists();
    }
}
