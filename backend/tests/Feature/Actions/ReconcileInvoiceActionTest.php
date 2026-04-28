<?php

namespace Tests\Feature\Actions;

use App\Actions\V5\Invoice\ReconcileInvoiceAction;
use App\Models\Invoice;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ReconcileInvoiceActionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchema();
    }

    public function test_execute_updates_invoice_and_payment_schedule_without_deleted_at_column(): void
    {
        DB::table('invoices')->insert([
            'id' => 1,
            'invoice_code' => 'INV-202603-0001',
            'contract_id' => 10,
            'customer_id' => 20,
            'invoice_date' => '2026-03-01',
            'due_date' => '2026-03-31',
            'total_amount' => 1000,
            'paid_amount' => 0,
            'status' => 'ISSUED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('payment_schedules')->insert([
            'id' => 1,
            'invoice_id' => 1,
            'actual_paid_amount' => 0,
            'status' => 'INVOICED',
            'updated_at' => now(),
        ]);

        DB::table('receipts')->insert([
            'id' => 1,
            'invoice_id' => 1,
            'status' => 'CONFIRMED',
            'amount' => 600,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $fresh = app(ReconcileInvoiceAction::class)->execute(Invoice::query()->findOrFail(1));

        $this->assertSame(600.0, $fresh->paid_amount);
        $this->assertSame('PARTIAL', $fresh->status);
        $this->assertSame(600.0, (float) DB::table('payment_schedules')->where('invoice_id', 1)->value('actual_paid_amount'));
        $this->assertSame('PARTIAL', DB::table('payment_schedules')->where('invoice_id', 1)->value('status'));
    }

    public function test_execute_keeps_draft_invoice_status(): void
    {
        DB::table('invoices')->insert([
            'id' => 2,
            'invoice_code' => 'INV-202603-0002',
            'contract_id' => 10,
            'customer_id' => 20,
            'invoice_date' => '2026-03-01',
            'due_date' => '2026-03-31',
            'total_amount' => 1000,
            'paid_amount' => 0,
            'status' => 'DRAFT',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('receipts')->insert([
            'id' => 2,
            'invoice_id' => 2,
            'status' => 'CONFIRMED',
            'amount' => 1000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $fresh = app(ReconcileInvoiceAction::class)->execute(Invoice::query()->findOrFail(2));

        $this->assertSame(1000.0, $fresh->paid_amount);
        $this->assertSame('DRAFT', $fresh->status);
    }

    public function test_execute_blocks_cascading_overpaid_invoice_to_payment_schedule(): void
    {
        DB::table('invoices')->insert([
            'id' => 3,
            'invoice_code' => 'INV-202603-0003',
            'contract_id' => 10,
            'customer_id' => 20,
            'invoice_date' => '2026-03-01',
            'due_date' => '2026-03-31',
            'total_amount' => 2000,
            'paid_amount' => 0,
            'status' => 'ISSUED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('payment_schedules')->insert([
            'id' => 3,
            'invoice_id' => 3,
            'expected_amount' => 1000,
            'actual_paid_amount' => 0,
            'status' => 'INVOICED',
            'updated_at' => now(),
        ]);

        DB::table('receipts')->insert([
            'id' => 3,
            'invoice_id' => 3,
            'status' => 'CONFIRMED',
            'amount' => 1001,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->expectException(ValidationException::class);

        try {
            app(ReconcileInvoiceAction::class)->execute(Invoice::query()->findOrFail(3));
        } finally {
            $this->assertSame(0.0, (float) DB::table('payment_schedules')->where('invoice_id', 3)->value('actual_paid_amount'));
            $this->assertSame('INVOICED', DB::table('payment_schedules')->where('invoice_id', 3)->value('status'));
        }
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('receipts');
        Schema::dropIfExists('payment_schedules');
        Schema::dropIfExists('invoices');

        Schema::create('invoices', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('invoice_code', 50)->nullable();
            $table->unsignedBigInteger('contract_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->date('invoice_date')->nullable();
            $table->date('due_date')->nullable();
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->string('status', 30)->default('DRAFT');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('receipts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('invoice_id')->nullable();
            $table->string('status', 30)->default('CONFIRMED');
            $table->decimal('amount', 15, 2)->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('payment_schedules', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('invoice_id')->nullable();
            $table->decimal('expected_amount', 18, 2)->default(0);
            $table->decimal('actual_paid_amount', 18, 2)->default(0);
            $table->string('status', 32)->default('INVOICED');
            $table->timestamp('updated_at')->nullable();
        });
    }
}
