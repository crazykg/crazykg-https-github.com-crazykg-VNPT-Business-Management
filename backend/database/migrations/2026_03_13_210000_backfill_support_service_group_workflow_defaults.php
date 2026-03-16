<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable('support_service_groups')
            || ! Schema::hasTable('workflow_status_catalogs')
            || ! Schema::hasColumn('support_service_groups', 'group_code')
            || ! Schema::hasColumn('support_service_groups', 'group_name')
            || ! Schema::hasColumn('support_service_groups', 'workflow_status_catalog_id')
            || ! Schema::hasColumn('support_service_groups', 'workflow_form_key')
        ) {
            return;
        }

        $bindings = $this->resolveCatalogBindings();
        if ($bindings === []) {
            return;
        }

        DB::table('support_service_groups')
            ->select(['id', 'group_code', 'group_name', 'workflow_status_catalog_id', 'workflow_form_key'])
            ->orderBy('id')
            ->chunkById(200, function ($rows) use ($bindings): void {
                foreach ($rows as $row) {
                    $suggestedBinding = $this->resolveSuggestedBinding($row, $bindings);
                    if ($suggestedBinding === null || ! $this->canApplySuggestedBinding($row, $suggestedBinding)) {
                        continue;
                    }

                    $update = [];

                    if (! $this->hasNonEmptyValue($row->workflow_status_catalog_id) && isset($suggestedBinding['workflow_status_catalog_id'])) {
                        $update['workflow_status_catalog_id'] = $suggestedBinding['workflow_status_catalog_id'];
                    }

                    if (! $this->hasNonEmptyText($row->workflow_form_key) && isset($suggestedBinding['workflow_form_key'])) {
                        $update['workflow_form_key'] = $suggestedBinding['workflow_form_key'];
                    }

                    if ($update === []) {
                        continue;
                    }

                    if (Schema::hasColumn('support_service_groups', 'updated_at')) {
                        $update['updated_at'] = now();
                    }

                    DB::table('support_service_groups')
                        ->where('id', (int) $row->id)
                        ->update($update);
                }
            });
    }

    public function down(): void
    {
        // No-op. Đây là migration backfill cấu hình mặc định, không nên tự động rollback dữ liệu.
    }

    /**
     * @return array<string,array{workflow_status_catalog_id:int,workflow_form_key:string}>
     */
    private function resolveCatalogBindings(): array
    {
        $catalogs = DB::table('workflow_status_catalogs')
            ->select(['id', 'status_code', 'form_key'])
            ->whereIn('status_code', ['PHAN_TICH', 'CHUYEN_DMS_GROUP'])
            ->get();

        $bindings = [];
        foreach ($catalogs as $catalog) {
            $statusCode = $this->normalizeToken($catalog->status_code ?? null);
            $formKey = trim((string) ($catalog->form_key ?? ''));
            if ($statusCode === '' || $formKey === '') {
                continue;
            }

            $bindings[$statusCode] = [
                'workflow_status_catalog_id' => (int) $catalog->id,
                'workflow_form_key' => $formKey,
            ];
        }

        return $bindings;
    }

    /**
     * @param array<string,array{workflow_status_catalog_id:int,workflow_form_key:string}> $bindings
     * @return array{workflow_status_catalog_id:int,workflow_form_key:string}|null
     */
    private function resolveSuggestedBinding(object $row, array $bindings): ?array
    {
        $groupCode = $this->normalizeToken($row->group_code ?? null);
        $groupName = $this->normalizeToken($row->group_name ?? null);
        $lookup = trim($groupCode . ' ' . $groupName);

        if ($lookup === '' || $this->isSmokeOrTestGroup($lookup)) {
            return null;
        }

        if ($this->containsAnyToken($lookup, ['DMS'])) {
            return $bindings['CHUYEN_DMS_GROUP'] ?? null;
        }

        if ($this->containsAnyToken($lookup, [
            'HIS_L3',
            'HIS L3',
            'HIS_L34',
            'HIS L34',
            'UPCODE',
            'HOAN_THIEN_PHAN_MEM',
            'HOÀN THIỆN PHẦN MỀM',
            'HOAN THIEN PHAN MEM',
        ])) {
            return $bindings['PHAN_TICH'] ?? null;
        }

        return null;
    }

    /**
     * @param array{workflow_status_catalog_id:int,workflow_form_key:string} $suggestedBinding
     */
    private function canApplySuggestedBinding(object $row, array $suggestedBinding): bool
    {
        $currentWorkflowStatusCatalogId = $this->parseNullableInt($row->workflow_status_catalog_id ?? null);
        if (
            $currentWorkflowStatusCatalogId !== null
            && $currentWorkflowStatusCatalogId !== (int) $suggestedBinding['workflow_status_catalog_id']
        ) {
            return false;
        }

        $currentWorkflowFormKey = $this->normalizeNullableText($row->workflow_form_key ?? null);
        if (
            $currentWorkflowFormKey !== null
            && $currentWorkflowFormKey !== $this->normalizeNullableText($suggestedBinding['workflow_form_key'])
        ) {
            return false;
        }

        return true;
    }

    private function isSmokeOrTestGroup(string $lookup): bool
    {
        return $this->containsAnyToken($lookup, ['SMOKE', 'TEST']);
    }

    /**
     * @param array<int,string> $tokens
     */
    private function containsAnyToken(string $lookup, array $tokens): bool
    {
        foreach ($tokens as $token) {
            $normalizedToken = $this->normalizeToken($token);
            if ($normalizedToken !== '' && str_contains($lookup, $normalizedToken)) {
                return true;
            }
        }

        return false;
    }

    private function hasNonEmptyValue(mixed $value): bool
    {
        return $this->parseNullableInt($value) !== null;
    }

    private function hasNonEmptyText(mixed $value): bool
    {
        return $this->normalizeNullableText($value) !== null;
    }

    private function parseNullableInt(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }

    private function normalizeToken(mixed $value): string
    {
        return strtoupper(trim((string) ($value ?? '')));
    }

    private function normalizeNullableText(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));

        return $normalized !== '' ? $normalized : null;
    }
};
