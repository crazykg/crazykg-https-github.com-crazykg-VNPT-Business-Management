# Kế hoạch Public API — VNPT Business Management
**Ngày:** 2026-03-01
**Mục tiêu:** Cung cấp API cho hệ thống bên ngoài (App mobile, Web đối tác)
**Yêu cầu:** Tốc độ, Bảo mật, An toàn dữ liệu

---

## Context — Hiện trạng hệ thống

| Hạng mục | Hiện tại |
|----------|----------|
| Framework | Laravel 12, PHP 8.2+, Sanctum 4.0 |
| API nội bộ | 154+ endpoints, prefix `/api/v5`, `auth:sanctum` |
| Database | MySQL 50 tables, ~1,520 rows lớn nhất |
| Cache | Redis có sẵn nhưng đang dùng `database` |
| Rate limit | Chỉ login (5/phút/IP+username) |
| CORS | Chưa có config |
| OAuth / API Key | Chưa có |
| RBAC | roles/permissions/dept scopes hoàn thiện |
| Audit | `V5AccessAuditService` log INSERT/UPDATE/DELETE |

---

## Phase 1 — MVP (Tuần 1-3): Xác thực + Đọc dữ liệu an toàn

### 1.1 Database Migrations (5 bảng mới)

| Bảng | Mục đích |
|------|----------|
| `api_clients` | Đăng ký client: client_id, client_secret (hash), api_key, tier (free/standard/premium), status, allowed_ips, allowed_origins, require_hmac |
| `api_client_scopes` | Phạm vi truy cập mỗi client: scope (`customers.read`), access_type (READ/WRITE/ALL) |
| `api_access_logs` | Log mọi request: request_id UUID, client_id, method, path, status_code, response_time_ms, ip |
| `api_rate_limits` | Custom rate limit per client per endpoint |
| `api_refresh_tokens` | Refresh token cho token rotation |

### 1.2 Route mới: `/api/ext/v1/`

Tách hoàn toàn khỏi API nội bộ v5. Tạo file `backend/routes/api_external.php`, đăng ký trong `backend/bootstrap/app.php`.

```
POST   /api/ext/v1/auth/token            — OAuth2 client credentials → access token
POST   /api/ext/v1/auth/refresh           — Refresh token
GET    /api/ext/v1/health                 — Health check (public, không auth)
GET    /api/ext/v1/me                     — Thông tin client hiện tại
GET    /api/ext/v1/customers              — Danh sách KH
GET    /api/ext/v1/customers/{id}         — Chi tiết KH
GET    /api/ext/v1/projects               — Danh sách dự án
GET    /api/ext/v1/contracts              — Danh sách hợp đồng
GET    /api/ext/v1/support-requests       — Danh sách YCHT
POST   /api/ext/v1/support-requests       — Tạo YCHT mới
GET    /api/ext/v1/support-requests/{id}  — Chi tiết YCHT
```

### 1.3 Authentication — 3 tầng

| Tầng | Đối tượng | Cơ chế |
|------|-----------|--------|
| A. OAuth2 Client Credentials | Hệ thống đối tác (server-to-server) | POST client_id + client_secret → access_token 60 phút |
| B. API Key | Tích hợp đơn giản, read-only | Header `X-API-Key` mỗi request |
| C. Bearer Token (Mobile) | App mobile (user-facing) | Login username/password → Sanctum bearer token |

**Cách tích hợp:** Tạo model `ApiClient` dùng trait `HasApiTokens` — Sanctum lưu token vào `personal_access_tokens` với `tokenable_type = App\Models\ApiClient`.

### 1.4 Middleware Stack cho External API

```
RequestId → EnforceTls → ExternalApiAuth → ExternalApiScope →
ExternalApiRateLimit → RateLimitHeaders → ExternalApiLogger → ExternalApiCache
```

| Middleware mới | Chức năng |
|----------------|-----------|
| `RequestId` | UUID `X-Request-ID` mọi response — traceability |
| `EnforceTls` | Từ chối HTTP, chỉ cho HTTPS (skip ở local/dev) |
| `ExternalApiAuth` | Xác thực 3 tầng: OAuth2 / API Key / Bearer |
| `ExternalApiScope` | Kiểm tra scope client có quyền truy cập resource |
| `ExternalApiRateLimit` | Rate limit theo tier client |
| `RateLimitHeaders` | Response headers: X-RateLimit-Limit, Remaining, Reset |
| `ExternalApiLogger` | Log request vào `api_access_logs` |
| `ExternalApiCache` | Redis cache cho GET requests + ETag support |

### 1.5 Rate Limiting bằng Redis

Chuyển `CACHE_STORE=redis` trong `.env`. Định nghĩa tiers trong `AppServiceProvider`:

| Tier | Requests/phút | Burst/giây |
|------|---------------|------------|
| free | 30 | 5 |
| standard | 120 | 15 |
| premium | 600 | 50 |

