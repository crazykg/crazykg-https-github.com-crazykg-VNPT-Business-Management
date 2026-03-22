<?php

namespace App\Services\V5\IntegrationSettings;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\Client\Response as HttpResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class BackblazeB2IntegrationService
{
    private const PROVIDER = 'BACKBLAZE_B2';
    private const DEFAULT_REGION = 'us-west-004';
    private const DEFAULT_ENDPOINT = 'https://s3.us-west-004.backblazeb2.com';

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function settings(): JsonResponse
    {
        $runtimeConfig = $this->resolveRuntimeConfig();
        $settingsRow = $this->loadSettingsRow();

        return response()->json([
            'data' => [
                'provider' => self::PROVIDER,
                'is_enabled' => (bool) ($runtimeConfig['is_enabled'] ?? false),
                'access_key_id' => $runtimeConfig['access_key_id'] ?? null,
                'bucket_id' => $runtimeConfig['bucket_id'] ?? null,
                'bucket_name' => $runtimeConfig['bucket_name'] ?? null,
                'region' => $runtimeConfig['region'] ?? null,
                'endpoint' => $runtimeConfig['endpoint'] ?? null,
                'file_prefix' => $runtimeConfig['file_prefix'] ?? null,
                'has_secret_access_key' => (bool) ($runtimeConfig['has_secret_access_key'] ?? false),
                'secret_access_key_preview' => $this->maskSecretAccessKey($runtimeConfig['secret_access_key'] ?? null),
                'source' => $runtimeConfig['source'] ?? 'ENV',
                'last_tested_at' => $settingsRow['last_tested_at'] ?? null,
                'last_test_status' => $settingsRow['last_test_status'] ?? null,
                'last_test_message' => $settingsRow['last_test_message'] ?? null,
                'updated_at' => $settingsRow['updated_at'] ?? null,
            ],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('integration_settings')) {
            return response()->json([
                'message' => 'Bảng integration_settings chưa tồn tại. Vui lòng chạy migration trước.',
            ], 422);
        }

        $validated = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'access_key_id' => ['nullable', 'string', 'max:255'],
            'bucket_id' => ['nullable', 'string', 'max:255'],
            'bucket_name' => ['nullable', 'string', 'max:255'],
            'region' => ['nullable', 'string', 'max:100'],
            'file_prefix' => ['nullable', 'string', 'max:100'],
            'secret_access_key' => ['nullable', 'string', 'max:120000'],
            'clear_secret_access_key' => ['nullable', 'boolean'],
        ]);

        $actorId = $this->support->parseNullableInt($request->user()?->id ?? null);
        $now = now();
        $existing = $this->loadSettingsRow();

        $payload = [
            'is_enabled' => (bool) ($validated['is_enabled'] ?? false),
            'access_key_id' => $this->support->normalizeNullableString($validated['access_key_id'] ?? null),
            'bucket_id' => $this->support->normalizeNullableString($validated['bucket_id'] ?? null),
            'bucket_name' => $this->support->normalizeNullableString($validated['bucket_name'] ?? null),
            'region' => $this->support->normalizeNullableString($validated['region'] ?? null),
            'endpoint' => $this->resolveEndpoint(
                $validated['region'] ?? null,
                $existing['endpoint'] ?? null
            ),
            'file_prefix' => $this->support->normalizeNullableString($validated['file_prefix'] ?? null),
            'updated_at' => $now,
            'updated_by' => $actorId,
        ];

        $shouldClearSecret = (bool) ($validated['clear_secret_access_key'] ?? false);
        $secretAccessKey = $this->support->normalizeNullableString($validated['secret_access_key'] ?? null);

        if ($shouldClearSecret) {
            $payload['secret_access_key'] = null;
        } elseif ($secretAccessKey !== null) {
            $payload['secret_access_key'] = Crypt::encryptString($secretAccessKey);
        }

