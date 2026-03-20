# Kế hoạch Nâng cấp Kiến trúc Hệ thống VNPT Business Management

## Bối cảnh

V5MasterDataController.php hiện là **20,227 dòng** chứa **135 public methods** + **316 private methods** phục vụ **19 domain** khác nhau (Employee, Product, Contract, SupportRequest, v.v.). File này vi phạm nghiêm trọng Single Responsibility Principle, gây khó bảo trì, khó test, và tạo merge conflict khi nhiều dev cùng sửa.

**Mục tiêu**: Tách code V5MasterDataController → module services riêng biệt → xóa file gốc.

**Lưu ý quan trọng**: Codebase đã có một số domain controllers tách riêng trong `app/Http/Controllers/Api/V5/` (VendorController, CustomerController, ProjectController, ContractController, OpportunityController, DepartmentController) — các controllers này dùng `DomainService` pattern. Plan này CHỈ tách code còn lại trong V5MasterDataController ra, hội tụ vào kiến trúc hiện có, **KHÔNG tạo kiến trúc song song mới**.

## Kiến trúc đích — Hội tụ với V5 controllers hiện tại

### Quy tắc hội tụ

- **Modules đã có V5 controller** (Vendor, Customer, Project, Contract, Opportunity, Department): Di chuyển code từ V5MasterDataController vào DomainService tương ứng đã tồn tại, cập nhật routes trỏ vào V5 controller.
- **Modules chưa có V5 controller**: Tạo controller mới trong `app/Http/Controllers/Api/V5/` + service mới trong `app/Services/V5/Domain/` theo pattern hiện tại (extend V5BaseController, inject DomainService).
- **KHÔNG tạo `app/Modules/`** — giữ nguyên cấu trúc thư mục `app/Http/Controllers/Api/V5/` và `app/Services/V5/Domain/`.

### Cấu trúc đích cho modules mới

```
app/Http/Controllers/Api/V5/
├── {Existing}Controller.php          ← giữ nguyên, thêm methods từ V5MDC
└── {New}MasterDataController.php     ← controller mới cho modules chưa tách

app/Services/V5/Domain/
├── {Existing}DomainService.php       ← giữ nguyên, thêm methods từ V5MDC
└── {New}MasterDataService.php        ← service mới cho modules chưa tách
```

### Dependency Resolution (giữ nguyên pattern hiện tại)

V5 controllers extend `V5BaseController` → inject `V5DomainSupportService` + `V5AccessAuditService` qua constructor. Các module mới tuân theo pattern này. **KHÔNG thay đổi DI pattern hiện tại** — giữ facades nơi đã dùng facades, chỉ di chuyển code.

## Hạ tầng đã sẵn sàng (Sprint 1 Phase 0 — DONE)

| Thành phần | File | Trạng thái |
|-----------|------|-----------|
| V5BaseController | `app/Http/Controllers/Api/V5/V5BaseController.php` | ✅ Existing |
| V5DomainSupportService | `app/Services/V5/V5DomainSupportService.php` | ✅ Existing |
| V5AccessAuditService | `app/Services/V5/V5AccessAuditService.php` | ✅ Existing |
| PaginationService | `app/Shared/Services/PaginationService.php` | ✅ Done |
| SortingService | `app/Shared/Services/SortingService.php` | ✅ Done |
| ColumnDetectionService | `app/Shared/Services/ColumnDetectionService.php` | ✅ Done |
| NormalizationService | `app/Shared/Services/NormalizationService.php` | ✅ Done |
| StatusMappingService | `app/Shared/Services/StatusMappingService.php` | ✅ Done |

---

## Route Inventory

### Tổng quan routes hiện tại (166 routes → V5MasterDataController)

| Loại | Số lượng | Ghi chú |
|------|---------|---------|
| Authenticated routes (auth:sanctum + password.change + active.tab) | 163 | Middleware chain tiêu chuẩn |
| Signed download routes (signed:relative, KHÔNG auth) | 3 | `downloadDocumentAttachment`, `downloadAttachment`, `downloadTemporaryDocumentAttachment` |
| Deprecated aliases (deprecated.route middleware) | 65 | Deadline: 2026-04-27 |
| Heavy throttle (throttle:api.write.heavy) | 10 | Bulk import/export endpoints |

