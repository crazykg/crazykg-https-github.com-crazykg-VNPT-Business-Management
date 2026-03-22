<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * P5.9 — CustomerRequestPlan CRUD Tests
 *
 * @group plans
 */
class CustomerRequestPlanCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        $this->setUpPlanSchema();
    }

    protected function tearDown(): void
    {
        $this->dropPlanSchema();
        parent::tearDown();
    }

    // ── Schema helpers ─────────────────────────────────────────────────────

    private function setUpPlanSchema(): void
    {
        $this->dropPlanSchema();

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_name', 255)->nullable();
        });

        // Minimal customer_request_cases for FK lookups
        Schema::create('customer_request_cases', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code', 30)->nullable();
            $table->string('summary', 500)->nullable();
            $table->string('current_status_code', 50)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('dispatcher_user_id')->nullable();
            $table->unsignedBigInteger('performer_user_id')->nullable();
            $table->integer('priority')->default(3);
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        // Plan tables (via migration file)
        $planMigration = require base_path('database/migrations/2026_03_21_110000_create_customer_request_plans_tables.php');
        $planMigration->up();

        // Seed basic users
        DB::table('internal_users')->insert([
            ['id' => 1, 'user_code' => 'USR001', 'full_name' => 'Nguyễn Văn Admin'],
            ['id' => 2, 'user_code' => 'USR002', 'full_name' => 'Trần Thị Điều phối'],
            ['id' => 3, 'user_code' => 'USR003', 'full_name' => 'Lê Văn Thực hiện'],
        ]);

        // Seed cases
        DB::table('customer_request_cases')->insert([
            ['id' => 101, 'request_code' => 'CRC-202603-0001', 'summary' => 'Yêu cầu test 1', 'current_status_code' => 'in_progress', 'priority' => 3, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 102, 'request_code' => 'CRC-202603-0002', 'summary' => 'Yêu cầu test 2', 'current_status_code' => 'analysis', 'priority' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 103, 'request_code' => 'CRC-202603-0003', 'summary' => 'Yêu cầu test 3', 'current_status_code' => 'new_intake', 'priority' => 1, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    private function dropPlanSchema(): void
    {
        Schema::disableForeignKeyConstraints();

        if (Schema::hasTable('customer_request_plans')) {
            $planMigration = require base_path('database/migrations/2026_03_21_110000_create_customer_request_plans_tables.php');
            $planMigration->down();
        }

        Schema::dropIfExists('customer_request_cases');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');
        Schema::enableForeignKeyConstraints();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function createPlan(array $overrides = []): int
    {
        $response = $this->postJson('/api/v5/customer-request-plans', array_merge([
            'created_by' => 1,
            'updated_by' => 1,
            'plan_type' => 'weekly',
            'period_start' => '2026-03-23',
            'period_end' => '2026-03-29',
            'dispatcher_user_id' => 2,
        ], $overrides))->assertCreated();

        return (int) $response->json('data.id');
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    public function test_create_weekly_plan(): void
    {
        $response = $this->postJson('/api/v5/customer-request-plans', [
            'created_by' => 1,
            'updated_by' => 1,
            'plan_type' => 'weekly',
            'period_start' => '2026-03-23',
            'period_end' => '2026-03-29',
            'dispatcher_user_id' => 2,
            'note' => 'Kế hoạch tuần 13',
        ])->assertCreated();

        $data = $response->json('data');
        $this->assertSame('weekly', $data['plan_type']);
        $this->assertSame('draft', $data['status']);
        $this->assertStringStartsWith('W2026', $data['plan_code']);
        $this->assertSame(0.0, (float) $data['total_planned_hours']);
    }

    public function test_create_monthly_plan(): void
    {
        $response = $this->postJson('/api/v5/customer-request-plans', [
            'created_by' => 1,
            'updated_by' => 1,
            'plan_type' => 'monthly',
            'period_start' => '2026-04-01',
            'period_end' => '2026-04-30',
            'dispatcher_user_id' => 2,
        ])->assertCreated();

        $data = $response->json('data');
        $this->assertSame('monthly', $data['plan_type']);
        $this->assertStringStartsWith('M2026', $data['plan_code']);
    }

    public function test_plan_code_is_unique_on_duplicate_period(): void
    {
        $id1 = $this->createPlan(['period_start' => '2026-03-23', 'period_end' => '2026-03-29']);
        $id2 = $this->createPlan(['period_start' => '2026-03-23', 'period_end' => '2026-03-29']);

        $code1 = DB::table('customer_request_plans')->where('id', $id1)->value('plan_code');
        $code2 = DB::table('customer_request_plans')->where('id', $id2)->value('plan_code');
        $this->assertNotSame($code1, $code2);
    }

    public function test_create_validates_required_fields(): void
    {
        $this->postJson('/api/v5/customer-request-plans', [
            'created_by' => 1,
        ])->assertUnprocessable();
    }

    public function test_create_rejects_invalid_plan_type(): void
    {
        $this->postJson('/api/v5/customer-request-plans', [
            'created_by' => 1,
            'updated_by' => 1,
            'plan_type' => 'quarterly',
            'period_start' => '2026-03-23',
            'period_end' => '2026-03-29',
            'dispatcher_user_id' => 2,
        ])->assertUnprocessable();
    }

    public function test_index_returns_paginated_plans(): void
    {
        $this->createPlan(['period_start' => '2026-03-23', 'period_end' => '2026-03-29']);
        $this->createPlan(['plan_type' => 'monthly', 'period_start' => '2026-04-01', 'period_end' => '2026-04-30']);

        $response = $this->getJson('/api/v5/customer-request-plans')->assertOk();

        $this->assertCount(2, $response->json('data'));
        $this->assertArrayHasKey('total', $response->json('meta'));
        $this->assertSame(2, $response->json('meta.total'));
    }

    public function test_show_returns_plan_with_items(): void
    {
        $planId = $this->createPlan();

        $response = $this->getJson("/api/v5/customer-request-plans/{$planId}")->assertOk();

        $this->assertArrayHasKey('plan', $response->json('data'));
        $this->assertArrayHasKey('items', $response->json('data'));
        $this->assertCount(0, $response->json('data.items'));
    }

    public function test_update_plan_status(): void
    {
        $planId = $this->createPlan();

        $this->putJson("/api/v5/customer-request-plans/{$planId}", [
            'created_by' => 1,
            'updated_by' => 1,
            'status' => 'submitted',
        ])->assertOk();

        $row = DB::table('customer_request_plans')->where('id', $planId)->first();
        $this->assertSame('submitted', $row->status);
    }

    public function test_soft_delete_plan(): void
    {
        $planId = $this->createPlan();

        $this->deleteJson("/api/v5/customer-request-plans/{$planId}", [
            'created_by' => 1,
        ])->assertOk();

        $row = DB::table('customer_request_plans')->where('id', $planId)->first();
        $this->assertNotNull($row->deleted_at);
    }

    public function test_add_item_to_plan(): void
    {
        $planId = $this->createPlan();

        $response = $this->postJson("/api/v5/customer-request-plans/{$planId}/items", [
            'created_by' => 1,
            'updated_by' => 1,
            'request_case_id' => 101,
            'performer_user_id' => 3,
            'planned_hours' => 4.5,
            'planned_start_date' => '2026-03-24',
            'planned_end_date' => '2026-03-25',
        ])->assertCreated();

        $item = $response->json('data');
        $this->assertSame(101, (int) $item['request_case_id']);
        $this->assertSame(4.5, (float) $item['planned_hours']);
        $this->assertSame('pending', $item['actual_status']);

        // plan.total_planned_hours updated
        $plan = DB::table('customer_request_plans')->where('id', $planId)->first();
        $this->assertSame(4.5, (float) $plan->total_planned_hours);
    }

    public function test_duplicate_case_in_same_plan_returns_422(): void
    {
        $planId = $this->createPlan();
        $this->postJson("/api/v5/customer-request-plans/{$planId}/items", [
            'created_by' => 1,
            'updated_by' => 1,
            'request_case_id' => 101,
            'performer_user_id' => 3,
            'planned_hours' => 4.0,
        ])->assertCreated();

        $this->postJson("/api/v5/customer-request-plans/{$planId}/items", [
            'created_by' => 1,
            'updated_by' => 1,
            'request_case_id' => 101,
            'performer_user_id' => 3,
            'planned_hours' => 2.0,
        ])->assertUnprocessable();
    }

    public function test_add_multiple_items_recalculates_total_hours(): void
    {
        $planId = $this->createPlan();

        $this->postJson("/api/v5/customer-request-plans/{$planId}/items", [
            'created_by' => 1, 'updated_by' => 1,
            'request_case_id' => 101, 'performer_user_id' => 3, 'planned_hours' => 4.0,
        ])->assertCreated();

        $this->postJson("/api/v5/customer-request-plans/{$planId}/items", [
            'created_by' => 1, 'updated_by' => 1,
            'request_case_id' => 102, 'performer_user_id' => 3, 'planned_hours' => 6.5,
        ])->assertCreated();

        $plan = DB::table('customer_request_plans')->where('id', $planId)->first();
        $this->assertSame(10.5, (float) $plan->total_planned_hours);
    }

    public function test_update_item_actual_status(): void
    {
        $planId = $this->createPlan();
        $response = $this->postJson("/api/v5/customer-request-plans/{$planId}/items", [
            'created_by' => 1, 'updated_by' => 1,
            'request_case_id' => 101, 'performer_user_id' => 3, 'planned_hours' => 4.0,
        ])->assertCreated();

        $itemId = (int) $response->json('data.id');

        $this->putJson("/api/v5/customer-request-plans/{$planId}/items/{$itemId}", [
            'created_by' => 1,
            'updated_by' => 1,
            'actual_status' => 'completed',
            'actual_hours' => 3.5,
        ])->assertOk();

        $item = DB::table('customer_request_plan_items')->where('id', $itemId)->first();
        $this->assertSame('completed', $item->actual_status);
        $this->assertSame(3.5, (float) $item->actual_hours);
    }

    public function test_delete_item_recalculates_plan_hours(): void
    {
        $planId = $this->createPlan();
        $r1 = $this->postJson("/api/v5/customer-request-plans/{$planId}/items", [
            'created_by' => 1, 'updated_by' => 1,
            'request_case_id' => 101, 'performer_user_id' => 3, 'planned_hours' => 4.0,
        ])->assertCreated();

        $this->postJson("/api/v5/customer-request-plans/{$planId}/items", [
            'created_by' => 1, 'updated_by' => 1,
            'request_case_id' => 102, 'performer_user_id' => 3, 'planned_hours' => 6.0,
        ])->assertCreated();

        $itemId = (int) $r1->json('data.id');
        $this->deleteJson("/api/v5/customer-request-plans/{$planId}/items/{$itemId}", [
            'created_by' => 1,
        ])->assertOk();

        $plan = DB::table('customer_request_plans')->where('id', $planId)->first();
        $this->assertSame(6.0, (float) $plan->total_planned_hours);
    }

    public function test_carry_over_pending_items_to_new_plan(): void
    {
        $sourcePlanId = $this->createPlan(['period_start' => '2026-03-23', 'period_end' => '2026-03-29']);
        $targetPlanId = $this->createPlan(['period_start' => '2026-03-30', 'period_end' => '2026-04-05']);

        // Add 2 items: 1 pending, 1 completed
        $r1 = $this->postJson("/api/v5/customer-request-plans/{$sourcePlanId}/items", [
            'created_by' => 1, 'updated_by' => 1,
            'request_case_id' => 101, 'performer_user_id' => 3, 'planned_hours' => 4.0,
        ])->assertCreated();
        $r2 = $this->postJson("/api/v5/customer-request-plans/{$sourcePlanId}/items", [
            'created_by' => 1, 'updated_by' => 1,
            'request_case_id' => 102, 'performer_user_id' => 3, 'planned_hours' => 3.0,
        ])->assertCreated();

        // Mark first as completed
        $item1Id = (int) $r1->json('data.id');
        $this->putJson("/api/v5/customer-request-plans/{$sourcePlanId}/items/{$item1Id}", [
            'created_by' => 1, 'updated_by' => 1,
            'actual_status' => 'completed', 'actual_hours' => 4.0,
        ])->assertOk();

        // Carry over
        $response = $this->postJson("/api/v5/customer-request-plans/{$sourcePlanId}/carry-over", [
            'created_by' => 1,
            'target_plan_id' => $targetPlanId,
        ])->assertOk();

        $this->assertSame(1, $response->json('data.carried_count'));

        // Verify original pending item is now carried_over
        $item2Id = (int) $r2->json('data.id');
        $originalItem = DB::table('customer_request_plan_items')->where('id', $item2Id)->first();
        $this->assertSame('carried_over', $originalItem->actual_status);
        $this->assertSame($targetPlanId, (int) $originalItem->carried_to_plan_id);

        // Verify target plan now has the carried item
        $targetItems = DB::table('customer_request_plan_items')->where('plan_id', $targetPlanId)->get();
        $this->assertCount(1, $targetItems);
        $this->assertSame(102, (int) $targetItems[0]->request_case_id);

        // Target plan hours updated
        $targetPlan = DB::table('customer_request_plans')->where('id', $targetPlanId)->first();
        $this->assertSame(3.0, (float) $targetPlan->total_planned_hours);
    }

    public function test_backlog_returns_cases_not_in_any_plan(): void
    {
        $planId = $this->createPlan();
        // Add case 101 to plan
        $this->postJson("/api/v5/customer-request-plans/{$planId}/items", [
            'created_by' => 1, 'updated_by' => 1,
            'request_case_id' => 101, 'performer_user_id' => 3, 'planned_hours' => 4.0,
        ])->assertCreated();

        $response = $this->getJson('/api/v5/customer-request-plans/backlog')->assertOk();

        // 101 is in plan → not in backlog. 102 and 103 should be in backlog.
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertNotContains(101, $ids);
        $this->assertContains(102, $ids);
        $this->assertContains(103, $ids);
    }

    public function test_backlog_excludes_closed_cases(): void
    {
        // Mark case 103 as completed
        DB::table('customer_request_cases')
            ->where('id', 103)
            ->update(['current_status_code' => 'completed']);

        $response = $this->getJson('/api/v5/customer-request-plans/backlog')->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertNotContains(103, $ids, 'completed cases should not be in backlog');
    }

    public function test_index_filter_by_plan_type(): void
    {
        $this->createPlan(['plan_type' => 'weekly', 'period_start' => '2026-03-23', 'period_end' => '2026-03-29']);
        $this->createPlan(['plan_type' => 'monthly', 'period_start' => '2026-04-01', 'period_end' => '2026-04-30']);

        $response = $this->getJson('/api/v5/customer-request-plans?plan_type=weekly')->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('weekly', $response->json('data.0.plan_type'));
    }

    public function test_add_item_validates_minimum_hours(): void
    {
        $planId = $this->createPlan();
        $this->postJson("/api/v5/customer-request-plans/{$planId}/items", [
            'created_by' => 1, 'updated_by' => 1,
            'request_case_id' => 101, 'performer_user_id' => 3,
            'planned_hours' => 0.1, // below 0.5 minimum
        ])->assertUnprocessable();
    }
}
