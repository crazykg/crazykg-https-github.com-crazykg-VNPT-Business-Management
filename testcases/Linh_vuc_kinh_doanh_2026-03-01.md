# Testcase — Lĩnh vực Kinh doanh (Business Domains)
**Ngày:** 2026-03-01
**Module:** BusinessList
**Files:** `frontend/BusinessList.tsx`
**DB Tables:** `business_domains`

---

## I. UI Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | Table columns | Mở Lĩnh vực KD | Columns: STT, Mã lĩnh vực, Tên lĩnh vực, Mô tả, Trạng thái, Thao tác |
| UI-02 | Action buttons | Cột thao tác | Nút Sửa (icon edit), Xóa (icon delete) |
| UI-03 | Add button | Header | Nút "Thêm mới" nổi bật |
| UI-04 | Status badge | Cột trạng thái | ACTIVE = xanh, INACTIVE = xám |
| UI-05 | Search box | Kiểm tra ô tìm kiếm | Tìm kiếm theo mã hoặc tên |
| UI-06 | Sort indicators | Click header column | Mũi tên asc/desc hiển thị |
| UI-07 | Pagination | Có > 10 records | PaginationControls hiển thị |
| UI-08 | Empty state | Không có lĩnh vực nào | Message + icon empty |
| UI-09 | Import/Export buttons | Header toolbar | Nút Import, Export Excel, Export CSV |
| UI-10 | Modal form | Click "Thêm mới" | Modal hiển thị form với: Mã, Tên, Mô tả |
| UI-11 | Modal validation errors | Submit form trống | Hiển thị error message dưới field |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | CRUD flow complete | Thêm → Sửa → Xóa 1 record | Mỗi bước có feedback (toast success) |
| UX-02 | Delete confirmation | Click xóa | Dialog "Bạn có chắc chắn muốn xóa?" |
| UX-03 | Form auto-focus | Mở modal thêm mới | Focus vào field đầu tiên (Mã lĩnh vực) |
| UX-04 | Modal close | Click X hoặc overlay | Modal đóng, form reset |
| UX-05 | Edit pre-fill | Click sửa record | Form điền sẵn data hiện tại |
| UX-06 | Search instant | Gõ search | Filter ngay (debounce) |
| UX-07 | Export feedback | Click export | Toast + auto-download |
| UX-08 | Import preview | Upload file | Preview data trước khi import |
| UX-09 | Sort persistence | Sort theo tên, chuyển page | Sort giữ nguyên khi chuyển page |
| UX-10 | Loading overlay | Submit form | Button disabled + spinner |

---

## III. Logic Test Cases

### III-1. CRUD Operations
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Create valid | Mã: "LV001", Tên: "Viễn thông" | Record tạo thành công, list refresh |
| LG-02 | Create duplicate code | Mã: "LV001" (đã tồn tại) | Error "Mã lĩnh vực đã tồn tại" |
| LG-03 | Create empty name | Tên: "" | Validation error "Tên không được để trống" |
| LG-04 | Update valid | Đổi tên "Viễn thông" → "Viễn thông di động" | Record update, list refresh |
| LG-05 | Delete unused | Xóa lĩnh vực không có sản phẩm liên kết | Xóa thành công |
| LG-06 | Delete in-use | Xóa lĩnh vực có sản phẩm liên kết | Error "Không thể xóa, đang được sử dụng" |

### III-2. Search Logic
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-07 | Search by domain_code | "LV" | Tất cả lĩnh vực có mã chứa "LV" |
| LG-08 | Search by name | "Viễn thông" | Match tên lĩnh vực |
| LG-09 | Search Vietnamese diacritics | "vien thong" (không dấu) | Nên match "Viễn thông" |
| LG-10 | Search no result | "ZZZZZ" | Hiển thị "Không tìm thấy" |

### III-3. Sort Logic
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-11 | Sort by code ASC | Click header "Mã lĩnh vực" | A-Z sort |
| LG-12 | Sort by code DESC | Click lần 2 | Z-A sort |
| LG-13 | Sort by name Vietnamese | Sort theo tên | Đúng locale sort tiếng Việt |
| LG-14 | Sort reset | Click header lần 3 | Reset về default order |

### III-4. Import Logic
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-15 | Import Excel valid | File .xlsx đúng format | Import all records |
| LG-16 | Import duplicate | File có mã đã tồn tại | Báo duplicate, skip hoặc overwrite |
| LG-17 | Import invalid columns | File thiếu cột bắt buộc | Error chi tiết dòng nào lỗi |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Initial load | Mở lĩnh vực KD | Render xong | < 500ms |
| PF-02 | Search filter | 100 lĩnh vực, gõ search | Filter result | < 100ms |
| PF-03 | Create response | Submit form thêm mới | API response + list refresh | < 1s |
| PF-04 | Export 100 records | Export Excel | File download | < 2s |
| PF-05 | Sort 100 records | Click sort | Sorted render | < 100ms |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | `searchTerm` | useState | URL query `?q=` |
| DB-02 | Sort column + direction | useState | URL query `?sort=name&order=asc` |
| DB-03 | Current page | useState | URL query `?page=1` |

### V-2. Feature đề xuất

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Status toggle inline | Toggle ACTIVE/INACTIVE trực tiếp trên list | HIGH |
| FT-02 | Bulk delete | Chọn nhiều lĩnh vực → xóa cùng lúc | MEDIUM |
| FT-03 | Description rich text | Mô tả hỗ trợ HTML/markdown | LOW |
| FT-04 | Product count display | Hiển thị số sản phẩm liên kết mỗi lĩnh vực | MEDIUM |
| FT-05 | Audit trail | Lưu lịch sử ai tạo/sửa/xóa khi nào | HIGH |

---

*Generated by Claude Code — 2026-03-01*
