<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProductPackageFeatureCatalogTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->seedBaseData();
    }

    public function test_it_updates_and_lists_product_package_feature_catalog(): void
    {
        $this->getJson('/api/v5/product-packages/1/feature-catalog')
            ->assertOk()
            ->assertJsonPath('data.product.product_code', 'PKG-HIS-01')
            ->assertJsonPath('data.product.product_name', 'Goi HIS nang cao')
            ->assertJsonCount(0, 'data.groups');

        $this->putJson('/api/v5/product-packages/1/feature-catalog', [
            'groups' => [
                [
                    'group_name' => 'Quan tri he thong',
                    'notes' => 'Nhom nen tang',
                    'features' => [
                        [
                            'feature_name' => 'Dang nhap package',
                            'detail_description' => 'Dang nhap theo bo chuc nang goi cuoc',
                            'status' => 'ACTIVE',
                        ],
                    ],
                ],
            ],
            'audit_context' => [
                'source' => 'FORM',
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.groups.0.group_name', 'Quan tri he thong')
            ->assertJsonPath('data.groups.0.features.0.feature_name', 'Dang nhap package')
            ->assertJsonPath('data.audit_logs.0.auditable_type', 'product_package_feature_catalogs');

        $this->getJson('/api/v5/product-packages/1/feature-catalog/list')
            ->assertOk()
            ->assertJsonPath('data.group_filters.0.group_name', 'Quan tri he thong')
            ->assertJsonPath('data.rows.0.row_type', 'group')
            ->assertJsonPath('data.rows.1.row_type', 'feature')
            ->assertJsonPath('data.rows.1.name', 'Dang nhap package');
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('product_package_features');
        Schema::dropIfExists('product_package_feature_groups');
        Schema::dropIfExists('product_packages');
        Schema::dropIfExists('products');

        Schema::create('products', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('product_code', 100)->unique();
            $table->string('product_name', 255);
            $table->string('service_group', 50)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('product_packages', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->unsignedBigInteger('product_id');
            $table->string('package_code', 100)->unique();
            $table->string('package_name', 255);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('product_package_feature_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->unsignedBigInteger('package_id');
            $table->string('group_name', 255);
            $table->unsignedInteger('display_order')->default(1);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('product_package_features', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->unsignedBigInteger('package_id');
            $table->unsignedBigInteger('group_id');
            $table->string('feature_name', 255);
            $table->longText('detail_description')->nullable();
            $table->string('status', 20)->default('ACTIVE');
            $table->unsignedInteger('display_order')->default(1);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
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
        now();

        \Illuminate\Support\Facades\DB::table('products')->insert([
            'id' => 1,
            'product_code' => 'SP001',
            'product_name' => 'San pham HIS',
            'service_group' => 'GROUP_B',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        \Illuminate\Support\Facades\DB::table('product_packages')->insert([
            'id' => 1,
            'uuid' => 'pkg-1',
            'product_id' => 1,
            'package_code' => 'PKG-HIS-01',
            'package_name' => 'Goi HIS nang cao',
            'description' => 'Goi cuoc test',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
