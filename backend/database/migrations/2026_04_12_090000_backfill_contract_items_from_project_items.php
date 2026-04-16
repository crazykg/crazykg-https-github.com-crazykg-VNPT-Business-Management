<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Collection;
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
            || ! Schema::hasColumn('contracts', 'project_id')
            || ! Schema::hasColumn('contracts', 'value')
        ) {
            return;
        }

        $contractColumns = ['id', 'project_id', 'value'];
        if (Schema::hasColumn('contracts', 'created_by')) {
            $contractColumns[] = 'created_by';
        }
        if (Schema::hasColumn('contracts', 'updated_by')) {
            $contractColumns[] = 'updated_by';
        }

        $contracts = DB::table('contracts')
            ->select($contractColumns)
            ->when(
                Schema::hasColumn('contracts', 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->whereNotNull('project_id')
            ->orderBy('id')
            ->get()
            ->filter(function (object $contract): bool {
                $projectId = (int) ($contract->project_id ?? 0);

                return $projectId > 0
                    && ! DB::table('contract_items')->where('contract_id', (int) $contract->id)->exists();
            })
            ->values();

        foreach ($contracts as $contract) {
            $productNameCandidates = [];
            $unitCandidates = [];
            $query = DB::table('project_items as item')
                ->where('item.project_id', (int) $contract->project_id)
                ->when(
                    Schema::hasColumn('project_items', 'deleted_at'),
                    fn ($query) => $query->whereNull('item.deleted_at')
                )
                ->orderBy('item.id');

            if (Schema::hasTable('product_packages')) {
                $query->leftJoin('product_packages as package', 'package.id', '=', 'item.product_package_id');
                $productNameCandidates[] = 'package.package_name';
                $productNameCandidates[] = 'package.product_name';
                $unitCandidates[] = 'package.unit';
            }
            if (Schema::hasTable('products')) {
                $query->leftJoin('products as product', 'product.id', '=', 'item.product_id');
                $productNameCandidates[] = 'product.product_name';
                $unitCandidates[] = 'product.unit';
            }

            $productNameExpression = $productNameCandidates === []
                ? 'NULL'
                : sprintf('COALESCE(%s)', implode(', ', $productNameCandidates));
            $unitExpression = $unitCandidates === []
                ? 'NULL'
                : sprintf('COALESCE(%s)', implode(', ', $unitCandidates));

            $projectItems = $query->get([
                'item.id',
                'item.product_id',
                'item.product_package_id',
                'item.quantity',
                'item.unit_price',
                DB::raw($productNameExpression.' as resolved_product_name'),
                DB::raw($unitExpression.' as resolved_unit'),
            ]);

            if ($projectItems->isEmpty()) {
                continue;
            }

            $projectTotal = $projectItems->reduce(
                fn (float $carry, object $item): float => $carry + ((float) ($item->quantity ?? 0) * (float) ($item->unit_price ?? 0)),
                0.0
            );
            $contractValue = (float) ($contract->value ?? 0);

            if (round($projectTotal, 2) !== round($contractValue, 2)) {
                continue;
            }

            $this->insertContractItemsFromProjectItems($contract, $projectItems);
        }
    }

    public function down(): void
    {
        // Forward-only backfill.
    }

    /**
     * @param Collection<int, object> $projectItems
     */
    private function insertContractItemsFromProjectItems(object $contract, Collection $projectItems): void
    {
        $now = now();
        $rows = $projectItems->map(function (object $item) use ($contract, $now): array {
            $row = [
                'contract_id' => (int) $contract->id,
                'product_id' => (int) ($item->product_id ?? 0),
            ];

            if (Schema::hasColumn('contract_items', 'product_package_id')) {
                $row['product_package_id'] = $item->product_package_id !== null
                    ? (int) $item->product_package_id
                    : null;
            }
            if (Schema::hasColumn('contract_items', 'product_name')) {
                $row['product_name'] = $item->resolved_product_name;
            }
            if (Schema::hasColumn('contract_items', 'unit')) {
                $row['unit'] = $item->resolved_unit;
            }
            if (Schema::hasColumn('contract_items', 'quantity')) {
                $row['quantity'] = (float) ($item->quantity ?? 0);
            }
            if (Schema::hasColumn('contract_items', 'unit_price')) {
                $row['unit_price'] = (float) ($item->unit_price ?? 0);
            }
            if (Schema::hasColumn('contract_items', 'created_by')) {
                $row['created_by'] = $contract->created_by !== null ? (int) $contract->created_by : null;
            }
            if (Schema::hasColumn('contract_items', 'updated_by')) {
                $row['updated_by'] = $contract->updated_by !== null ? (int) $contract->updated_by : null;
            }
            if (Schema::hasColumn('contract_items', 'created_at')) {
                $row['created_at'] = $now;
            }
            if (Schema::hasColumn('contract_items', 'updated_at')) {
                $row['updated_at'] = $now;
            }

            return $row;
        })->all();

        if ($rows !== []) {
            DB::table('contract_items')->insert($rows);
        }
    }
};
