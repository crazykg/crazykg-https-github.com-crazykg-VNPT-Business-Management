<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const CONTRACT_ALERT_PROVIDER = 'CONTRACT_ALERT';
    private const DEFAULT_WARNING_DAYS = 30;

    public function up(): void
    {
        if (! Schema::hasTable('integration_settings')) {
            return;
        }

        if (! Schema::hasColumn('integration_settings', 'contract_expiry_warning_days')) {
            Schema::table('integration_settings', function (Blueprint $table): void {
                $column = $table->unsignedSmallInteger('contract_expiry_warning_days')->nullable();
                if (DB::getDriverName() === 'mysql') {
                    $column->after('is_enabled');
                }
            });
        }

        DB::table('integration_settings')
            ->whereNull('contract_expiry_warning_days')
            ->update(['contract_expiry_warning_days' => self::DEFAULT_WARNING_DAYS]);

        $now = now();
        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::CONTRACT_ALERT_PROVIDER],
            [
                'is_enabled' => true,
                'contract_expiry_warning_days' => self::DEFAULT_WARNING_DAYS,
                'updated_at' => $now,
                'created_at' => $now,
            ]
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable('integration_settings')) {
            return;
        }

        DB::table('integration_settings')
            ->where('provider', self::CONTRACT_ALERT_PROVIDER)
            ->delete();

        if (Schema::hasColumn('integration_settings', 'contract_expiry_warning_days')) {
            Schema::table('integration_settings', function (Blueprint $table): void {
                $table->dropColumn('contract_expiry_warning_days');
            });
        }
    }
};
