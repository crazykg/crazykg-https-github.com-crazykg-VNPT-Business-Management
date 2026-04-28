<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addIndexIfMissing('customers', ['deleted_at', 'customer_name'], 'idx_customers_deleted_name');
        $this->addIndexIfMissing('projects', ['deleted_at', 'project_name'], 'idx_projects_deleted_name');
        $this->addIndexIfMissing('products', ['deleted_at', 'product_name'], 'idx_products_deleted_name');
    }

    public function down(): void
    {
        $this->dropIndexIfExists('customers', 'idx_customers_deleted_name');
        $this->dropIndexIfExists('projects', 'idx_projects_deleted_name');
        $this->dropIndexIfExists('products', 'idx_products_deleted_name');
    }

    private function addIndexIfMissing(string $tableName, array $columns, string $indexName): void
    {
        if (! Schema::hasTable($tableName) || $this->indexExists($tableName, $indexName)) {
            return;
        }

        $missingColumns = collect($columns)
            ->contains(fn (string $column): bool => ! Schema::hasColumn($tableName, $column));

        if ($missingColumns) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($columns, $indexName): void {
            $table->index($columns, $indexName);
        });
    }

    private function dropIndexIfExists(string $tableName, string $indexName): void
    {
        if (! Schema::hasTable($tableName) || ! $this->indexExists($tableName, $indexName)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($indexName): void {
            $table->dropIndex($indexName);
        });
    }

    private function indexExists(string $tableName, string $indexName): bool
    {
        $driver = DB::getDriverName();

        return match ($driver) {
            'sqlite' => $this->sqliteIndexExists($tableName, $indexName),
            'mysql' => ! empty(DB::select("SHOW INDEX FROM `{$tableName}` WHERE Key_name = ?", [$indexName])),
            'pgsql' => ! empty(DB::select(
                'SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = ? AND indexname = ?',
                [$tableName, $indexName]
            )),
            default => false,
        };
    }

    private function sqliteIndexExists(string $tableName, string $indexName): bool
    {
        $rows = DB::select("PRAGMA index_list('{$tableName}')");

        foreach ($rows as $row) {
            if (($row->name ?? null) === $indexName) {
                return true;
            }
        }

        return false;
    }
};
