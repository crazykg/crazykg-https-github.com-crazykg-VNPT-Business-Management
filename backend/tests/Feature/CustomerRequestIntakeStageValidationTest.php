<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\V5MasterDataController;
use App\Services\V5\Workflow\CustomerRequestWorkflowService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestIntakeStageValidationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
        app()->forgetInstance(CustomerRequestWorkflowService::class);
    }

    public function test_create_request_still_defaults_to_internal_intake_stage(): void
    {
        $controller = app(V5MasterDataController::class);
        $request = Request::create('/api/v5/customer-requests', 'POST', [
            'summary' => 'Yêu cầu mới',
            'requested_date' => '2026-03-14',
        ]);
        $request->setUserResolver(fn () => new class
        {
            public int $id = 5;
        });

        $response = $controller->storeCustomerRequest($request);

        $this->assertSame(201, $response->getStatusCode());
        $payload = $response->getData(true);
        $this->assertSame('MOI_TIEP_NHAN', $payload['data']['status'] ?? null);
        $this->assertSame(5, $payload['data']['created_by'] ?? null);
    }

    public function test_update_request_cannot_move_non_intake_record_back_to_intake(): void
    {
        $controller = app(V5MasterDataController::class);
        $request = Request::create('/api/v5/customer-requests/100', 'PUT', [
            'status_catalog_id' => 1,
        ]);
        $request->setUserResolver(fn () => new class
        {
            public int $id = 5;
        });

        $response = $controller->updateCustomerRequest($request, 100);

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame(
            'Yêu cầu đã tiếp nhận không thể quay lại bước Tiếp nhận.',
            $response->getData(true)['message'] ?? null
        );
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

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('group_name', 255)->nullable();
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
            $table->json('transition_metadata')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        DB::table('customers')->insert([
            'id' => 1,
            'customer_name' => 'Bệnh viện Sản - Nhi Hậu Giang',
        ]);

        DB::table('support_service_groups')->insert([
            'id' => 1,
            'group_name' => 'EMR-Bệnh viện Sản Nhi',
        ]);

        DB::table('internal_users')->insert([
            ['id' => 5, 'full_name' => 'Phan Văn Rở'],
        ]);

        DB::table('workflow_status_catalogs')->insert([
            [
                'id' => 1,
                'level' => 1,
                'status_code' => 'MOI_TIEP_NHAN',
                'status_name' => 'Mới tiếp nhận',
                'canonical_status' => 'MOI_TIEP_NHAN',
                'is_leaf' => 1,
                'sort_order' => 10,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'level' => 1,
                'status_code' => 'PHAN_TICH',
                'status_name' => 'Phân tích',
                'canonical_status' => 'PHAN_TICH',
                'is_leaf' => 1,
                'sort_order' => 20,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('customer_requests')->insert([
            'id' => 100,
            'uuid' => '11111111-1111-1111-1111-111111111111',
            'request_code' => 'YC-100',
            'status_catalog_id' => 2,
            'summary' => 'Yêu cầu đang phân tích',
            'status' => 'PHAN_TICH',
            'sub_status' => null,
            'priority' => 'MEDIUM',
            'requested_date' => '2026-03-14',
            'created_at' => now(),
            'created_by' => 5,
            'updated_at' => now(),
            'updated_by' => 5,
            'deleted_at' => null,
        ]);
    }
}
