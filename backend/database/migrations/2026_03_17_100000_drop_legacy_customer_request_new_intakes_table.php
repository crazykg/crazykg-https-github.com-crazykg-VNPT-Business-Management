<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_request_status_catalogs')) {
            DB::table('customer_request_status_catalogs')
                ->where('status_code', 'new_intake')
                ->update([
                    'table_name' => 'customer_request_cases',
                    'updated_at' => now(),
                ]);
        }

        if (Schema::hasTable('customer_request_status_instances')) {
            DB::table('customer_request_status_instances')
                ->where('status_code', 'new_intake')
                ->orderBy('id')
                ->get()
                ->each(function (object $row): void {
                    DB::table('customer_request_status_instances')
                        ->where('id', (int) $row->id)
                        ->update([
                            'status_table' => 'customer_request_cases',
                            'status_row_id' => (int) $row->request_case_id,
                            'updated_at' => now(),
                        ]);
                });
        }

        if (! Schema::hasTable('customer_request_new_intakes')) {
            return;
        }

        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('customer_request_new_intakes');
        Schema::enableForeignKeyConstraints();
    }

    public function down(): void
    {
        // Bảng legacy đã được loại bỏ dứt điểm.
        // Không hỗ trợ phục hồi chiều ngược về schema cũ này nữa.
    }
};
