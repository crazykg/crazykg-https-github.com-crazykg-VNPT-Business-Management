<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserAccessCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_lists_roles_permissions_and_user_access_rows_via_api(): void
    {
        $rolesResponse = $this->getJson('/api/v5/roles');
        $rolesResponse
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.role_code', 'ADMIN');

        $permissionsResponse = $this->getJson('/api/v5/permissions');
        $permissionsResponse
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.perm_key', 'employees.read');

        $accessResponse = $this->getJson('/api/v5/user-access?search=admin');
        $accessResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.user.username', 'admin')
            ->assertJsonPath('data.0.roles.0.role_code', 'ADMIN')
            ->assertJsonPath('data.0.permissions.0.perm_key', 'employees.read')
            ->assertJsonPath('data.0.dept_scopes.0.scope_type', 'DEPT_ONLY');
    }

    public function test_it_updates_roles_permissions_and_department_scopes_via_api(): void
    {
        $rolesResponse = $this->putJson('/api/v5/user-access/1/roles', [
            'role_ids' => [2],
        ]);

        $rolesResponse
            ->assertOk()
            ->assertJsonPath('data.roles.0.role_code', 'PM');

        $permissionsResponse = $this->putJson('/api/v5/user-access/1/permissions', [
            'overrides' => [
                [
                    'permission_id' => 2,
                    'type' => 'DENY',
                    'reason' => 'Manual deny',
                ],
            ],
        ]);

        $permissionsResponse
            ->assertOk()
            ->assertJsonPath('data.permissions.0.perm_key', 'employees.write')
            ->assertJsonPath('data.permissions.0.type', 'DENY')
            ->assertJsonPath('data.permissions.0.reason', 'Manual deny');

        $scopesResponse = $this->putJson('/api/v5/user-access/1/dept-scopes', [
            'scopes' => [
                [
                    'dept_id' => 2,
                    'scope_type' => 'DEPT_AND_CHILDREN',
                ],
            ],
        ]);

        $scopesResponse
            ->assertOk()
            ->assertJsonPath('data.dept_scopes.0.dept_id', 2)
            ->assertJsonPath('data.dept_scopes.0.scope_type', 'DEPT_AND_CHILDREN');
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('user_dept_scopes');
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('departments');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 100)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('username', 100)->nullable();
            $table->string('user_code', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('status', 20)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('role_code', 100)->nullable();
            $table->string('role_name', 255)->nullable();
            $table->string('description', 255)->nullable();
            $table->boolean('is_system')->default(false);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('permissions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('perm_key', 150)->nullable();
            $table->string('perm_name', 255)->nullable();
            $table->string('perm_group', 150)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('user_roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('role_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('expires_at')->nullable();
        });

        Schema::create('user_permissions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('permission_id');
            $table->string('type', 20)->nullable();
            $table->string('reason', 500)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('user_dept_scopes', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('dept_id');
            $table->string('scope_type', 50);
            $table->timestamp('created_at')->nullable();
        });

        DB::table('departments')->insert([
            ['id' => 1, 'dept_code' => 'BGDVT', 'dept_name' => 'Ban giam doc', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'dept_code' => 'PKD', 'dept_name' => 'Phong kinh doanh', 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('internal_users')->insert([
            'id' => 1,
            'username' => 'admin',
            'user_code' => 'VNPT000001',
            'full_name' => 'Admin User',
            'email' => 'admin@example.com',
            'status' => 'ACTIVE',
            'department_id' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('roles')->insert([
            ['id' => 1, 'role_code' => 'ADMIN', 'role_name' => 'Admin', 'is_system' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'role_code' => 'PM', 'role_name' => 'Project Manager', 'is_system' => 0, 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('permissions')->insert([
            ['id' => 1, 'perm_key' => 'employees.read', 'perm_name' => 'Read employees', 'perm_group' => 'employees', 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'perm_key' => 'employees.write', 'perm_name' => 'Write employees', 'perm_group' => 'employees', 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('user_roles')->insert([
            'user_id' => 1,
            'role_id' => 1,
            'is_active' => 1,
            'created_at' => now(),
        ]);

        DB::table('user_permissions')->insert([
            'user_id' => 1,
            'permission_id' => 1,
            'type' => 'GRANT',
            'reason' => 'Initial grant',
            'created_at' => now(),
        ]);

        DB::table('user_dept_scopes')->insert([
            'user_id' => 1,
            'dept_id' => 1,
            'scope_type' => 'DEPT_ONLY',
            'created_at' => now(),
        ]);
    }
}
