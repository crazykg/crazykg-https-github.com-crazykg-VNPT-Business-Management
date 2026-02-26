## 📋 Nhật ký hệ thống (Version Log)
**Phiên bản Báo cáo:** Audit Report v2.1
**Thời gian rà soát:** Feb 26, 2026
**Tổng quan kết quả:** Đợt Refactor Lần 1 đã giải quyết cực kỳ tốt các lỗi liên quan đến UI/UX ở Frontend (Toasts, Responsive, Loading state) và một phần hổng Bảo mật (MIME types, Token Expiry, Rate Limiting). **TUY NHIÊN**, kiến trúc Backend vẫn đang rơi vào tình trạng báo động đỏ do tái diễn "God Controller" và **sự thiếu vắng hoàn toàn các lớp kiểm soát Logic Phân quyền & Cách ly dữ liệu (Data Isolation)**. Nguy cơ lộ lọt dữ liệu chéo (IDOR) ở mức Rất Cao (CRITICAL).

Dưới đây là Bảng đối chiếu (Matrix Report) chuyên sâu cho 4 Trụ cột yêu cầu:

---

### 1. 🚀 ĐÁNH GIÁ HIỆU NĂNG (PERFORMANCE)

| Tiêu chí | Điểm đánh giá | Trạng thái | Minh chứng / Ghi chú |
| :--- | :---: | :---: | :--- |
| **Chia nhỏ God Controller** | 0/10 | $$❌ Chưa Xử Lý$$ | File `V5MasterDataController.php` đang chứa mọi logic từ CRUD Hợp đồng, Upload Google Drive, check Auth, Import đến Export với dung lượng khổng lồ **~6800 dòng code**. Đây là God-Object chống lại mọi nguyên lý SOLID. |
| **N+1 Query & Eager Loading** | 9/10 | $$✅ Đã Fix Tốt$$ | Các API lấy danh sách đã được bọc `->with()` và select đúng cột tối thiểu. Đã bổ sung cơ chế `->paginate($perPage)` chuẩn xác ở nhiều module. Minh chứng: `$query->with(['customer' => fn...])` tại `V5MasterDataController.php` (dòng 24, 30...). |
| **Caching (Danh mục/Phòng ban)** | 0/10 | $$❌ Chưa Xử Lý$$ | Hoàn toàn vắng bóng từ khoá `Cache::remember()` hay Redis ở các API tĩnh như `Department`, `Categories`. |
| **React Re-render (FE)** | 10/10 | $$✅ Đã Fix Tốt$$ | Tuyệt vời. Gần như mọi filters, list data và options đều được đưa vào hook `useMemo`. (Ví dụ: `filteredContracts`, `customerOptions` ở `ContractList.tsx` và `SupportRequestList.tsx`). |
| **Phân trang FE / Virtual Scroll** | 7/10 | $$⚠️ Fix Một Phần$$ | Đã có logic chia trang từ Backend, nhưng các Select dropdown lớn (ví dụ: `employeeFormOptions` chứa cả nghìn user) chưa sử dụng Virtual Scroll, vẫn render list chay có thể gây đơ lag nhẹ ở máy chậm. |
| **Database Index & Partitioning** | 7/10 | $$⚠️ Fix Một Phần$$ | Phân vùng (`Partitioning`) bảng `audit_logs` dựa theo tháng (Khóa chính kép `id, created_at`) là hợp lệ và lý tưởng! Tuy nhiên, quên đánh index cho `created_by` (audit_logs) và `created_by / assignee_id` (Trong `support_requests`). |

---

### 2. 🛡️ ĐÁNH GIÁ BẢO MẬT (SECURITY)

| Tiêu chí | Điểm đánh giá | Trạng thái | Minh chứng / Ghi chú |
| :--- | :---: | :---: | :--- |
| **Token Expiry & Rate Limiting** | 10/10 | $$✅ Đã Fix Tốt$$ | Đã cấu hình `SANCTUM_EXPIRATION` (= 480 phút) và Middleware `throttle:auth.login` (5 request/phút) để chống Brute Force. (File `sanctum.php` & `routes/api.php`). |
| **Data Validation File Upload** | 10/10 | $$✅ Đã Fix Tốt$$ | Hàm `uploadDocumentAttachment` đã bắt chặt cả `mimes:` lẫn `mimetypes:` chuẩn xác với giới hạn `max:20480` (20MB) chặn đứng nguy cơ upload webshell. |
| **Data Exposure (Sensitives)** | 9/10 | $$✅ Đã Fix Tốt$$ | Response Backend hiện tại khá sạch sẽ, chỉ map đúng dữ liệu public (User/Roles) sang phía Front-end chứ không vô lọt hash passwords. |
| **Quyền truy cập ngang (IDOR)** | 0/10 | $$🚨 Rủi Ro Mới Phát Sinh$$ | **LỖI NGHIÊM TRỌNG:** Hacker/Nhân viên chỉ cần thay đổi số ID trên URL là xem được Hợp đồng/Dự án của đơn vị khác. Chức năng `update` / `show` / `delete` chỉ gọi `Contract::query()->findOrFail($id)` mà tuyệt nhiên không có hàm `where('dept_id', getUserDept())`. |
| **Bypass Middleware Authorization**| 0/10 | $$❌ Chưa Xử Lý$$ | Hiện tại không có bất kỳ logic `Gate`, `Policy` (authorize) hay middleware chuyên sâu check quyền trên các Endpoint. Controller đang vận hành public-like cho mọi người đã đăng nhập. |

