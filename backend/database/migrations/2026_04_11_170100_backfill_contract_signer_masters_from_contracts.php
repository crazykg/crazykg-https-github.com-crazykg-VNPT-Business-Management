<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable('contracts')
            || ! Schema::hasTable('contract_signer_masters')
            || ! Schema::hasColumn('contracts', 'signer_user_id')
        ) {
            return;
        }

        $contractsQuery = DB::table('contracts')
            ->select('signer_user_id')
            ->whereNotNull('signer_user_id');

        if (Schema::hasColumn('contracts', 'deleted_at')) {
            $contractsQuery->whereNull('deleted_at');
        }

        $signerIds = $contractsQuery
            ->distinct()
            ->pluck('signer_user_id')
            ->map(fn ($value): int => (int) $value)
            ->filter(fn (int $value): bool => $value > 0)
            ->values()
            ->all();

        if ($signerIds === []) {
            return;
        }

        $existingSignerIds = DB::table('contract_signer_masters')
            ->whereIn('internal_user_id', $signerIds)
            ->pluck('internal_user_id')
            ->map(fn ($value): int => (int) $value)
            ->all();

        $missingSignerIds = array_values(array_diff($signerIds, $existingSignerIds));
        if ($missingSignerIds === []) {
            return;
        }

        if (Schema::hasTable('internal_users')) {
            $internalUsersQuery = DB::table('internal_users')
                ->whereIn('id', $missingSignerIds);

            if (Schema::hasColumn('internal_users', 'deleted_at')) {
                $internalUsersQuery->whereNull('deleted_at');
            }

            $missingSignerIds = $internalUsersQuery
                ->pluck('id')
                ->map(fn ($value): int => (int) $value)
                ->filter(fn (int $value): bool => $value > 0)
                ->values()
                ->all();
        }

        if ($missingSignerIds === []) {
            return;
        }

        $now = now();
        $rows = array_map(function (int $internalUserId) use ($now): array {
            $row = [
                'internal_user_id' => $internalUserId,
            ];

            if (Schema::hasColumn('contract_signer_masters', 'is_active')) {
                $row['is_active'] = true;
            }
            if (Schema::hasColumn('contract_signer_masters', 'created_at')) {
                $row['created_at'] = $now;
            }
            if (Schema::hasColumn('contract_signer_masters', 'updated_at')) {
                $row['updated_at'] = $now;
            }

            return $row;
        }, $missingSignerIds);

        if ($rows !== []) {
            DB::table('contract_signer_masters')->insert($rows);
        }
    }

    public function down(): void
    {
        // Forward-only backfill.
    }
};
