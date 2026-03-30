<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Cookie;
use Tests\TestCase;

class AuthSessionFlowTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('auth.providers.users.model', InternalUser::class);
        config()->set('sanctum.expiration', 60);
        config()->set('vnpt_auth.access_cookie_name', 'vnpt_business_auth_token');
        config()->set('vnpt_auth.refresh_cookie_name', 'vnpt_business_refresh_token');

        $this->setUpSchema();
        $this->seedReferenceData();
    }

    public function test_login_with_email_issues_access_refresh_cookies_and_clears_legacy_tab_state(): void
    {
        $this->seedUser([
            'active_tab_token' => 'legacy-tab-token',
            'tab_token_set_at' => now()->subMinute(),
        ]);

        $response = $this->postJson('/api/v5/auth/login', [
            'username' => 'analyst@example.test',
            'password' => 'secret-password',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.user.username', 'analyst')
            ->assertJsonPath('data.user.roles.0', 'PM')
            ->assertJsonPath('data.user.permissions.0', 'dashboard.view')
            ->assertJsonPath('data.password_change_required', false);

        $accessCookie = $this->cookieFromResponse($response, 'vnpt_business_auth_token');
        $refreshCookie = $this->cookieFromResponse($response, 'vnpt_business_refresh_token');
        $tabCookie = $this->cookieFromResponse($response, 'vnpt_tab_token');

        $this->assertNotSame('', trim($accessCookie->getValue()));
        $this->assertNotSame('', trim($refreshCookie->getValue()));
        $this->assertSame('', $tabCookie->getValue());
        $this->assertNull(DB::table('internal_users')->where('id', 1)->value('active_tab_token'));

        $tokenNames = DB::table('personal_access_tokens')
            ->orderBy('name')
            ->pluck('name')
            ->all();

        $this->assertSame(['vnpt_business_access', 'vnpt_business_refresh'], $tokenNames);
        $this->assertDatabaseHas('auth_login_attempts', [
            'username' => 'analyst@example.test',
            'internal_user_id' => 1,
            'status' => 'SUCCESS',
            'reason' => null,
        ]);
    }

    public function test_me_and_bootstrap_use_access_cookie_and_bootstrap_allows_stale_legacy_tab_state(): void
    {
        $this->seedUser();

        $loginResponse = $this->postJson('/api/v5/auth/login', [
            'username' => 'analyst',
            'password' => 'secret-password',
        ])->assertOk();

        $accessCookie = $this->cookieFromResponse($loginResponse, 'vnpt_business_auth_token');
        $this->assertSame('', $this->cookieFromResponse($loginResponse, 'vnpt_tab_token')->getValue());
        $this->withToken($this->cookieValue($accessCookie))
            ->getJson('/api/v5/auth/me')
            ->assertOk()
            ->assertJsonPath('data.username', 'analyst')
            ->assertJsonPath('password_change_required', false);

        DB::table('internal_users')->where('id', 1)->update([
            'active_tab_token' => 'stale-legacy-token',
            'tab_token_set_at' => now(),
        ]);

        $bootstrapResponse = $this
            ->withToken($this->cookieValue($accessCookie))
            ->getJson('/api/v5/bootstrap');

        $bootstrapResponse
            ->assertOk()
            ->assertJsonPath('data.user.username', 'analyst')
            ->assertJsonPath('data.counters.internal_users', 1)
            ->assertJsonPath('data.counters.customers', 1)
            ->assertJsonPath('data.counters.projects', 1)
            ->assertJsonPath('data.counters.contracts', 1);

        $bootstrapPermissions = $bootstrapResponse->json('data.permissions');
        sort($bootstrapPermissions);
        $this->assertSame(['dashboard.view', 'projects.read'], $bootstrapPermissions);

        $bootstrapTabCookie = $this->cookieFromResponse($bootstrapResponse, 'vnpt_tab_token');

        $this->assertSame('', $bootstrapTabCookie->getValue());
        $this->assertNull(DB::table('internal_users')->where('id', 1)->value('active_tab_token'));
    }

    public function test_bootstrap_requires_password_change_while_me_still_returns_current_user(): void
    {
        $this->seedUser([
            'must_change_password' => 1,
        ]);

        $loginResponse = $this->postJson('/api/v5/auth/login', [
            'username' => 'analyst',
            'password' => 'secret-password',
        ]);

        $loginResponse
            ->assertOk()
            ->assertJsonPath('data.password_change_required', true);

        $accessCookie = $this->cookieFromResponse($loginResponse, 'vnpt_business_auth_token');
        $this->withToken($this->cookieValue($accessCookie))
            ->getJson('/api/v5/auth/me')
            ->assertOk()
            ->assertJsonPath('password_change_required', true);

        $this->withToken($this->cookieValue($accessCookie))
            ->getJson('/api/v5/bootstrap')
            ->assertStatus(428)
            ->assertJsonPath('code', 'PASSWORD_CHANGE_REQUIRED');
    }

    public function test_refresh_rotates_tokens_and_clears_legacy_tab_state(): void
    {
        $this->seedUser();

        $loginResponse = $this->postJson('/api/v5/auth/login', [
            'username' => 'analyst',
            'password' => 'secret-password',
        ])->assertOk();

        $oldRefreshCookie = $this->cookieFromResponse($loginResponse, 'vnpt_business_refresh_token');
        $this->assertSame('', $this->cookieFromResponse($loginResponse, 'vnpt_tab_token')->getValue());

        $this->assertNotNull(PersonalAccessToken::findToken($this->cookieValue($oldRefreshCookie)));
        DB::table('internal_users')->where('id', 1)->update([
            'active_tab_token' => 'stale-refresh-token',
            'tab_token_set_at' => now(),
        ]);

        $refreshResponse = $this->call(
            'POST',
            '/api/v5/auth/refresh',
            [],
            [
                $oldRefreshCookie->getName() => $this->cookieValue($oldRefreshCookie),
            ],
            [],
            [
                'HTTP_ACCEPT' => 'application/json',
                'CONTENT_TYPE' => 'application/json',
            ]
        );

        $refreshResponse
            ->assertOk()
            ->assertJsonPath('data.user.username', 'analyst')
            ->assertJsonPath('data.password_change_required', false);

        $newRefreshCookie = $this->cookieFromResponse($refreshResponse, 'vnpt_business_refresh_token');
        $newAccessCookie = $this->cookieFromResponse($refreshResponse, 'vnpt_business_auth_token');
        $newTabCookie = $this->cookieFromResponse($refreshResponse, 'vnpt_tab_token');

        $this->assertNotSame($this->cookieValue($oldRefreshCookie), $this->cookieValue($newRefreshCookie));
        $this->assertSame('', $newTabCookie->getValue());
        $this->assertNotNull(PersonalAccessToken::findToken($this->cookieValue($newRefreshCookie)));
        $this->assertNotNull(PersonalAccessToken::findToken($this->cookieValue($newAccessCookie)));
        $this->assertNull(PersonalAccessToken::findToken($this->cookieValue($oldRefreshCookie)));
        $this->assertSame(2, DB::table('personal_access_tokens')->count());
        $this->assertNull(DB::table('internal_users')->where('id', 1)->value('active_tab_token'));
    }

    public function test_logout_revokes_tokens_clears_legacy_tab_state_and_forgets_cookies(): void
    {
        $this->seedUser();

        $loginResponse = $this->postJson('/api/v5/auth/login', [
            'username' => 'analyst',
            'password' => 'secret-password',
        ])->assertOk();

        $accessCookie = $this->cookieFromResponse($loginResponse, 'vnpt_business_auth_token');
        DB::table('internal_users')->where('id', 1)->update([
            'active_tab_token' => 'stale-logout-token',
            'tab_token_set_at' => now(),
        ]);
        $response = $this
            ->withToken($this->cookieValue($accessCookie))
            ->postJson('/api/v5/auth/logout');

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Đăng xuất thành công.');

        $forgottenAccessCookie = $this->cookieFromResponse($response, 'vnpt_business_auth_token');
        $forgottenRefreshCookie = $this->cookieFromResponse($response, 'vnpt_business_refresh_token');
        $forgottenTabCookie = $this->cookieFromResponse($response, 'vnpt_tab_token');

        $this->assertSame('', $forgottenAccessCookie->getValue());
        $this->assertSame('', $forgottenRefreshCookie->getValue());
        $this->assertSame('', $forgottenTabCookie->getValue());
        $this->assertSame(0, DB::table('personal_access_tokens')->count());
        $this->assertNull(DB::table('internal_users')->where('id', 1)->value('active_tab_token'));
    }

    public function test_login_rejects_inactive_accounts_and_records_failed_attempt(): void
    {
        $this->seedUser([
            'status' => 'SUSPENDED',
        ]);

        $this->postJson('/api/v5/auth/login', [
            'username' => 'analyst',
            'password' => 'secret-password',
        ])
            ->assertStatus(403)
            ->assertJsonPath('message', 'Tài khoản đã bị khóa hoặc tạm ngưng.');

        $this->assertSame(0, DB::table('personal_access_tokens')->count());
        $this->assertDatabaseHas('auth_login_attempts', [
            'username' => 'analyst',
            'internal_user_id' => 1,
            'status' => 'FAILED',
            'reason' => 'ACCOUNT_INACTIVE',
        ]);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('auth_login_attempts');
        Schema::dropIfExists('role_permission');
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('user_dept_scopes');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('internal_users');

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->unique();
            $table->string('full_name', 255)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('status', 32)->default('ACTIVE');
            $table->unsignedBigInteger('department_id')->nullable();
            $table->unsignedBigInteger('position_id')->nullable();
            $table->string('password');
            $table->string('active_tab_token', 64)->nullable();
            $table->timestamp('tab_token_set_at')->nullable();
            $table->tinyInteger('must_change_password')->default(0);
            $table->timestamp('password_changed_at')->nullable();
            $table->timestamp('password_reset_required_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_code', 50)->nullable();
            $table->string('customer_name', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_code', 50)->nullable();
            $table->string('project_name', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('contract_code', 50)->nullable();
            $table->string('contract_name', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('role_code', 50);
            $table->string('role_name', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('perm_key', 100);
            $table->string('perm_name', 255)->nullable();
            $table->string('perm_group', 100)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('user_roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('role_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('role_permission', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('role_id');
            $table->unsignedBigInteger('permission_id');
            $table->timestamps();
        });

        Schema::create('user_permissions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('permission_id');
            $table->string('type', 10)->default('GRANT');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('user_dept_scopes', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('dept_id');
            $table->string('scope_type', 32)->default('DEPT_ONLY');
            $table->timestamps();
        });

        Schema::create('auth_login_attempts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('username', 100);
            $table->unsignedBigInteger('internal_user_id')->nullable();
            $table->string('status', 16);
            $table->string('reason', 255)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('personal_access_tokens', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('tokenable_type');
            $table->unsignedBigInteger('tokenable_id');
            $table->text('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
    }

    private function seedReferenceData(): void
    {
        DB::table('departments')->insert([
            'id' => 10,
            'dept_code' => 'P10',
            'dept_name' => 'Phòng nền tảng',
            'parent_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('customers')->insert([
            'id' => 100,
            'customer_code' => 'CUS001',
            'customer_name' => 'Khách hàng A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 200,
            'project_code' => 'PRJ001',
            'project_name' => 'Dự án A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('contracts')->insert([
            'id' => 300,
            'contract_code' => 'CTR001',
            'contract_name' => 'Hợp đồng A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('roles')->insert([
            'id' => 1,
            'role_code' => 'PM',
            'role_name' => 'Project Manager',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('permissions')->insert([
            [
                'id' => 1,
                'perm_key' => 'dashboard.view',
                'perm_name' => 'Dashboard view',
                'perm_group' => 'dashboard',
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'perm_key' => 'projects.read',
                'perm_name' => 'Projects read',
                'perm_group' => 'projects',
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('role_permission')->insert([
            [
                'role_id' => 1,
                'permission_id' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'role_id' => 1,
                'permission_id' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function seedUser(array $overrides = []): void
    {
        DB::table('internal_users')->insert(array_merge([
            'id' => 1,
            'uuid' => '2f863fa8-9cae-4f85-8705-4f4950fc41a8',
            'user_code' => 'U001',
            'username' => 'analyst',
            'full_name' => 'Nguyễn Phân Tích',
            'email' => 'analyst@example.test',
            'status' => 'ACTIVE',
            'department_id' => 10,
            'position_id' => 5,
            'password' => Hash::make('secret-password'),
            'active_tab_token' => null,
            'tab_token_set_at' => null,
            'must_change_password' => 0,
            'password_changed_at' => now()->subDay(),
            'password_reset_required_at' => null,
            'remember_token' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));

        DB::table('user_roles')->insert([
            'user_id' => 1,
            'role_id' => 1,
            'is_active' => 1,
            'expires_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('user_dept_scopes')->insert([
            'user_id' => 1,
            'dept_id' => 10,
            'scope_type' => 'DEPT_ONLY',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function cookieFromResponse(TestResponse $response, string $name): Cookie
    {
        $cookie = collect($response->headers->getCookies())
            ->first(fn (Cookie $cookie): bool => $cookie->getName() === $name);

        $this->assertInstanceOf(Cookie::class, $cookie, sprintf('Cookie [%s] was not set on the response.', $name));

        return $cookie;
    }

    private function cookieValue(Cookie $cookie): string
    {
        return urldecode((string) $cookie->getValue());
    }
}
