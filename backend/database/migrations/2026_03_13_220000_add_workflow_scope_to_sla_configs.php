<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'sla_configs';
    private const INDEX_SERVICE_GROUP = 'idx_sla_service_group_scope';
    private const INDEX_WORKFLOW_ACTION = 'idx_sla_workflow_action_scope';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            if (! Schema::hasColumn(self::TABLE, 'service_group_id')) {
                $table->unsignedBigInteger('service_group_id')->nullable()->after('request_type_prefix');
            }
            if (! Schema::hasColumn(self::TABLE, 'workflow_action_code')) {
                $table->string('workflow_action_code', 80)->nullable()->after('service_group_id');
            }
        });

        $this->createIndexIfMissing(self::INDEX_SERVICE_GROUP, ['service_group_id', 'status', 'priority', 'is_active']);
        $this->createIndexIfMissing(self::INDEX_WORKFLOW_ACTION, ['workflow_action_code', 'status', 'priority', 'is_active']);
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        $this->dropIndexIfExists(self::INDEX_SERVICE_GROUP);
        $this->dropIndexIfExists(self::INDEX_WORKFLOW_ACTION);

        Schema::table(self::TABLE, function (Blueprint $table): void {
            if (Schema::hasColumn(self::TABLE, 'workflow_action_code')) {
                $table->dropColumn('workflow_action_code');
            }
            if (Schema::hasColumn(self::TABLE, 'service_group_id')) {
                $table->dropColumn('service_group_id');
            }
        });
    }

    /**
     * @param array<int, string> $columns
     */
    private function createIndexIfMissing(string $indexName, array $columns): void
    {
        if ($this->indexExists($indexName)) {
            return;
        }

        $quotedColumns = implode('`, `', $columns);
        DB::statement(sprintf(
            'CREATE INDEX `%s` ON `%s` (`%s`)',
            $indexName,
            self::TABLE,
            $quotedColumns
        ));
    }

    private function dropIndexIfExists(string $indexName): void
    {
        if (! $this->indexExists($indexName)) {
            return;
        }

        DB::statement(sprintf('DROP INDEX `%s` ON `%s`', $indexName, self::TABLE));
    }

    private function indexExists(string $indexName): bool
    {
        $driver = DB::getDriverName();
        $database = DB::getDatabaseName();
        if ($driver !== 'mysql' || ! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', self::TABLE)
            ->where('index_name', $indexName)
            ->exists();
    }
};
