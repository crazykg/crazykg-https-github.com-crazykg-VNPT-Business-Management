<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SupportAuthSessionPolicyApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    public function test_it_returns_default_same_browser_multi_tab_policy_when_row_does_not_exist(): void
    {
        $response = $this->getJson('/api/v5/support-auth-session-policy');

        $response
            ->assertOk()
            ->assertJsonPath('data.provider', 'AUTH_SESSION_POLICY')
            ->assertJsonPath('data.same_browser_multi_tab_enabled', true)
            ->assertJsonPath('data.source', 'DEFAULT');
    }

    public function test_it_updates_same_browser_multi_tab_policy_using_provider_row(): void
    {
        $response = $this->putJson('/api/v5/support-auth-session-policy', [
            'same_browser_multi_tab_enabled' => false,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.provider', 'AUTH_SESSION_POLICY')
            ->assertJsonPath('data.same_browser_multi_tab_enabled', false)
            ->assertJsonPath('data.source', 'DB')
            ->assertJsonPath('data.updated_by', 1);

        $row = DB::table('integration_settings')
            ->where('provider', 'AUTH_SESSION_POLICY')
            ->first();

        $this->assertNotNull($row);
        $this->assertSame(0, (int) $row->is_enabled);
        $this->assertSame(1, (int) $row->updated_by);

        $this->getJson('/api/v5/support-auth-session-policy')
            ->assertOk()
            ->assertJsonPath('data.same_browser_multi_tab_enabled', false)
            ->assertJsonPath('data.source', 'DB');
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('integration_settings');
        Schema::dropIfExists('internal_users');

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('username')->nullable();
            $table->string('full_name')->nullable();
            $table->string('password')->nullable();
            $table->timestamps();
        });

        Schema::create('integration_settings', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('provider')->unique();
            $table->boolean('is_enabled')->default(false);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        DB::table('internal_users')->insert([
            'id' => 1,
            'username' => 'admin',
            'full_name' => 'System Admin',
            'password' => 'secret',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
