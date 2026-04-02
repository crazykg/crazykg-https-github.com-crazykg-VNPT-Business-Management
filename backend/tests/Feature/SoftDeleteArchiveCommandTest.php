<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SoftDeleteArchiveCommandTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('vnpt_archival.soft_delete.tables', [
            'revenue_targets' => [
                'archive_table' => 'revenue_targets_archive',
                'copy_columns' => [
                    'period_type',
                    'period_key',
                    'period_start',
                    'period_end',
                    'dept_id',
                    'target_type',
                    'target_amount',
                    'actual_amount',
                    'notes',
                    'approved_by',
                    'approved_at',
                    'data_scope',
                    'created_by',
                    'updated_by',
                ],
            ],
        ]);

        $this->setUpSchema();
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('revenue_targets_archive');
        Schema::dropIfExists('revenue_targets');

        parent::tearDown();
    }

    public function test_command_archives_only_aged_soft_deleted_rows_and_is_idempotent(): void
    {
        DB::table('revenue_targets')->insert([
            [
                'id' => 1,
                'period_type' => 'MONTHLY',
                'period_key' => '2025-09',
                'period_start' => '2025-09-01',
                'period_end' => '2025-09-30',
                'dept_id' => 7,
                'target_type' => 'TOTAL',
                'target_amount' => 150000000,
                'actual_amount' => 145000000,
                'notes' => 'old deleted target',
                'approved_by' => 5,
                'approved_at' => now()->subMonths(6),
                'data_scope' => 'dept',
                'created_by' => 2,
                'updated_by' => 3,
                'created_at' => now()->subMonths(8),
                'updated_at' => now()->subMonths(7),
                'deleted_at' => now()->subDays(181),
            ],
            [
                'id' => 2,
                'period_type' => 'MONTHLY',
                'period_key' => '2026-02',
                'period_start' => '2026-02-01',
                'period_end' => '2026-02-28',
                'dept_id' => 8,
                'target_type' => 'RENEWAL',
                'target_amount' => 90000000,
                'actual_amount' => 0,
                'notes' => 'recent deleted target',
                'approved_by' => null,
                'approved_at' => null,
                'data_scope' => null,
                'created_by' => 2,
                'updated_by' => 2,
                'created_at' => now()->subMonths(2),
                'updated_at' => now()->subMonths(2),
                'deleted_at' => now()->subDays(30),
            ],
            [
                'id' => 3,
                'period_type' => 'MONTHLY',
                'period_key' => '2026-03',
                'period_start' => '2026-03-01',
                'period_end' => '2026-03-31',
                'dept_id' => 0,
                'target_type' => 'TOTAL',
                'target_amount' => 250000000,
                'actual_amount' => 0,
                'notes' => 'active target',
                'approved_by' => null,
                'approved_at' => null,
                'data_scope' => 'company',
                'created_by' => 1,
                'updated_by' => 1,
                'created_at' => now()->subDays(10),
                'updated_at' => now()->subDays(5),
                'deleted_at' => null,
            ],
        ]);

        $this->artisan('archive:soft-deletes', [
            '--tables' => ['revenue_targets'],
            '--days' => 180,
            '--chunk' => 1,
        ])
            ->expectsOutput('Archived 1 rows from revenue_targets into revenue_targets_archive.')
            ->expectsOutput('Archived soft-deleted records: 1 rows.')
            ->assertSuccessful();

        $this->assertFalse(DB::table('revenue_targets')->where('id', 1)->exists());
        $this->assertTrue(DB::table('revenue_targets')->where('id', 2)->exists());
        $this->assertTrue(DB::table('revenue_targets')->where('id', 3)->exists());

        $archived = DB::table('revenue_targets_archive')->where('source_id', 1)->first();
        $this->assertNotNull($archived);
        $this->assertSame('2025-09', $archived->period_key);
        $this->assertSame('TOTAL', $archived->target_type);
        $this->assertSame('old deleted target', $archived->notes);
        $this->assertSame('soft_delete_retention', $archived->archive_reason);
        $this->assertNotNull($archived->source_deleted_at);
        $this->assertNotNull($archived->archived_at);

        $payload = json_decode((string) $archived->payload, true, 512, JSON_THROW_ON_ERROR);
        $this->assertIsArray($payload);
        $this->assertSame(1, $payload['id']);
        $this->assertSame('2025-09', $payload['period_key']);

        $this->artisan('archive:soft-deletes', [
            '--tables' => ['revenue_targets'],
            '--days' => 180,
            '--chunk' => 1,
        ])
            ->expectsOutput('Archived 0 rows from revenue_targets into revenue_targets_archive.')
            ->expectsOutput('Archived soft-deleted records: 0 rows.')
            ->assertSuccessful();

        $this->assertSame(1, DB::table('revenue_targets_archive')->count());
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('revenue_targets_archive');
        Schema::dropIfExists('revenue_targets');

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

        Schema::create('revenue_targets_archive', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('source_id')->unique();
            $table->string('period_type', 20)->nullable();
            $table->string('period_key', 10)->nullable();
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->unsignedBigInteger('dept_id')->default(0);
            $table->string('target_type', 30)->nullable();
            $table->decimal('target_amount', 18, 2)->default(0);
            $table->decimal('actual_amount', 18, 2)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('data_scope', 50)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('source_created_at')->nullable();
            $table->timestamp('source_updated_at')->nullable();
            $table->timestamp('source_deleted_at')->nullable();
            $table->timestamp('archived_at');
            $table->string('archive_reason', 50)->default('soft_delete_retention');
            $table->json('payload')->nullable();
        });
    }
}
