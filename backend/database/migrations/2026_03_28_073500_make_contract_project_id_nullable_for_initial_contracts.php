<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'contracts';
    private const COLUMN = 'project_id';
    private const FK_NAME = 'fk_cont_proj_link';
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

        $this->dropForeignKeyIfExists(self::TABLE, self::FK_NAME);
        $this->modifyProjectIdNullability(true);
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

        $hasNullProjectContracts = (int) DB::table(self::TABLE)
            ->whereNull(self::COLUMN)
            ->count() > 0;

        if ($hasNullProjectContracts) {
            return;
        }

        $this->dropForeignKeyIfExists(self::TABLE, self::FK_NAME);
        $this->modifyProjectIdNullability(false);
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

    private function modifyProjectIdNullability(bool $nullable): void
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

    private function dropForeignKeyIfExists(string $table, string $constraintName): void
    {
        $exists = DB::selectOne(
            "SELECT COUNT(*) AS cnt
             FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
            [$table, $constraintName]
        );

        if ((int) ($exists?->cnt ?? 0) > 0) {
            DB::statement("ALTER TABLE `{$table}` DROP FOREIGN KEY `{$constraintName}`");
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
                'ALTER TABLE `%s` ADD CONSTRAINT `%s` FOREIGN KEY (`%s`) REFERENCES `%s` (`%s`)',
                self::TABLE,
                self::FK_NAME,
                self::COLUMN,
                self::REFERENCED_TABLE,
                self::REFERENCED_COLUMN
            ));
        }
    }
};
