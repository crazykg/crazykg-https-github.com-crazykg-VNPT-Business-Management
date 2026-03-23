# Plan: Cấu hình gửi Email qua Gmail (Email SMTP Integration)

## ⚠️ Trạng thái: CHƯA TRIỂN KHAI (CẬP NHẬT THEO KIẾN TRÚC MỚI)

Plan này đã được cập nhật để phù hợp với kiến trúc Domain Services mới của hệ thống.

### Kiến trúc hiện tại (2026-03-23)

**Backend Architecture:**
```
IntegrationSettingsController
    └── IntegrationSettingsDomainService
            ├── BackblazeB2IntegrationService
            ├── GoogleDriveIntegrationService
            └── IntegrationSettingsOperationsService (contract alerts)
```

**Frontend Architecture:**
```
App.tsx (centralized state)
    └── IntegrationSettingsPanel.tsx
            ├── Types: *IntegrationSettings interfaces
            └── API: v5Api.ts functions
```

---

## Mục tiêu

Thêm tùy chọn cấu hình gửi email qua Gmail/SMTP vào tab "Cấu hình tích hợp" (`/?tab=integration_settings`), cho phép admin cấu hình SMTP settings để gửi email hệ thống (reset password, thông báo, v.v.).

**Provider name:** `EMAIL_SMTP`

---

## Phân tích hiện trạng

### 1. Backend - Architecture mới

#### Controller pattern hiện tại:
**File:** `backend/app/Http/Controllers/Api/V5/IntegrationSettingsController.php`

```php
class IntegrationSettingsController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly IntegrationSettingsDomainService $service
    ) {
        parent::__construct($support, $accessAudit);
    }

    // Delegate tất cả vào Domain Service
}
```

#### Domain Service pattern:
**File:** `backend/app/Services/V5\Domain\IntegrationSettingsDomainService.php`

```php
class IntegrationSettingsDomainService
{
    public function __construct(
        private readonly BackblazeB2IntegrationService $backblaze,
        private readonly GoogleDriveIntegrationService $googleDrive,
        private readonly IntegrationSettingsOperationsService $operations,
    ) {}

    // Methods delegate sang các service riêng
}
```

#### Integration Service pattern (BackblazeB2 example):
**File:** `backend/app/Services/V5/IntegrationSettings/BackblazeB2IntegrationService.php`

```php
class BackblazeB2IntegrationService
{
    private const PROVIDER = 'BACKBLAZE_B2';

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function settings(): JsonResponse { ... }
    public function updateSettings(Request $request): JsonResponse { ... }
    public function testSettings(Request $request): JsonResponse { ... }
}
```

#### Routes hiện tại:
**File:** `backend/routes/api.php`

```php
// Integration Settings
Route::get('/integrations/backblaze-b2', [IntegrationSettingsController::class, 'backblazeSettings']);
Route::put('/integrations/backblaze-b2', [IntegrationSettingsController::class, 'updateBackblazeSettings']);
Route::post('/integrations/backblaze-b2/test', [IntegrationSettingsController::class, 'testBackblazeSettings']);

Route::get('/integrations/google-drive', [IntegrationSettingsController::class, 'googleDriveSettings']);
Route::put('/integrations/google-drive', [IntegrationSettingsController::class, 'updateGoogleDriveSettings']);
Route::post('/integrations/google-drive/test', [IntegrationSettingsController::class, 'testGoogleDriveSettings']);

// Utilities (contract alerts - dùng IntegrationSettingsOperationsService)
Route::get('/utilities/contract-expiry-alert', [IntegrationSettingsController::class, 'contractExpiryAlertSettings']);
Route::put('/utilities/contract-expiry-alert', [IntegrationSettingsController::class, 'updateContractExpiryAlertSettings']);
```

### 2. Frontend - IntegrationSettingsPanel.tsx

**File:** `frontend/components/IntegrationSettingsPanel.tsx`

**Các nhóm cấu hình hiện có:**
- `GOOGLE_DRIVE` - Cấu hình Google Drive
- `BACKBLAZE_B2` - Cấu hình Backblaze B2
- `CONTRACT_EXPIRY_ALERT` - Cảnh báo hợp đồng hết hiệu lực
- `CONTRACT_PAYMENT_ALERT` - Cảnh báo hợp đồng thanh toán

**Pattern UI:**
- Dropdown "Chọn nhóm cấu hình" với `SETTINGS_GROUP_OPTIONS`
- Mỗi nhóm có: toggle enable/disable, form fields, test connection, save
- State management: separate useState cho mỗi field
- Props pattern: `onSave`, `onTest`, loading states riêng

