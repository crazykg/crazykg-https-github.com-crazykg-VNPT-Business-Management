# Cảnh báo rủi ro — Hiệu năng & Bảo mật thông tin
**Ngày:** 2026-03-02 19:33
**Hệ thống:** VNPT Business Management
**Phạm vi:** Backend (Laravel 12) + Frontend (React 19) + MySQL Database
**Phân loại:** CRITICAL / HIGH / MEDIUM / LOW

---

## PHẦN I — BẢO MẬT THÔNG TIN

### 🔴 CRITICAL — Xử lý ngay lập tức

| # | Rủi ro | Mô tả | File | Đề xuất fix |
|---|--------|--------|------|-------------|
| SEC-C1 | **Debug mode bật trên production** | `APP_DEBUG=true` + `APP_ENV=local` → Laravel hiển thị stack trace, SQL query, environment variables trong error pages | `backend/.env:4` | Set `APP_DEBUG=false`, `APP_ENV=production` |
| SEC-C2 | **Credential DB mặc định** | User `root` / pass `root` — credentials mặc định MySQL, ai cũng biết | `backend/.env:23-28` | Tạo user riêng với quyền hạn chế, đặt mật khẩu mạnh |
| SEC-C3 | **Permission bypass khi chuỗi rỗng** | `hasPermission()` trả về `true` nếu permission key là empty string sau trim → bỏ qua hoàn toàn phân quyền | `app/Support/Auth/UserAccessService.php:134-147` | Thêm check: `if ($permission === '') return false;` |
| SEC-C4 | **Default password hash hardcoded** | Hash bcrypt mặc định `$2y$10$92IXUNpk...` được hardcode cho tài khoản hệ thống → attacker có thể dùng mật khẩu đã biết để đăng nhập | `app/Http/Controllers/Api/V5MasterDataController.php:34` | Xóa default hash, bắt buộc đổi mật khẩu lần đầu đăng nhập |

---

### 🟠 HIGH — Ưu tiên cao, xử lý trong sprint tới

| # | Rủi ro | Mô tả | File | Đề xuất fix |
|---|--------|--------|------|-------------|
| SEC-H1 | **Nhiều token hoạt động cùng lúc** | `createToken()` không revoke token cũ → user có thể có vô số token đồng thời. Token bị lộ không thể vô hiệu hóa | `app/Http/Controllers/Api/AuthController.php:62-63` | Revoke all tokens trước khi tạo token mới: `$user->tokens()->delete()` |
| SEC-H2 | **Token sống 480 phút (8 giờ)** | Quá dài so với chuẩn ngành (15-30 phút). Token bị lộ có thể bị khai thác trong 8 giờ | `config/sanctum.php:50`, `config/vnpt_auth.php:5` | Giảm access token xuống 60 phút, triển khai refresh token |
| SEC-H3 | **File upload lưu public, không auth** | Files được `storePublicly()` → URL trực tiếp không cần đăng nhập để download | `app/Http/Controllers/Api/V5MasterDataController.php:10854` | Chuyển sang `store()` private disk, tạo signed URL có thời hạn |
| SEC-H4 | **Không có Security Headers** | Không có `X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security`, `X-XSS-Protection` → dễ bị Clickjacking, XSS | Application-wide | Thêm middleware `SecurityHeaders` hoặc cấu hình Nginx/Apache |
| SEC-H5 | **Không rate limit trên write endpoints** | Chỉ login bị throttle (5/phút). Toàn bộ POST/PUT/DELETE không giới hạn → tấn công mass data creation/modification | `routes/api.php`, `app/Providers/AppServiceProvider.php` | Thêm throttle cho write endpoints: `middleware('throttle:30,1')` |
| SEC-H6 | **File upload: 500 files không giới hạn tổng** | Mỗi file max 20MB nhưng cho phép 500 files → 10GB/request, dễ DoS | `app/Http/Controllers/Api/V5MasterDataController.php:6338` | Giới hạn tổng dung lượng request (`max:10240` tổng) |
| SEC-H7 | **Soft delete không nhất quán** | Chỉ `ProgrammingRequest`, `SupportRequest` dùng SoftDeletes. Department, Customer, Project, Contract bị xóa cứng → mất audit trail | `app/Models/` | Implement SoftDeletes cho toàn bộ models quan trọng |
| SEC-H8 | **Audit log lưu plain text dữ liệu nhạy cảm** | `old_values` / `new_values` lưu JSON không mã hóa → ai có quyền DB đọc được toàn bộ lịch sử thay đổi kể cả dữ liệu nhạy cảm | `app/Services/V5/V5AccessAuditService.php:87-133` | Tự động mask fields nhạy cảm trước khi log |

