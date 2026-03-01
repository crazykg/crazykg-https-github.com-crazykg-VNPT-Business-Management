<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    private const SUPPORT_TABLE = 'support_requests';
    private const PROGRAMMING_TABLE = 'programming_requests';
    private const SUPPORT_INDEX = 'idx_support_req_deleted_status_requested_id';
    private const PROGRAMMING_INDEX = 'idx_prog_req_deleted_status_id';

    public function up(): void
    {
        if (Schema::hasTable(self::SUPPORT_TABLE) && ! $this->indexExists(self::SUPPORT_TABLE, self::SUPPORT_INDEX)) {
            Schema::table(self::SUPPORT_TABLE, function (Blueprint $table): void {
                $table->index(
                    ['deleted_at', 'status', 'requested_date', 'id'],
                    self::SUPPORT_INDEX
                );
            });
        }

        if (Schema::hasTable(self::PROGRAMMING_TABLE) && ! $this->indexExists(self::PROGRAMMING_TABLE, self::PROGRAMMING_INDEX)) {
            Schema::table(self::PROGRAMMING_TABLE, function (Blueprint $table): void {
                $table->index(
                    ['deleted_at', 'status', 'id'],
                    self::PROGRAMMING_INDEX
                );
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable(self::SUPPORT_TABLE) && $this->indexExists(self::SUPPORT_TABLE, self::SUPPORT_INDEX)) {
            Schema::table(self::SUPPORT_TABLE, function (Blueprint $table): void {
                $table->dropIndex(self::SUPPORT_INDEX);
            });
        }

        if (Schema::hasTable(self::PROGRAMMING_TABLE) && $this->indexExists(self::PROGRAMMING_TABLE, self::PROGRAMMING_INDEX)) {
            Schema::table(self::PROGRAMMING_TABLE, function (Blueprint $table): void {
                $table->dropIndex(self::PROGRAMMING_INDEX);
            });
        }
    }

    private function indexExists(string $tableName, string $indexName): bool
    {
        return DB::table('information_schema.statistics')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', $tableName)
            ->where('index_name', $indexName)
            ->exists();
    }
};

