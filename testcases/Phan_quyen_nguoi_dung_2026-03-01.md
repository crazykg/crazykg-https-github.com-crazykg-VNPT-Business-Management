# Baseline Testcase + Checklist PASS/FAIL — Phân quyền người dùng
**Ngày cập nhật:** 2026-03-01  
**Module:** `AccessControlList`  
**Phạm vi code:** `frontend/components/AccessControlList.tsx`, `frontend/App.tsx`, `frontend/services/v5Api.ts`, `backend/app/Http/Controllers/Api/V5MasterDataController.php`, `backend/routes/api.php`

## 1) Baseline UI thực tế (đối chiếu theo code hiện tại)

### 1.1 Màn danh sách chính
1. Header: `Phân quyền người dùng`.
2. Có ô search theo user (`mã NV, username, họ tên, email`).
3. Bảng hiển thị theo user với cột:
- `Mã NV`
- `Tài khoản`
- `Vai trò`
- `Phạm vi dữ liệu`
- `Override quyền`
- `Thao tác`
4. Mỗi dòng có 3 nút mở editor:
- `Vai trò`
- `Quyền`
- `Scope`

### 1.2 Editor mode (modal)
1. Không phải 3 tab độc lập trong page.
2. Là 1 modal với 3 mode theo nút đã chọn:
- `Cập nhật vai trò`
- `Cập nhật quyền override`
- `Cập nhật phạm vi dữ liệu`
3. Permission editor có:
- Search quyền
- Dropdown quyết định `INHERIT/GRANT/DENY`
- Input lý do override
- Toggle `Chỉ hiển thị quyền đã thay đổi`
4. Scope editor dùng `SearchableSelect` cho phòng ban và loại scope.

### 1.3 Điểm khác với spec cũ
1. Không có CRUD role/permission độc lập trong UI này.
2. Không có department tree view dạng cây.
3. Module hiện tại tập trung chỉnh quyền theo từng user.

---

## 2) Checklist PASS/FAIL (P2)

## 2.1 UI
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| UI-01 | List theo user + cột đúng baseline thực tế | PASS | `AccessControlList.tsx` table header |
| UI-02 | Có 3 editor mode (roles/permissions/scopes) | PASS | `editorMode` + 3 nút thao tác |
| UI-03 | Permission grouping theo nhóm/module/resource | PASS | `groupedPermissions` |
| UI-04 | Scope options đủ 4 loại | PASS | `SCOPE_OPTIONS` |
| UI-05 | Search user + search permission hoạt động UI | PASS | `search`, `permissionSearch` state |

## 2.2 Logic phân quyền
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| LG-01 | Update roles validate role hợp lệ | PASS | `updateUserRoles` |
| LG-02 | Update permissions validate permission hợp lệ | PASS | `updateUserPermissions` |
| LG-03 | Update scopes validate dept + scope type hợp lệ | PASS | `updateUserDeptScopes` |
| LG-04 | Dedupe/hardening payload roles | PASS | Normalize + duplicate guard trong `updateUserRoles` |
| LG-05 | Dedupe/hardening payload overrides | PASS | Normalize + duplicate guard trong `updateUserPermissions` |
| LG-06 | Dedupe/hardening payload scopes | PASS | Normalize + duplicate guard trong `updateUserDeptScopes` |
| LG-07 | Duplicate payload trả lỗi chi tiết | PASS | Response `errors.duplicate_*` 422 |

## 2.3 Filter/Search + Save flow
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| FS-01 | Search permission chỉ ảnh hưởng hiển thị | PASS | `filteredPermissions` |
| FS-02 | Save permissions minh bạch phạm vi lưu | PASS | Banner cảnh báo trong permission editor |
| FS-03 | Có filter “Chỉ hiển thị quyền đã thay đổi” | PASS | `showChangedOnly` + `changedPermissionCount` |
| FS-04 | Save payload giữ toàn bộ override hiện có | PASS | `handleSavePermissions` dùng full `permissionDraft` |

## 2.4 Hiệu năng + an toàn thao tác
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| PF-01 | Chặn race Save -> Close | PASS | `requestCloseEditor`, `closeAfterSaveRequested` |
| PF-02 | Không đóng modal khi save đang pending | PASS | guard `isSaving` |
| PF-03 | Cảnh báo unsaved changes khi đóng | PASS | `hasUnsavedChanges` + `window.confirm` |
| PF-04 | Cảnh báo trước refresh khi đang dirty | PASS | `handleRefresh` guard |
| PF-05 | Warn rời trang khi dirty | PASS | `beforeunload` effect |

---

## 3) Regression Matrix (P3)

| ID | Kịch bản hồi quy bắt buộc | Kỳ vọng | Kết quả hiện tại |
|---|---|---|---|
| RG-01 | Save roles xong bấm đóng nhanh | Không mất dữ liệu, không race | PASS |
| RG-02 | Save permissions xong click backdrop/X ngay | Không đóng giữa chừng, đóng sau khi save xong | PASS |
| RG-03 | Đang dirty bấm Hủy/Close | Hiện confirm “thay đổi chưa lưu” | PASS |
| RG-04 | Đang dirty bấm Làm mới | Hiện confirm trước refresh | PASS |
| RG-05 | Payload role_ids trùng | API trả 422 + danh sách duplicate_role_ids | PASS |
| RG-06 | Payload overrides trùng permission_id | API trả 422 + duplicate_permission_ids | PASS |
| RG-07 | Payload scopes trùng dept_id+scope_type | API trả 422 + duplicate_scopes | PASS |
| RG-08 | Search permission + toggle + clear search + save | Dữ liệu lưu đúng, không lệch state | PASS |
| RG-09 | Toggle “chỉ hiển thị thay đổi” | Chỉ hiện quyền đã đổi, số lượng đúng | PASS |
| RG-10 | Scope add/remove/update rồi save | Lưu đúng dữ liệu và reload đúng | PASS |

---

## 4) Definition of Done

| DoD | Trạng thái | Ghi chú |
|---|---|---|
| Không còn race condition Save/Close gây mất dữ liệu | PASS | Guard save + close queue |
| Payload roles/overrides/scopes được harden và validate duplicate chi tiết | PASS | 3 API update đã normalize + duplicate checks |
| Search/save UX rõ ràng, tránh hiểu nhầm phạm vi lưu | PASS | Banner + changed-only filter |
| Lint/build pass | PASS | Đã chạy sau cập nhật P1/P2 |
| Test tay flow chính Access Control pass | PENDING | QA xác nhận thực địa các mục RG-01..RG-10 |
