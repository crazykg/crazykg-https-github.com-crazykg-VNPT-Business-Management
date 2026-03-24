<?php

namespace Tests\Feature;

use App\Http\Middleware\EnforcePasswordChange;
use App\Http\Middleware\EnsureActiveTab;
use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SupportServiceGroupPermissionAccessTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            EnforcePasswordChange::class,
            EnsureActiveTab::class,
        ]);

        $this->setUpSchema();
    }

    public function test_support_requests_read_permission_can_list_support_service_groups(): void
    {
        DB::table('permissions')->insert([
            'id' => 10,
            'perm_key' => 'support_requests.read',
            'perm_name' => 'Doc yeu cau ho tro',
            'is_active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('user_permissions')->insert([
            'user_id' => 1,
            'permission_id' => 10,
            'type' => 'GRANT',
            'created_at' => now(),
        ]);

        DB::table('support_service_groups')->insert([
            'id' => 5,
            'group_code' => 'HT_DMS',
            'group_name' => 'Hỗ trợ DMS',
            'description' => 'Nhóm hỗ trợ cho yêu cầu KH',
            'is_active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Sanctum::actingAs(InternalUser::query()->findOrFail(1), ['api.access']);

        $this->getJson('/api/v5/support-service-groups?include_inactive=1')
            ->assertOk()
            ->assertJsonPath('data.0.id', 5)
            ->assertJsonPath('data.0.group_name', 'Hỗ trợ DMS');
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('support_service_groups');
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('internal_users');

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('username', 100)->nullable();
            $table->string('user_code', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->string('status', 20)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('permissions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('perm_key', 150)->nullable();
            $table->string('perm_name', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('user_permissions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('permission_id');
            $table->string('type', 20)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('group_code')->nullable();
            $table->string('group_name')->nullable();
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        DB::table('internal_users')->insert([
            'id' => 1,
            'username' => 'support.reader',
            'user_code' => 'SUP001',
            'full_name' => 'Support Reader',
            'status' => 'ACTIVE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
