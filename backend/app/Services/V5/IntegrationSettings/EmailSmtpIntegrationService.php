<?php

namespace App\Services\V5\IntegrationSettings;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

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
                'smtp_recipient_emails' => $settingsRow['smtp_recipient_emails'] ?? null,
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
            'smtp_recipient_emails' => ['nullable', 'string', 'max:1000'],
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
                'smtp_recipient_emails' => ['nullable', 'string', 'max:1000'],
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
            'smtp_recipient_emails' => $this->normalizeRecipientEmailsAsString($validated['smtp_recipient_emails'] ?? null),
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

        $payload = $this->support->filterPayloadByTableColumns('integration_settings', $payload);

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
            'test_recipient_email' => ['nullable', 'string', 'max:1000'],
        ]);

        $runtimeSettings = $this->resolveTestRuntimeSettings($validated);
        if (! ($runtimeSettings['success'] ?? false)) {
            $message = (string) ($runtimeSettings['message'] ?? 'Không thể chuẩn bị cấu hình Email SMTP để kiểm tra.');
            $this->saveTestResult('FAILED', $message);

            return response()->json([
                'message' => $message,
            ], 422);
        }

        $result = $this->testSmtpConnection($runtimeSettings['settings']);

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
            'data' => [
                'message' => $result['message'],
                'status' => 'SUCCESS',
                'tested_at' => now()->toIso8601String(),
                'persisted' => true,
            ],
        ]);
    }

    public function sendReminderEmail(array $reminder, string $recipientEmail): array
    {
        $title = trim((string) ($reminder['reminder_title'] ?? 'Nhắc việc'));
        $content = trim((string) ($reminder['content'] ?? ''));
        $remindDate = trim((string) ($reminder['remind_date'] ?? ''));

        $subject = '[Nhắc việc] '.$title;
        $messageLines = [
            'Bạn có một nhắc việc mới từ hệ thống VNPT Business.',
            '',
            'Tiêu đề: '.$title,
        ];

        if ($content !== '') {
            $messageLines[] = 'Nội dung: '.$content;
        }

        if ($remindDate !== '') {
            $messageLines[] = 'Ngày nhắc: '.$remindDate;
        }

        $messageLines[] = '';
        $messageLines[] = 'Vui lòng đăng nhập hệ thống để theo dõi chi tiết.';

        return $this->sendPlainTextEmail($recipientEmail, $subject, $messageLines);
    }

    public function sendPlainTextEmail(array|string $recipientEmails, string $subject, array $messageLines): array
    {
        $recipients = $this->normalizeRecipientEmails($recipientEmails);

        if ($recipients === []) {
            return [
                'success' => false,
                'message' => 'Chưa có email người nhận hợp lệ.',
            ];
        }

        $subject = trim($subject);
        if ($subject === '') {
            return [
                'success' => false,
                'message' => 'Tiêu đề email không hợp lệ.',
            ];
        }

        $messageBody = collect($messageLines)
            ->map(fn (mixed $line): string => (string) $line)
            ->implode("\n");

        return $this->dispatchConfiguredEmail($recipients, $subject, $messageBody);
    }

    public function sendHtmlEmail(
        array|string $recipientEmails,
        string $subject,
        array $messageLines,
        string $htmlBody,
        array $attachments = []
    ): array {
        $recipients = $this->normalizeRecipientEmails($recipientEmails);

        if ($recipients === []) {
            return [
                'success' => false,
                'message' => 'Chưa có email người nhận hợp lệ.',
            ];
        }

        $subject = trim($subject);
        if ($subject === '') {
            return [
                'success' => false,
                'message' => 'Tiêu đề email không hợp lệ.',
            ];
        }

        $messageBody = collect($messageLines)
            ->map(fn (mixed $line): string => (string) $line)
            ->implode("\n");

        if (trim($htmlBody) === '') {
            return [
                'success' => false,
                'message' => 'Nội dung email HTML đang trống.',
            ];
        }

        return $this->dispatchConfiguredEmail($recipients, $subject, $messageBody, $htmlBody, $attachments);
    }

    private function dispatchConfiguredEmail(
        array $recipients,
        string $subject,
        string $messageBody,
        ?string $htmlBody = null,
        array $attachments = []
    ): array {
        if (trim($messageBody) === '') {
            return [
                'success' => false,
                'message' => 'Nội dung email đang trống.',
            ];
        }

        $settingsRow = $this->loadSettingsRow();
        if ($settingsRow === null) {
            return [
                'success' => false,
                'message' => 'Chưa có cấu hình Email SMTP.',
            ];
        }

        if (! (bool) ($settingsRow['is_enabled'] ?? false)) {
            return [
                'success' => false,
                'message' => 'Email SMTP đang tắt. Vui lòng bật cấu hình trước khi gửi.',
            ];
        }

        $host = trim((string) ($settingsRow['smtp_host'] ?? ''));
        $port = (int) ($settingsRow['smtp_port'] ?? 0);
        $username = trim((string) ($settingsRow['smtp_username'] ?? ''));
        $encryptedPassword = $settingsRow['smtp_password'] ?? null;
        $encryption = (string) ($settingsRow['smtp_encryption'] ?? 'tls');
        $fromAddress = trim((string) ($settingsRow['smtp_from_address'] ?? $username));
        $fromName = trim((string) ($settingsRow['smtp_from_name'] ?? 'VNPT Business'));

        if ($host === '' || $port <= 0 || $username === '' || empty($encryptedPassword) || $fromAddress === '') {
            return [
                'success' => false,
                'message' => 'Cấu hình SMTP chưa đầy đủ. Vui lòng kiểm tra host/port/tài khoản/mật khẩu/email gửi.',
            ];
        }

        try {
            $password = Crypt::decryptString((string) $encryptedPassword);
        } catch (\Throwable) {
            return [
                'success' => false,
                'message' => 'Không thể giải mã mật khẩu SMTP. Vui lòng lưu lại mật khẩu mới.',
            ];
        }

        $originalMailer = config('mail.default');
        $originalSmtp = config('mail.mailers.smtp');
        $originalFrom = config('mail.from');

        try {
            Config::set('mail.default', 'smtp');
            Config::set('mail.mailers.smtp', [
                'transport' => 'smtp',
                'host' => $host,
                'port' => $port,
                'username' => $username,
                'password' => $password,
                'encryption' => $encryption === 'none' ? null : $encryption,
                'local_domain' => parse_url((string) config('app.url', 'http://localhost'), PHP_URL_HOST),
            ]);
            Config::set('mail.from', [
                'address' => $fromAddress,
                'name' => $fromName !== '' ? $fromName : 'VNPT Business',
            ]);

            if ($htmlBody !== null) {
                Mail::html($htmlBody, function ($mail) use ($recipients, $subject, $fromAddress, $fromName, $attachments): void {
                    $mail->to($recipients)
                        ->subject($subject)
                        ->from($fromAddress, $fromName !== '' ? $fromName : 'VNPT Business');

                    foreach ($attachments as $attachment) {
                        $data = $attachment['data'] ?? null;
                        $name = trim((string) ($attachment['name'] ?? 'attachment.bin'));
                        $options = is_array($attachment['options'] ?? null) ? $attachment['options'] : [];
                        if (! is_string($data) || $data === '' || $name === '') {
                            continue;
                        }

                        $mail->attachData($data, $name, $options);
                    }
                });
            } else {
                Mail::raw($messageBody, function ($mail) use ($recipients, $subject, $fromAddress, $fromName): void {
                    $mail->to($recipients)
                        ->subject($subject)
                        ->from($fromAddress, $fromName !== '' ? $fromName : 'VNPT Business');
                });
            }
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => $this->formatSmtpExceptionMessage($e, 'Gửi email thất bại: '),
            ];
        } finally {
            Config::set('mail.default', $originalMailer);
            Config::set('mail.mailers.smtp', $originalSmtp);
            Config::set('mail.from', $originalFrom);
        }

        return [
            'success' => true,
            'message' => 'Đã gửi email nhắc việc thành công.',
            'sent_at' => now()->toIso8601String(),
        ];
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
            $successMessage = 'Kết nối SMTP thành công.';

            // Test TCP connection
            $socket = @fsockopen($host, $port, $errno, $errstr, $timeout);

            if (! $socket) {
                return [
                    'success' => false,
                    'message' => "Không thể kết nối SMTP: $errstr ($errno)",
                ];
            }

            fclose($socket);

            if (! empty($settings['smtp_username']) && empty($settings['smtp_password'])) {
                return [
                    'success' => false,
                    'message' => 'Chưa có App Password để kiểm tra. Vui lòng nhập App Password và bấm Lưu.',
                ];
            }

            // If credentials provided, test authentication via Laravel Mail
            if (! empty($settings['smtp_username']) && ! empty($settings['smtp_password'])) {
                // Temporary override mail config for testing
                $originalMailer = config('mail.default');
                $originalSmtp = config('mail.mailers.smtp');
                $originalFrom = config('mail.from');
                $fromAddress = trim((string) ($settings['smtp_from_address'] ?? $settings['smtp_username']));
                $fromName = trim((string) ($settings['smtp_from_name'] ?? 'VNPT Business'));
                $testRecipients = $this->normalizeRecipientEmails(
                    $settings['test_recipient_email']
                        ?? $settings['smtp_recipient_emails']
                        ?? null
                );

                if ($testRecipients === []) {
                    $testRecipients = $this->normalizeRecipientEmails($settings['smtp_username'] ?? null);
                }

                if ($testRecipients === []) {
                    return [
                        'success' => false,
                        'message' => 'Mail nhận không hợp lệ. Nhập nhiều mail cách nhau bằng dấu phẩy.',
                    ];
                }

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

                Mail::raw(
                    'Đây là email test từ VNPT Business.',
                    fn ($m) => $m
                        ->to($testRecipients)
                        ->subject('Test Email Configuration - ' . now()->format('Y-m-d H:i:s'))
                        ->from($fromAddress, $fromName !== '' ? $fromName : 'VNPT Business')
                );

                // Restore original config
                Config::set('mail.default', $originalMailer);
                Config::set('mail.mailers.smtp', $originalSmtp);
                Config::set('mail.from', $originalFrom);

                $successMessage = sprintf(
                    'Kết nối SMTP thành công. Đã gửi email test tới %d mail nhận.',
                    count($testRecipients)
                );
            }

            return [
                'success' => true,
                'message' => $successMessage,
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => $this->formatSmtpExceptionMessage($e, 'Lỗi kết nối SMTP: '),
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

    private function normalizeRecipientEmails(array|string|null $recipientEmails): array
    {
        $rawRecipients = is_array($recipientEmails)
            ? $recipientEmails
            : preg_split('/[\r\n,;]+/', (string) $recipientEmails);

        return collect($rawRecipients ?: [])
            ->map(fn (mixed $email): string => strtolower(trim((string) $email)))
            ->filter(fn (string $email): bool => $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false)
            ->unique()
            ->values()
            ->all();
    }

    private function normalizeRecipientEmailsAsString(array|string|null $recipientEmails): ?string
    {
        $recipients = $this->normalizeRecipientEmails($recipientEmails);

        return $recipients === [] ? null : implode(', ', $recipients);
    }

    private function formatSmtpExceptionMessage(\Throwable $exception, string $fallbackPrefix): string
    {
        $rawMessage = trim((string) $exception->getMessage());
        $normalized = preg_replace('/\s+/', ' ', $rawMessage);
        $normalized = is_string($normalized) ? trim($normalized) : $rawMessage;
        $lower = strtolower($normalized);

        if (
            str_contains($lower, 'application-specific password required')
            || str_contains($lower, 'password not accepted')
            || str_contains($lower, 'invalidsecondfactor')
            || str_contains($lower, '5.7.8')
            || str_contains($lower, '5.7.9')
        ) {
            return 'Xác thực Gmail thất bại: App Password không đúng hoặc chưa được bật. Vui lòng tạo App Password mới, bấm Lưu cấu hình, rồi Kiểm tra lại.';
        }

        if (str_contains($lower, 'failed to authenticate')) {
            return 'Xác thực SMTP thất bại. Vui lòng kiểm tra lại SMTP Username và App Password.';
        }

        return $this->truncateTestMessage($fallbackPrefix.$normalized);
    }

    private function truncateTestMessage(string $message, int $maxLength = 500): string
    {
        $normalized = preg_replace('/\s+/', ' ', trim($message));
        $normalized = is_string($normalized) ? trim($normalized) : trim($message);

        if ($normalized === '') {
            return '';
        }

        if (function_exists('mb_strlen') && function_exists('mb_substr')) {
            if (mb_strlen($normalized, 'UTF-8') <= $maxLength) {
                return $normalized;
            }

            return rtrim(mb_substr($normalized, 0, max(1, $maxLength - 1), 'UTF-8')).'…';
        }

        if (strlen($normalized) <= $maxLength) {
            return $normalized;
        }

        return rtrim(substr($normalized, 0, max(1, $maxLength - 3))).'...';
    }

    /**
     * @param array<string, mixed> $validated
     * @return array{success:bool,settings?:array<string,mixed>,message?:string}
     */
    private function resolveTestRuntimeSettings(array $validated): array
    {
        $storedSettings = $this->loadSettingsRow() ?? [];
        $password = $this->support->normalizeNullableString($validated['smtp_password'] ?? null);

        if ($password === null && ! empty($storedSettings['smtp_password'])) {
            try {
                $password = Crypt::decryptString((string) $storedSettings['smtp_password']);
            } catch (\Throwable) {
                return [
                    'success' => false,
                    'message' => 'Không thể giải mã App Password đã lưu. Vui lòng nhập lại App Password và bấm Lưu.',
                ];
            }
        }

        return [
            'success' => true,
            'settings' => [
                'is_enabled' => array_key_exists('is_enabled', $validated)
                    ? (bool) $validated['is_enabled']
                    : (bool) ($storedSettings['is_enabled'] ?? false),
                'smtp_host' => $this->support->normalizeNullableString($validated['smtp_host'] ?? null)
                    ?? ($storedSettings['smtp_host'] ?? self::DEFAULT_SMTP_HOST),
                'smtp_port' => $validated['smtp_port']
                    ?? ($storedSettings['smtp_port'] ?? 587),
                'smtp_encryption' => $validated['smtp_encryption']
                    ?? ($storedSettings['smtp_encryption'] ?? 'tls'),
                'smtp_username' => $this->support->normalizeNullableString($validated['smtp_username'] ?? null)
                    ?? ($storedSettings['smtp_username'] ?? null),
                'smtp_password' => $password,
                'smtp_from_address' => $this->support->normalizeNullableString($validated['smtp_from_address'] ?? null)
                    ?? ($storedSettings['smtp_from_address'] ?? null),
                'smtp_from_name' => $this->support->normalizeNullableString($validated['smtp_from_name'] ?? null)
                    ?? ($storedSettings['smtp_from_name'] ?? 'VNPT Business'),
                'smtp_recipient_emails' => $this->normalizeRecipientEmailsAsString(
                    $validated['test_recipient_email']
                        ?? $storedSettings['smtp_recipient_emails']
                        ?? $storedSettings['smtp_username']
                        ?? null
                ),
                'test_recipient_email' => $validated['test_recipient_email']
                    ?? $storedSettings['smtp_recipient_emails']
                    ?? $storedSettings['smtp_username']
                    ?? null,
            ],
        ];
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
                'last_test_message' => $this->truncateTestMessage($message),
                'updated_at' => now(),
            ]
        );
    }
}
