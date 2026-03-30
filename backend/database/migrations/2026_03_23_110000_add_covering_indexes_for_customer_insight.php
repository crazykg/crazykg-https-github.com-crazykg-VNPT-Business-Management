<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Covering / composite indexes cho CustomerInsightService.
 *
 * Mỗi index giải quyết đúng một bottleneck đo được:
 *
 * ① contracts(customer_id, deleted_at)
 *      → WHERE customer_id = X AND deleted_at IS NULL trong buildContractsSummary,
 *        buildServicesUsed.  Index đơn fk_cont_cust_link chỉ có customer_id nên
 *        MySQL phải đọc thêm row để check deleted_at.
 *
 * ② contracts(customer_id, deleted_at, status, total_value)
 *      → Covering cho fallback buildContractsSummary (SELECT status, COUNT, SUM).
 *        Không phải JOIN contract_items → zero table-access khi cần tổng nhanh.
 *
 * ③ contract_items(product_id, contract_id)
 *      → Covering cho pre-aggregated popularity JOIN trong buildUpsellCandidates.
 *        Subquery cũ chạy N lần/sp; sau fix chạy 1 lần nhưng vẫn cần index này.
 *
 * ④ opportunities(customer_id, deleted_at, stage, expected_value)
 *      → Covering cho buildOpportunitiesSummary.
 *        Index cũ idx_opp_cust_stage (customer_id, stage) thiếu deleted_at → MySQL
 *        phải lookup thêm row; thiếu expected_value → ICP không áp được.
 *
 * ⑤ customer_request_cases(customer_id, deleted_at, current_status_code)
 *      → Covering cho buildCrcSummary GROUP BY current_status_code.
 *        Index đơn customer_id không đủ; deleted_at + status_code nằm ngoài → full row read.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ① contracts — covering WHERE (customer_id, deleted_at)
        if (Schema::hasTable('contracts') && ! $this->hasIndex('contracts', 'idx_cont_cust_del')) {
            $this->createIndex('contracts', ['customer_id', 'deleted_at'], 'idx_cont_cust_del');
        }

        // ② contracts — covering SELECT (status, total_value) + WHERE
        if (Schema::hasTable('contracts') && ! $this->hasIndex('contracts', 'idx_cont_cust_insight')) {
            $this->createIndex(
                'contracts',
                ['customer_id', 'deleted_at', 'status', 'total_value'],
                'idx_cont_cust_insight'
            );
        }

        // ③ contract_items — covering (product_id, contract_id) cho popularity subquery
        if (Schema::hasTable('contract_items') && ! $this->hasIndex('contract_items', 'idx_ci_product_contract')) {
            $this->createIndex('contract_items', ['product_id', 'contract_id'], 'idx_ci_product_contract');
        }

        // ④ opportunities — covering (customer_id, deleted_at, stage, expected_value)
        if (Schema::hasTable('opportunities') && ! $this->hasIndex('opportunities', 'idx_opp_insight')) {
            $this->createIndex(
                'opportunities',
                ['customer_id', 'deleted_at', 'stage', 'expected_value'],
                'idx_opp_insight'
            );
        }

        // ⑤ customer_request_cases — covering (customer_id, deleted_at, current_status_code)
        if (Schema::hasTable('customer_request_cases') && ! $this->hasIndex('customer_request_cases', 'idx_crc_cust_insight')) {
            $this->createIndex(
                'customer_request_cases',
                ['customer_id', 'deleted_at', 'current_status_code'],
                'idx_crc_cust_insight'
            );
        }
    }

    public function down(): void
    {
        $drops = [
            'contracts'              => ['idx_cont_cust_del', 'idx_cont_cust_insight'],
            'contract_items'         => ['idx_ci_product_contract'],
            'opportunities'          => ['idx_opp_insight'],
            'customer_request_cases' => ['idx_crc_cust_insight'],
        ];

        foreach ($drops as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($indexes as $idx) {
                if ($this->hasIndex($table, $idx)) {
                    $this->dropIndexByName($table, $idx);
                }
            }
        }
    }

    // ── helper ───────────────────────────────────────────────────────────────
    private function hasIndex(string $table, string $indexName): bool
    {
        if (! Schema::hasTable($table)) {
            return false;
        }

        if (! $this->usingMysql()) {
            return false;
        }

        $indexes = DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$indexName]);

        return ! empty($indexes);
    }

    /**
     * @param array<int, string> $columns
     */
    private function createIndex(string $table, array $columns, string $indexName): void
    {
        if ($this->usingMysql()) {
            $quotedColumns = implode(', ', array_map(
                static fn (string $column): string => sprintf('`%s`', $column),
                $columns
            ));

            DB::statement(sprintf(
                'CREATE INDEX `%s` ON `%s` (%s) ALGORITHM=INPLACE LOCK=NONE',
                $indexName,
                $table,
                $quotedColumns
            ));

            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns, $indexName): void {
            $blueprint->index($columns, $indexName);
        });
    }

    private function dropIndexByName(string $table, string $indexName): void
    {
        if ($this->usingMysql()) {
            DB::statement(sprintf(
                'ALTER TABLE `%s` DROP INDEX `%s`, ALGORITHM=INPLACE, LOCK=NONE',
                $table,
                $indexName
            ));

            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($indexName): void {
            $blueprint->dropIndex($indexName);
        });
    }

    private function usingMysql(): bool
    {
        return DB::getDriverName() === 'mysql';
    }
};
