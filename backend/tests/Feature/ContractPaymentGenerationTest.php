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

    public function test_it_uses_contract_project_type_fallback_for_initial_rental_contracts(): void
    {
        $contractId = $this->insertContract([
            'id' => 207,
            'project_id' => null,
            'project_type_code' => 'THUE_DICH_VU_COSAN',
            'effective_date' => '2026-01-31',
            'sign_date' => '2026-01-31',
            'expiry_date' => '2026-03-31',
            'payment_cycle' => 'MONTHLY',
            'value' => 90000000,
            'total_value' => 90000000,
        ]);

        $this->postJson("/api/v5/contracts/{$contractId}/generate-payments")
            ->assertOk()
            ->assertJsonPath('meta.allocation_mode', 'EVEN')
            ->assertJsonPath('meta.generated_count', 3)
            ->assertJsonPath('data.0.milestone_name', 'Phí dịch vụ kỳ 1 (tháng)')
            ->assertJsonPath('data.1.milestone_name', 'Phí dịch vụ kỳ 2 (tháng)')
            ->assertJsonPath('data.2.expected_date', '2026-03-31');
    }

    public function test_it_generates_even_payment_schedules_from_custom_draft_installments(): void
    {
        $contractId = $this->insertContract([
            'id' => 212,
            'project_id' => null,
            'project_type_code' => 'THUE_DICH_VU_DACTHU',
            'effective_date' => '2026-04-11',
            'sign_date' => '2026-04-11',
            'expiry_date' => '2027-01-11',
            'payment_cycle' => 'QUARTERLY',
            'value' => 18000000,
            'total_value' => 18000000,
        ]);

        $this->postJson("/api/v5/contracts/{$contractId}/generate-payments", [
            'allocation_mode' => 'EVEN',
            'draft_installments' => [
                [
                    'label' => 'Kỳ mở đầu',
                    'expected_date' => '2026-04-11',
                    'expected_start_date' => '2026-04-11',
                    'expected_end_date' => '2026-07-14',
                    'expected_amount' => 4000000,
                ],
                [
                    'label' => 'Kỳ tăng tốc',
                    'expected_date' => '2026-07-15',
                    'expected_start_date' => '2026-07-15',
                    'expected_end_date' => '2026-10-14',
                    'expected_amount' => 5000000,
                ],
                [
                    'label' => 'Kỳ vận hành',
                    'expected_date' => '2026-10-15',
                    'expected_start_date' => '2026-10-15',
                    'expected_end_date' => '2027-01-10',
                    'expected_amount' => 4000000,
                ],
                [
                    'label' => 'Kỳ kết thúc',
                    'expected_date' => '2027-01-11',
                    'expected_start_date' => '2027-01-11',
                    'expected_end_date' => '2027-01-11',
                    'expected_amount' => 5000000,
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('meta.allocation_mode', 'EVEN')
            ->assertJsonPath('meta.generated_count', 4)
            ->assertJsonPath('data.0.milestone_name', 'Kỳ mở đầu')
            ->assertJsonPath('data.0.expected_date', '2026-04-11')
            ->assertJsonPath('data.0.expected_start_date', '2026-04-11')
            ->assertJsonPath('data.0.expected_end_date', '2026-07-14')
            ->assertJsonPath('data.0.expected_amount', 4000000)
            ->assertJsonPath('data.1.milestone_name', 'Kỳ tăng tốc')
            ->assertJsonPath('data.1.expected_date', '2026-07-15')
            ->assertJsonPath('data.1.expected_start_date', '2026-07-15')
            ->assertJsonPath('data.1.expected_end_date', '2026-10-14')
            ->assertJsonPath('data.1.expected_amount', 5000000)
            ->assertJsonPath('data.3.milestone_name', 'Kỳ kết thúc')
            ->assertJsonPath('data.3.expected_date', '2027-01-11')
            ->assertJsonPath('data.3.expected_start_date', '2027-01-11')
            ->assertJsonPath('data.3.expected_end_date', '2027-01-11')
            ->assertJsonPath('data.3.expected_amount', 5000000);

        $storedRows = DB::table('payment_schedules')
            ->where('contract_id', $contractId)
            ->orderBy('cycle_number')
            ->get(['milestone_name', 'expected_date', 'expected_start_date', 'expected_end_date', 'expected_amount'])
            ->map(fn (object $row): array => [
                'milestone_name' => $row->milestone_name,
                'expected_date' => $row->expected_date,
                'expected_start_date' => $row->expected_start_date,
                'expected_end_date' => $row->expected_end_date,
                'expected_amount' => (float) $row->expected_amount,
            ])
            ->all();

        $this->assertSame([
            [
                'milestone_name' => 'Kỳ mở đầu',
                'expected_date' => '2026-04-11',
                'expected_start_date' => '2026-04-11',
                'expected_end_date' => '2026-07-14',
                'expected_amount' => 4000000.0,
            ],
            [
                'milestone_name' => 'Kỳ tăng tốc',
                'expected_date' => '2026-07-15',
                'expected_start_date' => '2026-07-15',
                'expected_end_date' => '2026-10-14',
                'expected_amount' => 5000000.0,
            ],
            [
                'milestone_name' => 'Kỳ vận hành',
                'expected_date' => '2026-10-15',
                'expected_start_date' => '2026-10-15',
                'expected_end_date' => '2027-01-10',
                'expected_amount' => 4000000.0,
            ],
            [
                'milestone_name' => 'Kỳ kết thúc',
                'expected_date' => '2027-01-11',
                'expected_start_date' => '2027-01-11',
                'expected_end_date' => '2027-01-11',
                'expected_amount' => 5000000.0,
            ],
        ], $storedRows);
    }

    public function test_it_rejects_even_custom_draft_when_total_does_not_match_contract_value(): void
    {
        $contractId = $this->insertContract([
            'id' => 213,
            'project_id' => null,
            'project_type_code' => 'THUE_DICH_VU_DACTHU',
            'effective_date' => '2026-04-11',
            'sign_date' => '2026-04-11',
            'expiry_date' => '2027-01-11',
            'payment_cycle' => 'QUARTERLY',
            'value' => 18000000,
            'total_value' => 18000000,
        ]);

        $this->postJson("/api/v5/contracts/{$contractId}/generate-payments", [
            'allocation_mode' => 'EVEN',
            'draft_installments' => [
                [
                    'label' => 'Kỳ 1',
                    'expected_date' => '2026-04-11',
                    'expected_amount' => 8000000,
                ],
                [
                    'label' => 'Kỳ 2',
                    'expected_date' => '2026-07-11',
                    'expected_amount' => 8000000,
                ],
            ],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['draft_installments'])
            ->assertJsonPath(
                'errors.draft_installments.0',
                'Tổng số tiền dự thảo phải bằng giá trị hợp đồng trước khi sinh kỳ thanh toán.'
            );

        $this->assertDatabaseMissing('payment_schedules', [
            'contract_id' => $contractId,
        ]);
    }

    public function test_it_uses_contract_project_type_fallback_for_initial_investment_contracts(): void
    {
        $contractId = $this->insertContract([
            'id' => 208,
            'project_id' => null,
            'project_type_code' => 'DAU_TU',
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
            ->assertJsonPath('data.0.milestone_name', 'Tạm ứng')
            ->assertJsonPath('data.4.milestone_name', 'Quyết toán');
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

    public function test_it_deletes_an_unpaid_payment_schedule(): void
    {
        $contractId = $this->insertContract([
            'id' => 210,
            'value' => 18000000,
            'total_value' => 18000000,
        ]);

        DB::table('payment_schedules')->insert([
            'id' => 9101,
            'contract_id' => $contractId,
            'project_id' => 1,
            'milestone_name' => 'Ky 1',
            'cycle_number' => 1,
            'expected_date' => '2026-01-15',
            'expected_amount' => 18000000,
            'actual_paid_date' => null,
            'actual_paid_amount' => 0,
            'status' => 'PENDING',
            'notes' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->deleteJson('/api/v5/payment-schedules/9101')
            ->assertOk()
            ->assertJsonPath('message', 'Đã xóa kỳ thanh toán.');

        $this->assertDatabaseMissing('payment_schedules', [
            'id' => 9101,
        ]);
    }

    public function test_it_rejects_deleting_a_payment_schedule_that_has_collected_money(): void
    {
        $contractId = $this->insertContract([
            'id' => 211,
            'value' => 18000000,
            'total_value' => 18000000,
        ]);

        DB::table('payment_schedules')->insert([
            'id' => 9102,
            'contract_id' => $contractId,
            'project_id' => 1,
            'milestone_name' => 'Ky 1',
            'cycle_number' => 1,
            'expected_date' => '2026-01-15',
            'expected_amount' => 18000000,
            'actual_paid_date' => '2026-01-20',
            'actual_paid_amount' => 5000000,
            'status' => 'PARTIAL',
            'notes' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->deleteJson('/api/v5/payment-schedules/9102')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Không thể xóa kỳ thanh toán đã phát sinh thu tiền thực tế.');

        $this->assertDatabaseHas('payment_schedules', [
            'id' => 9102,
        ]);
    }

    private function insertContract(array $overrides = []): int
    {
        $payload = array_merge([
            'id' => 100,
            'contract_code' => 'HD-PAY-001',
            'contract_name' => 'Hop dong thanh toan',
            'project_id' => 1,
            'customer_id' => 1,
            'project_type_code' => null,
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
            $table->string('project_type_code', 100)->nullable();
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
            $table->date('expected_start_date')->nullable();
            $table->date('expected_end_date')->nullable();
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
