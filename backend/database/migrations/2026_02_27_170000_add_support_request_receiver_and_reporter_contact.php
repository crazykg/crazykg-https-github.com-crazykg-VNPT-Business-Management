<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_requests')) {
            return;
        }

        Schema::table('support_requests', function (Blueprint $table): void {
            if (! Schema::hasColumn('support_requests', 'reporter_contact_id')) {
                $table->unsignedBigInteger('reporter_contact_id')
                    ->nullable()
                    ->after('reporter_name')
                    ->comment('Tham chiếu người báo yêu cầu từ customer_personnel');
            }

            if (! Schema::hasColumn('support_requests', 'receiver_user_id')) {
                $table->unsignedBigInteger('receiver_user_id')
                    ->nullable()
                    ->after('assignee_id')
                    ->comment('Người tiếp nhận mặc định theo vai trò A trong RACI dự án');
            }
        });

        $this->addIndexIfExists('support_requests', ['reporter_contact_id'], 'idx_support_reporter_contact');
        $this->addIndexIfExists('support_requests', ['receiver_user_id'], 'idx_support_receiver_user');

        $this->addForeignKeyIfExists(
            table: 'support_requests',
            column: 'reporter_contact_id',
            foreignName: 'fk_support_reporter_contact',
            referencesTable: 'customer_personnel',
        );
        $this->addForeignKeyIfExists(
            table: 'support_requests',
            column: 'receiver_user_id',
            foreignName: 'fk_support_receiver_user',
            referencesTable: 'internal_users',
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_requests')) {
            return;
        }

        $this->dropForeignKeyIfExists('support_requests', 'fk_support_reporter_contact');
        $this->dropForeignKeyIfExists('support_requests', 'fk_support_receiver_user');

        $this->dropIndexIfExists('support_requests', 'idx_support_reporter_contact');
        $this->dropIndexIfExists('support_requests', 'idx_support_receiver_user');

        Schema::table('support_requests', function (Blueprint $table): void {
            if (Schema::hasColumn('support_requests', 'reporter_contact_id')) {
                $table->dropColumn('reporter_contact_id');
            }

            if (Schema::hasColumn('support_requests', 'receiver_user_id')) {
                $table->dropColumn('receiver_user_id');
            }
        });
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

    private function addForeignKeyIfExists(
        string $table,
        string $column,
        string $foreignName,
        string $referencesTable,
        string $referencesColumn = 'id'
    ): void {
        if (
            ! Schema::hasTable($table)
            || ! Schema::hasTable($referencesTable)
            || ! Schema::hasColumn($table, $column)
            || ! Schema::hasColumn($referencesTable, $referencesColumn)
            || $this->foreignKeyExists($table, $foreignName)
        ) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use (
            $column,
            $foreignName,
            $referencesTable,
            $referencesColumn
        ): void {
            $blueprint->foreign($column, $foreignName)
                ->references($referencesColumn)
                ->on($referencesTable)
                ->nullOnDelete();
        });
    }

    private function dropForeignKeyIfExists(string $table, string $foreignName): void
    {
        if (! Schema::hasTable($table) || ! $this->foreignKeyExists($table, $foreignName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($foreignName): void {
            $blueprint->dropForeign($foreignName);
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

    private function foreignKeyExists(string $table, string $foreignName): bool
    {
        if (! Schema::hasTable($table) || DB::getDriverName() !== 'mysql') {
            return false;
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.referential_constraints')
            ->where('constraint_schema', $database)
            ->where('table_name', $table)
            ->where('constraint_name', $foreignName)
            ->exists();
    }
};
