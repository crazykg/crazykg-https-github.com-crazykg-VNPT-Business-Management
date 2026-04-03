# Hướng dẫn sử dụng hàm gửi email từ cấu hình SMTP

**Ngày tạo:** 2026-04-02

---

## Tổng quan

Sau khi đã có cấu hình SMTP trong `integration_settings`, các chức năng khác trong hệ thống có thể gửi email bằng cách sử dụng service chung.

---

## Cách 1: Tạo EmailNotificationService (Khuyến nghị)

### Bước 1: Tạo service class

**File:** `backend/app/Services/V5/Email/EmailNotificationService.php`

```php
<?php

namespace App\Services\V5\Email;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

class EmailNotificationService
{
    private const PROVIDER = 'EMAIL_SMTP';

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    /**
     * Gửi email với nội dung HTML
     *
     * @param string|array $to Email người nhận hoặc mảng emails
     * @param string $subject Tiêu đề email
     * @param string $htmlBody Nội dung HTML
     * @param string|null $fromAddress Email gửi (override)
     * @param string|null $fromName Tên người gửi (override)
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendHtmlEmail(
        string|array $to,
        string $subject,
        string $htmlBody,
        ?string $fromAddress = null,
        ?string $fromName = null
    ): array {
        try {
            $smtpSettings = $this->loadSmtpSettings();

            if (! $smtpSettings) {
                return [
                    'success' => false,
                    'message' => 'Chưa cấu hình SMTP. Vui lòng vào Cấu hình tích hợp để thiết lập.',
                ];
            }

            if (! ($smtpSettings['is_enabled'] ?? false)) {
                return [
                    'success' => false,
                    'message' => 'SMTP đang bị tắt. Vui lòng bật trong Cấu hình tích hợp.',
                ];
            }

            $this->configureSmtpTemporarily($smtpSettings);

            $fromAddress = $fromAddress ?? $smtpSettings['smtp_from_address'] ?? $smtpSettings['smtp_username'];
            $fromName = $fromName ?? $smtpSettings['smtp_from_name'] ?? 'VNPT Business';

            Mail::html($htmlBody, function ($message) use ($to, $subject, $fromAddress, $fromName) {
                $message->to($to)
                        ->subject($subject)
                        ->from($fromAddress, $fromName);
            });

            $this->restoreMailConfig();

            return [
                'success' => true,
                'message' => 'Gửi email thành công.',
            ];

        } catch (\Exception $e) {
            Log::error('Email send failed: ' . $e->getMessage(), [
                'to' => $to,
                'subject' => $subject,
            ]);

            return [
                'success' => false,
                'message' => 'Lỗi gửi email: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Gửi email với Blade template
     *
     * @param string|array $to Email người nhận
     * @param string $subject Tiêu đề
     * @param string $templateView Tên Blade view (không có .blade.php)
     * @param array $templateData Dữ liệu truyền vào template
     * @param string|null $fromAddress Email gửi
     * @param string|null $fromName Tên người gửi
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendTemplateEmail(
        string|array $to,
        string $subject,
        string $templateView,
        array $templateData = [],
        ?string $fromAddress = null,
        ?string $fromName = null
    ): array {
        try {
            $smtpSettings = $this->loadSmtpSettings();

            if (! $smtpSettings) {
                return [
                    'success' => false,
                    'message' => 'Chưa cấu hình SMTP.',
                ];
            }

            if (! ($smtpSettings['is_enabled'] ?? false)) {
                return [
                    'success' => false,
                    'message' => 'SMTP đang bị tắt.',
                ];
            }

            $this->configureSmtpTemporarily($smtpSettings);

            $fromAddress = $fromAddress ?? $smtpSettings['smtp_from_address'] ?? $smtpSettings['smtp_username'];
            $fromName = $fromName ?? $smtpSettings['smtp_from_name'] ?? 'VNPT Business';

            Mail::send($templateView, $templateData, function ($message) use ($to, $subject, $fromAddress, $fromName) {
                $message->to($to)
                        ->subject($subject)
                        ->from($fromAddress, $fromName);
            });

            $this->restoreMailConfig();

            return [
                'success' => true,
                'message' => 'Gửi email thành công.',
            ];

        } catch (\Exception $e) {
            Log::error('Email send failed: ' . $e->getMessage(), [
                'to' => $to,
                'subject' => $subject,
                'template' => $templateView,
            ]);

            return [
                'success' => false,
                'message' => 'Lỗi gửi email: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Gửi email với file đính kèm
     *
     * @param string|array $to Email người nhận
     * @param string $subject Tiêu đề
     * @param string $htmlBody Nội dung HTML
     * @param array $attachments Mảng file đính kèm [['path' => '/path/to/file', 'name' => 'filename.pdf']]
     * @param string|null $fromAddress Email gửi
     * @param string|null $fromName Tên người gửi
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendEmailWithAttachments(
        string|array $to,
        string $subject,
        string $htmlBody,
        array $attachments = [],
        ?string $fromAddress = null,
        ?string $fromName = null
    ): array {
        try {
            $smtpSettings = $this->loadSmtpSettings();

            if (! $smtpSettings) {
                return ['success' => false, 'message' => 'Chưa cấu hình SMTP.'];
            }

            if (! ($smtpSettings['is_enabled'] ?? false)) {
                return ['success' => false, 'message' => 'SMTP đang bị tắt.'];
            }

            $this->configureSmtpTemporarily($smtpSettings);

            $fromAddress = $fromAddress ?? $smtpSettings['smtp_from_address'] ?? $smtpSettings['smtp_username'];
            $fromName = $fromName ?? $smtpSettings['smtp_from_name'] ?? 'VNPT Business';

            Mail::html($htmlBody, function ($message) use ($to, $subject, $fromAddress, $fromName, $attachments) {
                $message->to($to)
                        ->subject($subject)
                        ->from($fromAddress, $fromName);

                foreach ($attachments as $attachment) {
                    if (isset($attachment['path'])) {
                        $message->attach($attachment['path'], [
                            'as' => $attachment['name'] ?? basename($attachment['path']),
                        ]);
                    }
                }
            });

            $this->restoreMailConfig();

            return [
                'success' => true,
                'message' => 'Gửi email thành công.',
            ];

        } catch (\Exception $e) {
            Log::error('Email send failed: ' . $e->getMessage(), [
                'to' => $to,
                'subject' => $subject,
            ]);

            return [
                'success' => false,
                'message' => 'Lỗi gửi email: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Load SMTP settings từ database
     *
     * @return array|null
     */
    private function loadSmtpSettings(): ?array
    {
        if (! $this->support->hasTable('integration_settings')) {
            return null;
        }

        $row = \Illuminate\Support\Facades\DB::table('integration_settings')
            ->where('provider', self::PROVIDER)
            ->first();

        if (! $row) {
            return null;
        }

        $settings = (array) $row;

        // Decrypt password
        if (! empty($settings['smtp_password'])) {
            try {
                $settings['smtp_password'] = Crypt::decryptString($settings['smtp_password']);
            } catch (\Throwable $e) {
                Log::error('Failed to decrypt SMTP password: ' . $e->getMessage());
                return null;
            }
        }

        return $settings;
    }

    /**
     * Cấu hình SMTP tạm thời
     *
     * @param array $settings
     * @return void
     */
    private function configureSmtpTemporarily(array $settings): void
    {
        // Store original config
        if (! app()->has('mail_original_config_stored')) {
            app()->instance('mail_original_config_stored', true);
            app()->instance('mail_original_default', config('mail.default'));
            app()->instance('mail_original_mailers_smtp', config('mail.mailers.smtp'));
            app()->instance('mail_original_from', config('mail.from'));
        }

        $encryption = $settings['smtp_encryption'] ?? 'tls';
        if ($encryption === 'none') {
            $encryption = null;
        }

        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp', [
            'transport' => 'smtp',
            'host' => $settings['smtp_host'] ?? 'smtp.gmail.com',
            'port' => $settings['smtp_port'] ?? 587,
            'username' => $settings['smtp_username'],
            'password' => $settings['smtp_password'],
            'encryption' => $encryption,
            'timeout' => 30,
            'local_domain' => parse_url(config('app.url', 'http://localhost'), PHP_URL_HOST),
        ]);

        Config::set('mail.from', [
            'address' => $settings['smtp_from_address'] ?? $settings['smtp_username'],
            'name' => $settings['smtp_from_name'] ?? 'VNPT Business',
        ]);
    }

    /**
     * Khôi phục cấu hình mail ban đầu
     *
     * @return void
     */
    private function restoreMailConfig(): void
    {
        if (app()->has('mail_original_default')) {
            Config::set('mail.default', app('mail_original_default'));
            Config::set('mail.mailers.smtp', app('mail_original_mailers_smtp'));
            Config::set('mail.from', app('mail_original_from'));
        }
    }
}
```

