<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Integration tests for:
 *   GET  /api/v5/utilities/contract-renewal-settings
 *   PUT  /api/v5/utilities/contract-renewal-settings
 *   POST /api/v5/utilities/contract-renewal-settings/recalculate
 *
 * Step 10 coverage from plan-code/Nang_cap_tab_Hop_dong_thanh_Hub_v1.md §Phase-2.
 */
class ContractRenewalSettingsApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  GET /api/v5/utilities/contract-renewal-settings
    // ─────────────────────────────────────────────────────────────────────────

    /** @test */
    public function it_returns_default_renewal_settings_when_no_db_row_exists(): void
    {
        $response = $this->getJson('/api/v5/utilities/contract-renewal-settings');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertIsArray($data);
        $this->assertSame('CONTRACT_RENEWAL_SETTINGS', $data['provider']);
        $this->assertSame(0, $data['grace_period_days']);
        $this->assertEquals(0, $data['penalty_rate_per_day']); // backend may return int 0 or float 0.0
        $this->assertSame('DEFAULT', $data['source']);
    }

    /** @test */
    public function it_returns_db_values_after_insert(): void
    {
        DB::table('integration_settings')->insert([
            'provider' => 'CONTRACT_RENEWAL_SETTINGS',
            'is_enabled' => true,
            'contract_renewal_grace_days' => 7,
            'contract_renewal_penalty_rate' => 0.0033,
            'contract_renewal_max_penalty_rate' => 25.0,
            'contract_renewal_max_chain_depth' => 5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v5/utilities/contract-renewal-settings');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertSame(7, $data['grace_period_days']);
        $this->assertSame('DB', $data['source']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PUT /api/v5/utilities/contract-renewal-settings
    // ─────────────────────────────────────────────────────────────────────────

    /** @test */
    public function it_creates_renewal_settings_row_on_first_put(): void
    {
        $response = $this->putJson('/api/v5/utilities/contract-renewal-settings', [
            'grace_period_days' => 5,
            'penalty_rate_per_day' => 0.005,
            'max_penalty_rate' => 30.0,
            'max_chain_depth' => 8,
        ]);

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertSame(5, $data['grace_period_days']);
        $this->assertSame('DB', $data['source']);

        $row = DB::table('integration_settings')
            ->where('provider', 'CONTRACT_RENEWAL_SETTINGS')
            ->first();
        $this->assertNotNull($row);
        $this->assertSame(5, (int) $row->contract_renewal_grace_days);
    }

    /** @test */
    public function it_updates_existing_renewal_settings_row(): void
    {
        // First create
        $this->putJson('/api/v5/utilities/contract-renewal-settings', [
            'grace_period_days' => 3,
            'penalty_rate_per_day' => 0.002,
            'max_penalty_rate' => 20.0,
            'max_chain_depth' => 5,
        ])->assertStatus(200);

        // Then update
        $response = $this->putJson('/api/v5/utilities/contract-renewal-settings', [
            'grace_period_days' => 10,
            'penalty_rate_per_day' => 0.01,
            'max_penalty_rate' => 50.0,
            'max_chain_depth' => 12,
        ]);

        $response->assertStatus(200);
        $this->assertSame(10, $response->json('data.grace_period_days'));

        $count = DB::table('integration_settings')
            ->where('provider', 'CONTRACT_RENEWAL_SETTINGS')
            ->count();
        $this->assertSame(1, $count); // upsert — only one row
    }

    /** @test */
    public function it_rejects_invalid_renewal_settings_values(): void
    {
        // grace_period_days out of range
        $this->putJson('/api/v5/utilities/contract-renewal-settings', [
            'grace_period_days' => -1,
            'penalty_rate_per_day' => 0.005,
            'max_penalty_rate' => 50.0,
            'max_chain_depth' => 5,
        ])->assertStatus(422);

        // penalty_rate_per_day > 100
        $this->putJson('/api/v5/utilities/contract-renewal-settings', [
            'grace_period_days' => 0,
            'penalty_rate_per_day' => 101.0,
            'max_penalty_rate' => 50.0,
            'max_chain_depth' => 5,
        ])->assertStatus(422);

        // max_chain_depth = 0
        $this->putJson('/api/v5/utilities/contract-renewal-settings', [
            'grace_period_days' => 0,
            'penalty_rate_per_day' => 0.005,
            'max_penalty_rate' => 50.0,
            'max_chain_depth' => 0,
        ])->assertStatus(422);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  POST /api/v5/utilities/contract-renewal-settings/recalculate
    // ─────────────────────────────────────────────────────────────────────────

    /** @test */
    public function it_recalculates_renewal_meta_for_zero_children(): void
    {
        $response = $this->postJson('/api/v5/utilities/contract-renewal-settings/recalculate');

        $response->assertStatus(200);
        $this->assertSame(0, $response->json('updated_count'));
        $this->assertSame(0, $response->json('scanned_count'));
    }

    /** @test */
    public function it_recalculates_gap_days_and_continuity_status_for_child_contracts(): void
    {
        // Parent contract: expires 2026-12-31
        DB::table('contracts')->insert([
            'id' => 50, 'contract_code' => 'HD-050', 'contract_name' => 'Parent',
            'customer_id' => 1, 'project_id' => 1, 'value' => 100000000,
            'status' => 'RENEWED', 'expiry_date' => '2026-12-31',
            'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null,
        ]);

        // Child with gap_days not yet computed (null)
        DB::table('contracts')->insert([
            'id' => 51, 'contract_code' => 'HD-051', 'contract_name' => 'Child',
            'customer_id' => 1, 'project_id' => 1, 'value' => 110000000,
            'status' => 'SIGNED', 'sign_date' => '2027-01-15',
            'effective_date' => '2027-01-15',
            'parent_contract_id' => 50,
            'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null,
        ]);

        $response = $this->postJson('/api/v5/utilities/contract-renewal-settings/recalculate');

        $response->assertStatus(200);
        $this->assertSame(1, $response->json('scanned_count'));

        // Child should now have continuity_status computed
        $child = DB::table('contracts')->where('id', 51)->first();
        $this->assertNotNull($child->continuity_status);
        $this->assertContains($child->continuity_status, ['CONTINUOUS', 'GAP', 'EARLY']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Schema setup
    // ─────────────────────────────────────────────────────────────────────────

    private function setUpSchema(): void
    {
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('integration_settings');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('password')->nullable();
            $table->rememberToken();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_code', 50)->nullable();
            $table->string('customer_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_code', 50)->nullable();
            $table->string('project_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('contract_code', 100)->nullable();
            $table->string('contract_name')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->decimal('value', 18, 2)->default(0);
            $table->string('status', 20)->default('DRAFT');
            $table->date('sign_date')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('payment_cycle', 20)->nullable();
            $table->string('term_unit', 10)->nullable();
            $table->unsignedInteger('term_value')->nullable();
            $table->boolean('expiry_date_manual_override')->nullable()->default(false);
            // renewal columns
            $table->unsignedBigInteger('parent_contract_id')->nullable();
            $table->string('continuity_status', 32)->nullable()->default('STANDALONE');
            $table->decimal('penalty_rate', 5, 4)->nullable();
            $table->integer('gap_days')->nullable();
            $table->string('data_scope')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('integration_settings', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('provider', 100)->unique();
            $table->boolean('is_enabled')->default(true);
            $table->string('setting_value', 255)->nullable();
            // contract expiry / payment alert columns
            $table->integer('contract_expiry_warning_days')->nullable();
            $table->integer('contract_payment_warning_days')->nullable();
            // renewal settings columns
            $table->integer('contract_renewal_grace_days')->nullable();
            $table->decimal('contract_renewal_penalty_rate', 10, 6)->nullable();
            $table->decimal('contract_renewal_max_penalty_rate', 10, 4)->nullable();
            $table->integer('contract_renewal_max_chain_depth')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        // Seed
        DB::table('departments')->insert([
            'id' => 10, 'dept_code' => 'P10', 'dept_name' => 'Phong giai phap',
            'parent_id' => null, 'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 1, 'user_code' => 'U001', 'username' => 'tester', 'full_name' => 'Tester',
            'department_id' => 10, 'password' => bcrypt('secret'), 'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('customers')->insert([
            'id' => 1, 'customer_code' => 'KH001', 'customer_name' => 'Khach hang A',
            'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null,
        ]);

        DB::table('projects')->insert([
            'id' => 1, 'project_code' => 'DA001', 'project_name' => 'Du an A',
            'customer_id' => 1, 'dept_id' => 10,
            'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null,
        ]);
    }
}