### Xử lý routes đặc biệt

**Signed download routes** (3 routes ngoài auth group):
- PHẢI giữ ngoài middleware auth group khi chuyển sang module Document
- Module routes file cần 2 groups: `Route::middleware(['signed:relative'])` + `Route::middleware(['auth:sanctum', ...])`

**Deprecated aliases** (65 routes):
- Mỗi batch khi chuyển routes phải bao gồm TẤT CẢ deprecated aliases cho endpoints đó
- Giữ `deprecated.route:{canonical},{sunset_date}` middleware trên aliases
- Route inventory chi tiết cho từng batch ở section tương ứng

**Heavy throttle** (10 routes):
- `storeSupportRequestsBulk`, `storeEmployeesBulk`, `storeSupportServiceGroupsBulk`, `storeSupportContactPositionsBulk`, `storeSupportRequestStatusesBulk`, `importCustomerRequests`, `exportCustomerRequests`, `exportCustomerRequestDashboardSummary`, `exportSupportRequests` + thêm
- Khi chuyển: thêm `throttle:api.write.heavy` middleware THAY VÌ `throttle:api.write` cho các endpoints này

---

## Phân tích 19 Modules

### Bảng tổng hợp (sắp theo thứ tự tách)

| Đợt | Module | ~Dòng | Public | Private | Đích | File gốc (line range) |
|-----|--------|-------|--------|---------|------|----------------------|
| 1 | Vendor | 164 | 4 | 3 | → VendorDomainService (existing) | L560-583, L8080-8169 |
| 1 | Business | 230 | 4 | 0 | → NEW BusinessMasterDataService | L932-1161 |
| 1 | System | 149 | 1 | 5 | → NEW SystemHealthService | L11234-11282 |
| 2 | Product | 574 | 4 | 8 | → NEW ProductMasterDataService | L1162-1485 |
| 2 | Customer | 417 | 4 | 5 | → CustomerDomainService (existing) | L477-559, L7946-8079 |
| 2 | Calendar | 504 | 3 | 7 | → NEW CalendarMasterDataService | L19924-20227 |
| 3 | AuditLog | 313 | 1 | 6 | → NEW AuditLogMasterDataService | L2128-2240 |
| 3 | Workflow | 322 | 9 | 3 | → NEW WorkflowCatalogController | L5010-5231 |
| 3 | SupportConfig-Positions | 200 | 4 | 5 | → NEW (tách sớm cho CustomerPersonnel dep) | L2675-2942 |
| 4 | CustomerPersonnel | 489 | 4 | 10 | → NEW CusPersonnelMasterDataService | L1486-1774 |
| 4 | Opportunity | 831 | 7 | 15 | → OpportunityDomainService (existing) | L903-931, L2943-3138, L11028-11233 |
| 5 | Project | 1,010 | 8 | 14 | → ProjectDomainService (existing) | L584-708, L3139-3322, L8170-8420 |
| 5 | Department | 300 | 4 | 5 | → DepartmentDomainService (existing) | L283-476 (dept portion) |
| 5 | Employee | 1,872 | 11 | 23 | → NEW EmployeeMasterDataService | L2009-2127, L7287-7945 |
| 6 | UserAccess-Core | 3,500 | 6 | 15 | → NEW UserAccessMasterDataService | L11283-11595 + helpers |
| 6 | UserAccess-DeptScope | 6,641 | 0 (internal) | 50+ | → NEW UserDeptScopeService | L11595-19923 |
| 7 | CustomerRequest | 1,724 | 12 | 30 | → CustomerRequestCaseController (existing) | L709-750, L4133-5009, L5232-5236 |
| 7 | Contract | 2,295 | 7 | 22 | → ContractDomainService (existing) | L751-902, L8421-8873, L10198-11027 |
| 8 | SupportConfig (còn lại) | 2,512 | 15 | 30 | → NEW SupportConfigMasterDataService | L2241-2674, L3323-4132 |
| 9 | Integration | 2,486 | 10 | 60 | → NEW IntegrationSettingsService | L9512-10197 |
| 10 | SupportRequest | 5,250 | 11 | 55 | → NEW SupportRequestMasterDataService | L5237-7286 |
| 10 | Document | 3,062 | 10 | 45 | → NEW DocumentMasterDataService | L1775-2008, L8884-9511 |
| **Final** | **Cleanup** | 0 | 0 | 0 | **DELETE V5MasterDataController.php** | — |

