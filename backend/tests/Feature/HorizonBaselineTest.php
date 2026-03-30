<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HorizonBaselineTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
        $this->seedPermissions();
    }

    public function test_horizon_configuration_matches_the_baseline_operating_policy(): void
    {
        $production = config('horizon.environments.production.supervisor-1');
        $local = config('horizon.environments.local.supervisor-1');
        $waits = config('horizon.waits');
        $trim = config('horizon.trim');

        $this->assertSame(10, $production['maxProcesses']);
        $this->assertSame(3, $production['tries']);
        $this->assertSame(300, $production['timeout']);
        $this->assertSame(1000, $production['maxJobs']);
        $this->assertSame(3600, $production['maxTime']);

        $this->assertSame(3, $local['maxProcesses']);
        $this->assertSame(3, $local['tries']);
        $this->assertSame(120, $local['timeout']);

        $this->assertSame(60, $waits['redis:default']);
        $this->assertSame(60, $trim['recent']);
        $this->assertSame(10080, $trim['failed']);
        $this->assertSame('test_horizon:', config('horizon.prefix'));
    }

    public function test_view_horizon_gate_requires_system_health_permission(): void
    {
        $allowedUser = (new InternalUser())->forceFill(['id' => 10]);
        $blockedUser = (new InternalUser())->forceFill(['id' => 11]);

        $this->assertTrue(Gate::forUser($allowedUser)->allows('viewHorizon'));
        $this->assertFalse(Gate::forUser($blockedUser)->allows('viewHorizon'));
    }

    private function setUpSchema(): void
    {
        Schema::create('roles', function (Blueprint $table): void {
            $table->id();
            $table->string('role_code');
        });

        Schema::create('permissions', function (Blueprint $table): void {
            $table->id();
            $table->string('perm_key');
            $table->boolean('is_active')->default(true);
        });

        Schema::create('role_permission', function (Blueprint $table): void {
            $table->unsignedBigInteger('role_id');
            $table->unsignedBigInteger('permission_id');
        });

        Schema::create('user_roles', function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('role_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
        });
    }

    private function seedPermissions(): void
    {
        DB::table('roles')->insert([
            ['id' => 1, 'role_code' => 'OPS'],
        ]);

        DB::table('permissions')->insert([
            ['id' => 1, 'perm_key' => 'system.health.view', 'is_active' => 1],
        ]);

        DB::table('role_permission')->insert([
            'role_id' => 1,
            'permission_id' => 1,
        ]);

        DB::table('user_roles')->insert([
            'user_id' => 10,
            'role_id' => 1,
            'is_active' => 1,
            'expires_at' => null,
        ]);
    }
}