---

### 3. 🧠 ĐÁNH GIÁ LOGIC NGƯỜI DÙNG & NGHIỆP VỤ (BUSINESS LOGIC)

| Tiêu chí | Điểm đánh giá | Trạng thái | Minh chứng / Ghi chú |
| :--- | :---: | :---: | :--- |
| **Data Isolation (Phạm vi dữ liệu)** | 0/10 | $$❌ Chưa Xử Lý$$ | Có thiết kế bảng cấu hình `user_dept_scopes` (để gán phạm vi phòng ban) nhưng Backend **chưa hề ứng dụng** vào truy vấn. Mọi User lấy danh sách đều thấy toàn bộ cục Data của tổng công ty thay vì bị cô lập theo `from_dept_id/to_dept_id` của bản thân. |
| **RACI Matrix Rules** | 0/10 | $$❌ Chưa Xử Lý$$ | Hoàn toàn chưa có cơ chế kiểm tra chặn quyền A (Approve) hay D (Delete) đối với user chỉ được assign quyền R (Responsible). |
| **Workflow: Sinh kỳ thanh toán** | 3/10 | $$❌ Chưa Xử Lý$$ | Khi update ngày (dòng 2885, file `V5MasterDataController.php`), quy tắc validation chỉ đơn thuẩn là `['nullable', 'date']`. Hoàn toàn không có Rule `after_or_equal:sign_date` cho `expiry_date`. Do đó "Ngày kết thúc < Ngày ký" vẫn lọt qua API đánh sập Procedure `sp_generate_contract_payments`. |
| **Audit Trail (Lưu dấu vết)** | 2/10 | $$❌ Chưa Xử Lý$$ | Bảng `audit_logs` có thiết kế, NHƯNG source Laravel hoàn toàn trống trơn cơ chế ghi nhận (Không thấy Observer, không dùng Auditable trait). Mọi thao tác Thêm/Sửa/Xóa Hợp đồng hiện tại đang "ẩn danh" và bốc hơi, không hề lưu `created_by` (Lịch sử Data chưa được trigger). |

---

### 4. 🎨 ĐÁNH GIÁ TRẢI NGHIỆM NGƯỜI DÙNG (UI/UX)

| Tiêu chí | Điểm đánh giá | Trạng thái | Minh chứng / Ghi chú |
| :--- | :---: | :---: | :--- |
| **User Feedback (Toast)** | 10/10 | $$✅ Đã Fix Tốt$$ | Đã xóa triệt để `alert()` mặc định, thay bằng Component siêu xịn `<ToastContainer />` ở `App.tsx` kèm theme sắc nét cho "thành công/thất bại". |
| **API Error Handling** | 10/10 | $$✅ Đã Fix Tốt$$ | Đã có khối `try/catch` bắt mọi exception từ Service API (`v5Api.ts`), đẩy dữ liệu 400, 403, 500 thành Toast thân thiện. Tuyệt đối không còn tình trạng White Screen (trắng trang) do Uncaught Promise. |
| **Responsive & Layout Overflow** | 10/10 | $$✅ Đã Fix Tốt$$ | Tất cả Table (ContractList, SupportRequestList...) đều được lồng trong `div wrapper` chứa `className="overflow-x-auto"`. Trải nghiệm trên iPad, Laptop 13-inch bao mượt, không bể layout. |
| **Form UX (Loading, Searchable)** | 10/10 | $$✅ Đã Fix Tốt$$ | Nút Submit đã khóa an toàn bằng state `disabled={isSubmitting}` (Ví dụ form `SupportRequestList.tsx` dòng 1500) chống click đúp. Mọi Dropdown dài đều sử dụng components tìm kiếm thông minh (`SearchableSelectOption`). |

### 🛑 KẾT LUẬN & ĐIỀU HƯỚNG ACTION (AUDITOR'S ADVICE)
Hệ thống **Front-End đã đạt tiêu chuẩn Commercial Grade** với UI/UX cực tốt và tối ưu render chuẩn mực. Tuy nhiên **Back-End đang tiềm ẩn rủi ro Sập Server và Leak Data khổng lồ** do gom toàn bộ vào God Controller và vứt bỏ hoàn toàn việc ràng buộc `dept_id` (Phân quyền). 
**Ưu tiên P0:** Bạn phải khẩn cấp chia nhỏ `V5MasterDataController`, nhúng Policies/Gates chặn IDOR thông qua biến `$user->deptScopes()`, và bổ sung Rule so sánh ngày `<` vào Validator. Đẩy Model Observer vào hoạt động để hứng log cho `audit_logs`.
