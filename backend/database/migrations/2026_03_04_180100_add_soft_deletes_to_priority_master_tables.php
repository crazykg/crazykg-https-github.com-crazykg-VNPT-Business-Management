<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<int, string> */
    private array $tables = [
        'departments',
        'customers',
        'vendors',
        'products',
        'customer_personnel',
        'documents',
    ];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table): void {
                if (! Schema::hasColumn($table, 'deleted_at')) {
                    $blueprint->softDeletes();
                }
            });

            $this->createIndexIfMissing(
                $table,
                sprintf('idx_%s_deleted_at', $table),
                sprintf('CREATE INDEX idx_%s_deleted_at ON %s (deleted_at)', $table, $table)
            );
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $this->dropIndexIfExists($table, sprintf('idx_%s_deleted_at', $table));

            Schema::table($table, function (Blueprint $blueprint) use ($table): void {
                if (Schema::hasColumn($table, 'deleted_at')) {
                    $blueprint->dropSoftDeletes();
                }
            });
        }
    }

    private function createIndexIfMissing(string $table, string $indexName, string $statement): void
    {
        if ($this->indexExists($table, $indexName)) {
            return;
        }

        DB::statement($statement);
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! $this->indexExists($table, $indexName)) {
            return;
        }

        DB::statement(sprintf('DROP INDEX %s ON %s', $indexName, $table));
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $database = DB::getDatabaseName();
        $record = DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->first();

        return $record !== null;
    }
};