**Types hiện tại:**
```typescript
export interface GoogleDriveIntegrationSettings {
  provider: 'GOOGLE_DRIVE';
  is_enabled: boolean;
  account_email?: string | null;
  folder_id?: string | null;
  has_service_account_json: boolean;
  source?: 'DB' | 'ENV';
  last_tested_at?: string | null;
  last_test_status?: 'SUCCESS' | 'FAILED' | null;
  last_test_message?: string | null;
  updated_at?: string | null;
}

export interface BackblazeB2IntegrationSettings {
  provider: 'BACKBLAZE_B2';
  is_enabled: boolean;
  access_key_id?: string | null;
  bucket_id?: string | null;
  bucket_name?: string | null;
  region?: string | null;
  endpoint?: string | null;
  has_secret_access_key: boolean;
  secret_access_key_preview?: string | null;
  source?: 'DB' | 'ENV';
  last_tested_at?: string | null;
  last_test_status?: 'SUCCESS' | 'FAILED' | null;
  last_test_message?: string | null;
  updated_at?: string | null;
}
```

### 3. Database - integration_settings table

**File:** `backend/database/migrations/2026_02_25_213000_create_integration_settings_table.php`

**Columns hiện tại:**
```sql
- id
- provider (unique: GOOGLE_DRIVE, BACKBLAZE_B2, CONTRACT_ALERT, CONTRACT_PAYMENT_ALERT)
- is_enabled
- account_email
- folder_id
- scopes
- impersonate_user
- file_prefix
- service_account_json (encrypted)
- access_key_id
- secret_access_key (encrypted)
- bucket_id
- bucket_name
- region
- contract_expiry_warning_days
- contract_payment_warning_days
- last_tested_at
- last_test_status
- last_test_message
- created_by, updated_by
- timestamps
```

### 4. Mail Configuration hiện tại

**File:** `backend/config/mail.php`

Laravel mail config sử dụng env variables:
```env
MAIL_MAILER=log
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"
```

> **Ghi chú:** Hiện tại `MAIL_MAILER=log` nghĩa là email chỉ ghi log, không gửi thực tế.

---

## Kế hoạch triển khai

### Phase 1: Database Migration

**File mới:** `backend/database/migrations/YYYY_MM_DD_HHMMSS_add_email_smtp_settings_to_integration_settings.php`

Thêm columns cho SMTP settings:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('integration_settings')) {
            return;
        }

        Schema::table('integration_settings', function (Blueprint $table): void {
            // SMTP Settings - thêm sau column file_prefix
            if (! Schema::hasColumn('integration_settings', 'smtp_host')) {
                $table->string('smtp_host')->nullable()->after('file_prefix');
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_port')) {
                $table->integer('smtp_port')->nullable()->after('smtp_host');
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_encryption')) {
                $table->string('smtp_encryption')->default('tls')->after('smtp_port'); // tls/ssl/none
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_username')) {
                $table->string('smtp_username')->nullable()->after('smtp_encryption');
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_password')) {
                $table->text('smtp_password')->nullable()->after('smtp_username'); // encrypted
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_from_address')) {
                $table->string('smtp_from_address')->nullable()->after('smtp_password');
            }
            if (! Schema::hasColumn('integration_settings', 'smtp_from_name')) {
                $table->string('smtp_from_name')->nullable()->after('smtp_from_address');
            }
        });
    }

    public function down(): void
    {
        Schema::table('integration_settings', function (Blueprint $table): void {
            $table->dropColumn([
                'smtp_host',
                'smtp_port',
                'smtp_encryption',
                'smtp_username',
                'smtp_password',
                'smtp_from_address',
                'smtp_from_name',
            ]);
        });
    }
};
```

---

### Phase 2: Backend - EmailSmtpIntegrationService (MỚI)

**File mới:** `backend/app/Services/V5/IntegrationSettings/EmailSmtpIntegrationService.php`

Tạo service mới theo pattern hiện tại của `BackblazeB2IntegrationService` và `GoogleDriveIntegrationService`:

```php
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
```

---

### Phase 3: Update IntegrationSettingsDomainService

**File:** `backend/app/Services/V5\Domain\IntegrationSettingsDomainService.php`

Thêm EmailSmtpIntegrationService vào dependency injection và methods:

```php
<?php

namespace App\Services\V5\Domain;

use App\Services\V5\IntegrationSettings\BackblazeB2IntegrationService;
use App\Services\V5\IntegrationSettings\EmailSmtpIntegrationService; // NEW
use App\Services\V5\IntegrationSettings\GoogleDriveIntegrationService;
use App\Services\V5\IntegrationSettings\IntegrationSettingsOperationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IntegrationSettingsDomainService
{
    public function __construct(
        private readonly BackblazeB2IntegrationService $backblaze,
        private readonly GoogleDriveIntegrationService $googleDrive,
        private readonly EmailSmtpIntegrationService $emailSmtp, // NEW
        private readonly IntegrationSettingsOperationsService $operations,
    ) {}

    // ... existing methods ...

    // NEW: Email SMTP methods
    public function emailSmtpSettings(): JsonResponse
    {
        return $this->emailSmtp->settings();
    }

    public function updateEmailSmtpSettings(Request $request): JsonResponse
    {
        return $this->emailSmtp->updateSettings($request);
    }

    public function testEmailSmtpSettings(Request $request): JsonResponse
    {
        return $this->emailSmtp->testSettings($request);
    }
}
```

---

### Phase 4: Update IntegrationSettingsController

**File:** `backend/app/Http/Controllers/Api/V5/IntegrationSettingsController.php`

Thêm methods delegate sang Domain Service:

```php
// ... existing code ...

