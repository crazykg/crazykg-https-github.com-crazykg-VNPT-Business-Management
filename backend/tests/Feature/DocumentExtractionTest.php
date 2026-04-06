<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentExtractionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();

        DB::table('departments')->insert([
            'id' => 1,
            'dept_code' => 'P01',
            'dept_name' => 'Phong 1',
        ]);

        DB::table('internal_users')->insert([
            'id' => 1,
            'username' => 'tester',
            'full_name' => 'Test User',
            'password' => bcrypt('secret'),
            'department_id' => 1,
        ]);

        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    public function test_documents_can_store_list_update_and_soft_delete_via_api(): void
    {
        DB::table('customers')->insert([
            'id' => 5,
            'customer_code' => 'C05',
            'customer_name' => 'Khach Hang A',
        ]);

        DB::table('projects')->insert([
            'id' => 7,
            'project_code' => 'P07',
            'project_name' => 'Du an 7',
            'dept_id' => 1,
        ]);

        DB::table('products')->insert([
            'id' => 9,
            'product_code' => 'PRD09',
            'product_name' => 'San pham 9',
        ]);

        DB::table('document_types')->insert([
            'id' => 3,
            'type_code' => 'LEGAL',
            'type_name' => 'Phap ly',
            'created_at' => now(),
        ]);

        $createResponse = $this->postJson('/api/v5/documents', [
            'id' => 'DOC-001',
            'name' => 'Tai lieu 1',
            'typeId' => 'LEGAL',
            'customerId' => 5,
            'projectId' => 7,
            'commissionPolicyText' => 'Hoa hồng 12% cho đại lý hạng A',
            'expiryDate' => '2026-12-31',
            'status' => 'ACTIVE',
            'productIds' => [9],
            'attachments' => [
                [
                    'id' => 'temp-1',
                    'fileName' => 'manual.pdf',
                    'fileUrl' => '/temp/manual.pdf',
                    'fileSize' => 123,
                    'mimeType' => 'application/pdf',
                ],
            ],
        ])->assertCreated();

        $createResponse
            ->assertJsonPath('data.id', 'DOC-001')
            ->assertJsonPath('data.name', 'Tai lieu 1')
            ->assertJsonPath('data.typeId', 'LEGAL')
            ->assertJsonPath('data.customerId', '5')
            ->assertJsonPath('data.projectId', '7')
            ->assertJsonPath('data.commissionPolicyText', 'Hoa hồng 12% cho đại lý hạng A')
            ->assertJsonPath('data.productIds.0', '9')
            ->assertJsonPath('data.attachments.0.fileName', 'manual.pdf');

        $this->getJson('/api/v5/documents')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 'DOC-001');

        $updateResponse = $this->putJson('/api/v5/documents/DOC-001', [
            'name' => 'Tai lieu 1 updated',
            'commissionPolicyText' => 'Hoa hồng 15% cho đại lý hạng A',
            'status' => 'SUSPENDED',
            'attachments' => [
                [
                    'id' => 'temp-2',
                    'fileName' => 'manual-v2.pdf',
                    'fileUrl' => '/temp/manual-v2.pdf',
                    'fileSize' => 456,
                    'mimeType' => 'application/pdf',
                ],
            ],
        ])->assertOk();

        $updateResponse
            ->assertJsonPath('data.name', 'Tai lieu 1 updated')
            ->assertJsonPath('data.commissionPolicyText', 'Hoa hồng 15% cho đại lý hạng A')
            ->assertJsonPath('data.status', 'SUSPENDED')
            ->assertJsonPath('data.attachments.0.fileName', 'manual-v2.pdf');

        $this->deleteJson('/api/v5/documents/DOC-001')
            ->assertOk()
            ->assertJsonPath('message', 'Document deleted.');

        $this->assertNotNull(DB::table('documents')->where('id', 1)->value('deleted_at'));
        $this->getJson('/api/v5/documents')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_document_upload_and_download_work_for_local_storage(): void
    {
        Storage::fake('local');

        $uploadResponse = $this->postJson('/api/v5/documents/upload-attachment', [
            'file' => UploadedFile::fake()->create('manual.pdf', 10, 'application/pdf'),
        ])->assertOk();

        $uploadResponse
            ->assertJsonPath('data.fileName', 'manual.pdf')
            ->assertJsonPath('data.storageProvider', 'LOCAL')
            ->assertJsonPath('data.storageDisk', 'local');

        $fileUrl = $uploadResponse->json('data.fileUrl');
        $storagePath = $uploadResponse->json('data.storagePath');
        $this->assertIsString($fileUrl);
        $this->assertIsString($storagePath);
        $this->assertTrue(Storage::disk('local')->exists($storagePath));

        $this->get($fileUrl)
            ->assertOk();

        $this->deleteJson('/api/v5/documents/upload-attachment', [
            'storagePath' => $storagePath,
            'storageDisk' => 'local',
            'fileUrl' => $fileUrl,
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Đã xóa file đính kèm.');

        Storage::disk('local')->assertMissing($storagePath);
    }

    public function test_product_pricing_documents_can_store_and_update_without_customer_id_when_column_is_nullable(): void
    {
        DB::table('products')->insert([
            'id' => 9,
            'product_code' => 'PRD09',
            'product_name' => 'San pham 9',
        ]);

        $createResponse = $this->postJson('/api/v5/documents', [
            'scope' => 'PRODUCT_PRICING',
            'id' => 'PRICE-001',
            'name' => 'Bang gia thang 04',
            'releaseDate' => '2026-04-05',
            'status' => 'ACTIVE',
            'productIds' => [9],
            'attachments' => [
                [
                    'id' => 'temp-price-1',
                    'fileName' => 'bang-gia.png',
                    'fileUrl' => '/temp/bang-gia.png',
                    'fileSize' => 321,
                    'mimeType' => 'image/png',
                ],
            ],
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.id', 'PRICE-001')
            ->assertJsonPath('data.name', 'Bang gia thang 04')
            ->assertJsonPath('data.typeId', 'DT_PRICING')
            ->assertJsonPath('data.customerId', '')
            ->assertJsonPath('data.productIds.0', '9')
            ->assertJsonPath('data.attachments.0.fileName', 'bang-gia.png');

        $this->assertNull(DB::table('documents')->where('id', 1)->value('customer_id'));

        $updateResponse = $this->putJson('/api/v5/documents/PRICE-001', [
            'scope' => 'PRODUCT_PRICING',
            'name' => 'Bang gia thang 04 cap nhat',
            'commissionPolicyText' => 'Hoa hong 10%',
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.id', 'PRICE-001')
            ->assertJsonPath('data.name', 'Bang gia thang 04 cap nhat')
            ->assertJsonPath('data.customerId', '')
            ->assertJsonPath('data.commissionPolicyText', 'Hoa hong 10%');

        $this->assertNull(DB::table('documents')->where('id', 1)->value('customer_id'));
        $this->assertSame('Bang gia thang 04 cap nhat', DB::table('documents')->where('id', 1)->value('document_name'));
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('document_product_links');
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('document_types');
        Schema::dropIfExists('products');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('user_dept_scopes');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('departments');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code')->nullable();
            $table->string('dept_name')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('username')->nullable();
            $table->string('full_name')->nullable();
            $table->string('password')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
        });

        Schema::create('roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('role_code')->nullable();
        });

        Schema::create('user_roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('role_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
        });

        Schema::create('user_dept_scopes', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('dept_id');
            $table->string('scope_type')->nullable();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_code')->nullable();
            $table->string('customer_name')->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_code')->nullable();
            $table->string('project_name')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->unsignedBigInteger('opportunity_id')->nullable();
        });

        Schema::create('products', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('product_code')->nullable();
            $table->string('product_name')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('document_types', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('type_code')->nullable();
            $table->string('type_name')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('documents', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('document_code')->nullable();
            $table->string('document_name')->nullable();
            $table->text('commission_policy_text')->nullable();
            $table->unsignedBigInteger('document_type_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('status')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('attachments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('file_name')->nullable();
            $table->text('file_url')->nullable();
            $table->string('drive_file_id')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('mime_type')->nullable();
            $table->string('storage_disk')->nullable();
            $table->string('storage_path')->nullable();
            $table->string('storage_visibility')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('document_product_links', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('document_id');
            $table->unsignedBigInteger('product_id');
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
        });
    }
}
