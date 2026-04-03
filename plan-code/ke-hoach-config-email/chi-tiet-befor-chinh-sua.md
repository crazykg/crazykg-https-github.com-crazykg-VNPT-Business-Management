# Phân tích chức năng Integration Settings

**URL:** `http://localhost:5174/integration-settings`

**Ngày phân tích:** 2026-04-02

---

## 1. Tổng quan chức năng

Trang **Cấu hình tích hợp** cho phép quản lý các tích hợp hệ thống và ngưỡng cảnh báo:

| Nhóm cấu hình | Mô tả | Icon |
|--------------|-------|------|
| **Google Drive** | Lưu trữ tài liệu | cloud |
| **Backblaze B2** | Object Storage S3 | cloud_upload |
| **HĐ hết hiệu lực** | Cảnh báo ngày hết hiệu lực hợp đồng | event_busy |
| **HĐ thanh toán** | Cảnh báo kỳ thanh toán hợp đồng | payments |

---

## 2. Database

### 2.1. Bảng `integration_settings`

**Migration khởi tạo:** `2026_02_25_213000_create_integration_settings_table.php`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | bigint | Primary key |
| `provider` | string(100) | UNIQUE - Tên nhà cung cấp (GOOGLE_DRIVE, BACKBLAZE_B2, CONTRACT_ALERT, CONTRACT_PAYMENT_ALERT, EMAIL_SMTP, CONTRACT_RENEWAL_SETTINGS) |
| `is_enabled` | boolean | Trạng thái bật/tắt |
| `account_email` | string(255) | Email tài khoản dịch vụ |
| `folder_id` | string(255) | Folder ID (Google Drive) |
| `scopes` | string(500) | API scopes |
| `impersonate_user` | string(255) | User để impersonate |
| `file_prefix` | string(100) | Tiền tố file |
| `service_account_json` | longText | Service Account JSON (encrypted) |
| `smtp_host` | string(255) | SMTP host |
| `smtp_port` | integer | SMTP port |
| `smtp_encryption` | string | tls/ssl/none |
| `smtp_username` | string(255) | SMTP username |
| `smtp_password` | text | SMTP password (encrypted) |
| `smtp_from_address` | string(255) | SMTP from address |
| `smtp_from_name` | string(255) | SMTP from name |
| `access_key_id` | string(255) | Backblaze Access Key ID |
| `secret_access_key` | text | Backblaze Secret Access Key (encrypted) |
| `bucket_id` | string(255) | Backblaze Bucket ID |
| `bucket_name` | string(255) | Backblaze Bucket name |
| `region` | string(255) | Backblaze Region |
| `contract_expiry_warning_days` | integer | Số ngày cảnh báo HĐ hết hạn |
| `contract_payment_warning_days` | integer | Số ngày cảnh báo thanh toán |
| `contract_renewal_grace_days` | integer | Số ngày ân hạn gia hạn |
| `contract_renewal_penalty_rate` | decimal | Phí phạt mỗi ngày |
| `contract_renewal_max_penalty_rate` | decimal | Phí phạt tối đa |
| `contract_renewal_max_chain_depth` | integer | Độ sâu chuỗi gia hạn tối đa |
| `last_tested_at` | timestamp | Thời điểm kiểm tra cuối |
| `last_test_status` | string(20) | Trạng thái kiểm tra (SUCCESS/FAILED) |
| `last_test_message` | string(500) | Thông báo kiểm tra |
| `created_by` | bigint | Người tạo |
| `updated_by` | bigint | Người cập nhật |
| `created_at` | timestamp | Thời gian tạo |
| `updated_at` | timestamp | Thời gian cập nhật |

### 2.2. Dữ liệu mặc định

Migration khởi tạo tạo bản ghi mặc định:

```php
DB::table('integration_settings')->updateOrInsert(
    ['provider' => 'GOOGLE_DRIVE'],
    [
        'is_enabled' => 0,
        'account_email' => 'vnpthishg@gmail.com',
        'scopes' => 'https://www.googleapis.com/auth/drive.file',
        'file_prefix' => 'VNPT',
    ]
);
```

### 2.3. Các migration bổ sung

