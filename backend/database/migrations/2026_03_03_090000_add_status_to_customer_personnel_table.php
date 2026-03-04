<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'customer_personnel';
    private const STATUS_INDEX = 'idx_customer_personnel_status';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            if (! Schema::hasColumn(self::TABLE, 'status')) {
                if (Schema::hasColumn(self::TABLE, 'email')) {
                    $table->enum('status', ['ACTIVE', 'INACTIVE'])->default('ACTIVE')->after('email');
                } else {
                    $table->enum('status', ['ACTIVE', 'INACTIVE'])->default('ACTIVE');
                }
            }
        });

        if (Schema::hasColumn(self::TABLE, 'status')) {
            DB::table(self::TABLE)
                ->whereNull('status')
                ->orWhereRaw('TRIM(status) = ?', [''])
                ->update(['status' => 'ACTIVE']);

            if (! $this->indexExists(self::TABLE, self::STATUS_INDEX)) {
                Schema::table(self::TABLE, function (Blueprint $table): void {
                    $table->index('status', self::STATUS_INDEX);
                });
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        if ($this->indexExists(self::TABLE, self::STATUS_INDEX)) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->dropIndex(self::STATUS_INDEX);
            });
        }

        if (Schema::hasColumn(self::TABLE, 'status')) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->dropColumn('status');
            });
        }
    }

    private function indexExists(string $table, string $indexName): bool
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return false;
        }

        $databaseName = DB::getDatabaseName();
        if (! is_string($databaseName) || $databaseName === '') {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', $databaseName)
            ->where('table_name', $table)
            ->whereRaw('LOWER(index_name) = ?', [strtolower($indexName)])
            ->exists();
    }
};
