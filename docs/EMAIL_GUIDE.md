# Hướng dẫn gửi Email trong hệ thống VNPT Business

## Tổng quan

Hệ thống hỗ trợ gửi email qua SMTP với 2 cách cấu hình:
1. **Cấu hình qua UI** (khuyến nghị) - Lưu encrypted trong database
2. **Cấu hình qua ENV** - Dùng cho deployment tự động

## Cách 1: Cấu hình qua UI (Recommended)

### Bước 1: Truy cập trang cấu hình

```
http://localhost:5174/?tab=integration_settings
```

### Bước 2: Chọn nhóm "Cấu hình gửi Email qua Gmail"

### Bước 3: Điền thông tin SMTP

| Field | Giá trị mẫu | Ghi chú |
|-------|-------------|---------|
| Bật gửi email | Đang bật | Toggle on/off |
| SMTP Host | `smtp.gmail.com` | Hoặc SMTP server khác |
| SMTP Port | `587` | TLS: 587, SSL: 465, None: 25 |
| Mã hóa | `TLS` | TLS/SSL/None |
| SMTP Username | `your-email@gmail.com` | Email gửi |
| SMTP Password | App Password (16 ký tự) | Xem hướng dẫn tạo bên dưới |
| Email gửi (From) | `your-email@gmail.com` | Thường giống username |
| Tên người gửi | `VNPT Business` | Hiển thị trong mail client |

### Bước 4: Kiểm tra kết nối

Click nút **"Kiểm tra kết nối"** để test SMTP connection.

### Bước 5: Lưu cấu hình

Click nút **"Lưu cấu hình"** để lưu settings vào database.

---

## Cách 2: Cấu hình qua ENV

Thêm vào file `.env`:

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM_ADDRESS=noreply@yourdomain.com
MAIL_FROM_NAME="${APP_NAME}"
```

Sau đó restart server:
```bash
php artisan config:clear
php artisan serve
```

---

## Tạo Gmail App Password

### Bước 1: Bật 2-Factor Authentication

1. Đăng nhập Gmail → https://myaccount.google.com/security
2. Chọn **2-Step Verification** → Bật nếu chưa có

### Bước 2: Tạo App Password

1. Truy cập: https://myaccount.google.com/apppasswords
2. Chọn **App** → **Mail**
3. Chọn **Device** → **Other** → Nhập "VNPT Business"
4. Click **Generate**
5. Copy 16-ký tự password (không khoảng trắng):

```
abcd efgh ijkl mnop  →  abcdefghijklmnop
```

---

## Sử dụng trong Code

### Gửi email đơn giản (Mail Facade)

```php
use Illuminate\Support\Facades\Mail;

// Cách 1: Gửi nhanh
Mail::raw('Nội dung email', function ($message) {
    $message->to('recipient@example.com')
            ->subject('Tiêu đề email');
});

// Cách 2: Gửi với view template
Mail::view('emails.notification', ['data' => $data], function ($message) {
    $message->to('recipient@example.com')
            ->subject('Thông báo từ VNPT Business');
});
```

### Gửi email với Mailable Class (Recommended)

#### Bước 1: Tạo Mailable class

```bash
php artisan make:mail CustomerNotification
```

#### Bước 2: Định nghĩa mailable class

```php
// app/Mail/CustomerNotification.php
namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class CustomerNotification extends Mailable
{
    use Queueable, SerializesModels;

    public $customerName;
    public $message;

    public function __construct(string $customerName, string $message)
    {
        $this->customerName = $customerName;
        $this->message = $message;
    }

    public function build(): self
    {
        return $this->subject('Thông báo từ VNPT Business')
                    ->view('emails.customer-notification')
                    ->with([
                        'customerName' => $this->customerName,
                        'messageContent' => $this->message,
                    ]);
    }
}
```

#### Bước 3: Tạo email template

```blade
<!-- resources/views/emails/customer-notification.blade.php -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>VNPT Business</title>
</head>
<body>
    <h1>Xin chào {{ $customerName }},</h1>

    <p>{{ $messageContent }}</p>

    <p>Trân trọng,<br>
    Đội ngũ VNPT Business</p>
</body>
</html>
```

#### Bước 4: Gửi email từ Controller/Service

```php
use App\Mail\CustomerNotification;
use Illuminate\Support\Facades\Mail;

// Gửi trực tiếp
Mail::to('customer@example.com')->send(
    new CustomerNotification('Nguyễn Văn A', 'Đơn hàng của bạn đã được xử lý.')
);

// Gửi queue (recommended cho production)
Mail::to('customer@example.com')->queue(
    new CustomerNotification('Nguyễn Văn A', 'Đơn hàng của bạn đã được xử lý.')
);
```

---

## Gửi email từ Domain Service

Khi thêm chức năng gửi email vào Domain Service, tuân thủ pattern sau:

```php
namespace App\Services\V5\Domain;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Support\Facades\Mail;
use App\Mail\CustomerNotification;

