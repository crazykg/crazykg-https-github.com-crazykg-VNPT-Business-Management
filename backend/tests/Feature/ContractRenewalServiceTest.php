<?php

namespace Tests\Feature;

use App\Models\Contract;
use App\Models\InternalUser;
use App\Services\V5\Contract\ContractRenewalService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ContractRenewalServiceTest extends TestCase
{
    private ContractRenewalService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
        $this->service = app(ContractRenewalService::class);
    }

    // ─────────────────────────────────────────────────
    //  computeGapDays — canonical examples from plan §4.1
    // ─────────────────────────────────────────────────

    /** @test */
    public function compute_gap_days_continuous_next_day(): void
    {
        // parent expires 2026-12-31, addendum starts 2027-01-01 → gap=1
        $this->assertSame(1, $this->service->computeGapDays('2026-12-31', '2027-01-01'));
    }

    /** @test */
    public function compute_gap_days_gap_15(): void
    {
        // parent expires 2026-12-31, addendum starts 2027-01-15 → gap=15
        $this->assertSame(15, $this->service->computeGapDays('2026-12-31', '2027-01-15'));
    }

    /** @test */
    public function compute_gap_days_early_negative(): void
    {
        // parent expires 2026-12-31, addendum starts 2026-12-20 → gap=-11
        $this->assertSame(-11, $this->service->computeGapDays('2026-12-31', '2026-12-20'));
    }

    /** @test */
    public function compute_gap_days_early_same_day(): void
    {
        // parent expires 2026-12-31, addendum starts 2026-12-31 → gap=0
        $this->assertSame(0, $this->service->computeGapDays('2026-12-31', '2026-12-31'));
    }

    /** @test */
    public function compute_gap_days_null_when_parent_expiry_missing(): void
    {
        $this->assertNull($this->service->computeGapDays(null, '2027-01-01'));
    }

    /** @test */
    public function compute_gap_days_null_when_effective_date_missing(): void
    {
        $this->assertNull($this->service->computeGapDays('2026-12-31', null));
    }

    /** @test */
    public function compute_gap_days_null_when_both_missing(): void
    {
        $this->assertNull($this->service->computeGapDays(null, null));
    }

    // ─────────────────────────────────────────────────
    //  computeContinuityStatus — §4.2
    // ─────────────────────────────────────────────────

    /** @test */
    public function continuity_status_standalone_for_null(): void
    {
        $this->assertSame('STANDALONE', $this->service->computeContinuityStatus(null));
    }

    /** @test */
    public function continuity_status_early_for_zero(): void
    {
        $this->assertSame('EARLY', $this->service->computeContinuityStatus(0));
    }

    /** @test */
    public function continuity_status_early_for_negative(): void
    {
        $this->assertSame('EARLY', $this->service->computeContinuityStatus(-5));
    }

    /** @test */
    public function continuity_status_continuous_for_one(): void
    {
        $this->assertSame('CONTINUOUS', $this->service->computeContinuityStatus(1));
    }

    /** @test */
    public function continuity_status_gap_for_greater_than_one(): void
    {
        $this->assertSame('GAP', $this->service->computeContinuityStatus(2));
        $this->assertSame('GAP', $this->service->computeContinuityStatus(15));
    }

    // ─────────────────────────────────────────────────
    //  computePenaltyRate — §4.3, plan verification table
    // ─────────────────────────────────────────────────

    /** @test */
    public function penalty_null_for_null_gap(): void
    {
        $config = ['grace_days' => 0, 'rate_per_day' => 0.003333, 'max_rate' => 0.15];
        $this->assertNull($this->service->computePenaltyRate(null, $config));
    }

    /** @test */
    public function penalty_null_for_early_gap(): void
    {
        $config = ['grace_days' => 0, 'rate_per_day' => 0.003333, 'max_rate' => 0.15];
        $this->assertNull($this->service->computePenaltyRate(-5, $config));
        $this->assertNull($this->service->computePenaltyRate(0, $config));
    }

    /** @test */
    public function penalty_null_for_continuous(): void
    {
        $config = ['grace_days' => 0, 'rate_per_day' => 0.003333, 'max_rate' => 0.15];
        $this->assertNull($this->service->computePenaltyRate(1, $config));
    }

    /** @test */
    public function penalty_gap_2_no_grace(): void
    {
        // gap=2, grace=0 → guard: 2 <= 1+0 = false → 2 × 0.003333 = 0.006666 → round = 0.0067
        $config = ['grace_days' => 0, 'rate_per_day' => 0.003333, 'max_rate' => 0.15];
        $result = $this->service->computePenaltyRate(2, $config);
        $this->assertSame(0.0067, $result);
    }

    /** @test */
    public function penalty_gap_15_no_grace(): void
    {
        // gap=15, grace=0 → 15 × 0.003333 = 0.049995 → round(4) = 0.0500
        $config = ['grace_days' => 0, 'rate_per_day' => 0.003333, 'max_rate' => 0.15];
        $result = $this->service->computePenaltyRate(15, $config);
        $this->assertSame(0.05, $result);
    }

    /** @test */
    public function penalty_capped_at_max_rate(): void
    {
        // gap=50, grace=0 → 50 × 0.003333 = 0.16665 → round = 0.1667 → cap at 0.15
        $config = ['grace_days' => 0, 'rate_per_day' => 0.003333, 'max_rate' => 0.15];
        $result = $this->service->computePenaltyRate(50, $config);
        $this->assertSame(0.15, $result);
    }

    /** @test */
    public function penalty_null_within_grace_boundary(): void
    {
        // gap=6, grace=5 → guard: 6 <= 1+5 = 6 → true → null
        $config = ['grace_days' => 5, 'rate_per_day' => 0.003333, 'max_rate' => 0.15];
        $this->assertNull($this->service->computePenaltyRate(6, $config));
    }

    /** @test */
    public function penalty_applied_one_past_grace(): void
    {
        // gap=7, grace=5 → guard: 7 <= 6 = false → 7 × 0.003333 = 0.023331 → round = 0.0233
        $config = ['grace_days' => 5, 'rate_per_day' => 0.003333, 'max_rate' => 0.15];
        $result = $this->service->computePenaltyRate(7, $config);
        $this->assertSame(0.0233, $result);
    }

    // ─────────────────────────────────────────────────
    //  applyRenewalMetaToContract — integration
    // ─────────────────────────────────────────────────

    /** @test */
    public function apply_renewal_meta_sets_fields_on_model(): void
    {
        $parent = $this->createContractRecord(1, 'HD-001', [
            'expiry_date' => '2026-12-31',
        ]);

        $addendum = $this->createContractRecord(2, 'HD-002', [
            'effective_date' => '2027-01-15',
            'parent_contract_id' => 1,
        ]);

        $this->service->applyRenewalMetaToContract($addendum, $parent);

        $this->assertSame(15, $addendum->gap_days);
        $this->assertSame('GAP', $addendum->continuity_status);
        // penalty_rate should be set (gap=15 with default config: grace=0)
        $this->assertNotNull($addendum->penalty_rate);
    }

    /** @test */
    public function apply_renewal_meta_resets_to_standalone_when_no_parent(): void
    {
        $addendum = $this->createContractRecord(3, 'HD-003', [
            'effective_date' => '2027-01-15',
            'gap_days' => 15,
            'continuity_status' => 'GAP',
            'penalty_rate' => 0.05,
        ]);

        $this->service->applyRenewalMetaToContract($addendum, null);

        $this->assertNull($addendum->gap_days);
        $this->assertSame('STANDALONE', $addendum->continuity_status);
        $this->assertNull($addendum->penalty_rate);
    }

    /** @test */
    public function apply_renewal_meta_with_effective_date_override(): void
    {
        $parent = $this->createContractRecord(4, 'HD-004', [
            'expiry_date' => '2026-12-31',
        ]);

        $addendum = $this->createContractRecord(5, 'HD-005', [
            'effective_date' => '2027-06-01', // this would give gap=152
            'parent_contract_id' => 4,
        ]);

        // Override to 2027-01-01 → gap=1 → CONTINUOUS
        $this->service->applyRenewalMetaToContract($addendum, $parent, '2027-01-01');

        $this->assertSame(1, $addendum->gap_days);
        $this->assertSame('CONTINUOUS', $addendum->continuity_status);
        $this->assertNull($addendum->penalty_rate);
    }

    // ─────────────────────────────────────────────────
    //  applyPenaltyToSchedules
    // ─────────────────────────────────────────────────

    /** @test */
    public function apply_penalty_to_pending_schedules(): void
    {
        $this->createContractRecord(10, 'HD-010', []);

        DB::table('payment_schedules')->insert([
            ['contract_id' => 10, 'milestone_name' => 'K1', 'cycle_number' => 1, 'expected_date' => '2027-01-15', 'expected_amount' => 100000, 'actual_paid_amount' => 0, 'status' => 'PENDING', 'created_at' => now(), 'updated_at' => now()],
            ['contract_id' => 10, 'milestone_name' => 'K2', 'cycle_number' => 2, 'expected_date' => '2027-04-15', 'expected_amount' => 200000, 'actual_paid_amount' => 0, 'status' => 'INVOICED', 'created_at' => now(), 'updated_at' => now()],
            ['contract_id' => 10, 'milestone_name' => 'K3', 'cycle_number' => 3, 'expected_date' => '2027-07-15', 'expected_amount' => 300000, 'actual_paid_amount' => 300000, 'status' => 'PAID', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->service->applyPenaltyToSchedules(10, 0.05);

        // PENDING → should have penalty applied
        $k1 = DB::table('payment_schedules')->where('milestone_name', 'K1')->first();
        $this->assertEquals(100000, $k1->original_amount);
        $this->assertEquals(0.05, $k1->penalty_rate);
        $this->assertEquals(5000, $k1->penalty_amount); // floor(100000 * 0.05) = 5000
        $this->assertEquals(95000, $k1->expected_amount);

        // INVOICED → should have penalty applied
        $k2 = DB::table('payment_schedules')->where('milestone_name', 'K2')->first();
        $this->assertEquals(200000, $k2->original_amount);
        $this->assertEquals(10000, $k2->penalty_amount); // floor(200000 * 0.05)
        $this->assertEquals(190000, $k2->expected_amount);

        // PAID → should NOT be modified
        $k3 = DB::table('payment_schedules')->where('milestone_name', 'K3')->first();
        $this->assertEquals(300000, $k3->expected_amount);
        $this->assertNull($k3->original_amount ?? null);
    }

    /** @test */
    public function remove_penalty_restores_original_amount(): void
    {
        $this->createContractRecord(11, 'HD-011', []);

        DB::table('payment_schedules')->insert([
            'contract_id' => 11, 'milestone_name' => 'K1', 'cycle_number' => 1,
            'expected_date' => '2027-01-15', 'expected_amount' => 95000,
            'original_amount' => 100000, 'penalty_rate' => 0.05, 'penalty_amount' => 5000,
            'actual_paid_amount' => 0, 'status' => 'PENDING',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->service->applyPenaltyToSchedules(11, null);

        $k1 = DB::table('payment_schedules')->where('milestone_name', 'K1')->where('contract_id', 11)->first();
        $this->assertEquals(100000, $k1->expected_amount); // restored to original
        $this->assertNull($k1->penalty_rate);
        $this->assertNull($k1->penalty_amount);
    }

    // ─────────────────────────────────────────────────
    //  Chain validation
    // ─────────────────────────────────────────────────

    /** @test */
    public function validates_no_self_reference(): void
    {
        $this->expectException(ValidationException::class);
        $this->service->validateNoCircularParent(1, 1);
    }

    /** @test */
    public function validates_no_circular_chain(): void
    {
        // A → B → C, try to set C as parent of A
        $this->createContractRecord(100, 'HD-100', []);
        $this->createContractRecord(101, 'HD-101', ['parent_contract_id' => 100]);
        $this->createContractRecord(102, 'HD-102', ['parent_contract_id' => 101]);

        $this->expectException(ValidationException::class);
        $this->service->validateNoCircularParent(100, 102);
    }

    /** @test */
    public function validates_chain_depth_within_limit(): void
    {
        // Create chain: 1 → 2 → 3 (depth=2 for node 3). Should be fine.
        $this->createContractRecord(200, 'HD-200', []);
        $this->createContractRecord(201, 'HD-201', ['parent_contract_id' => 200]);
        $this->createContractRecord(202, 'HD-202', ['parent_contract_id' => 201]);

        // Adding child to 202 (depth would be 3) — well within limit 10
        $this->service->validateChainDepthForCreate(202);
        $this->assertTrue(true); // no exception
    }

    // ─────────────────────────────────────────────────
    //  E2E: contract creation via API with parent
    // ─────────────────────────────────────────────────

    /** @test */
    public function create_contract_with_parent_sets_renewal_meta(): void
    {
        // Create parent via DB
        $this->createContractRecord(300, 'HD-PARENT', [
            'expiry_date' => '2026-12-31',
            'status' => 'SIGNED',
        ]);

        // Create addendum via API
        $response = $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-CHILD-001',
            'contract_name' => 'Phu luc gia han',
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 50000000,
            'status' => 'SIGNED',
            'payment_cycle' => 'ONCE',
            'parent_contract_id' => 300,
            'addendum_type' => 'EXTENSION',
            'effective_date' => '2027-01-01',
            'expiry_date' => '2027-12-31',
        ]);

        $response->assertCreated();
        $data = $response->json('data');
        $this->assertSame(1, $data['gap_days'] ?? null);
        $this->assertSame('CONTINUOUS', $data['continuity_status'] ?? null);
        $this->assertNull($data['penalty_rate'] ?? null);
    }

    /** @test */
    public function create_addendum_with_gap_computes_penalty(): void
    {
        $this->createContractRecord(301, 'HD-PARENT-2', [
            'expiry_date' => '2026-12-31',
            'status' => 'SIGNED',
        ]);

        $response = $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-CHILD-002',
            'contract_name' => 'Phu luc tre 15 ngay',
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 50000000,
            'status' => 'SIGNED',
            'payment_cycle' => 'ONCE',
            'parent_contract_id' => 301,
            'addendum_type' => 'EXTENSION',
            'effective_date' => '2027-01-15',
            'expiry_date' => '2027-12-31',
        ]);

        $response->assertCreated();
        $data = $response->json('data');
        $this->assertSame(15, $data['gap_days'] ?? null);
        $this->assertSame('GAP', $data['continuity_status'] ?? null);
        // With default config: 15 × 0.003333 = 0.049995 → round = 0.05
        $this->assertNotNull($data['penalty_rate'] ?? null);
    }

    // ─────────────────────────────────────────────────
    //  markParentAsRenewed — unit
    // ─────────────────────────────────────────────────

    /** @test */
    public function mark_parent_as_renewed_returns_true_for_signed_extension(): void
    {
        $parent = $this->createContractRecord(400, 'HD-P400', ['status' => 'SIGNED']);
        $changed = $this->service->markParentAsRenewed($parent, 'EXTENSION');
        $this->assertTrue($changed);
        $this->assertSame('RENEWED', $parent->status);
    }

    /** @test */
    public function mark_parent_as_renewed_returns_false_for_amendment(): void
    {
        $parent = $this->createContractRecord(401, 'HD-P401', ['status' => 'SIGNED']);
        $changed = $this->service->markParentAsRenewed($parent, 'AMENDMENT');
        $this->assertFalse($changed);
        $this->assertSame('SIGNED', $parent->status); // unchanged
    }

    /** @test */
    public function mark_parent_as_renewed_returns_false_for_liquidation(): void
    {
        $parent = $this->createContractRecord(402, 'HD-P402', ['status' => 'SIGNED']);
        $changed = $this->service->markParentAsRenewed($parent, 'LIQUIDATION');
        $this->assertFalse($changed);
        $this->assertSame('SIGNED', $parent->status); // unchanged
    }

    /** @test */
    public function mark_parent_as_renewed_skips_when_already_renewed(): void
    {
        $parent = $this->createContractRecord(403, 'HD-P403', ['status' => 'RENEWED']);
        $changed = $this->service->markParentAsRenewed($parent, 'EXTENSION');
        $this->assertFalse($changed); // no-op: already RENEWED
        $this->assertSame('RENEWED', $parent->status);
    }

    /** @test */
    public function mark_parent_as_renewed_skips_for_draft_parent(): void
    {
        $parent = $this->createContractRecord(404, 'HD-P404', ['status' => 'DRAFT']);
        $changed = $this->service->markParentAsRenewed($parent, 'EXTENSION');
        $this->assertFalse($changed); // only SIGNED → RENEWED is allowed
        $this->assertSame('DRAFT', $parent->status);
    }

    // ─────────────────────────────────────────────────
    //  Auto-mark parent RENEWED via POST /contracts — E2E
    // ─────────────────────────────────────────────────

    /** @test */
    public function create_extension_addendum_auto_marks_parent_as_renewed(): void
    {
        $this->createContractRecord(500, 'HD-P500', [
            'expiry_date' => '2026-12-31',
            'status' => 'SIGNED',
        ]);

        $response = $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-C500',
            'contract_name' => 'Phu luc EXTENSION',
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 80000000,
            'status' => 'SIGNED',
            'payment_cycle' => 'ONCE',
            'parent_contract_id' => 500,
            'addendum_type' => 'EXTENSION',
            'effective_date' => '2027-01-01',
            'expiry_date' => '2027-12-31',
        ]);

        $response->assertCreated();

        // Parent status must now be RENEWED in DB
        $parent = DB::table('contracts')->where('id', 500)->first();
        $this->assertSame('RENEWED', strtoupper((string) $parent->status));
    }

    /** @test */
    public function create_amendment_addendum_does_not_mark_parent_as_renewed(): void
    {
        $this->createContractRecord(501, 'HD-P501', [
            'expiry_date' => '2026-12-31',
            'status' => 'SIGNED',
        ]);

        $response = $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-C501',
            'contract_name' => 'Phu luc AMENDMENT',
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 80000000,
            'status' => 'SIGNED',
            'payment_cycle' => 'ONCE',
            'parent_contract_id' => 501,
            'addendum_type' => 'AMENDMENT',
            'effective_date' => '2027-01-01',
            'expiry_date' => '2027-12-31',
        ]);

        $response->assertCreated();

        // Parent status must stay SIGNED (not promoted)
        $parent = DB::table('contracts')->where('id', 501)->first();
        $this->assertSame('SIGNED', strtoupper((string) $parent->status));
    }

    /** @test */
    public function create_addendum_without_parent_does_not_affect_any_status(): void
    {
        $response = $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-STANDALONE',
            'contract_name' => 'HĐ doc lap',
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 30000000,
            'status' => 'DRAFT',
            'payment_cycle' => 'ONCE',
        ]);

        $response->assertCreated();
        $this->assertSame('DRAFT', $response->json('data.status'));
        $this->assertNull($response->json('data.parent_contract_id'));
    }

    /** @test */
    public function create_extension_on_already_renewed_parent_is_idempotent(): void
    {
        // Parent already RENEWED (second renewal in chain)
        $this->createContractRecord(502, 'HD-P502', [
            'expiry_date' => '2026-12-31',
            'status' => 'RENEWED',
        ]);

        $response = $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-C502',
            'contract_name' => 'Phu luc lan 2',
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 90000000,
            'status' => 'SIGNED',
            'payment_cycle' => 'ONCE',
            'parent_contract_id' => 502,
            'addendum_type' => 'EXTENSION',
            'effective_date' => '2027-01-05',
            'expiry_date' => '2027-12-31',
        ]);

        $response->assertCreated();

        // Parent already RENEWED — must stay RENEWED (no error, no duplicate update)
        $parent = DB::table('contracts')->where('id', 502)->first();
        $this->assertSame('RENEWED', strtoupper((string) $parent->status));
    }

    // ─────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────

    private function createContractRecord(int $id, string $code, array $overrides = []): Contract
    {
        $defaults = [
            'id' => $id,
            'contract_code' => $code,
            'contract_name' => 'Contract ' . $code,
            'customer_id' => 1,
            'project_id' => 1,
            'dept_id' => 10,
            'value' => 100000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ];

        $data = array_merge($defaults, $overrides);
        DB::table('contracts')->insert($data);

        return Contract::findOrFail($id);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('payment_schedules');
        Schema::dropIfExists('contract_items');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('integration_settings');
        Schema::dropIfExists('products');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('internal_users');

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

        Schema::create('products', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('product_code', 50)->nullable();
            $table->string('product_name', 255)->nullable();
            $table->decimal('standard_price', 15, 2)->default(0);
            $table->string('unit', 50)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('contract_code', 100)->nullable();
            $table->string('contract_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->decimal('value', 18, 2)->default(0);
            $table->string('payment_cycle', 32)->nullable();
            $table->string('status', 32)->nullable();
            $table->date('sign_date')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('term_unit', 10)->nullable();
            $table->decimal('term_value', 10, 2)->nullable();
            $table->boolean('expiry_date_manual_override')->default(false);
            // Addendum columns
            $table->unsignedBigInteger('parent_contract_id')->nullable();
            $table->string('addendum_type', 32)->nullable();
            $table->integer('gap_days')->nullable();
            $table->string('continuity_status', 32)->nullable()->default('STANDALONE');
            $table->decimal('penalty_rate', 5, 4)->nullable();
            $table->string('data_scope', 255)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('contract_items', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('product_id');
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('vat_rate', 5, 2)->nullable();
            $table->decimal('vat_amount', 18, 2)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unique(['contract_id', 'product_id']);
        });

        Schema::create('payment_schedules', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('milestone_name', 255);
            $table->unsignedInteger('cycle_number');
            $table->date('expected_date');
            $table->decimal('expected_amount', 18, 2)->default(0);
            $table->decimal('original_amount', 18, 2)->nullable();
            $table->decimal('penalty_rate', 5, 4)->nullable();
            $table->decimal('penalty_amount', 18, 2)->nullable();
            $table->date('actual_paid_date')->nullable();
            $table->decimal('actual_paid_amount', 18, 2)->default(0);
            $table->string('status', 32)->default('PENDING');
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('integration_settings', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('provider', 100)->unique();
            $table->boolean('is_enabled')->default(true);
            $table->string('setting_value', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        // Seed data
        DB::table('departments')->insert([
            'id' => 10, 'dept_code' => 'P10', 'dept_name' => 'Phong giai phap 10',
            'parent_id' => null, 'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 1, 'user_code' => 'U001', 'username' => 'tester', 'full_name' => 'Tester',
            'department_id' => 10, 'password' => bcrypt('secret'), 'remember_token' => null, 'deleted_at' => null,
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

        DB::table('products')->insert([
            'id' => 1, 'product_code' => 'P001', 'product_name' => 'Phan mem VNPT HIS',
            'standard_price' => 150000000, 'unit' => 'License',
            'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null,
        ]);

        // Seed default renewal settings
        DB::table('integration_settings')->insert([
            ['provider' => 'contract_renewal_grace_days', 'is_enabled' => true, 'setting_value' => '0', 'created_at' => now(), 'updated_at' => now()],
            ['provider' => 'contract_renewal_penalty_rate_per_day', 'is_enabled' => true, 'setting_value' => '0.003333', 'created_at' => now(), 'updated_at' => now()],
            ['provider' => 'contract_renewal_max_penalty_rate', 'is_enabled' => true, 'setting_value' => '0.1500', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
