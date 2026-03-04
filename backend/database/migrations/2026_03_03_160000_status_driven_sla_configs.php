<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'sla_configs';
    private const INDEX_LOOKUP = 'idx_sla_status_lookup';
    private const INDEX_FALLBACK = 'idx_sla_prefix_fallback';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            Schema::create(self::TABLE, function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('status', 50);
                $table->string('sub_status', 50)->nullable();
                $table->string('priority', 20);
                $table->decimal('sla_hours', 6, 2);
                $table->string('request_type_prefix', 20)->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamp('created_at')->nullable()->useCurrent();
                $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate()->nullable();
            });
        } else {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                if (! Schema::hasColumn(self::TABLE, 'status')) {
                    $table->string('status', 50)->nullable()->after('id');
                }
                if (! Schema::hasColumn(self::TABLE, 'sub_status')) {
                    $table->string('sub_status', 50)->nullable()->after('status');
                }
                if (! Schema::hasColumn(self::TABLE, 'priority')) {
                    $table->string('priority', 20)->nullable()->after('sub_status');
                }
                if (! Schema::hasColumn(self::TABLE, 'sla_hours')) {
                    $table->decimal('sla_hours', 6, 2)->nullable()->after('priority');
                }
                if (! Schema::hasColumn(self::TABLE, 'request_type_prefix')) {
                    $table->string('request_type_prefix', 20)->nullable()->after('sla_hours');
                }
                if (! Schema::hasColumn(self::TABLE, 'is_active')) {
                    $table->boolean('is_active')->default(true)->after('request_type_prefix');
                }
                if (! Schema::hasColumn(self::TABLE, 'sort_order')) {
                    $table->unsignedSmallInteger('sort_order')->default(0)->after('is_active');
                }
            });
        }

        if (Schema::hasColumn(self::TABLE, 'sla_hours') && Schema::hasColumn(self::TABLE, 'resolution_hours')) {
            DB::table(self::TABLE)
                ->whereNull('sla_hours')
                ->update(['sla_hours' => DB::raw('resolution_hours')]);
        }

        if (Schema::hasColumn(self::TABLE, 'status')) {
            DB::table(self::TABLE)
                ->whereNull('status')
                ->orWhereRaw('TRIM(status) = ?', [''])
                ->update(['status' => 'IN_PROGRESS']);
        }
        if (Schema::hasColumn(self::TABLE, 'priority')) {
            DB::table(self::TABLE)
                ->whereNull('priority')
                ->orWhereRaw('TRIM(priority) = ?', [''])
                ->update(['priority' => 'MEDIUM']);
        }
        if (Schema::hasColumn(self::TABLE, 'sla_hours')) {
            DB::table(self::TABLE)
                ->whereNull('sla_hours')
                ->update(['sla_hours' => 24]);
        }

        if (! $this->indexExists(self::INDEX_LOOKUP)) {
            DB::statement(sprintf(
                'CREATE INDEX `%s` ON `%s` (`status`, `sub_status`, `priority`, `is_active`)',
                self::INDEX_LOOKUP,
                self::TABLE
            ));
        }

        if (! $this->indexExists(self::INDEX_FALLBACK)) {
            DB::statement(sprintf(
                'CREATE INDEX `%s` ON `%s` (`request_type_prefix`, `priority`, `is_active`)',
                self::INDEX_FALLBACK,
                self::TABLE
            ));
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        if ($this->indexExists(self::INDEX_LOOKUP)) {
            DB::statement(sprintf('DROP INDEX `%s` ON `%s`', self::INDEX_LOOKUP, self::TABLE));
        }
        if ($this->indexExists(self::INDEX_FALLBACK)) {
            DB::statement(sprintf('DROP INDEX `%s` ON `%s`', self::INDEX_FALLBACK, self::TABLE));
        }
    }

    private function indexExists(string $indexName): bool
    {
        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', self::TABLE)
            ->where('index_name', $indexName)
            ->exists();
    }
};