### Bước 2: Đăng ký service provider (nếu cần)

**File:** `backend/app/Providers/AppServiceProvider.php`

```php
use App\Services\V5\Email\EmailNotificationService;

public function register(): void
{
    $this->app->singleton(EmailNotificationService::class, function ($app) {
        return new EmailNotificationService(
            $app->make(V5DomainSupportService::class)
        );
    });
}
```

---

## Cách 2: Sử dụng trực tiếp trong Controller/Service

Nếu không muốn tạo service riêng, có thể sử dụng trực tiếp:

```php
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

// Load SMTP settings
$smtpRow = DB::table('integration_settings')
    ->where('provider', 'EMAIL_SMTP')
    ->first();

if ($smtpRow && $smtpRow->is_enabled) {
    // Decrypt password
    $smtpPassword = Crypt::decryptString($smtpRow->smtp_password);

    // Temporary config
    Config::set('mail.default', 'smtp');
    Config::set('mail.mailers.smtp', [
        'transport' => 'smtp',
        'host' => $smtpRow->smtp_host ?? 'smtp.gmail.com',
        'port' => $smtpRow->smtp_port ?? 587,
        'username' => $smtpRow->smtp_username,
        'password' => $smtpPassword,
        'encryption' => $smtpRow->smtp_encryption ?? 'tls',
        'timeout' => 30,
    ]);

    Config::set('mail.from', [
        'address' => $smtpRow->smtp_from_address ?? $smtpRow->smtp_username,
        'name' => $smtpRow->smtp_from_name ?? 'VNPT Business',
    ]);

    // Send email
    Mail::html('<p>Nội dung email</p>', function ($message) use ($recipient) {
        $message->to($recipient->email)
                ->subject('Tiêu đề email')
                ->from(config('mail.from.address'), config('mail.from.name'));
    });
}
```