Response khi bị limit:
```
HTTP 429 Too Many Requests
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1709312400
Retry-After: 30
```

### 1.6 CORS Configuration

Tạo `config/cors.php`:
- Paths: `api/ext/*`
- Allowed headers: `Content-Type, Authorization, X-API-Key, X-Signature, X-Timestamp, X-Request-ID`
- Exposed headers: `X-RateLimit-*, ETag, X-Request-ID, Retry-After`
- Max age: 86400 (24h cache preflight)

### 1.7 Data Masking — An toàn dữ liệu

Tạo `DataMaskingService` — tự động mask trước khi trả response cho external client:

| Field | Rule | Ví dụ |
|-------|------|-------|
| `tax_code` | partial (first 3 + last 2) | `012***89` |
| `phone` | partial (last 4) | `****1234` |
| `email` | partial | `t***@domain.com` |
| `password`, `remember_token` | xóa hoàn toàn | — |
| `created_by`, `updated_by` | → user_code | thay vì numeric ID nội bộ |

Client có scope `sensitive_data.read` → xem data gốc (không mask).

### 1.8 Response Format chuẩn

**Pagination bắt buộc:** default 20, max 100 items/page.

Success:
```json
{
  "data": [...],
  "meta": { "page": 1, "per_page": 20, "total": 100, "total_pages": 5 },
  "request_id": "req_abc123"
}
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The customer_code field is required.",
    "request_id": "req_abc123",
    "details": [...]
  }
}
```

### 1.9 Admin endpoints quản lý API Client

Thêm vào routes nội bộ v5 (permission: `authz.manage`):
```
POST   /api/v5/api-clients               — Tạo client mới
GET    /api/v5/api-clients               — Danh sách clients
PUT    /api/v5/api-clients/{id}          — Cập nhật client
DELETE /api/v5/api-clients/{id}          — Vô hiệu hóa client
POST   /api/v5/api-clients/{id}/rotate-secret  — Xoay secret
```

### 1.10 Health Check (public)

```
GET /api/ext/v1/health  (không cần auth)

Response:
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-03-01T12:00:00Z",
  "checks": { "database": "ok", "redis": "ok" }
}
```

---

## Phase 2 — Bảo mật nâng cao (Tuần 4-6)

| # | Hạng mục | Mô tả |
|---|----------|-------|
| 2.1 | IP Whitelisting | Chặn request từ IP ngoài `api_clients.allowed_ips` |
| 2.2 | HMAC Request Signing | `X-Signature: HMAC-SHA256(secret, timestamp+method+path+body_hash)` + replay protection 5 phút |
| 2.3 | Token Rotation | Refresh token invalidate cũ, tạo mới — chống replay attack |
| 2.4 | Sparse Fieldsets | `?fields=id,name,status` → chỉ trả fields được yêu cầu |
| 2.5 | Response Caching | Redis cache + ETag + `Cache-Control: private, max-age=60` + 304 Not Modified |
| 2.6 | API Documentation | Cài `knuckleswtf/scribe` → auto-generate OpenAPI docs tại `/api/ext/docs` |
| 2.7 | Mobile Auth Flow | Login qua external API → bearer token cho app mobile |
| 2.8 | Standardized Error Codes | `AUTH_FAILED`, `SCOPE_DENIED`, `RATE_LIMITED`, `VALIDATION_ERROR`, `NOT_FOUND` |

---

## Phase 3 — Nâng cao (Tuần 7-10)

| # | Hạng mục | Mô tả |
|---|----------|-------|
| 3.1 | Read Replica DB | Config `mysql_read` connection cho external reads — giảm tải DB chính |
| 3.2 | Queue-based Exports | Async: `POST /exports/support-requests` → job_id, `GET /exports/{id}` → download_url |
| 3.3 | Webhook | Đẩy events (YCHT tạo mới, HĐ ký xong) tới partner callback URLs |
| 3.4 | API Usage Dashboard | Admin panel xem analytics per client (requests/day, errors, response time) |
| 3.5 | Response Compression | Brotli/gzip qua Nginx config |
| 3.6 | SLA Monitoring | Alert khi response time > threshold hoặc error rate > % |

---

## Cấu trúc thư mục mới

