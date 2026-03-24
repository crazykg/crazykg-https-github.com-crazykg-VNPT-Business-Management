<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Align intake runtime with the XML baseline.
 *
 * `pending_dispatch` và `dispatched` chỉ là implementation detail cũ,
 * không phải node trạng thái độc lập trong XML. Runtime intake sau migration
 * chỉ còn `new_intake`; dữ liệu current đang nằm ở hai status cũ được migrate
 * về `new_intake`, còn catalog cũ được giữ inactive để timeline lịch sử vẫn có
 * nhãn tiếng Việt.
 */
return new class extends Migration
{
    /**
     * @var array<int, string>
     */
    private array $legacyStatuses = ['pending_dispatch', 'dispatched'];

    public function up(): void
    {
        $this->migrateCurrentCasesToNewIntake();
        $this->fixStatusCatalog();
        $this->fixStatusTransitions();
    }

    public function down(): void
    {
        $this->restoreStatusCatalog();
        $this->restoreStatusTransitions();
    }

    private function migrateCurrentCasesToNewIntake(): void
    {
        if (! Schema::hasTable('customer_request_cases') || ! Schema::hasTable('customer_request_status_instances')) {
            return;
        }

        $now = now();

        DB::table('customer_request_cases')
            ->whereIn('current_status_code', $this->legacyStatuses)
            ->update([
                'current_status_code' => 'new_intake',
                'current_status_changed_at' => $now,
                'updated_at' => $now,
            ]);

        $instances = DB::table('customer_request_status_instances')
            ->select(['id', 'request_case_id'])
            ->where('is_current', 1)
            ->whereIn('status_code', $this->legacyStatuses)
            ->get();

        foreach ($instances as $instance) {
            DB::table('customer_request_status_instances')
                ->where('id', $instance->id)
                ->update([
                    'status_code' => 'new_intake',
                    'status_table' => 'customer_request_cases',
                    'status_row_id' => (int) $instance->request_case_id,
                    'updated_at' => $now,
                ]);
        }
    }

    private function fixStatusCatalog(): void
    {
        if (! Schema::hasTable('customer_request_status_catalogs')) {
            return;
        }

        DB::table('customer_request_status_catalogs')
            ->whereIn('status_code', $this->legacyStatuses)
            ->update(['is_active' => false, 'updated_at' => now()]);
    }

    private function fixStatusTransitions(): void
    {
        if (! Schema::hasTable('customer_request_status_transitions')) {
            return;
        }

        DB::table('customer_request_status_transitions')
            ->where(function ($query): void {
                $query
                    ->whereIn('from_status_code', $this->legacyStatuses)
                    ->orWhereIn('to_status_code', $this->legacyStatuses);
            })
            ->delete();

        $now = now();

        foreach ([
            ['new_intake', 'not_executed', 'forward', false, 20, 'Từ tiếp nhận chuyển không thực hiện'],
            ['new_intake', 'waiting_customer_feedback', 'forward', false, 30, 'Từ tiếp nhận chờ khách hàng bổ sung'],
            ['new_intake', 'in_progress', 'forward', false, 40, 'Performer nhận việc trực tiếp từ tiếp nhận'],
            ['new_intake', 'analysis', 'forward', false, 50, 'Từ tiếp nhận chuyển BA phân tích'],
            ['new_intake', 'returned_to_manager', 'forward', false, 60, 'Performer trả PM trực tiếp từ tiếp nhận'],
            ['returned_to_manager', 'in_progress', 'forward', false, 20, 'PM giao lại performer trực tiếp'],
        ] as [$from, $to, $direction, $isDefault, $sortOrder, $notes]) {
            DB::table('customer_request_status_transitions')
                ->updateOrInsert(
                    [
                        'from_status_code' => $from,
                        'to_status_code' => $to,
                        'direction' => $direction,
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

    private function restoreStatusCatalog(): void
    {
        if (! Schema::hasTable('customer_request_status_catalogs')) {
            return;
        }

        DB::table('customer_request_status_catalogs')
            ->whereIn('status_code', $this->legacyStatuses)
            ->update(['is_active' => true, 'updated_at' => now()]);
    }

    private function restoreStatusTransitions(): void
    {
        if (! Schema::hasTable('customer_request_status_transitions')) {
            return;
        }

        foreach ([
            ['new_intake', 'not_executed'],
            ['new_intake', 'waiting_customer_feedback'],
            ['new_intake', 'in_progress'],
            ['new_intake', 'analysis'],
            ['new_intake', 'returned_to_manager'],
            ['returned_to_manager', 'in_progress'],
        ] as [$from, $to]) {
            DB::table('customer_request_status_transitions')
                ->where('from_status_code', $from)
                ->where('to_status_code', $to)
                ->where('direction', 'forward')
                ->delete();
        }

        $now = now();

        foreach ([
            ['new_intake', 'pending_dispatch', 'forward', false, 12, 'Creator giao PM điều phối'],
            ['new_intake', 'dispatched', 'forward', false, 13, 'Creator tự giao performer trực tiếp'],
            ['pending_dispatch', 'dispatched', 'forward', true, 10, 'PM phân công performer'],
            ['pending_dispatch', 'not_executed', 'forward', false, 20, 'PM từ chối yêu cầu'],
            ['pending_dispatch', 'waiting_customer_feedback', 'forward', false, 30, 'PM chờ KH bổ sung thông tin'],
            ['pending_dispatch', 'in_progress', 'forward', false, 40, 'PM tự xử lý'],
            ['pending_dispatch', 'analysis', 'forward', false, 50, 'PM chuyển phân tích'],
            ['dispatched', 'in_progress', 'forward', true, 10, 'Performer nhận việc'],
            ['dispatched', 'returned_to_manager', 'forward', false, 20, 'Performer trả lại PM'],
            ['returned_to_manager', 'dispatched', 'forward', false, 25, 'PM giao lại performer mới'],
            ['pending_dispatch', 'new_intake', 'backward', false, 50, 'Hủy giao PM về intake'],
            ['dispatched', 'pending_dispatch', 'backward', false, 30, 'PM thu hồi phân công'],
        ] as [$from, $to, $direction, $isDefault, $sortOrder, $notes]) {
            DB::table('customer_request_status_transitions')
                ->updateOrInsert(
                    [
                        'from_status_code' => $from,
                        'to_status_code' => $to,
                        'direction' => $direction,
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
