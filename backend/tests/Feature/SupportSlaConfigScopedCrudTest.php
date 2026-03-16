<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SupportSlaConfigScopedCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_creates_and_lists_scoped_sla_config_via_api(): void
    {
        $this->postJson('/api/v5/support-sla-configs', [
            'status' => 'DA_DUYET',
            'sub_status' => null,
            'priority' => 'HIGH',
            'sla_hours' => 6,
            'request_type_prefix' => 'REQDEV',
            'service_group_id' => 2,
            'workflow_action_code' => 'APPROVE',
            'description' => 'Rule SLA theo nhóm và action',
            'sort_order' => 15,
            'is_active' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'DA_DUYET')
            ->assertJsonPath('data.service_group_id', 2)
            ->assertJsonPath('data.service_group_name', 'DMS')
            ->assertJsonPath('data.workflow_action_code', 'APPROVE');

        $this->getJson('/api/v5/support-sla-configs')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.service_group_name', 'DMS')
            ->assertJsonPath('data.0.workflow_action_code', 'APPROVE');
    }

    public function test_it_updates_scoped_sla_config_via_api(): void
    {
        DB::table('sla_configs')->insert([
            'id' => 10,
            'status' => 'DA_DUYET',
            'sub_status' => null,
            'priority' => 'MEDIUM',
            'sla_hours' => 12,
            'request_type_prefix' => null,
            'service_group_id' => 1,
            'workflow_action_code' => null,
            'description' => 'Rule gốc',
            'is_active' => 1,
            'sort_order' => 5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->putJson('/api/v5/support-sla-configs/10', [
            'status' => 'DA_DUYET',
            'sub_status' => null,
            'priority' => 'MEDIUM',
            'sla_hours' => 4,
            'service_group_id' => 2,
            'workflow_action_code' => 'APPROVE',
            'description' => 'Rule sau khi cập nhật',
            'is_active' => false,
            'sort_order' => 20,
        ])
            ->assertOk()
            ->assertJsonPath('data.sla_hours', 4)
            ->assertJsonPath('data.service_group_id', 2)
            ->assertJsonPath('data.service_group_name', 'DMS')
            ->assertJsonPath('data.workflow_action_code', 'APPROVE')
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.sort_order', 20);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('sla_configs');
        Schema::dropIfExists('support_service_groups');

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('group_name', 255)->nullable();
        });

        Schema::create('sla_configs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('status', 50);
            $table->string('sub_status', 50)->nullable();
            $table->string('priority', 20);
            $table->decimal('sla_hours', 6, 2)->nullable();
            $table->string('request_type_prefix', 20)->nullable();
            $table->unsignedBigInteger('service_group_id')->nullable();
            $table->string('workflow_action_code', 80)->nullable();
            $table->string('description', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        DB::table('support_service_groups')->insert([
            ['id' => 1, 'group_name' => 'EMR'],
            ['id' => 2, 'group_name' => 'DMS'],
        ]);
    }
}
