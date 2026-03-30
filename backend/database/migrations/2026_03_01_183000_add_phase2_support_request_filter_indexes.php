<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    private const TABLE = 'support_requests';

    /**
     * @var array<int, array{name:string, columns:array<int, string>}>
     */
    private const TARGET_INDEXES = [
        [
            'name' => 'idx_support_req_deleted_priority_requested_id',
            'columns' => ['deleted_at', 'priority', 'requested_date', 'id'],
        ],
        [
            'name' => 'idx_support_req_deleted_group_requested_id',
            'columns' => ['deleted_at', 'service_group_id', 'requested_date', 'id'],
        ],
        [
            'name' => 'idx_support_req_deleted_assignee_requested_id',
            'columns' => ['deleted_at', 'assignee_id', 'requested_date', 'id'],
        ],
        [
            'name' => 'idx_support_req_deleted_customer_requested_id',
            'columns' => ['deleted_at', 'customer_id', 'requested_date', 'id'],
        ],
    ];

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        foreach (self::TARGET_INDEXES as $targetIndex) {
            $indexName = $targetIndex['name'];
            $columns = $targetIndex['columns'];

            if (! $this->allColumnsExist(self::TABLE, $columns)) {
                continue;
            }

            if ($this->indexExistsByName(self::TABLE, $indexName)) {
                continue;
            }

            if ($this->indexExistsByExactColumns(self::TABLE, $columns)) {
                continue;
            }

            $this->createIndex(self::TABLE, $columns, $indexName);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        foreach (self::TARGET_INDEXES as $targetIndex) {
            $indexName = $targetIndex['name'];
            if (! $this->indexExistsByName(self::TABLE, $indexName)) {
                continue;
            }

            $this->dropIndexByName(self::TABLE, $indexName);
        }
    }

    /**
     * @param array<int, string> $columns
     */
    private function allColumnsExist(string $tableName, array $columns): bool
    {
        foreach ($columns as $column) {
            if (! Schema::hasColumn($tableName, $column)) {
                return false;
            }
        }

        return true;
    }

    private function indexExistsByName(string $tableName, string $indexName): bool
    {
        if (! $this->usingMysql()) {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', $tableName)
            ->where('index_name', $indexName)
            ->exists();
    }

    /**
     * @param array<int, string> $columns
     */
    private function indexExistsByExactColumns(string $tableName, array $columns): bool
    {
        if (! $this->usingMysql()) {
            return false;
        }

        $databaseName = DB::getDatabaseName();
        if (! is_string($databaseName) || $databaseName === '') {
            return false;
        }

        $target = implode(',', $columns);

        $rows = DB::table('information_schema.statistics')
            ->selectRaw('index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ",") AS index_columns')
            ->where('table_schema', $databaseName)
            ->where('table_name', $tableName)
            ->groupBy('index_name')
            ->get();

        foreach ($rows as $row) {
            if ((string) ($row->index_columns ?? '') === $target) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<int, string> $columns
     */
    private function createIndex(string $tableName, array $columns, string $indexName): void
    {
        if ($this->usingMysql()) {
            $quotedColumns = implode(', ', array_map(
                static fn (string $column): string => sprintf('`%s`', $column),
                $columns
            ));

            DB::statement(sprintf(
                'CREATE INDEX `%s` ON `%s` (%s) ALGORITHM=INPLACE LOCK=NONE',
                $indexName,
                $tableName,
                $quotedColumns
            ));

            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($columns, $indexName): void {
            $table->index($columns, $indexName);
        });
    }

    private function dropIndexByName(string $tableName, string $indexName): void
    {
        if ($this->usingMysql()) {
            DB::statement(sprintf(
                'ALTER TABLE `%s` DROP INDEX `%s`, ALGORITHM=INPLACE, LOCK=NONE',
                $tableName,
                $indexName
            ));

            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($indexName): void {
            $table->dropIndex($indexName);
        });
    }

    private function usingMysql(): bool
    {
        return DB::getDriverName() === 'mysql';
    }
};
