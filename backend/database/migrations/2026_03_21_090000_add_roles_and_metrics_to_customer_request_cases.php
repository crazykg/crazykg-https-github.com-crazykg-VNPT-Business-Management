<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_request_cases')) {
            return;
        }

        Schema::table('customer_request_cases', function (Blueprint $table): void {
            if (! Schema::hasColumn('customer_request_cases', 'dispatcher_user_id')) {
                $table->unsignedBigInteger('dispatcher_user_id')->nullable()->comment('Người điều phối chính');
            }

            if (! Schema::hasColumn('customer_request_cases', 'performer_user_id')) {
                $table->unsignedBigInteger('performer_user_id')->nullable()->comment('Người đang xử lý hiện tại');
            }

            if (! Schema::hasColumn('customer_request_cases', 'estimated_hours')) {
                $table->decimal('estimated_hours', 8, 2)->nullable()->comment('Ước lượng giờ hiện hành');
            }

            if (! Schema::hasColumn('customer_request_cases', 'estimated_by_user_id')) {
                $table->unsignedBigInteger('estimated_by_user_id')->nullable()->comment('Người chốt estimate hiện hành');
            }

            if (! Schema::hasColumn('customer_request_cases', 'estimated_at')) {
                $table->dateTime('estimated_at')->nullable()->comment('Thời điểm chốt estimate hiện hành');
            }

            if (! Schema::hasColumn('customer_request_cases', 'total_hours_spent')) {
                $table->decimal('total_hours_spent', 8, 2)->default(0)->comment('Tổng giờ thực tế được denormalize từ worklog');
            }
        });

        $this->addIndexIfMissing('customer_request_cases', ['current_status_code', 'updated_at', 'id'], 'idx_crc_status_updated_id');
        $this->addIndexIfMissing('customer_request_cases', ['performer_user_id', 'current_status_code', 'updated_at', 'id'], 'idx_crc_performer_status_updated_id');
        $this->addIndexIfMissing('customer_request_cases', ['dispatcher_user_id', 'current_status_code', 'updated_at', 'id'], 'idx_crc_dispatcher_status_updated_id');
        $this->addIndexIfMissing('customer_request_cases', ['created_by', 'current_status_code', 'updated_at', 'id'], 'idx_crc_creator_status_updated_id');
        $this->addIndexIfMissing('customer_request_cases', ['received_by_user_id', 'current_status_code', 'updated_at', 'id'], 'idx_crc_receiver_status_updated_id');
    }

    public function down(): void
    {
        if (! Schema::hasTable('customer_request_cases')) {
            return;
        }

        foreach ([
            'idx_crc_status_updated_id',
            'idx_crc_performer_status_updated_id',
            'idx_crc_dispatcher_status_updated_id',
            'idx_crc_creator_status_updated_id',
            'idx_crc_receiver_status_updated_id',
        ] as $indexName) {
            $this->dropIndexIfExists('customer_request_cases', $indexName);
        }

        Schema::table('customer_request_cases', function (Blueprint $table): void {
            foreach ([
                'dispatcher_user_id',
                'performer_user_id',
                'estimated_hours',
                'estimated_by_user_id',
                'estimated_at',
                'total_hours_spent',
            ] as $column) {
                if (Schema::hasColumn('customer_request_cases', $column)) {
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
