<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        [
            'perm_key' => 'employee_party.read',
            'perm_name' => 'Xem hồ sơ đảng viên',
            'perm_group' => 'Nhân sự',
        ],
        [
            'perm_key' => 'employee_party.write',
            'perm_name' => 'Quản lý hồ sơ đảng viên',
            'perm_group' => 'Nhân sự',
        ],
        [
            'perm_key' => 'employee_party.import',
            'perm_name' => 'Nhập hồ sơ đảng viên',
            'perm_group' => 'Nhân sự',
        ],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('employee_party_profiles')) {
            Schema::create('employee_party_profiles', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('employee_id');
                $table->string('ethnicity', 120)->nullable();
                $table->string('religion', 120)->nullable();
                $table->string('hometown', 255)->nullable();
                $table->string('professional_qualification', 255)->nullable();
                $table->string('political_theory_level', 255)->nullable();
                $table->string('party_card_number', 120)->nullable();
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();

                $table->unique('employee_id');
                $table->unique('party_card_number');
                $table->foreign('employee_id')->references('id')->on('internal_users')->cascadeOnDelete();
            });
        }

        $this->ensurePermissions();
        $this->grantPermissionsToAdminRole();
    }

    public function down(): void
    {
        $this->revokePermissionsFromAllRoles();
        $this->dropPermissions();
        Schema::dropIfExists('employee_party_profiles');
    }

    private function ensurePermissions(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasColumn('permissions', 'perm_key')) {
            return;
        }

        foreach (self::PERMISSIONS as $definition) {
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
            } else {
                if (Schema::hasColumn('permissions', 'updated_at')) {
                    $payload['updated_at'] = now();
                }
                DB::table('permissions')
                    ->where('perm_key', $permKey)
                    ->update($payload);
            }
        }
    }

    private function grantPermissionsToAdminRole(): void
    {
        if (
            ! Schema::hasTable('permissions')
            || ! Schema::hasTable('roles')
            || ! Schema::hasTable('role_permission')
        ) {
            return;
        }

        $adminRole = DB::table('roles')
            ->select(['id'])
            ->where('role_code', 'ADMIN')
            ->first();

        if ($adminRole === null) {
            return;
        }

        $permIds = DB::table('permissions')
            ->whereIn('perm_key', array_column(self::PERMISSIONS, 'perm_key'))
            ->pluck('id');

        foreach ($permIds as $permId) {
            $exists = DB::table('role_permission')
                ->where('role_id', $adminRole->id)
                ->where('permission_id', $permId)
                ->exists();

            if (! $exists) {
                DB::table('role_permission')->insert([
                    'role_id' => $adminRole->id,
                    'permission_id' => $permId,
                ]);
            }
        }
    }

    private function revokePermissionsFromAllRoles(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasTable('role_permission')) {
            return;
        }

        $permIds = DB::table('permissions')
            ->whereIn('perm_key', array_column(self::PERMISSIONS, 'perm_key'))
            ->pluck('id');

        if ($permIds->isEmpty()) {
            return;
        }

        DB::table('role_permission')
            ->whereIn('permission_id', $permIds)
            ->delete();
    }

    private function dropPermissions(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasColumn('permissions', 'perm_key')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('perm_key', array_column(self::PERMISSIONS, 'perm_key'))
            ->delete();
    }
};