class CustomerDomainService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function notifyCustomer(string $customerEmail, string $customerName, string $message): void
    {
        // Gửi email notification
        Mail::to($customerEmail)->send(
            new CustomerNotification($customerName, $message)
        );
    }

    public function notifyCustomerAsync(string $customerEmail, string $customerName, string $message): void
    {
        // Gửi email qua queue (non-blocking)
        Mail::to($customerEmail)->queue(
            new CustomerNotification($customerName, $message)
        );
    }
}
```

---

## Các loại email thường gửi

### 1. Email thông báo hợp đồng

```php
Mail::to($customerEmail)->send(
    new ContractExpiryNotification($contract, $daysUntilExpiry)
);
```

### 2. Email thông báo yêu cầu hỗ trợ

```php
Mail::to($requesterEmail)->send(
    new SupportRequestCreated($supportRequest)
);
```

### 3. Email đặt lại mật khẩu

```php
Mail::to($user->email)->send(
    new PasswordResetLink($user, $resetToken)
);
```

### 4. Email thông báo thanh toán

```php
Mail::to($customerEmail)->send(
    new PaymentDueNotification($paymentSchedule, $dueAmount)
);
```

---

## Kiểm tra email đã gửi

### Xem log file

Email gửi qua `MAIL_MAILER=log` sẽ được ghi vào:

```
backend/storage/logs/laravel.log
```

Hoặc xem qua terminal:
```bash
tail -f storage/logs/laravel.log | grep -i "sending"
```

### Sử dụng Laravel Telescope (nếu cài)

```bash
php artisan telescope:install
php artisan migrate
php artisan telescope:publish
```

Truy cập: `http://localhost:8002/telescope/mail`

### Sử dụng Mailtrap cho development

```env
MAIL_MAILER=smtp
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your-mailtrap-username
MAIL_PASSWORD=your-mailtrap-password
MAIL_ENCRYPTION=tls
```

Truy cập: https://mailtrap.io để xem email giả lập.

---

## Xử lý lỗi thường gặp

### Lỗi: Connection refused

```
Connection refused (code: 111)
```

**Nguyên nhân:** Sai port hoặc firewall block.

**Giải pháp:**
- Kiểm tra port (TLS: 587, SSL: 465)
- Test kết nối: `telnet smtp.gmail.com 587`

### Lỗi: Authentication failed

```
SMTP Authentication failed
```

**Nguyên nhân:** Sai username/password hoặc cần App Password.

**Giải pháp:**
- Với Gmail: Tạo App Password thay vì dùng password thường
- Kiểm tra 2FA đã bật chưa

### Lỗi: Certificate validation failed

```
stream_socket_enable_crypto(): SSL operation failed
```

**Nguyên nhân:** SSL certificate validation.

**Giải pháp:** Thêm vào `config/mail.php`:
```php
'smtp' => [
    'verify_peer' => false,
    'verify_peer_name' => false,
],
```

### Lỗi: Rate limit exceeded

```
421 Too many connections
```

**Nguyên nhân:** Gửi quá nhiều email trong thời gian ngắn.

**Giải pháp:**
- Sử dụng queue để rate limit
- Dùng service như SendGrid, Amazon SES cho production

---

## Best Practices

### 1. Luôn dùng queue cho email

```php
// GOOD
Mail::to($user)->queue(new Notification($data));

// BAD (blocking)
Mail::to($user)->send(new Notification($data));
```

### 2. Config queue worker

```bash
# Chạy queue worker
php artisan queue:work --tries=3

# Chạy nhiều workers
php artisan queue:work --queue=emails --max-jobs=1000
```

### 3. Retry failed jobs

```bash
# Xem failed jobs
php artisan queue:failed

# Retry tất cả
php artisan queue:retry all

# Retry job cụ thể
php artisan queue:retry <job-id>
```

### 4. Log email events

Tạo listener để log:

```php
// EventServiceProvider.php
protected $listen = [
    \Illuminate\Mail\Events\MessageSent::class => [
        \App\Listeners\LogSentEmail::class,
    ],
];
```

### 5. Test email trước khi gửi production

```php
// Trong test
Mail::fake();

// Send email
Mail::to('test@example.com')->send(new TestEmail());

// Assert
Mail::assertSent(TestEmail::class, function ($mail) {
    return $mail->hasTo('test@example.com');
});
```

---

## Security Considerations

1. **Không hardcode credentials** - Luôn dùng env variables hoặc database encryption
2. **Encrypt password** - Hệ thống tự động encrypt khi lưu qua UI
3. **Rate limiting** - Giới hạn số email/giờ để tránh spam
4. **Validate recipient** - Luôn validate email format trước khi gửi
5. **Sanitize nội dung** - Tránh XSS trong email templates

---

## Tài liệu tham khảo

- [Laravel Mail Documentation](https://laravel.com/docs/mail)
- [Laravel Mailables](https://laravel.com/docs/mail#generating-mailables)
- [Gmail SMTP Settings](https://support.google.com/mail/answer/7126229)
- [Mailtrap for Testing](https://mailtrap.io)
