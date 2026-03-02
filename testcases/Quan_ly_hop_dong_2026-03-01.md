# Testcase — Quản lý Hợp đồng (Contract Management)
**Ngày:** 2026-03-01
**Module:** ContractList
**Files:** `frontend/ContractList.tsx`
**DB Tables:** `contracts`, `payment_schedules`, `customers`, `departments`

---

## I. UI Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | Table columns | Mở Quản lý HĐ | Columns: STT, Số HĐ, Tên HĐ, Khách hàng, Phòng ban, Giá trị, Ngày ký, Ngày HH, Trạng thái, Thao tác |
| UI-02 | Status badges | Cột trạng thái | DRAFT=xám, ACTIVE=xanh, EXPIRED=đỏ, CANCELLED=cam |
| UI-03 | Value format | Cột Giá trị | Format VND: 1.000.000.000 đ |
| UI-04 | **BUG** Value = 0 | Cột Giá trị | **Hiện tại: hiển thị 0 do FE gửi `value` thay vì `total_value`** |
| UI-05 | Customer name | Cột Khách hàng | Lookup từ customers |
| UI-06 | Department name | Cột Phòng ban | Lookup từ departments |
| UI-07 | Date format | Ngày ký, Ngày HH | DD/MM/YYYY |
| UI-08 | Expired highlight | HĐ quá hạn | Row highlight đỏ nhạt |
| UI-09 | Payment schedule | Detail/expand | Lịch thanh toán hiển thị |
| UI-10 | Action buttons | Cột thao tác | Sửa, Xóa, Xem chi tiết |
| UI-11 | Add button | Header | "Thêm hợp đồng" |
| UI-12 | Search box | Ô tìm kiếm | Search số HĐ, tên, KH |
| UI-13 | Pagination | > 10 records | Controls |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | Customer dropdown | Form: chọn KH | SearchableSelect |
| UX-02 | Department dropdown | Form: chọn Phòng ban | Dropdown departments |
| UX-03 | Value input | Gõ giá trị HĐ | Format mask tiền |
| UX-04 | Date picker pair | Ngày ký + Ngày HH | Calendar, ngày HH > ngày ký |
| UX-05 | Payment schedule builder | Thêm lịch thanh toán | Dynamic rows: Đợt, Ngày, Số tiền, % |
| UX-06 | Payment sum validation | Tổng payment = value | Warning nếu tổng ≠ giá trị HĐ |
| UX-07 | CRUD toast | Operations | Toast feedback |
| UX-08 | Delete confirm | Xóa HĐ | Confirm dialog |
| UX-09 | Edit pre-fill | Sửa HĐ | Form + payment schedule filled |
| UX-10 | Print/Export HĐ | Export 1 HĐ | PDF format |

---

## III. Logic Test Cases

### III-1. CRUD
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Create valid contract | Số HĐ: "HD2025-001", Giá trị: 5 tỷ | Success |
| LG-02 | Create duplicate number | Số HĐ đã tồn tại | Error |
| LG-03 | Create invalid dates | Ngày HH < Ngày ký | Error |
| LG-04 | Create zero value | Giá trị = 0 | Warning hoặc cho phép (DRAFT) |
| LG-05 | Update contract | Đổi giá trị | Success |
| LG-06 | Delete DRAFT | Xóa HĐ DRAFT | Success |
| LG-07 | Delete ACTIVE | Xóa HĐ ACTIVE | Error "Không thể xóa HĐ đang hiệu lực" |

### III-2. CRITICAL BUGS — Field Mapping
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-08 | **CRITICAL BUG** FE gửi `value` | POST/PUT contract | **FE gửi `{ value: X }`, DB cột `total_value` → giá trị = 0** |
| LG-09 | **CRITICAL BUG** Contract interface | types.ts:604-605 | **Interface có cả `value` lẫn `total_value` — ambiguous** |
| LG-10 | **CRITICAL BUG** dept_id vs department_id | contracts.dept_id | **DB dùng `dept_id`, hệ thống dùng `department_id` → mapping sai** |