**Thay đổi so với draft ban đầu:**
- UserAccess tách thành 2 phần (Core + DeptScope) và đưa lên Đợt 6 thay vì Đợt 12
- SupportConfig-Positions tách sớm (Đợt 3) để giải quyết dependency của CustomerPersonnel
- Đợt cuối chỉ là cleanup (xóa file gốc), không chứa logic mới

---

## Kế hoạch chi tiết từng đợt

### Đợt 1: Vendor + Business + System (~543 dòng) — VALIDATE QUY TRÌNH

**Mục tiêu**: Validate toàn bộ quy trình tách trên 3 module đơn giản nhất, không cross-dependency.

#### Module Vendor (164 dòng) → merge vào VendorDomainService existing

**Public methods chuyển**:
| Method V5MDC | Line | Đích |
|-------------|------|------|
| `vendors()` | L560-583 | VendorDomainService::index() |
| `storeVendor()` | L8080-8116 | VendorDomainService::store() |
| `updateVendor()` | L8117-8158 | VendorDomainService::update() |
| `deleteVendor()` | L8159-8169 | VendorDomainService::destroy() |

**Private methods chuyển**:
| Method | Line | Đích |
|--------|------|------|
| `serializeVendor()` | L19134-19139 | VendorDomainService (inline) |
| `loadVendorById()` | L19140-19148 | VendorDomainService (inline) |
| `vendorSelectColumns()` | L19149-19155 | VendorDomainService (inline) |

**Routes chuyển** (4 canonical + 0 deprecated aliases):
```
GET  /api/v5/vendors              → permission:vendors.read
POST /api/v5/vendors              → permission:vendors.write
PUT  /api/v5/vendors/{id}         → permission:vendors.write
DELETE /api/v5/vendors/{id}       → permission:vendors.delete
```

#### Module Business (230 dòng) → NEW BusinessMasterDataController

**Public methods**: `businesses`, `storeBusiness`, `updateBusiness`, `deleteBusiness`
**Routes**: 4 canonical + 0 deprecated

#### Module System (149 dòng) → NEW SystemHealthController

**Public methods**: `tableHealth`
**Routes**: 1 canonical

#### Verification Đợt 1

| Check | Command / Action | Expected |
|-------|-----------------|----------|
| Unit + Feature tests | `cd backend && composer test` | 104 tests pass |
| Route parity | `php artisan route:list --path=api/v5/vendors` | 4 routes → VendorController |
| Route parity | `php artisan route:list --path=api/v5/businesses` | 4 routes → BusinessMasterDataController |
| Response contract | `curl GET /api/v5/vendors` | Response JSON shape unchanged |
| Response contract | `curl POST /api/v5/vendors` | Create successful, 201 |
| Cache behavior | Create vendor → `GET /api/v5/vendors` | New vendor appears (cache invalidated) |
| Middleware parity | Unauthorized call → 403 | Permission check works |
| V5MDC cleanup | grep `vendors\|businesses\|tableHealth` in V5MDC | 0 public methods remaining for these modules |

#### Rollback Đợt 1 (Mixed: Type B cho Vendor, Type A cho Business + System)

```bash
# Type B — Vendor (merge-into-existing)
git checkout HEAD -- app/Services/V5/Domain/VendorDomainService.php
git checkout HEAD -- app/Http/Controllers/Api/V5/VendorController.php

# Type A — Business, System (new controllers — chỉ cần revert routes)
# New files harmless khi không có routes trỏ vào

# Revert routes (áp dụng cho cả Type A và B)
git checkout HEAD -- routes/api.php
php artisan route:clear && php artisan config:clear && php artisan cache:clear
composer test
```

**Stop criteria**: Nếu >2 tests fail hoặc response contract thay đổi → REVERT ngay, không tiếp tục đợt 2.

---

### Đợt 2: Product + Customer + Calendar (~1,495 dòng)

#### Module Product (574 dòng) → NEW ProductMasterDataController + ProductMasterDataService

