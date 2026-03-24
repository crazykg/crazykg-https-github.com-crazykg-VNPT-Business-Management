<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RevenueTargetBulkStoreTest extends TestCase
{
    private bool $createdRevenueTargetsTableForTest = false;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        DB::table('revenue_targets')->delete();
    }

    protected function tearDown(): void
    {
        if ($this->createdRevenueTargetsTableForTest && Schema::hasTable('revenue_targets')) {
            Schema::drop('revenue_targets');
            $this->createdRevenueTargetsTableForTest = false;
        }

        parent::tearDown();
    }

    public function test_bulk_store_creates_requested_target_type(): void
    {
        $response = $this->postJson('/api/v5/revenue/targets/bulk', [
            'year' => 2026,
            'period_type' => 'MONTHLY',
            'target_type' => 'NEW_CONTRACT',
            'dept_ids' => [0],
            'targets' => [
                ['period_key' => '2026-03', 'amount' => 500000000],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.updated', 0);

        $row = DB::table('revenue_targets')->first();
        $this->assertNotNull($row);
        $this->assertSame('NEW_CONTRACT', $row->target_type);
        $this->assertSame('2026-03', $row->period_key);
        $this->assertSame('2026-03-01', $row->period_start);
        $this->assertSame('2026-03-31', $row->period_end);
    }

    public function test_bulk_store_updates_only_matching_target_type_compound_key(): void
    {
        $this->insertRevenueTarget([
            'period_type' => 'MONTHLY',
            'period_key' => '2026-04',
            'period_start' => '2026-04-01',
            'period_end' => '2026-04-30',
            'dept_id' => 5,
            'target_type' => 'TOTAL',
            'target_amount' => 100000000,
        ]);
        $renewalId = $this->insertRevenueTarget([
            'period_type' => 'MONTHLY',
            'period_key' => '2026-04',
            'period_start' => '2026-04-01',
            'period_end' => '2026-04-30',
            'dept_id' => 5,
            'target_type' => 'RENEWAL',
            'target_amount' => 200000000,
        ]);

        $response = $this->postJson('/api/v5/revenue/targets/bulk', [
            'year' => 2026,
            'period_type' => 'MONTHLY',
            'target_type' => 'RENEWAL',
            'dept_ids' => [5],
            'targets' => [
                ['period_key' => '2026-04', 'amount' => 350000000],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.created', 0)
            ->assertJsonPath('data.updated', 1);

        $this->assertSame(
            100000000.0,
            (float) DB::table('revenue_targets')->where('target_type', 'TOTAL')->value('target_amount')
        );
        $this->assertSame(
            350000000.0,
            (float) DB::table('revenue_targets')->where('id', $renewalId)->value('target_amount')
        );
    }

    public function test_bulk_store_force_deletes_soft_deleted_duplicate_for_same_target_type(): void
    {
        $this->insertRevenueTarget([
            'period_type' => 'MONTHLY',
            'period_key' => '2026-05',
            'period_start' => '2026-05-01',
            'period_end' => '2026-05-31',
            'dept_id' => 0,
            'target_type' => 'RECURRING',
            'target_amount' => 120000000,
            'deleted_at' => now(),
        ]);

        $response = $this->postJson('/api/v5/revenue/targets/bulk', [
            'year' => 2026,
            'period_type' => 'MONTHLY',
            'target_type' => 'RECURRING',
            'dept_ids' => [0],
            'targets' => [
                ['period_key' => '2026-05', 'amount' => 180000000],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.updated', 0);

        $this->assertSame(1, DB::table('revenue_targets')->count());
        $this->assertSame(
            180000000.0,
            (float) DB::table('revenue_targets')->where('target_type', 'RECURRING')->value('target_amount')
        );
        $this->assertNull(
            DB::table('revenue_targets')->where('target_type', 'RECURRING')->value('deleted_at')
        );
    }

    private function setUpSchema(): void
    {
        if (Schema::hasTable('revenue_targets')) {
            return;
        }

        Schema::create('revenue_targets', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('period_type', 20);
            $table->string('period_key', 10);
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedBigInteger('dept_id')->default(0);
            $table->string('target_type', 30)->default('TOTAL');
            $table->decimal('target_amount', 18, 2)->default(0);
            $table->decimal('actual_amount', 18, 2)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('data_scope', 50)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        $this->createdRevenueTargetsTableForTest = true;
    }

    /**
     * @param array<string, mixed> $attributes
     */
    private function insertRevenueTarget(array $attributes): int
    {
        return (int) DB::table('revenue_targets')->insertGetId(array_merge([
            'period_type' => 'MONTHLY',
            'period_key' => '2026-01',
            'period_start' => '2026-01-01',
            'period_end' => '2026-01-31',
            'dept_id' => 0,
            'target_type' => 'TOTAL',
            'target_amount' => 0,
            'actual_amount' => 0,
            'notes' => null,
            'approved_by' => null,
            'approved_at' => null,
            'data_scope' => null,
            'created_by' => null,
            'updated_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ], $attributes));
    }
}
