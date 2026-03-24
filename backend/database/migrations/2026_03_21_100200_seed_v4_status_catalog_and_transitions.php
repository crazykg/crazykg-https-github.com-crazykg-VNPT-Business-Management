<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * V4 Migration P1.3
 * Seed 4 new status catalog entries + 20 new transition rules.
 *
 * Authoritative transition source — 20 rules (16 forward + 4 backward).
 * Legacy 32 rules remain active; only L3 & L4 will be disabled in P4a
 * after new flow is confirmed working on production.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->seedStatusCatalogs();
        $this->seedStatusTransitions();
    }

    public function down(): void
    {
        // Remove new transition rules
        $newFromPairs = [
            ['new_intake',          'pending_dispatch'],
            ['new_intake',          'dispatched'],
            ['pending_dispatch',    'dispatched'],
            ['pending_dispatch',    'not_executed'],
            ['pending_dispatch',    'waiting_customer_feedback'],
            ['pending_dispatch',    'in_progress'],
            ['pending_dispatch',    'analysis'],
            ['dispatched',          'in_progress'],
            ['dispatched',          'returned_to_manager'],
            ['returned_to_manager', 'dispatched'],
            ['analysis',            'coding'],
            ['analysis',            'dms_transfer'],
            ['coding',              'completed'],
            ['coding',              'returned_to_manager'],
            ['dms_transfer',        'completed'],
            ['dms_transfer',        'returned_to_manager'],
            ['pending_dispatch',    'new_intake'],         // backward
            ['dispatched',          'pending_dispatch'],   // backward
            ['coding',              'analysis'],           // backward
            ['dms_transfer',        'analysis'],           // backward
        ];

        if (Schema::hasTable('customer_request_status_transitions')) {
            foreach ($newFromPairs as [$from, $to]) {
                DB::table('customer_request_status_transitions')
                    ->where('from_status_code', $from)
                    ->where('to_status_code', $to)
                    ->delete();
            }
        }

        // Remove new catalog entries
        if (Schema::hasTable('customer_request_status_catalogs')) {
            DB::table('customer_request_status_catalogs')
                ->whereIn('status_code', ['pending_dispatch', 'dispatched', 'coding', 'dms_transfer'])
                ->delete();
        }
    }

    // ── private ──────────────────────────────────────────────────────────────

    private function seedStatusCatalogs(): void
    {
        if (! Schema::hasTable('customer_request_status_catalogs')) {
            return;
        }

        $now = now();

        $entries = [
            [
                'status_code'    => 'pending_dispatch',
                'status_name_vi' => 'Chờ PM điều phối',
                'table_name'     => 'customer_request_pending_dispatch',
                'sort_order'     => 15,
                'is_active'      => true,
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'status_code'    => 'dispatched',
                'status_name_vi' => 'Đã phân công',
                'table_name'     => 'customer_request_dispatched',
                'sort_order'     => 18,
                'is_active'      => true,
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'status_code'    => 'coding',
                'status_name_vi' => 'Đang lập trình',
                'table_name'     => 'customer_request_coding',
                'sort_order'     => 35,
                'is_active'      => true,
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'status_code'    => 'dms_transfer',
                'status_name_vi' => 'Chuyển DMS',
                'table_name'     => 'customer_request_dms_transfer',
                'sort_order'     => 38,
                'is_active'      => true,
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
        ];

        foreach ($entries as $entry) {
            DB::table('customer_request_status_catalogs')
                ->updateOrInsert(
                    ['status_code' => $entry['status_code']],
                    $entry
                );
        }
    }

    private function seedStatusTransitions(): void
    {
        if (! Schema::hasTable('customer_request_status_transitions')) {
            return;
        }

        $now = now();

        /**
         * 20 new rules — authoritative source (V4 plan P1.3, FIX ISSUE-5 R3).
         * Format: [from, to, direction, is_default, sort_order, notes]
         */
        $rows = [
            // ── FORWARD (16) ──────────────────────────────────────────────────
            ['new_intake',          'pending_dispatch',          'forward', false, 12, 'Creator giao PM điều phối'],
            ['new_intake',          'dispatched',                'forward', false, 13, 'Creator tự giao performer trực tiếp'],
            ['pending_dispatch',    'dispatched',                'forward', true,  10, 'PM phân công performer (mặc định)'],
            ['pending_dispatch',    'not_executed',              'forward', false, 20, 'PM từ chối yêu cầu'],
            ['pending_dispatch',    'waiting_customer_feedback', 'forward', false, 30, 'PM chờ KH bổ sung thông tin'],
            ['pending_dispatch',    'in_progress',               'forward', false, 40, 'PM tự xử lý'],
            ['pending_dispatch',    'analysis',                  'forward', false, 50, 'PM chuyển phân tích'],
            ['dispatched',          'in_progress',               'forward', true,  10, 'Performer nhận việc (mặc định)'],
            ['dispatched',          'returned_to_manager',       'forward', false, 20, 'Performer trả lại PM'],
            ['returned_to_manager', 'dispatched',                'forward', false, 25, 'PM giao lại performer mới'],
            ['analysis',            'coding',                    'forward', false, 40, 'BA chuyển sang lập trình'],
            ['analysis',            'dms_transfer',              'forward', false, 50, 'BA chuyển sang DMS'],
            ['coding',              'completed',                 'forward', true,  10, 'Lập trình hoàn thành (mặc định)'],
            ['coding',              'returned_to_manager',       'forward', false, 20, 'Dev trả lại PM'],
            ['dms_transfer',        'completed',                 'forward', true,  10, 'DMS hoàn thành (mặc định)'],
            ['dms_transfer',        'returned_to_manager',       'forward', false, 20, 'DMS trả lại PM'],
            // ── BACKWARD (4) ──────────────────────────────────────────────────
            ['pending_dispatch',    'new_intake',                'backward', false, 50, 'Hủy giao PM — về intake'],
            ['dispatched',          'pending_dispatch',          'backward', false, 30, 'PM thu hồi phân công'],
            ['coding',              'analysis',                  'backward', false, 30, 'Dev yêu cầu phân tích lại'],
            ['dms_transfer',        'analysis',                  'backward', false, 30, 'DMS yêu cầu phân tích lại'],
        ];

        foreach ($rows as [$from, $to, $dir, $isDefault, $sort, $notes]) {
            DB::table('customer_request_status_transitions')
                ->updateOrInsert(
                    [
                        'from_status_code' => $from,
                        'to_status_code'   => $to,
                        'direction'        => $dir,
                    ],
                    [
                        'is_default'  => $isDefault,
                        'is_active'   => true,
                        'sort_order'  => $sort,
                        'notes'       => $notes,
                        'created_at'  => $now,
                        'updated_at'  => $now,
                    ]
                );
        }
    }
};
