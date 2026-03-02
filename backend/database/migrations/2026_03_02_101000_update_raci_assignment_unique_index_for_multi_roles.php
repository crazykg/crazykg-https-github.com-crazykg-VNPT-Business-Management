<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! $this->canManageRaciUniqueIndex()) {
            return;
        }

        $this->dropIndexIfExists('raci_assignments', 'uq_raci_entity_user');
        $this->addUniqueIndexIfMissing(
            'raci_assignments',
            ['entity_type', 'entity_id', 'user_id', 'raci_role'],
            'uq_raci_entity_user_role'
        );
    }

    public function down(): void
    {
        if (! $this->canManageRaciUniqueIndex()) {
            return;
        }

        $this->dropIndexIfExists('raci_assignments', 'uq_raci_entity_user_role');
        $this->addUniqueIndexIfMissing(
            'raci_assignments',
            ['entity_type', 'entity_id', 'user_id'],
            'uq_raci_entity_user'
        );
    }

    private function canManageRaciUniqueIndex(): bool
    {
        if (! Schema::hasTable('raci_assignments')) {
            return false;
        }

        foreach (['entity_type', 'entity_id', 'user_id', 'raci_role'] as $column) {
            if (! Schema::hasColumn('raci_assignments', $column)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param array<int, string> $columns
     */
    private function addUniqueIndexIfMissing(string $table, array $columns, string $indexName): void
    {
        if ($this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $tableBlueprint) use ($columns, $indexName): void {
            $tableBlueprint->unique($columns, $indexName);
        });
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! $this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $tableBlueprint) use ($indexName): void {
            $tableBlueprint->dropIndex($indexName);
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        if (DB::getDriverName() !== 'mysql') {
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