public function emailSmtpSettings(): JsonResponse
{
    return $this->service->emailSmtpSettings();
}

public function updateEmailSmtpSettings(Request $request): JsonResponse
{
    return $this->service->updateEmailSmtpSettings($request);
}

public function testEmailSmtpSettings(Request $request): JsonResponse
{
    return $this->service->testEmailSmtpSettings($request);
}
```

---

### Phase 5: Backend Routes

**File:** `backend/routes/api.php`

Thêm routes mới (sau routes google-drive):

```php
// Email SMTP Integration
Route::get('/integrations/email-smtp', [IntegrationSettingsController::class, 'emailSmtpSettings'])
    ->middleware('permission:integration_settings.write');
Route::put('/integrations/email-smtp', [IntegrationSettingsController::class, 'updateEmailSmtpSettings'])
    ->middleware('permission:integration_settings.write');
Route::post('/integrations/email-smtp/test', [IntegrationSettingsController::class, 'testEmailSmtpSettings'])
    ->middleware('permission:integration_settings.write');
```

---

### Phase 6: Update config/mail.php

**File:** `backend/config/mail.php`

Thêm `encryption` key vào smtp config:

```php
'smtp' => [
    'transport' => 'smtp',
    'scheme' => env('MAIL_SCHEME'),
    'url' => env('MAIL_URL'),
    'host' => env('MAIL_HOST', '127.0.0.1'),
    'port' => env('MAIL_PORT', 2525),
    'username' => env('MAIL_USERNAME'),
    'password' => env('MAIL_PASSWORD'),
    'encryption' => env('MAIL_ENCRYPTION', 'tls'), // NEW - supports tls/ssl/none
    'local_domain' => env('MAIL_EHLO_DOMAIN', parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_HOST)),
],
```

---

### Phase 7: Frontend Types

**File:** `frontend/types.ts`

Thêm interfaces mới:

```typescript
export interface EmailSmtpIntegrationSettings {
  provider: 'EMAIL_SMTP';
  is_enabled: boolean;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_encryption?: 'tls' | 'ssl' | 'none' | null;
  smtp_username?: string | null;
  has_smtp_password: boolean;
  smtp_from_address?: string | null;
  smtp_from_name?: string | null;
  source?: 'DB' | 'DEFAULT';
  last_tested_at?: string | null;
  last_test_status?: 'SUCCESS' | 'FAILED' | null;
  last_test_message?: string | null;
  updated_at?: string | null;
}

export interface EmailSmtpIntegrationSettingsUpdatePayload {
  is_enabled: boolean;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_encryption?: 'tls' | 'ssl' | 'none' | null;
  smtp_username?: string | null;
  smtp_password?: string | null;
  clear_smtp_password?: boolean;
  smtp_from_address?: string | null;
  smtp_from_name?: string | null;
}
```

---

### Phase 8: Frontend API Service

**File:** `frontend/services/v5Api.ts`

Thêm functions:

```typescript
export async function fetchEmailSmtpIntegrationSettings(): Promise<EmailSmtpIntegrationSettings> {
  const response = await v5Api.get('/integrations/email-smtp');
  return response.data.data;
}

export async function updateEmailSmtpIntegrationSettings(
  payload: EmailSmtpIntegrationSettingsUpdatePayload
): Promise<EmailSmtpIntegrationSettings> {
  const response = await v5Api.put('/integrations/email-smtp', payload);
  return response.data.data;
}

export async function testEmailSmtpIntegrationSettings(
  payload: EmailSmtpIntegrationSettingsUpdatePayload
): Promise<{ message?: string; status?: 'SUCCESS' | 'FAILED'; tested_at?: string }> {
  const response = await v5Api.post('/integrations/email-smtp/test', payload);
  return response.data;
}
```

---

### Phase 9: Frontend Component - IntegrationSettingsPanel.tsx

**File:** `frontend/components/IntegrationSettingsPanel.tsx`

#### 9.1. Update types và imports:

```typescript
import {
  BackblazeB2IntegrationSettings,
  BackblazeB2IntegrationSettingsUpdatePayload,
  ContractExpiryAlertSettings,
  ContractExpiryAlertSettingsUpdatePayload,
  ContractPaymentAlertSettings,
  ContractPaymentAlertSettingsUpdatePayload,
  EmailSmtpIntegrationSettings, // NEW
  EmailSmtpIntegrationSettingsUpdatePayload, // NEW
  GoogleDriveIntegrationSettings,
  GoogleDriveIntegrationSettingsUpdatePayload,
} from '../types';

