<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * P6.11 — CustomerRequestEscalation CRUD Tests
 *
 * @group escalation
 */
class CustomerRequestEscalationCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        $this->setUpEscalationSchema();
    }

    protected function tearDown(): void
    {
        $this->dropEscalationSchema();
        parent::tearDown();
    }

    // ── Schema helpers ─────────────────────────────────────────────────────

    private function setUpEscalationSchema(): void
    {
        $this->dropEscalationSchema();

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('customer_request_cases', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code', 30)->nullable();
            $table->string('summary', 500)->nullable();
            $table->string('current_status_code', 50)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        $escalationMigration = require base_path('database/migrations/2026_03_21_120100_create_customer_request_escalations_table.php');
        $escalationMigration->up();

        // Seed
        DB::table('internal_users')->insert([
            ['id' => 1, 'user_code' => 'USR001', 'full_name' => 'Nguyễn Văn A'],
            ['id' => 2, 'user_code' => 'USR002', 'full_name' => 'Trần Thị B'],
        ]);

        DB::table('customer_request_cases')->insert([
            ['id' => 101, 'request_code' => 'CRC-202603-0001', 'summary' => 'YC test', 'current_status_code' => 'in_progress', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 102, 'request_code' => 'CRC-202603-0002', 'summary' => 'YC test 2', 'current_status_code' => 'analysis', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    private function dropEscalationSchema(): void
    {
        Schema::disableForeignKeyConstraints();

        if (Schema::hasTable('customer_request_escalations')) {
            $escalationMigration = require base_path('database/migrations/2026_03_21_120100_create_customer_request_escalations_table.php');
            $escalationMigration->down();
        }

        Schema::dropIfExists('customer_request_cases');
        Schema::dropIfExists('internal_users');
        Schema::enableForeignKeyConstraints();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function makeEscalation(array $overrides = []): array
    {
        return array_merge([
            'created_by' => 1,
            'updated_by' => 1,
            'request_case_id' => 101,
            'difficulty_type' => 'technical',
            'severity' => 'high',
            'description' => 'Gặp khó khăn kỹ thuật nghiêm trọng khi tích hợp API bên thứ ba.',
        ], $overrides);
    }

    private function createEscalation(array $overrides = []): int
    {
        $response = $this->postJson('/api/v5/customer-request-escalations', $this->makeEscalation($overrides))
            ->assertCreated();

        return (int) $response->json('data.id');
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    public function test_create_escalation_returns_201(): void
    {
        $response = $this->postJson('/api/v5/customer-request-escalations', $this->makeEscalation())
            ->assertCreated();

        $data = $response->json('data');
        $this->assertStringStartsWith('ESC-', $data['escalation_code']);
        $this->assertSame('pending', $data['status']);
        $this->assertSame('high', $data['severity']);
        $this->assertSame('technical', $data['difficulty_type']);
        $this->assertSame(101, (int) $data['request_case_id']);
    }

    public function test_escalation_code_is_unique_sequential(): void
    {
        $id1 = $this->createEscalation();
        $id2 = $this->createEscalation(['request_case_id' => 102]);

        $code1 = DB::table('customer_request_escalations')->where('id', $id1)->value('escalation_code');
        $code2 = DB::table('customer_request_escalations')->where('id', $id2)->value('escalation_code');

        $this->assertNotSame($code1, $code2);
        $this->assertStringStartsWith('ESC-', $code1);
        $this->assertStringStartsWith('ESC-', $code2);
    }

    public function test_create_validates_required_fields(): void
    {
        $this->postJson('/api/v5/customer-request-escalations', [
            'created_by' => 1,
        ])->assertUnprocessable();
    }

    public function test_create_rejects_invalid_difficulty_type(): void
    {
        $this->postJson('/api/v5/customer-request-escalations', $this->makeEscalation([
            'difficulty_type' => 'unknown_type',
        ]))->assertUnprocessable();
    }

    public function test_create_rejects_invalid_severity(): void
    {
        $this->postJson('/api/v5/customer-request-escalations', $this->makeEscalation([
            'severity' => 'extreme',
        ]))->assertUnprocessable();
    }

    public function test_index_returns_paginated_list(): void
    {
        $this->createEscalation();
        $this->createEscalation(['request_case_id' => 102, 'severity' => 'critical']);

        $response = $this->getJson('/api/v5/customer-request-escalations')->assertOk();

        $this->assertCount(2, $response->json('data'));
        $this->assertSame(2, $response->json('meta.total'));
        $this->assertArrayHasKey('page', $response->json('meta'));
    }

    public function test_index_filter_by_status(): void
    {
        $id = $this->createEscalation();
        $this->createEscalation(['request_case_id' => 102]);

        // Review one to move it to reviewing (no decision → reviewing, not resolved)
        $this->postJson("/api/v5/customer-request-escalations/{$id}/review", [
            'created_by' => 2,
            'resolution_note' => 'Đang xem xét.',
            // resolution_decision intentionally omitted → nullable
        ])->assertOk();

        // Now 1 reviewing, 1 pending
        $response = $this->getJson('/api/v5/customer-request-escalations?status=reviewing')->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('reviewing', $response->json('data.0.status'));
    }

    public function test_show_returns_escalation(): void
    {
        $id = $this->createEscalation();

        $response = $this->getJson("/api/v5/customer-request-escalations/{$id}")->assertOk();
        $this->assertSame($id, (int) $response->json('data.id'));
        $this->assertSame('technical', $response->json('data.difficulty_type'));
    }

    public function test_review_moves_to_reviewing(): void
    {
        $id = $this->createEscalation();

        $this->postJson("/api/v5/customer-request-escalations/{$id}/review", [
            'created_by' => 2,
            'resolution_note' => 'Đang xem xét vấn đề.',
            // NO resolution_decision → stays reviewing
        ])->assertOk();

        $row = DB::table('customer_request_escalations')->where('id', $id)->first();
        $this->assertSame('reviewing', $row->status);
        $this->assertSame(2, (int) $row->reviewed_by_user_id);
        $this->assertNotNull($row->reviewed_at);
    }

    public function test_review_with_decision_resolves(): void
    {
        $id = $this->createEscalation();

        $this->postJson("/api/v5/customer-request-escalations/{$id}/review", [
            'created_by' => 2,
            'resolution_decision' => 'add_resource',
            'resolution_note' => 'Thêm 1 nhân viên hỗ trợ.',
        ])->assertOk();

        $row = DB::table('customer_request_escalations')->where('id', $id)->first();
        $this->assertSame('resolved', $row->status);
        $this->assertSame('add_resource', $row->resolution_decision);
        $this->assertNotNull($row->resolved_at);
    }

    public function test_resolve_endpoint_closes_escalation(): void
    {
        $id = $this->createEscalation();

        $this->postJson("/api/v5/customer-request-escalations/{$id}/resolve", [
            'created_by' => 2,
            'resolution_note' => 'Vấn đề đã được xử lý xong.',
        ])->assertOk();

        $row = DB::table('customer_request_escalations')->where('id', $id)->first();
        $this->assertSame('resolved', $row->status);
        $this->assertNotNull($row->resolved_at);
    }

    public function test_stats_returns_aggregates(): void
    {
        $this->createEscalation(['severity' => 'critical']);
        $this->createEscalation(['request_case_id' => 102, 'severity' => 'medium', 'difficulty_type' => 'resource']);

        $response = $this->getJson('/api/v5/customer-request-escalations/stats')->assertOk();

        $data = $response->json('data');
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('by_status', $data);
        $this->assertArrayHasKey('by_severity', $data);
        $this->assertArrayHasKey('by_type', $data);
        $this->assertSame(2, (int) $data['total']);
        $this->assertSame(2, (int) ($data['by_status']['pending'] ?? 0));
    }

    public function test_soft_delete_is_not_exposed(): void
    {
        $id = $this->createEscalation();

        // Soft delete manually
        DB::table('customer_request_escalations')->where('id', $id)->update(['deleted_at' => now()]);

        $response = $this->getJson('/api/v5/customer-request-escalations')->assertOk();
        $this->assertCount(0, $response->json('data'));
    }

    public function test_severity_filter_works(): void
    {
        $this->createEscalation(['severity' => 'critical']);
        $this->createEscalation(['request_case_id' => 102, 'severity' => 'low']);

        $response = $this->getJson('/api/v5/customer-request-escalations?severity=critical')->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('critical', $response->json('data.0.severity'));
    }
}
