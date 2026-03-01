<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE_NAME = 'programming_requests';
    private const REQ_CODE_CONSTRAINT = 'chk_prog_req_code_format';

    public function up(): void
    {
        if (! $this->shouldApply()) {
            return;
        }

        $this->dropConstraintIfExists(self::REQ_CODE_CONSTRAINT);

        $maxId = (int) DB::table(self::TABLE_NAME)->max('id');
        if ($maxId > 999999) {
            throw new RuntimeException('Không thể chuẩn hóa req_code vì id vượt ngưỡng 6 chữ số.');
        }

        if ($maxId > 0) {
            DB::statement("UPDATE `programming_requests` SET `req_code` = CONCAT('REQTMP', LPAD(`id`, 10, '0'))");
            DB::statement("UPDATE `programming_requests` SET `req_code` = CONCAT('REQDEV', LPAD(`id`, 6, '0'))");
        }

        $this->addConstraintIfMissing(self::REQ_CODE_CONSTRAINT, "(`req_code` REGEXP '^REQDEV[0-9]{6}$')");
    }

    public function down(): void
    {
        if (! $this->shouldApply()) {
            return;
        }

        $this->dropConstraintIfExists(self::REQ_CODE_CONSTRAINT);
    }

    private function shouldApply(): bool
    {
        return DB::getDriverName() === 'mysql'
            && Schema::hasTable(self::TABLE_NAME)
            && Schema::hasColumn(self::TABLE_NAME, 'req_code');
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
