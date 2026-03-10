<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('integration_settings')) {
            return;
        }

        Schema::table('integration_settings', function (Blueprint $table): void {
            if (! Schema::hasColumn('integration_settings', 'bucket_id')) {
                $table->string('bucket_id', 255)->nullable()->after('bucket_name');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('integration_settings')) {
            return;
        }

        Schema::table('integration_settings', function (Blueprint $table): void {
            if (Schema::hasColumn('integration_settings', 'bucket_id')) {
                $table->dropColumn('bucket_id');
            }
        });
    }
};
