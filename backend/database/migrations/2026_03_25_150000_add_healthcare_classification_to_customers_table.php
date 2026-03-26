<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customers')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'customer_sector')) {
                $table->string('customer_sector', 30)->nullable()->after('address');
            }
            if (! Schema::hasColumn('customers', 'healthcare_facility_type')) {
                $table->string('healthcare_facility_type', 50)->nullable()->after('customer_sector');
            }
            if (! Schema::hasColumn('customers', 'bed_capacity')) {
                $table->unsignedInteger('bed_capacity')->nullable()->after('healthcare_facility_type');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('customers')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'bed_capacity')) {
                $table->dropColumn('bed_capacity');
            }
            if (Schema::hasColumn('customers', 'healthcare_facility_type')) {
                $table->dropColumn('healthcare_facility_type');
            }
            if (Schema::hasColumn('customers', 'customer_sector')) {
                $table->dropColumn('customer_sector');
            }
        });
    }
};
