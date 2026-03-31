<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'product_target_segments';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE) || ! Schema::hasTable('internal_users')) {
            return;
        }

        $this->dropForeignKeysForColumn('created_by');
        $this->dropForeignKeysForColumn('updated_by');

        Schema::table(self::TABLE, function (Blueprint $table): void {
            if (Schema::hasColumn(self::TABLE, 'created_by')) {
                $table->foreign('created_by', 'fk_product_target_segments_created_by')
                    ->references('id')
                    ->on('internal_users')
                    ->nullOnDelete();
            }

            if (Schema::hasColumn(self::TABLE, 'updated_by')) {
                $table->foreign('updated_by', 'fk_product_target_segments_updated_by')
                    ->references('id')
                    ->on('internal_users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        $this->dropForeignKeysForColumn('created_by');
        $this->dropForeignKeysForColumn('updated_by');

        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            if (Schema::hasColumn(self::TABLE, 'created_by')) {
                $table->foreign('created_by', 'fk_product_target_segments_created_by')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            }

            if (Schema::hasColumn(self::TABLE, 'updated_by')) {
                $table->foreign('updated_by', 'fk_product_target_segments_updated_by')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            }
        });
    }

    private function dropForeignKeysForColumn(string $column): void
    {
        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, $column)) {
            return;
        }

        try {
            $foreignKeys = Schema::getConnection()->getSchemaBuilder()->getForeignKeys(self::TABLE);
        } catch (\Throwable) {
            $foreignKeys = [];
        }

        foreach ($foreignKeys as $foreignKey) {
            $columns = array_values(array_filter(
                array_map('strval', (array) ($foreignKey['columns'] ?? [])),
                static fn (string $value): bool => $value !== ''
            ));

            if (! in_array($column, $columns, true)) {
                continue;
            }

            $name = trim((string) ($foreignKey['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            Schema::table(self::TABLE, function (Blueprint $table) use ($name): void {
                $table->dropForeign($name);
            });
        }
    }
};
