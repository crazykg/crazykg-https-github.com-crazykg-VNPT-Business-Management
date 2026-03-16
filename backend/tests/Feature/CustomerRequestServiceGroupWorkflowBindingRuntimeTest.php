<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestServiceGroupWorkflowBindingRuntimeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_create_uses_bound_service_group_workflow_as_initial_status(): void
    {
        $this->postJson('/api/v5/customer-requests', [
            'customer_id' => 1,
            'service_group_id' => 1,
            'summary' => 'Khởi tạo theo workflow bind',
            'priority' => 'MEDIUM',
            'requested_date' => '2026-03-13',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status_catalog_id', 3)
            ->assertJsonPath('data.status', 'CHO_DUYET')
            ->assertJsonPath('data.service_group_workflow_status_catalog_id', 3)
            ->assertJsonPath('data.service_group_workflow_status_code', 'CHO_DUYET')
            ->assertJsonPath('data.service_group_workflow_status_name', 'Chờ duyệt')
            ->assertJsonPath('data.service_group_workflow_form_key', 'customer.request.emr')
            ->assertJsonPath('data.form_key', 'customer.request.emr');
    }

    public function test_create_falls_back_to_default_initial_status_when_service_group_has_no_binding(): void
    {
        $this->postJson('/api/v5/customer-requests', [
            'customer_id' => 1,
            'service_group_id' => 2,
            'summary' => 'Khởi tạo fallback mặc định',
            'priority' => 'MEDIUM',
            'requested_date' => '2026-03-13',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status_catalog_id', 1)
            ->assertJsonPath('data.status', 'MOI_TIEP_NHAN')
            ->assertJsonPath('data.service_group_workflow_status_catalog_id', null);
    }

    public function test_update_preserves_current_status_when_service_group_changes_without_explicit_transition(): void
    {
        DB::table('customer_requests')->insert([
            'id' => 100,
            'uuid' => '00000000-0000-0000-0000-000000000100',
            'request_code' => 'YC000100',
            'status_catalog_id' => 4,
            'summary' => 'Hoàn thành trước đó',
            'customer_id' => 1,
            'service_group_id' => 2,
            'status' => 'HOAN_THANH',
            'sub_status' => null,
            'priority' => 'MEDIUM',
            'requested_date' => '2026-03-10',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->putJson('/api/v5/customer-requests/100', [
            'customer_id' => 1,
            'service_group_id' => 1,
            'summary' => 'Đổi nhóm hỗ trợ nhưng giữ trạng thái',
        ])
            ->assertOk()
            ->assertJsonPath('data.service_group_id', 1)
            ->assertJsonPath('data.status_catalog_id', 4)
            ->assertJsonPath('data.status', 'HOAN_THANH');
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('customer_requests');
        Schema::dropIfExists('workflow_status_catalogs');
        Schema::dropIfExists('support_service_groups');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_name', 255)->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('full_name', 255)->nullable();
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

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('group_name', 255)->nullable();
            $table->unsignedBigInteger('workflow_status_catalog_id')->nullable();
            $table->string('workflow_form_key', 120)->nullable();
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

        DB::table('customers')->insert([
            'id' => 1,
            'customer_name' => 'Bệnh viện Sản - Nhi Hậu Giang',
        ]);

        DB::table('workflow_status_catalogs')->insert([
            [
                'id' => 1,
                'level' => 1,
                'status_code' => 'MOI_TIEP_NHAN',
                'status_name' => 'Mới tiếp nhận',
                'parent_id' => null,
                'canonical_status' => 'MOI_TIEP_NHAN',
                'canonical_sub_status' => null,
                'flow_step' => 'GD1',
                'form_key' => 'support.moi_tiep_nhan',
                'is_leaf' => 1,
                'sort_order' => 10,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'level' => 1,
                'status_code' => 'CHO_DUYET',
                'status_name' => 'Chờ duyệt',
                'parent_id' => null,
                'canonical_status' => 'CHO_DUYET',
                'canonical_sub_status' => null,
                'flow_step' => 'GD0',
                'form_key' => 'support.cho_duyet',
                'is_leaf' => 1,
                'sort_order' => 5,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 4,
                'level' => 1,
                'status_code' => 'HOAN_THANH',
                'status_name' => 'Hoàn thành',
                'parent_id' => null,
                'canonical_status' => 'HOAN_THANH',
                'canonical_sub_status' => null,
                'flow_step' => 'GD5',
                'form_key' => 'support.hoan_thanh',
                'is_leaf' => 1,
                'sort_order' => 60,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('support_service_groups')->insert([
            [
                'id' => 1,
                'customer_id' => 1,
                'group_name' => 'EMR-HIS',
                'workflow_status_catalog_id' => 3,
                'workflow_form_key' => 'customer.request.emr',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'customer_id' => 1,
                'group_name' => 'General',
                'workflow_status_catalog_id' => null,
                'workflow_form_key' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
