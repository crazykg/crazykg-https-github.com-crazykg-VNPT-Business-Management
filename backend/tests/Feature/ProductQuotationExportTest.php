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
        $templatePath = base_path('../database/Baogiamau.docx');
        if (!is_file($templatePath)) {
            $this->markTestSkipped('Thiếu file mẫu database/Baogiamau.docx để kiểm thử export Word.');
        }

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
        $this->assertStringContainsString('<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"', $documentXml);
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
        $templatePath = base_path('../database/VNPT_BaoGia_ChauThanh_nhieuthu.docx');
        if (!is_file($templatePath)) {
            $this->markTestSkipped('Thiếu file mẫu database/VNPT_BaoGia_ChauThanh_nhieuthu.docx để kiểm thử export Word nhiều VAT.');
        }

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
                    'product_name' => 'VNPT HIS Cloud',
                    'unit' => 'Gói/Năm',
                    'quantity' => 1,
                    'unit_price' => 180000000,
                    'vat_rate' => 10,
                    'note' => "Theo gói tiêu chuẩn\nBao gồm triển khai cơ bản",
                ],
                [
                    'product_id' => 2,
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

    private function setUpSchema(): void
    {
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
        ]);
    }
}
