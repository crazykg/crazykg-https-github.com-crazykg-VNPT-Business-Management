<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds contract renewal/addendum columns to support parent–child
 * contract chains with gap tracking, continuity classification, and
 * penalty rate computation.
 *
 * Semantics:
 *   gap_days = parent.expiry_date.diffInDays(addendum.effective_date)
 *   EARLY (gap ≤ 0) | CONTINUOUS (gap = 1) | GAP (gap > 1) | STANDALONE (no parent)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contracts')) {
            return;
        }

        Schema::table('contracts', function (Blueprint $table): void {
            if (! Schema::hasColumn('contracts', 'parent_contract_id')) {
                $col = $table->unsignedBigInteger('parent_contract_id')->nullable();
                if (DB::getDriverName() === 'mysql') {
                    $col->after('payment_cycle');
                }
            }

            if (! Schema::hasColumn('contracts', 'addendum_type')) {
                $col = $table->string('addendum_type', 32)->nullable();
                if (DB::getDriverName() === 'mysql') {
                    $col->after('parent_contract_id');
                }
            }

            if (! Schema::hasColumn('contracts', 'gap_days')) {
                $col = $table->integer('gap_days')->nullable();
                if (DB::getDriverName() === 'mysql') {
                    $col->after('addendum_type');
                }
            }

            if (! Schema::hasColumn('contracts', 'continuity_status')) {
                $col = $table->string('continuity_status', 32)->nullable()->default('STANDALONE');
                if (DB::getDriverName() === 'mysql') {
                    $col->after('gap_days');
                }
            }

            if (! Schema::hasColumn('contracts', 'penalty_rate')) {
                $col = $table->decimal('penalty_rate', 5, 4)->nullable();
                if (DB::getDriverName() === 'mysql') {
                    $col->after('continuity_status');
                }
            }
        });

        // Index + FK — only on MySQL (SQLite test env doesn't need it)
        if (DB::getDriverName() === 'mysql' && Schema::hasColumn('contracts', 'parent_contract_id')) {
            $this->addIndexIfMissing('contracts', 'idx_contracts_parent', 'parent_contract_id');
            $this->addForeignKeyIfMissing();
        }

        // Column comments (MySQL only)
        if (DB::getDriverName() === 'mysql') {
            $this->applyColumnComments();
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('contracts')) {
            return;
        }

        // Drop FK before column
        if (DB::getDriverName() === 'mysql') {
            $this->dropForeignKeyIfExists('contracts', 'fk_contracts_parent');
            $this->dropIndexIfExists('contracts', 'idx_contracts_parent');
        }

        Schema::table('contracts', function (Blueprint $table): void {
            $columns = ['penalty_rate', 'continuity_status', 'gap_days', 'addendum_type', 'parent_contract_id'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('contracts', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    private function addIndexIfMissing(string $table, string $indexName, string $column): void
    {
        $exists = DB::selectOne(
            "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
            [$table, $indexName]
        );

        if ((int) ($exists?->cnt ?? 0) === 0) {
            DB::statement("ALTER TABLE `{$table}` ADD INDEX `{$indexName}` (`{$column}`)");
        }
    }

    private function addForeignKeyIfMissing(): void
    {
        $exists = DB::selectOne(
            "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contracts'
               AND CONSTRAINT_NAME = 'fk_contracts_parent' AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
        );

        if ((int) ($exists?->cnt ?? 0) === 0) {
            DB::statement(
                'ALTER TABLE `contracts`
                 ADD CONSTRAINT `fk_contracts_parent`
                 FOREIGN KEY (`parent_contract_id`) REFERENCES `contracts`(`id`) ON DELETE RESTRICT'
            );
        }
    }

    private function applyColumnComments(): void
    {
        $comments = [
            'parent_contract_id' => 'FK → contracts.id — HĐ gốc của phụ lục này',
            'addendum_type'      => 'EXTENSION | AMENDMENT | LIQUIDATION',
            'gap_days'           => 'gap≤0=EARLY, gap=1=CONTINUOUS, gap>1=GAP. diffInDays(expiry, effective). NULL khi thiếu dates',
            'continuity_status'  => 'STANDALONE | EARLY(gap≤0) | CONTINUOUS(gap=1) | GAP(gap>1)',
            'penalty_rate'       => 'Tỷ lệ giảm thanh toán (0.0500 = 5%). NULL = không phạt',
        ];

        foreach ($comments as $column => $comment) {
            if (Schema::hasColumn('contracts', $column)) {
                $escapedComment = str_replace("'", "''", $comment);
                $meta = DB::selectOne(
                    "SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                     FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contracts' AND COLUMN_NAME = ?",
                    [$column]
                );

                if ($meta) {
                    $nullable = strtoupper((string) ($meta->IS_NULLABLE ?? 'YES')) === 'YES' ? 'NULL' : 'NOT NULL';
                    $default = $meta->COLUMN_DEFAULT !== null
                        ? "DEFAULT '" . str_replace("'", "''", (string) $meta->COLUMN_DEFAULT) . "'"
                        : ($nullable === 'NULL' ? 'DEFAULT NULL' : '');

                    DB::statement(
                        "ALTER TABLE `contracts` MODIFY COLUMN `{$column}` {$meta->COLUMN_TYPE} {$nullable} {$default} COMMENT '{$escapedComment}'"
                    );
                }
            }
        }
    }

    private function dropForeignKeyIfExists(string $table, string $constraintName): void
    {
        $exists = DB::selectOne(
            "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
            [$table, $constraintName]
        );

        if ((int) ($exists?->cnt ?? 0) > 0) {
            DB::statement("ALTER TABLE `{$table}` DROP FOREIGN KEY `{$constraintName}`");
        }
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        $exists = DB::selectOne(
            "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
            [$table, $indexName]
        );

        if ((int) ($exists?->cnt ?? 0) > 0) {
            DB::statement("ALTER TABLE `{$table}` DROP INDEX `{$indexName}`");
        }
    }
};
