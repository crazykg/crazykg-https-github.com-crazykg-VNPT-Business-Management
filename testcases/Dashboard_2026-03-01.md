# Testcase — Dashboard (HR Dashboard + Danh sách nhân sự)
**Ngày:** 2026-03-01
**Module:** Dashboard, InternalUserModuleTabs, InternalUserDashboard, EmployeeList
**Files:** `frontend/Dashboard.tsx`, `frontend/InternalUserModuleTabs.tsx`, `frontend/InternalUserDashboard.tsx`, `frontend/EmployeeList.tsx`
**DB Tables:** `internal_users`, `departments`, `positions`, `position_default_roles`

---

## I. UI Test Cases

### I-1. KPI Finance Cards (Dashboard.tsx)
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | Hiển thị 4 KPI cards | Mở Dashboard, kiểm tra 4 card: Doanh thu, Hợp đồng, Pipeline, Dự án | 4 cards hiển thị đầy đủ với icon, label, giá trị, đơn vị |
| UI-02 | Format tiền VND | Giá trị trên KPI card | Hiển thị đúng format VND (dấu chấm ngàn, suffix "đ") |
| UI-03 | Responsive cards | Thu nhỏ màn hình < 768px | Cards xếp 2 cột hoặc 1 cột, không bị tràn |

### I-2. Monthly Revenue Chart
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-04 | Hiển thị bar chart doanh thu | Xem biểu đồ doanh thu theo tháng | 12 cột tương ứng 12 tháng, chiều cao tỷ lệ với giá trị |
| UI-05 | Tooltip khi hover bar | Hover lên cột tháng | Hiển thị tooltip với giá trị chính xác |
| UI-06 | Empty state chart | Không có dữ liệu doanh thu | Hiển thị message "Không có dữ liệu" hoặc chart trống có labels |

### I-3. Pipeline Pie Chart
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-07 | Hiển thị pie chart pipeline | Xem phân bổ cơ hội theo stage | Pie chart với gradient colors, legend bên cạnh |
| UI-08 | Hover segment thay đổi activeStage | Hover lên slice | Slice phóng to, hiển thị % và giá trị |
| UI-09 | Click segment filter | Click vào slice pie | activeStage thay đổi, các component liên quan filter theo |

### I-4. Project Status Bars
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-10 | Hiển thị stacked bar trạng thái dự án | Xem biểu đồ | Các bar xếp chồng theo status (Active, Completed, Suspended...) |
| UI-11 | Legend colors mapping | So sánh legend và bar | Mỗi status có color consistent giữa legend và bar |

### I-5. HR Dashboard (InternalUserDashboard.tsx)
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-12 | Gender pie chart | Mở tab Dashboard nhân sự | Pie chart giới tính hiển thị đúng tỷ lệ Nam/Nữ |
| UI-13 | Position bar chart | Xem top chức vụ | Bar chart top 8 chức vụ, sorted descending |
| UI-14 | Department bar chart | Xem phân bổ phòng ban | Bar chart top 8 phòng ban theo số nhân viên |
| UI-15 | Tổng nhân viên header | Kiểm tra header | Hiển thị "Tổng: X nhân viên" chính xác |

### I-6. Tab Switcher (InternalUserModuleTabs.tsx)
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-16 | 2 tabs hiển thị | Mở module nhân sự | 2 tab: "Dashboard" và "Danh sách nhân sự" |
| UI-17 | Active tab highlight | Click tab | Tab được chọn có underline/bold, tab kia bình thường |
| UI-18 | Content switch | Click qua lại giữa 2 tab | Nội dung thay đổi tương ứng, không flicker |

