<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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

    /**
     * @var array<int, string>
     */
    private array $fixedFieldTables = [
        'customer_request_cases',
        'customer_request_waiting_customer_feedbacks',
        'customer_request_in_progress',
        'customer_request_not_executed',
        'customer_request_completed',
        'customer_request_customer_notified',
        'customer_request_returned_to_manager',
        'customer_request_analysis',
        'customer_request_assigned_to_receiver',
        'customer_request_analysis_completed',
        'customer_request_analysis_suspended',
        'customer_request_coding',
        'customer_request_coding_in_progress',
        'customer_request_coding_suspended',
        'customer_request_dms_transfer',
        'customer_request_dms_task_created',
        'customer_request_dms_in_progress',
        'customer_request_dms_suspended',
    ];

    public function up(): void
    {
        $this->alignWorkflowATransitions();
        $this->addFixedStatusColumns();
    }

    public function down(): void
    {
        // Forward-only migration for workflow alignment and fixed status payload columns.
    }

    private function alignWorkflowATransitions(): void
    {
        if (! Schema::hasTable('customer_request_status_transitions')) {
            return;
        }

        $now = now();

        foreach ($this->workflowaMap as $from => $targets) {
            DB::table('customer_request_status_transitions')
                ->where('from_status_code', $from)
                ->where('direction', 'forward')
                ->whereNotIn('to_status_code', $targets)
                ->update([
                    'is_active' => false,
                    'updated_at' => $now,
                ]);

            foreach ($targets as $index => $to) {
                DB::table('customer_request_status_transitions')
                    ->updateOrInsert(
                        [
                            'from_status_code' => $from,
                            'to_status_code' => $to,
                            'direction' => 'forward',
                        ],
                        [
                            'is_default' => $index === 0,
                            'is_active' => true,
                            'sort_order' => ($index + 1) * 10,
                            'notes' => 'WorkflowA fixed transition map',
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]
                    );
            }
        }
    }

    private function addFixedStatusColumns(): void
    {
        foreach ($this->fixedFieldTables as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName): void {
                if (! Schema::hasColumn($tableName, 'received_at')) {
                    $table->dateTime('received_at')->nullable();
                }

                if (! Schema::hasColumn($tableName, 'completed_at')) {
                    $table->dateTime('completed_at')->nullable();
                }

                if (! Schema::hasColumn($tableName, 'extended_at')) {
                    $table->dateTime('extended_at')->nullable();
                }

                if (! Schema::hasColumn($tableName, 'progress_percent')) {
                    $table->unsignedTinyInteger('progress_percent')->nullable();
                }

                if (! Schema::hasColumn($tableName, 'from_user_id')) {
                    $table->unsignedBigInteger('from_user_id')->nullable()->index();
                }

                if (! Schema::hasColumn($tableName, 'to_user_id')) {
                    $table->unsignedBigInteger('to_user_id')->nullable()->index();
                }
            });
        }
    }
};
