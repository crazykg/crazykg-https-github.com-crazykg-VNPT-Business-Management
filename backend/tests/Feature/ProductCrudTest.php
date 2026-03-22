<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProductCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_creates_lists_and_updates_products_with_service_group(): void
    {
        $createResponse = $this->postJson('/api/v5/products', [
            'service_group' => 'GROUP_C',
            'product_code' => 'SP001',
            'product_name' => 'San pham 01',
            'domain_id' => 1,
            'vendor_id' => 1,
            'standard_price' => 150000000,
            'unit' => 'Goi',
            'description' => 'Mo ta san pham',
            'attachments' => [
                [
                    'id' => 'temp-1',
                    'fileName' => 'bang-gia.pdf',
                    'fileUrl' => 'https://example.test/attachments/bang-gia.pdf',
                    'fileSize' => 12345,
                    'mimeType' => 'application/pdf',
                    'createdAt' => '2026-03-22',
                    'storagePath' => 'documents/products/bang-gia.pdf',
                    'storageDisk' => 'local',
                    'storageVisibility' => 'private',
                ],
            ],
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.id', 1)
            ->assertJsonPath('data.service_group', 'GROUP_C')
            ->assertJsonPath('data.product_code', 'SP001')
            ->assertJsonPath('data.product_name', 'San pham 01')
            ->assertJsonPath('data.attachments.0.fileName', 'bang-gia.pdf');

        $defaultGroupResponse = $this->postJson('/api/v5/products', [
            'product_code' => 'SP002',
            'product_name' => 'San pham 02',
            'domain_id' => 1,
            'vendor_id' => 1,
        ]);

        $defaultGroupResponse
            ->assertCreated()
            ->assertJsonPath('data.service_group', 'GROUP_B');

        $listResponse = $this->getJson('/api/v5/products');

        $listResponse
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.service_group', 'GROUP_C')
            ->assertJsonPath('data.0.attachments.0.fileName', 'bang-gia.pdf')
            ->assertJsonPath('data.1.service_group', 'GROUP_B');

        $updateResponse = $this->putJson('/api/v5/products/2', [
            'service_group' => 'GROUP_A',
            'product_name' => 'San pham 02 moi',
            'attachments' => [
                [
                    'id' => 'temp-2',
                    'fileName' => 'mo-ta.docx',
                    'fileUrl' => 'https://example.test/attachments/mo-ta.docx',
                    'fileSize' => 6789,
                    'mimeType' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'createdAt' => '2026-03-22',
                    'storagePath' => 'documents/products/mo-ta.docx',
                    'storageDisk' => 'local',
                    'storageVisibility' => 'private',
                ],
            ],
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.id', 2)
            ->assertJsonPath('data.service_group', 'GROUP_A')
            ->assertJsonPath('data.product_name', 'San pham 02 moi')
            ->assertJsonPath('data.attachments.0.fileName', 'mo-ta.docx');

        $this->assertSame('GROUP_A', DB::table('products')->where('id', 2)->value('service_group'));
        $this->assertSame(
            'bang-gia.pdf',
            DB::table('attachments')
                ->where('reference_type', 'PRODUCT')
                ->where('reference_id', 1)
                ->value('file_name')
        );
        $this->assertSame(
            'mo-ta.docx',
            DB::table('attachments')
                ->where('reference_type', 'PRODUCT')
                ->where('reference_id', 2)
                ->value('file_name')
        );
    }

    public function test_it_rejects_invalid_service_group(): void
    {
        $response = $this->postJson('/api/v5/products', [
            'service_group' => 'GROUP_Z',
            'product_code' => 'SP003',
            'product_name' => 'San pham 03',
            'domain_id' => 1,
            'vendor_id' => 1,
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(['service_group']);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('attachments');
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

        Schema::create('attachments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->enum('reference_type', ['DOCUMENT', 'PRODUCT']);
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
