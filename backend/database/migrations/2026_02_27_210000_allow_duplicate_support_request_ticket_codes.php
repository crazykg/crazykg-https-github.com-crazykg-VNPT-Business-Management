<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable('support_requests')
            || ! Schema::hasColumn('support_requests', 'ticket_code')
            || DB::getDriverName() !== 'mysql'
        ) {
            return;
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return;
        }

        $uniqueIndexes = DB::table('information_schema.statistics')
            ->selectRaw('`index_name` as idx_name')
            ->where('table_schema', $database)
            ->where('table_name', 'support_requests')
            ->where('column_name', 'ticket_code')
            ->where('non_unique', 0)
            ->pluck('idx_name')
            ->filter(fn ($name): bool => is_string($name) && $name !== 'PRIMARY')
            ->unique()
            ->values();

        foreach ($uniqueIndexes as $indexName) {
            DB::statement(sprintf(
                'ALTER TABLE `support_requests` DROP INDEX `%s`',
                str_replace('`', '``', (string) $indexName)
            ));
        }

        if (! $this->indexExists('support_requests', 'idx_support_ticket_code')) {
            Schema::table('support_requests', function (Blueprint $table): void {
                $table->index(['ticket_code'], 'idx_support_ticket_code');
            });
        }
    }

    public function down(): void
    {
        // No-op: unique constraint cannot be safely restored if duplicate ticket_code exists.
    }

    private function indexExists(string $table, string $indexName): bool
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
            ->exists();
    }
};