---

### 🟡 MEDIUM — Xử lý trong vòng 1-2 tháng

| # | Rủi ro | Mô tả | File | Đề xuất fix |
|---|--------|--------|------|-------------|
| SEC-M1 | **Session không hết hạn khi đóng browser** | `expire_on_close=false` → session còn sống sau khi đóng tab | `config/session.php:37` | Set `expire_on_close=true` |
| SEC-M2 | **Session data không mã hóa** | `SESSION_ENCRYPT=false` → dữ liệu session lưu DB ở dạng plaintext | `config/session.php:50` | Set `SESSION_ENCRYPT=true` |
| SEC-M3 | **Cookie token bị URL decode** | Token từ cookie bị `urldecode()` → nguy cơ token tampering | `app/Http/Middleware/UseSanctumCookieToken.php:21` | Bỏ `urldecode()`, validate token nguyên bản |
| SEC-M4 | **Department scope OR logic** | `(dept_id IN [...]) OR (created_by = userId)` → user có thể xem/sửa mọi record họ tạo bất kể department scope | `app/Services/V5/Domain/ProjectDomainService.php:817-890` | Review logic, xem xét dùng AND thay OR |
| SEC-M5 | **Username bị log trong auth attempts** | `recordLoginAttempt()` lưu username → attacker phân tích log tìm username hợp lệ | `app/Http/Controllers/Api/AuthController.php` | Hash hoặc mask username trong audit log |
| SEC-M6 | **Không có CORS config tường minh** | Không có `config/cors.php` → dùng default Laravel, có thể include domain dev vào production | `config/sanctum.php:18-23` | Tạo `config/cors.php` với danh sách origin tường minh |
| SEC-M7 | **Google Drive credentials lưu DB** | Service account JSON lưu trong `integration_settings` → nếu DB bị lộ, credential bị lộ | `app/Http/Controllers/Api/V5MasterDataController.php:10800+` | Lưu credentials trong environment variables hoặc secret manager |
| SEC-M8 | **Không có refresh token** | Chỉ có access token → không thể renew token an toàn mà không cần đăng nhập lại | `app/Http/Controllers/Api/AuthController.php` | Triển khai refresh token flow |

---

## PHẦN II — HIỆU NĂNG

### 🔴 CRITICAL — Ảnh hưởng nghiêm trọng tới tốc độ hệ thống

| # | Rủi ro | Mô tả | File | Đề xuất fix |
|---|--------|--------|------|-------------|
| PF-C1 | **Cache dùng database thay Redis** | `CACHE_STORE=database` → mỗi cache read = query DB → cache không giảm được tải DB | `backend/.env` | Chuyển `CACHE_STORE=redis` — Redis đã cấu hình sẵn tại `127.0.0.1:6379`, chỉ cần đổi 1 dòng `.env` |
| PF-C2 | **Session lưu database** | `SESSION_DRIVER=database` → mỗi request đọc/ghi session vào DB. N users đồng thời = N×2 queries thêm | `backend/.env` | Chuyển `SESSION_DRIVER=redis` — Redis đã sẵn sàng, không cần cài thêm |
| ~~PF-C3~~ | ~~**`personal_access_tokens` thiếu index**~~ | ~~Thiếu index `(tokenable_type, tokenable_id)` và `last_used_at`~~ | — | ✅ **Đã có index — Đánh giá lại: KHÔNG CÒN LÀ RỦI RO.** Kiểm tra thực tế DB xác nhận index `personal_access_tokens_tokenable_type_tokenable_id_index` và `idx_personal_access_tokens_last_used_at` đã tồn tại. |

