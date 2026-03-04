<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'support_requests';
    private const COLUMN = 'request_code';
    private const UNIQUE_INDEX = 'uniq_support_request_code';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        if (! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->string(self::COLUMN, 40)
                    ->nullable()
                    ->after('id')
                    ->comment('Mã yêu cầu tự sinh theo quy tắc YC{mm}{dd}{id}');
            });
        }

        $this->addUniqueIndexIfMissing(self::TABLE, self::COLUMN, self::UNIQUE_INDEX);
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        $this->dropUniqueIndexIfExists(self::TABLE, self::UNIQUE_INDEX);

        if (Schema::hasColumn(self::TABLE, self::COLUMN)) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->dropColumn(self::COLUMN);
            });
        }
    }

    private function addUniqueIndexIfMissing(string $table, string $column, string $indexName): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        if ($this->uniqueIndexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($column, $indexName): void {
            $blueprint->unique([$column], $indexName);
        });
    }

    private function dropUniqueIndexIfExists(string $table, string $indexName): void
    {
        if (! Schema::hasTable($table) || ! $this->uniqueIndexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($indexName): void {
            $blueprint->dropUnique($indexName);
        });
    }

    private function uniqueIndexExists(string $table, string $indexName): bool
    {
        if (! Schema::hasTable($table) || DB::getDriverName() !== 'mysql') {
            return false;
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->where('non_unique', 0)
            ->exists();
    }
};
