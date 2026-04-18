<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLES = [
        'product_features',
        'product_package_features',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            $this->expandFeatureNameColumn($table);
        }
    }

    public function down(): void
    {
        // No-op: shrinking feature_name back to VARCHAR(255) is unsafe once longer values exist.
    }

    private function expandFeatureNameColumn(string $table): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'feature_name')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement(sprintf('ALTER TABLE `%s` MODIFY `feature_name` TEXT NOT NULL', $table));

            return;
        }

        if ($driver === 'pgsql') {
            DB::statement(sprintf('ALTER TABLE "%s" ALTER COLUMN "feature_name" TYPE TEXT', $table));
            DB::statement(sprintf('ALTER TABLE "%s" ALTER COLUMN "feature_name" SET NOT NULL', $table));

            return;
        }

        if ($driver === 'sqlsrv') {
            DB::statement(sprintf('ALTER TABLE [%s] ALTER COLUMN [feature_name] NVARCHAR(MAX) NOT NULL', $table));

            return;
        }

        // SQLite stores strings as TEXT affinity already, so no schema rewrite is required here.
    }
};