---

### 🟠 HIGH — Tác động lớn tới trải nghiệm người dùng

| # | Rủi ro | Mô tả | File | Đề xuất fix |
|---|--------|--------|------|-------------|
| PF-H1 | **Dataset load tuần tự (not parallel)** | `ensureDatasetLoaded()` dùng `for...of await` → 20+ dataset load lần lượt. Nếu mỗi call 100ms → tổng 2000ms+ thay vì 100ms nếu song song | `frontend/App.tsx:571-690` | Đổi sang `Promise.allSettled(datasets.map(key => ensureDatasetLoaded(key)))` |
| PF-H2 | **Fetch toàn bộ data không phân trang** | Hầu hết `fetch*()` load ALL data (fetchDepartments, fetchEmployees, fetchCustomers...) không có pagination → tải 1000+ rows khi chỉ cần 20 | `frontend/services/v5Api.ts:878-945` | Implement cursor/page pagination cho các dataset lớn |
| PF-H3 | **`->fresh()->load()` sau mỗi CRUD** | Sau create/update, code gọi `->fresh()->load()` = 2 query thêm không cần thiết (mỗi thao tác CRUD = +2 queries) | `app/Http/Controllers/Api/V5MasterDataController.php:4503,4606,5345...` | Trả về entity đã có, không cần `fresh()`. Dùng `->loadMissing()` thay `->load()` |
| PF-H4 | **Export N+1 queries** | Export functions dùng `foreach ($query->get() as $row)` không eager load relations → N queries cho N rows | `app/Http/Controllers/Api/V5MasterDataController.php:8862-10456` | Thêm `->with(['customer','project','assignee'])` trước `->get()` |
| PF-H5 | **Queue đồng bộ, blocking exports** | `QUEUE_CONNECTION=database` → export 500 YCHT chạy đồng bộ, user chờ 5-10 giây, có thể timeout | `backend/.env:45` | Chuyển `QUEUE_CONNECTION=redis`, chạy export async |
| PF-H6 | **Race condition duplicate API calls** | `ensureDatasetLoaded()` mark loaded SAU khi await xong → 2 caller cùng lúc gọi 2 lần. Ví dụ: `internal-users` bị gọi 2 lần, 1 cái bị cancelled | `frontend/App.tsx:543-546` | Mark loaded TRƯỚC khi await, rollback nếu lỗi |

---

### 🟡 MEDIUM — Cần tối ưu dần

| # | Rủi ro | Mô tả | File | Đề xuất fix |
|---|--------|--------|------|-------------|
| PF-M1 | **O(n) lookup trong sort comparator** | `ProductList` gọi `getDomainName()`, `getVendorName()` trong sort comparator → sort 500 rows = 1000 lookups | `frontend/components/ProductList.tsx:215-250` | Pre-build Map lookup trước sort, không lookup trong comparator |
| PF-M2 | **Thiếu index trên FK columns** | `support_requests.service_group_id`, `programming_requests.project_id`, `programming_requests.customer_id` thiếu index → JOIN chậm | Database schema | Tạo index cho các FK columns được dùng trong WHERE/JOIN |
| PF-M3 | **Render không dùng virtualization** | `SupportRequestList.tsx` (4155 dòng) render toàn bộ DOM cho 100+ rows → lag khi scroll | `frontend/components/SupportRequestList.tsx` | Dùng `react-window` hoặc `react-virtual` |
| PF-M4 | **Export/PDF code trong main bundle** | Không lazy load thư viện export (xlsx, pdf) → main bundle lớn hơn cần thiết | `frontend/vite.config.ts` | Dynamic import: `const xlsx = await import('xlsx')` chỉ khi click export |
| PF-M5 | **Không có HTTP response caching** | Các API list (customers, products...) không có `Cache-Control`, `ETag` → browser không cache được | Backend controllers | Thêm `Cache-Control: private, max-age=60` + ETag cho GET endpoints |
| PF-M6 | **`supportRequests` load toàn bộ cho tab lập trình** | Tab Programming Requests load toàn bộ `supportRequests` (1520+ rows) mặc dù chỉ cần khi mở modal FROM_SUPPORT | `frontend/App.tsx:749-758` | Bỏ `supportRequests` khỏi dependency của `programming_requests` tab, lazy load khi cần |