```
backend/
├── routes/
│   ├── api.php                                 (giữ nguyên — nội bộ v5)
│   └── api_external.php                        (MỚI — external API)
├── config/
│   ├── cors.php                                (MỚI — CORS config)
│   └── external_api.php                        (MỚI — config tập trung)
├── app/
│   ├── Models/
│   │   ├── ApiClient.php                       (MỚI — HasApiTokens)
│   │   ├── ApiClientScope.php                  (MỚI)
│   │   ├── ApiAccessLog.php                    (MỚI)
│   │   ├── ApiRateLimit.php                    (MỚI)
│   │   └── ApiRefreshToken.php                 (MỚI)
│   ├── Http/
│   │   ├── Controllers/Api/External/V1/
│   │   │   ├── ExternalBaseController.php      (MỚI — base logic chung)
│   │   │   ├── AuthController.php              (MỚI — token issuance)
│   │   │   ├── CustomerController.php          (MỚI)
│   │   │   ├── ProjectController.php           (MỚI)
│   │   │   ├── ContractController.php          (MỚI)
│   │   │   ├── SupportRequestController.php    (MỚI)
│   │   │   └── HealthController.php            (MỚI)
│   │   └── Middleware/
│   │       ├── RequestId.php                   (MỚI)
│   │       ├── EnforceTls.php                  (MỚI)
│   │       ├── ExternalApiAuth.php             (MỚI)
│   │       ├── ExternalApiScope.php            (MỚI)
│   │       ├── ExternalApiRateLimit.php        (MỚI)
│   │       ├── RateLimitHeaders.php            (MỚI)
│   │       ├── ExternalApiLogger.php           (MỚI)
│   │       ├── ExternalApiCache.php            (MỚI)
│   │       ├── VerifyHmacSignature.php         (MỚI)
│   │       └── ExternalApiInputSanitizer.php   (MỚI)
│   ├── Services/External/
│   │   ├── ExternalAuthService.php             (MỚI)
│   │   ├── DataMaskingService.php              (MỚI)
│   │   ├── ApiUsageTracker.php                 (MỚI)
│   │   └── ExternalResponseService.php         (MỚI)
│   └── Transformers/External/
│       ├── CustomerTransformer.php             (MỚI)
│       ├── ProjectTransformer.php              (MỚI)
│       ├── ContractTransformer.php             (MỚI)
│       └── SupportRequestTransformer.php       (MỚI)
└── database/migrations/
    ├── create_api_clients_table.php            (MỚI)
    ├── create_api_client_scopes_table.php      (MỚI)
    ├── create_api_access_logs_table.php        (MỚI)
    ├── create_api_rate_limits_table.php        (MỚI)
    └── create_api_refresh_tokens_table.php     (MỚI)
```

---

## Files hiện có cần sửa

| File | Thay đổi |
|------|----------|
| `backend/bootstrap/app.php` | Đăng ký `api_external.php` routes + 10 middleware aliases mới |
| `backend/app/Providers/AppServiceProvider.php` | Thêm RateLimiter definitions cho 3 tiers (free/standard/premium) |
| `backend/.env` | Thêm: `CACHE_STORE=redis`, `EXTERNAL_API_ENABLED=true`, `EXT_API_ACCESS_TOKEN_TTL=3600`, `EXT_API_REFRESH_TOKEN_TTL=604800` |

## Files tham khảo pattern (không sửa)

| File | Pattern tham khảo |
|------|-------------------|
| `backend/app/Services/V5/Domain/CustomerDomainService.php` | Domain service wrapper — reuse cho external controllers |
| `backend/app/Support/Auth/UserAccessService.php` | RBAC engine — mở rộng support ApiClient scope resolution |
| `backend/app/Http/Middleware/EnsurePermission.php` | Pattern cho ExternalApiScope middleware |
| `backend/app/Http/Middleware/DeprecatedApiAlias.php` | Pattern cho Sunset headers khi deprecate API version |
| `backend/app/Http/Controllers/Api/AuthController.php` | Login flow, token creation — tham khảo cho External AuthController |

---

## Thống kê tổng quan

| Metric | Số lượng |
|--------|----------|
| Bảng DB mới | 5 |
| Models mới | 5 |
| Middleware mới | 10 |
| Controllers mới | 7 |
| Services mới | 4 |
| Transformers mới | 4 |
| Config files mới | 2 |
| Route files mới | 1 |
| Files hiện có cần sửa | 3 |
| **Tổng files mới** | **36** |

---

## Verification — Kiểm tra sau khi triển khai

| # | Kiểm tra | Expected |
|---|----------|----------|
| 1 | `php artisan migrate` | 5 tables mới tạo thành công |
| 2 | `curl /api/ext/v1/health` | 200 OK, `{ database: ok, redis: ok }` |
| 3 | Tạo client qua admin → POST `/auth/token` | Nhận access_token |
| 4 | Gọi endpoint không có scope | 403 Forbidden |
| 5 | Gửi 31 requests/phút với tier free | Request #31 → 429 + Retry-After header |
| 6 | GET `/customers` | phone/email bị mask (`****1234`) |
| 7 | Request từ browser khác origin | CORS preflight OPTIONS → 200 |
| 8 | Kiểm tra `api_access_logs` | request_id, response_time_ms ghi đúng |
| 9 | GET 2 lần cùng endpoint | Lần 2 → ETag match + 304 Not Modified |
| 10 | Gọi HTTP (không HTTPS) ở production | 403 "HTTPS required" |

---

*Generated by Claude Code — 2026-03-01*
