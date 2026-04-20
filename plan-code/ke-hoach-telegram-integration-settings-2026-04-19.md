# Kế hoạch triển khai Telegram trong Integration Settings

## Context
Cần bổ sung cấu hình Telegram Bot trong trang Integration Settings để vận hành thông báo tập trung: bật/tắt tích hợp, lưu bot username, lưu bot token an toàn (secret), test kết nối bằng Telegram `getMe`, và chỉnh sửa trực tiếp chat ID Telegram cho từng nhân sự ngay trong cùng tab.

Kết quả mong muốn: quản trị viên cấu hình + kiểm tra Telegram tại một nơi; token không bao giờ lộ plaintext; chat ID của user được cập nhật/persist qua API nhân sự hiện có.

## Recommended approach

### 1) Backend — Telegram integration settings (provider mới trong `integration_settings`)
1. Tạo migration thêm cột Telegram vào `integration_settings` (guard `hasTable/hasColumn` theo pattern hiện tại):
   - `telegram_enabled` (boolean)
   - `telegram_bot_username` (nullable string)
   - `telegram_bot_token_encrypted` (nullable text)
   - `telegram_last_test_status` (nullable string)
   - `telegram_last_test_message` (nullable text)
   - `telegram_last_test_at` (nullable datetime)
2. Tạo `TelegramIntegrationService` theo pattern của Backblaze/SMTP:
   - `settings()`: trả về `enabled`, `bot_username`, `has_bot_token`, `token_preview`, thông tin test gần nhất.
   - `updateSettings()`: validate payload, mã hóa token bằng `Crypt::encryptString`, hỗ trợ clear token qua cờ xóa.
   - `testSettings()`: gọi `https://api.telegram.org/bot{token}/getMe`, chuẩn hóa lỗi/response, lưu kết quả test vào DB.
3. Mở rộng domain/controller/routes:
   - `IntegrationSettingsDomainService`: inject + expose Telegram methods.
   - `IntegrationSettingsController`: thêm `telegramSettings`, `updateTelegramSettings`, `testTelegramSettings`.
   - `backend/routes/api.php`: thêm GET/PUT/POST `/integrations/telegram` với `permission:authz.manage`.

### 2) Backend — lưu chat ID Telegram cho nhân sự
1. Tạo migration thêm cột `telechatbot` (nullable string) vào `internal_users`.
2. Cập nhật model/request/service để field đi xuyên suốt CRUD:
   - `InternalUser::$fillable`
   - `StoreEmployeeRequest` / `UpdateEmployeeRequest` rules
   - `EmployeeDomainService` (index select, store/update mapping, sanitize import payload, serialize output)
3. Giữ quyền cập nhật theo endpoint nhân sự hiện tại (`permission:employees.write`).

### 3) Frontend — API/types/UI cho Telegram tab + chỉnh chat ID trực tiếp
1. Thêm kiểu dữ liệu Telegram settings:
   - `frontend/types/admin.ts`
   - nếu cần, cập nhật export liên quan trong `frontend/types.ts`
2. Thêm API client Telegram trong `frontend/services/api/adminApi.ts`:
   - fetch/update/test Telegram settings
   - normalize dữ liệu `has_bot_token/token_preview` tương tự provider hiện có
3. Mở rộng employee type + payload:
   - `frontend/types/employee.ts`: thêm `telechatbot?: string | null`
   - `frontend/services/api/employeeApi.ts`: include `telechatbot` trong request payload builder
4. Mở rộng giao diện Integration Settings:
   - `frontend/components/IntegrationSettingsPanel.tsx`
     - thêm nav item/group `TELEGRAM`
     - form fields: `enabled`, `bot username`, `bot token` (masked + trạng thái đã lưu)
     - nút “Kiểm tra kết nối” dùng API test `getMe`
     - danh sách internal users và input chat ID, lưu trực tiếp từng dòng
5. Wire vào app shell:
   - `frontend/App.tsx`: thêm state/load/save/test Telegram; cập nhật `refreshIntegrationSettings`
   - `frontend/AppPages.tsx`: truyền props/handlers mới vào `IntegrationSettingsPanel`

## Reuse existing patterns/utilities
- Secret handling + persisted test result:
  - `backend/app/Services/V5/IntegrationSettings/BackblazeB2IntegrationService.php`
  - `backend/app/Services/V5/IntegrationSettings/EmailSmtpIntegrationService.php`
- Integration API client normalization:
  - `frontend/services/api/adminApi.ts`
- Employee CRUD payload/normalization:
  - `frontend/services/api/employeeApi.ts`
  - `backend/app/Services/V5/Domain/EmployeeDomainService.php`

