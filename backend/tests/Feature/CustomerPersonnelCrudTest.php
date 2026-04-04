<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerPersonnelCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_creates_lists_updates_and_deletes_customer_personnel_via_api(): void
    {
        $createResponse = $this->postJson('/api/v5/customer-personnel', [
            'customer_id' => 1,
            'full_name' => 'Nguyen Van A',
            'date_of_birth' => '1995-03-10',
            'phone' => '0909000001',
            'email' => 'a@example.com',
            'status' => 'ACTIVE',
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.id', '1')
            ->assertJsonPath('data.fullName', 'Nguyen Van A')
            ->assertJsonPath('data.positionType', 'DAU_MOI')
            ->assertJsonPath('data.positionLabel', 'Đầu mối')
            ->assertJsonPath('data.customerId', '1')
            ->assertJsonPath('data.status', 'Active');

        $aliasListResponse = $this->getJson('/api/v5/customer_personnel?customer_id=1');

        $aliasListResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.fullName', 'Nguyen Van A');

        $updateResponse = $this->putJson('/api/v5/cus-personnel/1', [
            'full_name' => 'Nguyen Van B',
            'position_type' => 'Phụ trách',
            'status' => 'Inactive',
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.fullName', 'Nguyen Van B')
            ->assertJsonPath('data.positionType', 'PHU_TRACH')
            ->assertJsonPath('data.positionLabel', 'Phụ trách')
            ->assertJsonPath('data.status', 'Inactive');

        $deleteResponse = $this->deleteJson('/api/v5/cus_personnel/1');

        $deleteResponse
            ->assertOk()
            ->assertJsonPath('message', 'Customer personnel deleted.');

        $finalListResponse = $this->getJson('/api/v5/customer-personnel');
        $finalListResponse
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_it_bulk_creates_customer_personnel_via_api(): void
    {
        $response = $this->postJson('/api/v5/customer-personnel/bulk', [
            'items' => [
                [
                    'customer_id' => 1,
                    'full_name' => 'Nguyen Van C',
                    'position_type' => 'DAU_MOI',
                    'position_id' => 1,
                    'phone' => '0909000002',
                    'email' => 'c@example.com',
                    'status' => 'ACTIVE',
                ],
                [
                    'customer_id' => 1,
                    'full_name' => 'Nguyen Van D',
                    'position_type' => 'PHU_TRACH',
                    'position_id' => 2,
                    'phone' => '0909000003',
                    'email' => 'd@example.com',
                    'status' => 'INACTIVE',
                ],
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.created_count', 2)
            ->assertJsonPath('data.failed_count', 0)
            ->assertJsonCount(2, 'data.created')
            ->assertJsonPath('data.results.0.success', true)
            ->assertJsonPath('data.results.1.success', true);

        $listResponse = $this->getJson('/api/v5/customer-personnel');
        $listResponse
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('customer_personnel');
        Schema::dropIfExists('support_contact_positions');
        Schema::dropIfExists('customers');

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_name')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('support_contact_positions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('position_code', 50);
            $table->string('position_name', 120);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('customer_personnel', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('customer_id');
            $table->string('full_name', 255);
            $table->date('date_of_birth')->nullable();
            $table->unsignedBigInteger('position_id')->nullable();
            $table->string('position_type', 50)->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('status', 20)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        DB::table('customers')->insert([
            'id' => 1,
            'customer_name' => 'Khách hàng A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('support_contact_positions')->insert([
            [
                'id' => 1,
                'position_code' => 'DAU_MOI',
                'position_name' => 'Đầu mối',
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'position_code' => 'PHU_TRACH',
                'position_name' => 'Phụ trách',
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
