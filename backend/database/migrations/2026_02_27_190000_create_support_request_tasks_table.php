<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_requests') || Schema::hasTable('support_request_tasks')) {
            return;
        }

        Schema::create('support_request_tasks', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('request_id')->comment('Yêu cầu hỗ trợ cha');
            $table->string('title', 255)->nullable()->comment('Nội dung task con');
            $table->string('task_code', 100)->nullable()->comment('Mã task');
            $table->text('task_link')->nullable()->comment('Liên kết task');
            $table->string('status', 30)->default('TODO')->comment('TODO|IN_PROGRESS|DONE|BLOCKED|CANCELLED');
            $table->unsignedInteger('sort_order')->default(0)->comment('Thứ tự hiển thị task');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        $this->addIndexIfExists('support_request_tasks', ['request_id'], 'idx_support_tasks_request');
        $this->addIndexIfExists('support_request_tasks', ['status'], 'idx_support_tasks_status');
        $this->addIndexIfExists('support_request_tasks', ['request_id', 'sort_order'], 'idx_support_tasks_request_sort');

        $this->addForeignKeyIfExists(
            table: 'support_request_tasks',
            column: 'request_id',
            foreignName: 'fk_support_tasks_request',
            referencesTable: 'support_requests',
            onDeleteCascade: true
        );

        $this->addForeignKeyIfExists(
            table: 'support_request_tasks',
            column: 'created_by',
            foreignName: 'fk_support_tasks_created_by',
            referencesTable: 'internal_users',
            onDeleteCascade: false
        );

        $this->addForeignKeyIfExists(
            table: 'support_request_tasks',
            column: 'updated_by',
            foreignName: 'fk_support_tasks_updated_by',
            referencesTable: 'internal_users',
            onDeleteCascade: false
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_request_tasks')) {
            return;
        }

        $this->dropForeignKeyIfExists('support_request_tasks', 'fk_support_tasks_request');
        $this->dropForeignKeyIfExists('support_request_tasks', 'fk_support_tasks_created_by');
        $this->dropForeignKeyIfExists('support_request_tasks', 'fk_support_tasks_updated_by');

        $this->dropIndexIfExists('support_request_tasks', 'idx_support_tasks_request');
        $this->dropIndexIfExists('support_request_tasks', 'idx_support_tasks_status');
        $this->dropIndexIfExists('support_request_tasks', 'idx_support_tasks_request_sort');

        Schema::dropIfExists('support_request_tasks');
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
        string $referencesColumn = 'id',
        bool $onDeleteCascade = false
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
            $referencesColumn,
            $onDeleteCascade
        ): void {
            $foreign = $blueprint->foreign($column, $foreignName)
                ->references($referencesColumn)
                ->on($referencesTable);

            if ($onDeleteCascade) {
                $foreign->cascadeOnDelete();
            } else {
                $foreign->nullOnDelete();
            }
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

