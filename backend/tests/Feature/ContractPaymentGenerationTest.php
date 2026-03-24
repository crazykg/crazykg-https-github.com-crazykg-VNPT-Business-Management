<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ContractPaymentGenerationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    public function test_it_generates_monthly_payment_dates_using_the_original_start_date_anchor(): void
    {
        $contractId = $this->insertContract([
            'id' => 200,
            'project_id' => 1,
            'effective_date' => '2026-01-31',
            'sign_date' => '2026-01-31',
            'expiry_date' => '2026-04-30',
            'payment_cycle' => 'MONTHLY',
            'value' => 100000000,
            'total_value' => 100000000,
        ]);

        $response = $this->postJson("/api/v5/contracts/{$contractId}/generate-payments");

        $response
            ->assertOk()
            ->assertJsonPath('meta.generation_mode', 'backend')
            ->assertJsonPath('meta.generated_count', 4)
            ->assertJsonCount(4, 'generated_data')
            ->assertJsonPath('generated_data.0.expected_date', '2026-01-31')
            ->assertJsonPath('generated_data.3.expected_date', '2026-04-30')
            ->assertJsonPath('data.0.expected_date', '2026-01-31')
            ->assertJsonPath('data.1.expected_date', '2026-02-28')
            ->assertJsonPath('data.2.expected_date', '2026-03-31')
            ->assertJsonPath('data.3.expected_date', '2026-04-30')
            ->assertJsonPath('data.0.milestone_name', 'Phí dịch vụ kỳ 1 (tháng)')
            ->assertJsonPath('data.3.expected_amount', 25000000);

        $storedDates = DB::table('payment_schedules')
            ->where('contract_id', $contractId)
            ->orderBy('cycle_number')
            ->pluck('expected_date')
            ->all();

        $this->assertSame(
            ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
            $storedDates
        );
    }

    public function test_it_rejects_generation_when_start_date_cannot_be_resolved(): void
    {
        $contractId = $this->insertContract([
            'id' => 201,
            'project_id' => 1,
            'effective_date' => null,
            'sign_date' => null,
            'expiry_date' => '2026-12-31',
            'payment_cycle' => 'MONTHLY',
            'total_value' => 120000000,
        ]);

        $this->postJson("/api/v5/contracts/{$contractId}/generate-payments")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['effective_date'])
            ->assertJsonPath(
                'errors.effective_date.0',
                'Không xác định được mốc bắt đầu hợp đồng để sinh kỳ thanh toán.'
            );
    }

    public function test_it_defaults_to_milestone_generation_for_investment_projects(): void
    {
        $contractId = $this->insertContract([
            'id' => 204,
            'project_id' => 2,
            'effective_date' => '2026-01-15',
            'sign_date' => '2026-01-15',
            'expiry_date' => '2026-12-31',
            'payment_cycle' => 'ONCE',
            'value' => 150000000,
            'total_value' => 150000000,
        ]);

        $this->postJson("/api/v5/contracts/{$contractId}/generate-payments", [
            'advance_percentage' => 15,
            'retention_percentage' => 5,
            'installment_count' => 3,
        ])
            ->assertOk()
            ->assertJsonPath('meta.allocation_mode', 'MILESTONE')
            ->assertJsonPath('meta.generated_count', 5)
            ->assertJsonCount(5, 'generated_data')
            ->assertJsonPath('data.0.milestone_name', 'Tạm ứng')
            ->assertJsonPath('data.0.expected_date', '2026-01-15')
            ->assertJsonPath('data.0.expected_amount', 22500000)
            ->assertJsonPath('data.1.milestone_name', 'Thanh toán đợt 1')
            ->assertJsonPath('data.1.expected_date', '2026-04-01')
            ->assertJsonPath('data.1.expected_amount', 40000000)
            ->assertJsonPath('data.2.expected_date', '2026-07-01')
            ->assertJsonPath('data.3.expected_date', '2026-10-01')
            ->assertJsonPath('data.4.milestone_name', 'Quyết toán')
            ->assertJsonPath('data.4.expected_date', '2026-12-31')
            ->assertJsonPath('data.4.expected_amount', 7500000);
    }

    public function test_it_uses_contract_items_total_as_generation_amount_when_snapshot_exists(): void
    {
        $contractId = $this->insertContract([
            'id' => 205,
            'project_id' => 1,
            'effective_date' => '2026-03-23',
            'sign_date' => '2026-03-23',
            'expiry_date' => '2026-03-23',
            'payment_cycle' => 'ONCE',
            'value' => 150000000,
            'total_value' => 150000000,
        ]);

        DB::table('contract_items')->insert([
            [
                'contract_id' => $contractId,
                'product_id' => 1,
                'quantity' => 1,
                'unit_price' => 150000000,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'contract_id' => $contractId,
                'product_id' => 2,
                'quantity' => 559,
                'unit_price' => 550000,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'contract_id' => $contractId,
                'product_id' => 3,
                'quantity' => 10,
                'unit_price' => 100000000,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'contract_id' => $contractId,
                'product_id' => 4,
                'quantity' => 30,
                'unit_price' => 100000000,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->postJson("/api/v5/contracts/{$contractId}/generate-payments")
            ->assertOk()
            ->assertJsonPath('meta.generated_count', 1)
            ->assertJsonPath('data.0.expected_amount', 4457450000);
    }

    public function test_it_generates_custom_milestone_installments_using_payload_definitions(): void
    {
        $contractId = $this->insertContract([
            'id' => 206,
            'project_id' => 2,
            'effective_date' => '2026-01-15',
            'sign_date' => '2026-01-15',
            'expiry_date' => '2026-12-31',
            'payment_cycle' => 'ONCE',
            'value' => 150000000,
            'total_value' => 150000000,
        ]);

        $this->postJson("/api/v5/contracts/{$contractId}/generate-payments", [
            'allocation_mode' => 'MILESTONE',
            'advance_percentage' => 10,
            'retention_percentage' => 5,
            'installments' => [
                [
                    'label' => 'Nghiệm thu giai đoạn 1',
                    'percentage' => 35,
                    'expected_date' => '2026-04-15',
                ],
                [
                    'label' => 'Nghiệm thu giai đoạn 2',
                    'percentage' => 30,
                ],
                [
                    'label' => 'Nghiệm thu giai đoạn 3',
                    'percentage' => 20,
                    'expected_date' => '2026-10-15',
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('meta.allocation_mode', 'MILESTONE')
            ->assertJsonPath('meta.generated_count', 5)
            ->assertJsonCount(5, 'generated_data')
            ->assertJsonPath('data.0.milestone_name', 'Tạm ứng')
            ->assertJsonPath('data.0.expected_date', '2026-01-15')
            ->assertJsonPath('data.0.expected_amount', 15000000)
            ->assertJsonPath('data.1.milestone_name', 'Nghiệm thu giai đoạn 1')
            ->assertJsonPath('data.1.expected_date', '2026-04-15')
            ->assertJsonPath('data.1.expected_amount', 52500000)
            ->assertJsonPath('data.2.milestone_name', 'Nghiệm thu giai đoạn 2')
            ->assertJsonPath('data.2.expected_date', '2026-07-01')
            ->assertJsonPath('data.2.expected_amount', 45000000)
            ->assertJsonPath('data.3.milestone_name', 'Nghiệm thu giai đoạn 3')
            ->assertJsonPath('data.3.expected_date', '2026-10-15')
            ->assertJsonPath('data.3.expected_amount', 30000000)
            ->assertJsonPath('data.4.milestone_name', 'Quyết toán')
            ->assertJsonPath('data.4.expected_date', '2026-12-31')
            ->assertJsonPath('data.4.expected_amount', 7500000);
    }

    public function test_it_rejects_regeneration_when_paid_rows_already_exist(): void
    {
        $contractId = $this->insertContract([
            'id' => 202,
            'project_id' => 1,
            'effective_date' => '2026-01-15',
            'sign_date' => '2026-01-15',
            'expiry_date' => '2026-04-15',
            'payment_cycle' => 'MONTHLY',
            'total_value' => 120000000,
        ]);

        DB::table('payment_schedules')->insert([
            [
                'id' => 1,
                'contract_id' => $contractId,
                'project_id' => 1,
                'milestone_name' => 'Thanh toán kỳ 1 (tháng)',
                'cycle_number' => 1,
                'expected_date' => '2026-01-15',
                'expected_amount' => 30000000,
                'actual_paid_date' => '2026-01-20',
                'actual_paid_amount' => 30000000,
                'status' => 'PAID',
                'notes' => 'Giữ nguyên',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'contract_id' => $contractId,
                'project_id' => 1,
                'milestone_name' => 'Thanh toán kỳ 2 (tháng)',
                'cycle_number' => 2,
                'expected_date' => '2026-02-15',
                'expected_amount' => 30000000,
                'actual_paid_date' => '2026-02-18',
                'actual_paid_amount' => 10000000,
                'status' => 'PARTIAL',
                'notes' => 'Thu một phần',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'contract_id' => $contractId,
                'project_id' => 1,
                'milestone_name' => 'Kỳ cũ 3',
                'cycle_number' => 3,
                'expected_date' => '2026-03-10',
                'expected_amount' => 1000,
                'actual_paid_date' => null,
                'actual_paid_amount' => 0,
                'status' => 'PENDING',
                'notes' => 'Sẽ bị thay',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 4,
                'contract_id' => $contractId,
                'project_id' => 1,
                'milestone_name' => 'Kỳ cũ 4',
                'cycle_number' => 4,
                'expected_date' => '2026-04-10',
                'expected_amount' => 1000,
                'actual_paid_date' => null,
                'actual_paid_amount' => 0,
                'status' => 'PENDING',
                'notes' => 'Sẽ bị thay',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->postJson("/api/v5/contracts/{$contractId}/generate-payments")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['payment_schedules'])
            ->assertJsonPath(
                'errors.payment_schedules.0',
                'Không thể sinh lại kỳ thanh toán vì hợp đồng đã có kỳ thu tiền thực tế.'
            );

        $storedRows = DB::table('payment_schedules')
            ->where('contract_id', $contractId)
            ->orderBy('cycle_number')
            ->get();

        $this->assertCount(4, $storedRows);
        $this->assertSame('PAID', $storedRows[0]->status);
        $this->assertSame('PARTIAL', $storedRows[1]->status);
        $this->assertSame('2026-01-15', $storedRows[0]->expected_date);
        $this->assertSame('2026-02-15', $storedRows[1]->expected_date);
        $this->assertSame('2026-03-10', $storedRows[2]->expected_date);
        $this->assertSame('2026-04-10', $storedRows[3]->expected_date);
    }

    private function insertContract(array $overrides = []): int
    {
        $payload = array_merge([
            'id' => 100,
            'contract_code' => 'HD-PAY-001',
            'contract_name' => 'Hop dong thanh toan',
            'project_id' => 1,
            'customer_id' => 1,
            'sign_date' => '2026-01-15',
            'effective_date' => '2026-01-15',
            'expiry_date' => '2026-04-15',
            'value' => 120000000,
            'total_value' => 120000000,
            'payment_cycle' => 'MONTHLY',
            'status' => 'DRAFT',
            'dept_id' => 10,
            'term_unit' => null,
            'term_value' => null,
            'expiry_date_manual_override' => 0,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ], $overrides);

        DB::table('contracts')->insert($payload);

        return (int) $payload['id'];
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('payment_schedules');
        Schema::dropIfExists('contract_items');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('departments');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('password')->nullable();
            $table->rememberToken();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('contract_code', 100)->nullable();
            $table->string('contract_name', 255)->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->date('sign_date')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->decimal('value', 18, 2)->default(0);
            $table->decimal('total_value', 18, 2)->default(0);
            $table->string('payment_cycle', 32)->nullable();
            $table->string('status', 32)->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->string('term_unit', 10)->nullable();
            $table->decimal('term_value', 10, 2)->nullable();
            $table->boolean('expiry_date_manual_override')->default(false);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('contract_items', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('product_id');
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_code', 50)->nullable();
            $table->string('project_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('investment_mode', 100)->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('payment_schedules', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('milestone_name', 255)->nullable();
            $table->unsignedInteger('cycle_number');
            $table->date('expected_date')->nullable();
            $table->decimal('expected_amount', 18, 2)->default(0);
            $table->date('actual_paid_date')->nullable();
            $table->decimal('actual_paid_amount', 18, 2)->default(0);
            $table->string('status', 32)->default('PENDING');
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        DB::table('departments')->insert([
            'id' => 10,
            'dept_code' => 'P10',
            'dept_name' => 'Phong giai phap 10',
            'parent_id' => null,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 1,
            'user_code' => 'U001',
            'username' => 'tester',
            'full_name' => 'Tester',
            'department_id' => 10,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('projects')->insert([
            [
                'id' => 1,
                'project_code' => 'DA-THUE-001',
                'project_name' => 'Du an thue dich vu',
                'customer_id' => 1,
                'investment_mode' => 'THUE_DICH_VU_DACTHU',
                'deleted_at' => null,
            ],
            [
                'id' => 2,
                'project_code' => 'DA-DT-001',
                'project_name' => 'Du an dau tu',
                'customer_id' => 1,
                'investment_mode' => 'DAU_TU',
                'deleted_at' => null,
            ],
        ]);
    }
}