---

## Cách 3: Tạo Mailable class cho từng loại email

### Tạo Mailable class

```bash
php artisan make:mail CustomerRequestAssignedMail
```

**File:** `backend/app/Mail/CustomerRequestAssignedMail.php`

```php
<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CustomerRequestAssignedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly array $requestData,
        public readonly string $assigneeName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Yêu cầu khách hàng mới được giao',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.customer-request-assigned',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
```

### Tạo Blade template

**File:** `backend/resources/views/emails/customer-request-assigned.blade.php`

```blade
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .header { background: #0066cc; color: white; padding: 20px; }
        .content { padding: 20px; }
        .info-box { background: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Yêu cầu khách hàng mới</h1>
    </div>

    <div class="content">
        <p>Kính chào <strong>{{ $assigneeName }}</strong>,</p>

        <p>Bạn vừa được giao một yêu cầu khách hàng mới:</p>

        <div class="info-box">
            <p><strong>Mã yêu cầu:</strong> {{ $requestData['request_code'] }}</p>
            <p><strong>Tiêu đề:</strong> {{ $requestData['summary'] }}</p>
            <p><strong>Khách hàng:</strong> {{ $requestData['customer_name'] }}</p>
            <p><strong>Người yêu cầu:</strong> {{ $requestData['requester_name'] }}</p>
            <p><strong>Ngày giao:</strong> {{ $requestData['assigned_at'] }}</p>
        </div>

        <p>Vui lòng xem chi tiết và xử lý yêu cầu.</p>

        <p>Trân trọng,<br>
        <strong>Hệ thống VNPT Business</strong></p>
    </div>

    <div class="footer">
        <p>Email tự động từ hệ thống quản lý yêu cầu khách hàng</p>
    </div>
</body>
</html>
```

### Sử dụng Mailable

```php
use App\Mail\CustomerRequestAssignedMail;
use Illuminate\Support\Facades\Mail;

// Load SMTP config trước
$this->configureSmtpFromIntegration();

Mail::to($assignee->email)->send(
    new CustomerRequestAssignedMail($requestData, $assignee->full_name)
);
```

