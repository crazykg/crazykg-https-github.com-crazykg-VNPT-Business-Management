<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('support_requests')) {
            $this->dropIndexIfExists('support_requests', 'idx_support_ticket_code');

            Schema::table('support_requests', function (Blueprint $table): void {
                if (Schema::hasColumn('support_requests', 'ticket_code')) {
                    $table->dropColumn('ticket_code');
                }
                if (Schema::hasColumn('support_requests', 'task_link')) {
                    $table->dropColumn('task_link');
                }
            });
        }

        if (Schema::hasTable('support_request_tasks')) {
            Schema::table('support_request_tasks', function (Blueprint $table): void {
                if (Schema::hasColumn('support_request_tasks', 'title')) {
                    $table->dropColumn('title');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('support_requests')) {
            Schema::table('support_requests', function (Blueprint $table): void {
                if (! Schema::hasColumn('support_requests', 'ticket_code')) {
                    $table->string('ticket_code', 50)->nullable()->comment('Mã Jira (IT360-1234) hoặc Bitbucket PR')->after('id');
                }
                if (! Schema::hasColumn('support_requests', 'task_link')) {
                    $table->text('task_link')->nullable()->comment('Link Jira / Bitbucket')->after('noti_date');
                }
            });

            if (Schema::hasColumn('support_requests', 'ticket_code')) {
                $this->addIndexIfMissing('support_requests', ['ticket_code'], 'idx_support_ticket_code');
            }
        }

        if (Schema::hasTable('support_request_tasks')) {
            Schema::table('support_request_tasks', function (Blueprint $table): void {
                if (! Schema::hasColumn('support_request_tasks', 'title')) {
                    $table->string('title', 255)->nullable()->comment('Nội dung task con')->after('request_id');
                }
            });
        }
    }

    /**
     * @param array<int, string> $columns
     */
    private function addIndexIfMissing(string $table, array $columns, string $indexName): void
    {
        if (! Schema::hasTable($table) || DB::getDriverName() !== 'mysql' || $this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns, $indexName): void {
            $blueprint->index($columns, $indexName);
        });
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! Schema::hasTable($table) || DB::getDriverName() !== 'mysql' || ! $this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($indexName): void {
            $blueprint->dropIndex($indexName);
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
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
};
