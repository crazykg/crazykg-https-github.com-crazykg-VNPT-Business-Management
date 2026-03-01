<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE_NAME = 'programming_requests';
    private const SOURCE_CONSTRAINT = 'chk_source_consistency';
    private const PRIORITY_CONSTRAINT = 'chk_prog_priority';

    public function up(): void
    {
        if (! $this->shouldApply()) {
            return;
        }

        $this->dropConstraintIfExists(self::SOURCE_CONSTRAINT);
        $this->dropConstraintIfExists(self::PRIORITY_CONSTRAINT);

        DB::statement("ALTER TABLE `programming_requests` MODIFY COLUMN `source_type` ENUM('DEV_CODE','DEV_FIX','DIRECT','FROM_SUPPORT') NOT NULL DEFAULT 'DIRECT'");

        DB::statement("UPDATE `programming_requests` SET `source_type` = 'FROM_SUPPORT' WHERE `source_type` IN ('DEV_CODE', 'DEV_FIX')");
        DB::statement("UPDATE `programming_requests` SET `source_type` = 'FROM_SUPPORT' WHERE `source_type` = 'DIRECT' AND `support_request_id` IS NOT NULL");
        DB::statement("UPDATE `programming_requests` SET `source_type` = 'DIRECT' WHERE `source_type` = 'FROM_SUPPORT' AND `support_request_id` IS NULL");

        DB::statement("ALTER TABLE `programming_requests` MODIFY COLUMN `source_type` ENUM('DIRECT','FROM_SUPPORT') NOT NULL DEFAULT 'DIRECT'");

        DB::statement("UPDATE `programming_requests` SET `priority` = 4 WHERE `priority` IS NOT NULL AND `priority` > 4");
        DB::statement("UPDATE `programming_requests` SET `priority` = 1 WHERE `priority` IS NOT NULL AND `priority` < 1");

        $this->addConstraintIfMissing(
            self::SOURCE_CONSTRAINT,
            "((`source_type` = 'DIRECT' AND `support_request_id` IS NULL) OR (`source_type` = 'FROM_SUPPORT' AND `support_request_id` IS NOT NULL))"
        );

        $this->addConstraintIfMissing(
            self::PRIORITY_CONSTRAINT,
            "(`priority` BETWEEN 1 AND 4)"
        );
    }

    public function down(): void
    {
        if (! $this->shouldApply()) {
            return;
        }

        $this->dropConstraintIfExists(self::SOURCE_CONSTRAINT);
        $this->dropConstraintIfExists(self::PRIORITY_CONSTRAINT);

        DB::statement("ALTER TABLE `programming_requests` MODIFY COLUMN `source_type` ENUM('DEV_CODE','DEV_FIX','DIRECT','FROM_SUPPORT') NOT NULL DEFAULT 'DIRECT'");

        DB::statement("UPDATE `programming_requests` SET `source_type` = 'DIRECT' WHERE `source_type` = 'FROM_SUPPORT' AND `support_request_id` IS NULL");
        DB::statement("UPDATE `programming_requests` SET `source_type` = 'DEV_CODE' WHERE `source_type` = 'FROM_SUPPORT' AND `support_request_id` IS NOT NULL");
        DB::statement("UPDATE `programming_requests` SET `source_type` = 'DEV_CODE' WHERE `source_type` = 'DIRECT' AND `support_request_id` IS NOT NULL");

        DB::statement("ALTER TABLE `programming_requests` MODIFY COLUMN `source_type` ENUM('DEV_CODE','DEV_FIX','DIRECT') NOT NULL DEFAULT 'DIRECT'");

        $this->addConstraintIfMissing(
            self::SOURCE_CONSTRAINT,
            "(`source_type` = 'DIRECT' OR (`source_type` IN ('DEV_CODE', 'DEV_FIX') AND `support_request_id` IS NOT NULL))"
        );

        $this->addConstraintIfMissing(
            self::PRIORITY_CONSTRAINT,
            "(`priority` BETWEEN 1 AND 5)"
        );
    }

    private function shouldApply(): bool
    {
        return DB::getDriverName() === 'mysql'
            && Schema::hasTable(self::TABLE_NAME)
            && Schema::hasColumn(self::TABLE_NAME, 'source_type')
            && Schema::hasColumn(self::TABLE_NAME, 'support_request_id')
            && Schema::hasColumn(self::TABLE_NAME, 'priority');
    }

    private function addConstraintIfMissing(string $constraintName, string $expression): void
    {
        if ($this->constraintExists($constraintName)) {
            return;
        }

        DB::statement(sprintf(
            'ALTER TABLE `%s` ADD CONSTRAINT `%s` CHECK (%s)',
            self::TABLE_NAME,
            $constraintName,
            $expression
        ));
    }

    private function dropConstraintIfExists(string $constraintName): void
    {
        if (! $this->constraintExists($constraintName)) {
            return;
        }

        DB::statement(sprintf(
            'ALTER TABLE `%s` DROP CHECK `%s`',
            self::TABLE_NAME,
            $constraintName
        ));
    }

    private function constraintExists(string $constraintName): bool
    {
        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.table_constraints')
            ->where('table_schema', $database)
            ->where('table_name', self::TABLE_NAME)
            ->where('constraint_name', $constraintName)
            ->where('constraint_type', 'CHECK')
            ->exists();
    }
};