**Public methods**: `products`, `storeProduct`, `updateProduct`, `deleteProduct`
**Private methods**: `serializeProductRecord()`, `loadProductById()`, `isUniqueConstraintViolation()`, `productSelectColumns()`, `parseProductSearchFilter()`, `productCacheKey()`, `invalidateProductCache()`, `serializeProductForExport()`
**Routes**: 4 canonical + 0 deprecated
**Middleware đặc biệt**: Không

#### Module Customer (417 dòng) → merge vào CustomerDomainService existing

**Public methods**: `customers`, `storeCustomer`, `updateCustomer`, `deleteCustomer`
**Private methods**: `serializeCustomer()`, `customerRelationColumns()`, `loadCustomerById()`, `customerSelectColumns()`, `customerCacheKey()`
**Routes**: 4 canonical + deprecated aliases (e.g., `customer_list` nếu có)

#### Module Calendar (504 dòng) → NEW CalendarMasterDataController + CalendarMasterDataService

**Public methods**: `monthlyCalendars`, `updateCalendarDay`, `generateCalendarYear`
**Private methods**: `loadCalendarDayByDate()`, `serializeCalendarDayRecord()`, `resolveVietnameseFixedHoliday()`, `resolveVietnameseMovableHoliday()`, `getCalendarModel()`, `calendarSelectColumns()`, `isCalendarDayLocked()`
**Routes**: 3 canonical

#### Verification Đợt 2

| Check | Command / Action | Expected |
|-------|-----------------|----------|
| Tests | `composer test` | All pass |
| Route parity products | `php artisan route:list --path=api/v5/products` | 4 routes |
| Route parity customers | `php artisan route:list --path=api/v5/customers` | 4 routes → CustomerController |
| Route parity calendar | `php artisan route:list --path=api/v5/monthly-calendars` | 3 routes |
| Product cache | Create/update product → verify cache invalidation | List refreshes |
| Customer aliases | Deprecated route aliases still respond | 200 with deprecation headers |

#### Rollback Đợt 2 (Mixed: Type B cho Customer, Type A cho Product + Calendar)

```bash
# Type B — Customer (merge-into-existing)
git checkout HEAD -- app/Services/V5/Domain/CustomerDomainService.php
git checkout HEAD -- app/Http/Controllers/Api/V5/CustomerController.php

# Revert routes + clear caches
git checkout HEAD -- routes/api.php
php artisan route:clear && php artisan config:clear && php artisan cache:clear
composer test
```

---

### Đợt 3: AuditLog + Workflow + SupportConfig-Positions (~835 dòng)

**Thay đổi quan trọng**: SupportContactPositions tách sớm (trước CustomerPersonnel) để giải quyết dependency.

#### Module AuditLog (313 dòng) → NEW AuditLogMasterDataController

**Public**: `auditLogs`
**Private**: `resolveAuditActorMap()`, `formatDateColumn()`, `auditLogSelectColumns()`, `serializeAuditLog()`, `auditLogCacheKey()`, `buildAuditLogFilterQuery()`

#### Module Workflow (322 dòng) → NEW WorkflowCatalogController

**Public**: `workflowStatusCatalogs`, `storeWorkflowStatusCatalog`, `updateWorkflowStatusCatalog`, `workflowFormFieldConfigs`, `workflowStatusTransitions`, `storeWorkflowStatusTransition`, `updateWorkflowStatusTransition`, `storeWorkflowFormFieldConfig`, `updateWorkflowFormFieldConfig`
**Thin layer** — hầu hết delegate sang `CustomerRequestWorkflowService` đã tồn tại

#### Module SupportConfig-Positions (200 dòng) — tách sớm

**Public**: `supportContactPositions`, `storeSupportContactPosition`, `storeSupportContactPositionsBulk`, `updateSupportContactPosition`
**Middleware đặc biệt**: `storeSupportContactPositionsBulk` dùng `throttle:api.write.heavy`

#### Verification Đợt 3

| Check | Expected |
|-------|----------|
| `composer test` | All pass |
| Audit log endpoint | Paginated response unchanged |
| Workflow CRUD | Create/update status catalog works |
| SupportContactPositions | CRUD + bulk import works |
| Heavy throttle on bulk | `throttle:api.write.heavy` applied |

---

