<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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
        Schema::table('contracts', function (Blueprint $table): void {
            if (! $this->hasIndex('contracts', 'idx_cont_cust_del')) {
                $table->index(
                    ['customer_id', 'deleted_at'],
                    'idx_cont_cust_del'
                );
            }
        });

        // ② contracts — covering SELECT (status, total_value) + WHERE
        Schema::table('contracts', function (Blueprint $table): void {
            if (! $this->hasIndex('contracts', 'idx_cont_cust_insight')) {
                $table->index(
                    ['customer_id', 'deleted_at', 'status', 'total_value'],
                    'idx_cont_cust_insight'
                );
            }
        });

        // ③ contract_items — covering (product_id, contract_id) cho popularity subquery
        Schema::table('contract_items', function (Blueprint $table): void {
            if (! $this->hasIndex('contract_items', 'idx_ci_product_contract')) {
                $table->index(
                    ['product_id', 'contract_id'],
                    'idx_ci_product_contract'
                );
            }
        });

        // ④ opportunities — covering (customer_id, deleted_at, stage, expected_value)
        Schema::table('opportunities', function (Blueprint $table): void {
            if (! $this->hasIndex('opportunities', 'idx_opp_insight')) {
                $table->index(
                    ['customer_id', 'deleted_at', 'stage', 'expected_value'],
                    'idx_opp_insight'
                );
            }
        });

        // ⑤ customer_request_cases — covering (customer_id, deleted_at, current_status_code)
        Schema::table('customer_request_cases', function (Blueprint $table): void {
            if (! $this->hasIndex('customer_request_cases', 'idx_crc_cust_insight')) {
                $table->index(
                    ['customer_id', 'deleted_at', 'current_status_code'],
                    'idx_crc_cust_insight'
                );
            }
        });
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
            Schema::table($table, function (Blueprint $t) use ($table, $indexes): void {
                foreach ($indexes as $idx) {
                    if ($this->hasIndex($table, $idx)) {
                        $t->dropIndex($idx);
                    }
                }
            });
        }
    }

    // ── helper ───────────────────────────────────────────────────────────────
    private function hasIndex(string $table, string $indexName): bool
    {
        $indexes = \Illuminate\Support\Facades\DB::select(
            "SHOW INDEX FROM `{$table}` WHERE Key_name = ?",
            [$indexName]
        );

        return ! empty($indexes);
    }
};
