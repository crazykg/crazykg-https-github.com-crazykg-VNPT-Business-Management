# Phân tích chức năng Integration Settings (Sau khi bổ sung Email SMTP)

**URL:** `http://localhost:5174/integration-settings`

**Ngày cập nhật:** 2026-04-02

---

## 1. Tổng quan chức năng

Trang **Cấu hình tích hợp** cho phép quản lý các tích hợp hệ thống và ngưỡng cảnh báo:

| Nhóm cấu hình | Mô tả | Icon | Trạng thái |
|--------------|-------|------|-----------|
| **Google Drive** | Lưu trữ tài liệu | cloud | ✅ UI hoàn chỉnh |
| **Backblaze B2** | Object Storage S3 | cloud_upload | ✅ UI hoàn chỉnh |
| **Email SMTP** | Gửi email qua Gmail/SMTP | mail | ✅ MỚI: UI hoàn chỉnh |
| **HĐ hết hiệu lực** | Cảnh báo ngày hết hiệu lực hợp đồng | event_busy | ✅ UI hoàn chỉnh |
| **HĐ thanh toán** | Cảnh báo kỳ thanh toán hợp đồng | payments | ✅ UI hoàn chỉnh |

---

## 2. Database

### 2.1. Bảng `integration_settings`

**Migration khởi tạo:** `2026_02_25_213000_create_integration_settings_table.php`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | bigint | Primary key |
| `provider` | string(100) | UNIQUE - Tên nhà cung cấp |
| `is_enabled` | boolean | Trạng thái bật/tắt |
| `smtp_host` | string(255) | SMTP host (smtp.gmail.com) |
| `smtp_port` | integer | SMTP port (587/465) |
| `smtp_encryption` | string | tls/ssl/none |
| `smtp_username` | string(255) | SMTP username (email Gmail) |
| `smtp_password` | text | SMTP password (encrypted) - App Password |
| `smtp_from_address` | string(255) | Email hiển thị trong phần "From" |
| `smtp_from_name` | string(255) | Tên hiển thị trong phần "From" |
| `last_tested_at` | timestamp | Thời điểm kiểm tra cuối |
| `last_test_status` | string(20) | Trạng thái kiểm tra (SUCCESS/FAILED) |
| `last_test_message` | string(500) | Thông báo kiểm tra |
| `created_by` | bigint | Người tạo |
| `updated_by` | bigint | Người cập nhật |
| `created_at` | timestamp | Thời gian tạo |
| `updated_at` | timestamp | Thời gian cập nhật |

### 2.2. Migration cho Email SMTP

**File:** `2026_03_23_000001_add_email_smtp_settings_to_integration_settings.php`

```php
Schema::table('integration_settings', function (Blueprint $table): void {
    if (! Schema::hasColumn('integration_settings', 'smtp_host')) {
        $table->string('smtp_host')->nullable()->after('file_prefix');
    }
    if (! Schema::hasColumn('integration_settings', 'smtp_port')) {
        $table->integer('smtp_port')->nullable()->after('smtp_host');
    }
    if (! Schema::hasColumn('integration_settings', 'smtp_encryption')) {
        $table->string('smtp_encryption')->default('tls')->after('smtp_port');
    }
    if (! Schema::hasColumn('integration_settings', 'smtp_username')) {
        $table->string('smtp_username')->nullable()->after('smtp_encryption');
    }
    if (! Schema::hasColumn('integration_settings', 'smtp_password')) {
        $table->text('smtp_password')->nullable()->after('smtp_username');
    }
    if (! Schema::hasColumn('integration_settings', 'smtp_from_address')) {
        $table->string('smtp_from_address')->nullable()->after('smtp_password');
    }
    if (! Schema::hasColumn('integration_settings', 'smtp_from_name')) {
        $table->string('smtp_from_name')->nullable()->after('smtp_from_address');
    }
});
```

---

## 3. Backend

### 3.1. Routes (Bổ sung)

**File:** `backend/routes/api.php`

