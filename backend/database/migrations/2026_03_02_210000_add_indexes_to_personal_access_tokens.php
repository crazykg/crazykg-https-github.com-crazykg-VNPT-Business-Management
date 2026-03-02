<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE_NAME = 'personal_access_tokens';
    private const TOKENABLE_INDEX = 'idx_personal_access_tokens_tokenable';
    private const LEGACY_TOKENABLE_INDEX = 'personal_access_tokens_tokenable_type_tokenable_id_index';
    private const LAST_USED_AT_INDEX = 'idx_personal_access_tokens_last_used_at';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE_NAME)) {
            return;
        }

        if (
            Schema::hasColumn(self::TABLE_NAME, 'tokenable_type')
            && Schema::hasColumn(self::TABLE_NAME, 'tokenable_id')
            && ! $this->hasTokenableIndex()
        ) {
            Schema::table(self::TABLE_NAME, function (Blueprint $table): void {
                $table->index(['tokenable_type', 'tokenable_id'], self::TOKENABLE_INDEX);
            });
        }

        if (
            Schema::hasColumn(self::TABLE_NAME, 'last_used_at')
            && ! $this->hasIndexByColumns(['last_used_at'])
        ) {
            Schema::table(self::TABLE_NAME, function (Blueprint $table): void {
                $table->index('last_used_at', self::LAST_USED_AT_INDEX);
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE_NAME)) {
            return;
        }

        if ($this->indexExistsByName(self::TOKENABLE_INDEX)) {
            Schema::table(self::TABLE_NAME, function (Blueprint $table): void {
                $table->dropIndex(self::TOKENABLE_INDEX);
            });
        }

        if ($this->indexExistsByName(self::LAST_USED_AT_INDEX)) {
            Schema::table(self::TABLE_NAME, function (Blueprint $table): void {
                $table->dropIndex(self::LAST_USED_AT_INDEX);
            });
        }
    }

    private function hasTokenableIndex(): bool
    {
        return $this->indexExistsByName(self::TOKENABLE_INDEX)
            || $this->indexExistsByName(self::LEGACY_TOKENABLE_INDEX)
            || $this->hasIndexByColumns(['tokenable_type', 'tokenable_id']);
    }

    private function hasIndexByColumns(array $columns): bool
    {
        $expectedColumns = array_values(array_map(
            static fn ($column): string => strtolower((string) $column),
            $columns
        ));

        if ($expectedColumns === [] || ! Schema::hasTable(self::TABLE_NAME) || ! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return false;
        }

        $databaseName = DB::getDatabaseName();
        if (! is_string($databaseName) || $databaseName === '') {
            return false;
        }

        $signature = implode(',', $expectedColumns);

        return DB::table('information_schema.statistics')
            ->selectRaw("LOWER(index_name) as index_name, GROUP_CONCAT(LOWER(column_name) ORDER BY seq_in_index SEPARATOR ',') as column_signature")
            ->where('table_schema', $databaseName)
            ->where('table_name', self::TABLE_NAME)
            ->groupBy('index_name')
            ->havingRaw("GROUP_CONCAT(LOWER(column_name) ORDER BY seq_in_index SEPARATOR ',') = ?", [$signature])
            ->exists();
    }

    private function indexExistsByName(string $indexName): bool
    {
        $normalizedName = strtolower(trim($indexName));
        if ($normalizedName === '') {
            return false;
        }

        return array_key_exists($normalizedName, $this->getExistingIndexes());
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function getExistingIndexes(): array
    {
        if (! Schema::hasTable(self::TABLE_NAME) || ! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return [];
        }

        $databaseName = DB::getDatabaseName();
        if (! is_string($databaseName) || $databaseName === '') {
            return [];
        }

        $rows = DB::table('information_schema.statistics')
            ->select('index_name', 'seq_in_index', 'column_name')
            ->where('table_schema', $databaseName)
            ->where('table_name', self::TABLE_NAME)
            ->orderBy('index_name')
            ->orderBy('seq_in_index')
            ->get();

        $indexes = [];

        foreach ($rows as $row) {
            $indexName = strtolower(trim((string) ($row->index_name ?? '')));
            $seqInIndex = (int) ($row->seq_in_index ?? 0);
            $columnName = strtolower(trim((string) ($row->column_name ?? '')));

            if ($indexName === '' || $seqInIndex < 1 || $columnName === '') {
                continue;
            }

            $indexes[$indexName][$seqInIndex] = $columnName;
        }

        foreach ($indexes as &$indexColumns) {
            ksort($indexColumns);
            $indexColumns = array_values($indexColumns);
        }
        unset($indexColumns);

        return $indexes;
    }
};
