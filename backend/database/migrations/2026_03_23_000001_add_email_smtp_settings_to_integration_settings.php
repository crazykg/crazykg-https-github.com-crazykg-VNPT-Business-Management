<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('integration_settings')) {
            return;
        }

        Schema::table('integration_settings', function (Blueprint $table): void {
            // SMTP Settings - thêm sau column file_prefix
            if (! Schema::hasColumn('integration_settings', 'smtp_host')) {
                $table->string('smtp_host')->nullable()->after('file_prefix');
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_port')) {
                $table->integer('smtp_port')->nullable()->after('smtp_host');
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_encryption')) {
                $table->string('smtp_encryption')->default('tls')->after('smtp_port'); // tls/ssl/none
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_username')) {
                $table->string('smtp_username')->nullable()->after('smtp_encryption');
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_password')) {
                $table->text('smtp_password')->nullable()->after('smtp_username'); // encrypted
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_from_address')) {
                $table->string('smtp_from_address')->nullable()->after('smtp_password');
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_from_name')) {
                $table->string('smtp_from_name')->nullable()->after('smtp_from_address');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('integration_settings', function (Blueprint $table): void {
            $table->dropColumn([
                'smtp_host',
                'smtp_port',
                'smtp_encryption',
                'smtp_username',
                'smtp_password',
                'smtp_from_address',
                'smtp_from_name',
            ]);
        });
    }
};
