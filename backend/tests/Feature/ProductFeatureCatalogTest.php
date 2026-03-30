<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProductFeatureCatalogTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->seedBaseData();
    }

    public function test_it_saves_loads_and_audits_product_feature_catalog(): void
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

        $initialResponse = $this->putJson('/api/v5/products/1/feature-catalog', [
            'groups' => [
                [
                    'group_name' => 'Quan tri he thong',
                    'notes' => 'Nhom quan tri',
                    'features' => [
                        [
                            'feature_name' => 'Dang nhap',
                            'detail_description' => 'Cho phep dang nhap vao he thong',
                            'status' => 'ACTIVE',
                        ],
                    ],
                ],
            ],
            'audit_context' => [
                'source' => 'FORM',
            ],
        ]);

        $initialResponse
            ->assertOk()
            ->assertJsonPath('data.product.id', 1)
            ->assertJsonPath('data.catalog_scope.package_count', 2)
            ->assertJsonPath('data.groups.0.group_name', 'Quan tri he thong')
            ->assertJsonPath('data.groups.0.features.0.feature_name', 'Dang nhap')
            ->assertJsonPath('data.groups.0.features.0.status', 'ACTIVE')
            ->assertJsonPath('data.audit_logs.0.event', 'INSERT')
            ->assertJsonPath('data.audit_logs.0.actor.full_name', 'Nguyen Van A')
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.source', 'FORM')
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.entries.0.message', 'Tạo phân hệ "Quan tri he thong".')
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.entries.1.message', 'Tạo chức năng "Dang nhap" trong phân hệ "Quan tri he thong".');

        $groupId = (int) DB::table('product_feature_groups')->value('id');
        $featureId = (int) DB::table('product_features')->value('id');

        $updateResponse = $this->putJson('/api/v5/products/1/feature-catalog', [
            'groups' => [
                [
                    'id' => $groupId,
                    'group_name' => 'Quan tri he thong',
                    'notes' => 'Nhom quan tri cap nhat',
                    'features' => [
                        [
                            'id' => $featureId,
                            'feature_name' => 'Dang nhap',
                            'detail_description' => 'Cap nhat mo ta tinh nang dang nhap',
                            'status' => 'INACTIVE',
                        ],
                        [
                            'feature_name' => 'Trang chu',
                            'detail_description' => 'Hien thi thong bao tong hop',
                            'status' => 'ACTIVE',
                        ],
                    ],
                ],
            ],
            'audit_context' => [
                'source' => 'FORM',
            ],
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.groups.0.notes', 'Nhom quan tri cap nhat')
            ->assertJsonPath('data.groups.0.features.0.status', 'INACTIVE')
            ->assertJsonPath('data.groups.0.features.1.feature_name', 'Trang chu')
            ->assertJsonPath('data.audit_logs.0.event', 'UPDATE')
            ->assertJsonPath('data.audit_logs.0.actor.username', 'tester')
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.source', 'FORM')
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.counts.groups_updated', 1)
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.counts.features_updated', 1)
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.counts.features_created', 1)
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.entries.0.message', 'Cập nhật phân hệ "Quan tri he thong".');

        $showResponse = $this->getJson('/api/v5/products/1/feature-catalog');

        $showResponse
            ->assertOk()
            ->assertJsonCount(1, 'data.groups')
            ->assertJsonCount(2, 'data.groups.0.features')
            ->assertJsonPath('data.groups.0.created_by_actor.full_name', 'Nguyen Van A')
            ->assertJsonPath('data.groups.0.features.0.updated_by_actor.username', 'tester');

        $this->assertSame('INACTIVE', DB::table('product_features')->where('id', $featureId)->value('status'));
        $this->assertSame(
            'UPDATE',
            DB::table('audit_logs')
                ->where('auditable_type', 'product_feature_catalogs')
                ->where('auditable_id', 1)
                ->orderByDesc('id')
                ->value('event')
        );
        $this->assertTrue(
            DB::table('audit_logs')
                ->where('auditable_type', 'product_features')
                ->where('auditable_id', $featureId)
                ->where('event', 'UPDATE')
                ->exists()
        );
    }

    public function test_it_records_import_context_in_catalog_audit_logs(): void
    {
        $user = InternalUser::query()->create([
            'id' => 11,
            'uuid' => 'user-11',
            'user_code' => 'U011',
            'username' => 'importer',
            'password' => bcrypt('secret'),
            'full_name' => 'Do Thi E',
            'email' => 'importer@example.com',
            'status' => 'ACTIVE',
        ]);
        $this->actingAs($user);

        $response = $this->putJson('/api/v5/products/1/feature-catalog', [
            'groups' => [
                [
                    'group_name' => 'Danh muc dung chung',
                    'features' => [
                        [
                            'feature_name' => 'Danh muc benh vien',
                            'detail_description' => 'Thong tin benh vien',
                            'status' => 'ACTIVE',
                        ],
                    ],
                ],
            ],
            'audit_context' => [
                'source' => 'IMPORT',
                'import_file_name' => 'HIS_ma_nhap_danh_muc.xls',
                'import_sheet_name' => 'ChucNang_His',
                'import_row_count' => 76,
                'import_group_count' => 3,
                'import_feature_count' => 76,
            ],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.source', 'IMPORT')
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.import.file_name', 'HIS_ma_nhap_danh_muc.xls')
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.import.sheet_name', 'ChucNang_His')
            ->assertJsonPath('data.audit_logs.0.new_values.change_summary.import.row_count', 76);

        $auditLog = DB::table('audit_logs')
            ->where('auditable_type', 'product_feature_catalogs')
            ->where('auditable_id', 1)
            ->latest('id')
            ->first();

        $this->assertNotNull($auditLog);

        $newValues = json_decode((string) $auditLog->new_values, true);
        $this->assertSame('IMPORT', $newValues['audit_context']['source'] ?? null);
        $this->assertSame('HIS_ma_nhap_danh_muc.xls', $newValues['audit_context']['import_file_name'] ?? null);
        $this->assertSame('ChucNang_His', $newValues['change_summary']['import']['sheet_name'] ?? null);
        $this->assertSame(76, $newValues['change_summary']['import']['feature_count'] ?? null);
    }

    public function test_it_shares_feature_catalog_across_packages_of_the_same_product(): void
    {
        $user = InternalUser::query()->create([
            'id' => 8,
            'uuid' => 'user-8',
            'user_code' => 'U008',
            'username' => 'tester2',
            'password' => bcrypt('secret'),
            'full_name' => 'Tran Thi B',
            'email' => 'tester2@example.com',
            'status' => 'ACTIVE',
        ]);
        $this->actingAs($user);

        $this->putJson('/api/v5/products/1/feature-catalog', [
            'groups' => [
                [
                    'group_name' => 'Kham benh',
                    'features' => [
                        [
                            'feature_name' => 'Dang ky kham',
                            'detail_description' => 'Tiep nhan va dang ky kham benh',
                            'status' => 'ACTIVE',
                        ],
                    ],
                ],
            ],
        ])->assertOk();

        $showResponse = $this->getJson('/api/v5/products/2/feature-catalog');

        $showResponse
            ->assertOk()
            ->assertJsonPath('data.product.id', 2)
            ->assertJsonPath('data.product.product_name', 'Phan mem VNPT HIS')
            ->assertJsonPath('data.catalog_scope.package_count', 2)
            ->assertJsonCount(2, 'data.catalog_scope.product_codes')
            ->assertJsonPath('data.groups.0.group_name', 'Kham benh')
            ->assertJsonPath('data.groups.0.features.0.feature_name', 'Dang ky kham');

        $groupId = (int) DB::table('product_feature_groups')->value('id');
        $featureId = (int) DB::table('product_features')->value('id');

        $this->putJson('/api/v5/products/2/feature-catalog', [
            'groups' => [
                [
                    'id' => $groupId,
                    'group_name' => 'Kham benh',
                    'features' => [
                        [
                            'id' => $featureId,
                            'feature_name' => 'Dang ky kham',
                            'detail_description' => 'Cap nhat tu goi khac',
                            'status' => 'INACTIVE',
                        ],
                    ],
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('data.groups.0.features.0.detail_description', 'Cap nhat tu goi khac')
            ->assertJsonPath('data.groups.0.features.0.status', 'INACTIVE');

        $this->assertSame(1, DB::table('product_feature_groups')->count());
        $this->assertSame(1, DB::table('product_features')->count());
        $this->assertSame('INACTIVE', DB::table('product_features')->where('id', $featureId)->value('status'));
    }

    public function test_it_rejects_duplicate_group_and_feature_names(): void
    {
        $user = InternalUser::query()->create([
            'id' => 9,
            'uuid' => 'user-9',
            'user_code' => 'U009',
            'username' => 'tester3',
            'password' => bcrypt('secret'),
            'full_name' => 'Le Van C',
            'email' => 'tester3@example.com',
            'status' => 'ACTIVE',
        ]);
        $this->actingAs($user);

        $response = $this->putJson('/api/v5/products/1/feature-catalog', [
            'groups' => [
                [
                    'group_name' => 'Quan tri he thong',
                    'features' => [
                        ['feature_name' => 'Dang nhap', 'detail_description' => 'A', 'status' => 'ACTIVE'],
                        ['feature_name' => 'Dang nhap', 'detail_description' => 'B', 'status' => 'ACTIVE'],
                    ],
                ],
                [
                    'group_name' => 'Quản trị hệ thống',
                    'features' => [],
                ],
            ],
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'groups.1.group_name',
                'groups.0.features.1.feature_name',
            ]);
    }

    public function test_it_rejects_deleting_a_group_that_still_has_child_features(): void
    {
        $user = InternalUser::query()->create([
            'id' => 10,
            'uuid' => 'user-10',
            'user_code' => 'U010',
            'username' => 'tester4',
            'password' => bcrypt('secret'),
            'full_name' => 'Pham Van D',
            'email' => 'tester4@example.com',
            'status' => 'ACTIVE',
        ]);
        $this->actingAs($user);

        $this->putJson('/api/v5/products/1/feature-catalog', [
            'groups' => [
                [
                    'group_name' => 'Quan tri he thong',
                    'features' => [
                        [
                            'feature_name' => 'Dang nhap',
                            'detail_description' => 'Cho phep dang nhap vao he thong',
                            'status' => 'ACTIVE',
                        ],
                    ],
                ],
            ],
        ])->assertOk();

        $response = $this->putJson('/api/v5/products/1/feature-catalog', [
            'groups' => [],
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(['groups']);

        $this->assertSame(1, DB::table('product_feature_groups')->whereNull('deleted_at')->count());
        $this->assertSame(1, DB::table('product_features')->whereNull('deleted_at')->count());
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('product_features');
        Schema::dropIfExists('product_feature_groups');
        Schema::dropIfExists('products');
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
            $table->unsignedBigInteger('department_id')->nullable();
            $table->unsignedBigInteger('position_id')->nullable();
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

        Schema::create('product_feature_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->unsignedBigInteger('product_id');
            $table->string('group_name', 255);
            $table->unsignedInteger('display_order')->default(1);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('product_features', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('group_id');
            $table->string('feature_name', 255);
            $table->longText('detail_description')->nullable();
            $table->string('status', 20)->default('ACTIVE');
            $table->unsignedInteger('display_order')->default(1);
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
        ]);

        DB::table('products')->insert([
            'id' => 2,
            'uuid' => 'product-2',
            'service_group' => 'GROUP_B',
            'product_code' => 'VNPT_HIS_L3',
            'product_name' => 'Phan mem VNPT HIS',
            'package_name' => 'HIS L3',
            'description' => 'San pham test goi 2',
            'is_active' => true,
            'created_by' => 7,
            'updated_by' => 7,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
