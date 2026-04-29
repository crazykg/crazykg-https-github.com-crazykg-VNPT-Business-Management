<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        ['perm_key' => 'workload.read', 'perm_name' => 'Xem tong hop gio cong', 'perm_group' => 'Gio cong'],
        ['perm_key' => 'workload.manage', 'perm_name' => 'Quan ly tong hop gio cong', 'perm_group' => 'Gio cong'],
        ['perm_key' => 'workload.export', 'perm_name' => 'Xuat tong hop gio cong', 'perm_group' => 'Gio cong'],
        ['perm_key' => 'workload.close', 'perm_name' => 'Chot cong ca nhan', 'perm_group' => 'Gio cong'],
        ['perm_key' => 'workload.approve', 'perm_name' => 'Duyet chot cong', 'perm_group' => 'Gio cong'],
        ['perm_key' => 'workload.reopen', 'perm_name' => 'Mo lai ky chot cong', 'perm_group' => 'Gio cong'],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('workload_monthly_snapshots')) {
            Schema::create('workload_monthly_snapshots', function (Blueprint $table): void {
                $table->id();
                $table->char('snapshot_month', 7);
                $table->unsignedBigInteger('user_id')->nullable();
                $table->unsignedBigInteger('department_id')->nullable();
                $table->unsignedBigInteger('project_id')->nullable();
                $table->string('source_type', 20)->default('ALL');
                $table->decimal('total_hours', 10, 2)->default(0);
                $table->decimal('capacity_hours', 10, 2)->default(0);
                $table->decimal('planned_hours', 10, 2)->default(0);
                $table->decimal('utilization_percent', 6, 2)->default(0);
                $table->unsignedInteger('overload_day_count')->default(0);
                $table->unsignedInteger('missing_day_count')->default(0);
                $table->json('payload')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index(['snapshot_month', 'user_id'], 'idx_workload_snap_user');
                $table->index(['snapshot_month', 'department_id'], 'idx_workload_snap_dept');
                $table->index(['snapshot_month', 'project_id'], 'idx_workload_snap_project');
                $table->unique(['snapshot_month', 'user_id', 'department_id', 'project_id', 'source_type'], 'uq_workload_snap_scope');
            });
        }

        if (! Schema::hasTable('workload_month_closes')) {
            Schema::create('workload_month_closes', function (Blueprint $table): void {
                $table->id();
                $table->char('close_month', 7);
                $table->enum('scope_type', ['USER', 'DEPARTMENT', 'PROJECT', 'ALL'])->default('USER');
                $table->unsignedBigInteger('scope_id')->nullable();
                $table->enum('status', ['OPEN', 'SUBMITTED', 'APPROVED', 'REOPENED'])->default('OPEN');
                $table->unsignedBigInteger('submitted_by')->nullable();
                $table->timestamp('submitted_at')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->unsignedBigInteger('reopened_by')->nullable();
                $table->timestamp('reopened_at')->nullable();
                $table->string('note', 1000)->nullable();
                $table->timestamps();

                $table->unique(['close_month', 'scope_type', 'scope_id'], 'uq_workload_month_close_scope');
                $table->index(['close_month', 'status'], 'idx_workload_month_close_status');
            });
        }

        $this->ensurePermissions();
        $this->grantPermissionsToAdminRole();
    }

    public function down(): void
    {
        $this->revokePermissionsFromAllRoles();
        $this->dropPermissions();

        Schema::dropIfExists('workload_month_closes');
        Schema::dropIfExists('workload_monthly_snapshots');
    }

    private function ensurePermissions(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasColumn('permissions', 'perm_key')) {
            return;
        }

        foreach (self::PERMISSIONS as $definition) {
            $existing = DB::table('permissions')
                ->select(['id'])
                ->where('perm_key', $definition['perm_key'])
                ->first();

            $payload = [
                'perm_key' => $definition['perm_key'],
                'perm_name' => $definition['perm_name'],
                'perm_group' => $definition['perm_group'],
            ];

            if (Schema::hasColumn('permissions', 'is_active')) {
                $payload['is_active'] = true;
            }
            if (Schema::hasColumn('permissions', 'updated_at')) {
                $payload['updated_at'] = now();
            }

            if ($existing === null) {
                if (Schema::hasColumn('permissions', 'created_at')) {
                    $payload['created_at'] = now();
                }
                DB::table('permissions')->insert($payload);
            } else {
                DB::table('permissions')->where('id', $existing->id)->update($payload);
            }
        }
    }

    private function grantPermissionsToAdminRole(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasTable('roles') || ! Schema::hasTable('role_permission')) {
            return;
        }

        $adminRole = DB::table('roles')->select(['id'])->where('role_code', 'ADMIN')->first();
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

        if ($permIds->isNotEmpty()) {
            DB::table('role_permission')->whereIn('permission_id', $permIds)->delete();
        }
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