type SettingsGroup = 'GOOGLE_DRIVE' | 'BACKBLAZE_B2' | 'EMAIL_SMTP' | 'CONTRACT_EXPIRY_ALERT' | 'CONTRACT_PAYMENT_ALERT'; // NEW
```

#### 9.2. Update SETTINGS_GROUP_OPTIONS:

```typescript
const SETTINGS_GROUP_OPTIONS: Array<{ value: SettingsGroup; label: string }> = [
  { value: 'GOOGLE_DRIVE', label: 'Cấu hình Google Drive' },
  { value: 'BACKBLAZE_B2', label: 'Cấu hình Backblaze B2' },
  { value: 'EMAIL_SMTP', label: 'Cấu hình gửi Email qua Gmail' }, // NEW
  { value: 'CONTRACT_EXPIRY_ALERT', label: 'Cảnh báo hợp đồng sắp hết hiệu lực' },
  { value: 'CONTRACT_PAYMENT_ALERT', label: 'Cảnh báo hợp đồng sắp thanh toán' },
];
```

#### 9.3. Update props interface:

```typescript
interface IntegrationSettingsPanelProps {
  backblazeB2Settings: BackblazeB2IntegrationSettings | null;
  settings: GoogleDriveIntegrationSettings | null;
  emailSmtpSettings: EmailSmtpIntegrationSettings | null; // NEW
  contractExpiryAlertSettings: ContractExpiryAlertSettings | null;
  contractPaymentAlertSettings: ContractPaymentAlertSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  isSavingBackblazeB2: boolean;
  isTestingBackblazeB2: boolean;
  isSavingEmailSmtp: boolean; // NEW
  isTestingEmailSmtp: boolean; // NEW
  isSavingContractExpiryAlert: boolean;
  isSavingContractPaymentAlert: boolean;
  onRefresh: () => Promise<void>;
  onSaveBackblazeB2: (payload: BackblazeB2IntegrationSettingsUpdatePayload) => Promise<void>;
  onSave: (payload: GoogleDriveIntegrationSettingsUpdatePayload) => Promise<void>;
  onSaveEmailSmtp: (payload: EmailSmtpIntegrationSettingsUpdatePayload) => Promise<void>; // NEW
  onTestEmailSmtp: (payload: EmailSmtpIntegrationSettingsUpdatePayload) => Promise<{ // NEW
    message?: string;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
  }>;
  onSaveContractExpiryAlert: (payload: ContractExpiryAlertSettingsUpdatePayload) => Promise<void>;
  onSaveContractPaymentAlert: (payload: ContractPaymentAlertSettingsUpdatePayload) => Promise<void>;
  onTestBackblazeB2: (payload: BackblazeB2IntegrationSettingsUpdatePayload) => Promise<{
    message?: string;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
    persisted?: boolean;
  }>;
  onTest: (payload: GoogleDriveIntegrationSettingsUpdatePayload) => Promise<{
    message?: string;
    user_email?: string | null;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
    persisted?: boolean;
  }>;
}
```

#### 9.4. Thêm state variables:

```typescript
const [isEmailEnabled, setIsEmailEnabled] = useState(false);
const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
const [smtpPort, setSmtpPort] = useState(587);
const [smtpEncryption, setSmtpEncryption] = useState<'tls' | 'ssl' | 'none'>('tls');
const [smtpUsername, setSmtpUsername] = useState('');
const [smtpPassword, setSmtpPassword] = useState('');
const [clearSmtpPassword, setClearSmtpPassword] = useState(false);
const [smtpFromAddress, setSmtpFromAddress] = useState('');
const [smtpFromName, setSmtpFromName] = useState('VNPT Business');
const [displayedEmailTestStatus, setDisplayedEmailTestStatus] = useState<EmailSmtpIntegrationSettings['last_test_status']>(null);
const [displayedEmailTestMessage, setDisplayedEmailTestMessage] = useState('');
const [displayedEmailTestedAt, setDisplayedEmailTestedAt] = useState<string | null>(null);
```

#### 9.5. Thêm effect để load settings:

```typescript
useEffect(() => {
  const host = emailSmtpSettings?.smtp_host || 'smtp.gmail.com';
  setIsEmailEnabled(Boolean(emailSmtpSettings?.is_enabled));
  setSmtpHost(host);
  setSmtpPort(emailSmtpSettings?.smtp_port || (emailSmtpSettings?.smtp_encryption === 'ssl' ? 465 : 587));
  setSmtpEncryption((emailSmtpSettings?.smtp_encryption as 'tls' | 'ssl' | 'none') || 'tls');
  setSmtpUsername(emailSmtpSettings?.smtp_username || '');
  setSmtpPassword('');
  setClearSmtpPassword(false);
  setSmtpFromAddress(emailSmtpSettings?.smtp_from_address || '');
  setSmtpFromName(emailSmtpSettings?.smtp_from_name || 'VNPT Business');
  setDisplayedEmailTestStatus(emailSmtpSettings?.last_test_status ?? null);
  setDisplayedEmailTestMessage(emailSmtpSettings?.last_test_message || '');
  setDisplayedEmailTestedAt(emailSmtpSettings?.last_tested_at || null);
}, [emailSmtpSettings]);
```

#### 9.6. Thêm handlers:

```typescript
const buildEmailPayload = (): EmailSmtpIntegrationSettingsUpdatePayload => {
  const payload: EmailSmtpIntegrationSettingsUpdatePayload = {
    is_enabled: isEmailEnabled,
    smtp_host: smtpHost || null,
    smtp_port: smtpPort || null,
    smtp_encryption: smtpEncryption || 'tls',
    smtp_username: smtpUsername || null,
    smtp_from_address: smtpFromAddress || null,
    smtp_from_name: smtpFromName || null,
  };

  if (clearSmtpPassword) {
    payload.clear_smtp_password = true;
  } else if (smtpPassword) {
    payload.smtp_password = smtpPassword;
  }

  return payload;
};