```php
// Email SMTP
Route::get('/integrations/email-smtp', [IntegrationSettingsController::class, 'emailSmtpSettings']);
Route::put('/integrations/email-smtp', [IntegrationSettingsController::class, 'updateEmailSmtpSettings']);
Route::post('/integrations/email-smtp/test', [IntegrationSettingsController::class, 'testEmailSmtpSettings']);
```

### 3.2. Controller (Bổ sung)

**File:** `backend/app/Http/Controllers/Api/V5/IntegrationSettingsController.php`

```php
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

### 3.3. Email SMTP Service

**File:** `backend/app/Services/V5/IntegrationSettings/EmailSmtpIntegrationService.php`

#### 3.3.1. Cấu hình SMTP cho Gmail

```php
private const PROVIDER = 'EMAIL_SMTP';
private const DEFAULT_SMTP_HOST = 'smtp.gmail.com';
private const DEFAULT_SMTP_PORTS = [
    'tls' => 587,
    'ssl' => 465,
    'none' => 25,
];
```

#### 3.3.2. Test Connection Logic

```php
private function testSmtpConnection(array $settings): array
{
    try {
        $host = $settings['smtp_host'] ?? self::DEFAULT_SMTP_HOST;
        $port = (int) ($settings['smtp_port'] ?? 587);
        $timeout = 10;

        // 1. Test TCP connection
        $socket = @fsockopen($host, $port, $errno, $errstr, $timeout);
        if (! $socket) {
            return [
                'success' => false,
                'message' => "Không thể kết nối SMTP: $errstr ($errno)",
            ];
        }
        fclose($socket);

        // 2. Test authentication via Laravel Mail
        if (! empty($settings['smtp_username']) && ! empty($settings['smtp_password'])) {
            // Temporary override config
            $originalMailer = config('mail.default');
            $originalSmtp = config('mail.mailers.smtp');
            
            Config::set('mail.default', 'smtp');
            Config::set('mail.mailers.smtp', [
                'transport' => 'smtp',
                'host' => $host,
                'port' => $port,
                'username' => $settings['smtp_username'],
                'password' => $settings['smtp_password'],
                'encryption' => $settings['smtp_encryption'] ?? 'tls',
                'local_domain' => parse_url(config('app.url'), PHP_URL_HOST),
            ]);

            // Send test email
            $testRecipient = $settings['test_recipient_email'] ?? $settings['smtp_username'];
            \Illuminate\Support\Facades\Mail::raw(
                'Đây là email test từ VNPT Business.',
                fn ($m) => $m
                    ->to($testRecipient)
                    ->subject('Test Email Configuration - ' . now()->format('Y-m-d H:i:s'))
                    ->from($settings['smtp_username'], $settings['smtp_from_name'] ?? 'Test')
            );

            // Restore config
            Config::set('mail.default', $originalMailer);
            Config::set('mail.mailers.smtp', $originalSmtp);
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
```

---

## 4. Frontend (Bổ sung)

### 4.1. Types (Bổ sung)

**File:** `frontend/types/admin.ts`

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
  test_recipient_email?: string | null;
}
```

### 4.2. API Services (Bổ sung)

**File:** `frontend/services/api/adminApi.ts`

```typescript
export const fetchEmailSmtpIntegrationSettings = async (): Promise<EmailSmtpIntegrationSettings> => {
  const res = await apiFetch('/api/v5/integrations/email-smtp', {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_EMAIL_SMTP_INTEGRATION_FAILED'));
  }

  return parseItemJson<EmailSmtpIntegrationSettings>(res);
};

export const updateEmailSmtpIntegrationSettings = async (
  payload: EmailSmtpIntegrationSettingsUpdatePayload
): Promise<EmailSmtpIntegrationSettings> => {
  const res = await apiFetch('/api/v5/integrations/email-smtp', {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      is_enabled: payload.is_enabled,
      smtp_host: normalizeNullableText(payload.smtp_host),
      smtp_port: payload.smtp_port,
      smtp_encryption: payload.smtp_encryption,
      smtp_username: normalizeNullableText(payload.smtp_username),
      smtp_password: normalizeNullableText(payload.smtp_password),
      clear_smtp_password: Boolean(payload.clear_smtp_password),
      smtp_from_address: normalizeNullableText(payload.smtp_from_address),
      smtp_from_name: normalizeNullableText(payload.smtp_from_name),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_EMAIL_SMTP_INTEGRATION_FAILED'));
  }

  return parseItemJson<EmailSmtpIntegrationSettings>(res);
};

export const testEmailSmtpIntegrationSettings = async (
  payload?: EmailSmtpIntegrationSettingsUpdatePayload
): Promise<{
  message?: string;
  status?: 'SUCCESS' | 'FAILED';
  tested_at?: string | null;
  persisted?: boolean;
}> => {
  const res = await apiFetch('/api/v5/integrations/email-smtp/test', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: payload ? JSON.stringify({
      is_enabled: payload.is_enabled,
      smtp_host: normalizeNullableText(payload.smtp_host),
      smtp_port: payload.smtp_port,
      smtp_encryption: payload.smtp_encryption,
      smtp_username: normalizeNullableText(payload.smtp_username),
      smtp_password: normalizeNullableText(payload.smtp_password),
      test_recipient_email: normalizeNullableText(payload.test_recipient_email),
    }) : undefined,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'TEST_EMAIL_SMTP_INTEGRATION_FAILED'));
  }

  return parseItemJson<{
    message?: string;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
    persisted?: boolean;
  }>(res);
};
```

### 4.3. Query Keys (Bổ sung)

**File:** `frontend/shared/queryKeys.ts`

```typescript
integrationSettings: {
  all: ['integration-settings'] as const,
  backblazeB2: () => ['integration-settings', 'backblaze-b2'] as const,
  googleDrive: () => ['integration-settings', 'google-drive'] as const,
  emailSmtp: () => ['integration-settings', 'email-smtp'] as const,
  contractExpiryAlert: () => ['integration-settings', 'contract-expiry-alert'] as const,
  contractPaymentAlert: () => ['integration-settings', 'contract-payment-alert'] as const,
}
```

### 4.4. Hook (Bổ sung)

**File:** `frontend/hooks/useIntegrationSettings.ts`

```typescript
// React Query hooks
const emailSmtpQuery = useQuery({
  queryKey: queryKeys.integrationSettings.emailSmtp(),
  queryFn: fetchEmailSmtpIntegrationSettings,
  enabled,
});

// Mutations
const saveEmailSmtpMutation = useMutation({
  mutationFn: updateEmailSmtpIntegrationSettings,
  onSuccess: (updated) => {
    queryClient.setQueryData(queryKeys.integrationSettings.emailSmtp(), updated);
    addToast?.('success', 'Thành công', 'Đã lưu cấu hình Email SMTP.');
  },
  onError: (error) => {
    addToast?.('error', 'Lưu cấu hình thất bại', extractErrorMessage(error));
  },
});

const testEmailSmtpMutation = useMutation({
  mutationFn: testEmailSmtpIntegrationSettings,
  onSuccess: (result) => {
    queryClient.setQueryData(
      queryKeys.integrationSettings.emailSmtp(),
      (current: EmailSmtpIntegrationSettings | null | undefined) =>
        current
          ? {
              ...current,
              last_test_status: result.status ?? current.last_test_status,
              last_test_message: result.message ?? current.last_test_message,
              last_tested_at: result.tested_at ?? current.last_tested_at,
            }
          : current ?? null,
    );
    addToast?.('success', 'Kết nối Email SMTP', result.message || 'Kết nối thành công.');
  },
  onError: (error) => {
    addToast?.('error', 'Kiểm tra kết nối thất bại', extractErrorMessage(error));
  },
});
```

### 4.5. Component UI (Bổ sung)

**File:** `frontend/components/IntegrationSettingsPanel.tsx`

#### Tab navigation

```typescript
const NAV_ITEMS: Array<{ value: SettingsGroup; label: string; sub: string; icon: string; iconColor: string }> = [
  { value: 'GOOGLE_DRIVE',           label: 'Google Drive',       sub: 'Lưu trữ tài liệu',      icon: 'cloud',        iconColor: 'text-secondary' },
  { value: 'BACKBLAZE_B2',           label: 'Backblaze B2',       sub: 'Object Storage S3',      icon: 'cloud_upload', iconColor: 'text-secondary' },
  { value: 'EMAIL_SMTP',             label: 'Email SMTP',         sub: 'Gửi email qua SMTP',     icon: 'mail',         iconColor: 'text-primary' },
  { value: 'CONTRACT_EXPIRY_ALERT',  label: 'HĐ hết hiệu lực',   sub: 'Cảnh báo ngày hết HLực', icon: 'event_busy',   iconColor: 'text-tertiary'  },
  { value: 'CONTRACT_PAYMENT_ALERT', label: 'HĐ thanh toán',     sub: 'Cảnh báo kỳ thanh toán', icon: 'payments',     iconColor: 'text-tertiary'  },
];
```

#### State variables

```typescript
// Email SMTP state
const [isSmtpEnabled,        setIsSmtpEnabled]        = useState(false);
const [smtpHost,             setSmtpHost]             = useState('smtp.gmail.com');
const [smtpPort,             setSmtpPort]             = useState('587');
const [smtpEncryption,       setSmtpEncryption]       = useState<'tls'|'ssl'|'none'>('tls');
const [smtpUsername,         setSmtpUsername]         = useState('');
const [smtpPassword,         setSmtpPassword]         = useState('');
const [smtpFromAddress,      setSmtpFromAddress]      = useState('');
const [smtpFromName,         setSmtpFromName]         = useState('VNPT Business');
const [clearSmtpPassword,    setClearSmtpPassword]    = useState(false);
const [testRecipientEmail,   setTestRecipientEmail]   = useState('');

// Displayed test results
const [displayedSmtpTestStatus,  setDisplayedSmtpTestStatus]  = useState<EmailSmtpIntegrationSettings['last_test_status']>(null);
const [displayedSmtpTestMessage, setDisplayedSmtpTestMessage] = useState('');
const [displayedSmtpTestedAt,    setDisplayedSmtpTestedAt]    = useState<string | null>(null);
```

#### Effect để sync với data

```typescript
useEffect(() => {
  setIsSmtpEnabled(Boolean(emailSmtpSettings?.is_enabled));
  setSmtpHost(emailSmtpSettings?.smtp_host || 'smtp.gmail.com');
  setSmtpPort(String(emailSmtpSettings?.smtp_port || 587));
  setSmtpEncryption((emailSmtpSettings?.smtp_encryption as 'tls'|'ssl'|'none') || 'tls');
  setSmtpUsername(emailSmtpSettings?.smtp_username || '');
  setSmtpFromAddress(emailSmtpSettings?.smtp_from_address || '');
  setSmtpFromName(emailSmtpSettings?.smtp_from_name || 'VNPT Business');
  setSmtpPassword('');
  setClearSmtpPassword(false);
  setTestRecipientEmail(emailSmtpSettings?.smtp_username || '');
}, [emailSmtpSettings]);

useEffect(() => {
  setDisplayedSmtpTestStatus(emailSmtpSettings?.last_test_status ?? null);
  setDisplayedSmtpTestMessage(emailSmtpSettings?.last_test_message || '');
  setDisplayedSmtpTestedAt(emailSmtpSettings?.last_tested_at || null);
}, [emailSmtpSettings?.last_test_message, emailSmtpSettings?.last_test_status, emailSmtpSettings?.last_tested_at]);
```

#### UI Tab Email SMTP

```tsx
{/* ════════ EMAIL SMTP ════════ */}
{selectedGroup === 'EMAIL_SMTP' && (
  <>
    {/* Toolbar */}
    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>mail</span>
        <span className="text-xs font-bold text-slate-700">Email SMTP</span>
        <ConnectionBadge status={displayedSmtpTestStatus} />
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => void handleTestEmailSmtp()} disabled={globalBusy}
          className={`${BTN_SM} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
        >
          <span className={`material-symbols-outlined text-sm ${isTestingEmailSmtp ? 'animate-spin' : ''}`}>
            {isTestingEmailSmtp ? 'progress_activity' : 'verified'}
          </span>
          Kiểm tra
        </button>
        <button type="button" onClick={() => void handleSaveEmailSmtp()} disabled={globalBusy}
          className={`${BTN_SM} bg-primary text-white hover:bg-deep-teal shadow-sm`}
        >
          <span className={`material-symbols-outlined text-sm ${isSavingEmailSmtp ? 'animate-spin' : ''}`}>
            {isSavingEmailSmtp ? 'progress_activity' : 'save'}
          </span>
          Lưu cấu hình
        </button>
      </div>
    </div>

    {/* Form body */}
    <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3 flex-1 content-start">
      <ToggleSwitch
        checked={isSmtpEnabled}
        onChange={() => setIsSmtpEnabled((p) => !p)}
        label={isSmtpEnabled ? 'Tích hợp Email SMTP đang bật' : 'Tích hợp Email SMTP đang tắt'}
      />

      <div>
        <label className={LABEL}>SMTP Host</label>
        <input 
          type="text" 
          value={smtpHost}
          onChange={(e) => setSmtpHost(e.target.value)}
          placeholder="smtp.gmail.com" 
          className={INPUT} 
        />
        <p className="text-[10px] text-slate-400 mt-0.5">smtp.gmail.com cho Gmail</p>
      </div>

      <div>
        <label className={LABEL}>SMTP Port</label>
        <select 
          value={smtpPort}
          onChange={(e) => setSmtpPort(e.target.value)}
          className={INPUT}
        >
          <option value="587">587 - TLS (khuyến nghị)</option>
          <option value="465">465 - SSL</option>
          <option value="25">25 - Không mã hóa</option>
        </select>
      </div>

      <div>
        <label className={LABEL}>Mã hóa</label>
        <select
          value={smtpEncryption}
          onChange={(e) => setSmtpEncryption(e.target.value as 'tls'|'ssl'|'none')}
          className={INPUT}
        >
          <option value="tls">TLS</option>
          <option value="ssl">SSL</option>
          <option value="none">Không</option>
        </select>
      </div>

      <div className="col-span-2">
        <label className={LABEL}>Email Gmail (SMTP Username)</label>
        <input 
          type="email" 
          value={smtpUsername}
          onChange={(e) => setSmtpUsername(e.target.value)}
          placeholder="your-email@gmail.com" 
          className={INPUT} 
        />
      </div>

      <div className="col-span-2">
        <label className={LABEL}>App Password (mật khẩu ứng dụng)</label>
        <input 
          type="password" 
          value={smtpPassword}
          onChange={(e) => {
            setSmtpPassword(e.target.value);
            if (normalizeText(e.target.value)) setClearSmtpPassword(false);
          }}
          placeholder="xxxx xxxx xxxx xxxx (16 ký tự)" 
          className={INPUT} 
        />
        <div className="flex items-center gap-4 mt-1">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer">
            <input
              type="checkbox" 
              checked={clearSmtpPassword}
              onChange={(e) => {
                setClearSmtpPassword(e.target.checked);
                if (e.target.checked) setSmtpPassword('');
              }}
              className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/30"
            />
            Xóa mật khẩu đang lưu
          </label>
          <span className="text-[11px] text-slate-400">
            Trạng thái: <strong className="text-slate-600">{emailSmtpSettings?.has_smtp_password ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong>
          </span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Lấy App Password tại đây
          </a>
          {' '}— Không dùng mật khẩu Gmail thông thường
        </p>
      </div>

      <div>
        <label className={LABEL}>Email hiển thị (From)</label>
        <input 
          type="email" 
          value={smtpFromAddress}
          onChange={(e) => setSmtpFromAddress(e.target.value)}
          placeholder="your-email@gmail.com" 
          className={INPUT} 
        />
      </div>

      <div>
        <label className={LABEL}>Tên hiển thị (From)</label>
        <input 
          type="text" 
          value={smtpFromName}
          onChange={(e) => setSmtpFromName(e.target.value)}
          placeholder="VNPT Business" 
          className={INPUT} 
        />
      </div>

      <div className="col-span-2">
        <label className={LABEL}>Email nhận test</label>
        <input 
          type="email" 
          value={testRecipientEmail}
          onChange={(e) => setTestRecipientEmail(e.target.value)}
          placeholder={smtpUsername || "your-email@gmail.com"} 
          className={INPUT} 
        />
        <p className="text-[10px] text-slate-400 mt-0.5">Để trống sẽ gửi đến email SMTP username</p>
      </div>
    </div>

    {/* Footer info strip */}
    <InfoFooter
      source={emailSmtpSettings?.source || 'DEFAULT'}
      testedAt={displayedSmtpTestedAt}
      message={displayedSmtpTestMessage}
    />
  </>
)}
```

---

## 5. Giao diện Tab Email SMTP

```
┌──────────────┬──────────────────────────────────────────────────────────────────┤
│              │                                                                  │
│ NHÓM CẤU HÌNH │  ✉️ Email SMTP  ○ Chưa test               [✓ Kiểm tra] [💾 Lưu] │
│              │                                                                  │
│ ┌──────────┐ │  ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☁️       │ │  │ ⚪ Bật tích hợp Email SMTP đang bật                         │ │
│ │ Google   │ │  ├─────────────────────────────────────────────────────────────┤ │
│ │ Drive    │ │                                                                  │
│ │          │ │  SMTP Host                      SMTP Port                      │ │
│ └──────────┘ │  ┌─────────────────────┐  ┌─────────────────────────────────┐  │ │
│              │  │ smtp.gmail.com      │  │ 587 - TLS (khuyến nghị) ▼      │  │ │
│ ┌──────────┐ │  └─────────────────────┘  └─────────────────────────────────┘  │ │
│ │ 📤       │ │  smtp.gmail.com cho Gmail                                       │ │
│ │ Backblaze│ │                                                                  │
│ │ B2       │ │  Mã hóa                           Email Gmail (SMTP Username)  │ │
│ │          │ │  ┌─────────────────────┐  ┌─────────────────────────────────┐  │ │
│ └──────────┘ │  │ TLS ▼               │  │ your-email@gmail.com            │  │ │
│              │  └─────────────────────┘  └─────────────────────────────────┘  │ │
│ ┌──────────┐ │                                                                  │
│ │ ✉️       │ │  App Password (mật khẩu ứng dụng)                              │ │
│ │ Email    │ │  ┌───────────────────────────────────────────────────────────┐ │ │
│ │ SMTP     │ │  │ •••• •••• •••• •••••                                      │ │ │
│ │ Gửi email│ │  └───────────────────────────────────────────────────────────┘ │ │
│ │ qua SMTP │ │  ☐ Xóa mật khẩu đang lưu   · Trạng thái: Chưa cấu hình       │ │
│ │ ● Chọn   │ │  Lấy App Password tại đây — Không dùng mật khẩu Gmail thông  │ │
│ └──────────┘ │  thường                                                        │ │
│              │                                                                  │
│ ┌──────────┐ │  Email hiển thị (From)            Tên hiển thị (From)         │ │
│ │ 📅       │ │  ┌─────────────────────┐  ┌─────────────────────┐              │ │
│ │ HĐ hết   │ │  │ your-email@gmail.com│  │ VNPT Business       │              │ │
│ │ hiệu lực │ │  └─────────────────────┘  └─────────────────────┘              │ │
│ │          │ │                                                                  │
│ └──────────┘ │  Email nhận test                                               │ │
│              │  ┌───────────────────────────────────────────────────────────┐ │ │
│ ┌──────────┐ │  │ your-email@gmail.com                                      │ │ │
│ │ 💳       │ │  └───────────────────────────────────────────────────────────┘ │ │
│ │ HĐ thanh │ │  Để trống sẽ gửi đến email SMTP username                       │ │
│ │ toán     │ │                                                                  │
│ └──────────┘ │  ┌───────────────────────────────────────────────────────────┐ │
│              │  │ Nguồn: DB  │  Kiểm tra: --  │  Chưa kiểm tra              │ │
│              │  └───────────────────────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────────────────────────┘
```

---

## 6. Luồng dữ liệu Email SMTP

### 6.1. Load settings

```
Frontend (useIntegrationSettings)
  → React Query (fetchEmailSmtpIntegrationSettings)
    → GET /api/v5/integrations/email-smtp
      → IntegrationSettingsController::emailSmtpSettings()
        → IntegrationSettingsDomainService::emailSmtpSettings()
          → EmailSmtpIntegrationService::settings()
            → Đọc DB integration_settings WHERE provider='EMAIL_SMTP'
            → Decrypt smtp_password (nếu có)
            → Return JSON response
```

### 6.2. Update settings

```
Frontend (handleSaveEmailSmtpSettings)
  → React Query (updateEmailSmtpIntegrationSettings)
    → PUT /api/v5/integrations/email-smtp
      → IntegrationSettingsController::updateEmailSmtpSettings()
        → IntegrationSettingsDomainService::updateEmailSmtpSettings()
          → EmailSmtpIntegrationService::updateSettings()
            → Validate input (smtp_host required nếu enabled)
            → Encrypt smtp_password bằng Crypt::encryptString()
            → DB::table('integration_settings')->updateOrInsert()
            → Invalidate query cache
```

### 6.3. Test connection

```
Frontend (handleTestEmailSmtpIntegration)
  → React Query (testEmailSmtpIntegrationSettings)
    → POST /api/v5/integrations/email-smtp/test
      → IntegrationSettingsController::testEmailSmtpSettings()
        → IntegrationSettingsDomainService::testEmailSmtpSettings()
          → EmailSmtpIntegrationService::testSettings()
            → fsockopen() test TCP connection
            → Laravel Mail::raw() gửi email test
            → Save test result to DB
            → Return success/error message
```

---

## 7. Các provider hỗ trợ (Cập nhật)

| Provider | Trạng thái Backend | Trạng thái UI | Ghi chú |
|----------|-------------------|---------------|---------|
| `GOOGLE_DRIVE` | ✅ | ✅ | Lưu trữ tài liệu |
| `BACKBLAZE_B2` | ✅ | ✅ | Object Storage S3 |
| `EMAIL_SMTP` | ✅ | ✅ MỚI | Gửi email qua SMTP |
| `CONTRACT_ALERT` | ✅ | ✅ | Cảnh báo HĐ hết hạn |
| `CONTRACT_PAYMENT_ALERT` | ✅ | ✅ | Cảnh báo thanh toán |
| `CONTRACT_RENEWAL_SETTINGS` | ✅ | ❌ | Chưa có UI |

---

## 8. Hướng dẫn lấy App Password từ Gmail

Để sử dụng Gmail làm SMTP server, cần tạo **App Password** (không dùng mật khẩu thông thường):

### Bước 1: Bật xác thực 2 yếu tố (2FA)

1. Truy cập: https://myaccount.google.com/security
2. Chọn **2-Step Verification**
3. Bật 2FA nếu chưa bật

### Bước 2: Tạo App Password

1. Truy cập: https://myaccount.google.com/apppasswords
2. Chọn **App**: Mail
3. Chọn **Device**: Other (Custom name)
4. Nhập tên: `VNPT Business`
5. Click **Generate**
6. Copy mật khẩu 16 ký tự (dạng: `xxxx xxxx xxxx xxxx`)

### Bước 3: Nhập vào form cấu hình

1. **SMTP Host**: `smtp.gmail.com`
2. **SMTP Port**: `587`
3. **Mã hóa**: `TLS`
4. **Email Gmail**: `your-email@gmail.com`
5. **App Password**: Dán mật khẩu 16 ký tự (không khoảng trắng)
6. **Email hiển thị**: `your-email@gmail.com`
7. **Tên hiển thị**: `VNPT Business`
8. Click **Kiểm tra** để test kết nối

---

## 9. Hàm gửi email để reuse

Sau khi cấu hình SMTP, các chức năng khác có thể gửi email bằng cách:

### Cách 1: Sử dụng Laravel Facade (Backend)

```php
use Illuminate\Support\Facades\Mail;

Mail::send(
    'emails.template-name',  // Blade template
    ['data' => $data],       // Dữ liệu truyền vào template
    function ($message) use ($to, $subject) {
        $message->to($to)
                ->subject($subject)
                ->from(
                    config('mail.mailers.smtp.username'),
                    config('mail.from.name')
                );
    }
);
```

### Cách 2: Sử dụng Mailable class (Backend)

```php
// Tạo Mailable class
php artisan make:mail CustomerRequestNotification

// Sử dụng
use App\Mail\CustomerRequestNotification;
use Illuminate\Support\Facades\Mail;

Mail::to($recipient)->send(new CustomerRequestNotification($data));
```

### Cách 3: Helper function trong service

```php
// backend/app/Services/V5/Email/EmailNotificationService.php
class EmailNotificationService
{
    public function sendEmail(
        string $to,
        string $subject,
        string $body,
        ?string $fromAddress = null,
        ?string $fromName = null
    ): bool {
        // Load SMTP config từ DB
        $smtpSettings = $this->loadSmtpSettings();
        
        if (! $smtpSettings['is_enabled']) {
            return false;
        }
        
        // Temporary override config
        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp', [
            'transport' => 'smtp',
            'host' => $smtpSettings['smtp_host'],
            'port' => $smtpSettings['smtp_port'],
            'username' => $smtpSettings['smtp_username'],
            'password' => $this->decrypt($smtpSettings['smtp_password']),
            'encryption' => $smtpSettings['smtp_encryption'],
        ]);
        
        // Send email
        Mail::raw($body, function ($message) use ($to, $subject, $fromAddress, $fromName) {
            $message->to($to)
                    ->subject($subject)
                    ->from($fromAddress, $fromName);
        });
        
        return true;
    }
}
```

---

## 10. File cần tạo/sửa để implement

### Backend

| File | Hành động | Nội dung |
|------|----------|----------|
| `routes/api.php` | Thêm routes | 3 routes email-smtp |
| `IntegrationSettingsController.php` | Thêm methods | `emailSmtpSettings()`, `updateEmailSmtpSettings()`, `testEmailSmtpSettings()` |
| `IntegrationSettingsDomainService.php` | Thêm methods | Delegate sang EmailSmtpIntegrationService |
| `EmailSmtpIntegrationService.php` | Đã có | Kiểm tra lại validation |

### Frontend

| File | Hành động | Nội dung |
|------|----------|----------|
| `types/admin.ts` | Thêm types | `EmailSmtpIntegrationSettings`, `EmailSmtpIntegrationSettingsUpdatePayload` |
| `services/api/adminApi.ts` | Thêm functions | `fetchEmailSmtpIntegrationSettings()`, `updateEmailSmtpIntegrationSettings()`, `testEmailSmtpIntegrationSettings()` |
| `shared/queryKeys.ts` | Thêm query key | `emailSmtp: () => ['integration-settings', 'email-smtp']` |
| `hooks/useIntegrationSettings.ts` | Thêm logic | Query, mutations, handlers |
| `components/IntegrationSettingsPanel.tsx` | Thêm UI | Tab EMAIL_SMTP, state variables, effect |
| `router/routes.tsx` | Kiểm tra | Đảm bảo route `/integration-settings` đã có |

---

## 11. Test checklist

- [ ] Load tab Email SMTP hiển thị đúng form
- [ ] Lưu cấu hình SMTP thành công
- [ ] Test connection gửi email thành công
- [ ] Hiển thị trạng thái kết nối (SUCCESS/FAILED)
- [ ] Mật khẩu được mã hóa trong DB
- [ ] Toggle bật/tắt hoạt động đúng
- [ ] Form validation khi thiếu trường bắt buộc
- [ ] Reset test status khi cấu hình thay đổi
