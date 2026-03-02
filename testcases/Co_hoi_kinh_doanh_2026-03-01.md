# Testcase — Cơ hội kinh doanh (Opportunities)
**Ngày:** 2026-03-01
**Module:** OpportunityList
**Files:** `frontend/OpportunityList.tsx`
**DB Tables:** `opportunities`, `customers`

---

## I. UI Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | Table columns | Mở Cơ hội KD | Columns: STT, Mã CH, Tên cơ hội, Khách hàng, Giai đoạn (Stage), Giá trị, Xác suất (%), Ngày dự kiến đóng, Thao tác |
| UI-02 | Stage badge colors | Cột Giai đoạn | NEW=xanh dương, QUALIFIED=vàng, PROPOSAL=cam, NEGOTIATION=tím, WON=xanh lá, LOST=đỏ |
| UI-03 | Value format VND | Cột Giá trị | Format tiền VND (1.000.000 đ) |
| UI-04 | Probability display | Cột Xác suất | Hiển thị % (0-100%) |
| UI-05 | Customer name lookup | Cột Khách hàng | Hiển thị tên KH (không ID) |
| UI-06 | Date format | Cột Ngày dự kiến đóng | DD/MM/YYYY |
| UI-07 | Stage filter | Filter dropdown | Dropdown chọn stage (NEW, QUALIFIED, etc.) |
| UI-08 | Pipeline value summary | Header area | Tổng giá trị pipeline hiển thị |
| UI-09 | Add button | Header | "Thêm cơ hội" |
| UI-10 | Action buttons | Cột thao tác | Sửa, Xóa |
| UI-11 | Search box | Ô tìm kiếm | Search theo mã, tên, KH |
| UI-12 | Pagination | > 10 records | Pagination controls |
| UI-13 | Empty state | 0 opportunities | Empty message |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | Stage filter UX | Click dropdown stage | Dropdown với badge colors matching list |
| UX-02 | Customer dropdown | Form: chọn KH | SearchableSelect searchable |
| UX-03 | Value input mask | Gõ giá trị | Format tự động |
| UX-04 | Probability slider/input | Gõ xác suất | Giới hạn 0-100 |
| UX-05 | Date picker | Chọn ngày đóng | Calendar picker |
| UX-06 | CRUD toast | Create/Update/Delete | Toast feedback |
| UX-07 | Delete confirm | Xóa cơ hội | Confirm dialog |
| UX-08 | Edit pre-fill | Sửa cơ hội | Form filled, dropdowns selected |
| UX-09 | Pipeline value update | Thêm/sửa cơ hội | Pipeline tổng cập nhật |
| UX-10 | Stage transition flow | Đổi stage | Visual feedback (color change) |

---

## III. Logic Test Cases

### III-1. CRUD
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Create valid opportunity | Tên: "Triển khai FTTH", KH: Viettel, Stage: NEW, Value: 5B | Success |
| LG-02 | Create without customer | Không chọn KH | Error "Vui lòng chọn khách hàng" |
| LG-03 | Create empty name | Tên = "" | Validation error |
| LG-04 | Create negative value | Value = -1000 | Error |
| LG-05 | Create probability > 100 | Probability = 150 | Error "Xác suất phải từ 0-100%" |
| LG-06 | Update stage | NEW → QUALIFIED | Success, badge color changes |
| LG-07 | Delete opportunity | Xóa 1 cơ hội | Success (kiểm tra không có project liên kết) |
| LG-08 | Delete with project | Xóa cơ hội đã có dự án | Error |

### III-2. Stage Filter
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-09 | Filter by stage | Chọn "WON" | Chỉ hiện cơ hội WON |
| LG-10 | Filter all stages | Chọn "Tất cả" | Hiện tất cả |
| LG-11 | Filter + search combo | Stage: NEW + search "FTTH" | AND logic |
| LG-12 | Filter + pagination | Filter WON, 30 results | Pagination trên filtered |

### III-3. Pipeline Calculation
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-13 | Pipeline total | Tổng giá trị tất cả cơ hội (trừ LOST) | Sum chính xác |
| LG-14 | Weighted pipeline | Giá trị × xác suất | Sum weighted chính xác |
| LG-15 | Pipeline after filter | Filter stage WON | Pipeline = sum WON only |
| LG-16 | Pipeline currency | Format pipeline total | VND format đúng |

### III-4. Customer Lookup
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-17 | Customer valid | customer_id tồn tại | Hiển thị tên KH |
| LG-18 | Customer null | customer_id = null | Hiển thị "-" |
| LG-19 | Customer deleted | KH đã bị soft delete | Hiển thị tên (vẫn lookup được) hoặc "(Đã xóa)" |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Initial load | Mở Cơ hội KD | Render + lookups | < 1s |
| PF-02 | Stage filter | Filter 500 opportunities | Filtered render | < 200ms |
| PF-03 | Search | Search 500 records | Results | < 200ms |
| PF-04 | Pipeline calculation | Calculate 500 records | Total computed | < 50ms |
| PF-05 | Customer lookup | 500 opportunities, lookup customer names | All names resolved | < 200ms |
| PF-06 | Sort | Sort by value | Sorted render | < 200ms |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | `searchTerm` | useState | URL query |
| DB-02 | `stageFilter` | useState | URL query `?stage=WON` |
| DB-03 | Sort config | useState | URL query |
| DB-04 | Current page | useState | URL query |

### V-2. DB Schema Issue

```sql
-- BUG (từ Audit Report I-1-4):
-- opportunities.stage là VARCHAR thay vì ENUM
-- Fix:
ALTER TABLE opportunities
  MODIFY COLUMN stage ENUM('NEW','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST')
  NOT NULL DEFAULT 'NEW';
```

### V-3. Feature đề xuất

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Kanban view | Drag-drop cards giữa stages | HIGH |
| FT-02 | Pipeline forecast | Dự báo revenue theo tháng | HIGH |
| FT-03 | Win/Loss analysis | Thống kê tỷ lệ WON/LOST theo KH, sản phẩm | MEDIUM |
| FT-04 | Activity timeline | Lịch sử hoạt động trên cơ hội | MEDIUM |
| FT-05 | Competitor tracking | Đối thủ cạnh tranh cho mỗi cơ hội | LOW |
| FT-06 | Stage duration stats | Thời gian trung bình mỗi stage | MEDIUM |
| FT-07 | Auto-close stale | Tự đóng cơ hội quá hạn | LOW |

---

*Generated by Claude Code — 2026-03-01*
