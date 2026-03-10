<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_service_groups') || ! Schema::hasTable('customers')) {
            return;
        }

        if (! Schema::hasColumn('support_service_groups', 'customer_id')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->unsignedBigInteger('customer_id')->nullable()->after('group_code');
            });
        }

        if ($this->indexExists('support_service_groups', 'uq_support_service_groups_group_name')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->dropUnique('uq_support_service_groups_group_name');
            });
        }

        if ($this->indexExists('support_service_groups', 'uq_support_service_groups_group_code')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->dropUnique('uq_support_service_groups_group_code');
            });
        }

        if (! $this->indexExists('support_service_groups', 'idx_support_service_groups_customer_id')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->index('customer_id', 'idx_support_service_groups_customer_id');
            });
        }

        if (! $this->foreignKeyExists('support_service_groups', 'fk_support_service_groups_customer')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->foreign('customer_id', 'fk_support_service_groups_customer')
                    ->references('id')
                    ->on('customers')
                    ->nullOnDelete();
            });
        }

        if (
            Schema::hasColumn('support_service_groups', 'customer_id')
            && Schema::hasColumn('support_service_groups', 'group_code')
            && ! $this->indexExists('support_service_groups', 'uq_support_service_groups_customer_group_code')
        ) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->unique(['customer_id', 'group_code'], 'uq_support_service_groups_customer_group_code');
            });
        }

        if (
            Schema::hasColumn('support_service_groups', 'customer_id')
            && Schema::hasColumn('support_service_groups', 'group_name')
            && ! $this->indexExists('support_service_groups', 'uq_support_service_groups_customer_group_name')
        ) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->unique(['customer_id', 'group_name'], 'uq_support_service_groups_customer_group_name');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_service_groups')) {
            return;
        }

        if ($this->indexExists('support_service_groups', 'uq_support_service_groups_customer_group_name')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->dropUnique('uq_support_service_groups_customer_group_name');
            });
        }

        if ($this->indexExists('support_service_groups', 'uq_support_service_groups_customer_group_code')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->dropUnique('uq_support_service_groups_customer_group_code');
            });
        }

        if ($this->foreignKeyExists('support_service_groups', 'fk_support_service_groups_customer')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->dropForeign('fk_support_service_groups_customer');
            });
        }

        if ($this->indexExists('support_service_groups', 'idx_support_service_groups_customer_id')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->dropIndex('idx_support_service_groups_customer_id');
            });
        }

        if (Schema::hasColumn('support_service_groups', 'customer_id')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->dropColumn('customer_id');
            });
        }

        if (
            Schema::hasColumn('support_service_groups', 'group_code')
            && ! $this->indexExists('support_service_groups', 'uq_support_service_groups_group_code')
        ) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->unique('group_code', 'uq_support_service_groups_group_code');
            });
        }

        if (
            Schema::hasColumn('support_service_groups', 'group_name')
            && ! $this->indexExists('support_service_groups', 'uq_support_service_groups_group_name')
        ) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->unique('group_name', 'uq_support_service_groups_group_name');
            });
        }
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

    private function foreignKeyExists(string $table, string $constraintName): bool
    {
        if (! Schema::hasTable($table) || DB::getDriverName() !== 'mysql') {
            return false;
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.table_constraints')
            ->where('constraint_schema', $database)
            ->where('table_name', $table)
            ->where('constraint_name', $constraintName)
            ->where('constraint_type', 'FOREIGN KEY')
            ->exists();
    }
};
