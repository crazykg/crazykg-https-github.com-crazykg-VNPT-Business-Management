<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_request_worklogs')) {
            return;
        }

        Schema::table('customer_request_worklogs', function (Blueprint $table): void {
            if (! Schema::hasColumn('customer_request_worklogs', 'work_date')) {
                $table->date('work_date')->nullable()->comment('Ngày thực hiện');
            }

            if (! Schema::hasColumn('customer_request_worklogs', 'activity_type_code')) {
                $table->string('activity_type_code', 50)->nullable()->comment('Mã loại công việc');
            }

            if (! Schema::hasColumn('customer_request_worklogs', 'is_billable')) {
                $table->boolean('is_billable')->nullable()->comment('Có tính phí khách hàng hay không');
            }

            if (! Schema::hasColumn('customer_request_worklogs', 'is_auto_transition')) {
                $table->boolean('is_auto_transition')->nullable()->comment('Worklog phát sinh từ auto transition');
            }

            if (! Schema::hasColumn('customer_request_worklogs', 'transition_id')) {
                $table->unsignedBigInteger('transition_id')->nullable()->comment('Transition liên quan nếu có');
            }
        });

        $this->addIndexIfMissing('customer_request_worklogs', ['request_case_id', 'work_date', 'id'], 'idx_crw_case_date_id');
        $this->addIndexIfMissing('customer_request_worklogs', ['status_instance_id', 'work_date', 'id'], 'idx_crw_instance_date_id');
        $this->addIndexIfMissing('customer_request_worklogs', ['performed_by_user_id', 'work_date', 'id'], 'idx_crw_performer_date_id');
        $this->addIndexIfMissing('customer_request_worklogs', ['is_billable', 'work_date', 'id'], 'idx_crw_billable_date_id');
        $this->addIndexIfMissing('customer_request_worklogs', ['activity_type_code', 'work_date', 'id'], 'idx_crw_activity_date_id');
    }

    public function down(): void
    {
        if (! Schema::hasTable('customer_request_worklogs')) {
            return;
        }

        foreach ([
            'idx_crw_case_date_id',
            'idx_crw_instance_date_id',
            'idx_crw_performer_date_id',
            'idx_crw_billable_date_id',
            'idx_crw_activity_date_id',
        ] as $indexName) {
            $this->dropIndexIfExists('customer_request_worklogs', $indexName);
        }

        Schema::table('customer_request_worklogs', function (Blueprint $table): void {
            foreach ([
                'work_date',
                'activity_type_code',
                'is_billable',
                'is_auto_transition',
                'transition_id',
            ] as $column) {
                if (Schema::hasColumn('customer_request_worklogs', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    private function addIndexIfMissing(string $tableName, array $columns, string $indexName): void
    {
        if (! Schema::hasTable($tableName) || $this->indexExists($tableName, $indexName)) {
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
