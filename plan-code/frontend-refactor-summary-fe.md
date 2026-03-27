# VNPT Business Frontend - Refactor Summary

## Session Date: 2026-03-26

---

## 1. Flash/Blink Animation Cleanup (ĐÃ THỰC HIỆN)

### Mục tiêu
Loại bỏ hiện tượng flash/blink khi chuyển tab do `animate-fade-in` bị gắn trên các page-level container và section lớn.

### Đã thực hiện
Đã gỡ `animate-fade-in` khỏi các vùng render toàn trang như:
- page root wrappers
- page headers
- stats/KPI grids
- content wrappers
- loading skeleton wrappers gắn với page mount

### Các file đã cleanup
- `frontend/components/ReminderList.tsx`
- `frontend/components/EmployeeList.tsx`
- `frontend/components/DepartmentList.tsx`
- `frontend/components/ProjectList.tsx`
- `frontend/components/DocumentList.tsx`
- `frontend/components/ContractList.tsx`
- `frontend/components/AuditLogList.tsx`
- `frontend/components/UserDeptHistoryList.tsx`
- `frontend/src/components/Dashboard.tsx`
- `frontend/components/InternalUserDashboard.tsx`
- `frontend/components/BusinessList.tsx`
- `frontend/components/IntegrationSettingsPanel.tsx`
- `frontend/components/SupportMasterManagement.tsx`
- cùng các page/list liên quan đã được rà thêm trong quá trình cleanup

### Chủ ý giữ lại
Vẫn giữ animation ở các chỗ phù hợp với interaction:
- dropdown/import/export menus
- modal/dialog surfaces
- sidebar collapse/expand affordances
- các overlay/panel chỉ xuất hiện sau user action

### Kết quả
- Giảm hiện tượng nháy toàn trang khi đổi tab
- Không loại bỏ các animation mang tính phản hồi UI cần thiết

---

## 2. Router Migration theo mô hình hybrid path-based (ĐÃ THỰC HIỆN)

### Mục tiêu
Hoàn thiện deep link, refresh, browser back/forward theo `react-router-dom` v6 nhưng vẫn giữ `App.tsx` làm source of truth cho data loading và page rendering.

### Kiến trúc đã chốt
Áp dụng mô hình **hybrid routing**:
- URL path là nguồn điều hướng bên ngoài
- `activeTab` vẫn là nguồn quyết định render page trung tâm
- `App.tsx` vẫn giữ toàn bộ data loading / CRUD chính
- không làm big-bang rewrite sang full route-per-page

### Các phần đã hoàn tất
- `frontend/index.tsx` dùng `AppWithRouter`
- `frontend/AppWithRouter.tsx` làm router wrapper
- `frontend/App.tsx` có mapping 2 chiều giữa `tabId` và `pathname`
- `frontend/App.tsx` đồng bộ `URL -> activeTab`
- user action điều hướng dùng handler riêng để đổi cả tab và route tại boundary
- `frontend/components/Sidebar.tsx` đã bỏ logic điều hướng trùng lặp, dùng callback điều hướng từ app shell
- `frontend/router/routes.tsx` được làm sạch để phản ánh đúng runtime hybrid hiện tại
- `frontend/router/ProtectedRoute.tsx` được giữ như infrastructure/reference cho hướng route-tree đầy đủ sau này, chưa ép vào auth gate chính của runtime hiện tại

### Vấn đề quan trọng đã xử lý
Tránh infinite loop giữa state và URL bằng cách **không** dùng cơ chế bidirectional sync bằng 2 effect đối xứng.

Giải pháp đang dùng:
- effect chỉ sync từ `location.pathname` sang `activeTab`
- điều hướng từ thao tác người dùng dùng hàm điều hướng riêng, không thêm effect `activeTab -> navigate()` chung chung

### Kết quả đạt được
- hỗ trợ deep link theo path
- refresh vẫn giữ đúng màn hình
- browser back/forward hoạt động theo path
- router scaffolding không còn ở trạng thái placeholder gây nhiễu như trước

---

