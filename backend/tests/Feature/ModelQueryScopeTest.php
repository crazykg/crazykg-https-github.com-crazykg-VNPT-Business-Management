<?php

namespace Tests\Feature;

use App\Models\Contract;
use App\Models\CustomerRequestCase;
use App\Models\Invoice;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModelQueryScopeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
        $this->seedFixtures();
    }

    public function test_invoice_scopes_filter_expected_records(): void
    {
        $this->assertSame([1], Invoice::query()->overdue()->pluck('id')->all());
        $this->assertSame([2], Invoice::query()->byStatus('PAID')->pluck('id')->all());
        $this->assertSame([1, 2], Invoice::query()->byPeriod('2026-03-01', '2026-03-31')->pluck('id')->all());
        $this->assertSame([1, 2], Invoice::query()->byCustomer(10)->pluck('id')->all());
        $this->assertSame([1], Invoice::query()->byContract(100)->pluck('id')->all());
    }

    public function test_contract_scopes_filter_expected_records(): void
    {
        $this->assertSame([100, 101], Contract::query()->active()->pluck('id')->all());
        $this->assertSame([100], Contract::query()->expiring(30)->pluck('id')->all());
        $this->assertSame([100, 102], Contract::query()->byDepartment(5)->pluck('id')->all());
    }

    public function test_customer_request_case_scopes_filter_expected_records(): void
    {
        $this->assertSame([200], CustomerRequestCase::query()->byStatus('analysis')->pluck('id')->all());
        $this->assertSame([200, 202], CustomerRequestCase::query()->byPerformer(9)->pluck('id')->all());
        $this->assertSame([200, 201], CustomerRequestCase::query()->byDispatcher(7)->pluck('id')->all());
        $this->assertSame([200, 201], CustomerRequestCase::query()->byProject(300)->pluck('id')->all());
        $this->assertSame([200, 201], CustomerRequestCase::query()->inGroup('analysis')->pluck('id')->all());
        $this->assertSame([200, 201], CustomerRequestCase::query()->overdue()->pluck('id')->all());
    }

    private function setUpSchema(): void
    {
        Schema::create('invoices', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('contract_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->date('invoice_date')->nullable();
            $table->date('due_date')->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->string('status')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('status')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('customer_request_cases', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('dispatcher_user_id')->nullable();
            $table->unsignedBigInteger('performer_user_id')->nullable();
            $table->string('current_status_code')->nullable();
            $table->dateTime('sla_due_date')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    private function seedFixtures(): void
    {
        DB::table('invoices')->insert([
            [
                'id' => 1,
                'contract_id' => 100,
                'customer_id' => 10,
                'project_id' => 300,
                'invoice_date' => '2026-03-10',
                'due_date' => now()->subDays(5)->toDateString(),
                'total_amount' => 1000,
                'paid_amount' => 100,
                'status' => 'ISSUED',
            ],
            [
                'id' => 2,
                'contract_id' => 101,
                'customer_id' => 10,
                'project_id' => 301,
                'invoice_date' => '2026-03-20',
                'due_date' => now()->subDays(2)->toDateString(),
                'total_amount' => 500,
                'paid_amount' => 500,
                'status' => 'PAID',
            ],
            [
                'id' => 3,
                'contract_id' => 102,
                'customer_id' => 11,
                'project_id' => 302,
                'invoice_date' => '2026-04-02',
                'due_date' => now()->addDays(3)->toDateString(),
                'total_amount' => 700,
                'paid_amount' => 0,
                'status' => 'DRAFT',
            ],
        ]);

        DB::table('contracts')->insert([
            ['id' => 100, 'customer_id' => 10, 'project_id' => 300, 'dept_id' => 5, 'expiry_date' => now()->addDays(10)->toDateString(), 'status' => 'SIGNED'],
            ['id' => 101, 'customer_id' => 10, 'project_id' => 301, 'dept_id' => 6, 'expiry_date' => now()->addDays(45)->toDateString(), 'status' => 'RENEWED'],
            ['id' => 102, 'customer_id' => 11, 'project_id' => 302, 'dept_id' => 5, 'expiry_date' => now()->addDays(5)->toDateString(), 'status' => 'DRAFT'],
        ]);

        DB::table('customer_request_cases')->insert([
            [
                'id' => 200,
                'project_id' => 300,
                'dispatcher_user_id' => 7,
                'performer_user_id' => 9,
                'current_status_code' => 'analysis',
                'sla_due_date' => now()->subHour(),
            ],
            [
                'id' => 201,
                'project_id' => 300,
                'dispatcher_user_id' => 7,
                'performer_user_id' => 8,
                'current_status_code' => 'returned_to_manager',
                'sla_due_date' => now()->subHours(2),
            ],
            [
                'id' => 202,
                'project_id' => 301,
                'dispatcher_user_id' => 8,
                'performer_user_id' => 9,
                'current_status_code' => 'completed',
                'sla_due_date' => now()->subHours(3),
            ],
        ]);
    }
}
