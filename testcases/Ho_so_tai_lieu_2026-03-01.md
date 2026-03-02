# Testcase — Hồ sơ tài liệu (Documents)
**Ngày:** 2026-03-01
**Module:** DocumentList
**Files:** `frontend/DocumentList.tsx`
**DB Tables:** `documents`, `document_types`, `document_product_links`, `customers`, `attachments`

---

## I. UI Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | Table columns | Mở Hồ sơ TL | Columns: STT, Mã TL, Tên tài liệu, Loại TL, Khách hàng, Trạng thái, Ngày tạo, Ngày HH, Thao tác |
| UI-02 | Status badges | Cột trạng thái | ACTIVE=xanh, SUSPENDED=vàng, EXPIRED=đỏ |
| UI-03 | Status filter | Filter area | Dropdown: Tất cả, ACTIVE, SUSPENDED, EXPIRED |
| UI-04 | Document type display | Cột Loại TL | Lookup từ document_types |
| UI-05 | Customer name | Cột Khách hàng | Lookup từ customers |
| UI-06 | Date format | Ngày tạo, Ngày HH | DD/MM/YYYY |
| UI-07 | Expired highlight | TL quá hạn | Row hoặc badge đỏ |
| UI-08 | Action buttons | Thao tác | Sửa, Xóa, Xem, Download |
| UI-09 | Add button | Header | "Thêm tài liệu" |
| UI-10 | Search box | Tìm kiếm | Search mã, tên TL |
| UI-11 | Pagination | 7 items/page | PaginationControls |
| UI-12 | Empty state | 0 documents | Empty message |
| UI-13 | Attachment indicator | Row có attachment | Icon đính kèm |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | Loading state | Mở lần đầu | Skeleton/spinner |
| UX-02 | Dual-mode pagination | Server vs Client mode | Smooth transition |
| UX-03 | Document type dropdown | Form: chọn loại | Dropdown document_types |
| UX-04 | Customer dropdown | Form: chọn KH | SearchableSelect |
| UX-05 | File upload UX | Upload attachment | Drag-drop zone + progress bar |
| UX-06 | Google Drive integration | Upload to Drive | Auth flow → upload → link |
| UX-07 | CRUD toast | Operations | Toast feedback |
| UX-08 | Delete confirm | Xóa TL | Confirm dialog |
| UX-09 | Product links | Liên kết SP với TL | Multi-select products |
| UX-10 | Expiry warning | TL sắp hết hạn | Visual warning (30 ngày trước) |

---

## III. Logic Test Cases

### III-1. CRUD
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Create valid document | Mã: "TL001", Tên: "Giấy phép KD" | Success |
| LG-02 | Create duplicate code | Mã exists | Error |
| LG-03 | Create without type | Không chọn loại TL | Error |
| LG-04 | Create with customer | Chọn KH | Lưu customer_id |
| LG-05 | Create without customer | Không chọn KH | **customer_id = NULL** (DB cho phép) |
| LG-06 | Update document | Đổi trạng thái | Success |
| LG-07 | Delete document | Xóa TL | Success + xóa attachments liên quan |
| LG-08 | Delete with links | Xóa TL có product links | Xóa links hoặc error |

### III-2. Status Filter
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-09 | Filter ACTIVE | Chọn ACTIVE | Chỉ TL ACTIVE |
| LG-10 | Filter SUSPENDED | Chọn SUSPENDED | Chỉ TL SUSPENDED |
| LG-11 | Filter EXPIRED | Chọn EXPIRED | Chỉ TL EXPIRED |
| LG-12 | Filter ALL | Chọn Tất cả | Tất cả TL |
| LG-13 | Filter + search | ACTIVE + search "Giấy phép" | AND logic |
| LG-14 | Filter + pagination | Filter ACTIVE, 20 results, 7/page | 3 pages |

### III-3. Dual-mode Pagination (7 items/page)
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-15 | Page size = 7 | Mở list | 7 items per page |
| LG-16 | Server pagination | Server mode | API `?page=1&per_page=7` |
| LG-17 | Client pagination | Client mode | Slice(0, 7) |
| LG-18 | Page overflow | Filter giảm records | Reset page 1 |

### III-4. Document-Product Links
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-19 | Link products | Chọn 3 SP liên kết TL | 3 records trong document_product_links |
| LG-20 | Unlink product | Bỏ chọn 1 SP | Xóa link |
| LG-21 | View linked products | Xem chi tiết TL | Hiển thị danh sách SP liên kết |

### III-5. Attachment Logic
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-22 | Upload file | Chọn file PDF, 5MB | Upload success, link hiển thị |
| LG-23 | Upload large file | File > 10MB | Error hoặc success (verify limit) |
| LG-24 | Upload invalid type | File .exe | Error "Loại file không được hỗ trợ" |
| LG-25 | Download attachment | Click download | File download |
| LG-26 | Delete attachment | Xóa attachment | File removed |
| LG-27 | Orphan attachments | Xóa TL cha | **Attachments mồ côi** (polymorphic, no FK) |

### III-6. Customer-related
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-28 | Customer lookup valid | customer_id exists | Tên KH |
| LG-29 | Customer lookup null | customer_id = NULL | "-" hoặc "Nội bộ" |
| LG-30 | Document type lookup | doc_type_id valid | Tên loại TL |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Initial load | Mở Hồ sơ TL | Render + lookups | < 1s |
| PF-02 | Status filter | 500 TL, filter | Filtered | < 200ms |
| PF-03 | Search | 500 TL, search | Results | < 200ms |
| PF-04 | File upload | Upload 5MB file | Upload complete | < 5s |
| PF-05 | Google Drive upload | Upload to Drive | Complete (incl. auth) | < 10s |
| PF-06 | Attachment download | Download 10MB | Download | < 5s |
| PF-07 | Pagination (7/page) | Click page | Render | < 100ms |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | `searchTerm` | useState | URL query |
| DB-02 | `statusFilter` | useState | URL query `?status=ACTIVE` |
| DB-03 | Current page | useState | URL query |

### V-2. DB Issues

```sql
-- I-3-2 từ Audit: documents.customer_id cho phép NULL
-- Đề xuất: thêm doc_scope
ALTER TABLE documents ADD COLUMN doc_scope ENUM('INTERNAL','CUSTOMER')
  DEFAULT 'CUSTOMER';
```

### V-3. Feature đề xuất

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Document versioning | Lưu nhiều phiên bản 1 TL | HIGH |
| FT-02 | Expiry notifications | Email/in-app alert TL sắp hết hạn | HIGH |
| FT-03 | Document categories | Phân loại (Hợp đồng, Giấy phép, Báo cáo...) | MEDIUM |
| FT-04 | Preview in browser | Xem PDF/Word trực tiếp | MEDIUM |
| FT-05 | Full-text search | Tìm kiếm nội dung trong file | LOW |
| FT-06 | Batch upload | Upload nhiều file cùng lúc | MEDIUM |
| FT-07 | Access control per doc | Phân quyền xem/sửa mỗi TL | HIGH |
| FT-08 | Document workflow | Quy trình phê duyệt TL | MEDIUM |

---

*Generated by Claude Code — 2026-03-01*