| Migration | Cột thêm |
|-----------|----------|
| `2026_02_27_193000_add_contract_expiry_warning_days_to_integration_settings.php` | `contract_expiry_warning_days` |
| `2026_02_27_200000_add_contract_payment_warning_days_to_integration_settings.php` | `contract_payment_warning_days` |
| `2026_03_09_103000_add_backblaze_b2_fields_to_integration_settings.php` | `access_key_id`, `secret_access_key`, `bucket_name`, `region`, `endpoint` |
| `2026_03_09_194500_add_bucket_id_to_backblaze_b2_integration_settings.php` | `bucket_id` |
| `2026_03_23_000001_add_email_smtp_settings_to_integration_settings.php` | `smtp_host`, `smtp_port`, `smtp_encryption`, `smtp_username`, `smtp_password`, `smtp_from_address`, `smtp_from_name` |
| `2026_03_23_150200_add_renewal_settings_to_integration_settings.php` | `contract_renewal_grace_days`, `contract_renewal_penalty_rate`, `contract_renewal_max_penalty_rate`, `contract_renewal_max_chain_depth` |

---

## 3. Backend

### 3.1. Routes

**File:** `backend/routes/api.php` và `backend/routes/api/admin.php`

```php
// Google Drive
Route::get('/integrations/google-drive', [IntegrationSettingsController::class, 'googleDriveSettings']);
Route::put('/integrations/google-drive', [IntegrationSettingsController::class, 'updateGoogleDriveSettings']);
Route::post('/integrations/google-drive/test', [IntegrationSettingsController::class, 'testGoogleDriveSettings']);

// Backblaze B2
Route::get('/integrations/backblaze-b2', [IntegrationSettingsController::class, 'backblazeSettings']);
Route::put('/integrations/backblaze-b2', [IntegrationSettingsController::class, 'updateBackblazeSettings']);
Route::post('/integrations/backblaze-b2/test', [IntegrationSettingsController::class, 'testBackblazeSettings']);

// Contract Expiry Alert
Route::get('/utilities/contract-expiry-alert', [IntegrationSettingsController::class, 'contractExpiryAlertSettings']);
Route::put('/utilities/contract-expiry-alert', [IntegrationSettingsController::class, 'updateContractExpiryAlertSettings']);

// Contract Payment Alert
Route::get('/utilities/contract-payment-alert', [IntegrationSettingsController::class, 'contractPaymentAlertSettings']);
Route::put('/utilities/contract-payment-alert', [IntegrationSettingsController::class, 'updateContractPaymentAlertSettings']);
```

### 3.2. Controllers

**File:** `backend/app/Http/Controllers/Api/V5/IntegrationSettingsController.php`

Controller delegating tất cả logic vào `IntegrationSettingsDomainService`.

### 3.3. Services

#### 3.3.1. Domain Service

**File:** `backend/app/Services/V5/Domain/IntegrationSettingsDomainService.php`

Điều phối các service con:
- `BackblazeB2IntegrationService`
- `GoogleDriveIntegrationService`
- `IntegrationSettingsOperationsService`
- `ContractRenewalService`

#### 3.3.2. Google Drive Integration

**File:** `backend/app/Services/V5/IntegrationSettings/GoogleDriveIntegrationService.php`

**Chức năng:**
- `settings()` - Lấy cấu hình Google Drive
- `updateSettings(Request)` - Cập nhật cấu hình
- `testSettings(Request)` - Kiểm tra kết nối

**Logic đặc biệt:**
- Hỗ trợ读取 cấu hình từ DB hoặc ENV
- Mã hóa `service_account_json` bằng `Crypt::encryptString()`
- Validate JWT service account (client_email, private_key, token_uri)
- Test connection bằng OAuth2 JWT flow
- Verify upload capability bằng cách tạo và xóa file test

#### 3.3.3. Backblaze B2 Integration

**File:** `backend/app/Services/V5/IntegrationSettings/BackblazeB2IntegrationService.php`

**Chức năng:**
- `settings()` - Lấy cấu hình Backblaze B2
- `updateSettings(Request)` - Cập nhật cấu hình
- `testSettings(Request)` - Kiểm tra kết nối S3

#### 3.3.4. Email SMTP Integration

**File:** `backend/app/Services/V5/IntegrationSettings/EmailSmtpIntegrationService.php`

**Chức năng:**
- `settings()` - Lấy cấu hình SMTP
- `updateSettings(Request)` - Cập nhật cấu hình
- `testSettings(Request)` - Kiểm tra kết nối SMTP

**Logic test connection:**
1. Test TCP connection với `fsockopen()`
2. Nếu có credentials, test authentication qua Laravel Mail
3. Gửi email test đến recipient

