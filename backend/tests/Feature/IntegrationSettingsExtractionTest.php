<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
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

        Cache::store('file')->forget('telegram:polling:last_update_id');
    }

    protected function tearDown(): void
    {
        Cache::store('file')->forget('telegram:polling:last_update_id');

        parent::tearDown();
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

    public function test_telegram_settings_can_get_update_and_test_via_api(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => true,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])
            ->assertOk()
            ->assertJsonPath('data.provider', 'TELEGRAM')
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.bot_username', '@vnpt_notify_bot')
            ->assertJsonPath('data.has_bot_token', true)
            ->assertJsonPath('data.source', 'DB');

        Http::fake([
            'https://api.telegram.org/bot123456:ABC-DEF_test_token_001/getMe' => Http::response([
                'ok' => true,
                'result' => [
                    'id' => 987654321,
                    'is_bot' => true,
                    'first_name' => 'VNPT Notify',
                    'username' => 'vnpt_notify_bot',
                ],
            ], 200),
        ]);

        $this->postJson('/api/v5/integrations/telegram/test')
            ->assertOk()
            ->assertJsonPath('data.status', 'SUCCESS')
            ->assertJsonPath('data.bot.username', 'vnpt_notify_bot')
            ->assertJsonPath('data.persisted', true);

        $stored = DB::table('integration_settings')->where('provider', 'TELEGRAM')->first();
        $this->assertNotNull($stored);
        $this->assertSame('SUCCESS', $stored->telegram_last_test_status);
        $this->assertNotNull($stored->telegram_bot_token_encrypted);
        $this->assertNotSame('123456:ABC-DEF_test_token_001', $stored->telegram_bot_token_encrypted);

        $this->getJson('/api/v5/integrations/telegram')
            ->assertOk()
            ->assertJsonPath('data.has_bot_token', true)
            ->assertJsonMissingPath('data.bot_token');
    }

    public function test_telegram_webhook_replies_with_chat_id_on_start_command(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => true,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])->assertOk();

        Http::fake([
            'https://api.telegram.org/bot123456:ABC-DEF_test_token_001/sendMessage' => Http::response([
                'ok' => true,
                'result' => [
                    'message_id' => 11,
                ],
            ], 200),
        ]);

        $this->postJson('/api/v5/telegram/webhook', [
            'update_id' => 442887254,
            'message' => [
                'text' => '/start',
                'chat' => [
                    'id' => 1994683418,
                    'username' => 'ManhQuynh1999',
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        Http::assertSent(function ($request): bool {
            if (! str_contains((string) $request->url(), '/sendMessage')) {
                return false;
            }

            $body = $request->data();
            $text = (string) ($body['text'] ?? '');

            return (string) ($body['chat_id'] ?? '') === '1994683418'
                && str_contains($text, 'Chat ID của bạn là: 1994683418')
                && str_contains($text, 'Vui lòng gửi chat ID này cho quản trị viên để cập nhật vào phần mềm.');
        });
    }

    public function test_telegram_webhook_ignores_non_start_message(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => true,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])->assertOk();

        Http::fake();

        $this->postJson('/api/v5/telegram/webhook', [
            'update_id' => 442887255,
            'message' => [
                'text' => 'hello',
                'chat' => [
                    'id' => 1994683418,
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        Http::assertNothingSent();
    }

    public function test_telegram_webhook_ignores_start_when_telegram_integration_disabled(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => false,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])->assertOk();

        Http::fake();

        $this->postJson('/api/v5/telegram/webhook', [
            'update_id' => 442887256,
            'message' => [
                'text' => '/start',
                'chat' => [
                    'id' => 1994683418,
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        Http::assertNothingSent();
    }

    public function test_telegram_webhook_handles_start_without_chat_id(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => true,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])->assertOk();

        Http::fake();

        $this->postJson('/api/v5/telegram/webhook', [
            'update_id' => 442887257,
            'message' => [
                'text' => '/start',
                'chat' => [
                    'username' => 'ManhQuynh1999',
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        Http::assertNothingSent();
    }

    public function test_telegram_webhook_keeps_ok_response_when_send_message_fails(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => true,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])->assertOk();

        Http::fake([
            'https://api.telegram.org/bot123456:ABC-DEF_test_token_001/sendMessage' => Http::response([
                'ok' => false,
                'description' => 'Forbidden: bot was blocked by the user',
            ], 403),
        ]);

        $this->postJson('/api/v5/telegram/webhook', [
            'update_id' => 442887258,
            'message' => [
                'text' => '/start',
                'chat' => [
                    'id' => 1994683418,
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_telegram_webhook_returns_ok_when_telegram_columns_missing(): void
    {
        Schema::table('integration_settings', function (Blueprint $table): void {
            if (Schema::hasColumn('integration_settings', 'telegram_bot_token_encrypted')) {
                $table->dropColumn('telegram_bot_token_encrypted');
            }
        });

        Http::fake();

        $this->postJson('/api/v5/telegram/webhook', [
            'update_id' => 442887259,
            'message' => [
                'text' => '/start',
                'chat' => [
                    'id' => 1994683418,
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        Http::assertNothingSent();
    }

    public function test_telegram_webhook_ignores_non_message_update_payload(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => true,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])->assertOk();

        Http::fake();

        $this->postJson('/api/v5/telegram/webhook', [
            'update_id' => 442887260,
            'callback_query' => [
                'id' => 'abc',
            ],
        ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        Http::assertNothingSent();
    }

    public function test_telegram_polling_command_replies_with_chat_id_on_start_command(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => true,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])->assertOk();

        Http::fake([
            'https://api.telegram.org/bot123456:ABC-DEF_test_token_001/getUpdates*' => Http::response([
                'ok' => true,
                'result' => [
                    [
                        'update_id' => 442887261,
                        'message' => [
                            'text' => '/start',
                            'chat' => [
                                'id' => 1994683418,
                                'username' => 'ManhQuynh1999',
                            ],
                        ],
                    ],
                ],
            ], 200),
            'https://api.telegram.org/bot123456:ABC-DEF_test_token_001/sendMessage' => Http::response([
                'ok' => true,
                'result' => [
                    'message_id' => 12,
                ],
            ], 200),
        ]);

        $this->artisan('telegram:poll-updates')
            ->expectsOutput('Telegram poll OK: processed=1, start_commands=1, next_offset=442887262')
            ->assertSuccessful();

        Http::assertSent(function ($request): bool {
            if (! str_contains((string) $request->url(), '/sendMessage')) {
                return false;
            }

            $body = $request->data();

            return (string) ($body['chat_id'] ?? '') === '1994683418'
                && str_contains((string) ($body['text'] ?? ''), 'Chat ID của bạn là: 1994683418');
        });
    }

    public function test_telegram_polling_command_skips_when_disabled(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => false,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])->assertOk();

        Http::fake();

        $this->artisan('telegram:poll-updates')
            ->expectsOutput('Telegram poll SKIPPED (telegram_disabled).')
            ->assertSuccessful();

        Http::assertNothingSent();
    }

    public function test_telegram_polling_command_skips_when_missing_token(): void
    {
        DB::table('integration_settings')->insert([
            'provider' => 'TELEGRAM',
            'is_enabled' => true,
            'telegram_enabled' => true,
            'telegram_bot_username' => '@vnpt_notify_bot',
            'telegram_bot_token_encrypted' => null,
        ]);

        Http::fake();

        $this->artisan('telegram:poll-updates')
            ->expectsOutput('Telegram poll SKIPPED (missing_bot_token).')
            ->assertSuccessful();

        Http::assertNothingSent();
    }

    public function test_telegram_polling_command_fails_when_get_updates_errors(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => true,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])->assertOk();

        Http::fake([
            'https://api.telegram.org/bot123456:ABC-DEF_test_token_001/getUpdates*' => Http::response([
                'ok' => false,
                'description' => 'Bad Request: invalid token',
            ], 401),
        ]);

        $this->artisan('telegram:poll-updates')
            ->expectsOutput('Telegram poll FAILED (telegram_get_updates_failed): Bad Request: invalid token')
            ->assertFailed();
    }

    public function test_telegram_polling_command_advances_offset_and_ignores_old_updates(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => true,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])->assertOk();

        Http::fake([
            'https://api.telegram.org/bot123456:ABC-DEF_test_token_001/getUpdates*' => Http::response([
                'ok' => true,
                'result' => [
                    [
                        'update_id' => 100,
                        'message' => [
                            'text' => '/start',
                            'chat' => ['id' => 2001],
                        ],
                    ],
                ],
            ], 200),
            'https://api.telegram.org/bot123456:ABC-DEF_test_token_001/sendMessage' => Http::response([
                'ok' => true,
                'result' => ['message_id' => 1],
            ], 200),
        ]);

        $this->artisan('telegram:poll-updates')
            ->expectsOutput('Telegram poll OK: processed=1, start_commands=1, next_offset=101')
            ->assertSuccessful();

        Http::assertSent(function ($request): bool {
            if (! str_contains((string) $request->url(), '/getUpdates')) {
                return false;
            }

            return (string) ($request->data()['offset'] ?? '') === '0';
        });

        Http::fake([
            'https://api.telegram.org/bot123456:ABC-DEF_test_token_001/getUpdates*' => Http::response([
                'ok' => true,
                'result' => [],
            ], 200),
        ]);

        $this->artisan('telegram:poll-updates')
            ->assertSuccessful();

        $this->assertSame(101, Cache::store('file')->get('telegram:polling:last_update_id'));

        Http::assertSent(function ($request): bool {
            if (! str_contains((string) $request->url(), '/getUpdates')) {
                return false;
            }

            return (string) ($request->data()['offset'] ?? '') === '101';
        });
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

    public function test_send_reminder_telegram_success_returns_sent_payload(): void
    {
        $this->setUpReminderTelegramSchema();
        $this->enableTelegramIntegration();

        DB::table('reminders')->insert([
            'id' => 'R001',
            'reminder_title' => 'Nhắc gia hạn tài liệu',
            'content' => 'Kiểm tra hợp đồng và biên bản nghiệm thu.',
            'remind_date' => '2099-01-01',
            'assigned_to' => 1,
            'status' => 'ACTIVE',
            'created_at' => now(),
        ]);

        DB::table('internal_users')->insert([
            'id' => 1,
            'full_name' => 'Nguyễn Văn A',
            'username' => 'nva',
            'telechatbot' => '1994683418',
        ]);

        Http::fake([
            'https://api.telegram.org/bot123456:ABC-DEF_test_token_001/sendMessage' => Http::response([
                'ok' => true,
                'result' => [
                    'message_id' => 2001,
                ],
            ], 200),
        ]);

        $this->postJson('/api/v5/reminders/R001/send-telegram', [
            'recipient_user_id' => 1,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'SENT')
            ->assertJsonPath('recipient_user_id', '1')
            ->assertJsonPath('recipient_name', 'Nguyễn Văn A')
            ->assertJsonPath('reminder.id', 'R001')
            ->assertJsonPath('reminder.title', 'Nhắc gia hạn tài liệu')
            ->assertJsonPath('reminder.remindDate', '2099-01-01');
    }

    public function test_send_reminder_telegram_returns_404_when_reminder_not_found(): void
    {
        $this->setUpReminderTelegramSchema();
        $this->enableTelegramIntegration();

        DB::table('internal_users')->insert([
            'id' => 1,
            'full_name' => 'Nguyễn Văn A',
            'username' => 'nva',
            'telechatbot' => '1994683418',
        ]);

        Http::fake();

        $this->postJson('/api/v5/reminders/NOT_FOUND/send-telegram', [
            'recipient_user_id' => 1,
        ])
            ->assertStatus(404)
            ->assertJsonPath('message', 'Không tìm thấy nhắc việc.');

        Http::assertNothingSent();
    }

    public function test_send_reminder_telegram_returns_404_when_recipient_not_found(): void
    {
        $this->setUpReminderTelegramSchema();
        $this->enableTelegramIntegration();

        DB::table('reminders')->insert([
            'id' => 'R001',
            'reminder_title' => 'Nhắc gia hạn tài liệu',
            'content' => 'Kiểm tra hợp đồng và biên bản nghiệm thu.',
            'remind_date' => '2099-01-01',
            'assigned_to' => 1,
            'status' => 'ACTIVE',
            'created_at' => now(),
        ]);

        Http::fake();

        $this->postJson('/api/v5/reminders/R001/send-telegram', [
            'recipient_user_id' => 999,
        ])
            ->assertStatus(404)
            ->assertJsonPath('message', 'Không tìm thấy người nhận.');

        Http::assertNothingSent();
    }

    public function test_send_reminder_telegram_returns_422_when_recipient_has_no_chat_id(): void
    {
        $this->setUpReminderTelegramSchema();
        $this->enableTelegramIntegration();

        DB::table('reminders')->insert([
            'id' => 'R001',
            'reminder_title' => 'Nhắc gia hạn tài liệu',
            'content' => 'Kiểm tra hợp đồng và biên bản nghiệm thu.',
            'remind_date' => '2099-01-01',
            'assigned_to' => 1,
            'status' => 'ACTIVE',
            'created_at' => now(),
        ]);

        DB::table('internal_users')->insert([
            'id' => 1,
            'full_name' => 'Nguyễn Văn B',
            'username' => 'nvb',
            'telechatbot' => null,
        ]);

        Http::fake();

        $this->postJson('/api/v5/reminders/R001/send-telegram', [
            'recipient_user_id' => 1,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Người nhận chưa được gán Telegram chat ID.');

        Http::assertNothingSent();
    }

    public function test_send_reminder_telegram_returns_422_when_telegram_send_fails(): void
    {
        $this->setUpReminderTelegramSchema();
        $this->enableTelegramIntegration();

        DB::table('reminders')->insert([
            'id' => 'R001',
            'reminder_title' => 'Nhắc gia hạn tài liệu',
            'content' => 'Kiểm tra hợp đồng và biên bản nghiệm thu.',
            'remind_date' => '2099-01-01',
            'assigned_to' => 1,
            'status' => 'ACTIVE',
            'created_at' => now(),
        ]);

        DB::table('internal_users')->insert([
            'id' => 1,
            'full_name' => 'Nguyễn Văn A',
            'username' => 'nva',
            'telechatbot' => '1994683418',
        ]);

        Http::fake([
            'https://api.telegram.org/bot123456:ABC-DEF_test_token_001/sendMessage' => Http::response([
                'ok' => false,
                'description' => 'Forbidden: bot was blocked by the user',
            ], 403),
        ]);

        $this->postJson('/api/v5/reminders/R001/send-telegram', [
            'recipient_user_id' => 1,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Forbidden: bot was blocked by the user');
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

    private function setUpReminderTelegramSchema(): void
    {
        Schema::dropIfExists('reminders');
        Schema::dropIfExists('internal_users');

        Schema::create('reminders', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('reminder_title')->nullable();
            $table->text('content')->nullable();
            $table->date('remind_date')->nullable();
            $table->unsignedBigInteger('assigned_to')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary();
            $table->string('username')->nullable();
            $table->string('full_name')->nullable();
            $table->string('telechatbot')->nullable();
        });
    }

    private function enableTelegramIntegration(): void
    {
        $this->putJson('/api/v5/integrations/telegram', [
            'enabled' => true,
            'bot_username' => '@vnpt_notify_bot',
            'bot_token' => '123456:ABC-DEF_test_token_001',
        ])->assertOk();
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
            $table->boolean('telegram_enabled')->default(false);
            $table->string('telegram_bot_username')->nullable();
            $table->text('telegram_bot_token_encrypted')->nullable();
            $table->string('telegram_last_test_status')->nullable();
            $table->string('telegram_last_test_message', 500)->nullable();
            $table->timestamp('telegram_last_test_at')->nullable();
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
