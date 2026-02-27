<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addIndexIfExists('support_requests', ['deleted_at', 'requested_date', 'id'], 'idx_support_req_deleted_requested_id');
        $this->addIndexIfExists('support_requests', ['requested_date', 'id'], 'idx_support_req_requested_id');
        $this->addIndexIfExists('support_request_history', ['created_at', 'id'], 'idx_support_hist_created_id');
        $this->addIndexIfExists('support_request_history', ['request_id', 'created_at', 'id'], 'idx_support_hist_request_created_id');
    }

    public function down(): void
    {
        $this->dropIndexIfExists('support_requests', 'idx_support_req_deleted_requested_id');
        $this->dropIndexIfExists('support_requests', 'idx_support_req_requested_id');
        $this->dropIndexIfExists('support_request_history', 'idx_support_hist_created_id');
        $this->dropIndexIfExists('support_request_history', 'idx_support_hist_request_created_id');
    }

    /**
     * @param array<int, string> $columns
     */
    private function addIndexIfExists(string $table, array $columns, string $indexName): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        foreach ($columns as $column) {
            if (! Schema::hasColumn($table, $column)) {
                return;
            }
        }

        if ($this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns, $indexName): void {
            $blueprint->index($columns, $indexName);
        });
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! Schema::hasTable($table) || ! $this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($indexName): void {
            $blueprint->dropIndex($indexName);
        });
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
