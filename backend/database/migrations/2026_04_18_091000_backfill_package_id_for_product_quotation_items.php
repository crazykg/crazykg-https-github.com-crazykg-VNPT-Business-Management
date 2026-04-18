<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<int, array<int, array<string, mixed>>> */
    private array $packageCandidatesByProduct = [];

    /** @var array<int, bool> */
    private array $packageCatalogPresence = [];

    public function up(): void
    {
        if (! Schema::hasTable('product_packages')) {
            return;
        }

        $this->backfillTable('product_quotation_items');
        $this->backfillTable('product_quotation_version_items');
    }

    public function down(): void
    {
        // Intentionally irreversible: preserve recovered package bindings.
    }

    private function backfillTable(string $table): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'package_id') || ! Schema::hasColumn($table, 'product_id')) {
            return;
        }

        $query = DB::table($table)
            ->select(array_values(array_filter([
                'id',
                'product_id',
                Schema::hasColumn($table, 'unit') ? 'unit' : null,
                Schema::hasColumn($table, 'unit_price') ? 'unit_price' : null,
                Schema::hasColumn($table, 'note') ? 'note' : null,
            ])))
            ->whereNull('package_id')
            ->whereNotNull('product_id')
            ->orderBy('id');

        $query->chunkById(200, function ($rows) use ($table): void {
            foreach ($rows as $row) {
                $resolvedPackageId = $this->resolvePackageIdForRow((array) $row);
                if ($resolvedPackageId === null) {
                    continue;
                }

                DB::table($table)
                    ->where('id', (int) $row->id)
                    ->whereNull('package_id')
                    ->update(['package_id' => $resolvedPackageId]);
            }
        }, 'id');
    }

    /**
     * @param array<string, mixed> $row
     */
    private function resolvePackageIdForRow(array $row): ?int
    {
        $productId = isset($row['product_id']) ? (int) $row['product_id'] : 0;
        if ($productId <= 0) {
            return null;
        }

        $candidates = $this->loadPackageCandidates($productId);
        if ($candidates === []) {
            return null;
        }

        $unit = trim((string) ($row['unit'] ?? ''));
        if ($unit !== '') {
            $filteredByUnit = array_values(array_filter(
                $candidates,
                static fn (array $candidate): bool => trim((string) ($candidate['unit'] ?? '')) === $unit
            ));
            if ($filteredByUnit !== []) {
                $candidates = $filteredByUnit;
            }
        }

        $unitPrice = isset($row['unit_price']) ? round((float) $row['unit_price'], 2) : 0.0;
        if ($unitPrice > 0) {
            $filteredByPrice = array_values(array_filter(
                $candidates,
                static fn (array $candidate): bool => round((float) ($candidate['standard_price'] ?? 0), 2) === $unitPrice
            ));
            if ($filteredByPrice !== []) {
                $candidates = $filteredByPrice;
            }
        }

        $note = $this->normalizeText((string) ($row['note'] ?? ''));
        if ($note !== '') {
            $filteredByDescription = array_values(array_filter(
                $candidates,
                fn (array $candidate): bool => $this->noteContainsDescription(
                    $note,
                    $this->normalizeText((string) ($candidate['description'] ?? ''))
                )
            ));
            if ($filteredByDescription !== []) {
                $candidates = $filteredByDescription;
            }
        }

        if (count($candidates) === 1) {
            return (int) $candidates[0]['id'];
        }

        if (count($candidates) > 1) {
            $catalogCandidates = array_values(array_filter(
                $candidates,
                fn (array $candidate): bool => $this->packageHasCatalog((int) $candidate['id'])
            ));

            if (count($catalogCandidates) === 1) {
                return (int) $catalogCandidates[0]['id'];
            }
        }

        return null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadPackageCandidates(int $productId): array
    {
        if (array_key_exists($productId, $this->packageCandidatesByProduct)) {
            return $this->packageCandidatesByProduct[$productId];
        }

        $columns = array_values(array_filter([
            'id',
            'product_id',
            Schema::hasColumn('product_packages', 'unit') ? 'unit' : null,
            Schema::hasColumn('product_packages', 'standard_price') ? 'standard_price' : null,
            Schema::hasColumn('product_packages', 'description') ? 'description' : null,
        ]));

        $this->packageCandidatesByProduct[$productId] = DB::table('product_packages')
            ->select($columns)
            ->where('product_id', $productId)
            ->orderBy('id')
            ->get()
            ->map(fn ($row): array => (array) $row)
            ->all();

        return $this->packageCandidatesByProduct[$productId];
    }

    private function packageHasCatalog(int $packageId): bool
    {
        if (array_key_exists($packageId, $this->packageCatalogPresence)) {
            return $this->packageCatalogPresence[$packageId];
        }

        if (
            ! Schema::hasTable('product_package_feature_groups')
            || ! Schema::hasTable('product_package_features')
        ) {
            $this->packageCatalogPresence[$packageId] = false;

            return false;
        }

        $groupQuery = DB::table('product_package_feature_groups')->where('package_id', $packageId);
        if (Schema::hasColumn('product_package_feature_groups', 'deleted_at')) {
            $groupQuery->whereNull('deleted_at');
        }

        $featureQuery = DB::table('product_package_features')->where('package_id', $packageId);
        if (Schema::hasColumn('product_package_features', 'deleted_at')) {
            $featureQuery->whereNull('deleted_at');
        }
        if (Schema::hasColumn('product_package_features', 'status')) {
            $featureQuery->where('status', 'ACTIVE');
        }

        $this->packageCatalogPresence[$packageId] = $groupQuery->exists() && $featureQuery->exists();

        return $this->packageCatalogPresence[$packageId];
    }

    private function normalizeText(string $value): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $value) ?? ''), 'UTF-8');
    }

    private function noteContainsDescription(string $note, string $description): bool
    {
        return $description !== '' && str_contains($note, $description);
    }
};
