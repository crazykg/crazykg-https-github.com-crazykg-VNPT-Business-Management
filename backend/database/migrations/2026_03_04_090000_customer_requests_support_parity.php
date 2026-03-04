<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_requests')) {
            return;
        }

        Schema::table('customer_requests', function (Blueprint $table): void {
            if (! Schema::hasColumn('customer_requests', 'project_item_id')) {
                $table->unsignedBigInteger('project_item_id')->nullable()->after('service_group_id');
            }
            if (! Schema::hasColumn('customer_requests', 'project_id')) {
                $table->unsignedBigInteger('project_id')->nullable()->after('project_item_id');
            }
            if (! Schema::hasColumn('customer_requests', 'product_id')) {
                $table->unsignedBigInteger('product_id')->nullable()->after('project_id');
            }
            if (! Schema::hasColumn('customer_requests', 'reporter_contact_id')) {
                $table->unsignedBigInteger('reporter_contact_id')->nullable()->after('requester_name');
            }
            if (! Schema::hasColumn('customer_requests', 'reference_ticket_code')) {
                $table->string('reference_ticket_code', 100)->nullable()->after('latest_transition_id');
            }
            if (! Schema::hasColumn('customer_requests', 'reference_request_id')) {
                $table->unsignedBigInteger('reference_request_id')->nullable()->after('reference_ticket_code');
            }
        });

        $this->createIndexIfMissing(
            'customer_requests',
            'idx_cr_project_item_deleted',
            'CREATE INDEX `idx_cr_project_item_deleted` ON `customer_requests` (`project_item_id`, `deleted_at`)'
        );
        $this->createIndexIfMissing(
            'customer_requests',
            'idx_cr_reporter_contact_deleted',
            'CREATE INDEX `idx_cr_reporter_contact_deleted` ON `customer_requests` (`reporter_contact_id`, `deleted_at`)'
        );
        $this->createIndexIfMissing(
            'customer_requests',
            'idx_cr_reference_ticket_code',
            'CREATE INDEX `idx_cr_reference_ticket_code` ON `customer_requests` (`reference_ticket_code`)'
        );
        $this->createIndexIfMissing(
            'customer_requests',
            'idx_cr_reference_request_id',
            'CREATE INDEX `idx_cr_reference_request_id` ON `customer_requests` (`reference_request_id`)'
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable('customer_requests')) {
            return;
        }

        $this->dropIndexIfExists('customer_requests', 'idx_cr_project_item_deleted');
        $this->dropIndexIfExists('customer_requests', 'idx_cr_reporter_contact_deleted');
        $this->dropIndexIfExists('customer_requests', 'idx_cr_reference_ticket_code');
        $this->dropIndexIfExists('customer_requests', 'idx_cr_reference_request_id');

        Schema::table('customer_requests', function (Blueprint $table): void {
            if (Schema::hasColumn('customer_requests', 'reference_request_id')) {
                $table->dropColumn('reference_request_id');
            }
            if (Schema::hasColumn('customer_requests', 'reference_ticket_code')) {
                $table->dropColumn('reference_ticket_code');
            }
            if (Schema::hasColumn('customer_requests', 'reporter_contact_id')) {
                $table->dropColumn('reporter_contact_id');
            }
            if (Schema::hasColumn('customer_requests', 'product_id')) {
                $table->dropColumn('product_id');
            }
            if (Schema::hasColumn('customer_requests', 'project_id')) {
                $table->dropColumn('project_id');
            }
            if (Schema::hasColumn('customer_requests', 'project_item_id')) {
                $table->dropColumn('project_item_id');
            }
        });
    }

    private function createIndexIfMissing(string $table, string $indexName, string $sql): void
    {
        if ($this->indexExists($table, $indexName)) {
            return;
        }
        DB::statement($sql);
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! $this->indexExists($table, $indexName)) {
            return;
        }
        DB::statement(sprintf('DROP INDEX `%s` ON `%s`', $indexName, $table));
    }

    private function indexExists(string $table, string $indexName): bool
    {
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
