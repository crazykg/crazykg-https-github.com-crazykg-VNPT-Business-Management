<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Cho phép customer_code = NULL
        if (Schema::hasTable('customers') && Schema::hasColumn('customers', 'customer_code')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->string('customer_code', 100)->nullable()->change();
            });
        }

        // Cho phép contract_code = NULL
        if (Schema::hasTable('contracts') && Schema::hasColumn('contracts', 'contract_code')) {
            Schema::table('contracts', function (Blueprint $table) {
                $table->string('contract_code', 100)->nullable()->change();
            });
        }

        // contract_number (alias) nếu tồn tại
        if (Schema::hasTable('contracts') && Schema::hasColumn('contracts', 'contract_number')) {
            Schema::table('contracts', function (Blueprint $table) {
                $table->string('contract_number', 100)->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        // Rollback: set về NOT NULL — chỉ an toàn khi không có row NULL
        if (Schema::hasTable('customers') && Schema::hasColumn('customers', 'customer_code')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->string('customer_code', 100)->nullable(false)->change();
            });
        }

        if (Schema::hasTable('contracts') && Schema::hasColumn('contracts', 'contract_code')) {
            Schema::table('contracts', function (Blueprint $table) {
                $table->string('contract_code', 100)->nullable(false)->change();
            });
        }
    }
};
