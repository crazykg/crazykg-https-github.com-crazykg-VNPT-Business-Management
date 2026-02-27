# 🔧 BÁO CÁO CHẨN ĐOÁN & KẾ HOẠCH FIX LỖI HỆ THỐNG — CLAUDE OPUS

> **Thực hiện bởi:** Claude Opus  
> **Thời gian thực hiện:** 26/02/2026 13:27:32 (Giờ Việt Nam)  
> **Hệ thống:** VNPT Business Management V5  
> **Triệu chứng:** Lỗi "Tải dữ liệu thất bại — Không thể kết nối máy chủ (quá thời gian phản hồi)" xuất hiện liên tục trên trang Support Requests

---

## 1. Kết Quả Chẩn Đoán Thực Tế

### 1.1 Kiểm Tra Kết Nối Backend (curl → port 8000)

```
HTTP_STATUS: 000   ← Không nhận được HTTP response  
TIME_TOTAL: 5.002s  
CONNECT_TIME: 0.000s ← Kết nối TCP thành công, server không trả dữ liệu
Exit code: 28 (TIMEOUT)
```

**Kết luận:** Backend PHP đang **chạy nhưng bị kẹt** (hanging), không phản hồi request mới.

### 1.2 Kiểm Tra Process Đang Chạy

| Port | Process | PID | Trạng thái |
|---|---|---|---|
| 8000 | `php artisan serve` | 64129 | ✅ Đang chạy, có 2 kết nối ESTABLISHED |
| 5173 | `node` (Vite dev) | 64145 | ✅ Đang chạy, có 2 kết nối browser |

### 1.3 Phân Tích Laravel Error Log

| Thời gian | Lỗi | Nguyên nhân |
|---|---|---|
| `2026-02-25 08:22` | `SQLSTATE[01000]: Data truncated for column 'status'` | Giá trị `ACTIVE` không nằm trong enum `projects.status` (enum chỉ có: TRIAL, ONGOING, WARRANTY, COMPLETED, CANCELLED) |
| `2026-02-25 17:28` | `SQLSTATE[HY000] [2002] Operation not permitted` | MySQL connection bị từ chối — có thể do quá tải connection pool |
| `2026-02-25 23:03` | `Route [login] not defined` | Token hết hạn → Sanctum middleware cố redirect về route "login" (không tồn tại trong API routes) → Exception |

---

## 2. Phân Tích Nguyên Nhân Gốc (Root Cause Analysis)

### ⭐ Nguyên Nhân Chính: `php artisan serve` là Single-Threaded

```
Vấn đề cốt lõi:
┌──────────────────────────────────────────────────────┐
│  php artisan serve = 1 PHP worker duy nhất           │
│  ↓                                                   │
│  Tab support_requests gửi 8 API calls đồng thời:    │
│    1. GET /support-requests (paginated)              │
│    2. GET /support-service-groups                    │
│    3. GET /support-request-history                   │
│    4. GET /project-items                             │
│    5. GET /customers                                 │
│    6. GET /projects                                  │
│    7. GET /products                                  │
│    8. GET /internal-users                            │
│  ↓                                                   │
│  Worker PHP xử lý request #1 → request #2-8 xếp hàng│
│  ↓                                                   │
│  Request #6, #7, #8 chờ > 20 giây → TIMEOUT!        │
│  ↓                                                   │
│  Frontend hiện 4-5 toast "Tải dữ liệu thất bại"    │
└──────────────────────────────────────────────────────┘
```

### Nguyên Nhân Phụ 1: Token Đã Hết Hạn

Migration `2026_02_26_091000_revoke_non_expiring_personal_access_tokens` đã gán `expires_at` cho tất cả token cũ. Dữ liệu SQL dump cho thấy:

```sql
-- Token cũ giờ có expires_at = '2026-02-25 19:33:29'
-- Thời điểm hiện tại: 2026-02-26 13:27 → HẾT HẠN hơn 18 giờ!
```

Khi token hết hạn → Laravel Sanctum trả 401 → middleware cố gọi `route('login')` → Exception `Route [login] not defined`.

