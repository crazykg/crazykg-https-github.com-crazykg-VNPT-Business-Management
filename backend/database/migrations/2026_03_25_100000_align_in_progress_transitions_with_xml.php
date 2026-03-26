<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @var array<int, string>
     */
    private array $invalidForwardTargets = [
        'waiting_customer_feedback',
        'analysis',
        'returned_to_manager',
        'not_executed',
    ];

    public function up(): void
    {
        if (! Schema::hasTable('customer_request_status_transitions')) {
            return;
        }

        DB::table('customer_request_status_transitions')
            ->where('from_status_code', 'in_progress')
            ->where('direction', 'forward')
            ->whereIn('to_status_code', $this->invalidForwardTargets)
            ->delete();

        $now = now();

        foreach ([
            ['completed', true, 10, 'Người thực hiện xác nhận hoàn thành yêu cầu'],
        ] as [$to, $isDefault, $sortOrder, $notes]) {
            DB::table('customer_request_status_transitions')
                ->updateOrInsert(
                    [
                        'from_status_code' => 'in_progress',
                        'to_status_code' => $to,
                        'direction' => 'forward',
                    ],
                    [
                        'is_default' => $isDefault,
                        'is_active' => true,
                        'sort_order' => $sortOrder,
                        'notes' => $notes,
                        'updated_at' => $now,
                        'created_at' => $now,
                    ]
                );
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('customer_request_status_transitions')) {
            return;
        }

        $now = now();

        foreach ([
            ['completed', true, 10, 'Người thực hiện xác nhận hoàn thành yêu cầu'],
            ['waiting_customer_feedback', false, 20, 'Người thực hiện yêu cầu khách hàng bổ sung thông tin'],
            ['analysis', false, 30, 'Người thực hiện chuyển yêu cầu sang phân tích'],
            ['returned_to_manager', false, 40, 'Người thực hiện chuyển trả PM để xin hướng dẫn thêm'],
            ['not_executed', false, 50, 'Người thực hiện xác nhận không thực hiện yêu cầu'],
        ] as [$to, $isDefault, $sortOrder, $notes]) {
            DB::table('customer_request_status_transitions')
                ->updateOrInsert(
                    [
                        'from_status_code' => 'in_progress',
                        'to_status_code' => $to,
                        'direction' => 'forward',
                    ],
                    [
                        'is_default' => $isDefault,
                        'is_active' => true,
                        'sort_order' => $sortOrder,
                        'notes' => $notes,
                        'updated_at' => $now,
                        'created_at' => $now,
                    ]
                );
        }
    }
};
