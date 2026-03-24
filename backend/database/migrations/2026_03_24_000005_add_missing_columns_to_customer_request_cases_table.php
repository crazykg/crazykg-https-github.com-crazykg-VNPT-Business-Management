<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_request_cases', function (Blueprint $table): void {
            if (!Schema::hasColumn('customer_request_cases', 'estimated_hours')) {
                $table->decimal('estimated_hours', 8, 2)->nullable()->after('priority')->comment('Số giờ ước lượng');
            }
            if (!Schema::hasColumn('customer_request_cases', 'total_hours_spent')) {
                $table->decimal('total_hours_spent', 8, 2)->default(0)->after('estimated_hours')->comment('Tổng số giờ đã thực hiện');
            }
            if (!Schema::hasColumn('customer_request_cases', 'dispatcher_user_id')) {
                $table->unsignedBigInteger('dispatcher_user_id')->nullable()->after('received_by_user_id')->index()->comment('Người điều phối');
            }
            if (!Schema::hasColumn('customer_request_cases', 'performer_user_id')) {
                $table->unsignedBigInteger('performer_user_id')->nullable()->after('dispatcher_user_id')->index()->comment('Người thực hiện');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customer_request_cases', function (Blueprint $table): void {
            $table->dropColumn(['estimated_hours', 'total_hours_spent', 'dispatcher_user_id', 'performer_user_id']);
        });
    }
};