<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProductPackageCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_cruds_product_packages_and_syncs_product_package_flag(): void
    {
        $productResponse = $this->postJson('/api/v5/products', [
            'service_group' => 'GROUP_B',
            'product_code' => 'SP001',
            'product_name' => 'San pham goc',
            'domain_id' => 1,
            'vendor_id' => 1,
            'standard_price' => 1000000,
        ]);

        $productResponse
            ->assertCreated()
            ->assertJsonPath('data.has_product_packages', false);

        $createPackageResponse = $this->postJson('/api/v5/product-packages', [
            'product_id' => 1,
            'package_code' => 'PKG001',
            'standard_price' => 2500000,
            'unit' => 'Gói',
            'description' => 'Mo ta goi cuoc',
            'attachments' => [
                [
                    'id' => 'temp-1',
                    'fileName' => 'bang-gia-pkg.pdf',
                    'fileUrl' => 'https://example.test/attachments/bang-gia-pkg.pdf',
                    'fileSize' => 12345,
                    'mimeType' => 'application/pdf',
                    'createdAt' => '2026-04-08',
                    'storagePath' => 'documents/product-packages/bang-gia-pkg.pdf',
                    'storageDisk' => 'local',
                    'storageVisibility' => 'private',
                ],
            ],
        ]);

        $createPackageResponse
            ->assertCreated()
            ->assertJsonPath('data.package_code', 'PKG001')
            ->assertJsonPath('data.package_name', '')
            ->assertJsonPath('data.product_name', 'San pham goc')
            ->assertJsonPath('data.parent_product_code', 'SP001')
            ->assertJsonPath('data.attachments.0.fileName', 'bang-gia-pkg.pdf');

        $this->getJson('/api/v5/products')
            ->assertOk()
            ->assertJsonPath('data.0.has_product_packages', true);

        $this->getJson('/api/v5/product-packages')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.package_code', 'PKG001')
            ->assertJsonPath('data.0.product_name', 'San pham goc');

        $updatePackageResponse = $this->putJson('/api/v5/product-packages/1', [
            'package_name' => 'Goi cuoc 01 Plus',
            'attachments' => [
                [
                    'id' => 'temp-2',
                    'fileName' => 'mo-ta-pkg.docx',
                    'fileUrl' => 'https://example.test/attachments/mo-ta-pkg.docx',
                    'fileSize' => 6789,
                    'mimeType' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'createdAt' => '2026-04-08',
                    'storagePath' => 'documents/product-packages/mo-ta-pkg.docx',
                    'storageDisk' => 'local',
                    'storageVisibility' => 'private',
                ],
            ],
        ]);

        $updatePackageResponse
            ->assertOk()
            ->assertJsonPath('data.package_name', 'Goi cuoc 01 Plus')
            ->assertJsonPath('data.attachments.0.fileName', 'mo-ta-pkg.docx');

        $this->deleteJson('/api/v5/products/1')
            ->assertStatus(422)
            ->assertJsonPath('data.references.0.table', 'product_packages');

        $this->deleteJson('/api/v5/product-packages/1')
            ->assertOk()
            ->assertJsonPath('message', 'Product package deleted.');

        $this->getJson('/api/v5/products')
            ->assertOk()
            ->assertJsonPath('data.0.has_product_packages', false);
    }

    public function test_it_rejects_invalid_product_id_for_product_package(): void
    {
        $response = $this->postJson('/api/v5/product-packages', [
            'product_id' => 999,
            'package_code' => 'PKG002',
            'package_name' => 'Goi cuoc loi',
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonPath('message', 'product_id is invalid.');
    }

    public function test_it_bulk_imports_product_packages_and_reports_row_failures(): void
    {
        $this->postJson('/api/v5/products', [
            'service_group' => 'GROUP_B',
            'product_code' => 'SP001',
            'product_name' => 'San pham goc',
            'domain_id' => 1,
            'vendor_id' => 1,
            'standard_price' => 1000000,
        ])->assertCreated();

        $response = $this->postJson('/api/v5/product-packages/bulk', [
            'items' => [
                [
                    'product_id' => 1,
                    'package_code' => 'PKGBULK01',
                    'package_name' => 'Goi cuoc import 01',
                    'standard_price' => 3200000,
                    'unit' => 'Gói',
                    'description' => 'Mo ta goi cuoc import',
                ],
                [
                    'product_id' => 999,
                    'package_code' => 'PKGBULK02',
                    'package_name' => 'Goi cuoc import 02',
                ],
            ],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.created_count', 1)
            ->assertJsonPath('data.failed_count', 1)
            ->assertJsonPath('data.results.0.success', true)
            ->assertJsonPath('data.results.0.data.package_code', 'PKGBULK01')
            ->assertJsonPath('data.results.1.success', false)
            ->assertJsonPath('data.results.1.message', 'product_id is invalid.');

        $this->assertDatabaseHas('product_packages', [
            'package_code' => 'PKGBULK01',
            'package_name' => 'Goi cuoc import 01',
        ]);
        $this->assertDatabaseMissing('product_packages', [
            'package_code' => 'PKGBULK02',
        ]);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('product_packages');
        Schema::dropIfExists('products');
        Schema::dropIfExists('business_domains');
        Schema::dropIfExists('vendors');

        Schema::create('business_domains', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('domain_code', 50)->nullable();
            $table->string('domain_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('vendors', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('vendor_code', 50)->nullable();
            $table->string('vendor_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('products', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('service_group', 50)->default('GROUP_B');
            $table->string('product_code', 100)->unique();
            $table->string('product_name', 255);
            $table->string('package_name', 255)->nullable();
            $table->boolean('has_product_packages')->default(false);
            $table->unsignedBigInteger('domain_id');
            $table->unsignedBigInteger('vendor_id');
            $table->decimal('standard_price', 15, 2)->default(0);
            $table->string('unit', 50)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('product_packages', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('product_id');
            $table->string('package_code', 100)->unique();
            $table->string('package_name', 255);
            $table->decimal('standard_price', 15, 2)->default(0);
            $table->string('unit', 50)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('attachments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->enum('reference_type', ['DOCUMENT', 'PRODUCT', 'PRODUCT_PACKAGE']);
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('file_name', 255);
            $table->text('file_url')->nullable();
            $table->string('drive_file_id', 255)->nullable();
            $table->unsignedBigInteger('file_size')->default(0);
            $table->string('mime_type', 255)->nullable();
            $table->string('storage_disk', 50)->nullable();
            $table->string('storage_path', 1024)->nullable();
            $table->string('storage_visibility', 20)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        DB::table('business_domains')->insert([
            'id' => 1,
            'domain_code' => 'KD001',
            'domain_name' => 'Y te so',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('vendors')->insert([
            'id' => 1,
            'vendor_code' => 'NCC001',
            'vendor_name' => 'DMS',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