## 3. Tách `AppPages.tsx` để giảm tải `App.tsx` (ĐÃ THỰC HIỆN)

### Mục tiêu
Tách phần conditional rendering của page ra khỏi `App.tsx` nhưng không di chuyển data loading khỏi file gốc.

### Đã thực hiện
- tạo `frontend/AppPages.tsx`
- chuyển phần page rendering sang `AppPages.tsx`
- giữ `App.tsx` là nơi quản lý auth, data loading, CRUD handlers, modal flow, toast, URL sync

### Kết quả
- giảm bớt khối lượng render logic trong `App.tsx`
- tách rõ hơn phần orchestration và phần render page
- chuẩn bị nền cho các refactor nhỏ tiếp theo nếu cần

---

## 4. Verification (ĐÃ THỰC HIỆN)

### Static verification
Đã chạy trong `frontend/`:
- `npm run lint`
- `npm run build`

### Kết quả
- `npm run lint` ✅ pass
- `npm run build` ✅ pass

---

## 5. Trạng thái hiện tại

### Đã hoàn thành trong đợt này
1. ✅ Cleanup animation gây flash/blink ở page-level containers
2. ✅ Hoàn thiện hybrid router sync theo path-based navigation
3. ✅ Làm sạch router scaffolding để phản ánh đúng runtime hiện tại
4. ✅ Tách `AppPages.tsx` khỏi `App.tsx`
5. ✅ Pass type-check và production build

### Chưa làm trong đợt này
Các phần dưới đây chủ động **chưa triển khai** để giữ scope an toàn:
- migrate data loading sang route loaders
- chuyển sang full route-per-page tree
- tách thêm data hooks/page hooks mới
- mở rộng URL query sync cho toàn bộ filter/sort/pagination
- code splitting optimization sâu hơn ngoài mức hiện tại

---

## 6. Scope Guardrails đã giữ đúng

- `App.tsx` vẫn là source of truth cho data loading và CRUD
- không chuyển sang nested route tree toàn phần
- không đụng sang loader architecture
- không mở rộng refactor vượt quá nhu cầu cleanup/router completion

---

## 7. Kiểm thử thủ công nên tiếp tục thực hiện

### Animation/UI
- [ ] Chuyển nhanh giữa các tab chính và xác nhận không còn flash/blink toàn page
- [ ] Kiểm tra dropdown/import/export vẫn còn animation hợp lý
- [ ] Kiểm tra modal open/close vẫn ổn
- [ ] Kiểm tra sidebar collapse/expand vẫn mượt

### Router
- [ ] Điều hướng sidebar làm đổi URL đúng
- [ ] Browser back/forward hoạt động đúng
- [ ] Refresh ở deep path như `/contracts`, `/projects`, `/customer-request-management` vẫn đúng màn hình
- [ ] Path không hợp lệ fallback đúng
- [ ] Login/logout từ route sâu vẫn về route hợp lệ

---

## 8. Hướng tiếp theo nếu làm tiếp

### Ưu tiên hợp lý tiếp theo
1. Manual QA cho hybrid router và deep-link flows
2. URL query sync cho filter/sort/pagination ở các module quan trọng
3. Chỉ khi thật sự cần mới cân nhắc route loaders hoặc page-level extraction sâu hơn

### Không nên làm ngay
- full rewrite sang route-per-page
- dời data loading khỏi `App.tsx` theo kiểu big-bang
- refactor lan rộng không gắn với bug hoặc nhu cầu điều hướng cụ thể

---

## Summary

Đợt này đã hoàn tất phần dang dở chính của kế hoạch frontend refactor theo hướng an toàn:
- xử lý blink/flash do animation mount-level
- hoàn thiện path-based navigation theo mô hình hybrid
- giữ nguyên kiến trúc data loading tập trung trong `App.tsx`
- xác nhận build/type-check đều pass

Phần còn lại chủ yếu là manual QA và các cải tiến tùy chọn cho giai đoạn sau, không còn blocker kỹ thuật từ phần refactor vừa thực hiện.
