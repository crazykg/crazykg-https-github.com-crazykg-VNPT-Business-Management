# Testcase — Khách hàng (Customers)
**Ngày:** 2026-03-01
**Module:** CustomerList
**Files:** `frontend/CustomerList.tsx`
**DB Tables:** `customers`

---

## I. UI Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | Table columns | Mở Khách hàng | Columns: STT, Mã KH, Tên KH, Mã số thuế, Địa chỉ, SĐT, Email, Loại KH, Trạng thái, Thao tác |
| UI-02 | Customer type badge | Cột Loại KH | Badge phân biệt (Doanh nghiệp, Cá nhân, etc.) |
| UI-03 | Status badge | Cột trạng thái | ACTIVE = xanh, INACTIVE = xám |
| UI-04 | Action buttons | Cột thao tác | Sửa, Xóa |
| UI-05 | Add button | Header | "Thêm khách hàng" |
| UI-06 | Search box | Ô tìm kiếm | Placeholder: "Tìm theo mã, tên, MST..." |
| UI-07 | Dual-mode indicator | Pagination area | Hiển thị mode Server/Client |
| UI-08 | Pagination controls | > per_page records | Page numbers, prev/next, per_page selector |
| UI-09 | Import/Export | Toolbar | Import Excel, Export Excel/CSV/PDF |
| UI-10 | Empty state | 0 customers | Message empty |
| UI-11 | Modal form | Click Thêm mới | Form đầy đủ: Mã, Tên, MST, Địa chỉ, SĐT, Email, Loại KH, Website |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | Loading skeleton | Mở lần đầu (server mode) | Skeleton loader cho table |
| UX-02 | Search debounce | Gõ nhanh | Không gọi API mỗi keystroke |
| UX-03 | Server query sync | Search/filter → URL query | URL params sync với search/filter state |
| UX-04 | Tax code validation UX | Gõ MST sai format | Inline error ngay dưới field |
| UX-05 | CRUD toast | Thêm/Sửa/Xóa thành công | Toast message feedback |
| UX-06 | Delete confirm | Click Xóa | Dialog confirm |
| UX-07 | Edit pre-fill | Click Sửa | Form filled đầy đủ |
| UX-08 | Modal close | ESC hoặc click overlay | Modal đóng, form reset |
| UX-09 | Import preview | Upload file | Preview trước khi confirm |
| UX-10 | Error handling | API error | Message thân thiện + retry |

---

## III. Logic Test Cases

### III-1. CRUD
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Create valid customer | Mã: "KH001", Tên: "Viettel", MST: "0100109106" | Success |
| LG-02 | Create duplicate code | Mã: "KH001" exists | Error "Mã KH đã tồn tại" |
| LG-03 | Create duplicate tax code | MST: "0100109106" exists | Error "Mã số thuế đã tồn tại" |
| LG-04 | Create invalid email | Email: "abc" | Error "Email không hợp lệ" |
| LG-05 | Create empty required | Tên = "" | Validation error |
| LG-06 | Update customer | Đổi SĐT | Success |
| LG-07 | Delete no relations | Xóa KH không có contracts/opportunities | Success |
| LG-08 | Delete with relations | Xóa KH có contracts | Error "KH đang có hợp đồng" |

### III-2. Search Logic (Dual-mode)
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-09 | Server-mode search | Search "Viettel" | API call `?q=Viettel` |
| LG-10 | Client-mode search | Search "Viettel" (đã load all) | Filter client-side |
| LG-11 | **BUG** searchTerm.trim() inconsistency | "Viettel " (trailing space) | Server mode: trim(), Client mode: có thể không trim → kết quả khác nhau |
| LG-12 | Tax code search case | Search "abc" cho MST | **Tax code search là case-sensitive, trong khi search khác case-insensitive** |
| LG-13 | Search special chars | Search "Công ty (TNHH)" | Không bị lỗi regex |
| LG-14 | Search reset | Xóa search text | Hiển thị all |

### III-3. Dual-mode Pagination
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-15 | Server pagination | Page 2, per_page=20 | API call `?page=2&per_page=20` |
| LG-16 | Server total count | meta.total | Hiển thị "Tổng: X khách hàng" |
| LG-17 | Client pagination | 100 records loaded, page 3 | Records 41-60 |
| LG-18 | Mode switch | Từ server → client | Data giữ nguyên, không re-fetch |
| LG-19 | **BUG** useEffect server query sync | Thay đổi searchTerm | useEffect đồng bộ query → có thể gọi API thừa |

### III-4. Import/Export
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-20 | Import Excel | File .xlsx valid | Import success |
| LG-21 | Import duplicate MST | File có MST đã tồn tại | Report duplicate, skip/overwrite |
| LG-22 | Export Excel | Click Export | File chứa đúng data (all hoặc filtered) |
| LG-23 | Export PDF | Click Export PDF | PDF với table layout |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Initial load (server) | Mở Khách hàng, server mode | First page render | < 1s |
| PF-02 | Search (server) | Gõ search, server mode | API response + render | < 800ms |
| PF-03 | Search (client) | Gõ search, 5000 customers client | Filter + render | < 300ms |
| PF-04 | Page change (server) | Click page 2 | New page data | < 800ms |
| PF-05 | Page change (client) | Click page 2, client mode | Instant re-render | < 100ms |
| PF-06 | Export 5000 records | Export Excel | File download | < 5s |
| PF-07 | Import 500 records | Upload Excel | Import complete | < 10s |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | `searchTerm` | useState | URL query `?q=` |
| DB-02 | Pagination page/perPage | useState | URL query `?page=1&per_page=20` |
| DB-03 | Mode (server/client) | Logic based | URL/preference |
| DB-04 | Sort config | useState | URL query `?sort=name&order=asc` |
| DB-05 | Filter customer type | useState (nếu có) | URL query `?type=ENTERPRISE` |

### V-2. Bug fixes cần ưu tiên

| # | Bug | Mô tả | Priority |
|---|---|---|---|
| BG-01 | searchTerm.trim() inconsistency | Server mode trim, client mode có thể không | HIGH |
| BG-02 | Tax code case-sensitive | Nên case-insensitive cho consistency | MEDIUM |
| BG-03 | useEffect infinite loop potential | Server query sync có thể trigger loop | HIGH |

### V-3. Feature đề xuất

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Customer segment | Phân loại KH (A/B/C theo revenue) | HIGH |
| FT-02 | Customer dashboard | Tổng quan KH (revenue, contracts, opportunities) | MEDIUM |
| FT-03 | Merge duplicate | Gộp KH trùng | HIGH |
| FT-04 | Customer timeline | Xem lịch sử tương tác (contracts, support, projects) | MEDIUM |
| FT-05 | Advanced filter | Filter theo nhiều tiêu chí (revenue range, ngày tạo, loại) | HIGH |
| FT-06 | Map view | Hiển thị KH trên bản đồ theo địa chỉ | LOW |

---

*Generated by Claude Code — 2026-03-01*