---

## Ví dụ tích hợp vào Customer Request Case

### Gửi email khi giao yêu cầu

**File:** `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php`

```php
use App\Services\V5\Email\EmailNotificationService;

class CustomerRequestCaseWriteService
{
    public function __construct(
        private readonly EmailNotificationService $emailService,
        // ...
    ) {}

    public function assignCase(int $caseId, int $assigneeUserId): array
    {
        // ... existing logic

        // Gửi email thông báo
        $assignee = DB::table('internal_users')->find($assigneeUserId);
        $case = DB::table('customer_request_cases')->find($caseId);

        if ($assignee && ! empty($assignee->email)) {
            $this->emailService->sendTemplateEmail(
                $assignee->email,
                'Yêu cầu khách hàng mới được giao: ' . $case->request_code,
                'emails.customer-request-assigned',
                [
                    'requestData' => [
                        'request_code' => $case->request_code,
                        'summary' => $case->summary,
                        'customer_name' => $case->customer_name,
                        'requester_name' => $case->requester_name,
                        'assigned_at' => now()->format('H:i d/m/Y'),
                    ],
                    'assigneeName' => $assignee->full_name,
                ]
            );
        }

        return ['success' => true];
    }
}
```

### Gửi email khi có comment mới

```php
public function addWorklog(int $caseId, array $data): array
{
    // ... existing logic

    // Notify watchers via email
    $watchers = $this->getCaseWatchers($caseId);
    $case = DB::table('customer_request_cases')->find($caseId);

    foreach ($watchers as $watcher) {
        if (! empty($watcher->email)) {
            $this->emailService->sendHtmlEmail(
                $watcher->email,
                'Comment mới trong yêu cầu: ' . $case->request_code,
                view('emails.new-comment', [
                    'case' => $case,
                    'comment' => $data['content'],
                    'author' => $data['author_name'],
                ])->render()
            );
        }
    }

    return ['success' => true];
}
```

---

## Test email service

### Tạo Artisan command để test

```bash
php artisan make:command TestEmailCommand
```

**File:** `backend/app/Console/Commands/TestEmailCommand.php`

```php
<?php

namespace App\Console\Commands;

use App\Services\V5\Email\EmailNotificationService;
use Illuminate\Console\Command;

class TestEmailCommand extends Command
{
    protected $signature = 'test:email {recipient} {--subject=Test Email}';
    protected $description = 'Gửi email test từ cấu hình SMTP';

    public function handle(EmailNotificationService $emailService): int
    {
        $recipient = $this->argument('recipient');
        $subject = $this->option('subject');

        $this->info("Đang gửi email test đến: $recipient");

        $result = $emailService->sendHtmlEmail(
            $recipient,
            $subject,
            '<h1>Email Test Thành Công!</h1><p>Đây là email test từ VNPT Business.</p><p>Thời gian: ' . now()->format('H:i:s d/m/Y') . '</p>'
        );

        if ($result['success']) {
            $this->info('✓ ' . $result['message']);
            return Command::SUCCESS;
        }

        $this->error('✗ ' . $result['message']);
        return Command::FAILURE;
    }
}
```

### Chạy test command

```bash
cd backend
php artisan test:email quynhtranza3@gmail.com
php artisan test:email quynhtranza3@gmail.com --subject="Test từ QLCV2"
```

---

## Checklist tích hợp

- [ ] Tạo `EmailNotificationService.php`
- [ ] Đăng ký service provider
- [ ] Tạo Blade templates cho các loại email
- [ ] Tích hợp vào các service cần gửi email
- [ ] Tạo Artisan command test
- [ ] Test gửi email thành công
- [ ] Xử lý queue cho email (nếu cần)
- [ ] Logging đầy đủ

---

## Queue email (Optional - cho production)

Để gửi email không blocking, sử dụng Laravel Queue:

```php
// Trong service
use Illuminate\Support\Facades\Mail;
use App\Mail\CustomerRequestAssignedMail;

Mail::to($assignee->email)->queue(
    new CustomerRequestAssignedMail($requestData, $assignee->full_name)
);
```

Cần config queue worker:

```bash
php artisan queue:work --tries=3
```
