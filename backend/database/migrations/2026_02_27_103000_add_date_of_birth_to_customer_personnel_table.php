<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_personnel')) {
            return;
        }

        if (! Schema::hasColumn('customer_personnel', 'date_of_birth')) {
            Schema::table('customer_personnel', function (Blueprint $table) {
                $table->date('date_of_birth')->nullable()->after('full_name');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('customer_personnel')) {
            return;
        }

        if (Schema::hasColumn('customer_personnel', 'date_of_birth')) {
            Schema::table('customer_personnel', function (Blueprint $table) {
                $table->dropColumn('date_of_birth');
            });
        }
    }
};

