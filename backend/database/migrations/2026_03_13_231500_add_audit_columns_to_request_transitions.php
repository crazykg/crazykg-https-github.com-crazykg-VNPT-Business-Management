<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'request_transitions';
    private const INDEX_ACTION = 'idx_request_transitions_action_code';
    private const INDEX_TO_STATUS = 'idx_request_transitions_to_status_catalog';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            if (! Schema::hasColumn(self::TABLE, 'from_status_catalog_id')) {
                $table->unsignedBigInteger('from_status_catalog_id')->nullable()->after('project_item_id');
            }
            if (! Schema::hasColumn(self::TABLE, 'to_status_catalog_id')) {
                $table->unsignedBigInteger('to_status_catalog_id')->nullable()->after('from_status_catalog_id');
            }
            if (! Schema::hasColumn(self::TABLE, 'workflow_action_code')) {
                $table->string('workflow_action_code', 80)->nullable()->after('sub_status');
            }
            if (! Schema::hasColumn(self::TABLE, 'workflow_reason')) {
                $table->text('workflow_reason')->nullable()->after('workflow_action_code');
            }
            if (! Schema::hasColumn(self::TABLE, 'viewer_role_context_json')) {
                $table->json('viewer_role_context_json')->nullable()->after('workflow_reason');
            }
        });

        $this->createIndexIfMissing(self::INDEX_ACTION, ['workflow_action_code']);
        $this->createIndexIfMissing(self::INDEX_TO_STATUS, ['to_status_catalog_id', 'created_at']);

        if (Schema::hasColumn(self::TABLE, 'workflow_reason')) {
            DB::table(self::TABLE)
                ->whereNull('workflow_reason')
                ->update([
                    'workflow_reason' => DB::raw('COALESCE(transition_note, internal_note)'),
                ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        $this->dropIndexIfExists(self::INDEX_ACTION);
        $this->dropIndexIfExists(self::INDEX_TO_STATUS);

        Schema::table(self::TABLE, function (Blueprint $table): void {
            if (Schema::hasColumn(self::TABLE, 'viewer_role_context_json')) {
                $table->dropColumn('viewer_role_context_json');
            }
            if (Schema::hasColumn(self::TABLE, 'workflow_reason')) {
                $table->dropColumn('workflow_reason');
            }
            if (Schema::hasColumn(self::TABLE, 'workflow_action_code')) {
                $table->dropColumn('workflow_action_code');
            }
            if (Schema::hasColumn(self::TABLE, 'to_status_catalog_id')) {
                $table->dropColumn('to_status_catalog_id');
            }
            if (Schema::hasColumn(self::TABLE, 'from_status_catalog_id')) {
                $table->dropColumn('from_status_catalog_id');
            }
        });
    }

    /**
     * @param array<int,string> $columns
     */
    private function createIndexIfMissing(string $indexName, array $columns): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        $sm = Schema::getConnection()->getSchemaBuilder();
        $indexes = method_exists($sm, 'getIndexes') ? $sm->getIndexes(self::TABLE) : [];
        foreach ($indexes as $index) {
            $name = is_array($index) ? ($index['name'] ?? null) : ($index->getName() ?? null);
            if ($name === $indexName) {
                return;
            }
        }

        Schema::table(self::TABLE, function (Blueprint $table) use ($indexName, $columns): void {
            $table->index($columns, $indexName);
        });
    }

    private function dropIndexIfExists(string $indexName): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        try {
            Schema::table(self::TABLE, function (Blueprint $table) use ($indexName): void {
                $table->dropIndex($indexName);
            });
        } catch (\Throwable) {
            // no-op for compatibility
        }
    }
};
