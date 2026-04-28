<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<int, string|null> */
    private array $packageUnitsById = [];

    /** @var array<int, string|null> */
    private array $productUnitsById = [];

    public function up(): void
    {
        if (! Schema::hasTable('project_items') || Schema::hasColumn('project_items', 'unit')) {
            return;
        }

        Schema::table('project_items', function (Blueprint $table): void {
            $table->string('unit', 100)->nullable()->after('product_package_id');
        });

        $this->backfillUnitSnapshots();
    }

    public function down(): void
    {
        if (! Schema::hasTable('project_items') || ! Schema::hasColumn('project_items', 'unit')) {
            return;
        }

        Schema::table('project_items', function (Blueprint $table): void {
            $table->dropColumn('unit');
        });
    }

    private function backfillUnitSnapshots(): void
    {
        if (! Schema::hasColumn('project_items', 'unit') || ! Schema::hasColumn('project_items', 'id')) {
            return;
        }

        $hasProductPackages = Schema::hasTable('product_packages')
            && Schema::hasColumn('project_items', 'product_package_id')
            && Schema::hasColumn('product_packages', 'id')
            && Schema::hasColumn('product_packages', 'unit');

        $hasProducts = Schema::hasTable('products')
            && Schema::hasColumn('project_items', 'product_id')
            && Schema::hasColumn('products', 'id')
            && Schema::hasColumn('products', 'unit');

        DB::table('project_items')
            ->select(['id', 'product_id', 'product_package_id'])
            ->whereNull('unit')
            ->orderBy('id')
            ->chunkById(200, function ($rows) use ($hasProductPackages, $hasProducts): void {
                foreach ($rows as $row) {
                    $packageUnit = $hasProductPackages
                        ? $this->resolvePackageUnit(isset($row->product_package_id) ? (int) $row->product_package_id : 0)
                        : null;
                    $productUnit = $hasProducts
                        ? $this->resolveProductUnit(isset($row->product_id) ? (int) $row->product_id : 0)
                        : null;
                    $resolvedUnit = $packageUnit ?: $productUnit;

                    if ($resolvedUnit === null || trim($resolvedUnit) === '') {
                        continue;
                    }

                    DB::table('project_items')
                        ->where('id', (int) $row->id)
                        ->whereNull('unit')
                        ->update(['unit' => $resolvedUnit]);
                }
            }, 'id');
    }

    private function resolvePackageUnit(int $packageId): ?string
    {
        if ($packageId <= 0) {
            return null;
        }

        if (! array_key_exists($packageId, $this->packageUnitsById)) {
            $this->packageUnitsById[$packageId] = DB::table('product_packages')
                ->where('id', $packageId)
                ->value('unit');
        }

        return $this->packageUnitsById[$packageId];
    }

    private function resolveProductUnit(int $productId): ?string
    {
        if ($productId <= 0) {
            return null;
        }

        if (! array_key_exists($productId, $this->productUnitsById)) {
            $this->productUnitsById[$productId] = DB::table('products')
                ->where('id', $productId)
                ->value('unit');
        }

        return $this->productUnitsById[$productId];
    }
};
