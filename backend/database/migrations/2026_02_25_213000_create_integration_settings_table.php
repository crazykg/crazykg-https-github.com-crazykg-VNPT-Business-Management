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
            Schema::create('integration_settings', function (Blueprint $table): void {
                $table->id();
                $table->string('provider', 100)->unique();
                $table->boolean('is_enabled')->default(false);
                $table->string('account_email', 255)->nullable();
                $table->string('folder_id', 255)->nullable();
                $table->string('scopes', 500)->nullable();
                $table->string('impersonate_user', 255)->nullable();
                $table->string('file_prefix', 100)->nullable();
                $table->longText('service_account_json')->nullable();
                $table->timestamp('last_tested_at')->nullable();
                $table->string('last_test_status', 20)->nullable();
                $table->string('last_test_message', 500)->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => 'GOOGLE_DRIVE'],
            [
                'is_enabled' => 0,
                'account_email' => 'vnpthishg@gmail.com',
                'scopes' => 'https://www.googleapis.com/auth/drive.file',
                'file_prefix' => 'VNPT',
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('integration_settings');
    }
};

