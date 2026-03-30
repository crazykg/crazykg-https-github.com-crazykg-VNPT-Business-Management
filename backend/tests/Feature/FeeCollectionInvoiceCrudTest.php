<?php

namespace Tests\Feature;

use App\Events\V5\InvoiceCreated;
use App\Models\InternalUser;
use App\Services\V5\CacheService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * Feature tests for the Fee Collection (Thu Cước) module.
 *
 * Phase coverage:
 *  - Invoice CRUD + code auto-generation
 *  - Receipt creation → invoice reconciliation (paid_amount / status)
 *  - Bulk invoice generation from payment_schedules
 *  - Debt aging report bucket correctness
 *  - Dashboard KPI arithmetic
 *  - is_overdue computed flag (NOT a persisted DB column)
 *
 * Environment: SQLite :memory:, no MySQL/Redis required.
 * All middleware disabled – auth handled via actingAs().
 */
class FeeCollectionInvoiceCrudTest extends TestCase
{
    // ────────────────────────────────────────────────────────────────────────────
    // Bootstrap
    // ────────────────────────────────────────────────────────────────────────────

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Invoice CRUD
    // ────────────────────────────────────────────────────────────────────────────

    public function test_can_list_invoices_with_pagination_and_kpis(): void
    {
        $contractId = $this->insertContract();
        $customerId = 1;

        $this->insertInvoice([
            'id' => 1,
            'contract_id' => $contractId,
            'customer_id' => $customerId,
            'status' => 'ISSUED',
            'total_amount' => 10_000_000,
            'paid_amount' => 0,
        ]);
        $this->insertInvoice([
            'id' => 2,
            'contract_id' => $contractId,
            'customer_id' => $customerId,
            'status' => 'PAID',
            'total_amount' => 5_000_000,
            'paid_amount' => 5_000_000,
        ]);

        $response = $this->getJson('/api/v5/invoices');

        $response->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.kpis.total_invoices', 2)
            ->assertJsonPath('meta.kpis.total_amount', 15_000_000)
            ->assertJsonPath('meta.kpis.total_paid', 5_000_000)
            ->assertJsonPath('meta.kpis.total_outstanding', 10_000_000);
    }

