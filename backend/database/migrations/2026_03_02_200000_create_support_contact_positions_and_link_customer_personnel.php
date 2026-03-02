<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $this->ensureSupportContactPositionsTable();
        $this->seedDefaultSupportContactPositions();
        $this->ensureSupportContactPositionIndexes();
        $this->ensureCustomerPersonnelPositionLink();
        $this->ensureSupportContactPositionPermissions();
    }

    public function down(): void
    {
        $this->dropSupportContactPositionPermissions();

        if (Schema::hasTable('customer_personnel')) {
            if ($this->foreignKeyExists('customer_personnel', 'fk_customer_personnel_position')) {
                Schema::table('customer_personnel', function (Blueprint $table): void {
                    $table->dropForeign('fk_customer_personnel_position');
                });
            }

            if ($this->indexExists('customer_personnel', 'idx_customer_personnel_position_id')) {
                Schema::table('customer_personnel', function (Blueprint $table): void {
                    $table->dropIndex('idx_customer_personnel_position_id');
                });
            }

            if (Schema::hasColumn('customer_personnel', 'position_id')) {
                Schema::table('customer_personnel', function (Blueprint $table): void {
                    $table->dropColumn('position_id');
                });
            }
        }

        if (Schema::hasTable('support_contact_positions')) {
            if ($this->indexExists('support_contact_positions', 'uq_support_contact_positions_code')) {
                Schema::table('support_contact_positions', function (Blueprint $table): void {
                    $table->dropUnique('uq_support_contact_positions_code');
                });
            }
            if ($this->indexExists('support_contact_positions', 'uq_support_contact_positions_name')) {
                Schema::table('support_contact_positions', function (Blueprint $table): void {
                    $table->dropUnique('uq_support_contact_positions_name');
                });
            }

            Schema::dropIfExists('support_contact_positions');
        }
    }

    private function ensureSupportContactPositionsTable(): void
    {
        if (! Schema::hasTable('support_contact_positions')) {
            Schema::create('support_contact_positions', function (Blueprint $table): void {
                $table->id();
                $table->string('position_code', 50);
                $table->string('position_name', 120);
                $table->string('description', 255)->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });

            return;
        }

        Schema::table('support_contact_positions', function (Blueprint $table): void {
            if (! Schema::hasColumn('support_contact_positions', 'position_code')) {
                $table->string('position_code', 50)->nullable()->after('id');
            }
            if (! Schema::hasColumn('support_contact_positions', 'position_name')) {
                $table->string('position_name', 120)->nullable()->after('position_code');
            }
            if (! Schema::hasColumn('support_contact_positions', 'description')) {
                $table->string('description', 255)->nullable()->after('position_name');
            }
            if (! Schema::hasColumn('support_contact_positions', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('description');
            }
            if (! Schema::hasColumn('support_contact_positions', 'created_by')) {
                $table->unsignedBigInteger('created_by')->nullable()->after('is_active');
            }
            if (! Schema::hasColumn('support_contact_positions', 'updated_by')) {
                $table->unsignedBigInteger('updated_by')->nullable()->after('created_by');
            }
            if (! Schema::hasColumn('support_contact_positions', 'created_at')) {
                $table->timestamp('created_at')->nullable()->after('updated_by');
            }
            if (! Schema::hasColumn('support_contact_positions', 'updated_at')) {
                $table->timestamp('updated_at')->nullable()->after('created_at');
            }
        });
    }

    private function ensureSupportContactPositionIndexes(): void
    {
        if (! Schema::hasTable('support_contact_positions')) {
            return;
        }

        if (
            Schema::hasColumn('support_contact_positions', 'position_code')
            && ! $this->indexExists('support_contact_positions', 'uq_support_contact_positions_code')
        ) {
            Schema::table('support_contact_positions', function (Blueprint $table): void {
                $table->unique('position_code', 'uq_support_contact_positions_code');
            });
        }

        if (
            Schema::hasColumn('support_contact_positions', 'position_name')
            && ! $this->indexExists('support_contact_positions', 'uq_support_contact_positions_name')
        ) {
            Schema::table('support_contact_positions', function (Blueprint $table): void {
                $table->unique('position_name', 'uq_support_contact_positions_name');
            });
        }
    }

    private function seedDefaultSupportContactPositions(): void
    {
        if (! Schema::hasTable('support_contact_positions')) {
            return;
        }

        $defaults = [
            ['position_code' => 'GIAM_DOC', 'position_name' => 'Giám đốc'],
            ['position_code' => 'TRUONG_PHONG', 'position_name' => 'Trưởng phòng'],
            ['position_code' => 'DAU_MOI', 'position_name' => 'Đầu mối'],
        ];

        foreach ($defaults as $definition) {
            $code = strtoupper(trim((string) ($definition['position_code'] ?? '')));
            $name = trim((string) ($definition['position_name'] ?? ''));
            if ($code === '' || $name === '') {
                continue;
            }

            $existing = DB::table('support_contact_positions')
                ->select(['id', 'position_name', 'is_active'])
                ->whereRaw('UPPER(TRIM(position_code)) = ?', [$code])
                ->first();

            if ($existing === null) {
                $payload = [
                    'position_code' => $code,
                    'position_name' => $name,
                    'description' => null,
                    'is_active' => true,
                ];
                if (Schema::hasColumn('support_contact_positions', 'created_at')) {
                    $payload['created_at'] = now();
                }
                if (Schema::hasColumn('support_contact_positions', 'updated_at')) {
                    $payload['updated_at'] = now();
                }

                DB::table('support_contact_positions')->insert($payload);
                continue;
            }

            $updates = [];
            if (trim((string) ($existing->position_name ?? '')) === '') {
                $updates['position_name'] = $name;
            }
            if (Schema::hasColumn('support_contact_positions', 'is_active') && ! (bool) ($existing->is_active ?? false)) {
                $updates['is_active'] = true;
            }
            if ($updates !== [] && Schema::hasColumn('support_contact_positions', 'updated_at')) {
                $updates['updated_at'] = now();
            }

            if ($updates !== []) {
                DB::table('support_contact_positions')->where('id', (int) $existing->id)->update($updates);
            }
        }
    }

    private function ensureCustomerPersonnelPositionLink(): void
    {
        if (! Schema::hasTable('customer_personnel')) {
            return;
        }

        if (! Schema::hasColumn('customer_personnel', 'position_id')) {
            Schema::table('customer_personnel', function (Blueprint $table): void {
                $table->unsignedBigInteger('position_id')->nullable()->after('position_type');
            });
        }

        if (
            Schema::hasColumn('customer_personnel', 'position_id')
            && ! $this->indexExists('customer_personnel', 'idx_customer_personnel_position_id')
        ) {
            Schema::table('customer_personnel', function (Blueprint $table): void {
                $table->index('position_id', 'idx_customer_personnel_position_id');
            });
        }

        $positions = DB::table('support_contact_positions')
            ->select(['id', 'position_code', 'position_name'])
            ->get();

        if ($positions->isEmpty()) {
            return;
        }

        $positionIdsByCode = [];
        $positionByToken = [];

        foreach ($positions as $position) {
            $positionId = (int) ($position->id ?? 0);
            if ($positionId <= 0) {
                continue;
            }

            $positionCode = strtoupper(trim((string) ($position->position_code ?? '')));
            $positionName = trim((string) ($position->position_name ?? ''));

            if ($positionCode !== '') {
                $positionIdsByCode[$positionCode] = $positionId;
                $positionByToken[$this->normalizePositionToken($positionCode)] = [
                    'id' => $positionId,
                    'code' => $positionCode,
                ];
            }

            if ($positionName !== '') {
                $positionByToken[$this->normalizePositionToken($positionName)] = [
                    'id' => $positionId,
                    'code' => $positionCode,
                ];
            }
        }

        $defaultPositionId = $positionIdsByCode['DAU_MOI'] ?? null;

        $rows = DB::table('customer_personnel')
            ->select(['id', 'position_id', 'position_type'])
            ->orderBy('id')
            ->get();

        foreach ($rows as $row) {
            $id = (int) ($row->id ?? 0);
            if ($id <= 0) {
                continue;
            }

            $resolvedPosition = null;
            $currentPositionId = (int) ($row->position_id ?? 0);
            if ($currentPositionId > 0) {
                $matchedCode = array_search($currentPositionId, $positionIdsByCode, true);
                if ($matchedCode !== false) {
                    $resolvedPosition = ['id' => $currentPositionId, 'code' => (string) $matchedCode];
                }
            }

            if ($resolvedPosition === null) {
                $positionType = trim((string) ($row->position_type ?? ''));
                $token = $this->normalizePositionToken($positionType);
                if ($token !== '' && isset($positionByToken[$token])) {
                    $resolvedPosition = $positionByToken[$token];
                }
            }

            if ($resolvedPosition === null && $defaultPositionId !== null) {
                $resolvedPosition = ['id' => $defaultPositionId, 'code' => 'DAU_MOI'];
            }

            if ($resolvedPosition === null) {
                continue;
            }

            $updates = [
                'position_id' => (int) $resolvedPosition['id'],
            ];

            if (Schema::hasColumn('customer_personnel', 'position_type')) {
                $updates['position_type'] = (string) $resolvedPosition['code'];
            }
            if (Schema::hasColumn('customer_personnel', 'updated_at')) {
                $updates['updated_at'] = now();
            }

            DB::table('customer_personnel')->where('id', $id)->update($updates);
        }

        if (
            Schema::hasColumn('customer_personnel', 'position_id')
            && ! $this->foreignKeyExists('customer_personnel', 'fk_customer_personnel_position')
        ) {
            Schema::table('customer_personnel', function (Blueprint $table): void {
                $table
                    ->foreign('position_id', 'fk_customer_personnel_position')
                    ->references('id')
                    ->on('support_contact_positions')
                    ->nullOnDelete();
            });
        }
    }

    private function ensureSupportContactPositionPermissions(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasColumn('permissions', 'perm_key')) {
            return;
        }

        $definitions = [
            [
                'perm_key' => 'support_contact_positions.read',
                'perm_name' => 'Xem danh mục chức vụ liên hệ',
                'perm_group' => 'Hỗ trợ',
            ],
            [
                'perm_key' => 'support_contact_positions.write',
                'perm_name' => 'Thêm/Sửa danh mục chức vụ liên hệ',
                'perm_group' => 'Hỗ trợ',
            ],
        ];

        foreach ($definitions as $definition) {
            $permKey = trim((string) ($definition['perm_key'] ?? ''));
            if ($permKey === '') {
                continue;
            }

            $existing = DB::table('permissions')
                ->select(['id'])
                ->where('perm_key', $permKey)
                ->first();

            $payload = [
                'perm_key' => $permKey,
                'perm_name' => (string) ($definition['perm_name'] ?? $permKey),
                'perm_group' => (string) ($definition['perm_group'] ?? 'Hệ thống'),
            ];
            if (Schema::hasColumn('permissions', 'is_active')) {
                $payload['is_active'] = true;
            }

            if ($existing === null) {
                if (Schema::hasColumn('permissions', 'created_at')) {
                    $payload['created_at'] = now();
                }
                if (Schema::hasColumn('permissions', 'updated_at')) {
                    $payload['updated_at'] = now();
                }
                DB::table('permissions')->insert($payload);
                continue;
            }

            if (Schema::hasColumn('permissions', 'updated_at')) {
                $payload['updated_at'] = now();
            }

            DB::table('permissions')->where('id', (int) $existing->id)->update($payload);
        }
    }

    private function dropSupportContactPositionPermissions(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasColumn('permissions', 'perm_key')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('perm_key', [
                'support_contact_positions.read',
                'support_contact_positions.write',
            ])
            ->delete();
    }

    private function normalizePositionToken(string $value): string
    {
        $normalized = Str::ascii(trim($value));
        if ($normalized === '') {
            return '';
        }

        return strtolower((string) preg_replace('/[^a-z0-9]+/', '', $normalized));
    }

    private function indexExists(string $table, string $indexName): bool
    {
        if (! Schema::hasTable($table) || DB::getDriverName() !== 'mysql') {
            return false;
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->exists();
    }

    private function foreignKeyExists(string $table, string $foreignName): bool
    {
        if (! Schema::hasTable($table) || DB::getDriverName() !== 'mysql') {
            return false;
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.table_constraints')
            ->where('constraint_schema', $database)
            ->where('table_name', $table)
            ->where('constraint_name', $foreignName)
            ->where('constraint_type', 'FOREIGN KEY')
            ->exists();
    }
};
