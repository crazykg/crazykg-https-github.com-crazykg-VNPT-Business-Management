<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_request_status_catalogs')) {
            return;
        }

        Schema::table('customer_request_status_catalogs', function (Blueprint $table): void {
            if (! Schema::hasColumn('customer_request_status_catalogs', 'handler_field')) {
                $table->string('handler_field', 120)->nullable()->after('table_name')->comment('Tên field user đại diện người xử lý hiện tại');
            }
        });

        DB::table('customer_request_status_catalogs')
            ->whereIn('status_code', [
                'new_intake',
                'pending_dispatch',
                'assigned_to_receiver',
                'receiver_in_progress',
                'in_progress',
                'analysis',
                'coding',
                'dms_transfer',
                'completed',
                'customer_notified',
                'returned_to_manager',
                'not_executed',
            ])
            ->update([
                'updated_at' => now(),
            ]);

        $mapping = [
            'new_intake' => 'received_by_user_id',
            'pending_dispatch' => 'dispatcher_user_id',
            'assigned_to_receiver' => 'receiver_user_id',
            'receiver_in_progress' => 'receiver_user_id',
            'in_progress' => 'performer_user_id',
            'analysis' => 'performer_user_id',
            'coding' => 'developer_user_id',
            'dms_transfer' => 'dms_contact_user_id',
            'completed' => 'completed_by_user_id',
            'customer_notified' => 'notified_by_user_id',
            'returned_to_manager' => 'returned_by_user_id',
            'not_executed' => 'decision_by_user_id',
        ];

        foreach ($mapping as $statusCode => $handlerField) {
            DB::table('customer_request_status_catalogs')
                ->where('status_code', $statusCode)
                ->update([
                    'handler_field' => $handlerField,
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('customer_request_status_catalogs')) {
            return;
        }

        if (Schema::hasColumn('customer_request_status_catalogs', 'handler_field')) {
            Schema::table('customer_request_status_catalogs', function (Blueprint $table): void {
                $table->dropColumn('handler_field');
            });
        }
    }
};
