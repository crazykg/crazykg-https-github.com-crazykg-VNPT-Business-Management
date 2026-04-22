<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable('contract_signer_masters')
            || ! Schema::hasTable('contracts')
            || ! Schema::hasColumn('contracts', 'signer_user_id')
        ) {
            return;
        }

        $query = DB::table('contracts')
            ->whereNotNull('contracts.signer_user_id')
            ->select('contracts.signer_user_id')
            ->distinct();

        if (Schema::hasColumn('contracts', 'deleted_at')) {
            $query->whereNull('contracts.deleted_at');
        }

        if (Schema::hasTable('internal_users')) {
            $query->join('internal_users', 'internal_users.id', '=', 'contracts.signer_user_id');

            if (Schema::hasColumn('internal_users', 'deleted_at')) {
                $query->whereNull('internal_users.deleted_at');
            }
        }

        $now = now();

        $query->pluck('contracts.signer_user_id')
            ->map(fn ($value): int => (int) $value)
            ->filter(fn (int $value): bool => $value > 0)
            ->unique()
            ->each(function (int $internalUserId) use ($now): void {
                $payload = [
                    'is_active' => true,
                ];

                if (Schema::hasColumn('contract_signer_masters', 'created_at')) {
                    $payload['created_at'] = $now;
                }
                if (Schema::hasColumn('contract_signer_masters', 'updated_at')) {
                    $payload['updated_at'] = $now;
                }

                DB::table('contract_signer_masters')->updateOrInsert(
                    ['internal_user_id' => $internalUserId],
                    $payload,
                );
            });
    }

    public function down(): void
    {
        // No-op to avoid deleting manually maintained signer allowlist rows.
    }
};
