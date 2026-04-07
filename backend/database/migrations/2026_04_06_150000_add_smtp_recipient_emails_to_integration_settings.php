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
            if (! Schema::hasColumn('integration_settings', 'smtp_recipient_emails')) {
                $table->string('smtp_recipient_emails', 1000)->nullable()->after('smtp_username');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('integration_settings') || ! Schema::hasColumn('integration_settings', 'smtp_recipient_emails')) {
            return;
        }

        Schema::table('integration_settings', function (Blueprint $table): void {
            $table->dropColumn('smtp_recipient_emails');
        });
    }
};
