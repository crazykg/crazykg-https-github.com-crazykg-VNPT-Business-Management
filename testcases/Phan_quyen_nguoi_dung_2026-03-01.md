# Testcase — Phân quyền người dùng (Access Control)
**Ngày:** 2026-03-01
**Module:** AccessControlList
**Files:** `frontend/AccessControlList.tsx`
**DB Tables:** `roles`, `permissions`, `role_permission`, `user_roles`, `user_permissions`, `user_dept_scopes`, `departments`

---

## I. UI Test Cases

### I-1. Three Editor Modes
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-01 | Tab/Mode switcher | Mở Phân quyền | 3 tabs: Vai trò (Roles), Quyền (Permissions), Phạm vi (Scopes) |
| UI-02 | Active tab highlight | Click tab | Tab selected highlight |
| UI-03 | Content switch | Chuyển tab | Content tương ứng, smooth |

### I-2. Roles Editor
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-04 | Role list | Tab Roles | Danh sách roles: Admin, Manager, User, etc. |
| UI-05 | Role detail panel | Click role | Panel bên phải: thông tin role + permissions assigned |
| UI-06 | Permission matrix | Role selected | Grid/Table: rows = permissions, columns = GRANT/DENY/INHERIT |
| UI-07 | Permission grouping | Permission list | Nhóm theo: resource → group → module |
| UI-08 | Add role button | Header | "Thêm vai trò" |
| UI-09 | Edit role | Click edit | Form: name, description |
| UI-10 | Delete role | Click delete | Confirm dialog |

### I-3. Permissions Editor
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-11 | Permission list | Tab Permissions | Tất cả permissions grouped by module |
| UI-12 | Permission detail | Click permission | Name, code, module, group, resource |
| UI-13 | Add permission | "Thêm quyền" | Form: code, name, module, group, resource |
| UI-14 | Permission search | Search box | Search permission name/code |

### I-4. Department Scopes Editor
| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UI-15 | Scope list | Tab Scopes | User-Department scope mappings |
| UI-16 | Scope types | Dropdown | 4 options: SELF_ONLY, DEPT_ONLY, DEPT_AND_CHILDREN, ALL |
| UI-17 | Department tree | Phạm vi phòng ban | Tree view departments |
| UI-18 | User selector | Chọn user | SearchableSelect internal_users |
| UI-19 | Scope badges | Display | Color-coded per scope type |

---

## II. UX Test Cases

| # | Test Case | Mô tả | Expected Result |
|---|---|---|---|
| UX-01 | Role → Permission assignment | Gán quyền cho role | Checkbox/toggle matrix, feedback instant |
| UX-02 | GRANT/DENY/INHERIT toggle | Click permission row | Cycle: INHERIT → GRANT → DENY → INHERIT |
| UX-03 | Bulk permission assign | Select all permissions in module | All toggled to GRANT |
| UX-04 | Save feedback | Click Save | Toast "Lưu thành công" |
| UX-05 | **BUG** Race condition on close | Click Save rồi close ngay | **Async save chưa xong, close mất data** |
| UX-06 | Permission search UX | Search trong permission matrix | Filter visible permissions, **BUG: search không ảnh hưởng save** |
| UX-07 | Department tree expand | Click expand node | Children hiển thị |
| UX-08 | Scope assignment UX | Gán scope cho user | Dropdown select, save |
| UX-09 | Loading state | Mở phân quyền | Spinner |
| UX-10 | Discard changes | Chưa save, click cancel | Confirm "Bỏ thay đổi?" |

---

## III. Logic Test Cases

### III-1. Role Management
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-01 | Create role | Name: "Supervisor" | Success |
| LG-02 | Create duplicate name | Name exists | Error |
| LG-03 | Delete role | Xóa role không có user | Success |
| LG-04 | Delete role with users | Xóa role đang gán cho users | Error "Role đang được sử dụng" |
| LG-05 | Update role name | Đổi tên | Success |

### III-2. Permission Assignment (GRANT/DENY/INHERIT)
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-06 | GRANT permission | Toggle → GRANT | role_permission: type = 'GRANT' |
| LG-07 | DENY permission | Toggle → DENY | role_permission: type = 'DENY' |
| LG-08 | INHERIT (remove) | Toggle → INHERIT | role_permission row xóa |
| LG-09 | Effective permission | User has Role A (GRANT) + Role B (DENY) | DENY wins (most restrictive) |
| LG-10 | User-level override | Role GRANT + User DENY | User DENY wins |
| LG-11 | No permission | User không có role/permission | Default DENY (no access) |

### III-3. Permission Grouping Algorithm
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-12 | Group by resource | permissions: support_requests.read, support_requests.write | Grouped under "support_requests" |
| LG-13 | Group by module | Group: CRM (customers, opportunities, contracts) | Module "CRM" |
| LG-14 | 3-level hierarchy | module → group → permission | Render correctly |
| LG-15 | Ungrouped permissions | Permission without module | "Khác" group |

