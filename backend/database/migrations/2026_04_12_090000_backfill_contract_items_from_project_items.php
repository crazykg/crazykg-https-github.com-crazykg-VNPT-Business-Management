<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable('contracts')
            || ! Schema::hasTable('contract_items')
            || ! Schema::hasTable('project_items')
            || ! Schema::hasColumn('contracts', 'id')
            || ! Schema::hasColumn('contracts', 'project_id')
            || ! Schema::hasColumn('contract_items', 'contract_id')
            || ! Schema::hasColumn('project_items', 'project_id')
            || ! Schema::hasColumn('project_items', 'product_id')
        ) {
            return;
        }

        $contractValueColumns = array_values(array_filter(
            ['value', 'total_value'],
            fn (string $column): bool => Schema::hasColumn('contracts', $column)
        ));
        if ($contractValueColumns === []) {
            return;
        }

        $hasProjectItemDeletedAt = Schema::hasColumn('project_items', 'deleted_at');
        $hasContractDeletedAt = Schema::hasColumn('contracts', 'deleted_at');
        $hasProductPackages = Schema::hasTable('product_packages');
        $hasProducts = Schema::hasTable('products');

        $contractSelects = ['id', 'project_id'];
        foreach (['value', 'total_value', 'created_by', 'updated_by'] as $column) {
            if (Schema::hasColumn('contracts', $column)) {
                $contractSelects[] = $column;
            }
        }

        DB::table('contracts')
            ->select($contractSelects)
            ->whereNotNull('project_id')
            ->when($hasContractDeletedAt, fn ($query) => $query->whereNull('deleted_at'))
            ->orderBy('id')
            ->chunkById(100, function ($contracts) use ($contractValueColumns, $hasProjectItemDeletedAt, $hasProductPackages, $hasProducts): void {
                foreach ($contracts as $contract) {
                    $contractId = (int) ($contract->id ?? 0);
                    $projectId = (int) ($contract->project_id ?? 0);
                    if ($contractId <= 0 || $projectId <= 0) {
                        continue;
                    }

                    $existingItems = DB::table('contract_items')
                        ->where('contract_id', $contractId)
                        ->count();
                    if ($existingItems > 0) {
                        continue;
                    }

                    $projectItems = $this->fetchProjectItems($projectId, $hasProjectItemDeletedAt, $hasProductPackages, $hasProducts);
                    if ($projectItems === []) {
                        continue;
                    }

                    $projectItemsTotal = round(collect($projectItems)->sum(function (array $item): float {
                        return round((float) ($item['quantity'] ?? 0), 2) * round((float) ($item['unit_price'] ?? 0), 2);
                    }), 2);
                    $contractValue = $this->resolveContractValue($contract, $contractValueColumns);
                    if (abs($projectItemsTotal - $contractValue) > 0.01) {
                        continue;
                    }

                    $this->insertContractItems($contractId, $contract, $projectItems);
                }
            }, 'id');
    }

    public function down(): void
    {
        // Forward-only data backfill.
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchProjectItems(
        int $projectId,
        bool $hasProjectItemDeletedAt,
        bool $hasProductPackages,
        bool $hasProducts
    ): array {
        $query = DB::table('project_items as pi')
            ->where('pi.project_id', $projectId);

        if ($hasProjectItemDeletedAt) {
            $query->whereNull('pi.deleted_at');
        }
        if ($hasProductPackages && Schema::hasColumn('project_items', 'product_package_id')) {
            $query->leftJoin('product_packages as pp', 'pi.product_package_id', '=', 'pp.id');
        }
        if ($hasProducts) {
            $query->leftJoin('products as pr', 'pi.product_id', '=', 'pr.id');
        }

        $selects = ['pi.product_id as product_id'];
        $selects[] = Schema::hasColumn('project_items', 'product_package_id')
            ? 'pi.product_package_id as product_package_id'
            : DB::raw('NULL as product_package_id');
        $selects[] = Schema::hasColumn('project_items', 'quantity')
            ? 'pi.quantity as quantity'
            : DB::raw('1 as quantity');
        $selects[] = Schema::hasColumn('project_items', 'unit_price')
            ? 'pi.unit_price as unit_price'
            : DB::raw('0 as unit_price');
        $selects[] = $hasProductPackages && Schema::hasColumn('product_packages', 'package_name')
            ? 'pp.package_name as package_name'
            : DB::raw('NULL as package_name');
        $selects[] = $hasProductPackages && Schema::hasColumn('product_packages', 'product_name')
            ? 'pp.product_name as package_product_name'
            : DB::raw('NULL as package_product_name');
        $selects[] = $hasProductPackages && Schema::hasColumn('product_packages', 'unit')
            ? 'pp.unit as package_unit'
            : DB::raw('NULL as package_unit');
        $selects[] = $hasProducts && Schema::hasColumn('products', 'product_name')
            ? 'pr.product_name as product_name'
            : DB::raw('NULL as product_name');
        $selects[] = $hasProducts && Schema::hasColumn('products', 'unit')
            ? 'pr.unit as unit'
            : DB::raw('NULL as unit');

        return $query
            ->select($selects)
            ->orderBy('pi.id')
            ->get()
            ->map(function (object $row): ?array {
                $productId = (int) ($row->product_id ?? 0);
                $quantity = is_numeric($row->quantity ?? null) ? (float) $row->quantity : 0.0;
                $unitPrice = is_numeric($row->unit_price ?? null) ? (float) $row->unit_price : 0.0;
                if ($productId <= 0 || $quantity <= 0 || $unitPrice < 0) {
                    return null;
                }

                return [
                    'product_id' => $productId,
                    'product_package_id' => isset($row->product_package_id) ? (int) $row->product_package_id : null,
                    'product_name' => $row->package_name ?? $row->package_product_name ?? $row->product_name ?? null,
                    'unit' => $row->package_unit ?? $row->unit ?? null,
                    'quantity' => round($quantity, 2),
                    'unit_price' => round($unitPrice, 2),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param object $contract
     * @param array<int, string> $valueColumns
     */
    private function resolveContractValue(object $contract, array $valueColumns): float
    {
        foreach ($valueColumns as $column) {
            $value = $contract->{$column} ?? null;
            if (is_numeric($value)) {
                return round((float) $value, 2);
            }
        }

        return 0.0;
    }

    /**
     * @param object $contract
     * @param array<int, array<string, mixed>> $projectItems
     */
    private function insertContractItems(int $contractId, object $contract, array $projectItems): void
    {
        $now = now();
        $rows = [];
        foreach ($projectItems as $item) {
            $row = [
                'contract_id' => $contractId,
                'product_id' => $item['product_id'],
            ];

            if (Schema::hasColumn('contract_items', 'product_package_id')) {
                $row['product_package_id'] = $item['product_package_id'];
            }
            if (Schema::hasColumn('contract_items', 'product_name')) {
                $row['product_name'] = $item['product_name'];
            }
            if (Schema::hasColumn('contract_items', 'unit')) {
                $row['unit'] = $item['unit'];
            }
            if (Schema::hasColumn('contract_items', 'quantity')) {
                $row['quantity'] = $item['quantity'];
            }
            if (Schema::hasColumn('contract_items', 'unit_price')) {
                $row['unit_price'] = $item['unit_price'];
            }
            if (Schema::hasColumn('contract_items', 'vat_rate')) {
                $row['vat_rate'] = null;
            }
            if (Schema::hasColumn('contract_items', 'vat_amount')) {
                $row['vat_amount'] = null;
            }
            if (Schema::hasColumn('contract_items', 'created_by')) {
                $row['created_by'] = $contract->created_by ?? null;
            }
            if (Schema::hasColumn('contract_items', 'updated_by')) {
                $row['updated_by'] = $contract->updated_by ?? ($contract->created_by ?? null);
            }
            if (Schema::hasColumn('contract_items', 'created_at')) {
                $row['created_at'] = $now;
            }
            if (Schema::hasColumn('contract_items', 'updated_at')) {
                $row['updated_at'] = $now;
            }

            $rows[] = $row;
        }

        if ($rows !== []) {
            DB::table('contract_items')->insert($rows);
        }
    }
};
