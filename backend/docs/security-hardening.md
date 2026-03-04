# Security Hardening Checklist (SEC-C + SEC-H)

## 1) Runtime Environment (staging/production)
- Set `APP_ENV=production`.
- Set `APP_DEBUG=false`.
- Set `LOG_LEVEL=warning` (or `error`).
- Never deploy runtime `.env` from git.

## 2) Database Credentials
- Do not run app with MySQL `root`.
- Create dedicated app user (example `app_rw`) with least privilege on `vnpt_business_db`.
- Rotate DB password and store it in secret manager.

Example grant (adjust for environment):

```sql
CREATE USER 'app_rw'@'%' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON `vnpt_business_db`.* TO 'app_rw'@'%';
FLUSH PRIVILEGES;
```

## 3) Authentication & Session
- Single active session per user:
  - Login mới sẽ revoke toàn bộ token cũ trước khi phát token mới.
- Token lifecycle:
  - Access token: `60` phút (`SANCTUM_EXPIRATION`).
  - Refresh token riêng: mặc định `7` ngày (`VNPT_AUTH_REFRESH_COOKIE_MINUTES=10080`).
  - Refresh token one-time (rotation): `/api/v5/auth/refresh`.
- Cookie defaults:
  - Access cookie: `VNPT_AUTH_ACCESS_COOKIE_NAME`.
  - Refresh cookie: `VNPT_AUTH_REFRESH_COOKIE_NAME`.

## 4) Password Policy
- New/reset employee accounts receive one-time temporary password from API response.
- `must_change_password=1` is enforced by backend middleware.
- User must call `POST /api/v5/auth/change-password` before using business APIs.

## 5) Legacy Default-Hash Accounts
- Accounts using known default bcrypt hash are rotated by migration.
- Those accounts are set to `INACTIVE` + `must_change_password=1`.
- Admin must reset password and reactivate account intentionally.

## 6) File Storage Security
- File upload local mới dùng private disk (`local`) + signed URL TTL ngắn.
- Endpoint tải file private:
  - `GET /api/v5/documents/attachments/{id}/download` (signed URL)
  - `GET /api/v5/documents/attachments/temp-download` (signed URL)
- File legacy public vẫn tương thích, không bắt buộc backfill ngay.

## 7) API Protection
- Security headers middleware bật toàn cục API:
  - `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  - `Permissions-Policy`, `Content-Security-Policy`,
  - `Strict-Transport-Security` (khi HTTPS).
- Global request size guard:
  - `API_MAX_BODY_KB=25600` mặc định (25MB).
- Rate limit:
  - `auth.login`: 5/min
  - `auth.refresh`: 10/min
  - `api.write`: 30/min
  - `api.write.heavy`: 10/min

## 8) Soft Delete Consistency (Phase 1)
- Added `deleted_at` (và index) cho:
  - `departments`, `customers`, `vendors`, `products`, `customer_personnel`, `documents`.
- Bật SoftDeletes ở models:
  - `Project`, `Contract`, `ProjectItem` (+ các model ưu tiên khác có `deleted_at`).
- Read/list mặc định loại trừ dữ liệu đã xóa mềm.

## 9) Audit Log Masking
- Trước khi ghi `audit_logs.old_values/new_values`, hệ thống sẽ mask key nhạy cảm:
  - `password`, `token`, `secret`, `api_key`, `service_account_json`, ...
- Cấu hình tại `config/audit.php`.

## 10) Post-deploy verification
- Trigger a controlled 500 on API and confirm no stacktrace or env leakage.
- Verify app DB connection user is not `root`.
- Verify login/refresh:
  - login lần 2 invalidate session cũ.
  - access token hết hạn được refresh đúng flow.
- Verify file security:
  - file local mới không truy cập được qua URL public `/storage/...`
  - signed URL hết hạn trả lỗi.
- Verify `hasPermission(user, '')` no longer bypasses permission check.