### III-4. Department Scope
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-16 | Scope SELF_ONLY | User A, scope: SELF_ONLY | Chỉ thấy data của mình |
| LG-17 | Scope DEPT_ONLY | User A, dept: "Kỹ thuật" | Thấy data phòng Kỹ thuật |
| LG-18 | Scope DEPT_AND_CHILDREN | User A, dept: "Ban GĐ" | Thấy data Ban GĐ + phòng con |
| LG-19 | Scope ALL | User Admin | Thấy toàn bộ data |
| LG-20 | Multiple scopes | User có 2 dept scopes | Union of scopes |
| LG-21 | No scope | User không có dept scope | Default SELF_ONLY hoặc no access |

### III-5. CRITICAL BUGS
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-22 | **BUG** Race condition on close | Click Save → immediately Close | **Save async chưa hoàn tất → data lost** |
| LG-23 | **BUG** Permission search vs save | Search "customer", toggle 1 permission, save | **Save gửi TẤT CẢ permissions (kể cả hidden bởi search), search chỉ ảnh hưởng display** |
| LG-24 | **BUG** Close during save | Đóng modal khi save đang pending | **Race condition, state inconsistent** |

### III-6. Search Logic
| # | Test Case | Input | Expected |
|---|---|---|---|
| LG-25 | Search permission by name | "Xem khách hàng" | Filter permissions display |
| LG-26 | Search permission by code | "customers.read" | Match code |
| LG-27 | Search empty | "" | Show all |
| LG-28 | Search no result | "ZZZZZ" | "Không tìm thấy" |
| LG-29 | Search + save interaction | Search → toggle → clear search → save | Verify toggled permission saved correctly |

### III-7. User-Role Assignment
| # | Test Case | Mô tả | Expected |
|---|---|---|---|
| LG-30 | Assign role to user | User A → Role "Manager" | Saved to user_roles |
| LG-31 | Remove role | Xóa role từ user | Removed from user_roles |
| LG-32 | Multiple roles | User có 2 roles | All permissions merged |
| LG-33 | Conflict resolution | Role A GRANT + Role B DENY same permission | DENY wins |

---

## IV. Performance Test Cases

| # | Test Case | Mô tả | Expected | Threshold |
|---|---|---|---|---|
| PF-01 | Initial load | Mở Phân quyền | Render 3 tabs | < 1s |
| PF-02 | Role detail load | Click role | Permission matrix render | < 500ms |
| PF-03 | Permission grouping | 200 permissions, grouping | Grouped render | < 300ms |
| PF-04 | Permission search | Search 200 permissions | Filtered | < 100ms |
| PF-05 | Permission toggle | Click toggle | State update | < 50ms |
| PF-06 | Save permissions | Save role with 100 permissions | API response | < 2s |
| PF-07 | Scope tree render | Department tree 5 levels | Tree render | < 300ms |
| PF-08 | Tab switch | Roles ↔ Permissions ↔ Scopes | Content switch | < 200ms |
| PF-09 | Multiple roles merge | User with 5 roles, calculate effective | Computed | < 100ms |
| PF-10 | **ISSUE** Race condition save | Fast save + close | Save lost | **MUST FIX** |

---

## V. Đề xuất — Dữ liệu chưa lưu DB cần tối ưu

### V-1. Client-only State

| # | State | Hiện tại | Đề xuất |
|---|---|---|---|
| DB-01 | Active tab (Roles/Permissions/Scopes) | useState | URL hash `#roles` / `#permissions` / `#scopes` |
| DB-02 | Selected role | useState | URL query `?role_id=5` |
| DB-03 | Permission search | useState | URL query `?perm_q=customer` |
| DB-04 | Unsaved changes | useState | **Cần auto-save hoặc confirm on leave** |

### V-2. CRITICAL Bugs

| # | Bug | Impact | Priority |
|---|---|---|---|
| BG-01 | Race condition close during save | Data loss | **CRITICAL** |
| BG-02 | Permission search not affecting save scope | User confusion: thinks only filtered perms saved | HIGH |
| BG-03 | No unsaved changes warning | Close without save → lost work | HIGH |

### V-3. Fix for Race Condition

```typescript
// Trước:
const handleClose = () => { setOpen(false); }

// Sau:
const handleClose = async () => {
  if (isSaving) {
    await savePromiseRef.current; // wait for save to complete
  }
  if (hasUnsavedChanges) {
    const confirm = await showConfirm("Bạn có thay đổi chưa lưu. Đóng?");
    if (!confirm) return;
  }
  setOpen(false);
};
```

### V-4. Feature đề xuất

| # | Feature | Mô tả | Priority |
|---|---|---|---|
| FT-01 | Role template | Tạo role từ template (Admin, Manager, Viewer) | HIGH |
| FT-02 | Permission audit log | Lịch sử thay đổi phân quyền | HIGH |
| FT-03 | Effective permission view | Xem quyền thực tế của 1 user (merge all roles + overrides) | HIGH |
| FT-04 | Role comparison | So sánh 2 roles side-by-side | MEDIUM |
| FT-05 | Bulk user assignment | Gán role cho nhiều users | MEDIUM |
| FT-06 | Permission dependency | "write" auto requires "read" | MEDIUM |
| FT-07 | Time-limited permissions | Quyền có hạn thời gian | LOW |
| FT-08 | IP restriction | Giới hạn truy cập theo IP | LOW |
| FT-09 | Two-factor auth | 2FA cho admin roles | HIGH |
| FT-10 | Session management | Xem/kill active sessions | MEDIUM |
---

*Generated by Claude Code — 2026-03-01*
