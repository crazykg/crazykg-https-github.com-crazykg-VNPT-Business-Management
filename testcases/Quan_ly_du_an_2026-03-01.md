# Testcase — Quản lý Dự án (Project Management)
**Ngày:** 2026-03-01
**Module:** ProjectList
**Files:** `frontend/ProjectList.tsx`
**DB Tables:** `projects`, `project_items`, `customers`, `opportunities`, `products`, `raci_assignments`

---

## I. UI Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | Table columns | Mở Quản lý Dự án | Columns: STT, Mã DA, Tên dự án, Khách hàng, Hình thức đầu tư, Trạng thái, Ngày bắt đầu, Ngày kết thúc, Giá trị, Thao tác |
| UI-02 | Status badges | Cột trạng thái | Badges color-coded: PLANNING, ACTIVE, COMPLETED, SUSPENDED, CANCELLED |
| UI-03 | Investment mode display | Cột Hình thức đầu tư | Badge/text: CAPEX, OPEX, MIXED |
| UI-04 | Customer name lookup | Cột Khách hàng | Tên KH (lookup) |
| UI-05 | Opportunity link | Cột Cơ hội KD (nếu có) | Hiển thị tên cơ hội liên kết |
| UI-06 | Date range | Ngày bắt đầu - kết thúc | Format DD/MM/YYYY, highlight nếu quá hạn |
| UI-07 | Value format | Cột Giá trị | Format VND |
| UI-08 | Investment mode filter | Filter area | Dropdown: Tất cả, CAPEX, OPEX, MIXED |
| UI-09 | Status filter | Filter area | Dropdown multi-select statuses |
| UI-10 | Search box | Ô tìm kiếm | Search mã, tên DA |
| UI-11 | Add button | Header | "Thêm dự án" |
| UI-12 | Pagination | > 10 records | Controls |
| UI-13 | Project items sub-table | Expand row hoặc detail | Danh sách sản phẩm trong dự án |
| UI-14 | RACI display | Detail view | RACI matrix (Responsible, Accountable, Consulted, Informed) |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | Loading state | Mở lần đầu | Skeleton/spinner |
| UX-02 | Customer dropdown | Form: chọn KH | SearchableSelect |
| UX-03 | Opportunity dropdown | Form: chọn Cơ hội | SearchableSelect, filter theo KH đã chọn |
| UX-04 | Date picker validation | Ngày KT < ngày BĐ | Error "Ngày kết thúc phải sau ngày bắt đầu" |
| UX-05 | Investment mode change | Đổi hình thức đầu tư | Form fields update tương ứng |
| UX-06 | CRUD toast | Create/Update/Delete | Toast feedback |
| UX-07 | Delete confirm | Xóa dự án | Confirm dialog |
| UX-08 | Project items management | Thêm/xóa SP vào DA | Inline add/remove |
| UX-09 | Overdue visual | DA quá deadline | Highlight đỏ |
| UX-10 | Status transition | Đổi status | Visual feedback |

---

## III. Logic Test Cases

### III-1. CRUD
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Create valid project | Mã: "DA001", Tên: "FTTH Hà Nội" | Success |
| LG-02 | Create duplicate code | Mã: "DA001" exists | Error |
| LG-03 | Create without customer | Không chọn KH | Error/Warning |
| LG-04 | Create invalid dates | End date < Start date | Error |
| LG-05 | Update project | Đổi status PLANNING → ACTIVE | Success |
| LG-06 | Delete project no items | Xóa DA trống | Success |
| LG-07 | Delete project with items | Xóa DA có project_items | Cascade delete items hoặc error |

### III-2. Project Items
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-08 | Add product to project | Chọn SP, số lượng, đơn giá | Item thêm vào project_items |
| LG-09 | Add duplicate product | Thêm SP đã có trong DA | Error "Sản phẩm đã tồn tại" (UNIQUE constraint) |
| LG-10 | Remove product | Xóa 1 item | Success |
| LG-11 | Update quantity | Đổi số lượng | Success, tổng giá trị cập nhật |
| LG-12 | Total calculation | Sum(quantity × unit_price) | Chính xác |

### III-3. Filters
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-13 | Filter investment mode | CAPEX | Chỉ dự án CAPEX |
| LG-14 | Filter status | ACTIVE | Chỉ dự án ACTIVE |
| LG-15 | Combined filter | CAPEX + ACTIVE + search "FTTH" | AND logic |
| LG-16 | Filter reset | Clear filters | Show all |

### III-4. RACI Assignments
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-17 | Assign RACI | Gán user R/A/C/I cho DA | Lưu vào raci_assignments |
| LG-18 | Multiple Responsible | Gán 2 user Responsible | Cho phép (hoặc chỉ 1 — verify business rule) |
| LG-19 | Only 1 Accountable | Gán 2 user Accountable | Error "Chỉ được 1 Accountable" |
| LG-20 | Remove assignment | Xóa RACI entry | Success |

### III-5. Customer/Opportunity Lookup
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-21 | Customer name display | customer_id valid | Tên KH |
| LG-22 | Opportunity name display | opportunity_id valid | Tên cơ hội |
| LG-23 | Null opportunity | opportunity_id = null | Hiển thị "-" |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Initial load | Mở Quản lý DA | Render + lookups | < 1s |
| PF-02 | Filter | 200 dự án, filter | Filtered render | < 200ms |
| PF-03 | Search | Search 200 DA | Results | < 200ms |
| PF-04 | Project items load | Expand detail, 20 items | Items render | < 300ms |
| PF-05 | Sort | Sort by date | Sorted render | < 200ms |
| PF-06 | Lookup performance | Customer + Opportunity lookups 200 rows | All resolved | < 200ms |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | `searchTerm` | useState | URL query |
| DB-02 | `investmentModeFilter` | useState | URL query `?mode=CAPEX` |
| DB-03 | `statusFilter` | useState | URL query `?status=ACTIVE` |
| DB-04 | Current page | useState | URL query |
| DB-05 | Expanded row | useState | URL query `?detail=DA001` |

### V-2. Feature đề xuất

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Gantt chart | Timeline visualization cho DA | HIGH |
| FT-02 | Project dashboard | Overview KPIs (budget, timeline, completion %) | HIGH |
| FT-03 | Milestone tracking | Các mốc quan trọng của DA | MEDIUM |
| FT-04 | Budget vs Actual | So sánh ngân sách dự kiến vs thực tế | HIGH |
| FT-05 | Document attachment | Đính kèm tài liệu vào DA | MEDIUM |
| FT-06 | Project template | Tạo DA từ template | LOW |
| FT-07 | Resource allocation | Phân bổ nhân sự theo DA | MEDIUM |
| FT-08 | Project clone | Nhân bản DA | LOW |

---

*Generated by Claude Code — 2026-03-01*
