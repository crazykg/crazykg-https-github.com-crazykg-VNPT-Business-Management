<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_request_status_instances')) {
            return;
        }

        Schema::table('customer_request_status_instances', function (Blueprint $table): void {
            if (! Schema::hasColumn('customer_request_status_instances', 'decision_context_code')) {
                $table->string('decision_context_code', 80)->nullable()->after('next_instance_id')
                    ->comment('Mã context decision nghiệp vụ');
            }
            if (! Schema::hasColumn('customer_request_status_instances', 'decision_outcome_code')) {
                $table->string('decision_outcome_code', 80)->nullable()->after('decision_context_code')
                    ->comment('Kết quả chọn trong decision');
            }
            if (! Schema::hasColumn('customer_request_status_instances', 'decision_source_status_code')) {
                $table->string('decision_source_status_code', 80)->nullable()->after('decision_outcome_code')
                    ->comment('Trạng thái nguồn phát sinh decision');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('customer_request_status_instances')) {
            return;
        }

        Schema::table('customer_request_status_instances', function (Blueprint $table): void {
            foreach ([
                'decision_source_status_code',
                'decision_outcome_code',
                'decision_context_code',
            ] as $column) {
                if (Schema::hasColumn('customer_request_status_instances', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
