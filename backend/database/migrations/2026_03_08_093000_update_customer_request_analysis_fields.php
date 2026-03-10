<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const STATUS_TABLE = 'workflow_status_catalogs';
    private const FIELD_TABLE = 'workflow_form_field_configs';

    public function up(): void
    {
        if (! Schema::hasTable(self::STATUS_TABLE) || ! Schema::hasTable(self::FIELD_TABLE)) {
            return;
        }

        $requiredColumns = ['id', 'status_catalog_id', 'field_key', 'field_label'];
        foreach ($requiredColumns as $column) {
            if (! Schema::hasColumn(self::FIELD_TABLE, $column)) {
                return;
            }
        }

        $analysisStatusId = $this->resolveAnalysisStatusId();
        if ($analysisStatusId === null) {
            return;
        }

        $rows = DB::table(self::FIELD_TABLE)
            ->where('status_catalog_id', $analysisStatusId)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->values()
            ->all();

        $hasFieldType = Schema::hasColumn(self::FIELD_TABLE, 'field_type');
        $hasRequired = Schema::hasColumn(self::FIELD_TABLE, 'required');
        $hasSortOrder = Schema::hasColumn(self::FIELD_TABLE, 'sort_order');
        $hasIsActive = Schema::hasColumn(self::FIELD_TABLE, 'is_active');
        $hasCreatedAt = Schema::hasColumn(self::FIELD_TABLE, 'created_at');
        $hasUpdatedAt = Schema::hasColumn(self::FIELD_TABLE, 'updated_at');

        $this->deactivateField(
            $rows,
            ['fieldnidungphantichdinhkem', 'analysiscontent', 'nidungphantichdinhkem'],
            $hasIsActive,
            $hasUpdatedAt
        );
        $this->deactivateField(
            $rows,
            ['fieldngithchin', 'performerid', 'nguoithuchien', 'ngithchin'],
            $hasIsActive,
            $hasUpdatedAt
        );

        $this->upsertField(
            $analysisStatusId,
            $rows,
            ['analysisprogress'],
            'analysis_progress',
            'Tiến độ phân tích',
            'number',
            true,
            80,
            $hasFieldType,
            $hasRequired,
            $hasSortOrder,
            $hasIsActive,
            $hasCreatedAt,
            $hasUpdatedAt
        );
        $this->upsertField(
            $analysisStatusId,
            $rows,
            ['analysishoursestimated', 'analysishours', 'sogiodukienthuchien', 'sogiadukienthuchien'],
            'analysis_hours_estimated',
            'Số giờ dự kiến thực hiện',
            'number',
            true,
            90,
            $hasFieldType,
            $hasRequired,
            $hasSortOrder,
            $hasIsActive,
            $hasCreatedAt,
            $hasUpdatedAt
        );
        $this->upsertField(
            $analysisStatusId,
            $rows,
            ['analysiscompletiondate', 'ngayhoanthanh', 'ngayhoanathanh', 'fieldngayhoanathanh'],
            'analysis_completion_date',
            'Ngày hoàn thành',
            'date',
            false,
            100,
            $hasFieldType,
            $hasRequired,
            $hasSortOrder,
            $hasIsActive,
            $hasCreatedAt,
            $hasUpdatedAt
        );
    }

    public function down(): void
    {
        // no-op: this migration normalizes analysis field configs and deactivates legacy aliases.
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function deactivateField(array $rows, array $candidateTokens, bool $hasIsActive, bool $hasUpdatedAt): void
    {
        if (! $hasIsActive) {
            return;
        }

        foreach ($rows as $row) {
            $rowId = (int) ($row['id'] ?? 0);
            if ($rowId <= 0) {
                continue;
            }

            $keyToken = $this->normalizeToken((string) ($row['field_key'] ?? ''));
            $labelToken = $this->normalizeToken((string) ($row['field_label'] ?? ''));
            if (
                ! in_array($keyToken, $candidateTokens, true)
                && ! in_array($labelToken, $candidateTokens, true)
            ) {
                continue;
            }

            $payload = ['is_active' => 0];
            if ($hasUpdatedAt) {
                $payload['updated_at'] = now();
            }

            DB::table(self::FIELD_TABLE)
                ->where('id', $rowId)
                ->update($payload);
        }
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function upsertField(
        int $statusCatalogId,
        array &$rows,
        array $candidateTokens,
        string $fieldKey,
        string $fieldLabel,
        string $fieldType,
        bool $required,
        int $sortOrder,
        bool $hasFieldType,
        bool $hasRequired,
        bool $hasSortOrder,
        bool $hasIsActive,
        bool $hasCreatedAt,
        bool $hasUpdatedAt
    ): void {
        $existingRow = null;
        foreach ($rows as $row) {
            $keyToken = $this->normalizeToken((string) ($row['field_key'] ?? ''));
            $labelToken = $this->normalizeToken((string) ($row['field_label'] ?? ''));
            if (in_array($keyToken, $candidateTokens, true) || in_array($labelToken, $candidateTokens, true)) {
                $existingRow = $row;
                break;
            }
        }

        $payload = [
            'field_key' => $fieldKey,
            'field_label' => $fieldLabel,
        ];
        if ($hasFieldType) {
            $payload['field_type'] = $fieldType;
        }
        if ($hasRequired) {
            $payload['required'] = $required ? 1 : 0;
        }
        if ($hasSortOrder) {
            $payload['sort_order'] = $sortOrder;
        }
        if ($hasIsActive) {
            $payload['is_active'] = 1;
        }
        if ($hasUpdatedAt) {
            $payload['updated_at'] = now();
        }

        if ($existingRow !== null) {
            DB::table(self::FIELD_TABLE)
                ->where('id', (int) ($existingRow['id'] ?? 0))
                ->update($payload);

            return;
        }

        $payload['status_catalog_id'] = $statusCatalogId;
        if ($hasCreatedAt) {
            $payload['created_at'] = now();
        }

        DB::table(self::FIELD_TABLE)->insert($payload);
        $rows[] = array_merge($payload, ['id' => 0]);
    }

    private function resolveAnalysisStatusId(): ?int
    {
        if (! Schema::hasColumn(self::STATUS_TABLE, 'status_code')) {
            return null;
        }

        $query = DB::table(self::STATUS_TABLE)
            ->where('status_code', 'PHAN_TICH');
        if (Schema::hasColumn(self::STATUS_TABLE, 'canonical_status')) {
            $query->orWhere('canonical_status', 'PHAN_TICH');
        }

        return $this->parseNullableInt($query->orderBy('id')->value('id'));
    }

    private function normalizeToken(string $value): string
    {
        $normalized = trim(mb_strtolower($value));
        $normalized = str_replace(['đ', 'Đ'], 'd', $normalized);
        $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $normalized) ?: $normalized;

        return preg_replace('/[^a-z0-9]+/', '', strtolower($normalized)) ?: '';
    }

    private function parseNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_int($value)) {
            return $value;
        }

        return is_numeric($value) ? (int) $value : null;
    }
};
