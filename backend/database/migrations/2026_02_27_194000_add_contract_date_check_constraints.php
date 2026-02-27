<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE_NAME = 'contracts';
    private const REQUIRED_DATES_CONSTRAINT = 'chk_contract_required_dates_non_draft';
    private const EFFECTIVE_AFTER_SIGN_CONSTRAINT = 'chk_contract_effective_not_before_sign';
    private const EXPIRY_AFTER_SIGN_CONSTRAINT = 'chk_contract_expiry_not_before_sign';

    public function up(): void
    {
        if (! $this->shouldApply()) {
            return;
        }

        $this->normalizeLegacyContractDates();
        $this->addConstraintIfMissing(
            self::REQUIRED_DATES_CONSTRAINT,
            "(UPPER(COALESCE(`status`, 'DRAFT')) IN ('DRAFT', 'PENDING')) OR (`effective_date` IS NOT NULL AND `expiry_date` IS NOT NULL)"
        );
        $this->addConstraintIfMissing(
            self::EFFECTIVE_AFTER_SIGN_CONSTRAINT,
            "(`sign_date` IS NULL OR `effective_date` IS NULL OR `effective_date` >= `sign_date`)"
        );
        $this->addConstraintIfMissing(
            self::EXPIRY_AFTER_SIGN_CONSTRAINT,
            "(`sign_date` IS NULL OR `expiry_date` IS NULL OR `expiry_date` >= `sign_date`)"
        );
    }

    public function down(): void
    {
        if (! $this->shouldApply()) {
            return;
        }

        $this->dropConstraintIfExists(self::REQUIRED_DATES_CONSTRAINT);
        $this->dropConstraintIfExists(self::EFFECTIVE_AFTER_SIGN_CONSTRAINT);
        $this->dropConstraintIfExists(self::EXPIRY_AFTER_SIGN_CONSTRAINT);
    }

    private function shouldApply(): bool
    {
        if (DB::getDriverName() !== 'mysql') {
            return false;
        }

        if (! Schema::hasTable(self::TABLE_NAME)) {
            return false;
        }

        return Schema::hasColumn(self::TABLE_NAME, 'status')
            && Schema::hasColumn(self::TABLE_NAME, 'effective_date')
            && Schema::hasColumn(self::TABLE_NAME, 'expiry_date')
            && Schema::hasColumn(self::TABLE_NAME, 'sign_date');
    }

    private function normalizeLegacyContractDates(): void
    {
        DB::statement("
            UPDATE `contracts`
            SET
                `effective_date` = COALESCE(`effective_date`, `sign_date`, CURDATE()),
                `expiry_date` = COALESCE(`expiry_date`, `effective_date`, `sign_date`, CURDATE())
            WHERE UPPER(COALESCE(`status`, 'DRAFT')) NOT IN ('DRAFT', 'PENDING')
        ");

        DB::statement("
            UPDATE `contracts`
            SET `effective_date` = `sign_date`
            WHERE `sign_date` IS NOT NULL
              AND `effective_date` IS NOT NULL
              AND `effective_date` < `sign_date`
        ");

        DB::statement("
            UPDATE `contracts`
            SET `expiry_date` = `sign_date`
            WHERE `sign_date` IS NOT NULL
              AND `expiry_date` IS NOT NULL
              AND `expiry_date` < `sign_date`
        ");
    }

    private function addConstraintIfMissing(string $constraint, string $checkExpression): void
    {
        if ($this->constraintExists($constraint)) {
            return;
        }

        DB::statement(sprintf(
            'ALTER TABLE `%s` ADD CONSTRAINT `%s` CHECK (%s)',
            self::TABLE_NAME,
            $constraint,
            $checkExpression
        ));
    }

    private function dropConstraintIfExists(string $constraint): void
    {
        if (! $this->constraintExists($constraint)) {
            return;
        }

        DB::statement(sprintf(
            'ALTER TABLE `%s` DROP CHECK `%s`',
            self::TABLE_NAME,
            $constraint
        ));
    }

    private function constraintExists(string $constraint): bool
    {
        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.table_constraints')
            ->where('table_schema', $database)
            ->where('table_name', self::TABLE_NAME)
            ->where('constraint_name', $constraint)
            ->where('constraint_type', 'CHECK')
            ->exists();
    }
};
