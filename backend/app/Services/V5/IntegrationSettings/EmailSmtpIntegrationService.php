<?php

namespace App\Services\V5\IntegrationSettings;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Config;

class EmailSmtpIntegrationService
{
    private const PROVIDER = 'EMAIL_SMTP';
    private const DEFAULT_SMTP_HOST = 'smtp.gmail.com';
    private const DEFAULT_SMTP_PORTS = [
        'tls' => 587,
        'ssl' => 465,
        'none' => 25,
    ];

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    /**
     * Get email SMTP settings
     */
    public function settings(): JsonResponse
    {
        $settingsRow = $this->loadSettingsRow();

        $encryption = $settingsRow['smtp_encryption'] ?? 'tls';
        $defaultPort = self::DEFAULT_SMTP_PORTS[$encryption] ?? 587;

        return response()->json([
            'data' => [
                'provider' => self::PROVIDER,
                'is_enabled' => (bool) ($settingsRow['is_enabled'] ?? false),
                'smtp_host' => $settingsRow['smtp_host'] ?? self::DEFAULT_SMTP_HOST,
                'smtp_port' => $settingsRow['smtp_port'] ?? $defaultPort,
                'smtp_encryption' => $encryption,
                'smtp_username' => $settingsRow['smtp_username'] ?? null,
                'has_smtp_password' => ! empty($settingsRow['smtp_password']),
                'smtp_from_address' => $settingsRow['smtp_from_address'] ?? null,
                'smtp_from_name' => $settingsRow['smtp_from_name'] ?? 'VNPT Business',
                'source' => $settingsRow !== null ? 'DB' : 'DEFAULT',
                'last_tested_at' => $settingsRow['last_tested_at'] ?? null,
                'last_test_status' => $settingsRow['last_test_status'] ?? null,
                'last_test_message' => $settingsRow['last_test_message'] ?? null,
                'updated_at' => $settingsRow['updated_at'] ?? null,
            ],
        ]);
    }

    /**
     * Update email SMTP settings
     */
    public function updateSettings(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('integration_settings')) {
            return response()->json([
                'message' => 'Bảng integration_settings chưa tồn tại. Vui lòng chạy migration trước.',
            ], 422);
        }