#### 3.3.5. Operations Service

**File:** `backend/app/Services/V5/IntegrationSettings/IntegrationSettingsOperationsService.php`

Xử lý các chức năng:
- `contractExpiryAlertSettings()` / `updateContractExpiryAlertSettings()`
- `contractPaymentAlertSettings()` / `updateContractPaymentAlertSettings()`
- `contractRenewalSettings()` / `updateContractRenewalSettings()`
- `reminders()` - Danh sách reminders
- `userDeptHistory()` - Lịch sử chuyển phòng ban

---

## 4. Frontend

### 4.1. Component chính

**File:** `frontend/components/IntegrationSettingsPanel.tsx`

**State management:**
- 4 tabs: GOOGLE_DRIVE, BACKBLAZE_B2, CONTRACT_EXPIRY_ALERT, CONTRACT_PAYMENT_ALERT
- Local state cho form inputs
- Optimistic updates cho test results

**UI Components:**
- `ToggleSwitch` - Bật/tắt tích hợp
- `ConnectionBadge` - Hiển thị trạng thái kết nối
- `InfoFooter` - Footer hiển thị nguồn cấu hình, thời gian test, message

### 4.2. Hook

**File:** `frontend/hooks/useIntegrationSettings.ts`

**React Query hooks:**
- `fetchBackblazeB2IntegrationSettings`
- `fetchGoogleDriveIntegrationSettings`
- `fetchContractExpiryAlertSettings`
- `fetchContractPaymentAlertSettings`

**Mutations:**
- `updateBackblazeB2IntegrationSettings`
- `updateGoogleDriveIntegrationSettings`
- `updateContractExpiryAlertSettings`
- `updateContractPaymentAlertSettings`
- `testBackblazeB2IntegrationSettings`
- `testGoogleDriveIntegrationSettings`

### 4.3. Types

**File:** `frontend/types/admin.ts`

```typescript
interface GoogleDriveIntegrationSettings {
  provider: 'GOOGLE_DRIVE';
  is_enabled: boolean;
  account_email?: string | null;
  folder_id?: string | null;
  scopes?: string | null;
  impersonate_user?: string | null;
  file_prefix?: string | null;
  has_service_account_json: boolean;
  source?: 'DB' | 'ENV';
  last_tested_at?: string | null;
  last_test_status?: 'SUCCESS' | 'FAILED' | null;
  last_test_message?: string | null;
  updated_at?: string | null;
}

interface BackblazeB2IntegrationSettings {
  provider: 'BACKBLAZE_B2';
  is_enabled: boolean;
  access_key_id?: string | null;
  bucket_id?: string | null;
  bucket_name?: string | null;
  region?: string | null;
  endpoint?: string | null;
  file_prefix?: string | null;
  has_secret_access_key: boolean;
  secret_access_key_preview?: string | null;
  source?: 'DB' | 'ENV';
  last_tested_at?: string | null;
  last_test_status?: 'SUCCESS' | 'FAILED' | null;
  last_test_message?: string | null;
  updated_at?: string | null;
}

interface ContractExpiryAlertSettings {
  provider: 'CONTRACT_ALERT';
  warning_days: number;
  source?: 'DB' | 'DEFAULT';
  updated_at?: string | null;
}

interface ContractPaymentAlertSettings {
  provider: 'CONTRACT_PAYMENT_ALERT';
  warning_days: number;
  source?: 'DB' | 'DEFAULT';
  updated_at?: string | null;
}
```

### 4.4. API Services

**File:** `frontend/services/api/adminApi.ts`

Các functions:
- `fetchGoogleDriveIntegrationSettings()`
- `updateGoogleDriveIntegrationSettings(payload)`
- `testGoogleDriveIntegrationSettings(payload)`
- `fetchBackblazeB2IntegrationSettings()`
- `updateBackblazeB2IntegrationSettings(payload)`
- `testBackblazeB2IntegrationSettings(payload)`
- `fetchContractExpiryAlertSettings()`
- `updateContractExpiryAlertSettings(payload)`
- `fetchContractPaymentAlertSettings()`
- `updateContractPaymentAlertSettings(payload)`

### 4.5. Query Keys

**File:** `frontend/shared/queryKeys.ts`

