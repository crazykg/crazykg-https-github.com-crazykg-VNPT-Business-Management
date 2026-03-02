# Baseline Testcase + Checklist PASS/FAIL — Yêu cầu hỗ trợ
**Ngày cập nhật:** 2026-03-01  
**Module:** `SupportRequestList`  
**Phạm vi code:** `frontend/components/SupportRequestList.tsx`, `frontend/App.tsx`, `frontend/types.ts`, `frontend/services/v5Api.ts`, `backend/app/Http/Controllers/Api/V5MasterDataController.php`

## 1) Baseline UI thực tế (đã đối chiếu theo code hiện tại)

### 1.1 KPI cards (6 cards)
1. `Tổng yêu cầu`
2. `Mới tiếp nhận`
3. `Đang xử lý`
4. `Chờ phản hồi KH`
5. `Sắp đến hạn`
6. `Đã quá hạn xử lý`

### 1.2 Filter bar
1. Search placeholder: `Tìm theo mã task, nội dung, khách hàng, người xử lý...`
2. Dropdown mặc định:
- `Tất cả trạng thái`
- `Tất cả ưu tiên`
- `Tất cả nhóm Zalo/Telegram`
- `Tất cả người xử lý`
- `Tất cả khách hàng`
3. Date range label:
- `Từ ngày nhận yêu cầu`
- `Đến ngày nhận yêu cầu`
4. Date picker placeholder: `dd/mm/yyyy`

### 1.3 Bảng danh sách
1. `Mã task`
2. `Mã task tham chiếu`
3. `Nội dung`
4. `Nhóm Zalo/Tele`
5. `Khách hàng`
6. `Người xử lý`
7. `Ưu tiên`
8. `Trạng thái`
9. `Hạn xử lý`
10. `Thao tác`

### 1.4 Khác với baseline cũ cần loại bỏ
1. Không dùng cột `STT`, `Mã YCHT`, `Ngày tạo` như spec cũ.
2. KPI không phải `Hoàn thành/Khác`; đã chuyển sang `Sắp đến hạn/Đã quá hạn xử lý`.

---

## 2) Checklist PASS/FAIL theo Phase P3

## 2.1 UI
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| UI-01 | 6 KPI cards đúng tên hiện tại | PASS | `SupportRequestList.tsx` section KPI cards |
| UI-02 | Filter labels/placeholders đúng baseline mới | PASS | `SupportRequestList.tsx` section filter |
| UI-03 | Table headers đúng baseline mới | PASS | `SupportRequestList.tsx` table header |
| UI-04 | Pagination footer hiển thị qua `PaginationControls` | PASS | `SupportRequestList.tsx` + `PaginationControls.tsx` |
| UI-05 | Empty state list | PASS | Text `Không tìm thấy yêu cầu hỗ trợ phù hợp.` |

## 2.2 Logic chuyển trạng thái
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| ST-01 | FE dùng danh mục trạng thái chuẩn (8 mã known) | PASS | `types.ts` (`KNOWN_SUPPORT_REQUEST_STATUS_CODES`) |
| ST-02 | Create/Update/Status patch backend chặn status không hợp lệ | PASS | Validation `Rule::in($this->supportRequestStatusValidationValues(false))` |
| ST-03 | Status phải tồn tại trong master data active | PASS | `supportRequestStatusValidationValues(false)` lấy từ `support_request_statuses` active |
| ST-04 | Ràng buộc transition matrix cứng (ví dụ COMPLETED -> NEW) | FAIL | Hiện chưa có rule matrix cứng trong `patchSupportRequestStatus` |

## 2.3 Filter + Pagination
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| FP-01 | Không còn full-fetch FE cho support requests | PASS | Đã bỏ `fetchSupportRequests()` khỏi `v5Api.ts` |
| FP-02 | Query contract flat params (`page,per_page,q,status,priority,group,assignee,customer,from,to,sort`) | PASS | `buildSupportRequestsQueryString` |
| FP-03 | Backend guard `per_page` max 100 | PASS | `resolvePaginationParams(..., 10, 100)` |
| FP-04 | API support-requests luôn phân trang (không fallback get-all) | PASS | Đã bỏ branch `->get()` full list trong `supportRequests()` |
| FP-05 | KPI server-side theo filter hiện hành | PASS | `resolveKpis()` dùng cùng `applyCommonFilters + applySearchFilter` |

