<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('product_target_segments') || Schema::hasColumn('product_target_segments', 'facility_types')) {
            return;
        }

        Schema::table('product_target_segments', function (Blueprint $table): void {
            $table->text('facility_types')->nullable()->after('facility_type');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('product_target_segments') || ! Schema::hasColumn('product_target_segments', 'facility_types')) {
            return;
        }

        Schema::table('product_target_segments', function (Blueprint $table): void {
            $table->dropColumn('facility_types');
        });
    }
};
