<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('business_domains')) {
            return;
        }

        Schema::table('business_domains', function (Blueprint $table): void {
            if (! Schema::hasColumn('business_domains', 'focal_point_name')) {
                $table->string('focal_point_name', 255)->nullable()->after('domain_name');
            }

            if (! Schema::hasColumn('business_domains', 'focal_point_phone')) {
                $table->string('focal_point_phone', 50)->nullable()->after('focal_point_name');
            }

            if (! Schema::hasColumn('business_domains', 'focal_point_email')) {
                $table->string('focal_point_email', 255)->nullable()->after('focal_point_phone');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('business_domains')) {
            return;
        }

        $columnsToDrop = array_values(array_filter([
            Schema::hasColumn('business_domains', 'focal_point_name') ? 'focal_point_name' : null,
            Schema::hasColumn('business_domains', 'focal_point_phone') ? 'focal_point_phone' : null,
            Schema::hasColumn('business_domains', 'focal_point_email') ? 'focal_point_email' : null,
        ]));

        if ($columnsToDrop === []) {
            return;
        }

        Schema::table('business_domains', function (Blueprint $table) use ($columnsToDrop): void {
            $table->dropColumn($columnsToDrop);
        });
    }
};
