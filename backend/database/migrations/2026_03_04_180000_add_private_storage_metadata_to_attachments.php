<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('attachments')) {
            return;
        }

        Schema::table('attachments', function (Blueprint $table): void {
            if (! Schema::hasColumn('attachments', 'storage_disk')) {
                $table->string('storage_disk', 50)->nullable()->after('mime_type');
            }
            if (! Schema::hasColumn('attachments', 'storage_path')) {
                $table->string('storage_path', 1024)->nullable()->after('storage_disk');
            }
            if (! Schema::hasColumn('attachments', 'storage_visibility')) {
                $table->string('storage_visibility', 20)->nullable()->after('storage_path');
            }
        });

        $this->createIndexIfMissing(
            'attachments',
            'idx_attach_storage_lookup',
            'CREATE INDEX idx_attach_storage_lookup ON attachments (storage_disk(50), storage_path(191))'
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable('attachments')) {
            return;
        }

        $this->dropIndexIfExists('attachments', 'idx_attach_storage_lookup');

        Schema::table('attachments', function (Blueprint $table): void {
            if (Schema::hasColumn('attachments', 'storage_visibility')) {
                $table->dropColumn('storage_visibility');
            }
            if (Schema::hasColumn('attachments', 'storage_path')) {
                $table->dropColumn('storage_path');
            }
            if (Schema::hasColumn('attachments', 'storage_disk')) {
                $table->dropColumn('storage_disk');
            }
        });
    }

    private function createIndexIfMissing(string $table, string $indexName, string $statement): void
    {
        if ($this->indexExists($table, $indexName)) {
            return;
        }

        DB::statement($statement);
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! $this->indexExists($table, $indexName)) {
            return;
        }

        DB::statement(sprintf('DROP INDEX %s ON %s', $indexName, $table));
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $database = DB::getDatabaseName();
        $record = DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->first();

        return $record !== null;
    }
};
