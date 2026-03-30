<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'payment_schedules';
    private const COLUMN = 'project_id';
    private const FK_NAME = 'fk_ps_project';
    private const REFERENCED_TABLE = 'projects';
    private const REFERENCED_COLUMN = 'id';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        if (! $this->usesMysqlConnection() || $this->isColumnNullable()) {
            return;
        }

        $this->dropForeignKeyIfExists();
        $this->modifyColumnNullability(true);
        $this->addForeignKeyIfMissing();
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        if (! $this->usesMysqlConnection() || ! $this->isColumnNullable()) {
            return;
        }

        $hasNullProjectSchedules = (int) DB::table(self::TABLE)
            ->whereNull(self::COLUMN)
            ->count() > 0;

        if ($hasNullProjectSchedules) {
            return;
        }

        $this->dropForeignKeyIfExists();
        $this->modifyColumnNullability(false);
        $this->addForeignKeyIfMissing();
    }

    private function usesMysqlConnection(): bool
    {
        return DB::connection()->getDriverName() === 'mysql';
    }

    private function isColumnNullable(): bool
    {
        $meta = DB::selectOne(
            "SELECT IS_NULLABLE
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
            [self::TABLE, self::COLUMN]
        );

        return strtoupper((string) ($meta->IS_NULLABLE ?? 'NO')) === 'YES';
    }

    private function modifyColumnNullability(bool $nullable): void
    {
        $meta = DB::selectOne(
            "SELECT COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT, EXTRA
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
            [self::TABLE, self::COLUMN]
        );

        if (! $meta || ! isset($meta->COLUMN_TYPE)) {
            return;
        }

        $columnType = (string) $meta->COLUMN_TYPE;
        $nullSql = $nullable ? 'NULL' : 'NOT NULL';
        $defaultSql = $meta->COLUMN_DEFAULT !== null
            ? "DEFAULT '" . str_replace("'", "''", (string) $meta->COLUMN_DEFAULT) . "'"
            : ($nullable ? 'DEFAULT NULL' : '');
        $extraSql = trim((string) ($meta->EXTRA ?? ''));
        $commentSql = trim((string) ($meta->COLUMN_COMMENT ?? '')) !== ''
            ? "COMMENT '" . str_replace("'", "''", (string) $meta->COLUMN_COMMENT) . "'"
            : '';

        DB::statement(sprintf(
            'ALTER TABLE `%s` MODIFY `%s` %s %s %s %s %s',
            self::TABLE,
            self::COLUMN,
            $columnType,
            $nullSql,
            $defaultSql,
            $extraSql,
            $commentSql
        ));
    }

    private function dropForeignKeyIfExists(): void
    {
        $exists = DB::selectOne(
            "SELECT COUNT(*) AS cnt
             FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
            [self::TABLE, self::FK_NAME]
        );

        if ((int) ($exists?->cnt ?? 0) > 0) {
            DB::statement(sprintf(
                'ALTER TABLE `%s` DROP FOREIGN KEY `%s`',
                self::TABLE,
                self::FK_NAME
            ));
        }
    }

    private function addForeignKeyIfMissing(): void
    {
        $exists = DB::selectOne(
            "SELECT COUNT(*) AS cnt
             FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
            [self::TABLE, self::FK_NAME]
        );

        if ((int) ($exists?->cnt ?? 0) === 0) {
            DB::statement(sprintf(
                'ALTER TABLE `%s` ADD CONSTRAINT `%s` FOREIGN KEY (`%s`) REFERENCES `%s` (`%s`) ON DELETE CASCADE',
                self::TABLE,
                self::FK_NAME,
                self::COLUMN,
                self::REFERENCED_TABLE,
                self::REFERENCED_COLUMN
            ));
        }
    }
};
