<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @var array<string, array<int, string>>
     */
    private array $workflowaMap = [
        'new_intake' => ['assigned_to_receiver', 'returned_to_manager'],
        'assigned_to_receiver' => ['in_progress', 'returned_to_manager'],
        'returned_to_manager' => ['not_executed', 'waiting_customer_feedback', 'assigned_to_receiver', 'analysis', 'dms_transfer', 'coding', 'completed'],
        'in_progress' => ['completed', 'returned_to_manager'],
        'waiting_customer_feedback' => ['assigned_to_receiver', 'returned_to_manager'],
        'not_executed' => ['customer_notified', 'returned_to_manager'],
        'analysis' => ['analysis_completed', 'analysis_suspended', 'returned_to_manager'],
        'analysis_completed' => ['dms_transfer', 'coding', 'returned_to_manager'],
        'analysis_suspended' => ['analysis', 'analysis_completed', 'returned_to_manager'],
        'dms_transfer' => ['dms_task_created', 'returned_to_manager'],
        'dms_task_created' => ['dms_in_progress', 'returned_to_manager'],
        'dms_in_progress' => ['completed', 'dms_suspended', 'returned_to_manager'],
        'dms_suspended' => ['dms_in_progress', 'returned_to_manager'],
        'coding' => ['coding_in_progress', 'returned_to_manager'],
        'coding_in_progress' => ['completed', 'coding_suspended', 'returned_to_manager'],
        'coding_suspended' => ['coding_in_progress', 'returned_to_manager'],
        'completed' => ['assigned_to_receiver', 'returned_to_manager', 'customer_notified'],
        'customer_notified' => ['returned_to_manager'],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('customer_request_status_transitions')) {
            return;
        }

        $now = now();
        $fromStatusCodes = array_keys($this->workflowaMap);

        DB::table('customer_request_status_transitions')
            ->where('direction', 'forward')
            ->whereNotIn('from_status_code', $fromStatusCodes)
            ->update([
                'is_active' => false,
                'updated_at' => $now,
            ]);

        foreach ($this->workflowaMap as $fromStatusCode => $targets) {
            DB::table('customer_request_status_transitions')
                ->where('from_status_code', $fromStatusCode)
                ->where('direction', 'forward')
                ->whereNotIn('to_status_code', $targets)
                ->update([
                    'is_active' => false,
                    'updated_at' => $now,
                ]);

            foreach ($targets as $index => $toStatusCode) {
                DB::table('customer_request_status_transitions')->updateOrInsert(
                    [
                        'from_status_code' => $fromStatusCode,
                        'to_status_code' => $toStatusCode,
                        'direction' => 'forward',
                    ],
                    [
                        'is_default' => $index === 0,
                        'is_active' => true,
                        'sort_order' => ($index + 1) * 10,
                        'notes' => 'WorkflowA one-shot realign (2026-04-06)',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]
                );
            }
        }
    }

    public function down(): void
    {
        // Forward-only migration for runtime workflow realignment.
    }
};
