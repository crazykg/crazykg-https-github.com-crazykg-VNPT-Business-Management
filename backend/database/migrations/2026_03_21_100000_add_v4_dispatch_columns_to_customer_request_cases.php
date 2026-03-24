<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * V4 Migration P1.1
 * Add dispatch_route, dispatched_at, performer_accepted_at to customer_request_cases.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_request_cases')) {
            return;
        }

        Schema::table('customer_request_cases', function (Blueprint $table): void {
            if (! Schema::hasColumn('customer_request_cases', 'dispatch_route')) {
                $table->string('dispatch_route', 30)
                    ->nullable()
                    ->comment("Luồng xử lý: 'self_handle' | 'assign_pm' | 'assign_direct'");
            }

            if (! Schema::hasColumn('customer_request_cases', 'dispatched_at')) {
                $table->dateTime('dispatched_at')
                    ->nullable()
                    ->comment('Thời điểm PM phân công performer');
            }

            if (! Schema::hasColumn('customer_request_cases', 'performer_accepted_at')) {
                $table->dateTime('performer_accepted_at')
                    ->nullable()
                    ->comment('Thời điểm performer nhận việc');
            }
        });

        $this->addIndexIfMissing(
            'customer_request_cases',
            ['dispatch_route'],
            'idx_crc_dispatch_route'
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable('customer_request_cases')) {
            return;
        }

        $this->dropIndexIfExists('customer_request_cases', 'idx_crc_dispatch_route');

        Schema::table('customer_request_cases', function (Blueprint $table): void {
            foreach (['dispatch_route', 'dispatched_at', 'performer_accepted_at'] as $column) {
                if (Schema::hasColumn('customer_request_cases', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function addIndexIfMissing(string $table, array $columns, string $name): void
    {
        if (! Schema::hasTable($table) || $this->indexExists($table, $name)) {
            return;
        }

        Schema::table($table, function (Blueprint $t) use ($columns, $name): void {
            $t->index($columns, $name);
        });
    }

    private function dropIndexIfExists(string $table, string $name): void
    {
        if (! Schema::hasTable($table) || ! $this->indexExists($table, $name)) {
            return;
        }

        Schema::table($table, function (Blueprint $t) use ($name): void {
            $t->dropIndex($name);
        });
    }

    private function indexExists(string $table, string $name): bool
    {
        return match (DB::getDriverName()) {
            'sqlite' => $this->sqliteIndexExists($table, $name),
            'mysql'  => ! empty(DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$name])),
            'pgsql'  => ! empty(DB::select(
                'SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = ? AND indexname = ?',
                [$table, $name]
            )),
            default => false,
        };
    }

    private function sqliteIndexExists(string $table, string $name): bool
    {
        foreach (DB::select("PRAGMA index_list('{$table}')") as $row) {
            if (($row->name ?? null) === $name) {
                return true;
            }
        }

        return false;
    }
};
