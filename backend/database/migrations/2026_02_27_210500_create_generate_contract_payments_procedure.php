<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PROCEDURE_NAME = 'sp_generate_contract_payments';

    public function up(): void
    {
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

        $startExpression = 'CURDATE()';
        if (Schema::hasColumn('contracts', 'effective_date') && Schema::hasColumn('contracts', 'sign_date')) {
            $startExpression = 'COALESCE(`effective_date`, `sign_date`, CURDATE())';
        } elseif (Schema::hasColumn('contracts', 'effective_date')) {
            $startExpression = 'COALESCE(`effective_date`, CURDATE())';
        } elseif (Schema::hasColumn('contracts', 'sign_date')) {
            $startExpression = 'COALESCE(`sign_date`, CURDATE())';
        }

        $endExpression = Schema::hasColumn('contracts', 'expiry_date')
            ? '`expiry_date`'
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
            CREATE PROCEDURE `%s`(IN p_contract_id BIGINT UNSIGNED)
            BEGIN
                DECLARE v_cycle VARCHAR(32) DEFAULT 'ONCE';
                DECLARE v_project_id BIGINT UNSIGNED DEFAULT NULL;
                DECLARE v_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_start_date DATE DEFAULT CURDATE();
                DECLARE v_end_date DATE DEFAULT NULL;
                DECLARE v_interval_months INT DEFAULT NULL;
                DECLARE v_cycle_count INT DEFAULT 1;
                DECLARE v_cycle_index INT DEFAULT 1;
                DECLARE v_current_date DATE DEFAULT CURDATE();
                DECLARE v_base_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_expected_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_milestone_name VARCHAR(255) DEFAULT 'Thanh toán một lần';

                SELECT
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
                    v_end_date
                FROM `contracts`
                WHERE `id` = p_contract_id
                LIMIT 1;

                IF v_cycle IS NULL OR TRIM(v_cycle) = '' THEN
                    SET v_cycle = 'ONCE';
                END IF;

                IF v_start_date IS NULL THEN
                    SET v_start_date = CURDATE();
                END IF;

                IF v_amount IS NULL OR v_amount < 0 THEN
                    SET v_amount = 0;
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

                DELETE FROM `payment_schedules` WHERE `contract_id` = p_contract_id;

                IF v_interval_months IS NOT NULL AND v_end_date IS NOT NULL AND v_end_date >= v_start_date THEN
                    SET v_cycle_count = TIMESTAMPDIFF(MONTH, v_start_date, v_end_date) DIV v_interval_months + 1;
                ELSE
                    SET v_cycle_count = 1;
                END IF;

                IF v_cycle_count < 1 THEN
                    SET v_cycle_count = 1;
                END IF;

                SET v_base_amount = ROUND(v_amount / v_cycle_count, 2);
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

                    IF v_cycle = 'ONCE' THEN
                        SET v_milestone_name = 'Thanh toán một lần';
                    ELSE
                        SET v_milestone_name = CONCAT('Thanh toán kỳ ', v_cycle_index);
                    END IF;

                    IF v_cycle_index = v_cycle_count THEN
                        SET v_expected_amount = ROUND(v_amount - (v_base_amount * (v_cycle_count - 1)), 2);
                    ELSE
                        SET v_expected_amount = v_base_amount;
                    END IF;

                    INSERT INTO `payment_schedules` (%s)
                    VALUES (%s);

                    SET v_cycle_index = v_cycle_index + 1;
                END WHILE;
            END
            ",
            self::PROCEDURE_NAME,
            $cycleExpression,
            $projectExpression,
            $valueExpression,
            $startExpression,
            $endExpression,
            implode(', ', $insertColumns),
            implode(', ', $insertValues)
        );

        DB::unprepared($sql);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::unprepared(sprintf('DROP PROCEDURE IF EXISTS `%s`', self::PROCEDURE_NAME));
    }
};