## 2.4 Hiệu năng
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| PF-01 | LRU/TTL cho history cache tránh phình RAM | PASS | `SUPPORT_HISTORY_CACHE_MAX_ENTRIES=80`, `TTL=10m` + prune logic |
| PF-02 | Tối ưu normalizeToken trên list đang hiển thị | PASS | `requestSearchIndexById` (`useMemo`) |
| PF-03 | Fuzzy reference ticket chuyển server-side + debounce | PASS | API `reference-search` + debounce FE |
| PF-04 | Export lớn không xử lý nặng tại client | PASS | API export CSV stream (`/support-requests/export`) |
| PF-05 | Index phục vụ filter chính | PASS | Migration `2026_03_01_183000_add_phase2_support_request_filter_indexes.php` ran |

---

## 3) Regression checklist (Transfer-dev, History/Tasks, Quick-create)

### 3.1 Transfer-dev
| ID | Kịch bản | Kết quả | Ghi chú |
|---|---|---|---|
| RG-TD-01 | Nút `Chuyển Dev` chỉ enable khi `can_transfer_dev` và chưa chuyển | PASS | Có disable/title guard ở action column |
| RG-TD-02 | Đã chuyển dev thì khóa lại (`is_transferred_dev`) | PASS | Icon `task_alt`, trạng thái disabled |
| RG-TD-03 | Mở modal chuyển dev từ form edit | PASS | Có modal `showTransferDevModal` + validate dữ liệu |

### 3.2 History + Tasks
| ID | Kịch bản | Kết quả | Ghi chú |
|---|---|---|---|
| RG-HT-01 | Mở history từ row | PASS | `handleOpenHistory` |
| RG-HT-02 | Mở lại cùng request dùng cache | PASS | `readHistoryFromCache()` |
| RG-HT-03 | Cache dọn theo TTL + max entries | PASS | prune expired + eviction oldest |
| RG-HT-04 | Task status chỉ nhận 5 mã hợp lệ | PASS | `normalizeSupportRequestTaskStatus` + backend validate |

### 3.3 Quick-create Group/Status
| ID | Kịch bản | Kết quả | Ghi chú |
|---|---|---|---|
| RG-QC-01 | Mở modal `Tạo nhóm Zalo/Telegram yêu cầu` | PASS | Modal hiện trong form YCHT |
| RG-QC-02 | Mở modal `Tạo trạng thái yêu cầu hỗ trợ` | PASS | Modal hiện trong form YCHT |
| RG-QC-03 | Bulk create status/group giữ logic cũ | PASS | API create/bulk vẫn hoạt động qua callback hiện hữu |

---

## 4) Definition of Done (đối chiếu)
| DoD | Trạng thái | Bằng chứng |
|---|---|---|
| Không còn full-fetch ở mọi luồng chính/phụ support requests | PASS | FE bỏ full-fetch helper + BE ép pagination |
| Page load/filter ổn với dữ liệu lớn, tránh timeout logic lớn | PASS (code-level) | ID-first pagination + KPI query riêng + index P2 |
| Status chỉ nhận giá trị hợp lệ theo master data | PASS | Backend validate qua bảng master status active |
| Bộ nhớ không phình khi mở nhiều detail/history | PASS | LRU/TTL cache history |
| `npm run lint`, `npm run build` pass | PASS | Đã chạy pass ngày 2026-03-01 |

---

## 5) Lệnh kiểm tra kỹ thuật đã chạy
1. `php -l backend/app/Http/Controllers/Api/V5MasterDataController.php` -> PASS
2. `php -l backend/routes/api.php` -> PASS
3. `npm run lint` -> PASS
4. `npm run build` -> PASS
5. `php artisan migrate --path=database/migrations/2026_03_01_183000_add_phase2_support_request_filter_indexes.php --force` -> PASS

> Ghi chú: `ST-04` là điểm còn thiếu nếu muốn enforce transition matrix nghiệp vụ cứng ở backend.