    public function test_create_invoice_generates_code_and_calculates_totals(): void
    {
        $contractId = $this->insertContract();

        $response = $this->postJson('/api/v5/invoices', [
            'contract_id'  => $contractId,
            'customer_id'  => 1,
            'invoice_date' => '2026-03-01',
            'due_date'     => '2026-03-31',
            'vat_rate'     => 10,
            'notes'        => 'Test invoice',
            'items'        => [
                [
                    'description' => 'Dịch vụ Internet FTTH',
                    'unit'        => 'Tháng',
                    'quantity'    => 1,
                    'unit_price'  => 500_000,
                    'vat_rate'    => 10,
                ],
                [
                    'description' => 'Thuê kênh truyền hình',
                    'unit'        => 'Tháng',
                    'quantity'    => 2,
                    'unit_price'  => 200_000,
                    'vat_rate'    => 10,
                ],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.invoice_code', 'INV-202603-0001')
            ->assertJsonPath('data.status', 'DRAFT')
            ->assertJsonPath('data.subtotal', 900_000)          // 500k + 2*200k
            ->assertJsonPath('data.vat_amount', 90_000)         // 900k * 10%
            ->assertJsonPath('data.total_amount', 990_000)
            ->assertJsonPath('data.paid_amount', 0)
            ->assertJsonPath('data.outstanding', 990_000)
            ->assertJsonPath('data.is_overdue', false);

        $this->assertSame(1, DB::table('invoices')->count());
        $this->assertSame(2, DB::table('invoice_items')->count());
    }

    public function test_create_invoice_dispatches_invoice_created_event(): void
    {
        Event::fake([InvoiceCreated::class]);

        $contractId = $this->insertContract();

        $this->postJson('/api/v5/invoices', [
            'contract_id'  => $contractId,
            'customer_id'  => 1,
            'invoice_date' => '2026-03-01',
            'due_date'     => '2026-03-31',
            'items'        => [[
                'description' => 'Dịch vụ test',
                'quantity' => 1,
                'unit_price' => 100_000,
            ]],
        ])->assertCreated();

        Event::assertDispatched(InvoiceCreated::class, function (InvoiceCreated $event) use ($contractId): bool {
            return (int) $event->invoice->contract_id === $contractId
                && (string) $event->invoice->invoice_code === 'INV-202603-0001';
        });
    }

    public function test_invoice_codes_increment_within_same_month(): void
    {
        $contractId = $this->insertContract();
        $base = [
            'contract_id' => $contractId,
            'customer_id' => 1,
            'invoice_date' => '2026-03-15',
            'due_date' => '2026-03-31',
            'items' => [[
                'description' => 'Dịch vụ test',
                'quantity' => 1,
                'unit_price' => 100_000,
            ]],
        ];

        $this->postJson('/api/v5/invoices', $base)->assertCreated()->assertJsonPath('data.invoice_code', 'INV-202603-0001');
        $this->postJson('/api/v5/invoices', $base)->assertCreated()->assertJsonPath('data.invoice_code', 'INV-202603-0002');
        $this->postJson('/api/v5/invoices', $base)->assertCreated()->assertJsonPath('data.invoice_code', 'INV-202603-0003');
    }

    public function test_cannot_create_invoice_for_nonexistent_contract(): void
    {
        $this->postJson('/api/v5/invoices', [
            'contract_id'  => 9999,
            'customer_id'  => 1,
            'invoice_date' => '2026-03-01',
            'due_date'     => '2026-03-31',
            'items'        => [[
                'description' => 'Dịch vụ test',
                'quantity' => 1,
                'unit_price' => 100_000,
            ]],
        ])->assertStatus(422)->assertJsonValidationErrors(['contract_id']);
    }

    public function test_can_update_draft_invoice(): void
    {
        $contractId = $this->insertContract();
        $this->insertInvoice(['id' => 10, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'DRAFT']);

        $this->putJson('/api/v5/invoices/10', [
            'notes' => 'Updated note',
        ])->assertOk()->assertJsonPath('data.notes', 'Updated note');
    }

    public function test_cannot_update_paid_invoice(): void
    {
        $contractId = $this->insertContract();
        $this->insertInvoice([
            'id' => 11,
            'contract_id' => $contractId,
            'customer_id' => 1,
            'status' => 'PAID',
            'total_amount' => 1_000_000,
            'paid_amount' => 1_000_000,
        ]);

        $this->putJson('/api/v5/invoices/11', ['notes' => 'Attempting update'])
            ->assertStatus(422);
    }

    public function test_can_delete_draft_invoice(): void
    {
        $contractId = $this->insertContract();
        $this->insertInvoice(['id' => 20, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'DRAFT']);

        $this->deleteJson('/api/v5/invoices/20')->assertOk();

        $this->assertNotNull(DB::table('invoices')->where('id', 20)->value('deleted_at'));
    }

    public function test_cannot_delete_issued_invoice(): void
    {
        $contractId = $this->insertContract();
        $this->insertInvoice(['id' => 21, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'ISSUED']);

        $this->deleteJson('/api/v5/invoices/21')->assertStatus(422);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Bulk generate
    // ────────────────────────────────────────────────────────────────────────────

    public function test_bulk_generate_creates_invoices_from_pending_schedules(): void
    {
        $contractId = $this->insertContract(['status' => 'SIGNED']);
        $this->insertPaymentSchedule(['id' => 1, 'contract_id' => $contractId, 'status' => 'PENDING', 'expected_date' => '2026-03-15', 'expected_amount' => 2_000_000]);
        $this->insertPaymentSchedule(['id' => 2, 'contract_id' => $contractId, 'status' => 'PENDING', 'expected_date' => '2026-03-28', 'expected_amount' => 3_000_000]);

        $response = $this->postJson('/api/v5/invoices/bulk-generate', [
            'period_from' => '2026-03-01',
            'period_to'   => '2026-03-31',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.created_count', 2);

        $this->assertSame(2, DB::table('invoices')->count());

        // Schedules should be marked INVOICED
        $statuses = DB::table('payment_schedules')->whereIn('id', [1, 2])->pluck('status')->all();
        $this->assertSame(['INVOICED', 'INVOICED'], $statuses);
    }

    public function test_bulk_generate_skips_already_invoiced_schedules(): void
    {
        $contractId = $this->insertContract(['status' => 'SIGNED']);
        $this->insertPaymentSchedule(['id' => 3, 'contract_id' => $contractId, 'status' => 'PENDING',  'expected_date' => '2026-03-15', 'expected_amount' => 1_000_000]);
        $this->insertPaymentSchedule(['id' => 4, 'contract_id' => $contractId, 'status' => 'INVOICED', 'expected_date' => '2026-03-28', 'expected_amount' => 1_000_000]);

        $response = $this->postJson('/api/v5/invoices/bulk-generate', [
            'period_from' => '2026-03-01',
            'period_to'   => '2026-03-31',
        ]);

        $response->assertCreated()->assertJsonPath('data.created_count', 1);
        $this->assertSame(1, DB::table('invoices')->count());
    }

    public function test_bulk_generate_dispatches_invoice_created_event_for_each_created_invoice(): void
    {
        Event::fake([InvoiceCreated::class]);

        $contractId = $this->insertContract(['status' => 'SIGNED']);
        $this->insertPaymentSchedule(['id' => 5, 'contract_id' => $contractId, 'status' => 'PENDING', 'expected_date' => '2026-03-10', 'expected_amount' => 1_500_000]);
        $this->insertPaymentSchedule(['id' => 6, 'contract_id' => $contractId, 'status' => 'PENDING', 'expected_date' => '2026-03-20', 'expected_amount' => 2_500_000]);

        $this->postJson('/api/v5/invoices/bulk-generate', [
            'period_from' => '2026-03-01',
            'period_to'   => '2026-03-31',
        ])->assertCreated()->assertJsonPath('data.created_count', 2);

        Event::assertDispatchedTimes(InvoiceCreated::class, 2);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Receipt → Invoice reconciliation
    // ────────────────────────────────────────────────────────────────────────────

    public function test_receipt_sets_invoice_to_partial_on_partial_payment(): void
    {
        $contractId = $this->insertContract();
        $this->insertInvoice([
            'id' => 30,
            'contract_id'  => $contractId,
            'customer_id'  => 1,
            'status'       => 'ISSUED',
            'total_amount' => 10_000_000,
            'paid_amount'  => 0,
        ]);

        $this->postJson('/api/v5/receipts', [
            'invoice_id'     => 30,
            'contract_id'    => $contractId,
            'customer_id'    => 1,
            'receipt_date'   => '2026-03-20',
            'amount'         => 6_000_000,
            'payment_method' => 'BANK_TRANSFER',
        ])->assertCreated()->assertJsonPath('data.receipt_code', 'RCP-202603-0001');

        $invoice = DB::table('invoices')->find(30);
        $this->assertSame('PARTIAL', $invoice->status);
        $this->assertSame(6_000_000.0, (float) $invoice->paid_amount);
    }

    public function test_receipt_sets_invoice_to_paid_on_full_payment(): void
    {
        $contractId = $this->insertContract();
        $this->insertInvoice([
            'id' => 31,
            'contract_id'  => $contractId,
            'customer_id'  => 1,
            'status'       => 'ISSUED',
            'total_amount' => 5_000_000,
            'paid_amount'  => 0,
        ]);

        $this->postJson('/api/v5/receipts', [
            'invoice_id'     => 31,
            'contract_id'    => $contractId,
            'customer_id'    => 1,
            'receipt_date'   => '2026-03-25',
            'amount'         => 5_000_000,
            'payment_method' => 'CASH',
        ])->assertCreated();

        $invoice = DB::table('invoices')->find(31);
        $this->assertSame('PAID', $invoice->status);
        $this->assertSame(5_000_000.0, (float) $invoice->paid_amount);
    }

    public function test_receipt_allowed_without_invoice_id_advance_payment(): void
    {
        $contractId = $this->insertContract();

        $this->postJson('/api/v5/receipts', [
            'invoice_id'     => null,
            'contract_id'    => $contractId,
            'customer_id'    => 1,
            'receipt_date'   => '2026-03-10',
            'amount'         => 1_000_000,
            'payment_method' => 'BANK_TRANSFER',
        ])->assertCreated()
            ->assertJsonPath('data.invoice_id', null);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // is_overdue computed flag (NOT a persisted DB status)
    // ────────────────────────────────────────────────────────────────────────────

    public function test_is_overdue_is_true_for_past_due_unpaid_invoice(): void
    {
        $contractId = $this->insertContract();
        $this->insertInvoice([
            'id'           => 40,
            'contract_id'  => $contractId,
            'customer_id'  => 1,
            'status'       => 'ISSUED',
            'due_date'     => '2026-01-01', // past due
            'total_amount' => 1_000_000,
            'paid_amount'  => 0,
        ]);

        $this->getJson('/api/v5/invoices/40')
            ->assertOk()
            ->assertJsonPath('data.is_overdue', true)
            ->assertJsonPath('data.status', 'ISSUED'); // status is NOT 'OVERDUE' in DB
    }

    public function test_is_overdue_is_false_for_paid_invoice_regardless_of_due_date(): void
    {
        $contractId = $this->insertContract();
        $this->insertInvoice([
            'id'           => 41,
            'contract_id'  => $contractId,
            'customer_id'  => 1,
            'status'       => 'PAID',
            'due_date'     => '2026-01-01', // past due but PAID
            'total_amount' => 1_000_000,
            'paid_amount'  => 1_000_000,
        ]);

        $this->getJson('/api/v5/invoices/41')
            ->assertOk()
            ->assertJsonPath('data.is_overdue', false)
            ->assertJsonPath('data.status', 'PAID');
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Debt Aging Report
    // ────────────────────────────────────────────────────────────────────────────

    public function test_aging_report_buckets_correctly_categorize_overdue_invoices(): void
    {
        $contractId = $this->insertContract();
        $today = now()->toDateString();

        // Current (not yet due)
        $this->insertInvoice(['id' => 50, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'ISSUED',
            'due_date' => now()->addDays(10)->toDateString(), 'total_amount' => 1_000_000, 'paid_amount' => 0]);

        // 1-30 days overdue
        $this->insertInvoice(['id' => 51, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'ISSUED',
            'due_date' => now()->subDays(15)->toDateString(), 'total_amount' => 2_000_000, 'paid_amount' => 0]);

        // 31-60 days overdue
        $this->insertInvoice(['id' => 52, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'ISSUED',
            'due_date' => now()->subDays(45)->toDateString(), 'total_amount' => 3_000_000, 'paid_amount' => 0]);

        // >90 days overdue
        $this->insertInvoice(['id' => 53, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'ISSUED',
            'due_date' => now()->subDays(100)->toDateString(), 'total_amount' => 4_000_000, 'paid_amount' => 0]);

        // PAID — should NOT appear in aging
        $this->insertInvoice(['id' => 54, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'PAID',
            'due_date' => now()->subDays(5)->toDateString(), 'total_amount' => 500_000, 'paid_amount' => 500_000]);

        $response = $this->getJson('/api/v5/fee-collection/debt-aging');

        $response->assertOk()
            ->assertJsonPath('data.totals.total', 10_000_000)
            ->assertJsonPath('data.totals.current',  1_000_000)
            ->assertJsonPath('data.totals.d1_30',    2_000_000)
            ->assertJsonPath('data.totals.d31_60',   3_000_000)
            ->assertJsonPath('data.totals.d61_90',   0)
            ->assertJsonPath('data.totals.over_90',  4_000_000);
    }

    public function test_aging_report_excludes_cancelled_and_void_invoices(): void
    {
        $contractId = $this->insertContract();
        $this->insertInvoice(['id' => 60, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'CANCELLED',
            'due_date' => now()->subDays(10)->toDateString(), 'total_amount' => 1_000_000, 'paid_amount' => 0]);
        $this->insertInvoice(['id' => 61, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'VOID',
            'due_date' => now()->subDays(20)->toDateString(), 'total_amount' => 2_000_000, 'paid_amount' => 0]);

        $response = $this->getJson('/api/v5/fee-collection/debt-aging');

        $response->assertOk()->assertJsonPath('data.totals.total', 0);
        $this->assertCount(0, $response->json('data.rows') ?? []);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Dashboard KPIs
    // ────────────────────────────────────────────────────────────────────────────

    public function test_dashboard_kpis_are_correctly_scoped_to_period(): void
    {
        $contractId = $this->insertContract();

        // IN period
        $this->insertInvoice(['id' => 70, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'PAID',
            'invoice_date' => '2026-03-05', 'total_amount' => 10_000_000, 'paid_amount' => 10_000_000]);

        // OUT of period
        $this->insertInvoice(['id' => 71, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'ISSUED',
            'invoice_date' => '2026-01-10', 'total_amount' => 5_000_000, 'paid_amount' => 0]);

        // Receipt in period
        $this->insertReceipt(['id' => 1, 'invoice_id' => 70, 'contract_id' => $contractId, 'customer_id' => 1,
            'receipt_date' => '2026-03-15', 'amount' => 10_000_000]);

        $response = $this->getJson('/api/v5/fee-collection/dashboard?period_from=2026-03-01&period_to=2026-03-31');

        $response->assertOk()
            ->assertJsonPath('data.kpis.expected_revenue', 10_000_000)
            ->assertJsonPath('data.kpis.actual_collected', 10_000_000)
            ->assertJsonPath('data.kpis.outstanding', 5_000_000)
            ->assertJsonPath('data.kpis.collection_rate', 100);
    }

    public function test_dashboard_collection_rate_caps_at_100_percent(): void
    {
        $contractId = $this->insertContract();

        // Overpayment edge case: paid > expected within period
        $this->insertInvoice(['id' => 80, 'contract_id' => $contractId, 'customer_id' => 1, 'status' => 'PAID',
            'invoice_date' => '2026-03-01', 'total_amount' => 1_000_000, 'paid_amount' => 1_200_000]);

        $this->insertReceipt(['id' => 2, 'invoice_id' => 80, 'contract_id' => $contractId, 'customer_id' => 1,
            'receipt_date' => '2026-03-05', 'amount' => 1_200_000]);

        $response = $this->getJson('/api/v5/fee-collection/dashboard?period_from=2026-03-01&period_to=2026-03-31');

        $response->assertOk();
        $rate = (int) $response->json('data.kpis.collection_rate');
        $this->assertLessThanOrEqual(100, $rate);
    }

    public function test_dashboard_uses_cache_service_standardized_tags(): void
    {
        $contractId = $this->insertContract();
        $this->insertInvoice([
            'id' => 90,
            'contract_id' => $contractId,
            'customer_id' => 1,
            'status' => 'ISSUED',
            'invoice_date' => '2026-03-10',
            'total_amount' => 2_000_000,
            'paid_amount' => 0,
        ]);

        $cache = Mockery::mock(CacheService::class);
        $cache->shouldReceive('rememberTagged')
            ->once()
            ->with(
                ['fee-collection-dashboard', 'invoices'],
                Mockery::type('string'),
                120,
                Mockery::type(\Closure::class)
            )
            ->andReturnUsing(fn (array $tags, string $key, int $ttl, \Closure $callback) => $callback());
        $this->app->instance(CacheService::class, $cache);

        $this->getJson('/api/v5/fee-collection/dashboard?period_from=2026-03-01&period_to=2026-03-31')
            ->assertOk()
            ->assertJsonPath('data.kpis.expected_revenue', 2_000_000);
    }

    public function test_create_invoice_flushes_related_dashboard_caches(): void
    {
        $contractId = $this->insertContract();

        $cache = Mockery::mock(CacheService::class);
        $cache->shouldReceive('flushTags')->once()->with(['invoices']);
        $cache->shouldReceive('flushTags')->once()->with(['fee-collection-dashboard']);
        $cache->shouldReceive('flushTags')->once()->with(['revenue-overview']);
        $this->app->instance(CacheService::class, $cache);

        $this->postJson('/api/v5/invoices', [
            'contract_id'  => $contractId,
            'customer_id'  => 1,
            'invoice_date' => '2026-03-01',
            'due_date'     => '2026-03-31',
            'items'        => [[
                'description' => 'Dịch vụ test',
                'quantity' => 1,
                'unit_price' => 100_000,
            ]],
        ])->assertCreated();
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Schema setup helpers
    // ────────────────────────────────────────────────────────────────────────────

    private function setUpSchema(): void
    {
        $tables = ['receipts', 'dunning_logs', 'invoice_items', 'invoices', 'payment_schedules',
            'contract_items', 'contracts', 'customers', 'projects', 'internal_users', 'departments'];

        foreach ($tables as $tbl) {
            Schema::dropIfExists($tbl);
        }

        Schema::create('departments', function (Blueprint $t): void {
            $t->bigIncrements('id');
            $t->string('dept_code', 50)->nullable();
            $t->string('dept_name', 255)->nullable();
            $t->unsignedBigInteger('parent_id')->nullable();
            $t->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $t): void {
            $t->bigIncrements('id');
            $t->string('username', 100)->nullable();
            $t->string('full_name', 255)->nullable();
            $t->unsignedBigInteger('department_id')->nullable();
            $t->string('password')->nullable();
            $t->rememberToken();
            $t->timestamp('deleted_at')->nullable();
        });

        Schema::create('customers', function (Blueprint $t): void {
            $t->bigIncrements('id');
            $t->string('customer_code', 100)->nullable();
            $t->string('customer_name', 255)->nullable();
            $t->timestamp('deleted_at')->nullable();
        });

        Schema::create('projects', function (Blueprint $t): void {
            $t->bigIncrements('id');
            $t->string('project_code', 50)->nullable();
            $t->string('project_name', 255)->nullable();
            $t->unsignedBigInteger('customer_id')->nullable();
            $t->timestamp('deleted_at')->nullable();
        });

        Schema::create('contracts', function (Blueprint $t): void {
            $t->bigIncrements('id');
            $t->string('contract_code', 100)->nullable();
            $t->string('contract_name', 255)->nullable();
            $t->unsignedBigInteger('project_id')->nullable();
            $t->unsignedBigInteger('customer_id')->nullable();
            $t->date('sign_date')->nullable();
            $t->date('effective_date')->nullable();
            $t->date('expiry_date')->nullable();
            $t->decimal('value', 18, 2)->default(0);
            $t->decimal('total_value', 18, 2)->default(0);
            $t->string('payment_cycle', 32)->nullable();
            $t->string('term_unit', 10)->nullable();
            $t->decimal('term_value', 10, 2)->nullable();
            $t->boolean('expiry_date_manual_override')->default(false);
            $t->unsignedBigInteger('parent_contract_id')->nullable();
            $t->string('addendum_type', 32)->nullable();
            $t->integer('gap_days')->nullable();
            $t->string('continuity_status', 32)->nullable()->default('STANDALONE');
            $t->decimal('penalty_rate', 5, 4)->nullable();
            $t->string('status', 32)->nullable()->default('DRAFT');
            $t->unsignedBigInteger('dept_id')->nullable();
            $t->unsignedBigInteger('created_by')->nullable();
            $t->unsignedBigInteger('updated_by')->nullable();
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('contract_items', function (Blueprint $t): void {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('contract_id');
            $t->unsignedBigInteger('product_id')->nullable();
            $t->decimal('quantity', 12, 2)->default(1);
            $t->decimal('unit_price', 15, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('payment_schedules', function (Blueprint $t): void {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('contract_id');
            $t->unsignedBigInteger('project_id')->nullable();
            $t->unsignedBigInteger('invoice_id')->nullable(); // link added by migration 000005
            $t->string('milestone_name', 255)->nullable();
            $t->unsignedInteger('cycle_number')->default(1);
            $t->date('expected_date')->nullable();
            $t->decimal('expected_amount', 18, 2)->default(0);
            $t->decimal('original_amount', 18, 2)->nullable();
            $t->decimal('penalty_rate', 5, 4)->nullable();
            $t->decimal('penalty_amount', 18, 2)->nullable();
            $t->date('actual_paid_date')->nullable();
            $t->decimal('actual_paid_amount', 18, 2)->default(0);
            $t->string('status', 32)->default('PENDING');
            $t->text('notes')->nullable();
            $t->timestamps();
        });

        Schema::create('invoices', function (Blueprint $t): void {
            $t->bigIncrements('id');
            $t->string('invoice_code', 50)->nullable();
            $t->string('invoice_series', 20)->nullable();
            $t->unsignedBigInteger('contract_id');
            $t->unsignedBigInteger('customer_id');
            $t->unsignedBigInteger('project_id')->nullable();
            $t->date('invoice_date');
            $t->date('due_date');
            $t->date('period_from')->nullable();
            $t->date('period_to')->nullable();
            $t->decimal('subtotal', 15, 2)->default(0);
            $t->decimal('vat_rate', 5, 2)->nullable()->default(10);
            $t->decimal('vat_amount', 15, 2)->default(0);
            $t->decimal('total_amount', 15, 2)->default(0);
            $t->decimal('paid_amount', 15, 2)->default(0);
            // NOTE: 'outstanding' is a GENERATED STORED column in MySQL.
            // In SQLite :memory: (test env) we use a regular column, updated by service layer.
            $t->decimal('outstanding', 15, 2)->default(0);
            $t->string('status', 30)->default('DRAFT');
            $t->text('notes')->nullable();
            $t->string('data_scope', 50)->nullable();
            $t->unsignedBigInteger('created_by')->nullable();
            $t->unsignedBigInteger('updated_by')->nullable();
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('invoice_items', function (Blueprint $t): void {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('invoice_id');
            $t->unsignedBigInteger('product_id')->nullable();
            $t->string('description', 500);
            $t->string('unit', 50)->nullable();
            $t->decimal('quantity', 12, 2)->default(1);
            $t->decimal('unit_price', 15, 2)->default(0);
            $t->decimal('vat_rate', 5, 2)->nullable()->default(10);
            // In SQLite :memory: — regular columns (GENERATED not supported)
            $t->decimal('line_total', 15, 2)->default(0);
            $t->decimal('vat_amount', 15, 2)->default(0);
            $t->unsignedBigInteger('payment_schedule_id')->nullable();
            $t->integer('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('receipts', function (Blueprint $t): void {
            $t->bigIncrements('id');
            $t->string('receipt_code', 50)->nullable();
            $t->unsignedBigInteger('invoice_id')->nullable();
            $t->unsignedBigInteger('contract_id');
            $t->unsignedBigInteger('customer_id');
            $t->date('receipt_date');
            $t->decimal('amount', 15, 2)->default(0);
            $t->string('payment_method', 50)->default('BANK_TRANSFER');
            $t->string('bank_name', 200)->nullable();
            $t->string('bank_account', 50)->nullable();
            $t->string('transaction_ref', 100)->nullable();
            $t->string('status', 30)->default('CONFIRMED');
            $t->boolean('is_reversed')->default(false);
            $t->boolean('is_reversal_offset')->default(false);
            $t->unsignedBigInteger('original_receipt_id')->nullable();
            $t->text('notes')->nullable();
            $t->unsignedBigInteger('confirmed_by')->nullable();
            $t->timestamp('confirmed_at')->nullable();
            $t->string('data_scope', 50)->nullable();
            $t->unsignedBigInteger('created_by')->nullable();
            $t->unsignedBigInteger('updated_by')->nullable();
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('dunning_logs', function (Blueprint $t): void {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('invoice_id');
            $t->unsignedBigInteger('customer_id');
            $t->tinyInteger('dunning_level')->default(1);
            $t->timestamp('sent_at')->useCurrent();
            $t->string('sent_via', 30)->default('SYSTEM');
            $t->text('message')->nullable();
            $t->text('response_note')->nullable();
            $t->unsignedBigInteger('created_by')->nullable();
            $t->timestamps();
        });

        // Seed minimal reference data
        DB::table('departments')->insert(['id' => 10, 'dept_code' => 'D01', 'dept_name' => 'Phòng Kinh doanh']);
        DB::table('internal_users')->insert(['id' => 1, 'username' => 'admin', 'full_name' => 'Admin', 'department_id' => 10, 'password' => bcrypt('secret')]);
        DB::table('customers')->insert(['id' => 1, 'customer_code' => 'KH-001', 'customer_name' => 'Khách hàng Test']);
        DB::table('projects')->insert(['id' => 1, 'project_code' => 'DA-001', 'project_name' => 'Dự án Test', 'customer_id' => 1]);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Data-insertion helpers
    // ────────────────────────────────────────────────────────────────────────────

    private function insertContract(array $overrides = []): int
    {
        $payload = array_merge([
            'id'                          => 100,
            'contract_code'               => 'HD-TC-001',
            'contract_name'               => 'Hợp đồng Thu cước Test',
            'project_id'                  => 1,
            'customer_id'                 => 1,
            'sign_date'                   => '2026-01-01',
            'effective_date'              => '2026-01-01',
            'expiry_date'                 => '2026-12-31',
            'value'                       => 60_000_000,
            'total_value'                 => 60_000_000,
            'payment_cycle'               => 'MONTHLY',
            'status'                      => 'SIGNED',
            'dept_id'                     => 10,
            'created_by'                  => 1,
            'updated_by'                  => 1,
            'expiry_date_manual_override' => 0,
            'created_at'                  => now(),
            'updated_at'                  => now(),
        ], $overrides);

        DB::table('contracts')->insert($payload);

        return (int) $payload['id'];
    }

    private function insertInvoice(array $overrides = []): int
    {
        $payload = array_merge([
            'id'            => 1,
            'invoice_code'  => 'INV-202603-0001',
            'contract_id'   => 100,
            'customer_id'   => 1,
            'invoice_date'  => '2026-03-01',
            'due_date'      => '2026-03-31',
            'subtotal'      => 1_000_000,
            'vat_rate'      => 10,
            'vat_amount'    => 100_000,
            'total_amount'  => 1_100_000,
            'paid_amount'   => 0,
            'outstanding'   => 1_100_000,
            'status'        => 'DRAFT',
            'created_by'    => 1,
            'created_at'    => now(),
            'updated_at'    => now(),
        ], $overrides);

        // Keep outstanding in sync for test setup
        if (!isset($overrides['outstanding'])) {
            $payload['outstanding'] = max(0, $payload['total_amount'] - $payload['paid_amount']);
        }

        DB::table('invoices')->insert($payload);

        return (int) $payload['id'];
    }

    private function insertPaymentSchedule(array $overrides = []): int
    {
        $payload = array_merge([
            'id'             => 1,
            'contract_id'    => 100,
            'cycle_number'   => 1,
            'milestone_name' => 'Kỳ thanh toán test',
            'expected_date'  => '2026-03-15',
            'expected_amount'=> 2_000_000,
            'status'         => 'PENDING',
            'created_at'     => now(),
            'updated_at'     => now(),
        ], $overrides);

        DB::table('payment_schedules')->insert($payload);

        return (int) $payload['id'];
    }

    private function insertReceipt(array $overrides = []): int
    {
        $payload = array_merge([
            'id'             => 1,
            'receipt_code'   => 'RCP-202603-0001',
            'invoice_id'     => null,
            'contract_id'    => 100,
            'customer_id'    => 1,
            'receipt_date'   => '2026-03-15',
            'amount'         => 1_000_000,
            'payment_method' => 'BANK_TRANSFER',
            'status'         => 'CONFIRMED',
            'created_by'     => 1,
            'created_at'     => now(),
            'updated_at'     => now(),
        ], $overrides);

        DB::table('receipts')->insert($payload);

        return (int) $payload['id'];
    }
}