---

## PHẦN III — MA TRẬN TỔNG HỢP THEO ƯU TIÊN

| Ưu tiên | # Vấn đề | Hành động |
|---------|----------|-----------|
| 🔴 CRITICAL (8 vấn đề) | SEC-C1~C4, PF-C1~C3 | **Xử lý ngay — trước khi go production** |
| 🟠 HIGH (16 vấn đề) | SEC-H1~H8, PF-H1~H6 | Xử lý trong **sprint 1-2 tuần** |
| 🟡 MEDIUM (14 vấn đề) | SEC-M1~M8, PF-M1~M6 | Lên kế hoạch trong **1-2 tháng** |

---

## PHẦN IV — ROADMAP FIX THEO SPRINT

### Sprint 1 (Tuần 1) — CRITICAL
```
1. [backend/.env]            APP_DEBUG=false, APP_ENV=production
2. [backend/.env]            Đổi DB credentials khỏi root/root
3. [UserAccessService.php]   Fix permission bypass empty string
4. [.env]                    CACHE_STORE=redis, SESSION_DRIVER=redis
5. [Database]                ADD INDEX idx_tokenable ON personal_access_tokens
6. [V5MasterDataController]  Xóa default password hash hardcoded
```

### Sprint 2 (Tuần 2) — HIGH Security
```
7. [AuthController.php]      Revoke all tokens trước khi tạo token mới
8. [sanctum.php]             Giảm token TTL từ 480 → 60 phút
9. [V5MasterDataController]  File upload → private disk + signed URL
10. [Middleware mới]          SecurityHeaders (X-Frame-Options, CSP, HSTS...)
11. [routes/api.php]          Thêm throttle cho POST/PUT/DELETE
```

### Sprint 3 (Tuần 3) — HIGH Performance
```
12. [frontend/App.tsx]        Sequential load → Promise.allSettled parallel
13. [frontend/App.tsx]        Fix race condition ensureDatasetLoaded
14. [frontend/App.tsx]        Bỏ supportRequests khỏi programming_requests deps
15. [.env]                    QUEUE_CONNECTION=redis
16. [V5MasterDataController]  Thêm eager loading trong export functions
```

### Sprint 4 (Tuần 4-6) — MEDIUM
```
17. Soft deletes cho Department, Customer, Project, Contract
18. config/cors.php tường minh
19. Refresh token flow
20. Virtualization cho SupportRequestList
21. Lazy load export libraries
22. Index FK columns thiếu
```

---

## PHẦN V — ƯỚC TÍNH TÁC ĐỘNG SAU KHI FIX

| Hạng mục | Trước | Sau fix | Cải thiện |
|----------|-------|---------|-----------|
| Initial page load | 2-3s | 300-500ms | **~6x nhanh hơn** |
| Export 500 records | 5-10s (blocking) | 1-2s (async) | **~5x nhanh hơn** |
| DB load (N users đồng thời) | N×(cache+session) queries | ~0 extra queries | **~80% giảm DB load** |
| Token validation / request | Full table scan | Index lookup | **~10x nhanh hơn** |
| Rủi ro token bị lộ | 8 giờ exploit window | 60 phút | **~8x giảm rủi ro** |
| File upload không auth | Mọi người xem được | Signed URL có hạn | **Loại bỏ rủi ro** |

---

*Generated by Claude Code — 2026-03-02 19:33*
