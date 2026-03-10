<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('integration_settings')) {
            return;
        }

        Schema::table('integration_settings', function (Blueprint $table): void {
            if (! Schema::hasColumn('integration_settings', 'access_key_id')) {
                $table->string('access_key_id', 255)->nullable()->after('account_email');
            }

            if (! Schema::hasColumn('integration_settings', 'secret_access_key')) {
                $table->longText('secret_access_key')->nullable()->after('service_account_json');
            }

            if (! Schema::hasColumn('integration_settings', 'bucket_name')) {
                $table->string('bucket_name', 255)->nullable()->after('folder_id');
            }

            if (! Schema::hasColumn('integration_settings', 'region')) {
                $table->string('region', 100)->nullable()->after('bucket_name');
            }

            if (! Schema::hasColumn('integration_settings', 'endpoint')) {
                $table->string('endpoint', 255)->nullable()->after('region');
            }
        });

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => 'BACKBLAZE_B2'],
            [
                'is_enabled' => 0,
                'endpoint' => 'https://s3.us-west-004.backblazeb2.com',
                'region' => 'us-west-004',
                'file_prefix' => 'VNPT',
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable('integration_settings')) {
            return;
        }

        DB::table('integration_settings')
            ->where('provider', 'BACKBLAZE_B2')
            ->delete();

        Schema::table('integration_settings', function (Blueprint $table): void {
            if (Schema::hasColumn('integration_settings', 'endpoint')) {
                $table->dropColumn('endpoint');
            }

            if (Schema::hasColumn('integration_settings', 'region')) {
                $table->dropColumn('region');
            }

            if (Schema::hasColumn('integration_settings', 'bucket_name')) {
                $table->dropColumn('bucket_name');
            }

            if (Schema::hasColumn('integration_settings', 'secret_access_key')) {
                $table->dropColumn('secret_access_key');
            }

            if (Schema::hasColumn('integration_settings', 'access_key_id')) {
                $table->dropColumn('access_key_id');
            }
        });
    }
};
