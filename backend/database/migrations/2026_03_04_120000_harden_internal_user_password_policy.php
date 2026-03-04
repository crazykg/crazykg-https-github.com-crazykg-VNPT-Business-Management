<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'internal_users';
    private const INDEX = 'idx_internal_users_pwd_change_status';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            if (! Schema::hasColumn(self::TABLE, 'must_change_password')) {
                $table->tinyInteger('must_change_password')->default(0);
            }
            if (! Schema::hasColumn(self::TABLE, 'password_changed_at')) {
                $table->timestamp('password_changed_at')->nullable();
            }
            if (! Schema::hasColumn(self::TABLE, 'password_reset_required_at')) {
                $table->timestamp('password_reset_required_at')->nullable();
            }
        });

        if ($this->canCreateCompositeIndex() && ! $this->hasIndex(self::TABLE, self::INDEX)) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->index(['must_change_password', 'status'], self::INDEX);
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        if ($this->hasIndex(self::TABLE, self::INDEX)) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->dropIndex(self::INDEX);
            });
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            if (Schema::hasColumn(self::TABLE, 'password_reset_required_at')) {
                $table->dropColumn('password_reset_required_at');
            }
            if (Schema::hasColumn(self::TABLE, 'password_changed_at')) {
                $table->dropColumn('password_changed_at');
            }
            if (Schema::hasColumn(self::TABLE, 'must_change_password')) {
                $table->dropColumn('must_change_password');
            }
        });
    }

    private function canCreateCompositeIndex(): bool
    {
        return Schema::hasColumn(self::TABLE, 'must_change_password')
            && Schema::hasColumn(self::TABLE, 'status');
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $connection = Schema::getConnection();
        $database = $connection->getDatabaseName();

        $result = $connection->table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->exists();

        return (bool) $result;
    }
};
