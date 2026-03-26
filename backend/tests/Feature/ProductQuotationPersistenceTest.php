<?php

namespace Tests\Feature;

use Illuminate\Auth\GenericUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProductQuotationPersistenceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        Carbon::setTestNow(Carbon::create(2026, 3, 25, 14, 15, 0));
        $this->setUpSchema();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_it_stores_product_quotation_draft_in_database(): void
    {
        $response = $this->postJson('/api/v5/products/quotations', $this->quotationPayload());

        $response->assertCreated();
        $response->assertJsonPath('data.recipient_name', 'BỆNH VIỆN ĐA KHOA CẦN THƠ');
        $response->assertJsonPath('data.latest_version_no', 0);
        $response->assertJsonCount(2, 'data.items');

        $quotationId = (int) $response->json('data.id');

        $this->assertDatabaseHas('product_quotations', [
            'id' => $quotationId,
            'recipient_name' => 'BỆNH VIỆN ĐA KHOA CẦN THƠ',
            'status' => 'DRAFT',
            'latest_version_no' => 0,
        ]);
        $this->assertSame(2, DB::table('product_quotation_items')->where('quotation_id', $quotationId)->count());
        $this->assertDatabaseHas('product_quotation_events', [
            'quotation_id' => $quotationId,
            'event_type' => 'DRAFT_CREATED',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'auditable_type' => 'product_quotations',
            'auditable_id' => $quotationId,
            'event' => 'INSERT',
        ]);
    }

    public function test_it_updates_product_quotation_draft_and_replaces_items(): void
    {
        $createResponse = $this->postJson('/api/v5/products/quotations', $this->quotationPayload());
        $quotationId = (int) $createResponse->json('data.id');

        $payload = $this->quotationPayload();
        $payload['recipient_name'] = 'BỆNH VIỆN PHỔI HẬU GIANG';
        $payload['items'] = [
            [
                'product_id' => 2,
                'product_name' => 'VNPT EMR',
                'unit' => 'Gói',
                'quantity' => 3,
                'unit_price' => 42000000,
                'vat_rate' => 8,
                'note' => 'Điều chỉnh gói in lại',
            ],
        ];

        $response = $this->putJson("/api/v5/products/quotations/{$quotationId}", $payload);

        $response->assertOk();
        $response->assertJsonPath('data.recipient_name', 'BỆNH VIỆN PHỔI HẬU GIANG');
        $response->assertJsonCount(1, 'data.items');
        $response->assertJsonPath('data.items.0.product_name', 'VNPT EMR');

        $this->assertSame(1, DB::table('product_quotation_items')->where('quotation_id', $quotationId)->count());
        $this->assertDatabaseHas('product_quotation_events', [
            'quotation_id' => $quotationId,
            'event_type' => 'DRAFT_UPDATED',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'auditable_type' => 'product_quotations',
            'auditable_id' => $quotationId,
            'event' => 'UPDATE',
        ]);
    }

    public function test_it_stores_empty_product_quotation_draft_with_defaults(): void
    {
        $response = $this->postJson('/api/v5/products/quotations', [
            'recipient_name' => '',
            'items' => [],
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.recipient_name', '');
        $response->assertJsonPath('data.scope_summary', 'phục vụ triển khai các sản phẩm/dịch vụ theo nhu cầu của Quý đơn vị');
        $response->assertJsonPath('data.validity_days', 90);
        $response->assertJsonPath('data.items', []);

        $quotationId = (int) $response->json('data.id');
        $this->assertDatabaseHas('product_quotations', [
            'id' => $quotationId,
            'recipient_name' => '',
            'status' => 'DRAFT',
        ]);
        $this->assertSame(0, DB::table('product_quotation_items')->where('quotation_id', $quotationId)->count());
    }

    public function test_it_creates_sequential_versions_every_time_the_word_print_endpoint_is_called(): void
    {
        $templatePath = base_path('../database/Baogiamau.docx');
        if (! is_file($templatePath)) {
            $this->markTestSkipped('Thiếu file mẫu database/Baogiamau.docx để kiểm thử print version.');
        }

        $createResponse = $this->postJson('/api/v5/products/quotations', $this->quotationPayload());
        $quotationId = (int) $createResponse->json('data.id');

        $firstPrintResponse = $this->post("/api/v5/products/quotations/{$quotationId}/print-word");
        $secondPrintResponse = $this->post("/api/v5/products/quotations/{$quotationId}/print-word");

        $firstPrintResponse->assertOk();
        $secondPrintResponse->assertOk();
        $firstPrintResponse->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        $secondPrintResponse->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        $versions = DB::table('product_quotation_versions')
            ->where('quotation_id', $quotationId)
            ->orderBy('version_no')
            ->get(['version_no', 'status', 'content_hash']);

        $this->assertCount(2, $versions);
        $this->assertSame(1, (int) $versions[0]->version_no);
        $this->assertSame(2, (int) $versions[1]->version_no);
        $this->assertSame('SUCCESS', $versions[0]->status);
        $this->assertSame('SUCCESS', $versions[1]->status);
        $this->assertSame((string) $versions[0]->content_hash, (string) $versions[1]->content_hash);

        $this->assertSame(2, DB::table('product_quotation_events')
            ->where('quotation_id', $quotationId)
            ->where('event_type', 'PRINT_CONFIRMED')
            ->count());

        $quotation = DB::table('product_quotations')->where('id', $quotationId)->first();
        $this->assertNotNull($quotation);
        $this->assertSame(2, (int) $quotation->latest_version_no);
        $this->assertNotNull($quotation->last_printed_at);
    }

    public function test_it_lists_versions_and_events_for_a_product_quotation(): void
    {
        $templatePath = base_path('../database/Baogiamau.docx');
        if (! is_file($templatePath)) {
            $this->markTestSkipped('Thiếu file mẫu database/Baogiamau.docx để kiểm thử versions/events.');
        }

        $createResponse = $this->postJson('/api/v5/products/quotations', $this->quotationPayload());
        $quotationId = (int) $createResponse->json('data.id');

        $this->post("/api/v5/products/quotations/{$quotationId}/print-word")->assertOk();

        $versionsResponse = $this->getJson("/api/v5/products/quotations/{$quotationId}/versions");
        $eventsResponse = $this->getJson("/api/v5/products/quotations/{$quotationId}/events");

        $versionsResponse->assertOk();
        $versionsResponse->assertJsonCount(1, 'data');
        $versionsResponse->assertJsonPath('data.0.version_no', 1);

        $eventsResponse->assertOk();
        $this->assertGreaterThanOrEqual(2, count((array) $eventsResponse->json('data')));
        $this->assertSame('PRINT_CONFIRMED', $eventsResponse->json('data.0.event_type'));
    }

    public function test_it_shows_version_detail_for_a_product_quotation(): void
    {
        $templatePath = base_path('../database/Baogiamau.docx');
        if (! is_file($templatePath)) {
            $this->markTestSkipped('Thiếu file mẫu database/Baogiamau.docx để kiểm thử version detail.');
        }

        $createResponse = $this->postJson('/api/v5/products/quotations', $this->quotationPayload());
        $quotationId = (int) $createResponse->json('data.id');

        $this->post("/api/v5/products/quotations/{$quotationId}/print-word")->assertOk();

        $versionId = (int) DB::table('product_quotation_versions')
            ->where('quotation_id', $quotationId)
            ->value('id');

        $response = $this->getJson("/api/v5/products/quotations/{$quotationId}/versions/{$versionId}");

        $response->assertOk();
        $response->assertJsonPath('data.version_no', 1);
        $response->assertJsonPath('data.recipient_name', 'BỆNH VIỆN ĐA KHOA CẦN THƠ');
        $response->assertJsonCount(2, 'data.items');
        $response->assertJsonPath('data.items.0.product_name', 'VNPT HIS Cloud');
    }

    public function test_it_filters_product_quotation_index_by_current_user_when_mine_flag_is_enabled(): void
    {
        $this->actingAs(new GenericUser(['id' => 7]));
        $this->postJson('/api/v5/products/quotations', array_merge($this->quotationPayload(), [
            'recipient_name' => 'BỆNH VIỆN USER 7',
        ]))->assertCreated();

        $this->actingAs(new GenericUser(['id' => 8]));
        $this->postJson('/api/v5/products/quotations', array_merge($this->quotationPayload(), [
            'recipient_name' => 'BỆNH VIỆN USER 8',
        ]))->assertCreated();

        $this->actingAs(new GenericUser(['id' => 7]));
        $response = $this->getJson('/api/v5/products/quotations?mine=1');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.recipient_name', 'BỆNH VIỆN USER 7');
    }

    private function setUpSchema(): void
    {
        Schema::create('products', function (Blueprint $table): void {
            $table->id();
            $table->string('product_name')->nullable();
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->nullable();
            $table->string('event', 20);
            $table->string('auditable_type');
            $table->unsignedBigInteger('auditable_id');
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('url')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->dateTime('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
        });

        Schema::create('product_quotations', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('recipient_name', 255);
            $table->string('sender_city', 120)->nullable();
            $table->date('quote_date')->nullable();
            $table->text('scope_summary')->nullable();
            $table->decimal('vat_rate', 5, 2)->nullable()->default(10.00);
            $table->unsignedSmallInteger('validity_days')->default(90);
            $table->text('notes_text')->nullable();
            $table->text('contact_line')->nullable();
            $table->text('closing_message')->nullable();
            $table->string('signatory_title', 255)->nullable();
            $table->string('signatory_unit', 255)->nullable();
            $table->string('signatory_name', 255)->nullable();
            $table->decimal('subtotal', 18, 2)->default(0.00);
            $table->decimal('vat_amount', 18, 2)->default(0.00);
            $table->decimal('total_amount', 18, 2)->default(0.00);
            $table->text('total_in_words')->nullable();
            $table->boolean('uses_multi_vat_template')->default(false);
            $table->string('content_hash', 64)->nullable();
            $table->unsignedInteger('latest_version_no')->default(0);
            $table->timestamp('last_printed_at')->nullable();
            $table->unsignedBigInteger('last_printed_by')->nullable();
            $table->string('status', 30)->default('DRAFT');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('product_quotation_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('quotation_id');
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('product_name', 500);
            $table->string('unit', 100)->nullable();
            $table->decimal('quantity', 18, 2)->default(0.00);
            $table->decimal('unit_price', 18, 2)->default(0.00);
            $table->decimal('vat_rate', 5, 2)->nullable();
            $table->decimal('vat_amount', 18, 2)->nullable();
            $table->decimal('line_total', 18, 2)->default(0.00);
            $table->decimal('total_with_vat', 18, 2)->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::create('product_quotation_versions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('quotation_id');
            $table->unsignedInteger('version_no');
            $table->string('template_key', 40);
            $table->string('status', 20)->default('PENDING');
            $table->string('filename', 255)->nullable();
            $table->date('quote_date');
            $table->string('recipient_name', 255);
            $table->string('sender_city', 120)->nullable();
            $table->text('scope_summary')->nullable();
            $table->decimal('vat_rate', 5, 2)->nullable();
            $table->unsignedSmallInteger('validity_days')->default(90);
            $table->text('notes_text')->nullable();
            $table->text('contact_line')->nullable();
            $table->text('closing_message')->nullable();
            $table->string('signatory_title', 255)->nullable();
            $table->string('signatory_unit', 255)->nullable();
            $table->string('signatory_name', 255)->nullable();
            $table->decimal('subtotal', 18, 2)->default(0.00);
            $table->decimal('vat_amount', 18, 2)->default(0.00);
            $table->decimal('total_amount', 18, 2)->default(0.00);
            $table->text('total_in_words')->nullable();
            $table->boolean('uses_multi_vat_template')->default(false);
            $table->string('content_hash', 64)->nullable();
            $table->timestamp('printed_at')->nullable();
            $table->unsignedBigInteger('printed_by')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('product_quotation_version_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('version_id');
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('product_name', 500);
            $table->string('unit', 100)->nullable();
            $table->decimal('quantity', 18, 2)->default(0.00);
            $table->decimal('unit_price', 18, 2)->default(0.00);
            $table->decimal('vat_rate', 5, 2)->nullable();
            $table->decimal('vat_amount', 18, 2)->nullable();
            $table->decimal('line_total', 18, 2)->default(0.00);
            $table->decimal('total_with_vat', 18, 2)->nullable();
            $table->text('note')->nullable();
        });

        Schema::create('product_quotation_events', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('quotation_id');
            $table->unsignedBigInteger('version_id')->nullable();
            $table->unsignedInteger('version_no')->nullable();
            $table->string('event_type', 50);
            $table->string('event_status', 20)->nullable();
            $table->string('template_key', 40)->nullable();
            $table->string('filename', 255)->nullable();
            $table->string('content_hash', 64)->nullable();
            $table->json('metadata')->nullable();
            $table->string('url')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->dateTime('created_at')->nullable();
        });

        DB::table('products')->insert([
            ['id' => 1, 'product_name' => 'VNPT HIS Cloud'],
            ['id' => 2, 'product_name' => 'VNPT EMR'],
        ]);
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
}
