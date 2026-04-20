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
            if (! Schema::hasColumn('integration_settings', 'telegram_enabled')) {
                $table->boolean('telegram_enabled')->default(false)->after('is_enabled');
            }
            if (! Schema::hasColumn('integration_settings', 'telegram_bot_username')) {
                $table->string('telegram_bot_username', 255)->nullable()->after('telegram_enabled');
            }
            if (! Schema::hasColumn('integration_settings', 'telegram_bot_token_encrypted')) {
                $table->longText('telegram_bot_token_encrypted')->nullable()->after('telegram_bot_username');
            }
            if (! Schema::hasColumn('integration_settings', 'telegram_last_test_status')) {
                $table->string('telegram_last_test_status', 50)->nullable()->after('telegram_bot_token_encrypted');
            }
            if (! Schema::hasColumn('integration_settings', 'telegram_last_test_message')) {
                $table->text('telegram_last_test_message')->nullable()->after('telegram_last_test_status');
            }
            if (! Schema::hasColumn('integration_settings', 'telegram_last_test_at')) {
                $table->dateTime('telegram_last_test_at')->nullable()->after('telegram_last_test_message');
            }
        });

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => 'TELEGRAM'],
            [
                'is_enabled' => 0,
                'telegram_enabled' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable('integration_settings')) {
            return;
        }

        DB::table('integration_settings')
            ->where('provider', 'TELEGRAM')
            ->delete();

        Schema::table('integration_settings', function (Blueprint $table): void {
            foreach ([
                'telegram_last_test_at',
                'telegram_last_test_message',
                'telegram_last_test_status',
                'telegram_bot_token_encrypted',
                'telegram_bot_username',
                'telegram_enabled',
            ] as $column) {
                if (Schema::hasColumn('integration_settings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
