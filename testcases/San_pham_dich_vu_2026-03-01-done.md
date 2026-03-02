# Testcase — Sản phẩm / Dịch vụ (Products/Services)
**Ngày:** 2026-03-01
**Module:** ProductList
**Files:** `frontend/ProductList.tsx`
**DB Tables:** `products`, `business_domains`, `vendors`

---

## I. UI Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | Table columns | Mở SP/DV | Columns: STT, Mã SP, Tên SP, Lĩnh vực KD, Nhà cung cấp, Đơn vị tính, Đơn giá, Trạng thái, Thao tác |
| UI-02 | Domain name lookup | Cột Lĩnh vực KD | Hiển thị tên lĩnh vực (lookup từ business_domains), không hiển thị ID |
| UI-03 | Vendor name lookup | Cột NCC | Hiển thị tên NCC (lookup từ vendors), không hiển thị ID |
| UI-04 | Price format VND | Cột Đơn giá | Format: 1.000.000 đ (formatVnd) |
| UI-05 | Unit format | Cột Đơn vị tính | Hiển thị đúng (formatUnit) |
| UI-06 | productCountByDomain | Header hoặc sidebar | Thống kê số SP theo từng lĩnh vực |
| UI-07 | Action buttons | Cột thao tác | Sửa, Xóa |
| UI-08 | Add button | Header | "Thêm mới sản phẩm" |
| UI-09 | Search box | Tìm kiếm | Search theo mã, tên SP |
| UI-10 | Sort headers | Click header | Sort arrow indicators |
| UI-11 | Pagination | > 10 records | PaginationControls |
| UI-12 | Import/Export | Toolbar | Import Excel, Export Excel/CSV/PDF |
| UI-13 | Empty state | 0 products | "Không có sản phẩm nào" |
| UI-14 | Modal form | Click Thêm mới | Form: Mã SP, Tên, Lĩnh vực (dropdown), NCC (dropdown), ĐVT, Đơn giá, Mô tả |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | Domain dropdown | Mở form, click Lĩnh vực | Dropdown hiển thị danh sách lĩnh vực KD |
| UX-02 | Vendor dropdown | Mở form, click NCC | Dropdown hiển thị danh sách NCC |
| UX-03 | Price input mask | Gõ giá tiền | Format tự động thêm dấu chấm ngàn |
| UX-04 | CRUD feedback | Thêm/Sửa/Xóa | Toast message thành công/thất bại |
| UX-05 | Delete confirm | Click xóa | Confirm dialog |
| UX-06 | Edit pre-fill | Click sửa | Form filled với data hiện tại, dropdown chọn đúng |
| UX-07 | Template download | Import flow | Link tải template Excel mẫu |
| UX-08 | Filter by domain | Chọn 1 lĩnh vực | Chỉ hiển thị SP thuộc lĩnh vực đó |
| UX-09 | Stats update | Thêm/xóa SP | productCountByDomain cập nhật real-time |
| UX-10 | Loading states | API calls | Spinner/skeleton |

---

## III. Logic Test Cases

### III-1. CRUD
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Create valid product | Mã: "SP001", Tên: "Cáp quang ODF" | Success |
| LG-02 | Create duplicate code | Mã: "SP001" exists | Error duplicate |
| LG-03 | Create with price = 0 | Đơn giá = 0 | Cho phép (free product) |
| LG-04 | Create negative price | Đơn giá = -1000 | Error validation |
| LG-05 | Update product | Đổi đơn giá | Success, table refresh |
| LG-06 | Delete unused | Xóa SP không trong project/contract | Success |
| LG-07 | Delete in-use | Xóa SP đang trong project_items | Error "Sản phẩm đang được sử dụng" |

### III-2. Lookup Logic
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-08 | Domain lookup valid | domain_id tồn tại | Hiển thị tên lĩnh vực |
| LG-09 | Domain lookup null | domain_id = null | Hiển thị "-" |
| LG-10 | Vendor lookup valid | vendor_id tồn tại | Hiển thị tên NCC |
| LG-11 | Vendor lookup null | vendor_id = null | Hiển thị "-" |
| LG-12 | **BUG** businesses[0] null | Template download khi business_domains empty | **Lỗi potential null reference** |
| LG-13 | **BUG** vendors[0] null | Template download khi vendors empty | **Lỗi potential null reference** |

### III-3. Search & Sort
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-14 | Search by product_code | "SP" | Match mã SP |
| LG-15 | Search by name | "Cáp quang" | Match tên SP |
| LG-16 | Sort by price ASC | Click Đơn giá | Giá thấp → cao |
| LG-17 | Sort by price DESC | Click lần 2 | Giá cao → thấp |
| LG-18 | Sort by name Vietnamese | Click Tên SP | Locale sort tiếng Việt |

### III-4. Statistics
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-19 | Product count by domain | Thêm SP vào domain "Viễn thông" | Count tăng 1 |
| LG-20 | Count after delete | Xóa SP từ domain | Count giảm 1 |
| LG-21 | Count with 0 products | Domain không có SP nào | Count = 0 |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Initial load | Mở SP/DV | Render + lookups complete | < 1s |
| PF-02 | **ISSUE** Domain lookup O(n) per cell | 500 SP, mỗi cell lookup trong businesses array | Render chậm | Cần convert sang Map/Object lookup O(1) |
| PF-03 | **ISSUE** Vendor lookup O(n) per cell | 500 SP, mỗi cell lookup trong vendors array | Render chậm | Cần convert sang Map/Object lookup O(1) |
| PF-04 | Search 500 products | Gõ search | Filter | < 200ms |
| PF-05 | Sort 500 products | Click sort | Sorted | < 200ms |
| PF-06 | Export 500 products | Export Excel | Download | < 3s |
| PF-07 | productCountByDomain | Tính stats 500 SP, 20 domains | Stats ready | < 100ms |
| PF-08 | Import 100 products | Upload Excel | Import complete | < 5s |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | `searchTerm` | useState | URL query param |
| DB-02 | Sort config | useState | URL query param |
| DB-03 | Domain filter | useState (nếu có) | URL query `?domain_id=5` |
| DB-04 | Current page | useState | URL query param |

### V-2. Performance Optimization

```typescript
// Hiện tại: O(n) per cell
const domainName = businesses.find(b => b.id === product.domain_id)?.name;

// Đề xuất: O(1) via memoized Map
const domainMap = useMemo(() =>
  new Map(businesses.map(b => [b.id, b.name])), [businesses]
);
const domainName = domainMap.get(product.domain_id);
```

### V-3. Feature đề xuất

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Product images | Upload ảnh sản phẩm | MEDIUM |
| FT-02 | Price history | Lưu lịch sử thay đổi giá | HIGH |
| FT-03 | Multi-vendor pricing | 1 SP có nhiều NCC với giá khác nhau | HIGH |
| FT-04 | Product variants | SKU con (size, color, version) | MEDIUM |
| FT-05 | Inventory tracking | Theo dõi tồn kho | LOW |
| FT-06 | Bulk price update | Cập nhật giá hàng loạt | MEDIUM |

---

*Generated by Claude Code — 2026-03-01*
