<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable('customer_requests')
            || ! Schema::hasTable('workflow_status_catalogs')
            || ! Schema::hasColumn('customer_requests', 'status_catalog_id')
            || ! Schema::hasColumn('customer_requests', 'status')
            || ! Schema::hasColumn('customer_requests', 'sub_status')
        ) {
            return;
        }

        $catalogRows = DB::table('workflow_status_catalogs')
            ->select(['id', 'status_code', 'canonical_status', 'canonical_sub_status'])
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->values()
            ->all();

        if ($catalogRows === []) {
            return;
        }

        $catalogById = [];
        foreach ($catalogRows as $catalogRow) {
            $catalogId = (int) ($catalogRow['id'] ?? 0);
            if ($catalogId > 0) {
                $catalogById[$catalogId] = $catalogRow;
            }
        }

        DB::table('customer_requests')
            ->select(['id', 'status_catalog_id', 'status', 'sub_status'])
            ->orderBy('id')
            ->chunkById(200, function ($rows) use ($catalogRows, $catalogById): void {
                foreach ($rows as $row) {
                    $resolvedCatalogId = $this->resolveStatusCatalogId(
                        $catalogRows,
                        $row->status ?? null,
                        $row->sub_status ?? null
                    );

                    if ($resolvedCatalogId === null || ! $this->shouldBackfillRow($row, $catalogById, $resolvedCatalogId)) {
                        continue;
                    }

                    $update = ['status_catalog_id' => $resolvedCatalogId];
                    if (Schema::hasColumn('customer_requests', 'updated_at')) {
                        $update['updated_at'] = now();
                    }

                    DB::table('customer_requests')
                        ->where('id', (int) $row->id)
                        ->update($update);
                }
            });
    }

    public function down(): void
    {
        // No-op. Đây là migration backfill dữ liệu tương thích.
    }

    /**
     * @param array<int,array<string,mixed>> $catalogRows
     */
    private function resolveStatusCatalogId(array $catalogRows, ?string $status, ?string $subStatus): ?int
    {
        $normalizedStatus = $this->normalizeToken($status);
        $normalizedSubStatus = $this->normalizeNullableStatus($subStatus);
        if ($normalizedStatus === '') {
            return null;
        }

        foreach ($catalogRows as $catalogRow) {
            $catalogStatus = $this->normalizeToken($catalogRow['canonical_status'] ?? $catalogRow['status_code'] ?? null);
            $catalogSubStatus = $this->normalizeNullableStatus($catalogRow['canonical_sub_status'] ?? null);
            if ($catalogStatus === $normalizedStatus && $catalogSubStatus === $normalizedSubStatus) {
                return (int) ($catalogRow['id'] ?? 0);
            }
        }

        if ($normalizedSubStatus === null) {
            foreach ($catalogRows as $catalogRow) {
                $catalogStatus = $this->normalizeToken($catalogRow['status_code'] ?? null);
                $catalogSubStatus = $this->normalizeNullableStatus($catalogRow['canonical_sub_status'] ?? null);
                if ($catalogStatus === $normalizedStatus && $catalogSubStatus === null) {
                    return (int) ($catalogRow['id'] ?? 0);
                }
            }
        }

        foreach ($catalogRows as $catalogRow) {
            $catalogStatus = $this->normalizeToken($catalogRow['canonical_status'] ?? $catalogRow['status_code'] ?? null);
            $catalogSubStatus = $this->normalizeNullableStatus($catalogRow['canonical_sub_status'] ?? null);
            if ($catalogStatus === $normalizedStatus && $catalogSubStatus === null) {
                return (int) ($catalogRow['id'] ?? 0);
            }
        }

        return null;
    }

    /**
     * @param array<int,array<string,mixed>> $catalogById
     */
    private function shouldBackfillRow(object $row, array $catalogById, int $resolvedCatalogId): bool
    {
        $currentCatalogId = is_numeric($row->status_catalog_id ?? null)
            ? (int) $row->status_catalog_id
            : null;

        if ($currentCatalogId === null || ! array_key_exists($currentCatalogId, $catalogById)) {
            return true;
        }

        $currentCatalog = $catalogById[$currentCatalogId];
        $catalogStatus = $this->normalizeToken($currentCatalog['canonical_status'] ?? $currentCatalog['status_code'] ?? null);
        $catalogSubStatus = $this->normalizeNullableStatus($currentCatalog['canonical_sub_status'] ?? null);
        $rowStatus = $this->normalizeToken($row->status ?? null);
        $rowSubStatus = $this->normalizeNullableStatus($row->sub_status ?? null);

        return $catalogStatus !== $rowStatus || $catalogSubStatus !== $rowSubStatus || $currentCatalogId !== $resolvedCatalogId;
    }

    private function normalizeToken(mixed $value): string
    {
        return strtoupper(trim((string) ($value ?? '')));
    }

    private function normalizeNullableStatus(mixed $value): ?string
    {
        $normalized = $this->normalizeToken($value);

        return $normalized !== '' ? $normalized : null;
    }
};
