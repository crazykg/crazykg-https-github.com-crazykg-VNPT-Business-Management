<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seed permissions for the Revenue Management module.
 *
 * Permissions added:
 *   revenue.read    — view overview dashboard, targets, analytics
 *   revenue.targets — create/update/delete revenue targets
 *
 * Both permissions are also auto-assigned to the ADMIN role so
 * existing admin accounts immediately see the new menu.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        [
            'perm_key'   => 'revenue.read',
            'perm_name'  => 'Xem doanh thu',
            'perm_group' => 'Doanh thu',
        ],
        [
            'perm_key'   => 'revenue.targets',
            'perm_name'  => 'Quản lý kế hoạch doanh thu',
            'perm_group' => 'Doanh thu',
        ],
    ];

    public function up(): void
    {
        $this->ensurePermissions();
        $this->grantPermissionsToAdminRole();
    }

    public function down(): void
    {
        $this->revokePermissionsFromAllRoles();
        $this->dropPermissions();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

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
                'perm_key'   => $permKey,
                'perm_name'  => (string) ($definition['perm_name'] ?? $permKey),
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

    /**
     * Auto-grant both revenue permissions to the ADMIN role so existing
     * admin users can see the menu without manual permission assignment.
     */
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

        $permKeys = array_column(self::PERMISSIONS, 'perm_key');

        $permIds = DB::table('permissions')
            ->whereIn('perm_key', $permKeys)
            ->pluck('id');

        foreach ($permIds as $permId) {
            $exists = DB::table('role_permission')
                ->where('role_id', $adminRole->id)
                ->where('permission_id', $permId)
                ->exists();

            if (! $exists) {
                DB::table('role_permission')->insert([
                    'role_id'       => $adminRole->id,
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

        $permKeys = array_column(self::PERMISSIONS, 'perm_key');

        $permIds = DB::table('permissions')
            ->whereIn('perm_key', $permKeys)
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

        $permKeys = array_column(self::PERMISSIONS, 'perm_key');

        DB::table('permissions')
            ->whereIn('perm_key', $permKeys)
            ->delete();
    }
};