## Critical files to modify
- `backend/routes/api.php`
- `backend/app/Http/Controllers/Api/V5/IntegrationSettingsController.php`
- `backend/app/Services/V5/Domain/IntegrationSettingsDomainService.php`
- `backend/app/Services/V5/IntegrationSettings/TelegramIntegrationService.php` (new)
- `backend/app/Models/InternalUser.php`
- `backend/app/Http/Requests/V5/StoreEmployeeRequest.php`
- `backend/app/Http/Requests/V5/UpdateEmployeeRequest.php`
- `backend/app/Services/V5/Domain/EmployeeDomainService.php`
- `backend/database/migrations/*add_telegram_settings_to_integration_settings*.php` (new)
- `backend/database/migrations/*add_telechatbot_to_internal_users*.php` (new)
- `backend/tests/Feature/IntegrationSettingsExtractionTest.php`
- `backend/tests/Feature/EmployeeCrudTest.php`
- `frontend/components/IntegrationSettingsPanel.tsx`
- `frontend/App.tsx`
- `frontend/AppPages.tsx`
- `frontend/services/api/adminApi.ts`
- `frontend/services/api/employeeApi.ts`
- `frontend/types/admin.ts`
- `frontend/types/employee.ts`
- `frontend/__tests__/adminApi.module.test.ts`
- `frontend/__tests__/integrationSettingsInitialLoad.ui.test.tsx`

## Verification

### A. Graph impact safety (trước khi sửa symbol)
- Chạy GitNexus impact analysis cho từng symbol chuẩn bị chỉnh sửa và xử lý toàn bộ dependent d=1 trước khi commit.
- Cảnh báo ngay nếu risk HIGH/CRITICAL trước khi tiếp tục.

### B. Database patch execution (bắt buộc trước khi test)
- Dùng cấu hình database trong `thongtinmoi.txt` để chạy patch SQL.
- Theo thông tin hiện tại trong file đó:
  - host: `localhost`
  - port: `3306`
  - username: `root`
  - password: `root`
  - database: `vnpt_business_db`
- Lệnh chạy patch:
  - `mysql -h localhost -P 3306 -u root -proot vnpt_business_db --default-character-set=utf8mb4 < database/sql-patches/2026-04-19_01_add_telegram_integration_and_employee_telechatbot.sql`

### C. Automated tests
1. Backend:
   - `cd backend && php artisan test --filter=IntegrationSettingsExtractionTest`
   - `cd backend && php artisan test --filter=EmployeeCrudTest`
2. Frontend:
   - `cd frontend && npx vitest run __tests__/adminApi.module.test.ts`
   - `cd frontend && npx vitest run __tests__/integrationSettingsInitialLoad.ui.test.tsx`

### D. Manual end-to-end
1. Chạy backend + frontend dev servers.
2. Mở `/integration-settings` → tab Telegram.
3. Lưu `enabled + bot username + bot token` thành công.
4. Reload trang: token không hiện plaintext, chỉ trạng thái/token preview.
5. Bấm test kết nối: xác nhận luồng `getMe` success/fail hiển thị đúng.
6. Sửa `telechatbot` trực tiếp trên từng user trong tab, lưu và reload xác nhận dữ liệu persisted.

### E. Pre-commit scope check
- Chạy GitNexus detect-changes để xác nhận phạm vi thay đổi đúng như kế hoạch, không lan ngoài scope Telegram + employee chat ID.

## ASCII mockup giao diện (Telegram tab)

```text
+==================================================================================================+
| CÀI ĐẶT TÍCH HỢP                                                                                |
+==============================+===================================================================+
| Nhóm tích hợp                | Telegram Bot                                                      |
|------------------------------|-------------------------------------------------------------------|
|  Google Drive                | [A] Cấu hình Bot                                                  |
|  Backblaze B2                |  Bật tích hợp:            [x]                                     |
|  Email SMTP                  |  Bot username:            [ @vnpt_notify_bot                 ]    |
|  Cảnh báo HĐ sắp hết hạn     |  Bot token:               [ ******************************** ]    |
|  Cảnh báo thanh toán HĐ      |  Trạng thái token:         Đã lưu token                           |
| > Telegram Bot               |                                                                   |
|                              |  [Lưu cấu hình] [Xóa token] [Kiểm tra kết nối getMe]             |
|                              |  Kết quả test:             Thành công (bot: VNPT Notify Bot)      |
|                              |  Lần test gần nhất:         19/04/2026 10:35                      |
|                              |-------------------------------------------------------------------|
|                              | [B] Gán Telegram Chat ID cho nhân sự                              |
|                              |  Tìm kiếm: [ tên/mã nhân sự.................... ] [Lọc PB v]      |
|                              |                                                                   |
|                              |  STT | Mã NV   | Họ tên            | Username | Telegram Chat ID  |
|                              |  ----+---------+-------------------+----------+-------------------|
|                              |   1  | NV0001  | Nguyễn Văn A      | nva      | [ 123456789 ] [Lưu]|
|                              |   2  | NV0002  | Trần Thị B        | ttb      | [ -987654321] [Lưu]|
|                              |   3  | NV0003  | Lê Văn C          | lvc      | [           ] [Lưu]|
|                              |                                                                   |
|                              |  [Lưu tất cả thay đổi]                              Trang 1 / 12  |
+==============================+===================================================================+
```

### Ghi chú UX
- Bot token chỉ hiển thị masked + cờ `Đã lưu token`, không trả plaintext từ API.
- Nút test gọi `getMe` và hiển thị trạng thái/lần test gần nhất ngay trong tab.
- Chat ID hỗ trợ lưu từng dòng hoặc lưu hàng loạt tùy thao tác người dùng.
