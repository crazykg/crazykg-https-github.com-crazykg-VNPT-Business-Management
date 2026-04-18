<?php

namespace App\Services\V5\Domain;

use App\Models\Product;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Support\Facades\DB;

class ProductFeatureCatalogOwnershipService
{
    private const PRODUCT_GROUP_TABLE = 'product_feature_groups';
    private const PACKAGE_GROUP_TABLE = 'product_package_feature_groups';

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function resolveProductCatalogScope(Product $product): array
    {
        $productName = trim((string) ($product->product_name ?? ''));
        $currentProductId = (int) $product->getKey();

        if ($productName === '' || ! $this->support->hasTable('products')) {
            return $this->buildDefaultCatalogScope($product);
        }

        $selectColumns = $this->support->selectColumns('products', [
            'id',
            'product_code',
            'product_name',
            'service_group',
            'domain_id',
            'vendor_id',
            'deleted_at',
        ]);

        $query = DB::table('products')
            ->select($selectColumns)
            ->where('product_name', $productName);

        $serviceGroup = $this->support->normalizeNullableString($product->service_group ?? null);
        if ($serviceGroup !== null && $this->support->hasColumn('products', 'service_group')) {
            $query->where('service_group', $serviceGroup);
        }

        $domainId = $this->support->parseNullableInt($product->domain_id ?? null);
        if ($domainId !== null && $this->support->hasColumn('products', 'domain_id')) {
            $query->where('domain_id', $domainId);
        }

        $vendorId = $this->support->parseNullableInt($product->vendor_id ?? null);
        if ($vendorId !== null && $this->support->hasColumn('products', 'vendor_id')) {
            $query->where('vendor_id', $vendorId);
        }

        $records = $query
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values();

        if ($records->isEmpty()) {
            return $this->buildDefaultCatalogScope($product);
        }

        $activeRecords = $records->filter(function (array $record): bool {
            if (! array_key_exists('deleted_at', $record)) {
                return true;
            }

            return $record['deleted_at'] === null;
        })->values();

        $catalogProductId = (int) (($activeRecords->first()['id'] ?? null) ?: ($records->first()['id'] ?? $currentProductId));
        $productIds = $activeRecords
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();
        $productCodes = $activeRecords
            ->pluck('product_code')
            ->map(fn (mixed $code): string => trim((string) $code))
            ->filter(fn (string $code): bool => $code !== '')
            ->values()
            ->all();

        if ($productIds === []) {
            $productIds = [$currentProductId];
        }

        if ($productCodes === []) {
            $productCodes = [trim((string) ($product->product_code ?? ''))];
        }

        return [
            'catalog_product_id' => $catalogProductId > 0 ? $catalogProductId : $currentProductId,
            'product_ids' => $productIds,
            'package_count' => count($productIds),
            'product_codes' => $productCodes,
        ];
    }

    public function resolveProductCatalogPolicy(Product $product, ?array $catalogScope = null): array
    {
        $resolvedScope = $catalogScope ?? $this->resolveProductCatalogScope($product);
        $blockingPackages = $this->findBlockingPackages((int) $product->getKey());
        $productHasCatalog = $this->hasProductCatalogData($resolvedScope['product_ids'] ?? []);
        $ownerLevel = $blockingPackages !== []
            ? 'package'
            : ($productHasCatalog ? 'product' : 'none');

        return [
            'owner_level' => $ownerLevel,
            'source' => $productHasCatalog ? 'product' : 'empty',
            'can_edit' => $blockingPackages === [],
            'can_import' => $blockingPackages === [],
            'read_only' => $blockingPackages !== [],
            'lock_reason' => $blockingPackages !== [] ? 'blocked_by_package' : null,
            'inherited_product_id' => null,
            'inherited_product_code' => null,
            'inherited_product_name' => null,
            'blocking_packages' => $blockingPackages,
        ];
    }

