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
            if (! Schema::hasColumn('support_requests', 'reference_ticket_code')) {
                if (Schema::hasColumn('support_requests', 'ticket_code')) {
                    $table->string('reference_ticket_code', 100)
                        ->nullable()
                        ->after('ticket_code')
                        ->comment('Mã task/yêu cầu hỗ trợ được tham chiếu');
                } else {
                    $table->string('reference_ticket_code', 100)
                        ->nullable()
                        ->comment('Mã task/yêu cầu hỗ trợ được tham chiếu');
                }
            }

            if (! Schema::hasColumn('support_requests', 'reference_request_id')) {
                if (Schema::hasColumn('support_requests', 'reference_ticket_code')) {
                    $table->unsignedBigInteger('reference_request_id')
                        ->nullable()
                        ->after('reference_ticket_code')
                        ->comment('ID yêu cầu hỗ trợ được tham chiếu');
                } else {
                    $table->unsignedBigInteger('reference_request_id')
                        ->nullable()
                        ->comment('ID yêu cầu hỗ trợ được tham chiếu');
                }
            }
        });

        $this->addIndexIfExists('support_requests', ['reference_ticket_code'], 'idx_support_reference_ticket_code');
        $this->addIndexIfExists('support_requests', ['reference_request_id'], 'idx_support_reference_request_id');

        $this->addForeignKeyIfExists(
            table: 'support_requests',
            column: 'reference_request_id',
            foreignName: 'fk_support_reference_request',
            referencesTable: 'support_requests',
            referencesColumn: 'id'
        );

        $this->backfillSupportRequestReferenceData();
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_requests')) {
            return;
        }

        $this->dropForeignKeyIfExists('support_requests', 'fk_support_reference_request');
        $this->dropIndexIfExists('support_requests', 'idx_support_reference_request_id');
        $this->dropIndexIfExists('support_requests', 'idx_support_reference_ticket_code');

        Schema::table('support_requests', function (Blueprint $table): void {
            if (Schema::hasColumn('support_requests', 'reference_request_id')) {
                $table->dropColumn('reference_request_id');
            }

            if (Schema::hasColumn('support_requests', 'reference_ticket_code')) {
                $table->dropColumn('reference_ticket_code');
            }
        });
    }

    private function backfillSupportRequestReferenceData(): void
    {
        if (
            DB::getDriverName() !== 'mysql'
            || ! Schema::hasTable('support_requests')
            || ! Schema::hasColumn('support_requests', 'reference_ticket_code')
            || ! Schema::hasColumn('support_requests', 'reference_request_id')
            || ! Schema::hasColumn('support_requests', 'ticket_code')
            || ! Schema::hasColumn('support_requests', 'id')
        ) {
            return;
        }

        DB::statement(
            "UPDATE support_requests AS sr
             INNER JOIN (
                 SELECT ticket_code, MAX(id) AS reference_id
                 FROM support_requests
                 WHERE ticket_code IS NOT NULL AND ticket_code <> ''
                 GROUP BY ticket_code
             ) AS ref_map ON ref_map.ticket_code = sr.reference_ticket_code
             SET sr.reference_request_id = CASE
                 WHEN ref_map.reference_id = sr.id THEN NULL
                 ELSE ref_map.reference_id
             END
             WHERE sr.reference_request_id IS NULL
               AND sr.reference_ticket_code IS NOT NULL
               AND sr.reference_ticket_code <> ''"
        );

        DB::statement(
            "UPDATE support_requests AS sr
             INNER JOIN support_requests AS ref ON ref.id = sr.reference_request_id
             SET sr.reference_ticket_code = ref.ticket_code
             WHERE sr.reference_request_id IS NOT NULL
               AND (sr.reference_ticket_code IS NULL OR sr.reference_ticket_code = '')"
        );
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

