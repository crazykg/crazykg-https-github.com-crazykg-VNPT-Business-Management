# Testcase — Đầu mối liên hệ (Customer Personnel / Contacts)
**Ngày:** 2026-03-01
**Module:** CusPersonnelList
**Files:** `frontend/CusPersonnelList.tsx`
**DB Tables:** `customer_personnel`, `customers`

---

## I. UI Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | Table columns | Mở Đầu mối LH | Columns: STT, Khách hàng, Họ tên, Chức vụ, SĐT, Email, Ghi chú, Thao tác |
| UI-02 | Customer name lookup | Cột Khách hàng | Hiển thị tên KH (lookup từ customers list) |
| UI-03 | Phone clickable | Cột SĐT | Link `tel:` — click gọi điện |
| UI-04 | Email clickable | Cột Email | Link `mailto:` — click gửi mail |
| UI-05 | Action buttons | Cột thao tác | Sửa, Xóa |
| UI-06 | Add button | Header | "Thêm đầu mối" |
| UI-07 | Advanced filters | Filter area | Filter: SĐT, Email, Chức vụ |
| UI-08 | Search box | Ô tìm kiếm | Search multi-field |
| UI-09 | Pagination | Custom pagination, > 10 records | Page controls |
| UI-10 | Empty state | 0 contacts | Empty message |
| UI-11 | Modal form | Click Thêm mới | Form: Khách hàng (dropdown), Họ tên, Chức vụ, SĐT, Email, Ghi chú |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | Customer dropdown searchable | Mở form, chọn KH | SearchableSelect với tìm kiếm |
| UX-02 | Phone link feedback | Click SĐT | Mở app gọi điện (mobile) hoặc copy (desktop) |
| UX-03 | Email link feedback | Click Email | Mở mail client |
| UX-04 | Filter clear all | Có filter active | Nút clear tất cả filters |
| UX-05 | Delete confirm | Click Xóa | Confirm dialog |
| UX-06 | Edit pre-fill | Click Sửa | Form filled, KH dropdown chọn đúng |
| UX-07 | CRUD toast | Thêm/Sửa/Xóa | Toast feedback |
| UX-08 | Loading state | Mở lần đầu | Spinner |
| UX-09 | Responsive table | < 768px | Horizontal scroll, key columns visible |
| UX-10 | Filter combination | Phone + Email filter | AND logic: cả 2 điều kiện phải match |

---

## III. Logic Test Cases

### III-1. CRUD
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Create valid contact | KH: "Viettel", Tên: "Nguyễn A", SĐT: "0901234567" | Success |
| LG-02 | Create without customer | Không chọn KH | Validation error "Vui lòng chọn khách hàng" |
| LG-03 | Create empty name | Tên = "" | Validation error |
| LG-04 | Create invalid phone | SĐT: "abc" | Error "SĐT không hợp lệ" |
| LG-05 | Create invalid email | Email: "notanemail" | Error "Email không hợp lệ" |
| LG-06 | Update contact | Đổi SĐT | Success |
| LG-07 | Delete contact | Xóa 1 đầu mối | Success |

### III-2. Search & Filter
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-08 | Search by name | "Nguyễn" | Tất cả contacts họ Nguyễn |
| LG-09 | Search by customer name | "Viettel" | Contacts thuộc KH Viettel |
| LG-10 | Filter by phone | SĐT: "0901" | Contacts có SĐT chứa "0901" |
| LG-11 | Filter by email | Email: "@viettel" | Contacts có email chứa "@viettel" |
| LG-12 | Filter by position | Chức vụ: "Giám đốc" | Contacts có chức vụ "Giám đốc" |
| LG-13 | Combined filters | Phone + Email + Search | AND logic |
| LG-14 | Filter reset | Clear all filters | Show all contacts |

### III-3. CRITICAL BUGS
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-15 | **CRITICAL BUG** setState during render | Lines 120-122: setState gọi trong render phase | **Gây infinite re-render loop**. Fix: di chuyển vào useEffect |
| LG-16 | **PERF BUG** Customer lookup O(n*m) | n contacts × m customers | Mỗi row tìm customer bằng .find() → O(n*m). Fix: dùng Map |

### III-4. Pagination
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-17 | Custom pagination | Custom component (không phải PaginationControls) | Hoạt động đúng |
| LG-18 | Page overflow | Filter giảm records, đang page cao | Reset page 1 |
| LG-19 | Filter + pagination | Filter rồi chuyển page | Page trên filtered results |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Initial load | Mở Đầu mối LH | Render complete | < 1s |
| PF-02 | **CRITICAL** setState re-render | Nếu bug LG-15 active | Infinite loop, browser hang | **PHẢI FIX** |
| PF-03 | **ISSUE** Customer lookup O(n*m) | 1000 contacts, 500 customers | Render mỗi page | Cần Map O(1) lookup |
| PF-04 | Search 1000 contacts | Gõ search | Filter result | < 300ms |
| PF-05 | Filter combo | 3 filters active, 1000 contacts | Result render | < 300ms |
| PF-06 | Pagination switch | Click page | Table update | < 100ms |
| PF-07 | Memory usage | Mở lâu với bug setState | Memory leak potential | Monitor heap |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | `searchTerm` | useState | URL query param |
| DB-02 | `phoneFilter`, `emailFilter`, `positionFilter` | useState | URL query params |
| DB-03 | Current page | useState | URL query param |

### V-2. Critical Bugs cần fix ngay

| # | Bug | Impact | Priority |
|---|---|---|---|
| BG-01 | setState during render (lines 120-122) | Infinite re-render, browser crash | **CRITICAL** |
| BG-02 | Customer lookup O(n*m) | Slow render với large dataset | HIGH |

### V-3. Feature đề xuất

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Contact grouping by customer | Nhóm contacts theo KH | HIGH |
| FT-02 | Contact activity log | Lịch sử tương tác (gọi điện, email) | MEDIUM |
| FT-03 | VCard export | Xuất danh bạ vCard (.vcf) | LOW |
| FT-04 | Bulk import contacts | Import danh sách đầu mối từ Excel | HIGH |
| FT-05 | Primary contact flag | Đánh dấu đầu mối chính cho mỗi KH | HIGH |
| FT-06 | Contact notes/tags | Ghi chú, tag cho đầu mối | MEDIUM |
| FT-07 | Duplicate detection | Phát hiện contact trùng (SĐT/email) | HIGH |

### V-4. DB Optimization

```sql
-- Thêm index cho filter phổ biến
ALTER TABLE customer_personnel
  ADD INDEX idx_cp_customer (customer_id),
  ADD INDEX idx_cp_phone (phone),
  ADD INDEX idx_cp_email (email);
```

---

*Generated by Claude Code — 2026-03-01*
