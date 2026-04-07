<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class IntegrationSettingsExtractionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_backblaze_b2_settings_can_get_update_and_test_via_api(): void
    {
        $this->putJson('/api/v5/integrations/backblaze-b2', [
            'is_enabled' => true,
            'access_key_id' => 'key-id-001',
            'bucket_id' => 'bucket-001',
            'bucket_name' => 'bucket-a',
            'region' => 'us-west-004',
            'file_prefix' => 'attachments',
            'secret_access_key' => 'secret-001',
        ])
            ->assertOk()
            ->assertJsonPath('data.provider', 'BACKBLAZE_B2')
            ->assertJsonPath('data.is_enabled', true)
            ->assertJsonPath('data.bucket_id', 'bucket-001')
            ->assertJsonPath('data.bucket_name', 'bucket-a')
            ->assertJsonPath('data.has_secret_access_key', true)
            ->assertJsonPath('data.source', 'DB');

        Http::fake([
            'https://api.backblazeb2.com/b2api/v2/b2_authorize_account' => Http::response([
                'apiUrl' => 'https://api001.backblaze.test',
                'authorizationToken' => 'auth-token',
                'downloadUrl' => 'https://download.backblaze.test',
                'accountId' => 'account-001',
            ], 200),
            'https://api001.backblaze.test/b2api/v2/b2_list_buckets' => Http::response([
                'buckets' => [
                    [
                        'bucketId' => 'bucket-001',
                        'bucketName' => 'bucket-a',
                    ],
                ],
            ], 200),
            'https://api001.backblaze.test/b2api/v2/b2_get_upload_url' => Http::response([
                'uploadUrl' => 'https://upload.backblaze.test/upload',
                'authorizationToken' => 'upload-token',
            ], 200),
            'https://upload.backblaze.test/upload' => Http::response([
                'fileId' => 'file-001',
                'fileName' => 'health-check/connection_test.txt',
            ], 200),
            'https://api001.backblaze.test/b2api/v2/b2_delete_file_version' => Http::response([], 200),
        ]);

        $this->postJson('/api/v5/integrations/backblaze-b2/test')
            ->assertOk()
            ->assertJsonPath('data.status', 'SUCCESS')
            ->assertJsonPath('data.message', 'Kết nối Backblaze B2 thành công và có thể tải file.')
            ->assertJsonPath('data.persisted', true);

        $stored = DB::table('integration_settings')->where('provider', 'BACKBLAZE_B2')->first();
        $this->assertNotNull($stored);
        $this->assertSame('SUCCESS', $stored->last_test_status);
    }

    public function test_google_drive_settings_can_get_update_and_test_via_api(): void
    {
        $serviceAccountJson = $this->makeGoogleServiceAccountJson();

        $this->putJson('/api/v5/integrations/google-drive', [
            'is_enabled' => true,
            'folder_id' => 'folder-123',
            'scopes' => 'https://www.googleapis.com/auth/drive.file',
            'impersonate_user' => 'manager@example.com',
            'file_prefix' => 'support',
            'service_account_json' => $serviceAccountJson,
        ])
            ->assertOk()
            ->assertJsonPath('data.provider', 'GOOGLE_DRIVE')
            ->assertJsonPath('data.is_enabled', true)
            ->assertJsonPath('data.folder_id', 'folder-123')
            ->assertJsonPath('data.has_service_account_json', true)
            ->assertJsonPath('data.source', 'DB');

        Http::fake([
            'https://oauth2.googleapis.com/token' => Http::response([
                'access_token' => 'google-access-token',
            ], 200),
            'https://www.googleapis.com/drive/v3/about*' => Http::response([
                'user' => [
                    'emailAddress' => 'service-account@example.com',
                ],
            ], 200),
            'https://www.googleapis.com/drive/v3/files/folder-123*' => Http::response([
                'id' => 'folder-123',
                'mimeType' => 'application/vnd.google-apps.folder',
                'driveId' => 'shared-drive-001',
                'trashed' => false,
                'capabilities' => [
                    'canAddChildren' => true,
                ],
            ], 200),
            'https://www.googleapis.com/upload/drive/v3/files*' => Http::response([
                'id' => 'drive-file-001',
            ], 200),
            'https://www.googleapis.com/drive/v3/files/drive-file-001?supportsAllDrives=true' => Http::response([], 204),
        ]);

        $this->postJson('/api/v5/integrations/google-drive/test')
            ->assertOk()
            ->assertJsonPath('data.status', 'SUCCESS')
            ->assertJsonPath('data.user_email', 'service-account@example.com')
            ->assertJsonPath('data.persisted', true);

        $stored = DB::table('integration_settings')->where('provider', 'GOOGLE_DRIVE')->first();
        $this->assertNotNull($stored);
        $this->assertSame('SUCCESS', $stored->last_test_status);
    }

    public function test_google_drive_settings_ignore_environment_fallback_when_no_database_row_exists(): void
    {
        $serviceAccountJson = $this->makeGoogleServiceAccountJson();
        $this->setTemporaryEnv('GOOGLE_DRIVE_ENABLED', 'true');
        $this->setTemporaryEnv('GOOGLE_DRIVE_FOLDER_ID', 'env-folder-123');
        $this->setTemporaryEnv('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON', $serviceAccountJson);

        try {
            $this->getJson('/api/v5/integrations/google-drive')
                ->assertOk()
                ->assertJsonPath('data.provider', 'GOOGLE_DRIVE')
                ->assertJsonPath('data.source', 'DEFAULT')
                ->assertJsonPath('data.is_enabled', false)
                ->assertJsonPath('data.folder_id', null)
                ->assertJsonPath('data.account_email', null)
                ->assertJsonPath('data.has_service_account_json', false);
        } finally {
            $this->setTemporaryEnv('GOOGLE_DRIVE_ENABLED', null);
            $this->setTemporaryEnv('GOOGLE_DRIVE_FOLDER_ID', null);
            $this->setTemporaryEnv('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON', null);
        }
    }

    public function test_google_drive_settings_do_not_backfill_credentials_from_environment_when_db_row_exists(): void
    {
        $serviceAccountJson = $this->makeGoogleServiceAccountJson();
        $this->setTemporaryEnv('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON', $serviceAccountJson);

        DB::table('integration_settings')->insert([
            'provider' => 'GOOGLE_DRIVE',
            'is_enabled' => true,
            'folder_id' => 'db-folder-123',
            'service_account_json' => null,
        ]);

        try {
            $this->getJson('/api/v5/integrations/google-drive')
                ->assertOk()
                ->assertJsonPath('data.provider', 'GOOGLE_DRIVE')
                ->assertJsonPath('data.source', 'DB')
                ->assertJsonPath('data.is_enabled', true)
                ->assertJsonPath('data.folder_id', 'db-folder-123')
                ->assertJsonPath('data.account_email', null)
                ->assertJsonPath('data.has_service_account_json', false);
        } finally {
            $this->setTemporaryEnv('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON', null);
        }
    }

    public function test_backblaze_settings_ignore_environment_fallback_when_no_database_row_exists(): void
    {
        $this->setTemporaryEnv('B2_ENABLED', 'true');
        $this->setTemporaryEnv('B2_KEY_ID', 'env-key-id');
        $this->setTemporaryEnv('B2_APPLICATION_KEY', 'env-secret-key');
        $this->setTemporaryEnv('B2_BUCKET_ID', 'env-bucket-id');
        $this->setTemporaryEnv('B2_BUCKET_NAME', 'env-bucket');
        $this->setTemporaryEnv('B2_REGION', 'us-west-004');

        try {
            $this->getJson('/api/v5/integrations/backblaze-b2')
                ->assertOk()
                ->assertJsonPath('data.provider', 'BACKBLAZE_B2')
                ->assertJsonPath('data.source', 'DEFAULT')
                ->assertJsonPath('data.is_enabled', false)
                ->assertJsonPath('data.access_key_id', null)
                ->assertJsonPath('data.bucket_id', null)
                ->assertJsonPath('data.bucket_name', null)
                ->assertJsonPath('data.has_secret_access_key', false);
        } finally {
            $this->setTemporaryEnv('B2_ENABLED', null);
            $this->setTemporaryEnv('B2_KEY_ID', null);
            $this->setTemporaryEnv('B2_APPLICATION_KEY', null);
            $this->setTemporaryEnv('B2_BUCKET_ID', null);
            $this->setTemporaryEnv('B2_BUCKET_NAME', null);
            $this->setTemporaryEnv('B2_REGION', null);
        }
    }

    public function test_backblaze_settings_do_not_backfill_secret_from_environment_when_db_row_exists(): void
    {
        $this->setTemporaryEnv('B2_APPLICATION_KEY', 'env-secret-key');

        DB::table('integration_settings')->insert([
            'provider' => 'BACKBLAZE_B2',
            'is_enabled' => true,
            'access_key_id' => 'db-key-id',
            'bucket_id' => 'db-bucket-id',
            'bucket_name' => 'db-bucket',
            'region' => 'us-west-004',
            'secret_access_key' => null,
        ]);

        try {
            $this->getJson('/api/v5/integrations/backblaze-b2')
                ->assertOk()
                ->assertJsonPath('data.provider', 'BACKBLAZE_B2')
                ->assertJsonPath('data.source', 'DB')
                ->assertJsonPath('data.is_enabled', true)
                ->assertJsonPath('data.access_key_id', 'db-key-id')
                ->assertJsonPath('data.bucket_id', 'db-bucket-id')
                ->assertJsonPath('data.bucket_name', 'db-bucket')
                ->assertJsonPath('data.has_secret_access_key', false);
        } finally {
            $this->setTemporaryEnv('B2_APPLICATION_KEY', null);
        }
    }

    public function test_email_smtp_settings_can_get_update_and_preserve_multiple_recipient_emails(): void
    {
        $this->putJson('/api/v5/integrations/email-smtp', [
            'is_enabled' => true,
            'smtp_host' => 'smtp.gmail.com',
            'smtp_port' => 587,
            'smtp_encryption' => 'tls',
            'smtp_username' => 'sender@gmail.com',
            'smtp_password' => 'app-password-1234',
            'smtp_recipient_emails' => 'pvro86@gmail.com, vnpthishg@gmail.com',
            'smtp_from_address' => 'sender@gmail.com',
            'smtp_from_name' => 'VNPT Business',
        ])
            ->assertOk()
            ->assertJsonPath('data.provider', 'EMAIL_SMTP')
            ->assertJsonPath('data.is_enabled', true)
            ->assertJsonPath('data.smtp_username', 'sender@gmail.com')
            ->assertJsonPath('data.smtp_recipient_emails', 'pvro86@gmail.com, vnpthishg@gmail.com')
            ->assertJsonPath('data.has_smtp_password', true)
            ->assertJsonPath('data.source', 'DB');

        $this->getJson('/api/v5/integrations/email-smtp')
            ->assertOk()
            ->assertJsonPath('data.smtp_recipient_emails', 'pvro86@gmail.com, vnpthishg@gmail.com');

        $stored = DB::table('integration_settings')->where('provider', 'EMAIL_SMTP')->first();
        $this->assertNotNull($stored);
        $this->assertSame('pvro86@gmail.com, vnpthishg@gmail.com', $stored->smtp_recipient_emails);
    }

    public function test_email_smtp_test_accepts_multiple_recipient_emails(): void
    {
        $server = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
        if ($server === false) {
            $this->fail(sprintf('Could not start temporary SMTP test socket: %s (%s)', $errstr, (string) $errno));
        }

        $socketAddress = stream_socket_get_name($server, false);
        if (! is_string($socketAddress) || $socketAddress === '') {
            fclose($server);
            $this->fail('Could not determine temporary SMTP test socket address.');
        }

        $portSeparator = strrpos($socketAddress, ':');
        if ($portSeparator === false) {
            fclose($server);
            $this->fail('Could not determine temporary SMTP test socket port.');
        }

        $port = (int) substr($socketAddress, $portSeparator + 1);

        Mail::shouldReceive('raw')
            ->once()
            ->withArgs(function (string $body, callable $callback): bool {
                $message = new class
                {
                    public array $toRecipients = [];
                    public ?string $subjectLine = null;
                    public array $fromSender = [];

                    public function to(array|string $recipients): self
                    {
                        $this->toRecipients = is_array($recipients) ? array_values($recipients) : [$recipients];

                        return $this;
                    }

                    public function subject(string $subject): self
                    {
                        $this->subjectLine = $subject;

                        return $this;
                    }

                    public function from(string $address, ?string $name = null): self
                    {
                        $this->fromSender = [$address, $name];

                        return $this;
                    }
                };

                $callback($message);

                $this->assertSame('Đây là email test từ VNPT Business.', $body);
                $this->assertSame(['pvro86@gmail.com', 'vnpthishg@gmail.com'], $message->toRecipients);
                $this->assertStringStartsWith('Test Email Configuration - ', $message->subjectLine ?? '');
                $this->assertSame(['sender@gmail.com', 'VNPT Business'], $message->fromSender);

                return true;
            });

        try {
            $this->postJson('/api/v5/integrations/email-smtp/test', [
                'smtp_host' => '127.0.0.1',
                'smtp_port' => $port,
                'smtp_encryption' => 'tls',
                'smtp_username' => 'sender@gmail.com',
                'smtp_password' => 'app-password-1234',
                'smtp_from_address' => 'sender@gmail.com',
                'smtp_from_name' => 'VNPT Business',
                'test_recipient_email' => 'pvro86@gmail.com, vnpthishg@gmail.com, pvro86@gmail.com',
            ])
                ->assertOk()
                ->assertJsonPath('data.status', 'SUCCESS')
                ->assertJsonPath('data.message', 'Kết nối SMTP thành công. Đã gửi email test tới 2 mail nhận.');
        } finally {
            fclose($server);
        }

        $stored = DB::table('integration_settings')->where('provider', 'EMAIL_SMTP')->first();
        $this->assertNotNull($stored);
        $this->assertSame('SUCCESS', $stored->last_test_status);
    }

    public function test_email_smtp_test_uses_saved_app_password_when_input_is_empty(): void
    {
        $this->putJson('/api/v5/integrations/email-smtp', [
            'is_enabled' => true,
            'smtp_host' => 'smtp.gmail.com',
            'smtp_port' => 587,
            'smtp_encryption' => 'tls',
            'smtp_username' => 'sender@gmail.com',
            'smtp_password' => 'stored-app-password-1234',
            'smtp_recipient_emails' => 'pvro86@gmail.com, vnpthishg@gmail.com',
            'smtp_from_address' => 'sender@gmail.com',
            'smtp_from_name' => 'VNPT Business',
        ])->assertOk();

        $server = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
        if ($server === false) {
            $this->fail(sprintf('Could not start temporary SMTP test socket: %s (%s)', $errstr, (string) $errno));
        }

        $socketAddress = stream_socket_get_name($server, false);
        if (! is_string($socketAddress) || $socketAddress === '') {
            fclose($server);
            $this->fail('Could not determine temporary SMTP test socket address.');
        }

        $portSeparator = strrpos($socketAddress, ':');
        if ($portSeparator === false) {
            fclose($server);
            $this->fail('Could not determine temporary SMTP test socket port.');
        }

        $port = (int) substr($socketAddress, $portSeparator + 1);

        Mail::shouldReceive('raw')
            ->once()
            ->withArgs(function (string $body, callable $callback): bool {
                $message = new class
                {
                    public array $toRecipients = [];
                    public ?string $subjectLine = null;
                    public array $fromSender = [];

                    public function to(array|string $recipients): self
                    {
                        $this->toRecipients = is_array($recipients) ? array_values($recipients) : [$recipients];

                        return $this;
                    }

                    public function subject(string $subject): self
                    {
                        $this->subjectLine = $subject;

                        return $this;
                    }

                    public function from(string $address, ?string $name = null): self
                    {
                        $this->fromSender = [$address, $name];

                        return $this;
                    }
                };

                $callback($message);

                $this->assertSame('Đây là email test từ VNPT Business.', $body);
                $this->assertSame(['pvro86@gmail.com', 'vnpthishg@gmail.com'], $message->toRecipients);
                $this->assertSame(['sender@gmail.com', 'VNPT Business'], $message->fromSender);

                return true;
            });

        try {
            $this->postJson('/api/v5/integrations/email-smtp/test', [
                'smtp_host' => '127.0.0.1',
                'smtp_port' => $port,
                'smtp_encryption' => 'tls',
                'smtp_username' => 'sender@gmail.com',
                'test_recipient_email' => 'pvro86@gmail.com, vnpthishg@gmail.com',
            ])
                ->assertOk()
                ->assertJsonPath('data.status', 'SUCCESS')
                ->assertJsonPath('data.persisted', true);
        } finally {
            fclose($server);
        }
    }

    public function test_email_smtp_test_requires_saved_or_input_app_password_for_auth_check(): void
    {
        $server = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
        if ($server === false) {
            $this->fail(sprintf('Could not start temporary SMTP test socket: %s (%s)', $errstr, (string) $errno));
        }

        $socketAddress = stream_socket_get_name($server, false);
        if (! is_string($socketAddress) || $socketAddress === '') {
            fclose($server);
            $this->fail('Could not determine temporary SMTP test socket address.');
        }

        $portSeparator = strrpos($socketAddress, ':');
        if ($portSeparator === false) {
            fclose($server);
            $this->fail('Could not determine temporary SMTP test socket port.');
        }

        $port = (int) substr($socketAddress, $portSeparator + 1);

        try {
            $this->postJson('/api/v5/integrations/email-smtp/test', [
                'smtp_host' => '127.0.0.1',
                'smtp_port' => $port,
                'smtp_encryption' => 'tls',
                'smtp_username' => 'sender@gmail.com',
                'test_recipient_email' => 'pvro86@gmail.com, vnpthishg@gmail.com',
            ])
                ->assertStatus(422)
                ->assertJsonPath('message', 'Chưa có App Password để kiểm tra. Vui lòng nhập App Password và bấm Lưu.');
        } finally {
            fclose($server);
        }
    }

    public function test_email_smtp_test_persists_short_human_readable_error_message_when_mailer_throws_long_auth_error(): void
    {
        $server = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
        if ($server === false) {
            $this->fail(sprintf('Could not start temporary SMTP test socket: %s (%s)', $errstr, (string) $errno));
        }

        $socketAddress = stream_socket_get_name($server, false);
        if (! is_string($socketAddress) || $socketAddress === '') {
            fclose($server);
            $this->fail('Could not determine temporary SMTP test socket address.');
        }

        $portSeparator = strrpos($socketAddress, ':');
        if ($portSeparator === false) {
            fclose($server);
            $this->fail('Could not determine temporary SMTP test socket port.');
        }

        $port = (int) substr($socketAddress, $portSeparator + 1);

        Mail::shouldReceive('raw')
            ->once()
            ->andThrow(new \Exception(
                'Failed to authenticate on SMTP server with username "vnpthishg@gmail.com" using the following authenticator(s): "LOGIN", "PLAIN", "XOAUTH2". Authenticator "LOGIN" returned "Expected response code "235" but got code "534", with message "534-5.7.9 Application-specific password required. 534 5.7.9 https://support.google.com/mail/?p=InvalidSecondFactor".'
            ));

        try {
            $this->postJson('/api/v5/integrations/email-smtp/test', [
                'smtp_host' => '127.0.0.1',
                'smtp_port' => $port,
                'smtp_encryption' => 'tls',
                'smtp_username' => 'sender@gmail.com',
                'smtp_password' => 'invalid-password',
                'smtp_from_address' => 'sender@gmail.com',
                'smtp_from_name' => 'VNPT Business',
                'test_recipient_email' => 'pvro86@gmail.com, vnpthishg@gmail.com',
            ])
                ->assertStatus(422)
                ->assertJsonPath('message', 'Xác thực Gmail thất bại: App Password không đúng hoặc chưa được bật. Vui lòng tạo App Password mới, bấm Lưu cấu hình, rồi Kiểm tra lại.');
        } finally {
            fclose($server);
        }

        $stored = DB::table('integration_settings')->where('provider', 'EMAIL_SMTP')->first();
        $this->assertNotNull($stored);
        $this->assertSame(
            'Xác thực Gmail thất bại: App Password không đúng hoặc chưa được bật. Vui lòng tạo App Password mới, bấm Lưu cấu hình, rồi Kiểm tra lại.',
            $stored->last_test_message
        );
        $this->assertLessThanOrEqual(500, strlen((string) $stored->last_test_message));
    }

    public function test_contract_expiry_alert_settings_can_get_update_and_persist_to_database(): void
    {
        $this->putJson('/api/v5/utilities/contract-expiry-alert', [
            'warning_days' => 45,
        ])
            ->assertOk()
            ->assertJsonPath('data.provider', 'CONTRACT_ALERT')
            ->assertJsonPath('data.warning_days', 45)
            ->assertJsonPath('data.source', 'DB');

        $this->getJson('/api/v5/utilities/contract-expiry-alert')
            ->assertOk()
            ->assertJsonPath('data.warning_days', 45)
            ->assertJsonPath('data.source', 'DB');

        $stored = DB::table('integration_settings')->where('provider', 'CONTRACT_ALERT')->first();
        $this->assertNotNull($stored);
        $this->assertSame(45, (int) $stored->contract_expiry_warning_days);
    }

    public function test_contract_payment_alert_settings_can_get_update_and_persist_to_database(): void
    {
        $this->putJson('/api/v5/utilities/contract-payment-alert', [
            'warning_days' => 21,
        ])
            ->assertOk()
            ->assertJsonPath('data.provider', 'CONTRACT_PAYMENT_ALERT')
            ->assertJsonPath('data.warning_days', 21)
            ->assertJsonPath('data.source', 'DB');

        $this->getJson('/api/v5/utilities/contract-payment-alert')
            ->assertOk()
            ->assertJsonPath('data.warning_days', 21)
            ->assertJsonPath('data.source', 'DB');

        $stored = DB::table('integration_settings')->where('provider', 'CONTRACT_PAYMENT_ALERT')->first();
        $this->assertNotNull($stored);
        $this->assertSame(21, (int) $stored->contract_payment_warning_days);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('integration_settings');

        Schema::create('integration_settings', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('provider')->unique();
            $table->boolean('is_enabled')->default(false);
            $table->unsignedSmallInteger('contract_expiry_warning_days')->nullable();
            $table->unsignedSmallInteger('contract_payment_warning_days')->nullable();
            $table->string('access_key_id')->nullable();
            $table->string('bucket_id')->nullable();
            $table->string('bucket_name')->nullable();
            $table->string('region')->nullable();
            $table->string('endpoint')->nullable();
            $table->string('file_prefix')->nullable();
            $table->string('smtp_host')->nullable();
            $table->integer('smtp_port')->nullable();
            $table->string('smtp_encryption')->nullable();
            $table->string('smtp_username')->nullable();
            $table->text('smtp_password')->nullable();
            $table->string('smtp_recipient_emails', 1000)->nullable();
            $table->string('smtp_from_address')->nullable();
            $table->string('smtp_from_name')->nullable();
            $table->text('secret_access_key')->nullable();
            $table->string('account_email')->nullable();
            $table->string('folder_id')->nullable();
            $table->string('scopes', 500)->nullable();
            $table->string('impersonate_user')->nullable();
            $table->text('service_account_json')->nullable();
            $table->timestamp('last_tested_at')->nullable();
            $table->string('last_test_status')->nullable();
            $table->string('last_test_message', 500)->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
        });
    }

    private function makeGoogleServiceAccountJson(): string
    {
        $key = openssl_pkey_new([
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
            'private_key_bits' => 1024,
        ]);

        $privateKey = '';
        if ($key === false || ! openssl_pkey_export($key, $privateKey)) {
            $this->fail('Could not generate a temporary RSA key for Google Drive integration test.');
        }

        $payload = [
            'type' => 'service_account',
            'project_id' => 'vnpt-test',
            'private_key_id' => 'test-key-id',
            'private_key' => $privateKey,
            'client_email' => 'service-account@example.com',
            'client_id' => '1234567890',
            'token_uri' => 'https://oauth2.googleapis.com/token',
        ];

        $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if (! is_string($encoded)) {
            $this->fail('Could not encode Google Drive service account fixture.');
        }

        return $encoded;
    }

    private function setTemporaryEnv(string $key, ?string $value): void
    {
        if ($value === null) {
            putenv($key);
            unset($_ENV[$key], $_SERVER[$key]);

            return;
        }

        putenv($key.'='.$value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}
