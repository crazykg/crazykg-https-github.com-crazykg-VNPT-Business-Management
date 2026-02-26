# 📊 BÁO CÁO PHÂN TÍCH HỆ THỐNG VNPT BUSINESS MANAGEMENT

> **Thực hiện bởi:** Gemini 3.1  
> **Thời gian thực hiện:** 26/02/2026 07:13:11 (Giờ Việt Nam)  
> **Phiên bản hệ thống:** V5 Enterprise  
> **Stack:** React + Vite (Frontend) | Laravel + MySQL (Backend)

---

## 📋 MỤC LỤC

1. [Tổng Quan Kiến Trúc Cấu Trúc Hệ Thống](#1-tổng-quan-kiến-trúc-cấu-trúc-hệ-thống)
2. [Phân Tích Bất Cập & Điểm Chưa Tối Ưu](#2-phân-tích-bất-cập--điểm-chưa-tối-ưu)
3. [Giả Lập Kiểm Thử Trải Nghiệm Người Dùng (UI/UX)](#3-giả-lập-kiểm-thử-trải-nghiệm-người-dùng-uiux)
4. [Giả Lập Kiểm Thử Hiệu Năng Hệ Thống (Performance)](#4-giả-lập-kiểm-thử-hiệu-năng-hệ-thống-performance)
5. [Giả Lập Phân Tích An Toàn Bảo Mật (Security)](#5-giả-lập-phân-tích-an-toàn-bảo-mật-security)
6. [Phân Tích Cơ Sở Dữ Liệu (Database)](#6-phân-tích-cơ-sở-dữ-liệu-database)
7. [Kết Luận Và Đánh Giá Chung](#7-kết-luận-và-đánh-giá-chung)

---

## 1. Tổng Quan Kiến Trúc Cấu Trúc Hệ Thống

Dựa trên mã nguồn hiện tại, hệ thống được cấu trúc thành hai khối độc lập:

### 1.1 Khối Frontend (React + TypeScript)
- **Tập trung quá mức:** File `App.tsx` đảm nhận toàn bộ logic routing (bằng state), data fetching, và điều hướng render với **3,110 dòng code** và kích thước lên tới **120 KB**.
- **Quản lý Component:** `Modals.tsx` chứa mọi form modal của tất cả tính năng, kích thước **144 KB** — là một single point of failure (điểm đen nghẽn cổ chai) khi render.
- **Data service:** `v5Api.ts` có kích thước **48 KB** chứa toàn bộ các endpoint.

### 1.2 Khối Backend (Laravel + PHP)
- **Thiếu phân nhánh Controller:** `V5MasterDataController.php` là một "God Controller" xử lý CRUD cho hơn 15+ thực thể nghiệp vụ (Department, Employee, Customer, Project, Support, Document...) với file size **240 KB**.
- **Routing:** Khai báo toàn bộ trong `api.php`. Tồn tại nhiều route trùng lặp logic (`/support-requests` vs `/support_requests`).

---

## 2. Phân Tích Bất Cập & Điểm Chưa Tối Ưu

### Mức độ: 🔴 Nghiêm trọng (Cần xử lý ngay)

1. **Khởi tạo dữ liệu khổng lồ khi đăng nhập:** Hàm `bootstrapData` gọi API `fetchV5MasterData()` tải toàn bộ Master Data của hơn 20 tables về client. 
2. **"God Component" trong Frontend (`App.tsx`):**
   - Hơn 56 `useState` quản lý dữ liệu.
   - Hơn 50 hàm handler (CRUD) nhồi nhét chung.
   - Hàm `handleImportData` dài gần 800 dòng xử lý logic import Excel.
3. **"God Controller" trong Backend:** `V5MasterDataController.php` dài hàng ngàn dòng, vi phạm nguyên tắc SRP (Single Responsibility Principle).

### Mức độ: 🟡 Trung bình (Cần khắc phục để scale)

1. **Không sử dụng Route thư viện:** Router quản lý thủ công qua `useState('dashboard')` -> Không thể copy URL, không dùng được Back/Forward trên browser.
2. **Không phân trang từ Server (Server-Side Pagination):** Backend trả 1 cục JSON lớn, Frontend tự phân trang bằng RAM.
3. **Dữ liệu rác (Mock Data):** `constants.ts` chứa rất nhiều dữ liệu sinh ngẫu nhiên, làm tăng bundle size vô ích.

---

## 3. Giả Lập Kiểm Thử Trải Nghiệm Người Dùng (UI/UX)

Qua kịch bản mô phỏng hành vi:
- **Người dùng tải trang và Login:** Sau khi gõ thông tin, màn hình sẽ "đứng" hoặc báo loading lâu do tải ngầm 20 khối dữ liệu (departments, employees, customers...).
- **Điều hướng Tabs (Navigation):** Nhấn sang Quản lý Khách hàng -> Chọn 1 Khách hàng -> Bấm "F5" refresh trình duyệt. **Lỗi UX:** Ứng dụng dội người dùng về trang Dashboard do không lưu vết URL. 
- **User thao tác Import lượng lớn (5000 dòng):** File Excel sẽ phải lặp client-side để đẩy từng Request. Không có cơ chế Bulk Insert tối ưu. Trình duyệt báo "Page Is Unresponsive" do main thread của JS bị block liên tục.
- **Trải nghiệm thiết bị di động (Mobile UX):** `App.tsx` chưa thể hiện responsive đủ tốt do hiển thị quá nhiều table columns mà không có scroll view mượt hoặc card layout cho màn hẹp.

---

## 4. Giả Lập Kiểm Thử Hiệu Năng Hệ Thống (Performance)

Giả lập với tập dữ liệu tương lai (Scale to Enterprise):
- **Tình trạng:** Khách hàng = 5,000 | Dự án = 10,000 | Support Request = 50,000
- **Kết quả Client Payload:** Việc gọi `fetchV5MasterData()` sẽ tải tệp JSON nặng từ 15MB - 50MB. Trình duyệt di động sẽ Crash Tab vì cạn kiệt RAM. Trình duyệt Desktop sẽ mất từ 10s - 25s để parse JSON.
- **Kết quả Backend & DB Query:** "God Controller" sinh ra 20 kết nối ngầm `SELECT *` khổng lồ không Limit. Làm tê liệt DB Connection Pool, gây ra lỗi HTTP 504 Gateway Timeout.
- **Bundle Size:** Lượng Javascript gửi về Client xấp xỉ 1 - 1.5MB (Unzipped) gây chậm Time-To-Interactive (TTI).

---

## 5. Giả Lập Phân Tích An Toàn Bảo Mật (Security)

Kiểm tra bề mặt tấn công qua mã nguồn Backend và Frontend:

1. **🔴 Lưu JWT Token ở Local Storage:** Trực tiếp tạo rủi ro bị đánh cắp thông qua lỗi kỹ thuật XSS (Cross-Site Scripting).
2. **🔴 Mật Khẩu Default Giống Nhau Toàn Bộ:** Việc Seed database dùng trùng 1 mật khẩu chưa bị ép buộc đổi (Force Password Change) sau lần đăng nhập đầu tiên.
3. **🔴 Rò Rỉ Môi Trường (`.env`):** Phát hiện Git history có theo dõi file `.env`. Nếu public code ra ngoài, toàn bộ cấu hình DB, Drive Key, Mail sẽ bị lộ.
4. **🟡 Thiếu Rate Limiting Route Login:** Kẻ xấu có thể Brute-force mật khẩu (thử mật khẩu liên tục) vì Laravel route/auth chưa áp dụng middleware `throttle:lockout`.
5. **🟡 Cấu hình Service Account Google Drive LongText:** Lưu trong cột Database mà không dán nhãn chuẩn hóa hay mã hóa dữ liệu. Gây rủi ro nếu Dump Database.

---

## 6. Phân Tích Cơ Sở Dữ Liệu (Database)

- **Kiểm tra Indexing:** Bảng `support_requests` mất index cho các Query `where status = 'XYZ'` dẫn đến Full Table Scan. Bảng `attachments` thiếu index liên kết `reference_type` và `reference_id` cho cơ chế Polymorphic Relation. Thiếu FK Constraint cho `contracts` (dept_id).
- **Phân tách bộ nhớ (Partitioning):** Bảng `audit_logs` có áp dụng chia Partition nhưng theo `MONTH`. Về lâu dài 2-3 năm, Partition tháng 1 của 2024 và 2026 đè lên nhau.
- **Dữ liệu vô nghĩa (Ghost Data):** ID `customer_id` bằng 0 trong bảng Documents trái vói ID tự thiết lập của hệ thống.

---

## 7. Kết Luận Và Đánh Giá Chung

- **Thang điểm chất lượng Architect:** 4/10
- Khả năng sống sót (Resilience) khi dữ liệu tăng cao là kém. 
- Hệ thống hoạt động TỐT khi chỉ để làm **Proof of Concept / Demo (dữ liệu bé)**. Tuy nhiên, nếu mang triển khai thực tế (Production), nó sẽ sụp đổ hiệu năng ngay trong 3 tháng đầu.
- Rất cần thiết phải theo dõi sát **Kế hoạch Cấu trúc lại mã nguồn và tối ưu hệ thống (Remediation Plan).**

---

# 📊 BỔ SUNG PHÂN TÍCH — CLAUDE OPUS

> **Thực hiện bởi:** Claude Opus  
> **Thời gian thực hiện:** 26/02/2026 07:19:24 (Giờ Việt Nam)  
> **Phương pháp:** Deep code review + giả lập kịch bản người dùng chi tiết

---

## 8. Phân Tích Sâu Component-Level (Bổ sung)

### 8.1 Modals.tsx — Phân Tích Chi Tiết (3,194 dòng / 144 KB)

File này là **file lớn nhất toàn hệ thống**. Qua phân tích mã nguồn:

| Vấn đề | Chi tiết | Mức |
|---|---|---|
| Chứa 20+ exported components | Tất cả modal forms (Department, Employee, Business, Vendor, Product, Customer, Opportunity, Project, Contract, Document, Reminder, Import...) gom vào 1 file | 🔴 |
| `SearchableSelect` và `SearchableMultiSelect` là components tái sử dụng nhưng bị nhốt trong file Modal | Không thể import riêng cho các component khác | 🟡 |
| `ViewDepartmentModal` tham chiếu `MOCK_DEPARTMENTS` thay vì dữ liệu API thực | Dòng 692: `const parentDept = MOCK_DEPARTMENTS.find(d => d.id === data.parent_id)` → Hiển thị sai tên phòng ban cha! | 🔴 |
| `FormInput`, `FormSelect`, `DeleteConfirmModal` là shared components nhưng không export riêng | Gây duplicate code nếu cần dùng ở nơi khác | 🟡 |
| Import modal giới hạn file 5MB cứng (`MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024`) | Không configurable, không thông báo rõ cho user khi vượt | 🟢 |

### 8.2 EmployeeList.tsx — Phân Tích UI/UX

| Vấn đề | Chi tiết | Mức |
|---|---|---|
| `min-w-[1920px]` trên table | Bảng nhân sự yêu cầu chiều rộng tối thiểu 1920px → trên màn hình laptop 1366px phải scroll ngang rất nhiều | 🔴 |
| 12 cột dữ liệu hiển thị đồng thời | Quá nhiều thông tin, gây overload nhận thức. Nên ẩn bớt cột phụ (VPN, IP, Ngày sinh) trên mobile | 🟡 |
| Export PDF/Excel: `alert()` thay vì thông báo toast | Dòng 307: `alert('Chức năng xuất ra... đang được phát triển')` — UX kém, nên dùng toast notification | 🟡 |
| Client-side sort + filter trên toàn bộ dataset | Khi 5,000+ nhân viên, mỗi keystroke trong ô tìm kiếm trigger re-filter toàn bộ mảng | 🟡 |

### 8.3 AuthController.php — Phân Tích Bảo Mật Chi Tiết

| Vấn đề | Chi tiết | Mức |
|---|---|---|
| Login trả token trong JSON body | Dòng 58-64: Token gửi qua response JSON → Frontend lưu localStorage → XSS exploit vector | 🔴 |
| Không kiểm tra password strength | Chấp nhận mọi password miễn match hash, không enforce complexity | 🟡 |
| `orWhere('email', $loginInput)` không index | Query login dùng OR condition trên 2 cột → không tận dụng index hiệu quả | 🟡 |
| Không log login attempt (thành công/thất bại) | Không có audit trail cho hoạt động đăng nhập → khó phát hiện brute force | 🔴 |
| `Schema::hasColumn()` gọi mỗi request login | Dòng 41: Kiểm tra schema mỗi lần login → query metadata thừa, nên cache | 🟢 |

---

## 9. Giả Lập Kiểm Thử UI/UX Bổ Sung (Claude Opus)

### 9.1 Kịch Bản: Nhân Viên Mới Onboarding (Role: STAFF, Mobile 375px)

| Bước | Hành động | Kết quả | Phát hiện |
|---|---|---|---|
| 1 | Mở app trên iPhone 14 (390px) | Sidebar thu gọn | ✅ Có hamburger menu |
| 2 | Vào "Quản lý Nhân sự" | Bảng 1920px minimum width | 🔴 Phải zoom out 50% mới thấy hết, text siêu nhỏ |
| 3 | Thử filter "Phòng ban" dropdown | Dropdown mở ra nhưng bị cắt | 🟡 `SearchableSelect` openDirection logic có nhưng không test mobile |
| 4 | Nhấn "Thêm nhân sự" | Modal full width | ⚠️ Scroll dọc để thấy hết form fields |
| 5 | Nhấn nút Export → PDF | `alert()` hiện lên | 🔴 Chức năng chưa hoàn thiện, dùng `alert()` thay vì toast |
| 6 | Quay về Dashboard bằng sidebar | Phải mở hamburger menu mỗi lần | 🟡 Sidebar không có swipe gesture |

### 9.2 Kịch Bản: Admin Xem Chi Tiết Phòng Ban

| Bước | Hành động | Kết quả | Phát hiện |
|---|---|---|---|
| 1 | Mở danh sách "Phòng ban" | 10 phòng ban hiển thị | ✅ OK |
| 2 | Click "Xem chi tiết" phòng PB002 | Modal hiện thông tin | 🔴 **BUG:** "Phòng ban cha" hiển thị từ `MOCK_DEPARTMENTS` thay vì dữ liệu API thực! |
| 3 | Phòng ban cha hiển thị đúng ID nhưng sai tên | `MOCK_DEPARTMENTS.find(d => d.id === data.parent_id)` | 🔴 Nếu API trả parent_id khác mock → người dùng thấy thông tin SAI |

### 9.3 Kịch Bản: Concurrent Users (10 users đồng thời)

| Tình huống | Kết quả dự kiến | Phát hiện |
|---|---|---|
| 10 users login cùng lúc | 10 × `fetchV5MasterData()` = 200 DB queries đồng thời | 🔴 MySQL connection pool default (151) có thể cạn kiệt |
| 5 users import Excel đồng thời | 5 × 1000 sequential API calls = 5000 requests trong vài phút | 🔴 Server overwhelmed, rate limit không có |
| User A xóa department, User B đang edit employee cùng department | Không có optimistic locking hay real-time sync | 🟡 Stale data, có thể mất dữ liệu |

---

## 10. Giả Lập Kiểm Thử Hiệu Năng Bổ Sung (Claude Opus)

### 10.1 React Re-render Profiling

Do `App.tsx` chứa 56 `useState` ở root:

```
Kịch bản: User gõ 1 ký tự trong ô search của EmployeeList
├── setState(searchTerm) trigger
├── App component re-render (3,110 dòng JSX)
├── Tất cả 15+ child components nhận props mới → re-render
├── Modals (dù đang ẩn) vẫn evaluate conditional
├── useMemo dependencies check cho 5+ computed values
└── Ước tính: 15-30ms mỗi keystroke (với 100 records)
     → 100-500ms mỗi keystroke (với 5,000 records)
```

### 10.2 Memory Leak Tiềm Ẩn

| Nguồn | Chi tiết |
|---|---|
| Toast timeout không cleanup khi unmount | `setTimeout(() => removeToast(id), 5000)` — nếu component unmount trước 5s, timeout vẫn chạy |
| `useEffect` trong SearchableSelect | Event listener `mousedown` add/remove đúng, nhưng nhiều instances mở đồng thời sẽ stack listeners |
| Import `importInFlightRef` | Nếu user navigate away giữa import, ref vẫn locked = true → không import được nữa cho đến refresh |

### 10.3 Network Waterfall Analysis

```
Login Flow Timeline (ước tính với 100 records):
t=0ms      POST /auth/login                    → 200ms
t=200ms    GET /auth/me                         → 100ms
t=300ms    Promise.all([                        
              GET /departments,                  → 150ms
              GET /employees,                    → 200ms  
              GET /businesses,                   → 80ms
              GET /vendors,                      → 80ms
              GET /products,                     → 100ms
              GET /customers,                    → 150ms
              GET /customer-personnel,           → 120ms
              GET /opportunities,                → 100ms
              GET /projects,                     → 120ms
              GET /project_items,                → 80ms
              GET /contracts,                    → 100ms
              GET /payment-schedules,            → 80ms
              GET /documents,                    → 100ms
              GET /reminders,                    → 80ms
              GET /user_dept_history,             → 80ms
              GET /audit-logs,                   → 150ms
              GET /support-service-groups,        → 80ms
              GET /support-requests,             → 200ms
              GET /support-request-history,       → 150ms
              GET /roles-permissions,             → 80ms
              GET /user-access,                  → 100ms
              GET /integration-settings,         → 80ms
           ])
t=300ms    HTTP/1.1: 6 parallel → round 1 (6 requests)
t=500ms    round 2 (6 requests) 
t=700ms    round 3 (6 requests)
t=900ms    round 4 (5 requests)
t=1100ms   Tất cả responses nhận xong
t=1200ms   React setState × 22 → batch re-render
t=1400ms   UI Interactive
           TỔNG: ~1.4 giây (tối ưu, LAN, data nhỏ)
```

---

## 11. Giả Lập Phân Tích An Toàn Bảo Mật Bổ Sung (Claude Opus)

### 11.1 OWASP Top 10 Mapping

| # | OWASP Category | Status | Chi tiết |
|---|---|---|---|
| A01 | Broken Access Control | 🟡 | Permission middleware có, nhưng thiếu row-level security (user A xem data user B) |
| A02 | Cryptographic Failures | 🔴 | Token lưu localStorage, `.env` trong git, Google SA JSON plaintext trong DB |
| A03 | Injection | 🟡 | Laravel Eloquent tự escape SQL, nhưng một số raw queries trong `V5MasterDataController` cần review |
| A04 | Insecure Design | 🔴 | "Fetch all data" pattern, no pagination, no rate limiting |
| A05 | Security Misconfiguration | 🔴 | `.env` tracked by git, CORS permissive, no CSP headers |
| A06 | Vulnerable Components | 🟡 | Dependencies cần audit (`npm audit`), Vite 7.x tương đối mới |
| A07 | Auth Failures | 🔴 | No rate limit login, no MFA, no password policy, no login audit |
| A08 | Data Integrity Failures | 🟡 | Không verify data integrity khi import Excel → có thể inject bad data |
| A09 | Logging & Monitoring | 🔴 | Có `audit_logs` table nhưng không log login attempts, API errors, hay security events |
| A10 | SSRF | 🟢 | Không phát hiện SSRF vector rõ ràng |

### 11.2 Phát Hiện Bảo Mật Mới

1. **🔴 Không có CSRF Protection cho API:** Laravel Sanctum dùng token-based auth, nhưng không enforce SameSite cookie attributes.

2. **🔴 Login endpoint không log failed attempts:** `AuthController.php` trả 422 khi sai password nhưng không ghi log → không thể detect brute force.

3. **🟡 Token không có expiry rõ ràng:** `createToken('vnpt_business_web', $abilities)` tạo token không set expires_at → token sống vô thời hạn cho đến khi bị xóa thủ công.

4. **🟡 Sensitive data trong API response:** `serializeUser()` trả về `permissions`, `roles`, `dept_scopes` đầy đủ → attacker biết chính xác quyền hạn của user.

5. **🟡 File upload không validate MIME type:** `uploadDocumentAttachment` trong API chấp nhận upload mà không kiểm tra extension/MIME → có thể upload file `.php` hoặc `.exe`.

---

## 12. Bảng Tổng Hợp Đánh Giá (Claude Opus)

| Hạng mục | Gemini 3.1 | Claude Opus | Ghi chú bổ sung |
|---|---|---|---|
| Kiến trúc Frontend | 4/10 | **3/10** | Phát hiện thêm bug MOCK_DATA trong production, re-render cascade |
| Kiến trúc Backend | 4/10 | **4/10** | Đồng thuận, God Controller là vấn đề chính |
| Database Design | — | **6/10** | Schema OK nhưng thiếu index, FK, partition sai |
| UI/UX | — | **4/10** | Table 1920px min-width, alert() thay toast, mobile UX kém |
| Hiệu Năng | — | **3/10** | Re-render cascade, memory leak tiềm ẩn, network waterfall |
| Bảo Mật | — | **3/10** | 6/10 OWASP categories có vấn đề |
| Khả Năng Mở Rộng | — | **2/10** | Sẽ crash với >5,000 records |
| **Điểm Tổng (Claude Opus)** | | **3.5/10** | Cần refactor nghiêm túc trước production |