        $configurationChanged = $existing === null
            || (bool) ($existing['is_enabled'] ?? false) !== (bool) $payload['is_enabled']
            || $this->support->normalizeNullableString($existing['access_key_id'] ?? null) !== $this->support->normalizeNullableString($payload['access_key_id'] ?? null)
            || $this->support->normalizeNullableString($existing['bucket_id'] ?? null) !== $this->support->normalizeNullableString($payload['bucket_id'] ?? null)
            || $this->support->normalizeNullableString($existing['bucket_name'] ?? null) !== $this->support->normalizeNullableString($payload['bucket_name'] ?? null)
            || $this->support->normalizeNullableString($existing['region'] ?? null) !== $this->support->normalizeNullableString($payload['region'] ?? null)
            || $this->support->normalizeNullableString($existing['endpoint'] ?? null) !== $this->support->normalizeNullableString($payload['endpoint'] ?? null)
            || $this->support->normalizeNullableString($existing['file_prefix'] ?? null) !== $this->support->normalizeNullableString($payload['file_prefix'] ?? null)
            || $shouldClearSecret
            || array_key_exists('secret_access_key', $payload);

        if ($configurationChanged) {
            $payload['last_tested_at'] = null;
            $payload['last_test_status'] = null;
            $payload['last_test_message'] = 'Cấu hình đã thay đổi. Vui lòng kiểm tra kết nối lại.';
        }

