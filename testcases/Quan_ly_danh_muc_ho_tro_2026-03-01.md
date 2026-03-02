# Testcase — Quản lý danh mục hỗ trợ (Support Category Management)
**Ngày:** 2026-03-01
**Module:** SupportMasterManagement
**Files:** `frontend/SupportMasterManagement.tsx`
**DB Tables:** `support_service_groups`, `support_request_statuses`

---

## I. UI Test Cases

### I-1. Tab Switcher
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | 2 tabs | Mở quản lý danh mục | Tab "Nhóm dịch vụ" + Tab "Trạng thái YCHT" |
| UI-02 | Active tab | Click tab | Tab selected highlight |
| UI-03 | Content switch | Chuyển tab | Content thay đổi, không flicker |

### I-2. Service Groups Tab
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-04 | Table columns | Nhóm DV list | Columns: STT, Mã nhóm, Tên nhóm, Mô tả, Thứ tự, Hoạt động, Thao tác |
| UI-05 | Activity toggle | Cột Hoạt động | Toggle switch ACTIVE/INACTIVE |
| UI-06 | Sort order display | Cột Thứ tự | Số thứ tự sắp xếp |
| UI-07 | Action buttons | Thao tác | Sửa, Xóa |
| UI-08 | Add button | Header | "Thêm nhóm dịch vụ" |
| UI-09 | Activity filter | Filter | Dropdown: Tất cả, Hoạt động, Ngừng hoạt động |

### I-3. Statuses Tab
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-10 | Table columns | Trạng thái list | Columns: STT, Mã TT, Tên trạng thái, Mô tả, Thứ tự, Hoạt động, Thao tác |
| UI-11 | Activity toggle | Cột Hoạt động | Toggle |
| UI-12 | Action buttons | Thao tác | Sửa, Xóa |
| UI-13 | Add button | Header | "Thêm trạng thái" |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | CRUD flow groups | Create → Edit → Delete group | Toast feedback mỗi bước |
| UX-02 | CRUD flow statuses | Create → Edit → Delete status | Toast feedback |
| UX-03 | Code auto-format | Gõ mã nhóm "hạ tầng" | Tự uppercase: "HA_TANG" (normalizeGroupCodeInput) |
| UX-04 | Code editability | Sửa nhóm đang dùng | Mã nhóm disabled (used_in_requests check) |
| UX-05 | Sort order auto | Thêm mới | Tự tính nextSortOrder |
| UX-06 | Delete confirm | Xóa nhóm | Confirm dialog |
| UX-07 | Delete in-use error | Xóa nhóm đang dùng trong SR | Error "Nhóm đang được sử dụng" |
| UX-08 | Activity toggle confirm | Toggle inactive | Confirm nếu đang dùng |
| UX-09 | Search/Filter | Tìm nhóm/trạng thái | Instant filter |
| UX-10 | Bulk import | Import danh sách nhóm | Preview → confirm |

---

## III. Logic Test Cases

### III-1. Service Group CRUD
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Create valid group | Mã: "INFRA", Tên: "Hạ tầng mạng" | Success |
| LG-02 | Create duplicate code | Mã: "INFRA" exists | Error |
| LG-03 | Create empty name | Tên = "" | Error |
| LG-04 | Update group | Đổi tên | Success |
| LG-05 | Delete unused group | Xóa nhóm chưa dùng | Success |
| LG-06 | Delete in-use group | Xóa nhóm có SR liên kết | Error |
| LG-07 | Toggle activity | ACTIVE → INACTIVE | Success (check if used) |

### III-2. Status CRUD
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-08 | Create valid status | Mã: "REVIEWING", Tên: "Đang review" | Success |
| LG-09 | Create duplicate code | Mã exists | Error |
| LG-10 | Update status | Đổi tên | Success |
| LG-11 | Delete unused status | Xóa status chưa dùng | Success |
| LG-12 | Delete in-use status | Xóa status có SR đang dùng | Error |

### III-3. normalizeGroupCodeInput
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-13 | Lowercase input | "hạ tầng" | "HA_TANG" (uppercase + underscore) |
| LG-14 | Mixed case | "Ha Tang" | "HA_TANG" |
| LG-15 | Vietnamese diacritics | "Hỗ trợ kỹ thuật" | "HO_TRO_KY_THUAT" |
| LG-16 | Special chars | "group@#$" | "GROUP" (strip special) |
| LG-17 | Already formatted | "MY_GROUP" | "MY_GROUP" (no change) |

### III-4. nextSortOrder
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-18 | First group | Chưa có nhóm nào | sort_order = 1 |
| LG-19 | After existing | Có 5 nhóm (order 1-5) | sort_order = 6 |
| LG-20 | Gap in order | Orders: 1, 2, 5 | sort_order = 6 (max + 1) |
| LG-21 | Manual order edit | Đổi sort_order = 3 | Success, không conflict |

### III-5. used_in_requests Check
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-22 | Group used check | Nhóm có 10 SR liên kết | used_in_requests = true → code disabled |
| LG-23 | Group unused check | Nhóm không có SR | used_in_requests = false → code editable |
| LG-24 | Status used check | Status đang dùng | disabled edit code |

### III-6. Activity Filter
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-25 | Filter active only | Chọn "Hoạt động" | Chỉ groups/statuses active |
| LG-26 | Filter inactive only | Chọn "Ngừng hoạt động" | Chỉ inactive |
| LG-27 | Filter all | Chọn "Tất cả" | Show all |

### III-7. Bulk Import
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-28 | Import groups | Excel file với 10 nhóm | 10 groups imported |
| LG-29 | Import dedup | File có nhóm trùng (normalizeToken) | Skip hoặc merge |
| LG-30 | Import statuses | Excel file với statuses | Imported |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Tab switch | Chuyển giữa Groups ↔ Statuses | Instant render | < 100ms |
| PF-02 | Groups list load | 50 groups | Render | < 200ms |
| PF-03 | Statuses list load | 20 statuses | Render | < 100ms |
| PF-04 | normalizeGroupCodeInput | Realtime as typing | No lag | < 10ms per keystroke |
| PF-05 | used_in_requests check | Per group, check SR table | Response | < 200ms (server) |
| PF-06 | Bulk import 50 groups | Upload + process | Complete | < 5s |
| PF-07 | Activity filter | Filter 50 groups | Filtered | < 50ms |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | Active tab (Groups/Statuses) | useState | URL hash `#groups` / `#statuses` |
| DB-02 | Activity filter | useState | URL query `?active=true` |
| DB-03 | Search term | useState | URL query |

### V-2. Feature đề xuất

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Drag-drop reorder | Kéo thả để đổi sort_order | HIGH |
| FT-02 | Group color | Gán màu cho mỗi nhóm DV | MEDIUM |
| FT-03 | Group icon | Icon cho mỗi nhóm | LOW |
| FT-04 | Status workflow | Định nghĩa workflow (trạng thái nào → trạng thái nào) | HIGH |
| FT-05 | Usage statistics | Hiển thị số YCHT đang dùng mỗi nhóm/status | HIGH |
| FT-06 | Archive instead of delete | Lưu trữ thay vì xóa | MEDIUM |
| FT-07 | Default status per group | Mỗi nhóm DV có default status riêng | MEDIUM |

---

*Generated by Claude Code — 2026-03-01*