const handleSaveEmailSmtp = async () => {
  await onSaveEmailSmtp(buildEmailPayload());
};

const handleTestEmailSmtp = async () => {
  try {
    const result = await onTestEmailSmtp(buildEmailPayload());
    setDisplayedEmailTestStatus(result.status || 'SUCCESS');
    setDisplayedEmailTestMessage(result.message || 'Kết nối thành công.');
    setDisplayedEmailTestedAt(result.tested_at || new Date().toISOString());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    setDisplayedEmailTestStatus('FAILED');
    setDisplayedEmailTestMessage(message);
    setDisplayedEmailTestedAt(new Date().toISOString());
  }
};
```

#### 9.7. Update globalBusy:

```typescript
const globalBusy =
  isLoading ||
  isSavingBackblazeB2 ||
  isTestingBackblazeB2 ||
  isSaving ||
  isTesting ||
  isSavingEmailSmtp || // NEW
  isTestingEmailSmtp || // NEW
  isSavingContractExpiryAlert ||
  isSavingContractPaymentAlert;
```

#### 9.8. Thêm UI block cho EMAIL_SMTP:

Thêm block UI mới sau `BACKBLAZE_B2` block, trước `GOOGLE_DRIVE` block:

```typescript
{selectedGroup === 'EMAIL_SMTP' && (
  <>
    <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
          <span className="material-symbols-outlined text-primary text-base">mail</span>
          Cấu hình gửi Email qua Gmail
        </span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          displayedEmailTestStatus === 'SUCCESS'
            ? 'bg-emerald-100 text-emerald-700'
            : displayedEmailTestStatus === 'FAILED'
              ? 'bg-red-100 text-red-700'
              : 'bg-slate-100 text-slate-600'
        }`}>
          {displayedEmailTestStatus === 'SUCCESS'
            ? 'Kết nối thành công'
            : displayedEmailTestStatus === 'FAILED'
              ? 'Kết nối lỗi'
              : 'Chưa kiểm tra'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleTestEmailSmtp()}
          disabled={globalBusy}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-3 py-2 rounded-lg font-bold text-sm shadow-sm disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-base ${isTestingEmailSmtp ? 'animate-spin' : ''}`}>
            {isTestingEmailSmtp ? 'progress_activity' : 'verified'}
          </span>
          Kiểm tra kết nối
        </button>
        <button
          type="button"
          onClick={() => void handleSaveEmailSmtp()}
          disabled={globalBusy}
          className="flex items-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-3 py-2 rounded-lg font-bold text-sm shadow-md shadow-primary/20 disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-base ${isSavingEmailSmtp ? 'animate-spin' : ''}`}>
            {isSavingEmailSmtp ? 'progress_activity' : 'save'}
          </span>
          Lưu cấu hình
        </button>
      </div>
    </div>

    <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="space-y-1">
        <label className="text-sm font-bold text-slate-700">Bật gửi email</label>
        <button
          type="button"
          onClick={() => setIsEmailEnabled((prev) => !prev)}
          className={`w-full h-11 rounded-lg border text-sm font-bold transition-colors ${
            isEmailEnabled
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          {isEmailEnabled ? 'Đang bật' : 'Đang tắt'}
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-bold text-slate-700">SMTP Host</label>
        <input
          type="text"
          value={smtpHost}
          onChange={(event) => setSmtpHost(event.target.value)}
          placeholder="smtp.gmail.com"
          className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-bold text-slate-700">SMTP Port</label>
        <input
          type="number"
          min={1}
          max={65535}
          value={smtpPort}
          onChange={(event) => setSmtpPort(Number(event.target.value))}
          placeholder="587"
          className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
        <p className="text-xs text-slate-500">Gmail: 587 cho TLS, 465 cho SSL</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-bold text-slate-700">Mã hóa</label>
        <select
          value={smtpEncryption}
          onChange={(event) => setSmtpEncryption(event.target.value as 'tls' | 'ssl' | 'none')}
          className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="tls">TLS</option>
          <option value="ssl">SSL</option>
          <option value="none">None</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-bold text-slate-700">SMTP Username</label>
        <input
          type="email"
          value={smtpUsername}
          onChange={(event) => setSmtpUsername(event.target.value)}
          placeholder="your-email@gmail.com"
          className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
        <p className="text-xs text-slate-500">Địa chỉ email Gmail</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-bold text-slate-700">SMTP Password</label>
        <input
          type="password"
          value={smtpPassword}
          onChange={(event) => {
            setSmtpPassword(event.target.value);
            if (event.target.value) {
              setClearSmtpPassword(false);
            }
          }}
          placeholder="App Password (16 ký tự)"
          className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 select-none">
          <input
            type="checkbox"
            checked={clearSmtpPassword}
            onChange={(event) => {
              setClearSmtpPassword(event.target.checked);
              if (event.target.checked) {
                setSmtpPassword('');
              }
            }}
            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
          />
          Xóa mật khẩu đang lưu
        </label>
        <p className="text-xs text-slate-500">
          ⚠ Sử dụng App Password nếu bật 2FA
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-bold text-slate-700">Email gửi (From)</label>
        <input
          type="email"
          value={smtpFromAddress}
          onChange={(event) => setSmtpFromAddress(event.target.value)}
          placeholder="your-email@gmail.com"
          className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-bold text-slate-700">Tên người gửi</label>
        <input
          type="text"
          value={smtpFromName}
          onChange={(event) => setSmtpFromName(event.target.value)}
          placeholder="VNPT Business"
          className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </div>
    </div>

    <div className="px-5 md:px-6 pb-5 md:pb-6">
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <p className="font-bold text-slate-700">Nguồn cấu hình</p>
          <p>{emailSmtpSettings?.source || 'DEFAULT'}</p>
        </div>
        <div>
          <p className="font-bold text-slate-700">Lần kiểm tra gần nhất</p>
          <p>{formatTestTime(displayedEmailTestedAt)}</p>
        </div>
        <div>
          <p className="font-bold text-slate-700">Thông điệp hệ thống</p>
          <p className="break-words">{displayedEmailTestMessage || '--'}</p>
        </div>
      </div>
    </div>
  </>
)}
```

---

### Phase 10: Update App.tsx

**File:** `frontend/App.tsx`

#### 10.1. Thêm state:

```typescript
const [emailSmtpSettings, setEmailSmtpSettings] = useState<EmailSmtpIntegrationSettings | null>(null);
const [isEmailSettingsLoading, setIsEmailSettingsLoading] = useState(false);
const [isEmailSettingsSaving, setIsEmailSettingsSaving] = useState(false);
const [isEmailSettingsTesting, setIsEmailSettingsTesting] = useState(false);
```

#### 10.2. Thêm refresh function:

```typescript
const refreshEmailSmtpSettings = async () => {
  setIsEmailSettingsLoading(true);
  try {
    const data = await fetchEmailSmtpIntegrationSettings();
    setEmailSmtpSettings(data);
  } catch (error) {
    addToast('error', 'Tải cấu hình email thất bại', error instanceof Error ? error.message : 'Lỗi không xác định');
  } finally {
    setIsEmailSettingsLoading(false);
  }
};
```

#### 10.3. Thêm save handler:

```typescript
const handleSaveEmailSmtpSettings = async (payload: EmailSmtpIntegrationSettingsUpdatePayload) => {
  setIsEmailSettingsSaving(true);
  try {
    const updated = await updateEmailSmtpIntegrationSettings(payload);
    setEmailSmtpSettings(updated);
    addToast('success', 'Thành công', 'Đã lưu cấu hình email SMTP.');
  } catch (error) {
    addToast('error', 'Lưu cấu hình thất bại', error instanceof Error ? error.message : 'Lỗi không xác định');
  } finally {
    setIsEmailSettingsSaving(false);
  }
};
```

#### 10.4. Thêm test handler:

```typescript
const handleTestEmailSmtpIntegration = async (payload: EmailSmtpIntegrationSettingsUpdatePayload) => {
  setIsEmailSettingsTesting(true);
  try {
    const result = await testEmailSmtpIntegrationSettings(payload);
    addToast('success', 'Kiểm tra email', result.message || 'Kết nối thành công.');
    return result;
  } catch (error) {
    addToast('error', 'Kiểm tra kết nối thất bại', error instanceof Error ? error.message : 'Lỗi không xác định');
    throw error;
  } finally {
    setIsEmailSettingsTesting(false);
  }
};
```

#### 10.5. Update refreshIntegrationSettings:

```typescript
const refreshIntegrationSettings = async () => {
  await Promise.all([
    refreshBackblazeB2Settings(),
    refreshGoogleDriveSettings(),
    refreshEmailSmtpSettings(), // NEW
    refreshContractExpiryAlertSettings(),
    refreshContractPaymentAlertSettings(),
  ]);
};
```

#### 10.6. Pass props vào IntegrationSettingsPanel:

```typescript
<IntegrationSettingsPanel
  backblazeB2Settings={backblazeB2Settings}
  settings={googleDriveSettings}
  emailSmtpSettings={emailSmtpSettings} // NEW
  contractExpiryAlertSettings={contractExpiryAlertSettings}
  contractPaymentAlertSettings={contractPaymentAlertSettings}
  isLoading={isBackblazeB2SettingsLoading || isGoogleDriveSettingsLoading || isEmailSettingsLoading || isContractExpiryAlertLoading || isContractPaymentAlertLoading}
  isSaving={isGoogleDriveSettingsSaving}
  isTesting={isGoogleDriveSettingsTesting}
  isSavingBackblazeB2={isBackblazeB2SettingsSaving}
  isTestingBackblazeB2={isBackblazeB2SettingsTesting}
  isSavingEmailSmtp={isEmailSettingsSaving} // NEW
  isTestingEmailSmtp={isEmailSettingsTesting} // NEW
  isSavingContractExpiryAlert={isContractExpiryAlertSaving}
  isSavingContractPaymentAlert={isContractPaymentAlertSaving}
  onRefresh={refreshIntegrationSettings}
  onSaveBackblazeB2={handleSaveBackblazeB2Settings}
  onSave={handleSaveGoogleDriveSettings}
  onSaveEmailSmtp={handleSaveEmailSmtpSettings} // NEW
  onTestEmailSmtp={handleTestEmailSmtpIntegration} // NEW
  onSaveContractExpiryAlert={handleSaveContractExpiryAlertSettings}
  onSaveContractPaymentAlert={handleSaveContractPaymentAlertSettings}
  onTestBackblazeB2={handleTestBackblazeB2Integration}
  onTest={handleTestGoogleDriveIntegration}
/>
```

---

### Phase 11: Update .env.example

**File:** `backend/.env.example`

Thêm comments hướng dẫn:

```env
# ==========================================
# Mail Configuration
# ==========================================
# Default: log (emails written to log file)
# For Gmail SMTP, configure via UI: /?tab=integration_settings
# Or override below:
# MAIL_MAILER=smtp
# MAIL_HOST=smtp.gmail.com
# MAIL_PORT=587
# MAIL_ENCRYPTION=tls
# MAIL_USERNAME=your-email@gmail.com
# MAIL_PASSWORD=your-app-password
# MAIL_FROM_ADDRESS=noreply@yourdomain.com
# MAIL_FROM_NAME="${APP_NAME}"

MAIL_MAILER=log
MAIL_SCHEME=null
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"
```

---

## UI Fields cho Gmail Configuration

```
┌─────────────────────────────────────────────────────────────┐
│ Chọn nhóm cấu hình: [Cấu hình gửi Email qua Gmail    ▼]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │  📧 Cấu hình gửi Email qua Gmail    [✅ Đã test]    │    │
│ │                                      [Kiểm tra] [Lưu]│    │
│ ├─────────────────────────────────────────────────────┤    │
│ │                                                     │    │
│ │  Bật gửi email           [Đang bật]                 │    │
│ │                                                     │    │
│ │  SMTP Host                 [smtp.gmail.com        ] │    │
│ │                                                     │    │
│ │  SMTP Port                 [587                   ] │    │
│ │  (Gmail: 587 cho TLS, 465 cho SSL)                 │    │
│ │                                                     │    │
│ │  Mã hóa                    [TLS                   ▼] │    │
│ │  (TLS/SSL/None)                                      │    │
│ │                                                     │    │
│ │  SMTP Username           [your-email@gmail.com    ] │    │
│ │  (Địa chỉ email Gmail)                               │    │
│ │                                                     │    │
│ │  SMTP Password           [●●●●●●●●●●●●●●          ] │    │
│ │  [ ] Xóa mật khẩu đang lưu                           │    │
│ │  ⚠ Sử dụng App Password nếu bật 2FA                 │    │
│ │                                                     │    │
│ │  Email gửi (From)        [your-email@gmail.com    ] │    │
│ │                                                     │    │
│ │  Tên người gửi           [VNPT Business           ] │    │
│ │                                                     │    │
│ │  ┌──────────────────────────────────────────────┐  │    │
│ │  │ Nguồn: DB | Test: 20/03/2026 10:30 | OK     │  │    │
│ │  └──────────────────────────────────────────────┘  │    │
│ │                                                     │    │
│ └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Các files cần tạo/sửa

### Backend (7 files):
1. `backend/database/migrations/YYYY_MM_DD_HHMMSS_add_email_smtp_settings_to_integration_settings.php` (NEW)
2. `backend/app/Services/V5/IntegrationSettings/EmailSmtpIntegrationService.php` (NEW)
3. `backend/app/Services/V5\Domain\IntegrationSettingsDomainService.php` (EDIT)
4. `backend/app/Http/Controllers/Api/V5/IntegrationSettingsController.php` (EDIT)
5. `backend/routes/api.php` (EDIT)
6. `backend/config/mail.php` (EDIT)
7. `backend/.env.example` (EDIT)

### Frontend (4 files):
1. `frontend/types.ts` (EDIT)
2. `frontend/services/v5Api.ts` (EDIT)
3. `frontend/components/IntegrationSettingsPanel.tsx` (EDIT)
4. `frontend/App.tsx` (EDIT)

---

## Test Cases

### Backend Tests:
1. `GET /api/v5/integrations/email-smtp` - trả về settings từ DB
2. `PUT /api/v5/integrations/email-smtp` - lưu settings với encrypted password
3. `POST /api/v5/integrations/email-smtp/test` - test kết nối SMTP thành công
4. `POST /api/v5/integrations/email-smtp/test` - test kết nối SMTP thất bại (sai port, sai password)
5. Validate encryption modes (TLS/SSL/none)
6. Validate port range (1-65535)
7. Validate email format for username/from_address

### Frontend Tests:
1. Dropdown chọn "Cấu hình gửi Email qua Gmail" hiển thị đúng form
2. Toggle enable/disable hoạt động
3. Form validation (port number, email format)
4. Test connection button hiển thị loading và kết quả
5. Save button lưu settings thành công
6. Password field không hiển thị lại sau khi save
7. "Xóa mật khẩu" checkbox hoạt động

---

## Gmail Setup Guide (cho End-User)

### 1. Bật 2-Factor Authentication

1. Đăng nhập Gmail → https://myaccount.google.com/security
2. Chọn **2-Step Verification** → Bật nếu chưa có

### 2. Tạo App Password

1. Truy cập: https://myaccount.google.com/apppasswords
2. Chọn **App** → **Mail**
3. Chọn **Device** → **Other** → Nhập "VNPT Business"
4. Click **Generate**
5. Copy 16-ký tự password (không khoảng trắng):

```
abcd efgh ijkl mnop  →  abcdefghijklmnop
```

### 3. Cấu hình trong UI

1. Truy cập `http://localhost:5174/?tab=integration_settings`
2. Chọn **Cấu hình gửi Email qua Gmail**
3. Điền thông tin:

| Field | Value |
|-------|-------|
| Bật gửi email | **Đang bật** |
| SMTP Host | `smtp.gmail.com` |
| SMTP Port | `587` |
| Mã hóa | `TLS` |
| SMTP Username | `your-email@gmail.com` |
| SMTP Password | `abcdefghijklmnop` (16 ký tự) |
| Email gửi (From) | `your-email@gmail.com` |
| Tên người gửi | `VNPT Business` |
| Email nhận test | `recipient@example.com` (optional) |

4. Click **Kiểm tra kết nối**
5. Nếu thành công → Click **Lưu cấu hình**

---

## Security Considerations

1. **Password encryption:** Sử dụng `Crypt::encryptString()` trước khi lưu DB
2. **Never return raw password:** API chỉ trả về `has_smtp_password: boolean`
3. **Validation:** Email format, port range, encryption modes
4. **Permission:** Routes yêu cầu `integration_settings.write` permission
5. **Audit logging:** Có thể thêm audit log cho create/update/delete operations

---

## Timeline ước tính

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Database Migration | 15 min |
| 2 | EmailSmtpIntegrationService | 2 hours |
| 3 | Update IntegrationSettingsDomainService | 15 min |
| 4 | Update IntegrationSettingsController | 15 min |
| 5 | Backend Routes | 10 min |
| 6 | Update config/mail.php | 10 min |
| 7 | Frontend Types | 15 min |
| 8 | Frontend API Service | 30 min |
| 9 | Frontend Component | 2 hours |
| 10 | App.tsx Integration | 30 min |
| 11 | Update .env.example | 5 min |
| 12 | Testing & Debugging | 2 hours |
| **Total** | | **~8 hours** |

---

## Dependencies

- Laravel Sanctum (đã có)
- Laravel Mail (Symfony Mailer) - đã có
- React + TypeScript - đã có
- Material Symbols icons - đã có

---

## Notes

1. Không thay đổi mail config hiện tại đang dùng từ `.env`
2. Settings từ DB có priority cao hơn env (runtime override)
3. Hỗ trợ cả Gmail và SMTP provider khác (Office365, SendGrid, v.v.)
4. Functionality gửi email (reset password) sẽ implement ở ticket riêng
5. **Password handling:**
   - Không bao giờ trả về raw password từ API
   - Chỉ trả về `has_smtp_password: boolean`
   - Encrypt bằng `Crypt::encryptString()` trước khi lưu DB
   - Decrypt chỉ khi test connection hoặc gửi email
6. **Validation rules:**
   - Khi `is_enabled=true`: yêu cầu `smtp_host`, `smtp_username`
   - Port range: 1-65535
   - Email format cho `smtp_username` và `smtp_from_address`
7. **Test endpoint:**
   - Nhận thêm `test_recipient_email` (optional)
   - Test TCP connection trước
   - Test authentication sau (nếu có credentials)
   - Gửi test email cuối cùng
