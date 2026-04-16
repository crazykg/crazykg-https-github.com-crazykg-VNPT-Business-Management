<?php

namespace Tests\Feature;

use Illuminate\Auth\GenericUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
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
        $response->assertJsonPath('data.items.0.product_package_id', 101);
        $this->assertSame(211000000.0, (float) $response->json('data.subtotal'));
        $this->assertSame(21100000.0, (float) $response->json('data.vat_amount'));
        $this->assertSame(232100000.0, (float) $response->json('data.total_amount'));

        $quotationId = (int) $response->json('data.id');

        $this->assertDatabaseHas('product_quotations', [
            'id' => $quotationId,
            'recipient_name' => 'BỆNH VIỆN ĐA KHOA CẦN THƠ',
            'status' => 'DRAFT',
            'latest_version_no' => 0,
        ]);
        $this->assertSame(2, DB::table('product_quotation_items')->where('quotation_id', $quotationId)->count());
        $this->assertDatabaseHas('product_quotation_items', [
            'quotation_id' => $quotationId,
            'product_id' => 1,
            'product_package_id' => 101,
        ]);
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
                'product_package_id' => 202,
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
        $response->assertJsonPath('data.items.0.product_package_id', 202);
        $response->assertJsonPath('data.items.0.product_name', 'VNPT EMR');
        $this->assertSame(126000000.0, (float) $response->json('data.subtotal'));
        $this->assertSame(10080000.0, (float) $response->json('data.vat_amount'));
        $this->assertSame(136080000.0, (float) $response->json('data.total_amount'));

        $this->assertSame(1, DB::table('product_quotation_items')->where('quotation_id', $quotationId)->count());
        $this->assertDatabaseHas('product_quotation_items', [
            'quotation_id' => $quotationId,
            'product_id' => 2,
            'product_package_id' => 202,
        ]);
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

    public function test_it_rejects_zero_amount_product_quotation_draft(): void
    {
        $response = $this->postJson('/api/v5/products/quotations', [
            'recipient_name' => '',
            'items' => [],
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath(
            'message',
            'Không lưu nháp báo giá 0 đồng. Vui lòng nhập ít nhất một hạng mục có thành tiền lớn hơn 0.'
        );
        $this->assertSame(0, DB::table('product_quotations')->count());
        $this->assertSame(0, DB::table('product_quotation_items')->count());
    }

    public function test_it_rejects_updating_product_quotation_draft_to_zero_amount(): void
    {
        $createResponse = $this->postJson('/api/v5/products/quotations', $this->quotationPayload());
        $quotationId = (int) $createResponse->json('data.id');

        $response = $this->putJson("/api/v5/products/quotations/{$quotationId}", [
            'recipient_name' => 'BỆNH VIỆN 0 ĐỒNG',
            'items' => [],
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath(
            'message',
            'Không lưu nháp báo giá 0 đồng. Vui lòng nhập ít nhất một hạng mục có thành tiền lớn hơn 0.'
        );

        $this->assertDatabaseHas('product_quotations', [
            'id' => $quotationId,
            'recipient_name' => 'BỆNH VIỆN ĐA KHOA CẦN THƠ',
            'status' => 'DRAFT',
        ]);
        $this->assertSame(2, DB::table('product_quotation_items')->where('quotation_id', $quotationId)->count());
    }

    public function test_it_creates_sequential_versions_every_time_the_word_print_endpoint_is_called(): void
    {
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
            ->get(['version_no', 'status', 'content_hash', 'subtotal', 'vat_amount', 'total_amount']);

        $this->assertCount(2, $versions);
        $this->assertSame(1, (int) $versions[0]->version_no);
        $this->assertSame(2, (int) $versions[1]->version_no);
        $this->assertSame('SUCCESS', $versions[0]->status);
        $this->assertSame('SUCCESS', $versions[1]->status);
        $this->assertSame((string) $versions[0]->content_hash, (string) $versions[1]->content_hash);
        $this->assertSame(211000000.0, (float) $versions[0]->subtotal);
        $this->assertSame(21100000.0, (float) $versions[0]->vat_amount);
        $this->assertSame(232100000.0, (float) $versions[0]->total_amount);
        $this->assertSame(232100000.0, (float) $versions[1]->total_amount);

        $this->assertSame(2, DB::table('product_quotation_events')
            ->where('quotation_id', $quotationId)
            ->where('event_type', 'PRINT_CONFIRMED')
            ->count());

        $quotation = DB::table('product_quotations')->where('id', $quotationId)->first();
        $this->assertNotNull($quotation);
        $this->assertSame(2, (int) $quotation->latest_version_no);
        $this->assertNotNull($quotation->last_printed_at);
        $this->assertSame(232100000.0, (float) $quotation->total_amount);
    }

    public function test_it_sends_archival_email_after_print_word_confirmation_succeeds(): void
    {
        $this->actingAs(new GenericUser([
            'id' => 51,
            'username' => 'quote-printer',
            'full_name' => 'Lê Thị H',
        ]));

        DB::table('integration_settings')->insert([
            'provider' => 'EMAIL_SMTP',
            'is_enabled' => 1,
            'smtp_host' => 'smtp.example.com',
            'smtp_port' => 587,
            'smtp_encryption' => 'tls',
            'smtp_username' => 'no-reply@example.com',
            'smtp_password' => Crypt::encryptString('smtp-secret'),
            'smtp_from_address' => 'no-reply@example.com',
            'smtp_from_name' => 'VNPT Business',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Config::set('audit.product_quotation_print_notification_recipients', [
            'pvro86@gmail.com',
            'vnpthishg@gmail.com',
        ]);

        $createResponse = $this->postJson('/api/v5/products/quotations', $this->quotationPayload());
        $quotationId = (int) $createResponse->json('data.id');

        Mail::shouldReceive('html')
            ->once()
            ->withArgs(function (string $html, \Closure $callback): bool {
                $this->assertStringContainsString('Lưu trữ bản in báo giá', $html);
                $this->assertStringContainsString('v1', $html);
                $this->assertStringContainsString('Lê Thị H (quote-printer)', $html);
                $this->assertStringContainsString('BỆNH VIỆN ĐA KHOA CẦN THƠ', $html);
                $this->assertStringContainsString('Theo gói tiêu chuẩn', $html);
                $this->assertStringContainsString('Bao gồm triển khai cơ bản', $html);

                $message = new class {
                    public array $to = [];
                    public ?string $subject = null;
                    public ?array $from = null;
                    public array $attachments = [];

                    public function to($recipients): self
                    {
                        $this->to = is_array($recipients) ? array_values($recipients) : [$recipients];

                        return $this;
                    }

                    public function subject($subject): self
                    {
                        $this->subject = $subject;

                        return $this;
                    }

                    public function from($address, $name = null): self
                    {
                        $this->from = [$address, $name];

                        return $this;
                    }

                    public function attachData($data, $name, array $options = []): self
                    {
                        $this->attachments[] = [
                            'data' => $data,
                            'name' => $name,
                            'options' => $options,
                        ];

                        return $this;
                    }
                };

                $callback($message);

                $this->assertSame(['pvro86@gmail.com', 'vnpthishg@gmail.com'], $message->to);
                $this->assertSame('[VNPT Business] Lưu trữ bản in báo giá v1 - BỆNH VIỆN ĐA KHOA CẦN THƠ', $message->subject);
                $this->assertSame(['no-reply@example.com', 'VNPT Business'], $message->from);
                $this->assertCount(1, $message->attachments);
                $this->assertStringEndsWith('.docx', $message->attachments[0]['name']);
                $this->assertSame(
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    $message->attachments[0]['options']['mime'] ?? null
                );
                $this->assertIsString($message->attachments[0]['data']);
                $this->assertNotSame('', $message->attachments[0]['data']);

                return true;
            });

        $response = $this->post("/api/v5/products/quotations/{$quotationId}/print-word");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        $response->assertHeader('X-Quotation-Email-Status', 'SUCCESS');
        $response->assertHeader('X-Quotation-Email-Message', rawurlencode('Đã gửi email lưu trữ bản in báo giá.'));
    }

    public function test_it_returns_failed_email_header_when_archival_email_cannot_be_sent(): void
    {
        Config::set('audit.product_quotation_print_notification_recipients', [
            'pvro86@gmail.com',
        ]);

        $createResponse = $this->postJson('/api/v5/products/quotations', $this->quotationPayload());
        $quotationId = (int) $createResponse->json('data.id');

        $response = $this->post("/api/v5/products/quotations/{$quotationId}/print-word");

        $response->assertOk();
        $response->assertHeader('X-Quotation-Email-Status', 'FAILED');
        $response->assertHeader('X-Quotation-Email-Message', rawurlencode('Chưa có cấu hình Email SMTP.'));
    }

    public function test_it_lists_versions_and_events_for_a_product_quotation(): void
    {
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

    public function test_it_filters_product_quotation_index_by_customer_and_recent_updated_window(): void
    {
        DB::table('customers')->insert([
            ['id' => 101, 'customer_name' => 'BỆNH VIỆN GẦN ĐÂY'],
            ['id' => 202, 'customer_name' => 'BỆNH VIỆN KHÁC'],
        ]);

        $recentResponse = $this->postJson('/api/v5/products/quotations', array_merge($this->quotationPayload(), [
            'customer_id' => 101,
            'recipient_name' => 'BỆNH VIỆN GẦN ĐÂY',
        ]));
        $recentId = (int) $recentResponse->json('data.id');

        $olderSameCustomerResponse = $this->postJson('/api/v5/products/quotations', array_merge($this->quotationPayload(), [
            'customer_id' => 101,
            'recipient_name' => 'BỆNH VIỆN CŨ HƠN',
        ]));
        $olderSameCustomerId = (int) $olderSameCustomerResponse->json('data.id');

        $recentOtherCustomerResponse = $this->postJson('/api/v5/products/quotations', array_merge($this->quotationPayload(), [
            'customer_id' => 202,
            'recipient_name' => 'BỆNH VIỆN KHÁC',
        ]));
        $recentOtherCustomerId = (int) $recentOtherCustomerResponse->json('data.id');

        DB::table('product_quotations')->where('id', $recentId)->update([
            'updated_at' => Carbon::now()->subDays(10),
        ]);
        DB::table('product_quotations')->where('id', $olderSameCustomerId)->update([
            'updated_at' => Carbon::now()->subDays(120),
        ]);
        DB::table('product_quotations')->where('id', $recentOtherCustomerId)->update([
            'updated_at' => Carbon::now()->subDays(5),
        ]);

        $recentResponse = $this->getJson('/api/v5/products/quotations?updated_from=' . urlencode(Carbon::now()->subDays(90)->toIso8601String()));
        $recentResponse->assertOk();
        $recentResponse->assertJsonCount(2, 'data');
        $recentRecipients = array_column($recentResponse->json('data'), 'recipient_name');
        $this->assertContains('BỆNH VIỆN GẦN ĐÂY', $recentRecipients);
        $this->assertContains('BỆNH VIỆN KHÁC', $recentRecipients);
        $this->assertNotContains('BỆNH VIỆN CŨ HƠN', $recentRecipients);

        $customerResponse = $this->getJson('/api/v5/products/quotations?customer_id=101');
        $customerResponse->assertOk();
        $customerResponse->assertJsonCount(2, 'data');
        $customerRecipients = array_column($customerResponse->json('data'), 'recipient_name');
        $this->assertContains('BỆNH VIỆN GẦN ĐÂY', $customerRecipients);
        $this->assertContains('BỆNH VIỆN CŨ HƠN', $customerRecipients);
        $this->assertNotContains('BỆNH VIỆN KHÁC', $customerRecipients);
    }

    public function test_it_filters_zero_amount_product_quotations_out_of_history_index_when_history_only_flag_is_enabled(): void
    {
        $this->postJson('/api/v5/products/quotations', array_merge($this->quotationPayload(), [
            'recipient_name' => 'BỆNH VIỆN CÓ GIÁ',
        ]))->assertCreated();

        $legacyZeroDraft = $this->postJson('/api/v5/products/quotations', array_merge($this->quotationPayload(), [
            'recipient_name' => 'BỆNH VIỆN LEGACY',
        ]));
        $legacyZeroDraft->assertCreated();
        $legacyZeroDraftId = (int) $legacyZeroDraft->json('data.id');

        DB::table('product_quotations')->where('id', $legacyZeroDraftId)->update([
            'recipient_name' => 'BỆNH VIỆN 0 ĐỒNG',
            'subtotal' => 0,
            'vat_amount' => 0,
            'total_amount' => 0,
            'updated_at' => Carbon::now()->subDay(),
        ]);

        $response = $this->getJson('/api/v5/products/quotations?filters[history_only]=1');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $recipients = array_column($response->json('data'), 'recipient_name');
        $this->assertContains('BỆNH VIỆN CÓ GIÁ', $recipients);
        $this->assertNotContains('BỆNH VIỆN 0 ĐỒNG', $recipients);
    }

    public function test_it_returns_product_quotation_default_settings_with_system_defaults_when_no_row_exists(): void
    {
        $this->actingAs(new GenericUser(['id' => 15]));

        $response = $this->getJson('/api/v5/products/quotation-default-settings');

        $response->assertOk();
        $response->assertJsonPath('data.user_id', 15);
        $response->assertJsonPath('data.scope_summary', 'phục vụ triển khai các sản phẩm/dịch vụ theo nhu cầu của Quý đơn vị');
        $response->assertJsonPath('data.validity_days', 90);
        $response->assertJsonPath('data.is_persisted', false);
    }

    public function test_it_persists_product_quotation_default_settings_for_the_authenticated_user(): void
    {
        $this->actingAs(new GenericUser(['id' => 15]));

        $response = $this->putJson('/api/v5/products/quotation-default-settings', [
            'scope_summary' => 'Triển khai theo cấu hình mặc định đã lưu',
            'validity_days' => 45,
            'notes_text' => "Dòng 1\nDòng 2",
            'contact_line' => 'Ông Nguyễn Văn A - 0912.000.123',
            'closing_message' => 'Lời kết mặc định đã lưu',
            'signatory_title' => 'PHÓ GIÁM ĐỐC',
            'signatory_unit' => 'TRUNG TÂM GIẢI PHÁP SỐ',
            'signatory_name' => 'Nguyễn Văn A',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.user_id', 15);
        $response->assertJsonPath('data.scope_summary', 'Triển khai theo cấu hình mặc định đã lưu');
        $response->assertJsonPath('data.validity_days', 45);
        $response->assertJsonPath('data.signatory_name', 'Nguyễn Văn A');
        $response->assertJsonPath('data.is_persisted', true);

        $this->assertDatabaseHas('product_quotation_default_settings', [
            'user_id' => 15,
            'scope_summary' => 'Triển khai theo cấu hình mặc định đã lưu',
            'validity_days' => 45,
            'signatory_name' => 'Nguyễn Văn A',
            'created_by' => 15,
            'updated_by' => 15,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'auditable_type' => 'product_quotation_default_settings',
            'event' => 'INSERT',
        ]);
    }

    private function setUpSchema(): void
    {
        Schema::create('products', function (Blueprint $table): void {
            $table->id();
            $table->string('product_name')->nullable();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->id();
            $table->string('customer_name')->nullable();
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

        Schema::create('integration_settings', function (Blueprint $table): void {
            $table->string('provider', 50)->primary();
            $table->boolean('is_enabled')->default(false);
            $table->string('smtp_host', 255)->nullable();
            $table->unsignedInteger('smtp_port')->nullable();
            $table->string('smtp_encryption', 20)->nullable();
            $table->string('smtp_username', 255)->nullable();
            $table->text('smtp_password')->nullable();
            $table->string('smtp_from_address', 255)->nullable();
            $table->string('smtp_from_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
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
            $table->unsignedBigInteger('product_package_id')->nullable();
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

        Schema::create('product_quotation_default_settings', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->text('scope_summary')->nullable();
            $table->unsignedSmallInteger('validity_days')->default(90);
            $table->text('notes_text')->nullable();
            $table->text('contact_line')->nullable();
            $table->text('closing_message')->nullable();
            $table->string('signatory_title', 255)->nullable();
            $table->string('signatory_unit', 255)->nullable();
            $table->string('signatory_name', 255)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
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
                    'product_package_id' => 101,
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