```typescript
integrationSettings: {
  all: ['integration-settings'] as const,
  backblazeB2: () => ['integration-settings', 'backblaze-b2'] as const,
  googleDrive: () => ['integration-settings', 'google-drive'] as const,
  contractExpiryAlert: () => ['integration-settings', 'contract-expiry-alert'] as const,
  contractPaymentAlert: () => ['integration-settings', 'contract-payment-alert'] as const,
}
```

---

## 5. Luồng dữ liệu

### 5.1. Load settings

```
Frontend (useIntegrationSettings)
  → React Query (fetchGoogleDriveIntegrationSettings)
    → GET /api/v5/integrations/google-drive
      → IntegrationSettingsController::googleDriveSettings()
        → IntegrationSettingsDomainService::googleDriveSettings()
          → GoogleDriveIntegrationService::settings()
            → Đọc DB integration_settings WHERE provider='GOOGLE_DRIVE'
            → Decrypt service_account_json
            → Return JSON response
```

### 5.2. Update settings

```
Frontend (handleSaveGoogleDriveSettings)
  → React Query (updateGoogleDriveIntegrationSettings)
    → PUT /api/v5/integrations/google-drive
      → IntegrationSettingsController::updateGoogleDriveSettings()
        → IntegrationSettingsDomainService::updateGoogleDriveSettings()
          → GoogleDriveIntegrationService::updateSettings()
            → Validate input
            → Encrypt service_account_json
            → DB::table('integration_settings')->updateOrInsert()
            → Invalidate query cache
```

### 5.3. Test connection

```
Frontend (handleTestGoogleDriveIntegration)
  → React Query (testGoogleDriveIntegrationSettings)
    → POST /api/v5/integrations/google-drive/test
      → IntegrationSettingsController::testGoogleDriveSettings()
        → IntegrationSettingsDomainService::testGoogleDriveSettings()
          → GoogleDriveIntegrationService::testSettings()
            → Build JWT từ service account
            → Request access token từ Google OAuth2
            → GET /drive/v3/about (verify connection)
            → Upload test file → Delete test file
            → Save test result to DB
```

---

## 6. Các provider hỗ trợ

| Provider | Trạng thái | Ghi chú |
|----------|-----------|---------|
| `GOOGLE_DRIVE` | ✅ Đã implement | Lưu trữ tài liệu |
| `BACKBLAZE_B2` | ✅ Đã implement | Object Storage S3 |
| `CONTRACT_ALERT` | ✅ Đã implement | Cảnh báo HĐ hết hạn |
| `CONTRACT_PAYMENT_ALERT` | ✅ Đã implement | Cảnh báo thanh toán |
| `EMAIL_SMTP` | ✅ Đã implement | Chưa có UI |
| `CONTRACT_RENEWAL_SETTINGS` | ✅ Đã implement | Chưa có UI |

---

## 7. Ghi chú bảo mật

1. **Credentials encryption:**
   - `service_account_json` (Google Drive) - encrypted bằng `Crypt::encryptString()`
   - `secret_access_key` (Backblaze B2) - encrypted
   - `smtp_password` (Email SMTP) - encrypted

2. **Clear credentials pattern:**
   - Frontend gửi `clear_service_account_json: true` để xóa credentials
   - Backend set column = NULL khi flag được set

3. **Test results:**
   - Lưu `last_tested_at`, `last_test_status`, `last_test_message` vào DB
   - Reset khi cấu hình thay đổi

---

## 8. Email SMTP - Chưa có UI

**Backend đã hoàn thiện:**
- `EmailSmtpIntegrationService.php` với đầy đủ CRUD + test
- Migration `2026_03_23_000001_add_email_smtp_settings_to_integration_settings.php`
- Routes chưa được đăng ký công khai

**Frontend cần thêm:**
1. Type definitions trong `types/admin.ts`
2. API functions trong `adminApi.ts`
3. Query keys trong `queryKeys.ts`
4. Hook `useEmailSmtpSettings`
5. Tab UI trong `IntegrationSettingsPanel.tsx`
6. Route trong `router/routes.tsx`

---

## 9. Kết luận

Chức năng `integration-settings` hiện tại đã hoàn chỉnh cho 4 tab UI. Backend đã hỗ trợ sẵn EMAIL_SMTP và CONTRACT_RENEWAL_SETTINGS nhưng chưa có UI tương ứng.

Để bổ sung cấu hình Email SMTP, cần:
1. Thêm type definitions
2. Thêm API service layer
3. Thêm hook React Query
4. Thêm tab UI trong panel
5. Đăng ký routes nếu chưa có
