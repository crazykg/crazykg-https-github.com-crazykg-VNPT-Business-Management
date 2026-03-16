<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestSlaScopedResolutionPhaseSevenTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_update_transition_prefers_service_group_and_action_scoped_sla_rule(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-03-13 10:00:00'));

        DB::table('customer_requests')->insert([
            'id' => 100,
            'uuid' => '00000000-0000-0000-0000-000000000100',
            'request_code' => 'YC000100',
            'status_catalog_id' => 2,
            'summary' => 'Chờ duyệt tài liệu',
            'customer_id' => 1,
            'service_group_id' => 1,
            'receiver_user_id' => 10,
            'assignee_id' => 20,
            'status' => 'CHO_DUYET',
            'sub_status' => null,
            'priority' => 'MEDIUM',
            'requested_date' => '2026-03-13',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('workflow_status_transitions')->insert([
            'id' => 1,
            'from_status_catalog_id' => 2,
            'to_status_catalog_id' => 3,
            'action_code' => 'APPROVE',
            'action_name' => 'Duyệt',
            'required_role' => null,
            'sort_order' => 10,
            'is_active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('sla_configs')->insert([
            [
                'status' => 'DA_DUYET',
                'sub_status' => null,
                'priority' => 'MEDIUM',
                'sla_hours' => 24,
                'service_group_id' => null,
                'workflow_action_code' => null,
                'is_active' => 1,
                'sort_order' => 30,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'status' => 'DA_DUYET',
                'sub_status' => null,
                'priority' => 'MEDIUM',
                'sla_hours' => 12,
                'service_group_id' => 1,
                'workflow_action_code' => null,
                'is_active' => 1,
                'sort_order' => 20,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'status' => 'DA_DUYET',
                'sub_status' => null,
                'priority' => 'MEDIUM',
                'sla_hours' => 8,
                'service_group_id' => null,
                'workflow_action_code' => 'APPROVE',
                'is_active' => 1,
                'sort_order' => 10,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'status' => 'DA_DUYET',
                'sub_status' => null,
                'priority' => 'MEDIUM',
                'sla_hours' => 4,
                'service_group_id' => 1,
                'workflow_action_code' => 'APPROVE',
                'is_active' => 1,
                'sort_order' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->putJson('/api/v5/customer-requests/100', [
            'status_catalog_id' => 3,
            'summary' => 'Đã duyệt tài liệu',
        ])
            ->assertOk()
            ->assertJsonPath('data.status_catalog_id', 3)
            ->assertJsonPath('data.status', 'DA_DUYET');

        $transition = DB::table('request_transitions')->orderByDesc('id')->first();

        $this->assertNotNull($transition);
        $this->assertSame('DA_DUYET', $transition->to_status);
        $this->assertSame('2026-03-13 14:00:00', Carbon::parse($transition->sla_due_time)->format('Y-m-d H:i:s'));
        $this->assertSame(0, (int) $transition->is_sla_breached);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('request_transitions');
        Schema::dropIfExists('customer_requests');
        Schema::dropIfExists('workflow_status_transitions');
        Schema::dropIfExists('workflow_status_catalogs');
        Schema::dropIfExists('support_service_groups');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('sla_configs');

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_name', 255)->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('full_name', 255)->nullable();
        });

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('group_name', 255)->nullable();
        });

        Schema::create('workflow_status_catalogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedTinyInteger('level')->default(1);
            $table->string('status_code', 80);
            $table->string('status_name', 150);
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('canonical_status', 50)->nullable();
            $table->string('canonical_sub_status', 50)->nullable();
            $table->string('flow_step', 20)->nullable();
            $table->string('form_key', 120)->nullable();
            $table->boolean('is_leaf')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('workflow_status_transitions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('from_status_catalog_id');
            $table->unsignedBigInteger('to_status_catalog_id');
            $table->string('action_code', 80);
            $table->string('action_name', 150);
            $table->string('required_role', 50)->nullable();
            $table->json('condition_json')->nullable();
            $table->json('notify_targets_json')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('sla_configs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('status', 50);
            $table->string('sub_status', 50)->nullable();
            $table->string('priority', 20);
            $table->decimal('sla_hours', 6, 2)->nullable();
            $table->unsignedBigInteger('service_group_id')->nullable();
            $table->string('workflow_action_code', 80)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('customer_requests', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->unique();
            $table->string('request_code', 80)->unique();
            $table->unsignedBigInteger('status_catalog_id')->nullable();
            $table->string('summary', 500);
            $table->unsignedBigInteger('project_item_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('requester_name', 120)->nullable();
            $table->unsignedBigInteger('reporter_contact_id')->nullable();
            $table->unsignedBigInteger('service_group_id')->nullable();
            $table->unsignedBigInteger('receiver_user_id')->nullable();
            $table->unsignedBigInteger('assignee_id')->nullable();
            $table->string('status', 50);
            $table->string('sub_status', 50)->nullable();
            $table->string('priority', 20)->default('MEDIUM');
            $table->date('requested_date')->nullable();
            $table->unsignedBigInteger('latest_transition_id')->nullable();
            $table->string('reference_ticket_code', 100)->nullable();
            $table->unsignedBigInteger('reference_request_id')->nullable();
            $table->text('notes')->nullable();
            $table->json('transition_metadata')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->softDeletes();
        });

        Schema::create('request_transitions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->string('request_code', 80)->nullable();
            $table->string('request_summary', 500)->nullable();
            $table->string('parent_request_code', 80)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('project_item_id')->nullable();
            $table->string('from_status', 50)->nullable();
            $table->string('to_status', 50)->nullable();
            $table->string('sub_status', 50)->nullable();
            $table->unsignedBigInteger('new_assignee_id')->nullable();
            $table->decimal('hours_estimated', 8, 2)->nullable();
            $table->json('transition_metadata')->nullable();
            $table->text('doc_link')->nullable();
            $table->text('drive_file_id')->nullable();
            $table->text('transition_note')->nullable();
            $table->text('internal_note')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->softDeletes();
            $table->timestamp('sla_due_time')->nullable();
            $table->boolean('is_sla_breached')->default(false);
        });

        DB::table('customers')->insert([
            'id' => 1,
            'customer_name' => 'Bệnh viện Sản - Nhi Hậu Giang',
        ]);

        DB::table('support_service_groups')->insert([
            'id' => 1,
            'group_name' => 'EMR-HIS',
        ]);

        DB::table('internal_users')->insert([
            ['id' => 10, 'full_name' => 'Phan Văn Rở'],
            ['id' => 20, 'full_name' => 'Nguyễn Nhựt Trường'],
        ]);

        DB::table('workflow_status_catalogs')->insert([
            [
                'id' => 2,
                'level' => 1,
                'status_code' => 'CHO_DUYET',
                'status_name' => 'Chờ duyệt',
                'canonical_status' => 'CHO_DUYET',
                'flow_step' => 'GD1A',
                'form_key' => 'support.cho_duyet',
                'is_leaf' => 1,
                'sort_order' => 20,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'level' => 1,
                'status_code' => 'DA_DUYET',
                'status_name' => 'Đã duyệt',
                'canonical_status' => 'DA_DUYET',
                'flow_step' => 'GD1B',
                'form_key' => 'support.da_duyet',
                'is_leaf' => 1,
                'sort_order' => 30,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