### III-3. Payment Schedule
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-11 | Add payment item | Thêm đợt thanh toán | Row mới với: đợt, ngày, số tiền, % |
| LG-12 | Remove payment item | Xóa 1 đợt | Row xóa, tổng cập nhật |
| LG-13 | Sum validation | Tổng đợt TT vs giá trị HĐ | Warning nếu không bằng |
| LG-14 | Payment percentage | Tổng % tất cả đợt | Phải = 100% |
| LG-15 | Overdue payment | Đợt TT quá hạn | Highlight row |

### III-4. Filters & Search
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-16 | Search by contract number | "HD2025" | Match số HĐ |
| LG-17 | Search by customer | "Viettel" | Match tên KH |
| LG-18 | Filter status | ACTIVE | Chỉ HĐ ACTIVE |
| LG-19 | Filter expired | Quá hạn | HĐ đã hết hạn |
| LG-20 | Date range filter | Từ 01/01/2025 - 31/12/2025 | HĐ trong khoảng |

### III-5. Department/Customer Lookup
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-21 | Department lookup | dept_id valid | Tên phòng ban |
| LG-22 | Department null | dept_id null | "-" |
| LG-23 | Customer lookup | customer_id valid | Tên KH |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Initial load | Mở Quản lý HĐ | Render + lookups | < 1s |
| PF-02 | Search | 500 HĐ, search | Filtered | < 200ms |
| PF-03 | Filter status | 500 HĐ, filter | Filtered | < 200ms |
| PF-04 | Payment schedule load | Expand detail, 10 payments | Render | < 200ms |
| PF-05 | Sort by value | 500 HĐ, sort | Sorted | < 200ms |
| PF-06 | Export 500 contracts | Export Excel | Download | < 5s |
| PF-07 | Department lookup | 500 rows × dept lookup | All resolved | < 200ms |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | `searchTerm` | useState | URL query |
| DB-02 | `statusFilter` | useState | URL query |
| DB-03 | Sort config | useState | URL query |
| DB-04 | Current page | useState | URL query |

### V-2. CRITICAL Bugs cần fix

| # | Bug | Impact | Priority |
|---|---|---|---|
| BG-01 | FE gửi `value` thay vì `total_value` (v5Api.ts:1441) | Giá trị HĐ = 0 | **CRITICAL** |
| BG-02 | Contract interface ambiguous (types.ts:604) | Dev confusion | **CRITICAL** |
| BG-03 | `dept_id` vs `department_id` (DB) | Mapping fail | **CRITICAL** |

### V-3. Fix Required

```typescript
// v5Api.ts - FIX
// TRƯỚC (SAI):
value: normalizeNumber(payload.value, 0),

// SAU (ĐÚNG):
total_value: normalizeNumber(payload.total_value ?? payload.value, 0),

// types.ts - FIX
// TRƯỚC:
export interface Contract {
  value: number;
  total_value?: number;
}

// SAU:
export interface Contract {
  total_value: number;
}
```

### V-4. Feature đề xuất

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Contract renewal alert | Cảnh báo HĐ sắp hết hạn 30/60/90 ngày | HIGH |
| FT-02 | Auto-renewal | Tự động gia hạn HĐ | MEDIUM |
| FT-03 | Contract amendment | Phụ lục hợp đồng | HIGH |
| FT-04 | Payment tracking | Theo dõi thanh toán thực tế vs kế hoạch | HIGH |
| FT-05 | Revenue recognition | Ghi nhận doanh thu theo kỳ | MEDIUM |
| FT-06 | Contract template | Tạo HĐ từ mẫu | MEDIUM |
| FT-07 | Digital signature | Ký điện tử | LOW |
| FT-08 | Contract comparison | So sánh 2 phiên bản HĐ | LOW |

---

*Generated by Claude Code — 2026-03-01*
