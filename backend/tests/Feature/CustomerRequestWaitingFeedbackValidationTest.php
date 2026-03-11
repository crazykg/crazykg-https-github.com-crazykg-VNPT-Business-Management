<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestWaitingFeedbackValidationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpMinimalCustomerRequestWorkflowSchema();
    }

    public function test_create_waiting_customer_feedback_request_allows_blank_feedback_fields(): void
    {
        $response = $this->postJson('/api/v5/customer-requests', $this->waitingPayload());

        $response
            ->assertCreated()
            ->assertJsonPath('data.status', 'DOI_PHAN_HOI_KH')
            ->assertJsonPath('data.transition_metadata.customer_feedback_date', null)
            ->assertJsonPath('data.transition_metadata.customer_feedback_content', null);
    }

    public function test_create_waiting_customer_feedback_request_rejects_feedback_date_without_content(): void
    {
        $response = $this->postJson('/api/v5/customer-requests', $this->waitingPayload([
            'transition_metadata' => [
                'exchange_date' => '2026-03-11',
                'exchange_content' => 'Da trao doi voi khach hang',
                'customer_feedback_date' => '2026-03-12',
            ],
        ]));

        $response
            ->assertStatus(422)
            ->assertJson(['message' => 'Nội dung khách hàng phản hồi là bắt buộc.']);
    }

    public function test_create_waiting_customer_feedback_request_accepts_feedback_date_with_content(): void
    {
        $response = $this->postJson('/api/v5/customer-requests', $this->waitingPayload([
            'transition_metadata' => [
                'exchange_date' => '2026-03-11',
                'exchange_content' => 'Da trao doi voi khach hang',
                'customer_feedback_date' => '2026-03-12',
                'customer_feedback_content' => 'Khach hang da phan hoi',
            ],
        ]));

        $response
            ->assertCreated()
            ->assertJsonPath('data.transition_metadata.customer_feedback_date', '2026-03-12')
            ->assertJsonPath('data.transition_metadata.customer_feedback_content', 'Khach hang da phan hoi');
    }

    public function test_update_waiting_customer_feedback_request_cannot_clear_content_while_feedback_date_remains(): void
    {
        $created = $this->postJson('/api/v5/customer-requests', $this->waitingPayload([
            'transition_metadata' => [
                'exchange_date' => '2026-03-11',
                'exchange_content' => 'Da trao doi voi khach hang',
                'customer_feedback_date' => '2026-03-12',
                'customer_feedback_content' => 'Khach hang da phan hoi',
            ],
        ]))->assertCreated();

        $requestId = (int) $created->json('data.id');

        $response = $this->putJson("/api/v5/customer-requests/{$requestId}", [
            'transition_metadata' => [
                'customer_feedback_content' => '',
            ],
        ]);

        $response
            ->assertStatus(422)
            ->assertJson(['message' => 'Nội dung khách hàng phản hồi là bắt buộc.']);
    }

    public function test_non_waiting_status_still_allows_feedback_date_without_feedback_content(): void
    {
        $response = $this->postJson('/api/v5/customer-requests', [
            'status_catalog_id' => $this->statusCatalogId('HOAN_THANH'),
            'summary' => 'Hoan thanh khong can content phan hoi',
            'priority' => 'MEDIUM',
            'requested_date' => '2026-03-11',
            'transition_metadata' => [
                'customer_feedback_date' => '2026-03-12',
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.status', 'HOAN_THANH')
            ->assertJsonPath('data.transition_metadata.customer_feedback_date', '2026-03-12')
            ->assertJsonPath('data.transition_metadata.customer_feedback_content', null);
    }

    private function waitingPayload(array $overrides = []): array
    {
        return array_replace_recursive([
            'status_catalog_id' => $this->statusCatalogId('DOI_PHAN_HOI_KH'),
            'summary' => 'Yeu cau doi phan hoi khach hang',
            'priority' => 'MEDIUM',
            'requested_date' => '2026-03-11',
            'transition_metadata' => [
                'exchange_date' => '2026-03-11',
                'exchange_content' => 'Da trao doi voi khach hang',
            ],
        ], $overrides);
    }

    private function statusCatalogId(string $statusCode): int
    {
        $id = DB::table('workflow_status_catalogs')
            ->where('status_code', $statusCode)
            ->orWhere('canonical_status', $statusCode)
            ->orderBy('id')
            ->value('id');

        $this->assertNotNull($id, "Unable to resolve workflow status catalog for {$statusCode}.");

        return (int) $id;
    }

    private function setUpMinimalCustomerRequestWorkflowSchema(): void
    {
        Schema::dropIfExists('customer_requests');
        Schema::dropIfExists('workflow_status_catalogs');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('support_service_groups');
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
            $table->unsignedTinyInteger('level');
            $table->string('status_code', 80);
            $table->string('status_name', 150);
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('canonical_status', 50)->nullable();
            $table->string('canonical_sub_status', 50)->nullable();
            $table->string('flow_step', 20)->nullable();
            $table->string('form_key', 120)->nullable();
            $table->boolean('is_leaf')->default(false);
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
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
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
            $table->softDeletes();
        });

        DB::table('workflow_status_catalogs')->insert([
            [
                'id' => 2,
                'level' => 1,
                'status_code' => 'DOI_PHAN_HOI_KH',
                'status_name' => 'Đợi phản hồi từ khách hàng',
                'parent_id' => null,
                'canonical_status' => 'DOI_PHAN_HOI_KH',
                'canonical_sub_status' => null,
                'flow_step' => 'GD2',
                'form_key' => 'support.doi_phan_hoi_kh',
                'is_leaf' => 1,
                'sort_order' => 30,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 5,
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
    }
}
