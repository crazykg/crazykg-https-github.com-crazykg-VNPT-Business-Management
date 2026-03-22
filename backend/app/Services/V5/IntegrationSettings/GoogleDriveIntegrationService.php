<?php

namespace App\Services\V5\IntegrationSettings;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\Client\Response as HttpResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class GoogleDriveIntegrationService
{
    private const PROVIDER = 'GOOGLE_DRIVE';
    private const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/drive.file';

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
                'account_email' => $runtimeConfig['account_email'] ?? null,
                'folder_id' => $runtimeConfig['folder_id'] ?? null,
                'scopes' => $runtimeConfig['scopes'] ?? self::DEFAULT_SCOPE,
                'impersonate_user' => $runtimeConfig['impersonate_user'] ?? null,
                'file_prefix' => $runtimeConfig['file_prefix'] ?? null,
                'has_service_account_json' => (bool) ($runtimeConfig['has_credentials'] ?? false),
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
            'account_email' => ['nullable', 'string', 'max:255'],
            'folder_id' => ['nullable', 'string', 'max:255'],
            'scopes' => ['nullable', 'string', 'max:500'],
            'impersonate_user' => ['nullable', 'string', 'max:255'],
            'file_prefix' => ['nullable', 'string', 'max:100'],
            'service_account_json' => ['nullable', 'string', 'max:120000'],
            'clear_service_account_json' => ['nullable', 'boolean'],
        ]);

        $actorId = $this->support->parseNullableInt($request->user()?->id ?? null);
        $now = now();
        $existing = $this->loadSettingsRow();

        $payload = [
            'is_enabled' => (bool) ($validated['is_enabled'] ?? false),
            'account_email' => $this->support->normalizeNullableString($validated['account_email'] ?? null),
            'folder_id' => $this->support->normalizeNullableString($validated['folder_id'] ?? null),
            'scopes' => $this->support->normalizeNullableString($validated['scopes'] ?? null),
            'impersonate_user' => $this->support->normalizeNullableString($validated['impersonate_user'] ?? null),
            'file_prefix' => $this->support->normalizeNullableString($validated['file_prefix'] ?? null),
            'updated_at' => $now,
            'updated_by' => $actorId,
        ];

        $shouldClearCredentials = (bool) ($validated['clear_service_account_json'] ?? false);
        $serviceAccountJsonRaw = $this->support->normalizeNullableString($validated['service_account_json'] ?? null);

        if ($shouldClearCredentials) {
            $payload['service_account_json'] = null;
        } elseif ($serviceAccountJsonRaw !== null) {
            $decoded = json_decode($serviceAccountJsonRaw, true);
            if (! is_array($decoded)) {
                return response()->json([
                    'message' => 'Service Account JSON không đúng định dạng JSON object.',
                ], 422);
            }

            if (
                empty($decoded['client_email']) ||
                empty($decoded['private_key']) ||
                empty($decoded['token_uri'])
            ) {
                return response()->json([
                    'message' => 'Service Account JSON thiếu trường bắt buộc (client_email/private_key/token_uri).',
                ], 422);
            }

            $normalizedJson = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (! is_string($normalizedJson) || trim($normalizedJson) === '') {
                return response()->json([
                    'message' => 'Service Account JSON không hợp lệ.',
                ], 422);
            }

            $payload['service_account_json'] = Crypt::encryptString($normalizedJson);

            $decodedClientEmail = $this->support->normalizeNullableString($decoded['client_email'] ?? null);
            if ($decodedClientEmail !== null) {
                $payload['account_email'] = $decodedClientEmail;
            }
        }

        $configurationChanged = $existing === null
            || (bool) ($existing['is_enabled'] ?? false) !== (bool) $payload['is_enabled']
            || $this->support->normalizeNullableString($existing['account_email'] ?? null) !== $this->support->normalizeNullableString($payload['account_email'] ?? null)
            || $this->support->normalizeNullableString($existing['folder_id'] ?? null) !== $this->support->normalizeNullableString($payload['folder_id'] ?? null)
            || $this->support->normalizeNullableString($existing['scopes'] ?? null) !== $this->support->normalizeNullableString($payload['scopes'] ?? null)
            || $this->support->normalizeNullableString($existing['impersonate_user'] ?? null) !== $this->support->normalizeNullableString($payload['impersonate_user'] ?? null)
            || $this->support->normalizeNullableString($existing['file_prefix'] ?? null) !== $this->support->normalizeNullableString($payload['file_prefix'] ?? null)
            || $shouldClearCredentials
            || array_key_exists('service_account_json', $payload);

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
            'account_email',
            'folder_id',
            'scopes',
            'impersonate_user',
            'file_prefix',
            'service_account_json',
            'clear_service_account_json',
        ]);

        if ($hasOverrides) {
            $validated = $request->validate([
                'is_enabled' => ['nullable', 'boolean'],
                'account_email' => ['nullable', 'string', 'max:255'],
                'folder_id' => ['nullable', 'string', 'max:255'],
                'scopes' => ['nullable', 'string', 'max:500'],
                'impersonate_user' => ['nullable', 'string', 'max:255'],
                'file_prefix' => ['nullable', 'string', 'max:100'],
                'service_account_json' => ['nullable', 'string', 'max:120000'],
                'clear_service_account_json' => ['nullable', 'boolean'],
            ]);

            $overrideResult = $this->applyRuntimeConfigOverrides($runtimeConfig, $validated);
            if (! ($overrideResult['success'] ?? false)) {
                return response()->json([
                    'message' => trim((string) ($overrideResult['errorMessage'] ?? 'Cấu hình Google Drive không hợp lệ.')),
                ], 422);
            }

            $runtimeConfig = $overrideResult['config'];
        }

        $shouldPersistTestResult = ! $hasOverrides;

        if (! (bool) ($runtimeConfig['is_enabled'] ?? false)) {
            if ($shouldPersistTestResult) {
                $this->saveTestResult('FAILED', 'Google Drive đang ở trạng thái tắt.');
            }

            return response()->json([
                'message' => 'Google Drive đang ở trạng thái tắt.',
            ], 422);
        }

        $credentials = $runtimeConfig['credentials'] ?? null;
        if (! is_array($credentials)) {
            if ($shouldPersistTestResult) {
                $this->saveTestResult('FAILED', 'Thiếu Service Account JSON.');
            }

            return response()->json([
                'message' => 'Thiếu Service Account JSON. Vui lòng cập nhật cấu hình trước khi kiểm tra.',
            ], 422);
        }

        $accessToken = $this->requestAccessToken(
            $credentials,
            (string) ($runtimeConfig['scopes'] ?? self::DEFAULT_SCOPE),
            (string) ($runtimeConfig['impersonate_user'] ?? '')
        );

        if ($accessToken === null) {
            if ($shouldPersistTestResult) {
                $this->saveTestResult('FAILED', 'Không thể lấy access token từ Service Account.');
            }

            return response()->json([
                'message' => 'Không thể lấy access token từ Service Account. Vui lòng kiểm tra lại quyền và JSON.',
            ], 422);
        }

        $response = Http::withToken($accessToken)
            ->timeout(30)
            ->get('https://www.googleapis.com/drive/v3/about', [
                'fields' => 'user(displayName,emailAddress)',
                'supportsAllDrives' => 'true',
            ]);

        if (! $response->successful()) {
            $message = 'Google Drive trả về lỗi khi kiểm tra kết nối.';
            $payload = $response->json();
            if (is_array($payload) && isset($payload['error']['message'])) {
                $message = (string) $payload['error']['message'];
            }

            if ($shouldPersistTestResult) {
                $this->saveTestResult('FAILED', $message);
            }

            return response()->json([
                'message' => $message,
            ], 422);
        }

        $driveUser = $response->json('user.emailAddress');
        $uploadCapability = $this->verifyUploadCapability($runtimeConfig, $accessToken);
        if (! ($uploadCapability['success'] ?? false)) {
            $message = trim((string) ($uploadCapability['errorMessage'] ?? 'Google Drive chưa ghi được file test.'));
            if ($shouldPersistTestResult) {
                $this->saveTestResult('FAILED', $message);
            }

            return response()->json([
                'message' => $message,
            ], 422);
        }

        $successMessage = $driveUser
            ? "Kết nối Google Drive thành công và có thể tải file ({$driveUser})."
            : 'Kết nối Google Drive thành công và có thể tải file.';

        if ($shouldPersistTestResult) {
            $this->saveTestResult('SUCCESS', $successMessage);
        }

        return response()->json([
            'data' => [
                'message' => $successMessage,
                'user_email' => $driveUser,
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

        return is_array($config['credentials'] ?? null);
    }

    public function deleteFile(string $driveFileId): void
    {
        if (! $this->isConfigured()) {
            return;
        }

        $config = $this->resolveRuntimeConfig();
        $credentials = $config['credentials'] ?? null;
        if (! is_array($credentials)) {
            return;
        }

        $accessToken = $this->requestAccessToken(
            $credentials,
            (string) ($config['scopes'] ?? self::DEFAULT_SCOPE),
            (string) ($config['impersonate_user'] ?? '')
        );
        if ($accessToken === null) {
            return;
        }

        $this->deleteFileByAccessToken($accessToken, $driveFileId);
    }

    /**
     * @return array{
     *     is_enabled:bool,
     *     account_email:?string,
     *     folder_id:?string,
     *     scopes:string,
     *     impersonate_user:?string,
     *     file_prefix:?string,
     *     credentials:?array<string,mixed>,
     *     has_credentials:bool,
     *     source:string
     * }
     */
    private function resolveRuntimeConfig(): array
    {
        $row = $this->loadSettingsRow();
        if ($row !== null) {
            $credentials = $this->decodeServiceAccountCredentials($row['service_account_json'] ?? null);
            $scopes = $this->support->normalizeNullableString($row['scopes'] ?? null) ?? self::DEFAULT_SCOPE;
            $accountEmail = $this->support->normalizeNullableString($row['account_email'] ?? null);

            if ($credentials === null) {
                $credentials = $this->getServiceAccountCredentialsFromEnv();
            }

            if ($accountEmail === null && is_array($credentials) && ! empty($credentials['client_email'])) {
                $accountEmail = (string) $credentials['client_email'];
            }

            return [
                'is_enabled' => (bool) ($row['is_enabled'] ?? false),
                'account_email' => $accountEmail,
                'folder_id' => $this->support->normalizeNullableString($row['folder_id'] ?? null),
                'scopes' => $scopes,
                'impersonate_user' => $this->support->normalizeNullableString($row['impersonate_user'] ?? null),
                'file_prefix' => $this->support->normalizeNullableString($row['file_prefix'] ?? null),
                'credentials' => $credentials,
                'has_credentials' => is_array($credentials),
                'source' => 'DB',
            ];
        }

        $credentials = $this->getServiceAccountCredentialsFromEnv();

        return [
            'is_enabled' => filter_var(env('GOOGLE_DRIVE_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
            'account_email' => is_array($credentials) ? $this->support->normalizeNullableString($credentials['client_email'] ?? null) : null,
            'folder_id' => $this->support->normalizeNullableString(env('GOOGLE_DRIVE_FOLDER_ID')),
            'scopes' => $this->support->normalizeNullableString(env('GOOGLE_DRIVE_SCOPES')) ?? self::DEFAULT_SCOPE,
            'impersonate_user' => $this->support->normalizeNullableString(env('GOOGLE_DRIVE_IMPERSONATE_USER')),
            'file_prefix' => $this->support->normalizeNullableString(env('GOOGLE_DRIVE_FILE_PREFIX')),
            'credentials' => $credentials,
            'has_credentials' => is_array($credentials),
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
                'account_email',
                'folder_id',
                'scopes',
                'impersonate_user',
                'file_prefix',
                'service_account_json',
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

    /**
     * @return array<string,mixed>|null
     */
    private function getServiceAccountCredentialsFromEnv(): ?array
    {
        $jsonFromEnv = env('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
        if (is_string($jsonFromEnv) && trim($jsonFromEnv) !== '') {
            $decoded = json_decode($jsonFromEnv, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        $base64Json = env('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64');
        if (is_string($base64Json) && trim($base64Json) !== '') {
            $decodedBase64 = base64_decode($base64Json, true);
            if ($decodedBase64 !== false) {
                $decoded = json_decode($decodedBase64, true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }

        $jsonPath = env('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_PATH');
        if (is_string($jsonPath) && trim($jsonPath) !== '' && is_file($jsonPath)) {
            $content = file_get_contents($jsonPath);
            if (is_string($content) && trim($content) !== '') {
                $decoded = json_decode($content, true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }

        return null;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function decodeServiceAccountCredentials(mixed $value): ?array
    {
        $raw = $this->support->normalizeNullableString($value);
        if ($raw === null) {
            return null;
        }

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        try {
            $decrypted = Crypt::decryptString($raw);
        } catch (\Throwable) {
            return null;
        }

        $decoded = json_decode($decrypted, true);

        return is_array($decoded) ? $decoded : null;
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

        if (array_key_exists('account_email', $validated)) {
            $config['account_email'] = $this->support->normalizeNullableString($validated['account_email'] ?? null);
        }

        if (array_key_exists('folder_id', $validated)) {
            $config['folder_id'] = $this->support->normalizeNullableString($validated['folder_id'] ?? null);
        }

        if (array_key_exists('scopes', $validated)) {
            $config['scopes'] = $this->support->normalizeNullableString($validated['scopes'] ?? null) ?? self::DEFAULT_SCOPE;
        }

        if (array_key_exists('impersonate_user', $validated)) {
            $config['impersonate_user'] = $this->support->normalizeNullableString($validated['impersonate_user'] ?? null);
        }

        if (array_key_exists('file_prefix', $validated)) {
            $config['file_prefix'] = $this->support->normalizeNullableString($validated['file_prefix'] ?? null);
        }

        $shouldClearCredentials = (bool) ($validated['clear_service_account_json'] ?? false);
        $serviceAccountJsonRaw = $this->support->normalizeNullableString($validated['service_account_json'] ?? null);

        if ($shouldClearCredentials) {
            $config['credentials'] = null;
            $config['has_credentials'] = false;
        } elseif ($serviceAccountJsonRaw !== null) {
            $decoded = json_decode($serviceAccountJsonRaw, true);
            if (! is_array($decoded)) {
                return [
                    'success' => false,
                    'errorMessage' => 'Service Account JSON không đúng định dạng JSON object.',
                ];
            }

            if (
                empty($decoded['client_email']) ||
                empty($decoded['private_key']) ||
                empty($decoded['token_uri'])
            ) {
                return [
                    'success' => false,
                    'errorMessage' => 'Service Account JSON thiếu trường bắt buộc (client_email/private_key/token_uri).',
                ];
            }

            $config['credentials'] = $decoded;
            $config['has_credentials'] = true;
            $decodedClientEmail = $this->support->normalizeNullableString($decoded['client_email'] ?? null);
            if ($decodedClientEmail !== null) {
                $config['account_email'] = $decodedClientEmail;
            }
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
    private function verifyUploadCapability(array $runtimeConfig, string $accessToken): array
    {
        $targetValidation = $this->validateTarget($runtimeConfig, $accessToken);
        if (! ($targetValidation['success'] ?? false)) {
            return $targetValidation;
        }

        $metadata = [
            'name' => 'vnpt_connection_test_'.now()->format('Ymd_His').'.txt',
        ];

        $folderId = trim((string) ($runtimeConfig['folder_id'] ?? ''));
        if ($folderId !== '') {
            $metadata['parents'] = [$folderId];
        }

        $response = $this->performMultipartUpload(
            $accessToken,
            $metadata,
            'VNPT connection test',
            'text/plain'
        );

        if (! $response->successful()) {
            return [
                'success' => false,
                'errorMessage' => $this->resolveErrorMessage($response),
            ];
        }

        $payload = $response->json();
        $driveFileId = is_array($payload) ? trim((string) ($payload['id'] ?? '')) : '';
        if ($driveFileId === '') {
            return [
                'success' => false,
                'errorMessage' => 'Google Drive không trả về ID file test sau khi tải lên.',
            ];
        }

        $this->deleteFileByAccessToken($accessToken, $driveFileId);

        return ['success' => true];
    }

    /**
     * @param array<string,mixed> $credentials
     */
    private function requestAccessToken(
        array $credentials,
        ?string $scopes = null,
        ?string $impersonateUser = null
    ): ?string {
        $clientEmail = trim((string) ($credentials['client_email'] ?? ''));
        $privateKey = (string) ($credentials['private_key'] ?? '');
        if ($clientEmail === '' || trim($privateKey) === '') {
            return null;
        }

        $now = time();
        $tokenUri = trim((string) ($credentials['token_uri'] ?? 'https://oauth2.googleapis.com/token'));
        $resolvedScopes = trim((string) ($scopes ?? self::DEFAULT_SCOPE));
        if ($resolvedScopes === '') {
            $resolvedScopes = self::DEFAULT_SCOPE;
        }
        $subject = trim((string) ($impersonateUser ?? ''));

        $claims = [
            'iss' => $clientEmail,
            'scope' => $resolvedScopes,
            'aud' => $tokenUri,
            'exp' => $now + 3600,
            'iat' => $now,
        ];
        if ($subject !== '') {
            $claims['sub'] = $subject;
        }

        $jwt = $this->buildServiceAccountJwt($claims, $privateKey);
        if ($jwt === null) {
            return null;
        }

        $tokenResponse = Http::asForm()
            ->timeout(30)
            ->post($tokenUri, [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]);

        if (! $tokenResponse->successful()) {
            return null;
        }

        $accessToken = $tokenResponse->json('access_token');

        return is_string($accessToken) && $accessToken !== '' ? $accessToken : null;
    }

    /**
     * @param array<string,mixed> $claims
     */
    private function buildServiceAccountJwt(array $claims, string $privateKey): ?string
    {
        $header = ['alg' => 'RS256', 'typ' => 'JWT'];
        $encodedHeader = $this->base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES) ?: '');
        $encodedClaims = $this->base64UrlEncode(json_encode($claims, JSON_UNESCAPED_SLASHES) ?: '');
        if ($encodedHeader === '' || $encodedClaims === '') {
            return null;
        }

        $signatureInput = $encodedHeader.'.'.$encodedClaims;
        $signature = '';
        $signed = openssl_sign($signatureInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        if (! $signed) {
            return null;
        }

        return $signatureInput.'.'.$this->base64UrlEncode($signature);
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @return array{success:bool,errorMessage?:string}
     */
    private function validateTarget(array $runtimeConfig, string $accessToken): array
    {
        $folderId = trim((string) ($runtimeConfig['folder_id'] ?? ''));
        if ($folderId === '') {
            return ['success' => true];
        }

        $response = Http::withToken($accessToken)
            ->timeout(30)
            ->get('https://www.googleapis.com/drive/v3/files/'.rawurlencode($folderId), [
                'fields' => 'id,name,mimeType,driveId,trashed,capabilities(canAddChildren)',
                'supportsAllDrives' => 'true',
            ]);

        if (! $response->successful()) {
            $driveResponse = Http::withToken($accessToken)
                ->timeout(30)
                ->get('https://www.googleapis.com/drive/v3/drives/'.rawurlencode($folderId));

            if ($driveResponse->successful()) {
                return [
                    'success' => false,
                    'errorMessage' => 'Giá trị Google Drive Folder ID hiện là Shared Drive ID, không phải Folder ID. Hãy mở một thư mục bên trong Shared Drive và copy ID sau /folders/.',
                ];
            }

            $reason = strtolower(trim((string) ($response->json('error.errors.0.reason') ?? '')));
            $message = trim((string) ($response->json('error.message') ?? ''));

            if ($reason === 'notfound') {
                return [
                    'success' => false,
                    'errorMessage' => 'Google Drive không tìm thấy thư mục đích. Hãy kiểm tra lại Folder ID và quyền chia sẻ cho Service Account.',
                ];
            }

            if ($reason === 'forbidden') {
                return [
                    'success' => false,
                    'errorMessage' => 'Service Account chưa có quyền truy cập thư mục Google Drive đích.',
                ];
            }

            return [
                'success' => false,
                'errorMessage' => $message !== ''
                    ? 'Google Drive trả về lỗi: '.$message
                    : 'Không thể truy cập thư mục Google Drive đích.',
            ];
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            return [
                'success' => false,
                'errorMessage' => 'Không thể đọc thông tin thư mục Google Drive đích.',
            ];
        }

        $mimeType = trim((string) ($payload['mimeType'] ?? ''));
        if ($mimeType !== 'application/vnd.google-apps.folder') {
            return [
                'success' => false,
                'errorMessage' => 'Google Drive Folder ID hiện không trỏ tới một thư mục hợp lệ.',
            ];
        }

        if ((bool) ($payload['trashed'] ?? false)) {
            return [
                'success' => false,
                'errorMessage' => 'Thư mục Google Drive đích đang nằm trong thùng rác.',
            ];
        }

        $driveId = $this->support->normalizeNullableString($payload['driveId'] ?? null);
        $impersonateUser = trim((string) ($runtimeConfig['impersonate_user'] ?? ''));
        if ($driveId === null && $impersonateUser === '') {
            return [
                'success' => false,
                'errorMessage' => 'Folder ID hiện trỏ tới thư mục trong My Drive, không phải Shared Drive. Với Service Account, bạn phải dùng Shared Drive hoặc cấu hình Impersonate user.',
            ];
        }

        $canAddChildren = data_get($payload, 'capabilities.canAddChildren');
        if ($canAddChildren === false) {
            return [
                'success' => false,
                'errorMessage' => 'Service Account hiện chưa có quyền thêm file vào thư mục Google Drive đích.',
            ];
        }

        return ['success' => true];
    }

    /**
     * @param array<string, mixed> $metadata
     */
    private function performMultipartUpload(
        string $accessToken,
        array $metadata,
        string $fileContents,
        string $contentType
    ): HttpResponse {
        $boundary = 'vnpt_boundary_'.Str::random(16);
        $multipartBody = "--{$boundary}\r\n";
        $multipartBody .= "Content-Type: application/json; charset=UTF-8\r\n\r\n";
        $multipartBody .= json_encode($metadata, JSON_UNESCAPED_UNICODE)."\r\n";
        $multipartBody .= "--{$boundary}\r\n";
        $multipartBody .= "Content-Type: {$contentType}\r\n\r\n";
        $multipartBody .= $fileContents."\r\n";
        $multipartBody .= "--{$boundary}--";

        $uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink&supportsAllDrives=true';

        return Http::withToken($accessToken)
            ->withBody($multipartBody, "multipart/related; boundary={$boundary}")
            ->timeout(60)
            ->post($uploadUrl);
    }

    private function shouldRetryUploadWithoutFolder(HttpResponse $response): bool
    {
        if (! in_array($response->status(), [403, 404], true)) {
            return false;
        }

        $reason = strtolower(trim((string) ($response->json('error.errors.0.reason') ?? '')));
        if (in_array($reason, ['notfound', 'forbidden'], true)) {
            return true;
        }

        $message = strtolower(trim((string) ($response->json('error.message') ?? '')));

        return str_contains($message, 'file not found') || str_contains($message, 'insufficient');
    }

    private function resolveErrorMessage(HttpResponse $response): string
    {
        $reason = strtolower(trim((string) ($response->json('error.errors.0.reason') ?? '')));
        $message = trim((string) ($response->json('error.message') ?? ''));

        if ($reason === 'storagequotaexceeded') {
            return 'Google Drive từ chối tải file vì Service Account không có quota lưu trữ. Hãy dùng Shared Drive hoặc cấu hình Impersonate user.';
        }

        if ($reason === 'notfound') {
            return 'Google Drive không tìm thấy thư mục đích. Hãy kiểm tra lại Folder ID và quyền chia sẻ cho Service Account.';
        }

        if ($reason === 'forbidden') {
            return 'Service Account chưa có quyền ghi file vào Google Drive đích.';
        }

        if ($message !== '') {
            return 'Google Drive trả về lỗi: '.$message;
        }

        return 'Google Drive trả về lỗi khi tải file.';
    }

    private function deleteFileByAccessToken(string $accessToken, string $driveFileId): void
    {
        $endpoint = 'https://www.googleapis.com/drive/v3/files/'.rawurlencode($driveFileId).'?supportsAllDrives=true';
        Http::withToken($accessToken)->timeout(30)->delete($endpoint);
    }
}
