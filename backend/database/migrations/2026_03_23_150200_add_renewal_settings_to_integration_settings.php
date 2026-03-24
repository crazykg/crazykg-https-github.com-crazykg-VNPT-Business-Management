<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seeds three contract-renewal penalty settings into integration_settings.
 *
 * Settings semantics:
 *   - grace_days: gap_days <= 1 + grace_days → penalty_rate = null
 *   - rate_per_day: penalty_rate = gap_days * rate_per_day (round 4 HALF_UP, before cap)
 *   - max_rate: cap — penalty_rate = min(computed, max_rate)
 */
return new class extends Migration
{
    /**
     * @var array<string, array{value: string, description: string}>
     */
    private const SETTINGS = [
        'contract_renewal_grace_days' => [
            'value'       => '0',
            'description' => 'Ngày ân hạn — gap_days <= 1+grace → penalty_rate = null (continuity_status vẫn GAP khi gap>1)',
        ],
        'contract_renewal_penalty_rate_per_day' => [
            'value'       => '0.003333',
            'description' => 'Tỷ lệ phạt mỗi ngày trễ; kết quả round(4, HALF_UP) trước cap',
        ],
        'contract_renewal_max_penalty_rate' => [
            'value'       => '0.1500',
            'description' => 'Trần tỷ lệ phạt tối đa (0.1500 = 15%)',
        ],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('integration_settings')) {
            return;
        }

        $now = now();

        foreach (self::SETTINGS as $key => $meta) {
            DB::table('integration_settings')->updateOrInsert(
                ['provider' => $key],
                [
                    'is_enabled'  => true,
                    'updated_at'  => $now,
                    'created_at'  => $now,
                ]
            );

            // Store value in a column-safe way — the existing integration_settings
            // pattern stores ad-hoc values. We use description as docstring.
            if (Schema::hasColumn('integration_settings', 'setting_value')) {
                DB::table('integration_settings')
                    ->where('provider', $key)
                    ->whereNull('setting_value')
                    ->update(['setting_value' => $meta['value']]);
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('integration_settings')) {
            return;
        }

        $keys = array_keys(self::SETTINGS);
        DB::table('integration_settings')
            ->whereIn('provider', $keys)
            ->delete();
    }
};