### Đợt 4: CustomerPersonnel + Opportunity (~1,320 dòng)

#### Module CustomerPersonnel (489 dòng) → NEW CusPersonnelMasterDataController

**Cross-deps giải quyết**: CustomerLookup (Đợt 2), SupportContactPositions (Đợt 3) — đã tách

#### Module Opportunity (831 dòng) → merge vào existing OpportunityController

**Public**: CRUD + stage definitions
**Cross-dep**: StatusMappingService cho legacy stage mapping

#### Verification: Tests + route parity + deprecated aliases cho opportunity endpoints

---

### Đợt 5: Project + Employee + Department (~3,182 dòng)

#### Module Project (1,010 dòng) → merge vào existing ProjectController + ProjectDomainService

#### Module Department (thuộc V5MDC, ~300 dòng) → merge vào existing DepartmentController + DepartmentDomainService

Lưu ý: `DepartmentController.php` đã tồn tại trong `V5/`, routes `/api/v5/departments` đã trỏ vào controller này. Chỉ cần di chuyển code department-related từ V5MasterDataController vào DepartmentDomainService existing. **KHÔNG gộp vào Employee batch.**

#### Module Employee (~1,872 dòng) → NEW EmployeeMasterDataController + EmployeeMasterDataService

Bao gồm: Employee CRUD + User Dept History + password reset (KHÔNG bao gồm Department CRUD — đã tách riêng ở trên)
**Middleware đặc biệt**: `storeEmployeesBulk` dùng `throttle:api.write.heavy`
**Deprecated aliases**: `/employees` ↔ `/internal-users` (nhiều variants)

#### Verification: Đặc biệt chú ý deprecated aliases `/employees` vs `/internal-users`

---

### Đợt 6: UserAccess (tách thành 2 parts) (~10,141 dòng) — TÁCH SỚM

**Lý do đưa lên sớm**: UserAccess = 41% file gốc. Tách sớm để giảm kích thước V5MDC nhanh nhất, giảm risk dồn cuối.

#### Part 1: UserAccess-Core (3,500 dòng) → NEW UserAccessMasterDataController + UserAccessMasterDataService

**Public methods**: `roles`, `permissions`, `userAccess`, `updateUserRoles`, `updateUserPermissions`, `updateUserDeptScopes` (method này delegate sang Part 2)

#### Part 2: UserAccess-DeptScope (6,641 dòng) → NEW UserDeptScopeService

**Tách từ mega-method `updateUserDeptScopes`** (8,329 dòng):
- Extract internal helper methods thành service methods
- `buildUserAccessRows()`, `resolveUserAccessBaseSelectColumns()`, và ~50 private helpers
- Controller method `updateUserDeptScopes()` chỉ gọi `$this->deptScopeService->execute($request)`

#### Verification Đợt 6

| Check | Expected |
|-------|----------|
| `composer test` | All pass |
| User roles assignment | `updateUserRoles` works |
| User permissions | `updateUserPermissions` works |
| **Dept scope assignment** | `updateUserDeptScopes` — **CRITICAL**: test tất cả scenarios |
| `V5DomainRouteBindingTest` | Updated assertions pass |

#### Rollback: Revert routes + keep new files, đặc biệt cần test kỹ trước khi merge.

---

### Đợt 7: CustomerRequest + Contract (~4,019 dòng)

#### Module CustomerRequest (1,724 dòng) → merge vào existing CustomerRequestCaseController

**Middleware đặc biệt**: `importCustomerRequests`, `exportCustomerRequests`, `exportCustomerRequestDashboardSummary` dùng `throttle:api.write.heavy`

#### Module Contract (2,295 dòng) → merge vào existing ContractController + ContractDomainService

**Phức tạp**: Payment generation (648 dòng), payment schedules

#### Verification: Payment generation scenarios (milestone, cycle-based, allocation modes)

---

### Đợt 8: SupportConfig còn lại (~2,512 dòng)

**Public methods**: Service Groups (5), Request Statuses (4), Worklog Activity Types (3), SLA Configs (3)
**Middleware đặc biệt**: Bulk endpoints dùng `throttle:api.write.heavy`

→ NEW SupportConfigMasterDataController + SupportConfigMasterDataService

---