        if ($existing === null) {
            $payload['created_at'] = $now;
            $payload['created_by'] = $actorId;
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::PROVIDER],
            $this->support->filterPayloadByTableColumns('integration_settings', $payload)
        );

        return $this->settings();
    }

    public function testSettings(Request $request): JsonResponse
    {
        $runtimeConfig = $this->resolveRuntimeConfig();
        $hasOverrides = $request->hasAny([
            'is_enabled',
            'access_key_id',
            'bucket_id',
            'bucket_name',
            'region',
            'file_prefix',
            'secret_access_key',
            'clear_secret_access_key',
        ]);

        if ($hasOverrides) {
            $validated = $request->validate([
                'is_enabled' => ['nullable', 'boolean'],
                'access_key_id' => ['nullable', 'string', 'max:255'],
                'bucket_id' => ['nullable', 'string', 'max:255'],
                'bucket_name' => ['nullable', 'string', 'max:255'],
                'region' => ['nullable', 'string', 'max:100'],
                'file_prefix' => ['nullable', 'string', 'max:100'],
                'secret_access_key' => ['nullable', 'string', 'max:120000'],
                'clear_secret_access_key' => ['nullable', 'boolean'],
            ]);

            $overrideResult = $this->applyRuntimeConfigOverrides($runtimeConfig, $validated);
            if (! ($overrideResult['success'] ?? false)) {
                return response()->json([
                    'message' => trim((string) ($overrideResult['errorMessage'] ?? 'Cấu hình Backblaze B2 không hợp lệ.')),
                ], 422);
            }

            $runtimeConfig = $overrideResult['config'];
        }

        $shouldPersistTestResult = ! $hasOverrides;

        if (! (bool) ($runtimeConfig['is_enabled'] ?? false)) {
            if ($shouldPersistTestResult) {
                $this->saveTestResult('FAILED', 'Backblaze B2 đang ở trạng thái tắt.');
            }

            return response()->json([
                'message' => 'Backblaze B2 đang ở trạng thái tắt.',
            ], 422);
        }

        $validation = $this->validateRuntimeConfig($runtimeConfig);
        if (! ($validation['success'] ?? false)) {
            $message = trim((string) ($validation['errorMessage'] ?? 'Cấu hình Backblaze B2 chưa hợp lệ.'));
            if ($shouldPersistTestResult) {
                $this->saveTestResult('FAILED', $message);
            }

            return response()->json([
                'message' => $message,
            ], 422);
        }

        $result = $this->verifyUploadCapability($runtimeConfig);
        if (! ($result['success'] ?? false)) {
            $message = trim((string) ($result['errorMessage'] ?? 'Backblaze B2 chưa ghi được file test.'));
            if ($shouldPersistTestResult) {
                $this->saveTestResult('FAILED', $message);
            }

            return response()->json([
                'message' => $message,
            ], 422);
        }

        $successMessage = 'Kết nối Backblaze B2 thành công và có thể tải file.';
        if ($shouldPersistTestResult) {
            $this->saveTestResult('SUCCESS', $successMessage);
        }

        return response()->json([
            'data' => [
                'message' => $successMessage,
                'status' => 'SUCCESS',
                'tested_at' => now()->toIso8601String(),
                'persisted' => $shouldPersistTestResult,
            ],
        ]);
    }

    public function isConfigured(): bool
    {
        $config = $this->resolveRuntimeConfig();
        if (! (bool) ($config['is_enabled'] ?? false)) {
            return false;
        }

        $validation = $this->validateRuntimeConfig($config);

        return (bool) ($validation['success'] ?? false);
    }

    /**
     * @return array{success:bool,storagePath?:string,storageDisk?:string,errorMessage?:string}
     */
    public function uploadFile(UploadedFile $file): array
    {
        $runtimeConfig = $this->resolveRuntimeConfig();
        $validation = $this->validateRuntimeConfig($runtimeConfig);
        if (! ($validation['success'] ?? false)) {
            return [
                'success' => false,
                'errorMessage' => (string) ($validation['errorMessage'] ?? 'Cấu hình Backblaze B2 chưa hợp lệ.'),
            ];
        }

        try {
            $authorization = $this->authorizeAccount($runtimeConfig);
            $this->resolveBucket($runtimeConfig, $authorization);
            $objectKey = $this->buildObjectKey($runtimeConfig, $file->getClientOriginalName(), 'documents');
            $contents = file_get_contents($file->getRealPath());
            if ($contents === false) {
                throw new \RuntimeException('Không thể đọc nội dung file tải lên.');
            }
            $this->uploadString(
                $runtimeConfig,
                $authorization,
                $objectKey,
                $contents,
                $file->getClientMimeType() ?: 'application/octet-stream'
            );

            return [
                'success' => true,
                'storagePath' => $objectKey,
                'storageDisk' => 'backblaze_b2',
            ];
        } catch (\Throwable $exception) {
            return [
                'success' => false,
                'errorMessage' => $this->normalizeErrorMessage($exception),
            ];
        }
    }

    public function deleteFileByStoragePath(string $storagePath): void
    {
        $path = trim($storagePath);
        if ($path === '') {
            return;
        }

        $runtimeConfig = $this->resolveRuntimeConfig();
        $authorization = $this->authorizeAccount($runtimeConfig);
        $this->resolveBucket($runtimeConfig, $authorization);
        $file = $this->findFileByName($runtimeConfig, $authorization, $path);

        if ($file === null) {
            return;
        }

        $this->deleteFileVersion(
            $authorization,
            trim((string) ($file['fileId'] ?? '')),
            trim((string) ($file['fileName'] ?? $path))
        );
    }

    public function downloadAttachmentResponse(string $storagePath, string $fileName): Response
    {
        $path = trim($storagePath);
        if ($path === '') {
            return response()->json(['message' => 'Attachment not found.'], 404);
        }

        try {
            $runtimeConfig = $this->resolveRuntimeConfig();
            $authorization = $this->authorizeAccount($runtimeConfig);
            $bucket = $this->resolveBucket($runtimeConfig, $authorization);
            $downloadUrl = rtrim($authorization['download_url'], '/')
                .'/file/'
                .rawurlencode((string) ($bucket['bucketName'] ?? $runtimeConfig['bucket_name'] ?? ''))
                .'/'
                .$this->encodeObjectKeyForUrl($path);

            $response = Http::withHeaders([
                'Authorization' => $authorization['authorization_token'],
            ])->withOptions([
                'stream' => true,
            ])->timeout(300)->get($downloadUrl);

            if (! $response->successful()) {
                $status = $response->status() === 404 ? 404 : 422;

                return response()->json([
                    'message' => $this->normalizeHttpError(
                        $response,
                        'Không thể tải file từ Backblaze B2.'
                    ),
                ], $status);
            }

            $psrResponse = $response->toPsrResponse();
            $stream = $psrResponse->getBody();
            $headers = [];
            $contentType = $response->header('Content-Type');
            if (is_string($contentType) && trim($contentType) !== '') {
                $headers['Content-Type'] = $contentType;
            }
            $headers['Content-Disposition'] = $this->buildInlineContentDispositionHeader($fileName);

            return response()->stream(function () use ($stream): void {
                while (! $stream->eof()) {
                    echo $stream->read(1024 * 1024);
                }
            }, 200, $headers);
        } catch (\Throwable $exception) {
            $message = $this->normalizeErrorMessage($exception, 'Không thể tải file từ Backblaze B2.');

            return response()->json(['message' => $message], 422);
        }
    }

    /**
     * @return array{
     *     is_enabled:bool,
     *     access_key_id:?string,
     *     bucket_id:?string,
     *     secret_access_key:?string,
     *     bucket_name:?string,
     *     region:string,
     *     endpoint:string,
     *     file_prefix:?string,
     *     has_secret_access_key:bool,
     *     source:string
     * }
     */
    private function resolveRuntimeConfig(): array
    {
        $row = $this->loadSettingsRow();
        if ($row !== null) {
            $secretAccessKey = $this->decodeSecretAccessKey($row['secret_access_key'] ?? null);
            if ($secretAccessKey === null) {
                $secretAccessKey = $this->getSecretAccessKeyFromEnv();
            }

            return [
                'is_enabled' => (bool) ($row['is_enabled'] ?? false),
                'access_key_id' => $this->support->normalizeNullableString($row['access_key_id'] ?? null),
                'bucket_id' => $this->support->normalizeNullableString($row['bucket_id'] ?? null),
                'secret_access_key' => $secretAccessKey,
                'bucket_name' => $this->support->normalizeNullableString($row['bucket_name'] ?? null),
                'region' => $this->resolveRegion($row['region'] ?? null),
                'endpoint' => $this->resolveEndpoint($row['region'] ?? null, $row['endpoint'] ?? null),
                'file_prefix' => $this->support->normalizeNullableString($row['file_prefix'] ?? null),
                'has_secret_access_key' => $secretAccessKey !== null,
                'source' => 'DB',
            ];
        }

        $secretAccessKey = $this->getSecretAccessKeyFromEnv();
        $region = $this->resolveRegion($this->getEnvValue('B2_REGION', 'BACKBLAZE_B2_REGION'));

        return [
            'is_enabled' => filter_var(
                $this->getEnvValue('B2_ENABLED', 'BACKBLAZE_B2_ENABLED') ?? false,
                FILTER_VALIDATE_BOOLEAN
            ),
            'access_key_id' => $this->getEnvValue('B2_KEY_ID', 'BACKBLAZE_B2_ACCESS_KEY_ID'),
            'bucket_id' => $this->getEnvValue('B2_BUCKET_ID'),
            'secret_access_key' => $secretAccessKey,
            'bucket_name' => $this->getEnvValue('B2_BUCKET_NAME', 'BACKBLAZE_B2_BUCKET'),
            'region' => $region,
            'endpoint' => $this->resolveEndpoint(
                $region,
                $this->getEnvValue('B2_ENDPOINT', 'BACKBLAZE_B2_ENDPOINT')
            ),
            'file_prefix' => $this->getEnvValue('B2_FILE_PREFIX', 'BACKBLAZE_B2_FILE_PREFIX'),
            'has_secret_access_key' => $secretAccessKey !== null,
            'source' => 'ENV',
        ];
    }

    /**
     * @return array<string,mixed>|null
     */
    private function loadSettingsRow(): ?array
    {
        if (! $this->support->hasTable('integration_settings')) {
            return null;
        }

        $record = DB::table('integration_settings')
            ->select($this->support->selectColumns('integration_settings', [
                'provider',
                'is_enabled',
                'access_key_id',
                'bucket_id',
                'bucket_name',
                'region',
                'endpoint',
                'file_prefix',
                'secret_access_key',
                'last_tested_at',
                'last_test_status',
                'last_test_message',
                'updated_at',
                'updated_by',
                'created_at',
                'created_by',
            ]))
            ->where('provider', self::PROVIDER)
            ->first();

        return $record !== null ? (array) $record : null;
    }

    private function getEnvValue(string $primaryKey, ?string $legacyKey = null): ?string
    {
        $primaryValue = $this->support->normalizeNullableString(env($primaryKey));
        if ($primaryValue !== null) {
            return $primaryValue;
        }

        if ($legacyKey !== null) {
            return $this->support->normalizeNullableString(env($legacyKey));
        }

        return null;
    }

    private function getSecretAccessKeyFromEnv(): ?string
    {
        return $this->getEnvValue('B2_APPLICATION_KEY', 'BACKBLAZE_B2_SECRET_ACCESS_KEY');
    }

    private function resolveRegion(mixed $value): string
    {
        return $this->support->normalizeNullableString($value) ?? self::DEFAULT_REGION;
    }

    private function resolveEndpoint(mixed $region, mixed $fallbackEndpoint = null): string
    {
        $normalizedRegion = $this->support->normalizeNullableString($region);
        if ($normalizedRegion !== null) {
            return sprintf('https://s3.%s.backblazeb2.com', $normalizedRegion);
        }

        return $this->support->normalizeNullableString($fallbackEndpoint) ?? self::DEFAULT_ENDPOINT;
    }

    private function decodeSecretAccessKey(mixed $value): ?string
    {
        $raw = $this->support->normalizeNullableString($value);
        if ($raw === null) {
            return null;
        }

        try {
            $decrypted = Crypt::decryptString($raw);

            return $this->support->normalizeNullableString($decrypted);
        } catch (\Throwable) {
            return $raw;
        }
    }

    private function maskSecretAccessKey(mixed $value): ?string
    {
        $raw = $this->support->normalizeNullableString($value);
        if ($raw === null) {
            return null;
        }

        $length = strlen($raw);
        if ($length <= 8) {
            return str_repeat('*', $length);
        }

        $prefixLength = min(6, max(2, intdiv($length, 4)));
        $suffixLength = min(6, max(2, intdiv($length, 5)));
        $maskedLength = max(4, $length - $prefixLength - $suffixLength);

        return sprintf(
            '%s%s%s',
            substr($raw, 0, $prefixLength),
            str_repeat('*', $maskedLength),
            substr($raw, -$suffixLength)
        );
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @return array{success:bool,errorMessage?:string}
     */
    private function validateRuntimeConfig(array $runtimeConfig): array
    {
        $accessKeyId = trim((string) ($runtimeConfig['access_key_id'] ?? ''));
        if ($accessKeyId === '') {
            return [
                'success' => false,
                'errorMessage' => 'Thiếu Key ID của Backblaze B2.',
            ];
        }

        $secretAccessKey = trim((string) ($runtimeConfig['secret_access_key'] ?? ''));
        if ($secretAccessKey === '') {
            return [
                'success' => false,
                'errorMessage' => 'Thiếu Application Key của Backblaze B2.',
            ];
        }

        $bucketName = trim((string) ($runtimeConfig['bucket_name'] ?? ''));
        $bucketId = trim((string) ($runtimeConfig['bucket_id'] ?? ''));
        if ($bucketId === '') {
            return [
                'success' => false,
                'errorMessage' => 'Thiếu Bucket ID của Backblaze B2.',
            ];
        }

        if ($bucketName === '') {
            return [
                'success' => false,
                'errorMessage' => 'Thiếu Bucket name của Backblaze B2.',
            ];
        }

        $region = trim((string) ($runtimeConfig['region'] ?? ''));
        if ($region === '') {
            return [
                'success' => false,
                'errorMessage' => 'Thiếu Region của Backblaze B2.',
            ];
        }

        return ['success' => true];
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @param array<string, mixed> $validated
     * @return array{success:bool,config?:array<string,mixed>,errorMessage?:string}
     */
    private function applyRuntimeConfigOverrides(array $runtimeConfig, array $validated): array
    {
        $config = $runtimeConfig;

        if (array_key_exists('is_enabled', $validated)) {
            $config['is_enabled'] = (bool) ($validated['is_enabled'] ?? false);
        }

        if (array_key_exists('access_key_id', $validated)) {
            $config['access_key_id'] = $this->support->normalizeNullableString($validated['access_key_id'] ?? null);
        }

        if (array_key_exists('bucket_id', $validated)) {
            $config['bucket_id'] = $this->support->normalizeNullableString($validated['bucket_id'] ?? null);
        }

        if (array_key_exists('bucket_name', $validated)) {
            $config['bucket_name'] = $this->support->normalizeNullableString($validated['bucket_name'] ?? null);
        }

        if (array_key_exists('region', $validated)) {
            $config['region'] = $this->support->normalizeNullableString($validated['region'] ?? null);
        }

        if (array_key_exists('file_prefix', $validated)) {
            $config['file_prefix'] = $this->support->normalizeNullableString($validated['file_prefix'] ?? null);
        }

        $config['endpoint'] = $this->resolveEndpoint(
            $config['region'] ?? null,
            $config['endpoint'] ?? null
        );

        $shouldClearSecret = (bool) ($validated['clear_secret_access_key'] ?? false);
        $secretAccessKey = $this->support->normalizeNullableString($validated['secret_access_key'] ?? null);

        if ($shouldClearSecret) {
            $config['secret_access_key'] = null;
            $config['has_secret_access_key'] = false;
        } elseif ($secretAccessKey !== null) {
            $config['secret_access_key'] = $secretAccessKey;
            $config['has_secret_access_key'] = true;
        }

        return [
            'success' => true,
            'config' => $config,
        ];
    }

    private function saveTestResult(string $status, string $message): void
    {
        if (! $this->support->hasTable('integration_settings')) {
            return;
        }

        DB::table('integration_settings')
            ->where('provider', self::PROVIDER)
            ->update($this->support->filterPayloadByTableColumns('integration_settings', [
                'last_tested_at' => now(),
                'last_test_status' => strtoupper($status),
                'last_test_message' => Str::limit(trim($message), 500, '...'),
                'updated_at' => now(),
            ]));
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @return array{success:bool,errorMessage?:string}
     */
    private function verifyUploadCapability(array $runtimeConfig): array
    {
        try {
            $authorization = $this->authorizeAccount($runtimeConfig);
            $this->resolveBucket($runtimeConfig, $authorization);
            $testKey = $this->buildObjectKey($runtimeConfig, 'connection_test.txt', 'health-check');
            $uploadResult = $this->uploadString(
                $runtimeConfig,
                $authorization,
                $testKey,
                'VNPT Backblaze B2 connection test',
                'text/plain'
            );
            $this->deleteFileVersion(
                $authorization,
                (string) ($uploadResult['fileId'] ?? ''),
                (string) ($uploadResult['fileName'] ?? $testKey)
            );

            return ['success' => true];
        } catch (\Throwable $exception) {
            return [
                'success' => false,
                'errorMessage' => $this->normalizeErrorMessage($exception, 'Backblaze B2 chưa ghi được file test.'),
            ];
        }
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @return array{api_url:string,authorization_token:string,download_url:string,account_id:string}
     */
    private function authorizeAccount(array $runtimeConfig): array
    {
        $validation = $this->validateRuntimeConfig($runtimeConfig);
        if (! ($validation['success'] ?? false)) {
            throw new \RuntimeException((string) ($validation['errorMessage'] ?? 'Cấu hình Backblaze B2 chưa hợp lệ.'));
        }

        $accessKeyId = (string) ($runtimeConfig['access_key_id'] ?? '');
        $secretAccessKey = (string) ($runtimeConfig['secret_access_key'] ?? '');

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Basic '.base64_encode($accessKeyId.':'.$secretAccessKey),
                'Accept' => 'application/json',
            ])->timeout(30)->get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account');
        } catch (\Throwable $exception) {
            throw new \RuntimeException($this->normalizeErrorMessage($exception, 'Không thể kết nối tới Backblaze B2 API.'));
        }

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeHttpError(
                $response,
                'Không thể xác thực với Backblaze B2.'
            ));
        }

        $data = $response->json();
        $apiUrl = trim((string) ($data['apiUrl'] ?? ''));
        $authorizationToken = trim((string) ($data['authorizationToken'] ?? ''));
        $downloadUrl = trim((string) ($data['downloadUrl'] ?? ''));
        $accountId = trim((string) ($data['accountId'] ?? ''));

        if ($apiUrl === '' || $authorizationToken === '' || $downloadUrl === '' || $accountId === '') {
            throw new \RuntimeException('Backblaze B2 không trả đủ thông tin xác thực tài khoản.');
        }

        return [
            'api_url' => $apiUrl,
            'authorization_token' => $authorizationToken,
            'download_url' => $downloadUrl,
            'account_id' => $accountId,
        ];
    }

    /**
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     * @param array<string, mixed> $payload
     */
    private function callJsonApi(array $authorization, string $action, array $payload): HttpResponse
    {
        try {
            return Http::withHeaders([
                'Authorization' => $authorization['authorization_token'],
                'Accept' => 'application/json',
            ])->timeout(60)->post(rtrim($authorization['api_url'], '/').'/b2api/v2/'.$action, $payload);
        } catch (\Throwable $exception) {
            throw new \RuntimeException($this->normalizeErrorMessage($exception, 'Không thể kết nối tới Backblaze B2 API.'));
        }
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     * @return array<string, mixed>
     */
    private function resolveBucket(array $runtimeConfig, array $authorization): array
    {
        $bucketId = trim((string) ($runtimeConfig['bucket_id'] ?? ''));
        $bucketName = trim((string) ($runtimeConfig['bucket_name'] ?? ''));

        $response = $this->callJsonApi($authorization, 'b2_list_buckets', [
            'accountId' => $authorization['account_id'],
            'bucketId' => $bucketId,
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeHttpError(
                $response,
                'Không thể kiểm tra Bucket của Backblaze B2.'
            ));
        }

        $buckets = $response->json('buckets');
        if (! is_array($buckets) || $buckets === []) {
            throw new \RuntimeException('Backblaze B2 không tìm thấy Bucket ID đích.');
        }

        $bucket = null;
        foreach ($buckets as $item) {
            if (! is_array($item)) {
                continue;
            }

            if (trim((string) ($item['bucketId'] ?? '')) === $bucketId) {
                $bucket = $item;
                break;
            }
        }

        if ($bucket === null) {
            throw new \RuntimeException('Backblaze B2 không tìm thấy Bucket ID đích.');
        }

        $resolvedBucketName = trim((string) ($bucket['bucketName'] ?? ''));
        if ($bucketName !== '' && $resolvedBucketName !== '' && $resolvedBucketName !== $bucketName) {
            throw new \RuntimeException('Bucket name không khớp với Bucket ID đã cấu hình.');
        }

        return $bucket;
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     * @return array{upload_url:string,authorization_token:string}
     */
    private function requestUploadUrl(array $runtimeConfig, array $authorization): array
    {
        $response = $this->callJsonApi($authorization, 'b2_get_upload_url', [
            'bucketId' => (string) ($runtimeConfig['bucket_id'] ?? ''),
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeHttpError(
                $response,
                'Không lấy được upload URL từ Backblaze B2.'
            ));
        }

        $uploadUrl = trim((string) ($response->json('uploadUrl') ?? ''));
        $uploadAuthorizationToken = trim((string) ($response->json('authorizationToken') ?? ''));

        if ($uploadUrl === '' || $uploadAuthorizationToken === '') {
            throw new \RuntimeException('Backblaze B2 không trả đủ thông tin upload URL.');
        }

        return [
            'upload_url' => $uploadUrl,
            'authorization_token' => $uploadAuthorizationToken,
        ];
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     * @return array<string, mixed>
     */
    private function uploadString(
        array $runtimeConfig,
        array $authorization,
        string $objectKey,
        string $contents,
        string $contentType
    ): array {
        $uploadTarget = $this->requestUploadUrl($runtimeConfig, $authorization);
        $sha1 = sha1($contents);

        try {
            $response = Http::withHeaders([
                'Authorization' => $uploadTarget['authorization_token'],
                'X-Bz-File-Name' => rawurlencode($objectKey),
                'Content-Type' => $contentType,
                'X-Bz-Content-Sha1' => $sha1,
                'Content-Length' => (string) strlen($contents),
            ])->timeout(300)->withBody($contents, $contentType)->post($uploadTarget['upload_url']);
        } catch (\Throwable $exception) {
            throw new \RuntimeException($this->normalizeErrorMessage($exception));
        }

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeHttpError(
                $response,
                'Backblaze B2 trả về lỗi khi tải file.'
            ));
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            throw new \RuntimeException('Backblaze B2 trả về dữ liệu upload không hợp lệ.');
        }

        return $payload;
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     * @return array<string, mixed>|null
     */
    private function findFileByName(array $runtimeConfig, array $authorization, string $objectKey): ?array
    {
        $response = $this->callJsonApi($authorization, 'b2_list_file_names', [
            'bucketId' => (string) ($runtimeConfig['bucket_id'] ?? ''),
            'prefix' => $objectKey,
            'maxFileCount' => 25,
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeHttpError(
                $response,
                'Không thể tra cứu file trên Backblaze B2.'
            ));
        }

        $files = $response->json('files');
        if (! is_array($files) || $files === []) {
            return null;
        }

        foreach ($files as $file) {
            if (! is_array($file)) {
                continue;
            }

            if (trim((string) ($file['fileName'] ?? '')) === $objectKey) {
                return $file;
            }
        }

        return null;
    }

    /**
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     */
    private function deleteFileVersion(array $authorization, string $fileId, string $fileName): void
    {
        if (trim($fileId) === '' || trim($fileName) === '') {
            return;
        }

        $response = $this->callJsonApi($authorization, 'b2_delete_file_version', [
            'fileId' => $fileId,
            'fileName' => $fileName,
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeHttpError(
                $response,
                'Không thể xóa file trên Backblaze B2.'
            ));
        }
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     */
    private function buildObjectKey(array $runtimeConfig, string $originalFileName, string $directory = 'documents'): string
    {
        $prefix = trim((string) ($runtimeConfig['file_prefix'] ?? ''), '/');
        $segments = [];

        if ($prefix !== '') {
            $segments[] = $prefix;
        }

        $normalizedDirectory = trim($directory, '/');
        if ($normalizedDirectory !== '') {
            $segments[] = $normalizedDirectory;
        }

        $fileNameStem = Str::slug(pathinfo($originalFileName, PATHINFO_FILENAME));
        if ($fileNameStem === '') {
            $fileNameStem = 'file';
        }

        $fileName = now()->format('Ymd_His').'_'.Str::random(8).'_'.$fileNameStem;
        $extension = trim((string) pathinfo($originalFileName, PATHINFO_EXTENSION));
        if ($extension !== '') {
            $fileName .= '.'.$extension;
        }

        $segments[] = $fileName;

        return implode('/', $segments);
    }

    private function normalizeHttpError(
        HttpResponse $response,
        string $default = 'Backblaze B2 trả về lỗi khi tải file.'
    ): string {
        $payload = $response->json();
        $code = is_array($payload) ? trim((string) ($payload['code'] ?? '')) : '';
        $message = is_array($payload) ? trim((string) ($payload['message'] ?? '')) : trim($response->body());
        $status = $response->status();

        return $this->mapErrorMessage($message, $code, $status, $default);
    }

    private function mapErrorMessage(
        string $message,
        string $code = '',
        int $status = 0,
        string $default = 'Backblaze B2 trả về lỗi khi tải file.'
    ): string {
        $messageLower = Str::lower(trim($message));
        $codeLower = Str::lower(trim($code));

        if (
            in_array($codeLower, ['bad_auth_token', 'unauthorized', 'duplicate_bucket_name'], true)
            || ($status === 401 && $messageLower !== '')
            || str_contains($messageLower, 'signature validation failed')
            || str_contains($messageLower, 'invalid access key')
        ) {
            return 'Key ID và Application Key của Backblaze B2 không khớp nhau hoặc không đúng.';
        }

        if (
            in_array($codeLower, ['bad_bucket_id', 'no_such_bucket', 'bucket_not_found'], true)
            || (str_contains($messageLower, 'bucket')
                && (str_contains($messageLower, 'not found') || str_contains($messageLower, 'not exist')))
        ) {
            return 'Backblaze B2 không tìm thấy Bucket ID đích.';
        }

        if (
            str_contains($messageLower, 'capab')
            || str_contains($messageLower, 'writefiles')
            || str_contains($messageLower, 'readfiles')
            || str_contains($messageLower, 'listfiles')
            || str_contains($messageLower, 'deletefiles')
            || $status === 403
        ) {
            return 'Application Key của Backblaze B2 chưa có đủ quyền read/list/write/delete trên bucket.';
        }

        if (
            str_contains($messageLower, 'timed out')
            || str_contains($messageLower, 'could not resolve host')
            || str_contains($messageLower, 'connection refused')
            || str_contains($messageLower, 'curl error')
        ) {
            return 'Không thể kết nối tới Backblaze B2 API.';
        }

        if ($message !== '') {
            return 'Backblaze B2 trả về lỗi: '.$message;
        }

        return $default;
    }

    private function encodeObjectKeyForUrl(string $objectKey): string
    {
        $segments = array_map(
            static fn (string $segment): string => rawurlencode($segment),
            explode('/', $objectKey)
        );

        return implode('/', $segments);
    }

    private function buildInlineContentDispositionHeader(string $fileName): string
    {
        $normalizedName = trim($fileName) !== '' ? trim($fileName) : 'attachment';
        $asciiName = str_replace(['\\', '"'], ['_', ''], $normalizedName);
        $encodedName = rawurlencode($normalizedName);

        return sprintf('inline; filename="%s"; filename*=UTF-8\'\'%s', $asciiName, $encodedName);
    }

    private function normalizeErrorMessage(\Throwable $exception, string $default = 'Backblaze B2 trả về lỗi khi tải file.'): string
    {
        $message = trim($exception->getMessage());
        if (
            str_starts_with($message, 'Key ID và Application Key của Backblaze B2')
            || str_starts_with($message, 'Backblaze B2 không tìm thấy')
            || str_starts_with($message, 'Application Key của Backblaze B2')
            || str_starts_with($message, 'Không thể kết nối tới Backblaze B2 API.')
            || str_starts_with($message, 'Bucket name không khớp')
        ) {
            return $message;
        }

        return $this->mapErrorMessage($message, '', 0, $default);
    }
}
