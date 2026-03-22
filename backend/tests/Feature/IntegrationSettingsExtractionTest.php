<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
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

    private function setUpSchema(): void
    {
        Schema::dropIfExists('integration_settings');

        Schema::create('integration_settings', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('provider')->unique();
            $table->boolean('is_enabled')->default(false);
            $table->string('access_key_id')->nullable();
            $table->string('bucket_id')->nullable();
            $table->string('bucket_name')->nullable();
            $table->string('region')->nullable();
            $table->string('endpoint')->nullable();
            $table->string('file_prefix')->nullable();
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
}