### Đợt 9: Integration (~2,486 dòng)

- Backblaze B2: settings, test connection, upload/download/delete
- Google Drive: settings, test connection, upload
- Contract Alert settings
- → NEW IntegrationSettingsController + IntegrationSettingsService
- **Post-migration refactor** (backlog, KHÔNG trong scope migration): `BackblazeB2StorageService`, `GoogleDriveStorageService`

---

### Đợt 10: SupportRequest + Document (~8,312 dòng)

#### SupportRequest (5,250 dòng) → NEW SupportRequestMasterDataController

**Middleware đặc biệt**: `storeSupportRequestsBulk`, `exportSupportRequests` dùng `throttle:api.write.heavy`

#### Document (3,062 dòng) → NEW DocumentMasterDataController

**Routes đặc biệt**: 3 signed download routes (NGOÀI auth group):
```php
// PHẢI tách thành route group riêng, KHÔNG wrap trong auth middleware
Route::middleware(['signed:relative'])->group(function () {
    Route::get('/documents/attachments/{id}/download', ...);
    Route::get('/attachments/{id}/download', ...);
    Route::get('/documents/attachments/temp-download', ...);  // KHÔNG có {id} param
});
```

**Đây là risk cao nhất** — nếu signed routes bị wrap trong auth middleware, attachment downloads sẽ break.

#### Verification Đợt 10

| Check | Expected |
|-------|----------|
| `composer test` | All pass |
| Signed download | `curl` signed URL without auth → 200 + file |
| Signed download expired | Expired signed URL → 403 |
| Signed URI exact match | Assert exact URIs: `/documents/attachments/{id}/download`, `/attachments/{id}/download`, `/documents/attachments/temp-download` |
| Support request bulk | Bulk create + heavy throttle applied |
| Export support requests | Export endpoint returns file |

---

### Đợt Final: Cleanup — DELETE V5MasterDataController.php

**Pre-conditions (tất cả PHẢI true)**:
- [ ] `grep -c 'public function' V5MasterDataController.php` = 0 (hoặc file đã empty)
- [ ] `grep -c 'V5MasterDataController' routes/api.php` = 0
- [ ] `composer test` — all pass
- [ ] `php artisan route:list --path=api/v5 | wc -l` = same count as before migration
- [ ] All 65 deprecated aliases still respond with deprecation headers
- [ ] 3 signed download routes work without auth
- [ ] 10 heavy throttle routes have correct middleware

**Actions**:
1. Delete `app/Http/Controllers/Api/V5MasterDataController.php`
2. Remove `use` import from `routes/api.php`
3. Update `V5DomainRouteBindingTest.php` — remove V5MasterDataController assertions
4. Update `CustomerRequestIntakeStageValidationTest.php` — point to new service
5. `composer test` → all pass
6. **Tag release**: `v5.0.0-modular`

---

## Chiến lược Rollback (mỗi đợt)

### Hai loại batch — hai chiến lược rollback khác nhau

**Type A: New controller batches** (Business, System, Product, Calendar, AuditLog, Workflow, SupportConfig-Positions, CustomerPersonnel, Employee, UserAccess, SupportConfig, Integration, SupportRequest, Document)
- Rollback đơn giản: revert `routes/api.php` → routes trỏ lại V5MasterDataController
- New controller/service files harmless (không ai gọi)

**Type B: Merge-into-existing batches** (Vendor, Customer, Opportunity, Project, Contract, CustomerRequest)
- Rollback PHẢI revert cả service/controller files bị sửa:
```bash
# Revert touched files (ví dụ Vendor batch)
git checkout HEAD -- routes/api.php
git checkout HEAD -- app/Services/V5/Domain/VendorDomainService.php
git checkout HEAD -- app/Http/Controllers/Api/V5/VendorController.php
```
- **Quan trọng**: Vì DomainService đã live qua V5 controller routes, revert route file KHÔNG đủ — phải revert service file nữa.

### Quy trình rollback chuẩn

**Type A — New controller batches** (Business, System, Product, Calendar, AuditLog, Workflow, SupportConfig-Positions, CustomerPersonnel, Employee, UserAccess, SupportConfig, Integration, SupportRequest, Document):
```bash
git checkout HEAD -- routes/api.php
php artisan route:clear && php artisan config:clear && php artisan cache:clear
composer test
```