### I-7. Employee List (EmployeeList.tsx)
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-19 | Table columns | Mở danh sách nhân sự | Columns: STT, Mã NV, Họ tên, Phòng ban, Chức vụ, Email, SĐT, Trạng thái |
| UI-20 | Pagination controls | Có > 10 nhân viên | Hiển thị pagination với page numbers, prev/next |
| UI-21 | Status badge colors | Xem cột trạng thái | ACTIVE = xanh, INACTIVE = đỏ, ON_LEAVE = vàng |
| UI-22 | Empty state | Không có nhân viên nào | Hiển thị "Không có dữ liệu" với icon |
| UI-23 | Search box | Kiểm tra ô tìm kiếm | Placeholder text rõ ràng, icon search |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | Loading state Dashboard | Mở Dashboard lần đầu | Skeleton loader hoặc spinner trong khi fetch data |
| UX-02 | Tab persistence | Đang ở tab "Danh sách", chuyển menu khác rồi quay lại | Giữ nguyên tab đang xem (hoặc reset về Dashboard) |
| UX-03 | Search debounce | Gõ nhanh trong ô tìm kiếm nhân sự | Không gọi API mỗi keystroke, debounce 300-500ms |
| UX-04 | Sort feedback | Click header column để sort | Icon mũi tên hiển thị hướng sort (asc/desc) |
| UX-05 | Pagination UX | Click page number | Scroll lên đầu table, loading indicator |
| UX-06 | Filter clear | Có filter đang active | Nút "Xóa bộ lọc" visible, click reset tất cả |
| UX-07 | Export feedback | Click export Excel/CSV | Toast message "Đang xuất file..." rồi auto-download |
| UX-08 | Import flow | Click import | Dialog chọn file → preview data → confirm → kết quả |
| UX-09 | Responsive table | Màn hình nhỏ < 1024px | Table có horizontal scroll, sticky first column |
| UX-10 | Error state API | API trả lỗi 500 | Hiển thị error message thân thiện, nút retry |

---

## III. Logic Test Cases

### III-1. Employee Search Logic
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Search theo mã NV | Gõ "NV001" | Chỉ hiện nhân viên có mã chứa "NV001" |
| LG-02 | Search theo tên (Vietnamese) | Gõ "Nguyễn" | Tất cả nhân viên họ Nguyễn (case-insensitive) |
| LG-03 | Search multi-field OR | Gõ "0901" | Match SĐT chứa "0901" HOẶC các field khác |
| LG-04 | Search 9 fields OR logic | Gõ keyword | Tìm trong: employee_code, full_name, email, phone, position, department, username, status, notes |
| LG-05 | Search empty string | Xóa hết text search | Hiển thị toàn bộ danh sách |
| LG-06 | Vietnamese locale sort | Sort theo họ tên | "Ă" trước "B", "Đ" giữa "D" và "E" |

### III-2. Dual-mode Pagination
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-07 | Server-side pagination | Chuyển page | Gọi API `?page=2&per_page=10` |
| LG-08 | Client-side filter + pagination | Filter status = ACTIVE | Filter trên toàn bộ client data, pagination trên filtered result |
| LG-09 | Page overflow | Đang page 5, filter giảm còn 2 pages | Tự chuyển về page 1 |
| LG-10 | Per page change | Đổi từ 10 → 50 items/page | Reset về page 1, load đúng 50 items |

### III-3. Import Logic
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-11 | Import Excel valid | Upload file .xlsx đúng format | Tất cả records imported, toast success |
| LG-12 | Import duplicate detection | Upload file có mã NV đã tồn tại | Thông báo X records trùng, hỏi overwrite/skip |
| LG-13 | Import invalid format | Upload file .docx | Error message "Định dạng file không hỗ trợ" |
| LG-14 | Position code normalization | Import với "P1" | Tự động normalize thành "POS001" |

### III-4. Export Logic
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-15 | Export Excel | Click "Xuất Excel" | File .xlsx chứa đúng data đang hiển thị |
| LG-16 | Export CSV | Click "Xuất CSV" | File .csv UTF-8 BOM, mở đúng tiếng Việt |
| LG-17 | Export PDF | Click "Xuất PDF" | File .pdf có header, table, pagination |
| LG-18 | **BUG** Export data source | Export khi có filter | **Hiện tại:** Export dùng `filteredEmployees` thay vì `currentData` (page hiện tại) → export toàn bộ filtered, không chỉ trang đang xem. **Cần verify behavior mong muốn.** |

