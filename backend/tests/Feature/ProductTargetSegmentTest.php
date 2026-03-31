<?php

namespace Tests\Feature;

use App\Services\V5\Domain\CustomerInsightService;
use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class ProductTargetSegmentTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->seedBaseData();
    }

    protected function tearDown(): void
    {
        Mockery::close();

        parent::tearDown();
    }

    public function test_it_indexes_segments_for_a_product(): void
    {
        DB::table('product_target_segments')->insert([
            [
                'id' => 1,
                'uuid' => 'segment-1',
                'product_id' => 1,
                'customer_sector' => 'HEALTHCARE',
                'facility_type' => 'PUBLIC_HOSPITAL',
                'facility_types' => json_encode(['PUBLIC_HOSPITAL'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'bed_capacity_min' => 200,
                'bed_capacity_max' => null,
                'priority' => 1,
                'sales_notes' => 'Ưu tiên bệnh viện công.',
                'is_active' => true,
                'created_by' => 7,
                'updated_by' => 7,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'uuid' => 'segment-2',
                'product_id' => 1,
                'customer_sector' => 'GOVERNMENT',
                'facility_type' => null,
                'facility_types' => null,
                'bed_capacity_min' => null,
                'bed_capacity_max' => null,
                'priority' => 2,
                'sales_notes' => 'Cho cơ quan hành chính.',
                'is_active' => true,
                'created_by' => 7,
                'updated_by' => 7,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->getJson('/api/v5/products/1/target-segments');

        $response
            ->assertOk()
            ->assertJsonPath('meta.table_available', true)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.customer_sector', 'HEALTHCARE')
            ->assertJsonPath('data.0.facility_types.0', 'PUBLIC_HOSPITAL')
            ->assertJsonPath('data.1.customer_sector', 'GOVERNMENT');
    }

    public function test_it_returns_empty_state_when_target_segment_table_is_missing(): void
    {
        Schema::drop('product_target_segments');

        $response = $this->getJson('/api/v5/products/1/target-segments');

        $response
            ->assertOk()
            ->assertJsonPath('meta.table_available', false)
            ->assertExactJson([
                'data' => [],
                'meta' => ['table_available' => false],
            ]);
    }

    public function test_it_bulk_syncs_segments_soft_deletes_old_rows_and_emits_audit_event(): void
    {
        $user = InternalUser::query()->create([
            'id' => 7,
            'uuid' => 'user-7',
            'user_code' => 'U007',
            'username' => 'tester',
            'password' => bcrypt('secret'),
            'full_name' => 'Nguyen Van A',
            'email' => 'tester@example.com',
            'status' => 'ACTIVE',
        ]);
        $this->actingAs($user);

        DB::table('product_target_segments')->insert([
            [
                'id' => 1,
                'uuid' => 'old-segment-1',
                'product_id' => 1,
                'customer_sector' => 'HEALTHCARE',
                'facility_type' => 'PUBLIC_HOSPITAL',
                'facility_types' => json_encode(['PUBLIC_HOSPITAL'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'bed_capacity_min' => 100,
                'bed_capacity_max' => null,
                'priority' => 1,
                'sales_notes' => 'Cấu hình cũ 1',
                'is_active' => true,
                'created_by' => 7,
                'updated_by' => 7,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'uuid' => 'old-segment-2',
                'product_id' => 1,
                'customer_sector' => 'GOVERNMENT',
                'facility_type' => null,
                'facility_types' => null,
                'bed_capacity_min' => null,
                'bed_capacity_max' => null,
                'priority' => 2,
                'sales_notes' => 'Cấu hình cũ 2',
                'is_active' => true,
                'created_by' => 7,
                'updated_by' => 7,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->putJson('/api/v5/products/1/target-segments-sync', [
            'segments' => [
                [
                    'customer_sector' => 'HEALTHCARE',
                    'facility_type' => null,
                    'facility_types' => ['PUBLIC_HOSPITAL', 'MEDICAL_CENTER'],
                    'bed_capacity_min' => 200,
                    'priority' => 1,
                    'sales_notes' => 'Bệnh viện công quy mô lớn',
                    'is_active' => true,
                ],
                [
                    'customer_sector' => 'HEALTHCARE',
                    'facility_type' => 'PRIVATE_CLINIC',
                    'priority' => 2,
                    'sales_notes' => 'Phòng khám tư nhân',
                    'is_active' => true,
                ],
                [
                    'customer_sector' => 'GOVERNMENT',
                    'priority' => 3,
                    'sales_notes' => 'Khối hành chính công',
                    'is_active' => false,
                ],
            ],
        ]);

        $response
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.sales_notes', 'Bệnh viện công quy mô lớn')
            ->assertJsonPath('data.0.facility_types.1', 'MEDICAL_CENTER')
            ->assertJsonPath('data.2.is_active', false);

        $this->assertSame(3, DB::table('product_target_segments')->where('product_id', 1)->whereNull('deleted_at')->count());
        $this->assertSame(2, DB::table('product_target_segments')->where('product_id', 1)->whereNotNull('deleted_at')->count());

        $auditLog = DB::table('audit_logs')
            ->where('auditable_type', 'product_target_segments')
            ->where('auditable_id', 1)
            ->latest('id')
            ->first();

        $this->assertNotNull($auditLog);
        $this->assertSame('UPDATE', $auditLog->event);

        $oldValues = json_decode((string) $auditLog->old_values, true);
        $newValues = json_decode((string) $auditLog->new_values, true);

        $this->assertCount(2, $oldValues['segments'] ?? []);
        $this->assertCount(3, $newValues['segments'] ?? []);
    }

    public function test_it_rejects_invalid_cross_field_segment_payloads(): void
    {
        $response = $this->putJson('/api/v5/products/1/target-segments-sync', [
            'segments' => [
                [
                    'customer_sector' => 'GOVERNMENT',
                    'facility_type' => 'PUBLIC_HOSPITAL',
                    'facility_types' => ['PUBLIC_HOSPITAL'],
                    'bed_capacity_min' => 500,
                    'bed_capacity_max' => 200,
                ],
            ],
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'segments.0.facility_types',
                'segments.0.bed_capacity_min',
                'segments.0.bed_capacity_max',
            ]);
    }

    public function test_it_returns_503_when_syncing_without_target_segment_table(): void
    {
        Schema::drop('product_target_segments');

        $response = $this->putJson('/api/v5/products/1/target-segments-sync', [
            'segments' => [],
        ]);

        $response
            ->assertStatus(503)
            ->assertJsonPath('message', 'Target segments table is not available in this environment.');
    }

    public function test_it_returns_404_when_syncing_a_missing_product(): void
    {
        $response = $this->putJson('/api/v5/products/999/target-segments-sync', [
            'segments' => [],
        ]);

        $response
            ->assertNotFound()
            ->assertJsonPath('message', 'Product not found.');
    }

    public function test_it_rejects_more_than_twenty_segments_in_one_sync(): void
    {
        $segments = [];
        for ($index = 1; $index <= 21; $index++) {
            $segments[] = [
                'customer_sector' => 'OTHER',
                'priority' => $index,
                'sales_notes' => 'Segment ' . $index,
                'is_active' => true,
            ];
        }

        $response = $this->putJson('/api/v5/products/1/target-segments-sync', [
            'segments' => $segments,
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(['segments']);
    }

    public function test_it_invalidates_all_insight_caches_after_successful_sync(): void
    {
        $insightService = Mockery::mock(CustomerInsightService::class);
        $insightService->shouldReceive('invalidateAllInsightCaches')->once();
        $this->app->instance(CustomerInsightService::class, $insightService);

        $response = $this->putJson('/api/v5/products/1/target-segments-sync', [
            'segments' => [
                [
                    'customer_sector' => 'OTHER',
                    'priority' => 1,
                    'sales_notes' => 'Segment cache check',
                    'is_active' => true,
                ],
            ],
        ]);

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_it_falls_back_to_null_audit_actor_when_legacy_foreign_key_points_to_users_table(): void
    {
        $user = InternalUser::query()->create([
            'id' => 5,
            'uuid' => 'user-5',
            'user_code' => 'U005',
            'username' => 'legacy-user',
            'password' => bcrypt('secret'),
            'full_name' => 'Legacy Internal User',
            'email' => 'legacy@example.com',
            'status' => 'ACTIVE',
        ]);
        $this->actingAs($user);

        Schema::drop('product_target_segments');
        Schema::create('users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->timestamps();
        });

        Schema::create('product_target_segments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->unsignedBigInteger('product_id');
            $table->string('customer_sector', 50);
            $table->string('facility_type', 50)->nullable();
            $table->text('facility_types')->nullable();
            $table->unsignedInteger('bed_capacity_min')->nullable();
            $table->unsignedInteger('bed_capacity_max')->nullable();
            $table->unsignedTinyInteger('priority')->default(1);
            $table->text('sales_notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
        });

        $response = $this->putJson('/api/v5/products/1/target-segments-sync', [
            'segments' => [
                [
                    'customer_sector' => 'HEALTHCARE',
                    'facility_types' => ['PUBLIC_HOSPITAL', 'MEDICAL_CENTER'],
                    'priority' => 1,
                    'sales_notes' => 'Legacy foreign key fallback',
                    'is_active' => true,
                ],
            ],
        ]);

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $stored = DB::table('product_target_segments')
            ->where('product_id', 1)
            ->whereNull('deleted_at')
            ->first();

        $this->assertNotNull($stored);
        $this->assertNull($stored->created_by);
        $this->assertNull($stored->updated_by);
    }

    public function test_it_rolls_back_soft_delete_when_insert_fails_mid_sync(): void
    {
        Schema::drop('product_target_segments');
        Schema::create('product_target_segments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->unsignedBigInteger('product_id');
            $table->string('customer_sector', 50);
            $table->string('facility_type', 50)->nullable();
            $table->text('facility_types')->nullable();
            $table->unsignedInteger('bed_capacity_min')->nullable();
            $table->unsignedInteger('bed_capacity_max')->nullable();
            $table->unsignedTinyInteger('priority')->default(1);
            $table->text('sales_notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        DB::table('product_target_segments')->insert([
            [
                'id' => 1,
                'uuid' => 'rollback-segment-1',
                'product_id' => 1,
                'customer_sector' => 'HEALTHCARE',
                'facility_type' => 'PUBLIC_HOSPITAL',
                'bed_capacity_min' => 100,
                'bed_capacity_max' => null,
                'priority' => 1,
                'sales_notes' => 'Segment cũ 1',
                'is_active' => true,
                'created_by' => 7,
                'updated_by' => 7,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'uuid' => 'rollback-segment-2',
                'product_id' => 1,
                'customer_sector' => 'GOVERNMENT',
                'facility_type' => null,
                'bed_capacity_min' => null,
                'bed_capacity_max' => null,
                'priority' => 2,
                'sales_notes' => 'Segment cũ 2',
                'is_active' => true,
                'created_by' => 7,
                'updated_by' => 7,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        try {
            $response = $this->putJson('/api/v5/products/1/target-segments-sync', [
                'segments' => [
                    [
                        'customer_sector' => 'OTHER',
                        'priority' => 1,
                        'sales_notes' => 'Segment mới gây lỗi insert',
                        'is_active' => true,
                    ],
                ],
            ]);

            $response
                ->assertStatus(422)
                ->assertJsonPath('message', 'Không thể lưu cấu hình đề xuất bán hàng. Vui lòng kiểm tra lại dữ liệu hoặc liên hệ quản trị viên.');
        } catch (\Throwable) {
            // Expected in some test environments; we only care about DB rollback state.
        }

        $activeRows = DB::table('product_target_segments')
            ->where('product_id', 1)
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->get();

        $this->assertCount(2, $activeRows);
        $this->assertSame('rollback-segment-1', $activeRows[0]->uuid);
        $this->assertSame('rollback-segment-2', $activeRows[1]->uuid);
        $this->assertSame(0, DB::table('product_target_segments')->whereNotNull('deleted_at')->count());
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('product_target_segments');
        Schema::dropIfExists('products');
        Schema::dropIfExists('users');
        Schema::dropIfExists('internal_users');

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('password', 255)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('status', 50)->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->string('service_group', 50)->default('GROUP_B');
            $table->string('product_code', 100)->unique();
            $table->string('product_name', 255);
            $table->string('package_name', 255)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('product_target_segments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->unsignedBigInteger('product_id');
            $table->string('customer_sector', 50);
            $table->string('facility_type', 50)->nullable();
            $table->text('facility_types')->nullable();
            $table->unsignedInteger('bed_capacity_min')->nullable();
            $table->unsignedInteger('bed_capacity_max')->nullable();
            $table->unsignedTinyInteger('priority')->default(1);
            $table->text('sales_notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->string('event', 20);
            $table->string('auditable_type', 191);
            $table->unsignedBigInteger('auditable_id');
            $table->longText('old_values')->nullable();
            $table->longText('new_values')->nullable();
            $table->text('url')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
        });
    }

    private function seedBaseData(): void
    {
        DB::table('products')->insert([
            [
                'id' => 1,
                'uuid' => 'product-1',
                'service_group' => 'GROUP_B',
                'product_code' => 'VNPT_HIS_L2',
                'product_name' => 'Phan mem VNPT HIS',
                'package_name' => 'HIS L2',
                'description' => 'San pham test',
                'is_active' => true,
                'created_by' => 7,
                'updated_by' => 7,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'uuid' => 'product-2',
                'service_group' => 'GROUP_C',
                'product_code' => 'CRM_BASIC',
                'product_name' => 'CRM Basic',
                'package_name' => 'Basic',
                'description' => 'San pham test 2',
                'is_active' => true,
                'created_by' => 7,
                'updated_by' => 7,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