**Type B — Merge-into-existing batches** (Vendor, Customer, Department, Opportunity, Project, Contract, CustomerRequest):
```bash
# Revert routes AND touched service/controller files
git checkout HEAD -- routes/api.php
git checkout HEAD -- app/Services/V5/Domain/{Module}DomainService.php
git checkout HEAD -- app/Http/Controllers/Api/V5/{Module}Controller.php
php artisan route:clear && php artisan config:clear && php artisan cache:clear
composer test
```

**Quan trọng**: Type B batches modify live service files — reverting only routes is NOT sufficient.

### Stop / Revert / Continue criteria

| Condition | Action |
|-----------|--------|
| `composer test` pass + response contracts match | ✅ CONTINUE to next batch |
| 1-2 test failures, fixable in <1h | ⚠️ FIX then continue |
| >2 test failures OR response contract changed | 🔴 REVERT immediately |
| Signed download routes broken | 🔴 REVERT immediately (user-facing) |
| Deprecated aliases return 404 | 🔴 REVERT immediately (API compatibility) |

### Tại sao rollback hoạt động

- **Type A batches** (new controllers): Routes/api.php là single cutover point. New files tồn tại nhưng không ai gọi → harmless.
- **Type B batches** (merge-into-existing): Cần revert cả routes + service/controller files vì chúng đã live qua existing V5 routes. Git checkout HEAD đưa tất cả files về state trước batch.
- Cache clear đảm bảo Laravel đọc route definitions mới.

**Quan trọng**: KHÔNG xóa public methods khỏi V5MasterDataController cho đến khi batch đã verify thành công. Xóa methods chỉ xảy ra SAU khi pass tất cả verification checks.

---

## Chiến lược xử lý Private Methods dùng chung

### 29 utility methods (gọi ~2,100 lần) → đã extract vào Shared Services

| Shared Service | Methods | Calls | Trạng thái |
|---------------|---------|-------|-----------|
| ColumnDetectionService | hasTable (296), hasColumn (623), selectColumns, filterPayloadByTableColumns, setAttributeIfColumn (121), setAttributeByColumns, missingTable | ~1,100 | ✅ Done |
| PaginationService | shouldPaginate, resolvePaginationParams, buildPaginationMeta, buildSimplePaginationMeta | ~200 | ✅ Done |
| SortingService | resolveSortDirection, resolveSortColumn | ~100 | ✅ Done |
| NormalizationService | parseNullableInt (228), normalizeNullableString (219), readFilterParam, firstNonEmpty | ~500 | ✅ Done |
| StatusMappingService | toProjectStorageStatus, fromProjectStorageStatus, toContractStorageStatus, fromContractStorageStatus, toOpportunityStorageStage, fromOpportunityStorageStage, normalizePaymentCycle | ~50 | ✅ Done |
| V5AccessAuditService (existing) | recordAuditEvent, toAuditArray, encodeAuditValues | ~150 | ✅ Existing |

### ~287 remaining private methods → inline trong module services

Mỗi serialize/helper method chỉ dùng trong 1 domain → copy vào module service tương ứng.

**Full coverage proof**: Trước khi bắt đầu mỗi batch, step đầu tiên là chạy:
```bash
rg -n '^\s*public function ' V5MasterDataController.php  # list remaining public methods
rg -n '^\s*private function ' V5MasterDataController.php  # list remaining private methods
```
Và tạo method-level mapping table (giống Batch 1 Vendor example) cho batch đó. Bảng này commit vào PR description hoặc appended vào plan file trước khi review.

**Post-batch audit**: Sau mỗi batch, verify:
```bash
# Đếm methods còn lại trong V5MasterDataController
rg -c '^\s*public function ' V5MasterDataController.php   # phải giảm đúng số moved
rg -c '^\s*private function ' V5MasterDataController.php  # phải giảm đúng số moved
```

**Lưu ý**: Con số 316 private methods trong V5MasterDataController bao gồm cả các methods đã extract sang Shared Services. Sau khi trừ 29 shared methods, còn ~287 domain-specific private methods cần di chuyển vào module services tương ứng.

### Scope/Authorization methods → V5DomainSupportService existing

