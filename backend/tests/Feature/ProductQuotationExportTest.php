<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;
use ZipArchive;

class ProductQuotationExportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        Carbon::setTestNow(Carbon::create(2026, 3, 25, 10, 30, 0));
        $this->setUpSchema();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_it_exports_product_quotation_as_word_document(): void
    {
        $response = $this->post('/api/v5/products/quotation/export-word', $this->quotationPayload());
        $contentDisposition = (string) $response->headers->get('content-disposition');

        $response->assertOk();
        $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        $this->assertStringContainsString('.docx', $contentDisposition);
        $this->assertStringContainsString(
            rawurlencode('Báo giá BỆNH VIỆN ĐA KHOA CẦN THƠ 2026 03 25.docx'),
            $contentDisposition
        );

        $binary = $response->getContent();
        $this->assertIsString($binary);
        $this->assertNotSame('', $binary);

        $tempFile = tempnam(sys_get_temp_dir(), 'quote_word_');
        $this->assertNotFalse($tempFile);
        file_put_contents($tempFile, $binary);

        $zip = new ZipArchive();
        $this->assertTrue($zip->open($tempFile) === true);

        $documentXml = $zip->getFromName('word/document.xml');
        $zip->close();
        @unlink($tempFile);

        $this->assertIsString($documentXml);
        $this->assertStringContainsString('BÁO GIÁ', $documentXml);
        $this->assertStringContainsString('BỆNH VIỆN ĐA KHOA CẦN THƠ', $documentXml);
        $this->assertStringContainsString('VNPT HIS Cloud', $documentXml);
        $this->assertStringContainsString('TỔNG CỘNG SAU THUẾ', $documentXml);
        $this->assertStringContainsString('Cần Thơ, ngày ....... tháng 03 năm 2026', $documentXml);
        $this->assertStringContainsString('232.100.000', $documentXml);
        $this->assertStringContainsString('PHAN VĂN RỞ', $documentXml);
        $this->assertStringContainsString('<w:pgSz w:w="11907" w:h="16840" w:orient="portrait"/>', $documentXml);
        $this->assertStringContainsString('<w:pgMar w:top="810" w:right="1134" w:bottom="1134" w:left="1134"', $documentXml);
        $this->assertStringContainsString('<w:tblW w:w="9639" w:type="dxa"/>', $documentXml);
        $this->assertStringContainsString('<w:tblGrid><w:gridCol w:w="2656"/><w:gridCol w:w="6983"/></w:tblGrid>', $documentXml);
        $this->assertStringContainsString('<wp:extent cx="1450000" cy="457344"/>', $documentXml);
        $this->assertStringContainsString('<w:sz w:val="24"/>', $documentXml);
        $this->assertStringNotContainsString('<w:tblInd w:w="-612" w:type="dxa"/>', $documentXml);
        $this->assertGreaterThanOrEqual(4, substr_count($documentXml, '<w:spacing w:before="0" w:after="120"/>'));
    }

    public function test_it_exports_product_quotation_as_pdf_document(): void
    {
        $response = $this->post('/api/v5/products/quotation/export-pdf', $this->quotationPayload());
        $contentDisposition = (string) $response->headers->get('content-disposition');

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
        $this->assertStringContainsString('.pdf', $contentDisposition);
        $this->assertStringContainsString('inline;', $contentDisposition);
        $this->assertStringContainsString(
            rawurlencode('Báo giá BỆNH VIỆN ĐA KHOA CẦN THƠ 2026 03 25.pdf'),
            $contentDisposition
        );

        $content = $response->getContent();
        $this->assertIsString($content);
        $this->assertStringStartsWith('%PDF-', $content);
        $this->assertTrue(
            str_contains($content, '/Type/Page') || str_contains($content, '/Type /Page'),
            'Expected exported PDF to contain a page object marker.'
        );
        $this->assertStringContainsString('/MediaBox', $content);
    }

    public function test_it_switches_to_the_multi_vat_word_template_when_line_vat_rates_differ(): void
    {
        $response = $this->post('/api/v5/products/quotation/export-word', $this->quotationPayloadWithMixedVat());

        $response->assertOk();

        $binary = $response->getContent();
        $this->assertIsString($binary);
        $this->assertNotSame('', $binary);

        $tempFile = tempnam(sys_get_temp_dir(), 'quote_word_multi_vat_');
        $this->assertNotFalse($tempFile);
        file_put_contents($tempFile, $binary);

        $zip = new ZipArchive();
        $this->assertTrue($zip->open($tempFile) === true);

        $documentXml = $zip->getFromName('word/document.xml');
        $zip->close();
        @unlink($tempFile);

        $this->assertIsString($documentXml);
        $this->assertStringContainsString('THUẾ GTGT', $documentXml);
        $this->assertStringContainsString('TỔNG TIỀN TRƯỚC THUẾ', $documentXml);
        $this->assertStringContainsString('TỔNG CỘNG', $documentXml);
        $this->assertStringContainsString('Thuế 8%', $documentXml);
        $this->assertStringContainsString('Thuế 10%', $documentXml);
        $this->assertStringContainsString('r:id="rId3"', $documentXml);
        $this->assertStringContainsString('r:embed="rId6"', $documentXml);
        $this->assertStringContainsString('198.000.000', $documentXml);
        $this->assertStringContainsString('2.480.000', $documentXml);
        $this->assertStringContainsString('231.480.000', $documentXml);
    }

    public function test_it_appends_feature_catalog_appendices_for_each_quotation_item(): void
    {
        $response = $this->post('/api/v5/products/quotation/export-word', $this->quotationPayload());

        $response->assertOk();

        $binary = $response->getContent();
        $this->assertIsString($binary);
        $this->assertNotSame('', $binary);

        $tempFile = tempnam(sys_get_temp_dir(), 'quote_word_appendix_');
        $this->assertNotFalse($tempFile);
        file_put_contents($tempFile, $binary);

        $zip = new ZipArchive();
        $this->assertTrue($zip->open($tempFile) === true);

        $documentXml = $zip->getFromName('word/document.xml');
        $zip->close();
        @unlink($tempFile);

        $this->assertIsString($documentXml);
        $this->assertStringContainsString('PHỤ LỤC 1', $documentXml);
        $this->assertStringContainsString('PHỤ LỤC 2', $documentXml);
        $this->assertStringContainsString('VNPT HIS CLOUD', $documentXml);
        $this->assertStringContainsString('VNPT EMR', $documentXml);
        $this->assertStringContainsString('Tinh nang package HIS', $documentXml);
        $this->assertStringContainsString('Dang nhap package', $documentXml);
        $this->assertStringContainsString('Quản lý hồ sơ bệnh án', $documentXml);
        $this->assertStringContainsString('Bệnh án điện tử', $documentXml);
        $this->assertStringNotContainsString('Quản trị hệ thống (Quản lý người dùng, quản lý cấu hình)', $documentXml);
        $this->assertStringNotContainsString('Đăng nhập', $documentXml);
        $this->assertStringNotContainsString('Trang chủ', $documentXml);
        $this->assertStringContainsString('Đính kèm báo giá ngày 25/03/2026', $documentXml);
        $this->assertStringContainsString('Trung tâm Kinh doanh Giải pháp – VNPT Cần Thơ', $documentXml);
        $this->assertStringContainsString('phát hành đến BỆNH VIỆN ĐA KHOA CẦN THƠ', $documentXml);
        $this->assertStringContainsString('Danh mục chức năng', $documentXml);
        $this->assertStringContainsString('Mô tả chi tiết', $documentXml);
        $this->assertStringContainsString('w:trHeight w:val="575" w:hRule="atLeast"', $documentXml);
        $this->assertStringContainsString('w:trHeight w:val="315" w:hRule="atLeast"', $documentXml);
        $this->assertStringContainsString('<w:tcMar><w:top w:w="30" w:type="dxa"/><w:left w:w="45" w:type="dxa"/><w:bottom w:w="30" w:type="dxa"/><w:right w:w="45" w:type="dxa"/></w:tcMar>', $documentXml);
    }

    public function test_it_uses_product_feature_appendix_when_package_id_is_not_selected(): void
    {
        $payload = $this->quotationPayload();
        $payload['items'] = [[
            'product_id' => 1,
            'product_name' => 'VNPT HIS Cloud',
            'unit' => 'Gói/Năm',
            'quantity' => 1,
            'unit_price' => 180000000,
            'vat_rate' => 10,
            'note' => "Theo gói tiêu chuẩn\nBao gồm triển khai cơ bản",
        ]];

        $response = $this->post('/api/v5/products/quotation/export-word', $payload);

        $response->assertOk();

        $binary = $response->getContent();
        $this->assertIsString($binary);
        $this->assertNotSame('', $binary);

        $tempFile = tempnam(sys_get_temp_dir(), 'quote_word_product_catalog_');
        $this->assertNotFalse($tempFile);
        file_put_contents($tempFile, $binary);

        $zip = new ZipArchive();
        $this->assertTrue($zip->open($tempFile) === true);

        $documentXml = $zip->getFromName('word/document.xml');
        $zip->close();
        @unlink($tempFile);

        $this->assertIsString($documentXml);
        $this->assertStringContainsString('VNPT HIS CLOUD', $documentXml);
        $this->assertStringContainsString('Quản trị hệ thống (Quản lý người dùng, quản lý cấu hình)', $documentXml);
        $this->assertStringContainsString('Đăng nhập', $documentXml);
        $this->assertStringContainsString('Trang chủ', $documentXml);
        $this->assertStringNotContainsString('Tinh nang package HIS', $documentXml);
        $this->assertStringNotContainsString('Dang nhap package', $documentXml);
    }

    public function test_it_falls_back_to_product_package_feature_appendix_when_product_catalog_is_empty(): void
    {
        $response = $this->post('/api/v5/products/quotation/export-word', $this->quotationPayloadForPackageFallback());

        $response->assertOk();

        $binary = $response->getContent();
        $this->assertIsString($binary);
        $this->assertNotSame('', $binary);

        $tempFile = tempnam(sys_get_temp_dir(), 'quote_word_package_fallback_');
        $this->assertNotFalse($tempFile);
        file_put_contents($tempFile, $binary);

        $zip = new ZipArchive();
        $this->assertTrue($zip->open($tempFile) === true);

        $documentXml = $zip->getFromName('word/document.xml');
        $zip->close();
        @unlink($tempFile);

        $this->assertIsString($documentXml);
        $this->assertStringContainsString('VNPT LIS', $documentXml);
        $this->assertStringContainsString('Tinh nang package LIS', $documentXml);
        $this->assertStringContainsString('Dang nhap package LIS', $documentXml);
        $this->assertStringNotContainsString('Chưa cấu hình danh sách tính năng', $documentXml);
    }

    public function test_it_exports_product_quotation_as_excel_document(): void
    {
        $response = $this->post('/api/v5/products/quotation/export-excel', $this->quotationPayload());
        $contentDisposition = (string) $response->headers->get('content-disposition');

        $response->assertOk();
        $response->assertHeader('content-type', 'application/vnd.ms-excel; charset=UTF-8');
        $this->assertStringContainsString('.xls', $contentDisposition);
        $this->assertStringContainsString(
            rawurlencode('Báo giá BỆNH VIỆN ĐA KHOA CẦN THƠ 2026 03 25.xls'),
            $contentDisposition
        );

        $content = $response->getContent();
        $this->assertIsString($content);
        $this->assertStringContainsString('Excel.Sheet', $content);
        $this->assertStringContainsString('BÁO GIÁ', $content);
        $this->assertStringContainsString('BỆNH VIỆN ĐA KHOA CẦN THƠ', $content);
        $this->assertStringContainsString('VNPT HIS Cloud', $content);
        $this->assertStringContainsString('TỔNG CỘNG SAU THUẾ', $content);
        $this->assertStringContainsString('232.100.000', $content);
        $this->assertStringContainsString('PHAN VĂN RỞ', $content);
        $this->assertStringContainsString('<Font ss:FontName="Times New Roman" ss:Size="12"/>', $content);
    }

    public function test_it_validates_required_quotation_fields_before_exporting(): void
    {
        $payload = $this->quotationPayload();
        $payload['recipient_name'] = '';
        $payload['items'] = [];

        $response = $this->postJson('/api/v5/products/quotation/export-word', $payload);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['recipient_name', 'items']);
    }

    public function test_it_rejects_duplicate_work_item_and_unit_price_combinations(): void
    {
        $payload = $this->quotationPayload();
        $payload['items'][] = [
            'product_id' => 1,
            'product_name' => 'VNPT HIS Cloud',
            'unit' => 'Gói/Năm',
            'quantity' => 2,
            'unit_price' => 180000000,
            'note' => 'Dòng trùng để kiểm thử validation',
        ];

        $response = $this->postJson('/api/v5/products/quotation/export-word', $payload);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['items']);
        $response->assertJsonPath(
            'errors.items.0',
            'Không được trùng hạng mục công việc với cùng đơn giá trong một báo giá.'
        );
    }

    private function quotationPayload(): array
    {
        return [
            'recipient_name' => 'BỆNH VIỆN ĐA KHOA CẦN THƠ',
            'sender_city' => 'Cần Thơ',
            'scope_summary' => 'phục vụ nâng cấp hệ thống bệnh án điện tử và phần mềm điều hành bệnh viện',
            'vat_rate' => 10,
            'validity_days' => 90,
            'notes_text' => implode("\n", [
                'Giá đã bao gồm chi phí vận hành cơ bản.',
                'Chưa bao gồm tích hợp ngoài phạm vi chuẩn.',
            ]),
            'contact_line' => 'Ông Nguyễn Văn A - Chuyên viên giải pháp - Trung tâm Kinh doanh Giải pháp - 0912.345.678.',
            'closing_message' => 'Rất mong nhận được sự hợp tác từ Quý đơn vị.',
            'signatory_title' => 'GIÁM ĐỐC',
            'signatory_unit' => 'TRUNG TÂM KINH DOANH GIẢI PHÁP',
            'signatory_name' => 'PHAN VĂN RỞ',
            'items' => [
                [
                    'product_id' => 1,
                    'package_id' => 10,
                    'product_name' => 'VNPT HIS Cloud',
                    'unit' => 'Gói/Năm',
                    'quantity' => 1,
                    'unit_price' => 180000000,
                    'vat_rate' => 10,
                    'note' => "Theo gói tiêu chuẩn\nBao gồm triển khai cơ bản",
                ],
                [
                    'product_id' => 2,
                    'package_id' => 11,
                    'product_name' => 'VNPT EMR',
                    'unit' => 'Gói',
                    'quantity' => 1,
                    'unit_price' => 31000000,
                    'vat_rate' => 10,
                    'note' => 'Theo phụ lục 02',
                ],
            ],
        ];
    }

    private function quotationPayloadWithMixedVat(): array
    {
        $payload = $this->quotationPayload();
        $payload['items'][1]['vat_rate'] = 8;

        return $payload;
    }

    private function quotationPayloadForPackageFallback(): array
    {
        $payload = $this->quotationPayload();
        $payload['items'] = [[
            'product_id' => 3,
            'product_name' => 'VNPT LIS',
            'unit' => 'Gói',
            'quantity' => 1,
            'unit_price' => 15000000,
            'vat_rate' => 10,
            'note' => 'Theo phụ lục package fallback',
        ]];

        return $payload;
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('product_package_features');
        Schema::dropIfExists('product_package_feature_groups');
        Schema::dropIfExists('product_packages');
        Schema::dropIfExists('product_features');
        Schema::dropIfExists('product_feature_groups');
        Schema::dropIfExists('products');

        Schema::create('products', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('product_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        DB::table('products')->insert([
            ['id' => 1, 'product_name' => 'VNPT HIS Cloud', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'product_name' => 'VNPT EMR', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'product_name' => 'VNPT LIS', 'created_at' => now(), 'updated_at' => now()],
        ]);

        Schema::create('product_feature_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('product_id');
            $table->string('group_name', 255);
            $table->integer('display_order')->default(0);
            $table->timestamps();
        });

        Schema::create('product_features', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('group_id');
            $table->text('feature_name');
            $table->text('detail_description')->nullable();
            $table->integer('display_order')->default(0);
            $table->string('status', 20)->default('ACTIVE');
            $table->timestamps();
        });

        Schema::create('product_packages', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('product_id');
            $table->string('package_code', 100)->nullable();
            $table->string('package_name', 255)->nullable();
            $table->decimal('standard_price', 18, 2)->default(0.00);
            $table->string('unit', 100)->nullable();
            $table->text('description')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('product_package_feature_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('package_id');
            $table->string('group_name', 255);
            $table->integer('display_order')->default(0);
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('product_package_features', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('package_id');
            $table->unsignedBigInteger('group_id');
            $table->text('feature_name');
            $table->text('detail_description')->nullable();
            $table->integer('display_order')->default(0);
            $table->string('status', 20)->default('ACTIVE');
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        DB::table('product_feature_groups')->insert([
            [
                'id' => 1,
                'product_id' => 1,
                'group_name' => 'Quản trị hệ thống (Quản lý người dùng, quản lý cấu hình)',
                'display_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'product_id' => 2,
                'group_name' => 'Bệnh án điện tử',
                'display_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('product_features')->insert([
            [
                'product_id' => 1,
                'group_id' => 1,
                'feature_name' => 'Đăng nhập',
                'detail_description' => "Nhập thông tin tài khoản\n- Kiểm tra OTP",
                'display_order' => 1,
                'status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'product_id' => 1,
                'group_id' => 1,
                'feature_name' => 'Trang chủ',
                'detail_description' => "Hiển thị thông tin trang chủ\n- Kiểm tra các thông tin thông báo",
                'display_order' => 2,
                'status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'product_id' => 2,
                'group_id' => 2,
                'feature_name' => 'Quản lý hồ sơ bệnh án',
                'detail_description' => 'Tạo lập và theo dõi hồ sơ bệnh án điện tử.',
                'display_order' => 1,
                'status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('product_packages')->insert([
            [
                'id' => 10,
                'product_id' => 1,
                'package_code' => 'PKG-HIS-01',
                'package_name' => 'Goi HIS nang cao',
                'standard_price' => 180000000,
                'unit' => 'Gói/Năm',
                'description' => 'Bao gồm triển khai cơ bản',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 11,
                'product_id' => 2,
                'package_code' => 'PKG-EMR-01',
                'package_name' => 'Goi EMR co ban',
                'standard_price' => 31000000,
                'unit' => 'Gói',
                'description' => 'Theo phụ lục 02',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 9,
                'product_id' => 3,
                'package_code' => 'PKG-LIS-00',
                'package_name' => 'Goi LIS rong',
                'standard_price' => 15000000,
                'unit' => 'Gói',
                'description' => 'Goi LIS rong',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 12,
                'product_id' => 3,
                'package_code' => 'PKG-LIS-01',
                'package_name' => 'Goi LIS co ban',
                'standard_price' => 15000000,
                'unit' => 'Gói',
                'description' => 'Theo phụ lục package fallback',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('product_package_feature_groups')->insert([
            [
                'id' => 101,
                'package_id' => 10,
                'group_name' => 'Tinh nang package HIS',
                'display_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 102,
                'package_id' => 12,
                'group_name' => 'Tinh nang package LIS',
                'display_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('product_package_features')->insert([
            [
                'package_id' => 10,
                'group_id' => 101,
                'feature_name' => 'Dang nhap package',
                'detail_description' => 'Su dung catalog rieng cua goi cuoc.',
                'display_order' => 1,
                'status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'package_id' => 12,
                'group_id' => 102,
                'feature_name' => 'Dang nhap package LIS',
                'detail_description' => 'Su dung catalog package khi product chua co du lieu.',
                'display_order' => 1,
                'status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