### III-5. Dashboard Statistics
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-19 | buildHrStatistics accuracy | So sánh dashboard vs raw data | Tổng nhân viên = count(*) WHERE deleted_at IS NULL |
| LG-20 | Top 8 department/position | Có > 8 phòng ban | Chỉ hiển thị top 8 theo số lượng, phần còn lại gom "Khác" |
| LG-21 | Gender ratio | Kiểm tra pie chart | Tỷ lệ = count theo gender / tổng * 100% |
| LG-22 | **BUG** `listEmployees \|\| employees` fallback | Tab module data | Nếu `listEmployees` undefined, fallback `employees` có thể là data cũ/khác source |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Dashboard initial load | Mở Dashboard lần đầu | Tất cả KPI render xong | < 2s |
| PF-02 | HR Dashboard render | Mở tab Dashboard nhân sự | Charts render hoàn tất | < 1.5s |
| PF-03 | Employee list 1000+ records | Load danh sách lớn | Table render smooth | < 1s cho 1 page |
| PF-04 | Search performance | Gõ search với 5000 employees (client mode) | Filter result hiển thị | < 300ms |
| PF-05 | Sort performance | Sort 5000 employees | Sorted result render | < 500ms |
| PF-06 | Export 5000 records Excel | Export large dataset | File generated + download | < 5s |
| PF-07 | **ISSUE** `buildPieGradient` không memoized | Pie chart re-render mỗi state change | Gradient tính lại mỗi render | Cần wrap `useMemo` |
| PF-08 | Chart hover performance | Hover nhanh qua nhiều segments | Không lag/jank | 60fps |
| PF-09 | Tab switch speed | Click qua lại Dashboard ↔ List | Content switch tức thì | < 200ms |
| PF-10 | Memory usage | Mở Dashboard + Employee List lâu | Không memory leak | Stable sau 10 phút |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State cần persist

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | `activeStage` (Pipeline focus) | useState, mất khi F5 | Lưu vào `user_preferences` table hoặc localStorage |
| DB-02 | `searchTerm` Employee List | useState, reset khi chuyển tab | Lưu vào URL query params `?q=keyword` |
| DB-03 | Sort column + direction | useState, reset mỗi lần mở | Lưu vào `user_preferences` per module |
| DB-04 | Items per page preference | Hardcode hoặc useState | Lưu vào `user_preferences` |
| DB-05 | Active tab (Dashboard vs List) | useState, luôn reset | Lưu vào URL route hoặc `user_preferences` |
| DB-06 | Dashboard date range filter | Không có filter theo khoảng thời gian | Thêm filter + lưu preference |

### V-2. Đề xuất bảng mới

```sql
CREATE TABLE user_preferences (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  module VARCHAR(50) NOT NULL,        -- 'dashboard', 'employee_list'
  preference_key VARCHAR(100) NOT NULL, -- 'sort_column', 'per_page', 'active_tab'
  preference_value JSON,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_module_key (user_id, module, preference_key),
  FOREIGN KEY (user_id) REFERENCES internal_users(id) ON DELETE CASCADE
);
```

### V-3. Feature đề xuất bổ sung

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Dashboard filter theo thời gian | Cho phép chọn tháng/quý/năm cho KPI | HIGH |
| FT-02 | Bookmark/Pin dashboard widgets | User tùy chỉnh layout dashboard | MEDIUM |
| FT-03 | Employee list column visibility | User chọn cột hiển thị | MEDIUM |
| FT-04 | Export template customization | Cho phép chọn cột khi export | LOW |
| FT-05 | Employee quick view | Click row xem chi tiết không cần mở form | MEDIUM |

---

*Generated by Claude Code — 2026-03-01*
