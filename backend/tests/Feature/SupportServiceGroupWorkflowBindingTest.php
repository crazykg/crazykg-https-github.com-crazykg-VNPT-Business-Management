<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SupportServiceGroupWorkflowBindingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_support_service_group_can_store_and_list_workflow_binding(): void
    {
        $createResponse = $this->postJson('/api/v5/support-service-groups', [
            'customer_id' => 1,
            'group_code' => 'EMR_HIS',
            'group_name' => 'EMR-HIS',
            'description' => 'Danh mục hỗ trợ EMR/HIS',
            'workflow_status_catalog_id' => 2,
            'workflow_form_key' => 'customer.request.emr',
            'is_active' => true,
            'created_by' => 10,
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.workflow_status_catalog_id', 2)
            ->assertJsonPath('data.workflow_status_code', 'PHAN_TICH')
            ->assertJsonPath('data.workflow_status_name', 'Phân tích')
            ->assertJsonPath('data.workflow_form_key', 'customer.request.emr');

        $this->getJson('/api/v5/support-service-groups?include_inactive=1')
            ->assertOk()
            ->assertJsonPath('data.0.workflow_status_catalog_id', 2)
            ->assertJsonPath('data.0.workflow_status_name', 'Phân tích')
            ->assertJsonPath('data.0.workflow_form_key', 'customer.request.emr');
    }

    public function test_support_service_group_can_clear_workflow_binding_on_update(): void
    {
        $this->postJson('/api/v5/support-service-groups', [
            'customer_id' => 1,
            'group_code' => 'EMR_HIS',
            'group_name' => 'EMR-HIS',
            'workflow_status_catalog_id' => 2,
            'workflow_form_key' => 'customer.request.emr',
            'is_active' => true,
            'created_by' => 10,
        ])->assertCreated();

        $this->putJson('/api/v5/support-service-groups/1', [
            'customer_id' => 1,
            'group_code' => 'EMR_HIS',
            'group_name' => 'EMR-HIS',
            'workflow_status_catalog_id' => null,
            'workflow_form_key' => null,
            'is_active' => true,
            'updated_by' => 10,
        ])
            ->assertOk()
            ->assertJsonPath('data.workflow_status_catalog_id', null)
            ->assertJsonPath('data.workflow_status_name', null)
            ->assertJsonPath('data.workflow_form_key', null);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('support_service_groups');
        Schema::dropIfExists('workflow_status_catalogs');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_code', 50)->nullable();
            $table->string('customer_name', 255)->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('full_name', 255)->nullable();
        });

        Schema::create('workflow_status_catalogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('status_code', 80);
            $table->string('status_name', 150);
            $table->string('form_key', 120)->nullable();
        });

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('group_code', 50)->nullable();
            $table->string('group_name', 100);
            $table->string('description', 255)->nullable();
            $table->unsignedBigInteger('workflow_status_catalog_id')->nullable();
            $table->string('workflow_form_key', 120)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        \Illuminate\Support\Facades\DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'KH001',
            'customer_name' => 'Bệnh viện Sản - Nhi Hậu Giang',
        ]);

        \Illuminate\Support\Facades\DB::table('internal_users')->insert([
            'id' => 10,
            'full_name' => 'Phan Văn Rở',
        ]);

        \Illuminate\Support\Facades\DB::table('workflow_status_catalogs')->insert([
            'id' => 2,
            'status_code' => 'PHAN_TICH',
            'status_name' => 'Phân tích',
            'form_key' => 'programming.phan_tich',
        ]);
    }
}