        $validated = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'smtp_host' => ['nullable', 'string', 'max:255'],
            'smtp_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'smtp_encryption' => ['nullable', 'string', 'in:tls,ssl,none'],
            'smtp_username' => ['nullable', 'email', 'max:255'],
            'smtp_password' => ['nullable', 'string', 'max:500'],
            'clear_smtp_password' => ['nullable', 'boolean'],
            'smtp_from_address' => ['nullable', 'email', 'max:255'],
            'smtp_from_name' => ['nullable', 'string', 'max:255'],
        ]);

        // If enabled, require required fields
        if ($validated['is_enabled']) {
            $request->merge([
                'smtp_host' => $validated['smtp_host'] ?? self::DEFAULT_SMTP_HOST,
            ]);

            $validated = $request->validate([
                'is_enabled' => ['required', 'boolean'],
                'smtp_host' => ['required_with:is_enabled', 'string', 'max:255'],
                'smtp_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
                'smtp_encryption' => ['nullable', 'string', 'in:tls,ssl,none'],
                'smtp_username' => ['required_with:is_enabled', 'nullable', 'email', 'max:255'],
                'smtp_password' => ['nullable', 'string', 'max:500'],
                'clear_smtp_password' => ['nullable', 'boolean'],
                'smtp_from_address' => ['nullable', 'email', 'max:255'],
                'smtp_from_name' => ['nullable', 'string', 'max:255'],
            ]);
        }

        $actorId = $this->support->parseNullableInt($request->user()?->id ?? null);
        $now = now();
        $existing = $this->loadSettingsRow();

        $payload = [
            'is_enabled' => (bool) ($validated['is_enabled'] ?? false),
            'smtp_host' => $this->support->normalizeNullableString($validated['smtp_host'] ?? null),
            'smtp_port' => $validated['smtp_port'] ?? null,
            'smtp_encryption' => $validated['smtp_encryption'] ?? 'tls',
            'smtp_username' => $this->support->normalizeNullableString($validated['smtp_username'] ?? null),
            'smtp_from_address' => $this->support->normalizeNullableString($validated['smtp_from_address'] ?? null),
            'smtp_from_name' => $this->support->normalizeNullableString($validated['smtp_from_name'] ?? 'VNPT Business'),
            'updated_at' => $now,
            'updated_by' => $actorId,
        ];

        // Handle password
        $shouldClearPassword = (bool) ($validated['clear_smtp_password'] ?? false);
        $passwordRaw = $this->support->normalizeNullableString($validated['smtp_password'] ?? null);

        if ($shouldClearPassword) {
            $payload['smtp_password'] = null;
        } elseif ($passwordRaw !== null) {
            $payload['smtp_password'] = Crypt::encryptString($passwordRaw);
        }

        // Clear test results if config changed
        $configurationChanged = $existing === null
            || (bool) ($existing['is_enabled'] ?? false) !== $payload['is_enabled']
            || $existing['smtp_host'] !== $payload['smtp_host']
            || $existing['smtp_port'] !== $payload['smtp_port']
            || $existing['smtp_encryption'] !== $payload['smtp_encryption']
            || $existing['smtp_username'] !== $payload['smtp_username']
            || $shouldClearPassword
            || $passwordRaw !== null;

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
            $payload
        );

        return $this->settings();
    }

    /**
     * Test email SMTP connection
     */
    public function testSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'is_enabled' => ['nullable', 'boolean'],
            'smtp_host' => ['nullable', 'string', 'max:255'],
            'smtp_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'smtp_encryption' => ['nullable', 'string', 'in:tls,ssl,none'],
            'smtp_username' => ['nullable', 'email', 'max:255'],
            'smtp_password' => ['nullable', 'string', 'max:500'],
            'smtp_from_address' => ['nullable', 'email', 'max:255'],
            'smtp_from_name' => ['nullable', 'string', 'max:255'],
            'test_recipient_email' => ['nullable', 'email', 'max:255'],
        ]);

        $result = $this->testSmtpConnection($validated);

        if (! $result['success']) {
            $this->saveTestResult('FAILED', $result['message']);

            return response()->json([
                'message' => $result['message'],
                'status' => 'FAILED',
                'tested_at' => now()->toIso8601String(),
            ], 422);
        }

        $this->saveTestResult('SUCCESS', $result['message']);

        return response()->json([
            'message' => $result['message'],
            'status' => 'SUCCESS',
            'tested_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Test SMTP connection with TCP and authentication
     */
    private function testSmtpConnection(array $settings): array
    {
        try {
            $host = $settings['smtp_host'] ?? self::DEFAULT_SMTP_HOST;
            $port = (int) ($settings['smtp_port'] ?? 587);
            $timeout = 10;

            // Test TCP connection
            $socket = @fsockopen($host, $port, $errno, $errstr, $timeout);

            if (! $socket) {
                return [
                    'success' => false,
                    'message' => "Không thể kết nối SMTP: $errstr ($errno)",
                ];
            }

            fclose($socket);

            // If credentials provided, test authentication via Laravel Mail
            if (! empty($settings['smtp_username']) && ! empty($settings['smtp_password'])) {
                // Temporary override mail config for testing
                $originalMailer = config('mail.default');
                $originalSmtp = config('mail.mailers.smtp');
                $originalFrom = config('mail.from');

                $encryption = $settings['smtp_encryption'] ?? 'tls';
                Config::set('mail.default', 'smtp');
                Config::set('mail.mailers.smtp', [
                    'transport' => 'smtp',
                    'host' => $host,
                    'port' => $port,
                    'username' => $settings['smtp_username'],
                    'password' => $settings['smtp_password'],
                    'encryption' => $encryption === 'none' ? null : $encryption,
                    'local_domain' => parse_url((string) config('app.url', 'http://localhost'), PHP_URL_HOST),
                ]);

                $testRecipient = $settings['test_recipient_email'] ?? $settings['smtp_username'];

                \Illuminate\Support\Facades\Mail::raw(
                    'Đây là email test từ VNPT Business.',
                    fn ($m) => $m
                        ->to($testRecipient)
                        ->subject('Test Email Configuration - ' . now()->format('Y-m-d H:i:s'))
                        ->from($settings['smtp_username'], $settings['smtp_from_name'] ?? 'Test')
                );

                // Restore original config
                Config::set('mail.default', $originalMailer);
                Config::set('mail.mailers.smtp', $originalSmtp);
                Config::set('mail.from', $originalFrom);
            }

            return [
                'success' => true,
                'message' => 'Kết nối SMTP thành công.',
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Lỗi kết nối SMTP: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Load settings row from database
     */
    private function loadSettingsRow(): ?array
    {
        if (! $this->support->hasTable('integration_settings')) {
            return null;
        }

        $row = DB::table('integration_settings')
            ->where('provider', self::PROVIDER)
            ->first();

        return $row ? (array) $row : null;
    }

    /**
     * Save test result to database
     */
    private function saveTestResult(string $status, string $message): void
    {
        if (! $this->support->hasTable('integration_settings')) {
            return;
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::PROVIDER],
            [
                'last_tested_at' => now(),
                'last_test_status' => $status,
                'last_test_message' => $message,
                'updated_at' => now(),
            ]
        );
    }
}
