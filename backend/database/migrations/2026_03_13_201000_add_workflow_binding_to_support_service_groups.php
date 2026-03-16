<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_service_groups')) {
            return;
        }

        Schema::table('support_service_groups', function (Blueprint $table): void {
            if (! Schema::hasColumn('support_service_groups', 'workflow_status_catalog_id')) {
                $table->unsignedBigInteger('workflow_status_catalog_id')->nullable()->after('customer_id');
            }

            if (! Schema::hasColumn('support_service_groups', 'workflow_form_key')) {
                $table->string('workflow_form_key', 120)->nullable()->after('workflow_status_catalog_id');
            }
        });

        if (! $this->indexExists('support_service_groups', 'idx_support_service_groups_workflow_status_catalog_id')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->index('workflow_status_catalog_id', 'idx_support_service_groups_workflow_status_catalog_id');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_service_groups')) {
            return;
        }

        if ($this->indexExists('support_service_groups', 'idx_support_service_groups_workflow_status_catalog_id')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->dropIndex('idx_support_service_groups_workflow_status_catalog_id');
            });
        }

        Schema::table('support_service_groups', function (Blueprint $table): void {
            if (Schema::hasColumn('support_service_groups', 'workflow_form_key')) {
                $table->dropColumn('workflow_form_key');
            }
            if (Schema::hasColumn('support_service_groups', 'workflow_status_catalog_id')) {
                $table->dropColumn('workflow_status_catalog_id');
            }
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
