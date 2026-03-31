<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_request_cases', function (Blueprint $table) {
            if (! Schema::hasColumn('customer_request_cases', 'nguoi_xu_ly_id')) {
                $table->unsignedBigInteger('nguoi_xu_ly_id')->nullable()->after('performer_user_id')->comment('Người xử lý hiện tại của yêu cầu');
            }
        });

        if (! Schema::hasColumn('customer_request_cases', 'nguoi_xu_ly_id')) {
            return;
        }

        $cases = DB::table('customer_request_cases')->select(['id', 'current_status_code', 'received_by_user_id', 'dispatcher_user_id', 'performer_user_id'])->get();

        foreach ($cases as $case) {
            $handlerUserId = match ((string) ($case->current_status_code ?? '')) {
                'new_intake' => $case->received_by_user_id,
                'pending_dispatch' => $case->dispatcher_user_id,
                'in_progress', 'analysis' => $case->performer_user_id,
                default => $case->performer_user_id ?? $case->dispatcher_user_id ?? $case->received_by_user_id,
            };

            $statusSpecificUserId = match ((string) ($case->current_status_code ?? '')) {
                'assigned_to_receiver', 'receiver_in_progress' => DB::table('customer_request_status_instances as si')
                    ->leftJoin('customer_request_assigned_to_receiver as ar', function ($join): void {
                        $join->on('ar.status_instance_id', '=', 'si.id')->orOn('ar.request_case_id', '=', 'si.request_case_id');
                    })
                    ->leftJoin('customer_request_receiver_in_progress as rip', function ($join): void {
                        $join->on('rip.status_instance_id', '=', 'si.id')->orOn('rip.request_case_id', '=', 'si.request_case_id');
                    })
                    ->where('si.request_case_id', $case->id)
                    ->where('si.is_current', 1)
                    ->value(DB::raw('COALESCE(rip.receiver_user_id, ar.receiver_user_id)')),
                'coding' => DB::table('customer_request_status_instances as si')
                    ->leftJoin('customer_request_coding as coding', function ($join): void {
                        $join->on('coding.status_instance_id', '=', 'si.id')->orOn('coding.request_case_id', '=', 'si.request_case_id');
                    })
                    ->where('si.request_case_id', $case->id)
                    ->where('si.is_current', 1)
                    ->value('coding.developer_user_id'),
                'dms_transfer' => DB::table('customer_request_status_instances as si')
                    ->leftJoin('customer_request_dms_transfer as dms', function ($join): void {
                        $join->on('dms.status_instance_id', '=', 'si.id')->orOn('dms.request_case_id', '=', 'si.request_case_id');
                    })
                    ->where('si.request_case_id', $case->id)
                    ->where('si.is_current', 1)
                    ->value('dms.dms_contact_user_id'),
                'completed' => DB::table('customer_request_status_instances as si')
                    ->leftJoin('customer_request_completed as completed', function ($join): void {
                        $join->on('completed.status_instance_id', '=', 'si.id')->orOn('completed.request_case_id', '=', 'si.request_case_id');
                    })
                    ->where('si.request_case_id', $case->id)
                    ->where('si.is_current', 1)
                    ->value('completed.completed_by_user_id'),
                'customer_notified' => DB::table('customer_request_status_instances as si')
                    ->leftJoin('customer_request_customer_notified as notified', function ($join): void {
                        $join->on('notified.status_instance_id', '=', 'si.id')->orOn('notified.request_case_id', '=', 'si.request_case_id');
                    })
                    ->where('si.request_case_id', $case->id)
                    ->where('si.is_current', 1)
                    ->value('notified.notified_by_user_id'),
                'returned_to_manager' => DB::table('customer_request_status_instances as si')
                    ->leftJoin('customer_request_returned_to_manager as returned', function ($join): void {
                        $join->on('returned.status_instance_id', '=', 'si.id')->orOn('returned.request_case_id', '=', 'si.request_case_id');
                    })
                    ->where('si.request_case_id', $case->id)
                    ->where('si.is_current', 1)
                    ->value('returned.returned_by_user_id'),
                'not_executed' => DB::table('customer_request_status_instances as si')
                    ->leftJoin('customer_request_not_executed as ne', function ($join): void {
                        $join->on('ne.status_instance_id', '=', 'si.id')->orOn('ne.request_case_id', '=', 'si.request_case_id');
                    })
                    ->where('si.request_case_id', $case->id)
                    ->where('si.is_current', 1)
                    ->value('ne.decision_by_user_id'),
                default => null,
            };

            DB::table('customer_request_cases')
                ->where('id', $case->id)
                ->update([
                    'nguoi_xu_ly_id' => $statusSpecificUserId ?? $handlerUserId,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('customer_request_cases', function (Blueprint $table) {
            if (Schema::hasColumn('customer_request_cases', 'nguoi_xu_ly_id')) {
                $table->dropColumn('nguoi_xu_ly_id');
            }
        });
    }
};
