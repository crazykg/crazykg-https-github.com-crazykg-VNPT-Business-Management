<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'opportunity_raci_assignments';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            $hasOpportunitiesTable = Schema::hasTable('opportunities');
            $hasInternalUsersTable = Schema::hasTable('internal_users');

            Schema::create(self::TABLE, function (Blueprint $table) use ($hasOpportunitiesTable, $hasInternalUsersTable): void {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('opportunity_id');
                $table->unsignedBigInteger('user_id');
                $table->enum('raci_role', ['R', 'A', 'C', 'I']);
                $table->timestamps();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();

                $table->unique(['opportunity_id', 'raci_role'], 'uq_opp_raci_opportunity_role');
                $table->unique(['opportunity_id', 'user_id', 'raci_role'], 'uq_opp_raci_opportunity_user_role');
                $table->index('opportunity_id', 'idx_opp_raci_opportunity_id');
                $table->index('user_id', 'idx_opp_raci_user_id');

                if ($hasOpportunitiesTable) {
                    $table->foreign('opportunity_id', 'fk_opp_raci_opportunity_id')
                        ->references('id')
                        ->on('opportunities')
                        ->cascadeOnDelete();
                }

                if ($hasInternalUsersTable) {
                    $table->foreign('user_id', 'fk_opp_raci_user_id')
                        ->references('id')
                        ->on('internal_users')
                        ->cascadeOnDelete();
                }
            });
        }

        $this->migrateLegacyOpportunityRaciRows();
    }

    public function down(): void
    {
        Schema::dropIfExists(self::TABLE);
    }

    private function migrateLegacyOpportunityRaciRows(): void
    {
        if (
            ! Schema::hasTable(self::TABLE)
            || ! Schema::hasTable('raci_assignments')
            || ! Schema::hasTable('opportunities')
            || ! Schema::hasTable('internal_users')
        ) {
            return;
        }

        foreach (['opportunity_id', 'user_id', 'raci_role'] as $column) {
            if (! Schema::hasColumn(self::TABLE, $column)) {
                return;
            }
        }

        foreach (['entity_type', 'entity_id', 'user_id', 'raci_role'] as $column) {
            if (! Schema::hasColumn('raci_assignments', $column)) {
                return;
            }
        }

        if (! Schema::hasColumn('opportunities', 'id') || ! Schema::hasColumn('internal_users', 'id')) {
            return;
        }

        $hasSourceId = Schema::hasColumn('raci_assignments', 'id');
        $hasSourceCreatedAt = Schema::hasColumn('raci_assignments', 'created_at');
        $hasSourceUpdatedAt = Schema::hasColumn('raci_assignments', 'updated_at');
        $hasSourceCreatedBy = Schema::hasColumn('raci_assignments', 'created_by');
        $hasSourceUpdatedBy = Schema::hasColumn('raci_assignments', 'updated_by');
        $hasTargetCreatedAt = Schema::hasColumn(self::TABLE, 'created_at');
        $hasTargetUpdatedAt = Schema::hasColumn(self::TABLE, 'updated_at');
        $hasTargetCreatedBy = Schema::hasColumn(self::TABLE, 'created_by');
        $hasTargetUpdatedBy = Schema::hasColumn(self::TABLE, 'updated_by');

        $selects = [
            'ra.entity_id as opportunity_id',
            'ra.user_id as user_id',
            DB::raw('UPPER(ra.raci_role) as raci_role'),
            $hasSourceId ? 'ra.id as source_id' : DB::raw('0 as source_id'),
            $hasSourceCreatedAt ? 'ra.created_at as source_created_at' : DB::raw('NULL as source_created_at'),
            $hasSourceUpdatedAt ? 'ra.updated_at as source_updated_at' : DB::raw('NULL as source_updated_at'),
            $hasSourceCreatedBy ? 'ra.created_by as source_created_by' : DB::raw('NULL as source_created_by'),
            $hasSourceUpdatedBy ? 'ra.updated_by as source_updated_by' : DB::raw('NULL as source_updated_by'),
        ];

        $rows = DB::table('raci_assignments as ra')
            ->join('opportunities as o', 'o.id', '=', 'ra.entity_id')
            ->join('internal_users as iu', 'iu.id', '=', 'ra.user_id')
            ->whereRaw('LOWER(ra.entity_type) = ?', ['opportunity'])
            ->whereIn(DB::raw('UPPER(ra.raci_role)'), ['R', 'A', 'C', 'I'])
            ->select($selects)
            ->orderBy('ra.entity_id')
            ->orderByRaw("FIELD(UPPER(ra.raci_role), 'R', 'A', 'C', 'I')")
            ->when($hasSourceUpdatedAt, function ($query): void {
                $query->orderByRaw('CASE WHEN ra.updated_at IS NULL THEN 1 ELSE 0 END')
                    ->orderByDesc('ra.updated_at');
            })
            ->when($hasSourceCreatedAt, function ($query): void {
                $query->orderByRaw('CASE WHEN ra.created_at IS NULL THEN 1 ELSE 0 END')
                    ->orderByDesc('ra.created_at');
            })
            ->when($hasSourceId, fn ($query) => $query->orderByDesc('ra.id'))
            ->get();

        if ($rows->isEmpty()) {
            return;
        }

        $seen = [];
        $payload = [];
        $fallbackTimestamp = now();

        foreach ($rows as $item) {
            $row = (array) $item;
            $opportunityId = $this->toNullablePositiveInt($row['opportunity_id'] ?? null);
            $userId = $this->toNullablePositiveInt($row['user_id'] ?? null);
            $role = strtoupper(trim((string) ($row['raci_role'] ?? '')));
            if ($opportunityId === null || $userId === null || ! in_array($role, ['R', 'A', 'C', 'I'], true)) {
                continue;
            }

            $key = "{$opportunityId}|{$role}";
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            $insert = [
                'opportunity_id' => $opportunityId,
                'user_id' => $userId,
                'raci_role' => $role,
            ];

            if ($hasTargetCreatedAt) {
                $insert['created_at'] = $row['source_created_at'] ?? $row['source_updated_at'] ?? $fallbackTimestamp;
            }
            if ($hasTargetUpdatedAt) {
                $insert['updated_at'] = $row['source_updated_at'] ?? $row['source_created_at'] ?? $fallbackTimestamp;
            }
            if ($hasTargetCreatedBy) {
                $insert['created_by'] = $this->toNullablePositiveInt($row['source_created_by'] ?? null);
            }
            if ($hasTargetUpdatedBy) {
                $insert['updated_by'] = $this->toNullablePositiveInt($row['source_updated_by'] ?? null);
            }

            $payload[] = $insert;
        }

        if ($payload === []) {
            return;
        }

        foreach (array_chunk($payload, 500) as $chunk) {
            DB::table(self::TABLE)->insertOrIgnore($chunk);
        }
    }

    private function toNullablePositiveInt(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value > 0 ? $value : null;
        }

        if (is_string($value)) {
            $value = trim($value);
            if ($value === '' || ! preg_match('/^-?\d+$/', $value)) {
                return null;
            }
            $value = (int) $value;

            return $value > 0 ? $value : null;
        }

        if (is_float($value) && is_finite($value)) {
            $intValue = (int) $value;
            return $intValue > 0 ? $intValue : null;
        }

        return null;
    }
};
