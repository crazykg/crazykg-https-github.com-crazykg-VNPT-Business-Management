<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PROCEDURE_NAME = 'sp_generate_contract_payments';

    private const INDEX_CONTRACT_EXPECTED = 'idx_ps_contract_expected';

    private const INDEX_CONTRACT_EXPECTED_STATUS = 'idx_ps_contract_expected_status';

    public function up(): void
    {
        if (Schema::hasTable('contracts')) {
            $addTermUnit = ! Schema::hasColumn('contracts', 'term_unit');
            $addTermValue = ! Schema::hasColumn('contracts', 'term_value');
            $addExpiryOverride = ! Schema::hasColumn('contracts', 'expiry_date_manual_override');

            if ($addTermUnit || $addTermValue || $addExpiryOverride) {
                Schema::table('contracts', function (Blueprint $table) use ($addTermUnit, $addTermValue, $addExpiryOverride): void {
                    if ($addTermUnit) {
                        $table->string('term_unit', 10)->nullable();
                    }
                    if ($addTermValue) {
                        $table->decimal('term_value', 10, 2)->nullable();
                    }
                    if ($addExpiryOverride) {
                        $table->boolean('expiry_date_manual_override')->default(false);
                    }
                });
            }
        }

        if (! Schema::hasTable('payment_schedules')) {
            return;
        }

        $hasContractId = Schema::hasColumn('payment_schedules', 'contract_id');
        $hasExpectedDate = Schema::hasColumn('payment_schedules', 'expected_date');
        $hasStatus = Schema::hasColumn('payment_schedules', 'status');

        if ($hasContractId && $hasExpectedDate && $hasStatus && ! $this->hasIndex('payment_schedules', self::INDEX_CONTRACT_EXPECTED_STATUS)) {
            Schema::table('payment_schedules', function (Blueprint $table): void {
                $table->index(['contract_id', 'expected_date', 'status'], self::INDEX_CONTRACT_EXPECTED_STATUS);
            });
        } elseif ($hasContractId && $hasExpectedDate && ! $this->hasIndex('payment_schedules', self::INDEX_CONTRACT_EXPECTED)) {
            Schema::table('payment_schedules', function (Blueprint $table): void {
                $table->index(['contract_id', 'expected_date'], self::INDEX_CONTRACT_EXPECTED);
            });
        }

        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        if (! Schema::hasTable('contracts') || ! Schema::hasTable('payment_schedules')) {
            return;
        }

        $cycleExpression = Schema::hasColumn('contracts', 'payment_cycle')
            ? "COALESCE(NULLIF(UPPER(`payment_cycle`), ''), 'ONCE')"
            : "'ONCE'";

        $projectExpression = Schema::hasColumn('contracts', 'project_id')
            ? '`project_id`'
            : 'NULL';

        $valueExpression = '0';
        if (Schema::hasColumn('contracts', 'value') && Schema::hasColumn('contracts', 'total_value')) {
            $valueExpression = 'COALESCE(`value`, `total_value`, 0)';
        } elseif (Schema::hasColumn('contracts', 'value')) {
            $valueExpression = 'COALESCE(`value`, 0)';
        } elseif (Schema::hasColumn('contracts', 'total_value')) {
            $valueExpression = 'COALESCE(`total_value`, 0)';
        }

        $startExpression = 'DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
        if (Schema::hasColumn('contracts', 'effective_date') && Schema::hasColumn('contracts', 'sign_date')) {
            $startExpression = 'COALESCE(`effective_date`, `sign_date`, DATE_SUB(CURDATE(), INTERVAL 1 DAY))';
        } elseif (Schema::hasColumn('contracts', 'effective_date')) {
            $startExpression = 'COALESCE(`effective_date`, DATE_SUB(CURDATE(), INTERVAL 1 DAY))';
        } elseif (Schema::hasColumn('contracts', 'sign_date')) {
            $startExpression = 'COALESCE(`sign_date`, DATE_SUB(CURDATE(), INTERVAL 1 DAY))';
        }

        $endExpression = Schema::hasColumn('contracts', 'expiry_date')
            ? '`expiry_date`'
            : 'NULL';

        $termUnitExpression = Schema::hasColumn('contracts', 'term_unit')
            ? 'NULLIF(UPPER(`term_unit`), \'\')'
            : 'NULL';

        $termValueExpression = Schema::hasColumn('contracts', 'term_value')
            ? '`term_value`'
            : 'NULL';

        $insertColumns = [];
        $insertValues = [];

        if (Schema::hasColumn('payment_schedules', 'contract_id')) {
            $insertColumns[] = '`contract_id`';
            $insertValues[] = 'p_contract_id';
        }

        if (Schema::hasColumn('payment_schedules', 'project_id')) {
            $insertColumns[] = '`project_id`';
            $insertValues[] = 'v_project_id';
        }

        if (Schema::hasColumn('payment_schedules', 'milestone_name')) {
            $insertColumns[] = '`milestone_name`';
            $insertValues[] = 'v_milestone_name';
        }

        if (Schema::hasColumn('payment_schedules', 'cycle_number')) {
            $insertColumns[] = '`cycle_number`';
            $insertValues[] = 'v_cycle_index';
        }

        if (Schema::hasColumn('payment_schedules', 'expected_date')) {
            $insertColumns[] = '`expected_date`';
            $insertValues[] = 'v_current_date';
        }

        if (Schema::hasColumn('payment_schedules', 'expected_amount')) {
            $insertColumns[] = '`expected_amount`';
            $insertValues[] = 'v_expected_amount';
        }

        if (Schema::hasColumn('payment_schedules', 'actual_paid_date')) {
            $insertColumns[] = '`actual_paid_date`';
            $insertValues[] = 'NULL';
        }

        if (Schema::hasColumn('payment_schedules', 'actual_paid_amount')) {
            $insertColumns[] = '`actual_paid_amount`';
            $insertValues[] = '0';
        }

        if (Schema::hasColumn('payment_schedules', 'status')) {
            $insertColumns[] = '`status`';
            $insertValues[] = "'PENDING'";
        }

        if (Schema::hasColumn('payment_schedules', 'notes')) {
            $insertColumns[] = '`notes`';
            $insertValues[] = 'NULL';
        }

        if (Schema::hasColumn('payment_schedules', 'created_at')) {
            $insertColumns[] = '`created_at`';
            $insertValues[] = 'NOW()';
        }

        if (Schema::hasColumn('payment_schedules', 'updated_at')) {
            $insertColumns[] = '`updated_at`';
            $insertValues[] = 'NOW()';
        }

        if ($insertColumns === [] || $insertValues === []) {
            return;
        }

        DB::unprepared(sprintf('DROP PROCEDURE IF EXISTS `%s`', self::PROCEDURE_NAME));

        $sql = sprintf(
            "
            CREATE PROCEDURE `%s`(
                IN p_contract_id BIGINT UNSIGNED,
                IN p_preserve_paid TINYINT(1),
                IN p_allocation_mode VARCHAR(32),
                IN p_advance_percentage DECIMAL(5,2)
            )
            BEGIN
                DECLARE v_cycle VARCHAR(32) DEFAULT 'ONCE';
                DECLARE v_project_id BIGINT UNSIGNED DEFAULT NULL;
                DECLARE v_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_start_date DATE DEFAULT NULL;
                DECLARE v_end_date DATE DEFAULT NULL;
                DECLARE v_term_unit VARCHAR(10) DEFAULT NULL;
                DECLARE v_term_value DECIMAL(10,2) DEFAULT NULL;
                DECLARE v_term_months INT DEFAULT 0;
                DECLARE v_term_days INT DEFAULT 0;
                DECLARE v_interval_months INT DEFAULT NULL;
                DECLARE v_cycle_count INT DEFAULT 1;
                DECLARE v_cycle_index INT DEFAULT 1;
                DECLARE v_current_date DATE DEFAULT NULL;
                DECLARE v_base_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_expected_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_milestone_name VARCHAR(255) DEFAULT 'Thanh toán một lần';
                DECLARE v_allocation_mode VARCHAR(32) DEFAULT 'EVEN';
                DECLARE v_advance_percentage DECIMAL(5,2) DEFAULT 0;
                DECLARE v_first_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_remaining_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_remaining_cycles INT DEFAULT 0;
                DECLARE v_remaining_base DECIMAL(18,2) DEFAULT 0;
                DECLARE v_preserved_count INT DEFAULT 0;
                DECLARE v_preserve_offset INT DEFAULT 0;

                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    ROLLBACK;
                    RESIGNAL;
                END;

                START TRANSACTION;

                SELECT
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                INTO
                    v_cycle,
                    v_project_id,
                    v_amount,
                    v_start_date,
                    v_end_date,
                    v_term_unit,
                    v_term_value
                FROM `contracts`
                WHERE `id` = p_contract_id
                LIMIT 1;

                IF v_cycle IS NULL OR TRIM(v_cycle) = '' THEN
                    SET v_cycle = 'ONCE';
                END IF;

                SET v_cycle = UPPER(v_cycle);
                SET v_allocation_mode = UPPER(COALESCE(NULLIF(TRIM(p_allocation_mode), ''), 'EVEN'));
                IF v_allocation_mode NOT IN ('EVEN', 'ADVANCE_PERCENT') THEN
                    SET v_allocation_mode = 'EVEN';
                END IF;

                SET v_advance_percentage = LEAST(100, GREATEST(0, COALESCE(p_advance_percentage, 0)));

                IF v_start_date IS NULL THEN
                    SET v_start_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY);
                END IF;

                IF v_end_date IS NULL AND v_term_unit IS NOT NULL AND v_term_value IS NOT NULL AND v_term_value > 0 THEN
                    SET v_term_unit = UPPER(v_term_unit);

                    IF v_term_unit = 'DAY' THEN
                        IF FLOOR(v_term_value) <> v_term_value THEN
                            SIGNAL SQLSTATE '45000'
                                SET MESSAGE_TEXT = 'Contract term day value must be integer.';
                        END IF;

                        SET v_end_date = DATE_ADD(v_start_date, INTERVAL CAST(v_term_value AS SIGNED) - 1 DAY);
                    ELSEIF v_term_unit = 'MONTH' THEN
                        SET v_term_months = FLOOR(v_term_value);
                        SET v_term_days = ROUND((v_term_value - v_term_months) * 30);

                        IF v_term_months = 0 AND v_term_days = 0 THEN
                            SET v_term_days = 1;
                        END IF;

                        SET v_end_date = DATE_ADD(
                            DATE_ADD(v_start_date, INTERVAL v_term_months MONTH),
                            INTERVAL v_term_days - 1 DAY
                        );
                    END IF;
                END IF;

                IF v_end_date IS NOT NULL AND v_end_date < v_start_date THEN
                    SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'Contract expiry date must be greater than or equal to start date.';
                END IF;

                IF v_amount IS NULL OR v_amount <= 0 THEN
                    SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'Contract value must be greater than zero for payment generation.';
                END IF;

                IF v_cycle = 'MONTHLY' THEN
                    SET v_interval_months = 1;
                ELSEIF v_cycle = 'QUARTERLY' THEN
                    SET v_interval_months = 3;
                ELSEIF v_cycle = 'HALF_YEARLY' THEN
                    SET v_interval_months = 6;
                ELSEIF v_cycle = 'YEARLY' THEN
                    SET v_interval_months = 12;
                ELSE
                    SET v_interval_months = NULL;
                END IF;

                IF v_interval_months IS NOT NULL AND v_end_date IS NOT NULL AND v_end_date >= v_start_date THEN
                    SET v_cycle_count = TIMESTAMPDIFF(MONTH, v_start_date, v_end_date) DIV v_interval_months + 1;
                ELSE
                    SET v_cycle_count = 1;
                END IF;

                IF v_cycle_count < 1 THEN
                    SET v_cycle_count = 1;
                END IF;

                IF COALESCE(p_preserve_paid, 0) = 1 THEN
                    SELECT COUNT(*)
                    INTO v_preserved_count
                    FROM `payment_schedules`
                    WHERE `contract_id` = p_contract_id
                      AND `status` IN ('PAID', 'PARTIAL');
                ELSE
                    SET v_preserved_count = 0;
                END IF;

                SET v_preserve_offset = LEAST(v_preserved_count, v_cycle_count);

                IF v_allocation_mode = 'ADVANCE_PERCENT' AND v_cycle_count > 1 THEN
                    SET v_first_amount = ROUND((v_amount * v_advance_percentage) / 100, 2);
                    SET v_remaining_amount = GREATEST(0, ROUND(v_amount - v_first_amount, 2));
                    SET v_remaining_cycles = GREATEST(v_cycle_count - 1, 0);
                    SET v_remaining_base = IF(v_remaining_cycles > 0, ROUND(v_remaining_amount / v_remaining_cycles, 2), 0);
                ELSE
                    SET v_base_amount = ROUND(v_amount / v_cycle_count, 2);
                END IF;

                IF COALESCE(p_preserve_paid, 0) = 1 THEN
                    DELETE FROM `payment_schedules`
                    WHERE `contract_id` = p_contract_id
                      AND `status` NOT IN ('PAID', 'PARTIAL');
                ELSE
                    DELETE FROM `payment_schedules`
                    WHERE `contract_id` = p_contract_id;
                END IF;

                SET v_cycle_index = 1;

                payment_loop: WHILE v_cycle_index <= v_cycle_count DO
                    IF v_interval_months IS NULL THEN
                        SET v_current_date = v_start_date;
                    ELSE
                        SET v_current_date = DATE_ADD(v_start_date, INTERVAL (v_cycle_index - 1) * v_interval_months MONTH);
                    END IF;

                    IF v_interval_months IS NOT NULL AND v_end_date IS NOT NULL AND v_current_date > v_end_date THEN
                        LEAVE payment_loop;
                    END IF;

                    IF v_cycle_index <= v_preserve_offset THEN
                        SET v_cycle_index = v_cycle_index + 1;
                        ITERATE payment_loop;
                    END IF;

                    IF v_cycle = 'ONCE' THEN
                        SET v_milestone_name = 'Thanh toán một lần';
                    ELSE
                        SET v_milestone_name = CONCAT('Thanh toán kỳ ', v_cycle_index);
                    END IF;

                    IF v_allocation_mode = 'ADVANCE_PERCENT' AND v_cycle_count > 1 THEN
                        IF v_cycle_index = 1 THEN
                            SET v_expected_amount = v_first_amount;
                        ELSEIF v_cycle_index = v_cycle_count THEN
                            SET v_expected_amount = GREATEST(0, ROUND(v_remaining_amount - (v_remaining_base * GREATEST(v_remaining_cycles - 1, 0)), 2));
                        ELSE
                            SET v_expected_amount = v_remaining_base;
                        END IF;
                    ELSE
                        IF v_cycle_index = v_cycle_count THEN
                            SET v_expected_amount = GREATEST(0, ROUND(v_amount - (v_base_amount * GREATEST(v_cycle_count - 1, 0)), 2));
                        ELSE
                            SET v_expected_amount = v_base_amount;
                        END IF;
                    END IF;

                    INSERT INTO `payment_schedules` (%s)
                    VALUES (%s);

                    SET v_cycle_index = v_cycle_index + 1;
                END WHILE;

                COMMIT;
            END
            ",
            self::PROCEDURE_NAME,
            $cycleExpression,
            $projectExpression,
            $valueExpression,
            $startExpression,
            $endExpression,
            $termUnitExpression,
            $termValueExpression,
            implode(', ', $insertColumns),
            implode(', ', $insertValues)
        );

        DB::unprepared($sql);
    }

    public function down(): void
    {
        if (Schema::hasTable('payment_schedules')) {
            if ($this->hasIndex('payment_schedules', self::INDEX_CONTRACT_EXPECTED_STATUS)) {
                Schema::table('payment_schedules', function (Blueprint $table): void {
                    $table->dropIndex(self::INDEX_CONTRACT_EXPECTED_STATUS);
                });
            }

            if ($this->hasIndex('payment_schedules', self::INDEX_CONTRACT_EXPECTED)) {
                Schema::table('payment_schedules', function (Blueprint $table): void {
                    $table->dropIndex(self::INDEX_CONTRACT_EXPECTED);
                });
            }
        }

        if (Schema::hasTable('contracts')) {
            $dropExpiryOverride = Schema::hasColumn('contracts', 'expiry_date_manual_override');
            $dropTermValue = Schema::hasColumn('contracts', 'term_value');
            $dropTermUnit = Schema::hasColumn('contracts', 'term_unit');

            if ($dropExpiryOverride || $dropTermValue || $dropTermUnit) {
                Schema::table('contracts', function (Blueprint $table) use ($dropExpiryOverride, $dropTermValue, $dropTermUnit): void {
                    if ($dropExpiryOverride) {
                        $table->dropColumn('expiry_date_manual_override');
                    }
                    if ($dropTermValue) {
                        $table->dropColumn('term_value');
                    }
                    if ($dropTermUnit) {
                        $table->dropColumn('term_unit');
                    }
                });
            }
        }

        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::unprepared(sprintf('DROP PROCEDURE IF EXISTS `%s`', self::PROCEDURE_NAME));
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        if (DB::getDriverName() !== 'mysql') {
            return false;
        }

        if (! Schema::hasTable($table)) {
            return false;
        }

        $rows = DB::select(sprintf('SHOW INDEX FROM `%s` WHERE Key_name = ?', $table), [$indexName]);
        return $rows !== [];
    }
};