### Nguyên Nhân Phụ 2: Lỗi Enum Status Trong `projects`

```sql
-- Cột projects.status chỉ cho phép:
-- TRIAL, ONGOING, WARRANTY, COMPLETED, CANCELLED
-- Nhưng code gửi value: 'ACTIVE' → Data truncated
```

---

## 3. Kế Hoạch Fix Chi Tiết

### Fix 1: Restart Backend (Khẩn cấp — 2 phút)

```bash
# Bước 1: Kill process PHP đang bị kẹt
kill -9 64129

# Bước 2: Chạy lại backend
cd backend && php artisan serve --host=127.0.0.1 --port=8000
```

### Fix 2: Đăng Nhập Lại Để Lấy Token Mới (2 phút)

1. Mở trình duyệt → `http://127.0.0.1:5173`
2. Click **Đăng xuất** (logout)
3. Xóa localStorage: DevTools → Application → Local Storage → Clear
4. **Đăng nhập lại** → hệ thống cấp token mới có `expires_at` hợp lệ

### Fix 3: Thêm Named Route "login" Cho API (5 phút)

**File:** `backend/routes/api.php`

```php
// Thêm fallback route để tránh lỗi "Route [login] not defined"
Route::get('/auth/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');
```

### Fix 4: Fix Enum Status "ACTIVE" Cho Projects (10 phút)

**File:** `backend/app/Http/Controllers/Api/V5MasterDataController.php`

```php
// Trong method updateProject, validate status đúng enum:
$request->validate([
    'status' => ['sometimes', 'in:TRIAL,ONGOING,WARRANTY,COMPLETED,CANCELLED'],
]);
```

### Fix 5: Giảm Concurrent API Calls (30 phút) — Quan trọng nhất

**File:** `frontend/App.tsx` — dòng 561-569

```tsx
// TRƯỚC: Gọi 7 datasets đồng thời + 1 paginated = 8 calls
support_requests: [
  'supportServiceGroups',
  'supportRequestHistories',
  'projectItems',
  'customers',
  'projects',
  'products',
  'employees',
],

// SAU: Chỉ giữ datasets thiết yếu, lazy load phần còn lại
support_requests: [
  'supportServiceGroups',
  'customers',   // Cần cho dropdown
  'employees',   // Cần cho assignee
],
// projectItems, products, projects → tải khi mở modal form
```

### Fix 6: Dùng Multi-Worker Thay Vì `artisan serve` (15 phút)

```bash
# Thay vì:
php artisan serve

# Dùng PHP built-in với nhiều worker:
PHP_CLI_SERVER_WORKERS=4 php artisan serve --host=127.0.0.1 --port=8000

# Hoặc cài Nginx/Apache + PHP-FPM cho production
```

---

## 4. Bảng Ưu Tiên Thực Hiện

| # | Fix | Effort | Tác động | Ưu tiên |
|---|---|---|---|---|
| 1 | Restart backend | 2 phút | 🔴 Giải phóng server kẹt | **NGAY** |
| 2 | Đăng nhập lại | 2 phút | 🔴 Lấy token mới | **NGAY** |
| 3 | Thêm route "login" | 5 phút | 🟡 Tránh exception 500 | Hôm nay |
| 4 | Fix enum ACTIVE | 10 phút | 🟡 Sửa data truncation | Hôm nay |
| 5 | Giảm concurrent calls | 30 phút | 🔴 Ngăn timeout tái phát | Hôm nay |
| 6 | Multi-worker PHP | 15 phút | 🔴 Fix gốc single-thread | Tuần này |

---

## 5. Tóm Tắt

> **Lỗi timeout trên trang Support Requests** xảy ra do **3 yếu tố kết hợp**: PHP single-threaded bị nghẽn bởi 8 API calls đồng thời, token đã hết hạn sau migration, và thiếu named route "login" cho API fallback. **Giải pháp tức thì**: restart backend + đăng nhập lại. **Giải pháp lâu dài**: dùng multi-worker PHP và giảm số lượng API calls đồng thời.
