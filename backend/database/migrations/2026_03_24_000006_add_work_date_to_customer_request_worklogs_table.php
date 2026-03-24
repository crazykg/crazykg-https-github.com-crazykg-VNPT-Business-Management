<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_request_worklogs', function (Blueprint $table): void {
            if (!Schema::hasColumn('customer_request_worklogs', 'work_date')) {
                $table->date('work_date')->nullable()->after('hours_spent')->index()->comment('Ngày làm việc');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customer_request_worklogs', function (Blueprint $table): void {
            $table->dropColumn(['work_date']);
        });
    }
};