    /**
     * @param array<string, mixed> $package
     * @return array<string, mixed>
     */
    public function resolvePackageCatalogPolicy(array $package): array
    {
        $packageId = $this->support->parseNullableInt($package['id'] ?? null) ?? 0;
        $packageHasCatalog = $packageId > 0 ? $this->hasPackageCatalogData($packageId) : false;
        $parentProduct = $this->findParentProduct($package);
        $catalogScope = $parentProduct ? $this->resolveProductCatalogScope($parentProduct) : null;
        $productHasCatalog = $catalogScope ? $this->hasProductCatalogData($catalogScope['product_ids'] ?? []) : false;

        if ($packageHasCatalog) {
            return [
                'owner_level' => 'package',
                'source' => 'package',
                'can_edit' => true,
                'can_import' => true,
                'read_only' => false,
                'lock_reason' => null,
                'inherited_product_id' => null,
                'inherited_product_code' => null,
                'inherited_product_name' => null,
                'blocking_packages' => [],
            ];
        }

        if ($productHasCatalog) {
            return [
                'owner_level' => 'product',
                'source' => 'product',
                'can_edit' => false,
                'can_import' => false,
                'read_only' => true,
                'lock_reason' => 'blocked_by_product',
                'inherited_product_id' => $parentProduct?->getKey(),
                'inherited_product_code' => trim((string) ($parentProduct->product_code ?? '')) ?: null,
                'inherited_product_name' => trim((string) ($parentProduct->product_name ?? '')) ?: null,
                'blocking_packages' => [],
            ];
        }

        return [
            'owner_level' => 'none',
            'source' => 'empty',
            'can_edit' => true,
            'can_import' => true,
            'read_only' => false,
            'lock_reason' => null,
            'inherited_product_id' => null,
            'inherited_product_code' => null,
            'inherited_product_name' => null,
            'blocking_packages' => [],
        ];
    }

    /**
     * @param array<int, mixed> $productIds
     */
    public function hasProductCatalogData(array $productIds): bool
    {
        if ($productIds === [] || ! $this->support->hasTable(self::PRODUCT_GROUP_TABLE)) {
            return false;
        }

        $resolvedIds = collect($productIds)
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();

        if ($resolvedIds === []) {
            return false;
        }

        return DB::table(self::PRODUCT_GROUP_TABLE)
            ->whereIn('product_id', $resolvedIds)
            ->when(
                $this->support->hasColumn(self::PRODUCT_GROUP_TABLE, 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->exists();
    }

    public function hasPackageCatalogData(int $packageId): bool
    {
        if ($packageId <= 0 || ! $this->support->hasTable(self::PACKAGE_GROUP_TABLE)) {
            return false;
        }

        return DB::table(self::PACKAGE_GROUP_TABLE)
            ->where('package_id', $packageId)
            ->when(
                $this->support->hasColumn(self::PACKAGE_GROUP_TABLE, 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->exists();
    }

    /**
     * @return array<int, array{id:int, package_code:string, package_name:string}>
     */
    public function findBlockingPackages(int $productId): array
    {
        if (
            $productId <= 0
            || ! $this->support->hasTable('product_packages')
            || ! $this->support->hasTable(self::PACKAGE_GROUP_TABLE)
        ) {
            return [];
        }

        $columns = [];
        foreach (['id', 'package_code', 'package_name'] as $column) {
            if ($this->support->hasColumn('product_packages', $column)) {
                $columns[] = "product_packages.{$column}";
            }
        }

        if ($columns === []) {
            return [];
        }

        return DB::table('product_packages')
            ->select($columns)
            ->where('product_id', $productId)
            ->when(
                $this->support->hasColumn('product_packages', 'deleted_at'),
                fn ($query) => $query->whereNull('product_packages.deleted_at')
            )
            ->whereExists(function ($query): void {
                $query->selectRaw('1')
                    ->from(self::PACKAGE_GROUP_TABLE . ' as groups')
                    ->whereColumn('groups.package_id', 'product_packages.id')
                    ->when(
                        $this->support->hasColumn(self::PACKAGE_GROUP_TABLE, 'deleted_at'),
                        fn ($existsQuery) => $existsQuery->whereNull('groups.deleted_at')
                    );
            })
            ->orderBy('product_packages.id')
            ->get()
            ->map(function (object $record): array {
                $row = (array) $record;

                return [
                    'id' => (int) ($row['id'] ?? 0),
                    'package_code' => trim((string) ($row['package_code'] ?? '')),
                    'package_name' => trim((string) ($row['package_name'] ?? '')),
                ];
            })
            ->filter(fn (array $row): bool => $row['id'] > 0)
            ->values()
            ->all();
    }

    /**
     * @param array<string, mixed> $package
     */
    private function findParentProduct(array $package): ?Product
    {
        $productId = $this->support->parseNullableInt($package['product_id'] ?? null);
        if ($productId === null || ! $this->support->hasTable('products')) {
            return null;
        }

        return Product::query()->find($productId);
    }

    private function buildDefaultCatalogScope(Product $product): array
    {
        $currentProductId = (int) $product->getKey();

        return [
            'catalog_product_id' => $currentProductId,
            'product_ids' => [$currentProductId],
            'package_count' => 1,
            'product_codes' => [trim((string) ($product->product_code ?? ''))],
        ];
    }
}
