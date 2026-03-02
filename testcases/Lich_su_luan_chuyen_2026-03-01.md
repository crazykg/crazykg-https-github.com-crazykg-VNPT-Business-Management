# Testcase — Lịch sử luân chuyển (Transfer History)
**Ngày:** 2026-03-01
**Module:** UserDeptHistoryList
**Files:** `frontend/UserDeptHistoryList.tsx`
**DB Tables:** `user_dept_history`, `internal_users`, `departments`

---

## I. UI Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | Table columns | Mở Lịch sử luân chuyển | Columns: STT, Mã luân chuyển, Nhân viên, Phòng ban cũ, Phòng ban mới, Ngày chuyển, Ghi chú |
| UI-02 | Transfer code format | Kiểm tra cột mã | Format "LC-YYYY-XXXX" (normalizeTransferCode) |
| UI-03 | Employee name display | Kiểm tra cột nhân viên | Hiển thị tên đầy đủ (lookup từ internal_users) |
| UI-04 | Department name display | Kiểm tra cột phòng ban cũ/mới | Hiển thị tên phòng ban (lookup từ departments) |
| UI-05 | Date format | Kiểm tra cột ngày chuyển | Format DD/MM/YYYY hoặc YYYY-MM-DD nhất quán |
| UI-06 | Pagination | Có > 10 records | Hiển thị pagination, 10 items/page (hardcode) |
| UI-07 | Empty state | Không có lịch sử luân chuyển | Message "Không có dữ liệu" |
| UI-08 | Search box | Kiểm tra ô tìm kiếm | Placeholder rõ ràng, icon search |
| UI-09 | Notes column | Ghi chú dài > 100 ký tự | Truncate với "..." hoặc tooltip full text |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | Loading state | Mở lần đầu | Spinner hoặc skeleton loader |
| UX-02 | Search realtime | Gõ tên nhân viên | Filter ngay khi gõ (debounce) |
| UX-03 | No sort available | Click header column | **Hiện tại không có sort** — cần thêm sort theo ngày, nhân viên |
| UX-04 | No export available | Kiểm tra buttons | **Hiện tại không có export** — cần thêm Excel/CSV export |
| UX-05 | Pagination feedback | Click page 2 | Highlight page hiện tại, table update |
| UX-06 | Error handling | API fail | Error message thân thiện, retry button |
| UX-07 | Click row detail | Click vào 1 row | Không có detail view — cần thêm |

---

## III. Logic Test Cases

### III-1. Search Logic
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Search theo tên NV | "Nguyễn Văn" | Tất cả transfers của NV có tên chứa "Nguyễn Văn" |
| LG-02 | Search theo mã LC | "LC-2025" | Tất cả mã luân chuyển chứa "LC-2025" |
| LG-03 | Search theo phòng ban | "Kỹ thuật" | Transfers có phòng ban cũ hoặc mới chứa "Kỹ thuật" |
| LG-04 | Search empty | Xóa search text | Hiển thị tất cả records |
| LG-05 | Search case-insensitive | "nguyen" vs "Nguyen" | Cùng kết quả |

### III-2. normalizeTransferCode
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-06 | Code format valid | Raw data code | Output "LC-YYYY-XXXX" |
| LG-07 | Code null/empty | code = null | Hiển thị "-" hoặc "N/A" |
| LG-08 | Code already formatted | "LC-2025-0001" | Giữ nguyên, không double-format |

### III-3. Lookup Logic
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-09 | Employee lookup valid | user_id có trong internal_users | Hiển thị full_name |
| LG-10 | Employee lookup missing | user_id không tồn tại | Hiển thị ID hoặc "Không xác định" |
| LG-11 | Department lookup valid | dept_id có trong departments | Hiển thị dept name |
| LG-12 | Department lookup missing | dept_id = null | Hiển thị "-" |

### III-4. Pagination Logic
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-13 | Page calculation | 25 records, 10/page | 3 pages (10, 10, 5) |
| LG-14 | Page 1 content | Mở lần đầu | Records 1-10 |
| LG-15 | Last page | Chuyển page cuối | Records 21-25 (5 items) |
| LG-16 | Search + pagination reset | Search khi đang page 3 | Reset về page 1 |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Initial load | Mở lịch sử luân chuyển | Data render xong | < 1s |
| PF-02 | Search filter | Gõ search 500 records | Results hiển thị | < 200ms |
| PF-03 | Pagination switch | Click page mới | Table update | < 100ms |
| PF-04 | Employee/Dept lookup | Render 1 page (10 rows) | Lookup hoàn tất | < 50ms |
| PF-05 | Large dataset | 10,000 transfer records | Client-side filter responsive | < 500ms |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State cần persist

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | `searchTerm` | useState, mất khi chuyển menu | Lưu vào URL query `?q=keyword` |
| DB-02 | `currentPage` | useState, reset mỗi lần mở | Lưu vào URL query `?page=2` |
| DB-03 | Sort preference | **Không có sort** | Cần thêm sort + lưu preference |

### V-2. Feature chưa implement cần thêm

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Sort theo cột | Sort theo ngày, nhân viên, phòng ban | HIGH |
| FT-02 | Export Excel/CSV | Xuất lịch sử luân chuyển | HIGH |
| FT-03 | Filter theo ngày | DateRange filter (từ ngày - đến ngày) | HIGH |
| FT-04 | Filter theo phòng ban | Dropdown chọn phòng ban | MEDIUM |
| FT-05 | Detail view | Click row xem chi tiết luân chuyển | MEDIUM |
| FT-06 | Bulk transfer | Luân chuyển nhiều NV cùng lúc | LOW |
| FT-07 | Transfer statistics | Thống kê số lượng luân chuyển theo tháng/phòng ban | LOW |

### V-3. DB Optimization

```sql
-- Thêm index cho query filter phổ biến
ALTER TABLE user_dept_history
  ADD INDEX idx_udh_user_date (user_id, changed_at),
  ADD INDEX idx_udh_dept_from (from_department_id),
  ADD INDEX idx_udh_dept_to (to_department_id);
```

---

*Generated by Claude Code — 2026-03-01*
