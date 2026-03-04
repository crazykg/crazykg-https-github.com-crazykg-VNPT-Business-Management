<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'programming_requests';
    private const LEGACY_CHECK = 'chk_prog_req_code_format';
    private const FLEXIBLE_CHECK = 'chk_prog_req_code_flexible';

    public function up(): void
    {
        if (! $this->shouldApply()) {
            return;
        }

        $this->dropCheckIfExists(self::LEGACY_CHECK);
        $this->dropCheckIfExists(self::FLEXIBLE_CHECK);

        $this->addCheckIfMissing(
            self::FLEXIBLE_CHECK,
            "(`req_code` REGEXP '^(REQDEV[0-9]{6}|SUP-[0-9A-Za-z_-]+|YC-[0-9A-Za-z_-]+|YC[0-9]{4}[0-9]+)$')"
        );
    }

    public function down(): void
    {
        if (! $this->shouldApply()) {
            return;
        }

        $this->dropCheckIfExists(self::FLEXIBLE_CHECK);
        $this->addCheckIfMissing(self::LEGACY_CHECK, "(`req_code` REGEXP '^REQDEV[0-9]{6}$')");
    }

    private function shouldApply(): bool
    {
        return DB::getDriverName() === 'mysql'
            && Schema::hasTable(self::TABLE)
            && Schema::hasColumn(self::TABLE, 'req_code');
    }

    private function addCheckIfMissing(string $constraintName, string $expression): void
    {
        if ($this->checkExists($constraintName)) {
            return;
        }

        DB::statement(sprintf(
            'ALTER TABLE `%s` ADD CONSTRAINT `%s` CHECK (%s)',
            self::TABLE,
            $constraintName,
            $expression
        ));
    }

    private function dropCheckIfExists(string $constraintName): void
    {
        if (! $this->checkExists($constraintName)) {
            return;
        }

        DB::statement(sprintf('ALTER TABLE `%s` DROP CHECK `%s`', self::TABLE, $constraintName));
    }

    private function checkExists(string $constraintName): bool
    {
        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.table_constraints')
            ->where('table_schema', $database)
            ->where('table_name', self::TABLE)
            ->where('constraint_name', $constraintName)
            ->where('constraint_type', 'CHECK')
            ->exists();
    }
};

