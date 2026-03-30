<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    private const SUPPORT_TABLE = 'support_requests';
    private const PROGRAMMING_TABLE = 'programming_requests';
    private const SUPPORT_INDEX = 'idx_support_req_deleted_status_requested_id';
    private const PROGRAMMING_INDEX = 'idx_prog_req_deleted_status_id';

    public function up(): void
    {
        if (Schema::hasTable(self::SUPPORT_TABLE) && ! $this->indexExists(self::SUPPORT_TABLE, self::SUPPORT_INDEX)) {
            $this->createIndex(
                self::SUPPORT_TABLE,
                ['deleted_at', 'status', 'requested_date', 'id'],
                self::SUPPORT_INDEX
            );
        }

        if (Schema::hasTable(self::PROGRAMMING_TABLE) && ! $this->indexExists(self::PROGRAMMING_TABLE, self::PROGRAMMING_INDEX)) {
            $this->createIndex(
                self::PROGRAMMING_TABLE,
                ['deleted_at', 'status', 'id'],
                self::PROGRAMMING_INDEX
            );
        }
    }

    public function down(): void
    {
        if (Schema::hasTable(self::SUPPORT_TABLE) && $this->indexExists(self::SUPPORT_TABLE, self::SUPPORT_INDEX)) {
            $this->dropIndexByName(self::SUPPORT_TABLE, self::SUPPORT_INDEX);
        }

        if (Schema::hasTable(self::PROGRAMMING_TABLE) && $this->indexExists(self::PROGRAMMING_TABLE, self::PROGRAMMING_INDEX)) {
            $this->dropIndexByName(self::PROGRAMMING_TABLE, self::PROGRAMMING_INDEX);
        }
    }

    private function indexExists(string $tableName, string $indexName): bool
    {
        if (! Schema::hasTable($tableName)) {
            return false;
        }

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
