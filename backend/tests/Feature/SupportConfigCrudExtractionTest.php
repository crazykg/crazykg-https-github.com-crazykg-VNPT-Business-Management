<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SupportConfigCrudExtractionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
    }

    public function test_support_service_groups_can_create_list_available_and_update_via_api(): void
    {
        $this->setUpSupportServiceGroupSchema();

        DB::table('customers')->insert([
            ['id' => 5, 'customer_code' => 'C05', 'customer_name' => 'Khach Hang A'],
            ['id' => 6, 'customer_code' => 'C06', 'customer_name' => 'Khach Hang B'],
        ]);

        DB::table('workflow_status_catalogs')->insert([
            'id' => 9,
            'status_code' => 'NEW',
            'status_name' => 'Moi',
            'form_key' => 'support-intake',
        ]);

        $createResponse = $this->postJson('/api/v5/support-service-groups', [
            'group_name' => 'DMS Support',
            'customer_id' => 5,
            'workflow_status_catalog_id' => 9,
            'workflow_form_key' => 'support-dms',
            'description' => 'Nhom ho tro DMS',
            'is_active' => true,
        ])->assertCreated();

        $groupId = (int) $createResponse->json('data.id');
        $this->assertGreaterThan(0, $groupId);

        DB::table('customer_requests')->insert([
            'id' => 1,
            'service_group_id' => $groupId,
        ]);

        $listResponse = $this->getJson('/api/v5/support-service-groups')
            ->assertOk();

        /** @var Collection<int, array<string, mixed>> $rows */
        $rows = collect($listResponse->json('data'));
        $row = $rows->firstWhere('id', $groupId);
        $this->assertIsArray($row);
        $this->assertSame('DMS Support', $row['group_name']);
        $this->assertSame('Khach Hang A', $row['customer_name']);
        $this->assertSame('NEW', $row['workflow_status_code']);
        $this->assertSame(1, $row['used_in_customer_requests']);

        $this->getJson('/api/v5/support-service-groups/available?customer_id=5')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $groupId);

        $this->putJson("/api/v5/support-service-groups/{$groupId}", [
            'group_name' => 'DMS Support Updated',
            'group_code' => 'DMS_SUPPORT_UPDATED',
            'customer_id' => 5,
            'workflow_status_catalog_id' => 9,
            'workflow_form_key' => 'support-dms-v2',
            'description' => 'Nhom ho tro DMS da cap nhat',
            'is_active' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.group_name', 'DMS Support Updated')
            ->assertJsonPath('data.group_code', 'DMS_SUPPORT_UPDATED')
            ->assertJsonPath('data.is_active', false);
    }

    public function test_support_request_statuses_can_create_list_and_update_via_api(): void
    {
        $this->setUpSupportRequestStatusSchema();

        $createResponse = $this->postJson('/api/v5/support-request-statuses', [
            'status_code' => 'TESTING',
            'status_name' => 'Dang test',
            'description' => 'Trang thai cho test',
            'requires_completion_dates' => true,
            'is_terminal' => false,
            'is_transfer_dev' => false,
            'is_active' => true,
            'sort_order' => 95,
        ])->assertCreated();

        $statusId = (int) $createResponse->json('data.id');
        $this->assertGreaterThan(0, $statusId);

        $listResponse = $this->getJson('/api/v5/support-request-statuses')
            ->assertOk();

        /** @var Collection<int, array<string, mixed>> $rows */
        $rows = collect($listResponse->json('data'));
        $row = $rows->firstWhere('id', $statusId);
        $this->assertIsArray($row);
        $this->assertSame('TESTING', $row['status_code']);
        $this->assertSame('Dang test', $row['status_name']);
        $this->assertTrue($row['is_code_editable']);

        $this->putJson("/api/v5/support-request-statuses/{$statusId}", [
            'status_code' => 'TESTED',
            'status_name' => 'Da test',
            'description' => 'Trang thai sau khi update',
            'requires_completion_dates' => false,
            'is_terminal' => true,
            'is_transfer_dev' => false,
            'is_active' => false,
            'sort_order' => 99,
        ])
            ->assertOk()
            ->assertJsonPath('data.status_code', 'TESTED')
            ->assertJsonPath('data.status_name', 'Da test')
            ->assertJsonPath('data.is_terminal', true)
            ->assertJsonPath('data.is_active', false);
    }

    public function test_worklog_activity_types_can_create_list_and_update_via_api(): void
    {
        $this->setUpWorklogActivityTypeSchema();

        $createResponse = $this->postJson('/api/v5/worklog-activity-types', [
            'code' => 'analyze',
            'name' => 'Phan tich',
            'description' => 'Loai cong viec phan tich',
            'default_is_billable' => true,
            'phase_hint' => 'ANALYZE',
            'sort_order' => 5,
            'is_active' => true,
        ])->assertCreated();

        $typeId = (int) $createResponse->json('data.id');
        $this->assertGreaterThan(0, $typeId);

        $listResponse = $this->getJson('/api/v5/worklog-activity-types')
            ->assertOk();

        /** @var Collection<int, array<string, mixed>> $rows */
        $rows = collect($listResponse->json('data'));
        $row = $rows->firstWhere('id', $typeId);
        $this->assertIsArray($row);
        $this->assertSame('ANALYZE', $row['code']);
        $this->assertSame('Phan tich', $row['name']);
        $this->assertSame('ANALYZE', $row['phase_hint']);

        $this->putJson("/api/v5/worklog-activity-types/{$typeId}", [
            'code' => 'code_impl',
            'name' => 'Lap trinh',
            'description' => 'Loai cong viec lap trinh',
            'default_is_billable' => false,
            'phase_hint' => 'CODE',
            'sort_order' => 8,
            'is_active' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.code', 'CODE_IMPL')
            ->assertJsonPath('data.name', 'Lap trinh')
            ->assertJsonPath('data.phase_hint', 'CODE')
            ->assertJsonPath('data.is_active', false);
    }

    public function test_product_unit_masters_can_create_list_and_update_via_api(): void
    {
        $this->setUpProductUnitMasterSchema();

        $createResponse = $this->postJson('/api/v5/product-unit-masters', [
            'unit_code' => 'don vi goi',
            'unit_name' => 'Gói',
            'description' => 'Đơn vị gói cước',
            'is_active' => true,
        ])->assertCreated();

        $unitId = (int) $createResponse->json('data.id');
        $this->assertGreaterThan(0, $unitId);

        DB::table('products')->insert([
            'id' => 1,
            'unit' => 'Gói',
        ]);

        $listResponse = $this->getJson('/api/v5/product-unit-masters?include_inactive=1')
            ->assertOk();

        /** @var Collection<int, array<string, mixed>> $rows */
        $rows = collect($listResponse->json('data'));
        $row = $rows->firstWhere('id', $unitId);
        $this->assertIsArray($row);
        $this->assertSame('DON_VI_GOI', $row['unit_code']);
        $this->assertSame('Gói', $row['unit_name']);
        $this->assertSame(1, $row['used_in_products']);
        $this->assertFalse($row['is_name_editable']);

        $this->putJson("/api/v5/product-unit-masters/{$unitId}", [
            'unit_code' => 'goi_dich_vu',
            'unit_name' => 'Gói',
            'description' => null,
            'is_active' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.unit_code', 'GOI_DICH_VU')
            ->assertJsonPath('data.unit_name', 'Gói')
            ->assertJsonPath('data.is_active', false);

        $this->putJson("/api/v5/product-unit-masters/{$unitId}", [
            'unit_code' => 'goi_dich_vu',
            'unit_name' => 'Gói dịch vụ',
            'description' => null,
            'is_active' => true,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Khong the doi ten don vi tinh da phat sinh san pham.');
    }

    public function test_contract_signer_masters_can_create_list_and_update_via_api(): void
    {
        $this->setUpContractSignerMasterSchema();

        DB::table('departments')->insert([
            ['id' => 100, 'dept_code' => 'BGDVT', 'dept_name' => 'Ban giam doc Vien Thong', 'parent_id' => null, 'deleted_at' => null],
            ['id' => 110, 'dept_code' => 'TTKDGP', 'dept_name' => 'Trung tam Kinh doanh Giai phap', 'parent_id' => 100, 'deleted_at' => null],
            ['id' => 120, 'dept_code' => 'PGP2', 'dept_name' => 'Phong giai phap 2', 'parent_id' => 110, 'deleted_at' => null],
            ['id' => 130, 'dept_code' => 'VNPT_CAIRANG', 'dept_name' => 'VNPT Cai Rang', 'parent_id' => 100, 'deleted_at' => null],
        ]);

        DB::table('internal_users')->insert([
            ['id' => 1, 'user_code' => 'U001', 'full_name' => 'Signer PGP2', 'department_id' => 120, 'deleted_at' => null],
            ['id' => 2, 'user_code' => 'U002', 'full_name' => 'Signer Cai Rang', 'department_id' => 130, 'deleted_at' => null],
            ['id' => 3, 'user_code' => 'U003', 'full_name' => 'No Dept', 'department_id' => null, 'deleted_at' => null],
        ]);

        $createResponse = $this->postJson('/api/v5/contract-signer-masters', [
            'internal_user_id' => 1,
            'is_active' => true,
        ])->assertCreated();

        $masterId = (int) $createResponse->json('data.id');
        $this->assertGreaterThan(0, $masterId);
        $createResponse
            ->assertJsonPath('data.internal_user_id', 1)
            ->assertJsonPath('data.user_code', 'U001')
            ->assertJsonPath('data.department_id', 110)
            ->assertJsonPath('data.dept_code', 'TTKDGP')
            ->assertJsonPath('data.dept_name', 'Trung tam Kinh doanh Giai phap');

        DB::table('contracts')->insert([
            'id' => 901,
            'signer_user_id' => 1,
            'deleted_at' => null,
        ]);

        $this->getJson('/api/v5/contract-signer-masters?include_inactive=1')
            ->assertOk()
            ->assertJsonPath('data.0.internal_user_id', 1)
            ->assertJsonPath('data.0.used_in_contracts', 1);

        $this->putJson("/api/v5/contract-signer-masters/{$masterId}", [
            'internal_user_id' => 2,
            'is_active' => false,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Khong the doi nguoi ky da phat sinh hop dong.');

        $this->putJson("/api/v5/contract-signer-masters/{$masterId}", [
            'internal_user_id' => 1,
            'is_active' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.internal_user_id', 1)
            ->assertJsonPath('data.is_active', false);

        $this->postJson('/api/v5/contract-signer-masters', [
            'internal_user_id' => 3,
            'is_active' => true,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'internal_user_id is invalid or does not belong to a writable ownership department.');

        $this->postJson('/api/v5/contract-signer-masters', [
            'internal_user_id' => 1,
            'is_active' => true,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'internal_user_id has already been taken.');
    }

    private function setUpSupportServiceGroupSchema(): void
    {
        Schema::dropIfExists('customer_requests');
        Schema::dropIfExists('support_service_groups');
        Schema::dropIfExists('workflow_status_catalogs');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_code')->nullable();
            $table->string('customer_name')->nullable();
        });

        Schema::create('workflow_status_catalogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('status_code')->nullable();
            $table->string('status_name')->nullable();
            $table->string('form_key')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
        });

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('group_code')->nullable();
            $table->string('group_name')->nullable();
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('workflow_status_catalog_id')->nullable();
            $table->string('workflow_form_key')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('customer_requests', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('service_group_id')->nullable();
        });
    }

    private function setUpSupportRequestStatusSchema(): void
    {
        Schema::dropIfExists('support_request_history');
        Schema::dropIfExists('support_requests');
        Schema::dropIfExists('support_request_statuses');
        Schema::dropIfExists('internal_users');

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
        });

        Schema::create('support_request_statuses', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('status_code')->nullable();
            $table->string('status_name')->nullable();
            $table->string('description')->nullable();
            $table->boolean('requires_completion_dates')->default(false);
            $table->boolean('is_terminal')->default(false);
            $table->boolean('is_transfer_dev')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('support_requests', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('status')->nullable();
        });

        Schema::create('support_request_history', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('old_status')->nullable();
            $table->string('new_status')->nullable();
        });
    }

    private function setUpWorklogActivityTypeSchema(): void
    {
        Schema::dropIfExists('request_worklogs');
        Schema::dropIfExists('worklog_activity_types');
        Schema::dropIfExists('internal_users');

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
        });

        Schema::create('worklog_activity_types', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('code')->nullable();
            $table->string('name')->nullable();
            $table->string('description')->nullable();
            $table->boolean('default_is_billable')->default(true);
            $table->string('phase_hint')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('request_worklogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('activity_type_id')->nullable();
        });
    }

    private function setUpProductUnitMasterSchema(): void
    {
        Schema::dropIfExists('products');
        Schema::dropIfExists('product_unit_masters');
        Schema::dropIfExists('internal_users');

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
        });

        Schema::create('product_unit_masters', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('unit_code')->nullable();
            $table->string('unit_name')->nullable();
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('products', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('unit')->nullable();
        });
    }

    private function setUpContractSignerMasterSchema(): void
    {
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('contract_signer_masters');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('internal_users');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code')->nullable();
            $table->string('dept_name')->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code')->nullable();
            $table->string('full_name')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('contract_signer_masters', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('internal_user_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('signer_user_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });
    }
}