- `resolveAuthenticatedUserId()` → V5DomainSupportService (existing pattern)
- `authorizeMutationByScope()` → V5DomainSupportService
- `denyScopeMutation()` → V5DomainSupportService
- `resolveAllowedDepartmentIdsForRequest()` → V5DomainSupportService

---

## Xử lý Tests

### Test files tham chiếu V5MasterDataController

1. `V5DomainRouteBindingTest.php` (32+ assertions) — assert route → controller mapping → CẬP NHẬT dần khi tách từng batch
2. `CustomerRequestIntakeStageValidationTest.php` — `app(V5MasterDataController::class)` → CHUYỂN sang module service khi tách CustomerRequest (Đợt 7)

### Các test endpoint-specific khác (không tham chiếu controller trực tiếp nhưng gọi API routes)

Cần verify sau mỗi batch: customer request workflow tests, payment schedule tests, workflow transition tests, SLA resolution tests, scope authorization tests.

### Verification matrix chuẩn (áp dụng mỗi đợt)

| Category | Check | Method |
|----------|-------|--------|
| Route parity | Số routes không đổi | `php artisan route:list --path=api/v5 \| wc -l` |
| Middleware parity | Middleware stack từng route không đổi | `php artisan route:list --path=api/v5/{module} --columns=middleware` |
| Alias parity | Deprecated aliases vẫn respond | `curl` test từng alias |
| Response contract | JSON response shape không đổi | Side-by-side comparison before/after |
| Auth behavior | Unauthenticated → 401 | `curl` without token |
| Permission behavior | Unauthorized → 403 | `curl` with non-admin user |
| Cache behavior | Write → cache invalidated → read reflects change | Sequential API calls |
| Signed routes (Đợt 10) | Download without auth | `curl` signed URL |
| Heavy throttle (khi có) | Bulk endpoint has heavy throttle | Route list shows middleware |
| Test suite | All tests pass | `composer test` |
| Frontend smoke | Frontend can load + CRUD | `npm run lint && npm run test` |

---

## Timeline dự kiến

| Đợt | Modules | Effort | Rủi ro |
|-----|---------|--------|--------|
| 1 | Vendor + Business + System | 0.5 ngày | Thấp (validate quy trình) |
| 2 | Product + Customer + Calendar | 1 ngày | Thấp |
| 3 | AuditLog + Workflow + SupportConfig-Positions | 0.5 ngày | Thấp |
| 4 | CustomerPersonnel + Opportunity | 1 ngày | Trung bình |
| 5 | Project + Employee | 1.5 ngày | Trung bình (nhiều aliases) |
| 6 | UserAccess (Core + DeptScope) | 3 ngày | **Cao** (8,329 dòng mega-method) |
| 7 | CustomerRequest + Contract | 2 ngày | Cao (payment generation) |
| 8 | SupportConfig (còn lại) | 1 ngày | Trung bình |
| 9 | Integration | 1.5 ngày | Cao (B2 + GDrive APIs) |
| 10 | SupportRequest + Document | 2.5 ngày | **Cao** (signed routes!) |
| Final | Cleanup + DELETE | 0.5 ngày | Thấp (chỉ xóa) |
| **Tổng** | | **~15 ngày** | |

---

## Nguyên tắc khi tách

1. **API contract không đổi**: Response format, field names, HTTP status codes giữ nguyên 100%
2. **Backward compatible**: Deprecated routes vẫn hoạt động đến 2026-04-27
3. **Hội tụ kiến trúc**: Dùng V5BaseController + DomainService pattern hiện tại, KHÔNG tạo kiến trúc song song
4. **Test sau mỗi đợt**: Verification matrix đầy đủ (route parity, middleware parity, response contract, ...)
5. **Không refactor logic**: Chỉ di chuyển code, không optimize/refactor business logic
6. **Frontend không sửa**: v5Api.ts gọi cùng endpoints, nhận cùng response → zero frontend changes
7. **Rollback rõ ràng**: Type A (new controllers) = revert routes only. Type B (merge-into-existing) = revert routes + service/controller files. Xem section "Chiến lược Rollback" cho chi tiết.
8. **Xóa V5MDC methods SAU verification**: Không xóa public methods trước khi batch pass tất cả checks
