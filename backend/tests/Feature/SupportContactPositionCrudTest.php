<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SupportContactPositionCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_creates_lists_and_updates_support_contact_positions_via_api(): void
    {
        $createResponse = $this->postJson('/api/v5/support-contact-positions', [
            'position_code' => 'Đầu mối',
            'position_name' => 'Đầu mối khách hàng',
            'description' => 'Liên hệ chính',
            'is_active' => true,
            'created_by' => 1,
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.position_code', 'DAU_MOI')
            ->assertJsonPath('data.position_name', 'Đầu mối khách hàng')
            ->assertJsonPath('data.used_in_customer_personnel', 0)
            ->assertJsonPath('data.is_code_editable', true);

        DB::table('customer_personnel')->insert([
            'id' => 10,
            'position_id' => 1,
            'full_name' => 'Nguyen Van A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $listResponse = $this->getJson('/api/v5/support-contact-positions?include_inactive=1');

        $listResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.position_code', 'DAU_MOI')
            ->assertJsonPath('data.0.used_in_customer_personnel', 1)
            ->assertJsonPath('data.0.is_code_editable', false);

        $updateResponse = $this->putJson('/api/v5/support-contact-positions/1', [
            'position_code' => 'Đầu mối VIP',
            'position_name' => 'Đầu mối cao cấp',
            'description' => null,
            'is_active' => false,
            'updated_by' => 2,
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.position_code', 'DAU_MOI_VIP')
            ->assertJsonPath('data.position_name', 'Đầu mối cao cấp')
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.updated_by', 2);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('customer_personnel');
        Schema::dropIfExists('support_contact_positions');
        Schema::dropIfExists('internal_users');

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('full_name')->nullable();
            $table->timestamps();
        });

        Schema::create('support_contact_positions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('position_code', 50);
            $table->string('position_name', 120);
            $table->string('description', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('customer_personnel', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('position_id')->nullable();
            $table->string('full_name')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        DB::table('internal_users')->insert([
            ['id' => 1, 'full_name' => 'Tester One', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'full_name' => 'Tester Two', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
