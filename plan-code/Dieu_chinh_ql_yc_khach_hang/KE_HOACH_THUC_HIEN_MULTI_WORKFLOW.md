# 📋 KẾ HOẠCH THỰC HIỆN: CẤU HÌNH ĐỘNG LUỒNG YÊU CẦU KHÁCH HÀNG

**Multi-Workflow Support Implementation Plan**

| Thông Tin | Giá Trị |
|-----------|---------|
| **Version** | 1.0 |
| **Ngày Tạo** | 2026-03-28 |
| **Chủ Đầu Tư** | VNPT Business Management |
| **Độ Ưu Tiên** | High |
| **Tổng Thời Lượng** | 5 tuần (25 ngày làm việc) |
| **Số Lượng Tasks** | 47 tasks |
| **Số Lượng Phases** | 5 phases |

---

## 🎯 MỤC TIÊU DỰ ÁN

### Mục Tiêu Tổng Quát

Xây dựng hệ thống **cấu hình động đa luồng** (Multi-Workflow Support) cho module Customer Request Management, cho phép:

1. ✅ Định nghĩa nhiều workflow cho cùng một loại quy trình
2. ✅ Kích hoạt/vô hiệu hóa workflow từ Admin UI
3. ✅ Chỉ 1 workflow active tại một thời điểm
4. ✅ Chuyển đổi mượt mà giữa các phiên bản workflow
5. ✅ Import/export ma trận transitions từ Excel

### Phạm Vi Áp Dụng

| Module | Process Type | Phase |
|--------|--------------|-------|
| **Customer Request Management** | `customer_request` | Phase 1-4 |
| **Project Procedure** | `project_procedure` | Phase 5 (Future) |
| **Document Approval** | `document_approval` | Phase 5 (Future) |

---

## 📊 PHÂN TÍCH CHỨC NĂNG

### Yêu Cầu Chức Năng (Functional Requirements)

| ID | Yêu Cầu | Mô Tả | Priority |
|----|---------|-------|----------|
| FR-01 | Quản lý workflow definitions | CRUD workflows với code, name, version | High |
| FR-02 | Kích hoạt workflow | Active 1 workflow, tự động deactivate các workflow khác | High |
| FR-03 | Quản lý transitions | CRUD ma trận transitions cho mỗi workflow | High |
| FR-04 | Import từ Excel | Bulk import transitions từ file Excel | High |
| FR-05 | Export ra Excel | Export cấu hình workflow để backup | Medium |
| FR-06 | Workflow-aware transitions | Filter transitions theo workflow_definition_id | High |
| FR-07 | Validation khi chuyển trạng thái | Kiểm tra transition hợp lệ theo workflow active | High |
| FR-08 | Admin UI workflow management | Giao diện quản lý workflows cho admin | High |
| FR-09 | Transition Matrix Editor | UI chỉnh sửa ma trận transitions | Medium |
| FR-10 | Clone workflow | Nhân bản workflow từ workflow có sẵn | Low |

### Yêu Cầu Phi Chức Năng (Non-Functional Requirements)

| ID | Yêu Cầu | Target |
|----|---------|--------|
| NFR-01 | Performance | Get active workflow < 5ms, Get transitions < 10ms |
| NFR-02 | Availability | 99.9% uptime trong giờ hành chính |
| NFR-03 | Security | Chỉ Admin mới được quản lý workflow |
| NFR-04 | Audit | Ghi log đầy đủ các thay đổi workflow |
| NFR-05 | Compatibility | Không phá vỡ dữ liệu CRC hiện có |
| NFR-06 | Test Coverage | Unit tests 80%+, E2E tests cho critical paths |

### Ràng Buộc Kỹ Thuật (Constraints)

| ID | Ràng Buộc | Impact |
|----|-----------|--------|
| C-01 | Tech Stack | React 19 + Vite + Laravel 12 + MySQL 8 |
| C-02 | Database | Sử dụng schema hiện có, thêm bảng mới `workflow_definitions` |
| C-03 | API Format | Tuân thủ chuẩn API response hiện tại |
| C-04 | Authentication | Sanctum cookie-based auth |
| C-05 | Soft Deletes | Tất cả models sử dụng SoftDeletes |

### Rủi Ro & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Mất dữ liệu transitions** | High | Low | Backup trước khi activate, rollback plan |
| **Breaking existing transitions** | High | Medium | Feature flag, gradual rollout, compatibility layer |
| **UI/UX confusion** | Medium | Medium | User training, documentation, clear warnings |
| **Performance degradation** | Medium | Low | Proper indexing, query optimization |
| **Data migration failure** | High | Low | Test migration trên staging, backup đầy đủ |

---

## 📝 CHI TIẾT PLAN THEO PHASE

---

## Phase 1: DATABASE & BACKEND CORE

**Thời Lượng:** 5 ngày (Tuần 1)  
**Chủ Trì:** Backend Developer  
**Mục Tiêu:** Thiết lập nền tảng database và core models

### Deliverables

- [ ] Database schema hoàn chỉnh
- [ ] Migration scripts
- [ ] Models với đầy đủ relationships
- [ ] Base service layer
- [ ] Unit tests cho models

### Tiêu Chí Hoàn Thành (DoD)

- [ ] Migration chạy thành công trên local và staging
- [ ] Tất cả models pass unit tests
- [ ] Relationships được verify đúng
- [ ] Indexes được tạo đúng specification
- [ ] Code review approved

---

### Task T1.1: Tạo Migration Script cho `workflow_definitions`

**File:** `backend/database/migrations/2026_03_28_000001_create_workflow_definitions_table.php`

**Công Việc:**
- [ ] Tạo bảng `workflow_definitions` với đầy đủ columns
- [ ] Thêm indexes: `idx_process_active`, `idx_workflow_group`, `idx_version`
- [ ] Thêm foreign keys đến `internal_users`
- [ ] Viết test migration (up/down)
- [ ] Chạy migration test trên local

**Estimated:** 4 hours  
**Priority:** High  
**Dependencies:** None  
**Assignee:** Backend Developer

**Code Example:**
```php
Schema::create('workflow_definitions', function (Blueprint $table) {
    $table->id();
    $table->string('code', 50);
    $table->string('name', 255);
    $table->text('description')->nullable();
    $table->string('process_type', 50)->default('customer_request');
    $table->string('workflow_group', 100)->default('default');
    $table->boolean('is_active')->default(false);
    $table->boolean('is_default')->default(false);
    $table->string('version', 20)->default('1.0');
    $table->json('config')->nullable();
    $table->json('metadata')->nullable();
    $table->unsignedBigInteger('created_by')->nullable();
    $table->unsignedBigInteger('activated_by')->nullable();
    $table->timestamp('activated_at')->nullable();
    $table->timestamps();
    $table->softDeletes();
    
    $table->unique(['code', 'process_type', 'deleted_at']);
    $table->index(['process_type', 'is_active', 'deleted_at']);
});
```

---

### Task T1.2: Cập nhật `workflow_transitions` Table

**File:** `backend/database/migrations/2026_03_28_000002_add_workflow_definition_id_to_transitions.php`

**Công Việc:**
- [ ] Thêm column `workflow_definition_id` vào `workflow_transitions`
- [ ] Thêm index `idx_workflow_definition`
- [ ] Thêm foreign key reference đến `workflow_definitions`
- [ ] Update comment table
- [ ] Test migration rollback

**Estimated:** 3 hours  
**Priority:** High  
**Dependencies:** T1.1  
**Assignee:** Backend Developer

---

### Task T1.3: Tạo Model `WorkflowDefinition`

**File:** `backend/app/Models/WorkflowDefinition.php`

**Công Việc:**
- [ ] Tạo model với đầy đủ fillable fields
- [ ] Config casts cho JSON columns
- [ ] Tạo relationships: `transitions()`, `creator()`, `activator()`
- [ ] Tạo scopes: `active()`, `default()`, `processType()`
- [ ] Thêm helper methods: `canEdit()`, `canDelete()`, `getNotificationConfig()`
- [ ] Viết unit tests cho model

**Estimated:** 4 hours  
**Priority:** High  
**Dependencies:** T1.1  
**Assignee:** Backend Developer

---

### Task T1.4: Cập nhật Model `WorkflowTransition`

**File:** `backend/app/Models/WorkflowTransition.php`

**Công Việc:**
- [ ] Thêm `workflow_definition_id` vào fillable
- [ ] Tạo relationship `workflow()`
- [ ] Thêm scopes: `forWorkflow()`, `fromStatus()`, `active()`
- [ ] Thêm methods: `canExecute()`, `getRequiredFields()`, `getTransitionConfig()`
- [ ] Viết unit tests

**Estimated:** 3 hours  
**Priority:** High  
**Dependencies:** T1.2  
**Assignee:** Backend Developer

---

### Task T1.5: Cập nhật Model `CustomerRequestCase`

**File:** `backend/app/Models/CustomerRequestCase.php`

**Công Việc:**
- [ ] Thêm column `workflow_definition_id` vào fillable
- [ ] Tạo relationship `workflow()`
- [ ] Update factory nếu có
- [ ] Test integration với workflow

**Estimated:** 2 hours  
**Priority:** Medium  
**Dependencies:** T1.1  
**Assignee:** Backend Developer

---

### Task T1.6: Tạo Database Seeder

**File:** `backend/database/seeders/WorkflowDefinitionSeeder.php`

**Công Việc:**
- [ ] Seed workflow mặc định `LUONG_A` cho `customer_request`
- [ ] Seed transitions từ workflow hiện có
- [ ] Set `is_active = true` cho workflow mặc định
- [ ] Test seeder trên local

**Estimated:** 4 hours  
**Priority:** High  
**Dependencies:** T1.1, T1.2  
**Assignee:** Backend Developer

**Data Seed:**
```php
WorkflowDefinition::create([
    'code' => 'LUONG_A',
    'name' => 'Luồng xử lý A (Mặc định)',
    'process_type' => 'customer_request',
    'is_active' => true,
    'is_default' => true,
    'version' => '1.0',
    'created_by' => 1, // admin
    'activated_at' => now(),
]);
```

---

### Task T1.7: Viết Tests cho Models & Migrations

**Files:** 
- `backend/tests/Feature/WorkflowDefinitionTest.php`
- `backend/tests/Feature/WorkflowTransitionTest.php`

**Công Việc:**
- [ ] Test create/read/update/delete workflow
- [ ] Test activate/deactivate workflow
- [ ] Test transitions relationship
- [ ] Test scopes và helper methods
- [ ] Test migration rollback

**Estimated:** 6 hours  
**Priority:** High  
**Dependencies:** T1.3, T1.4, T1.6  
**Assignee:** Backend Developer

---

## Phase 2: BACKEND API & SERVICES

**Thời Lượng:** 5 ngày (Tuần 2)  
**Chủ Trì:** Backend Developer  
**Mục Tiêu:** Xây dựng service layer và API endpoints

### Deliverables

- [ ] 13 API endpoints hoạt động
- [ ] Service layer hoàn chỉnh
- [ ] Validation logic
- [ ] Audit logging
- [ ] Integration tests

### Tiêu Chí Hoàn Thành (DoD)

- [ ] Tất cả API endpoints pass tests
- [ ] Audit logs được ghi đầy đủ
- [ ] Validation hoạt động chính xác
- [ ] Performance đạt target (< 50ms cho complex operations)
- [ ] API documentation cập nhật

---

### Task T2.1: Tạo `WorkflowDefinitionService`

**File:** `backend/app/Services/V5/Workflow/WorkflowDefinitionService.php`

**Công Việc:**
- [ ] Method `listWorkflows()` - List workflows by process type
- [ ] Method `getActiveWorkflow()` - Get active workflow
- [ ] Method `getWorkflowDetail()` - Get detail with transitions
- [ ] Method `createWorkflow()` - Create new workflow
- [ ] Method `updateWorkflow()` - Update workflow (chỉ khi inactive)
- [ ] Method `activateWorkflow()` - Activate workflow (auto deactivate others)
- [ ] Method `deactivateWorkflow()` - Deactivate workflow
- [ ] Method `deleteWorkflow()` - Soft delete workflow
- [ ] Method `cloneWorkflow()` - Clone workflow với transitions

**Estimated:** 8 hours  
**Priority:** High  
**Dependencies:** T1.3, T1.4  
**Assignee:** Backend Developer

---

### Task T2.2: Tạo `WorkflowTransitionService`

**File:** `backend/app/Services/V5/Workflow/WorkflowTransitionService.php`

**Công Việc:**
- [ ] Method `getTransitionsForWorkflow()` - Get transitions filtered by workflow
- [ ] Method `addTransition()` - Add transition to workflow
- [ ] Method `updateTransition()` - Update transition
- [ ] Method `removeTransition()` - Remove transition
- [ ] Method `bulkImportFromExcel()` - Import từ Excel data
- [ ] Method `isValidTransition()` - Validate transition exists
- [ ] Method `canUserTransition()` - Check user permission theo allowed_roles
- [ ] Helper: `validateTransitionRow()` - Validate Excel row data

**Estimated:** 8 hours  
**Priority:** High  
**Dependencies:** T2.1  
**Assignee:** Backend Developer

---

### Task T2.3: Cập nhật `CustomerRequestCaseDomainService`

**File:** `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseDomainService.php`

**Công Việc:**
- [ ] Inject `WorkflowTransitionService`
- [ ] Update method `create()` - Assign active workflow_definition_id
- [ ] Update method `statusTransitions()` - Filter by workflow_definition_id
- [ ] Update method `transition()` - Validate transition theo workflow active
- [ ] Thêm logic compatibility cho requests cũ (workflow_definition_id = NULL)

**Estimated:** 6 hours  
**Priority:** High  
**Dependencies:** T2.1, T2.2  
**Assignee:** Backend Developer

---

### Task T2.4: Tạo API Controller `WorkflowDefinitionController`

**File:** `backend/app/Http/Controllers/Api/V5/WorkflowDefinitionController.php`

**Công Việc:**
- [ ] Method `index()` - GET /api/v5/workflow-definitions
- [ ] Method `show()` - GET /api/v5/workflow-definitions/{id}
- [ ] Method `store()` - POST /api/v5/workflow-definitions
- [ ] Method `update()` - PUT /api/v5/workflow-definitions/{id}
- [ ] Method `destroy()` - DELETE /api/v5/workflow-definitions/{id}
- [ ] Method `activate()` - POST /api/v5/workflow-definitions/{id}/activate
- [ ] Method `deactivate()` - POST /api/v5/workflow-definitions/{id}/deactivate
- [ ] Method `clone()` - POST /api/v5/workflow-definitions/{id}/clone
- [ ] Method `transitions()` - GET /api/v5/workflow-definitions/{id}/transitions
- [ ] Method `importTransitions()` - POST /api/v5/workflow-definitions/{id}/transitions/import
- [ ] Method `exportTransitions()` - GET /api/v5/workflow-definitions/{id}/transitions/export

**Estimated:** 6 hours  
**Priority:** High  
**Dependencies:** T2.1, T2.2  
**Assignee:** Backend Developer

---

### Task T2.5: Thêm Routes cho Workflow Management

**File:** `backend/routes/api.php`

**Công Việc:**
- [ ] Thêm route group `/api/v5/workflow-definitions`
- [ ] Config middleware: `auth:sanctum`, `permission:workflow.manage`
- [ ] Define tất cả routes cho CRUD workflows
- [ ] Define routes cho transitions management
- [ ] Test routes bằng Postman

**Estimated:** 2 hours  
**Priority:** High  
**Dependencies:** T2.4  
**Assignee:** Backend Developer

**Route Definition:**
```php
Route::middleware(['auth:sanctum', 'permission:workflow.manage'])->group(function () {
    Route::apiResource('workflow-definitions', WorkflowDefinitionController::class);
    Route::post('workflow-definitions/{id}/activate', [WorkflowDefinitionController::class, 'activate']);
    Route::post('workflow-definitions/{id}/deactivate', [WorkflowDefinitionController::class, 'deactivate']);
    Route::post('workflow-definitions/{id}/clone', [WorkflowDefinitionController::class, 'clone']);
    Route::get('workflow-definitions/{id}/transitions', [WorkflowDefinitionController::class, 'transitions']);
    Route::post('workflow-definitions/{id}/transitions/import', [WorkflowDefinitionController::class, 'importTransitions']);
    Route::get('workflow-definitions/{id}/transitions/export', [WorkflowDefinitionController::class, 'exportTransitions']);
});
```

---

### Task T2.6: Implement Excel Import/Export

**Files:**
- `backend/app/Services/V5/Workflow/WorkflowTransitionImport.php`
- `backend/app/Services/V5/Workflow/WorkflowTransitionExport.php`

**Công Việc:**
- [ ] Implement Excel import service (sử dụng Laravel Excel package)
- [ ] Implement Excel export service
- [ ] Define Excel template format
- [ ] Validate data khi import
- [ ] Handle errors và rollback khi import失败

**Estimated:** 6 hours  
**Priority:** Medium  
**Dependencies:** T2.2  
**Assignee:** Backend Developer

---

### Task T2.7: Implement Audit Logging

**File:** Integration với `AuditService` hiện có

**Công Việc:**
- [ ] Record audit event khi create/update/delete workflow
- [ ] Record audit event khi add/update/remove transition
- [ ] Record audit event khi activate/deactivate workflow
- [ ] Record audit event khi import/export transitions
- [ ] Test audit logs được ghi đúng format

**Estimated:** 3 hours  
**Priority:** High  
**Dependencies:** T2.1, T2.2  
**Assignee:** Backend Developer

---

### Task T2.8: Viết Integration Tests

**Files:**
- `backend/tests/Feature/WorkflowDefinitionApiTest.php`
- `backend/tests/Feature/WorkflowTransitionApiTest.php`
- `backend/tests/Feature/CustomerRequestWorkflowIntegrationTest.php`

**Công Việc:**
- [ ] Test CRUD workflow endpoints
- [ ] Test activate/deactivate workflow
- [ ] Test transitions management
- [ ] Test Excel import/export
- [ ] Test integration với customer request creation
- [ ] Test transition validation

**Estimated:** 8 hours  
**Priority:** High  
**Dependencies:** T2.4, T2.5  
**Assignee:** Backend Developer

---

## Phase 3: FRONTEND ADMIN UI

**Thời Lượng:** 5 ngày (Tuần 3)  
**Chủ Trì:** Frontend Developer  
**Mục Tiêu:** Xây dựng giao diện quản lý workflow cho admin

### Deliverables

- [ ] Workflow Management Hub
- [ ] Workflow Detail View
- [ ] Transition Matrix Editor
- [ ] Import/Export UI
- [ ] Form validation

### Tiêu Chí Hoàn Thành (DoD)

- [ ] UI responsive trên desktop/tablet
- [ ] Form validation hoạt động chính xác
- [ ] Integration thành công với backend APIs
- [ ] Pass accessibility checks
- [ ] Code review approved

---

### Task T3.1: Tạo Types & API Service

**Files:**
- `frontend/src/types/workflow.ts`
- `frontend/src/services/workflowApi.ts`

**Công Việc:**
- [ ] Define TypeScript interfaces: `WorkflowDefinition`, `WorkflowTransition`
- [ ] Create API service methods sử dụng `v5Api` hiện có
- [ ] Implement request/response types
- [ ] Test API calls với backend

**Estimated:** 4 hours  
**Priority:** High  
**Dependencies:** T2.4, T2.5  
**Assignee:** Frontend Developer

**Type Definition:**
```typescript
export interface WorkflowDefinition {
  id: number;
  code: string;
  name: string;
  description?: string;
  process_type: string;
  workflow_group: string;
  is_active: boolean;
  is_default: boolean;
  version: string;
  config?: WorkflowConfig;
  metadata?: Record<string, unknown>;
  created_by?: number;
  activated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTransition {
  id: number;
  workflow_definition_id: number;
  from_status_code: string;
  from_status_name_vi?: string;
  to_status_code: string;
  to_status_name_vi?: string;
  allowed_roles: string[];
  required_fields?: string[];
  is_active: boolean;
  sort_order: number;
  transition_config?: TransitionConfig;
}
```

---

### Task T3.2: Tạo `WorkflowManagementHub` Component

**File:** `frontend/src/components/workflow/WorkflowManagementHub.tsx`

**Công Việc:**
- [ ] Tạo layout chính với sidebar navigation
- [ ] Implement workflow list view với pagination
- [ ] Thêm filters: process_type, is_active, search
- [ ] Implement action buttons: Create, Activate, Deactivate, Delete, Clone
- [ ] Hiển thị status badge (Active/Inactive)
- [ ] Handle loading/error states

**Estimated:** 8 hours  
**Priority:** High  
**Dependencies:** T3.1  
**Assignee:** Frontend Developer

---

### Task T3.3: Tạo `WorkflowFormModal` Component

**File:** `frontend/src/components/workflow/WorkflowFormModal.tsx`

**Công Việc:**
- [ ] Form create/edit workflow
- [ ] Fields: code, name, description, version, workflow_group
- [ ] Validation: required fields, unique code
- [ ] Disable edit khi workflow đang active
- [ ] Handle submit và error handling
- [ ] Close modal và refresh list sau khi save

**Estimated:** 6 hours  
**Priority:** High  
**Dependencies:** T3.2  
**Assignee:** Frontend Developer

---

### Task T3.4: Tạo `WorkflowDetailView` Component

**File:** `frontend/src/components/workflow/WorkflowDetailView.tsx`

**Công Việc:**
- [ ] Hiển thị thông tin chi tiết workflow
- [ ] Hiển thị danh sách transitions trong workflow
- [ ] Transition table với columns: From, To, Roles, Required Fields, Actions
- [ ] Action buttons: Edit Workflow, Add Transition, Import, Export
- [ ] Disable actions khi workflow đang active
- [ ] Back button về list view

**Estimated:** 6 hours  
**Priority:** High  
**Dependencies:** T3.2  
**Assignee:** Frontend Developer

---

### Task T3.5: Tạo `TransitionMatrixEditor` Component

**File:** `frontend/src/components/workflow/TransitionMatrixEditor.tsx`

**Công Việc:**
- [ ] Matrix view: From Status (rows) × To Status (columns)
- [ ] Cell hiển thị allowed_roles khi có transition
- [ ] Click cell để add/edit transition
- [ ] Bulk edit mode cho multiple transitions
- [ ] Validate matrix completeness
- [ ] Visual indicators cho required fields

**Estimated:** 10 hours  
**Priority:** Medium  
**Dependencies:** T3.4  
**Assignee:** Frontend Developer

---

### Task T3.6: Tạo `TransitionFormModal` Component

**File:** `frontend/src/components/workflow/TransitionFormModal.tsx`

**Công Việc:**
- [ ] Form add/edit transition
- [ ] Fields: from_status, to_status, allowed_roles, required_fields, sort_order
- [ ] Dropdown chọn status codes từ catalog
- [ ] Multi-select cho allowed_roles (R, A, C, I, all)
- [ ] Checkbox cho required fields
- [ ] Number input cho sort_order
- [ ] Validation và error handling

**Estimated:** 6 hours  
**Priority:** High  
**Dependencies:** T3.5  
**Assignee:** Frontend Developer

---

### Task T3.7: Implement Excel Import/Export UI

**Files:**
- `frontend/src/components/workflow/WorkflowImportModal.tsx`
- `frontend/src/components/workflow/WorkflowExportModal.tsx`

**Công Việc:**
- [ ] Modal upload file Excel cho import
- [ ] Preview data trước khi import
- [ ] Hiển thị kết quả import (success/failed rows)
- [ ] Download template Excel
- [ ] Export workflow ra Excel với custom options
- [ ] Handle download file

**Estimated:** 6 hours  
**Priority:** Medium  
**Dependencies:** T3.4  
**Assignee:** Frontend Developer

---

### Task T3.8: Thêm Route & Navigation

**File:** `frontend/src/App.tsx` và navigation config

**Công Việc:**
- [ ] Thêm route `/admin/workflows`
- [ ] Thêm menu item trong Admin navigation
- [ ] Config permission guard (chỉ Admin access)
- [ ] Test navigation từ main menu
- [ ] Update breadcrumb navigation

**Estimated:** 2 hours  
**Priority:** High  
**Dependencies:** T3.2  
**Assignee:** Frontend Developer

---

### Task T3.9: Viết Unit Tests cho Components

**Files:** `frontend/src/components/workflow/__tests__/`

**Công Việc:**
- [ ] Test WorkflowManagementHub rendering
- [ ] Test WorkflowFormModal validation
- [ ] Test TransitionMatrixEditor interactions
- [ ] Test API integration trong components
- [ ] Test error handling

**Estimated:** 6 hours  
**Priority:** High  
**Dependencies:** T3.2-T3.7  
**Assignee:** Frontend Developer

---

## Phase 4: INTEGRATION & TESTING

**Thời Lượng:** 5 ngày (Tuần 4)  
**Chủ Trì:** Full-stack Developer + QA  
**Mục Tiêu:** Integration testing, E2E testing, và bug fixing

### Deliverables

- [ ] Integration hoàn chỉnh FE-BE
- [ ] E2E tests pass
- [ ] Performance tests pass
- [ ] Bug fixes
- [ ] User documentation

### Tiêu Chí Hoàn Thành (DoD)

- [ ] Tất cả E2E tests pass
- [ ] Performance đạt target
- [ ] Zero critical bugs
- [ ] Documentation hoàn chỉnh
- [ ] UAT approved

---

### Task T4.1: Integration Testing FE-BE

**Công Việc:**
- [ ] Test end-to-end workflow creation flow
- [ ] Test workflow activation/deactivation
- [ ] Test transition management
- [ ] Test Excel import/export
- [ ] Test error scenarios
- [ ] Log và track issues

**Estimated:** 8 hours  
**Priority:** High  
**Dependencies:** Phase 2, Phase 3  
**Assignee:** Full-stack Developer

---

### Task T4.2: E2E Tests với Playwright

**Files:** `frontend/e2e/workflow-management.spec.ts`

**Công Việc:**
- [ ] Test case: Create new workflow
- [ ] Test case: Activate workflow
- [ ] Test case: Add transition
- [ ] Test case: Edit transition matrix
- [ ] Test case: Import transitions from Excel
- [ ] Test case: Export workflow
- [ ] Test case: Deactivate và delete workflow

**Estimated:** 8 hours  
**Priority:** High  
**Dependencies:** T4.1  
**Assignee:** QA Engineer

---

### Task T4.3: Performance Testing

**Files:** `perf/workflow-scenarios.js`

**Công Việc:**
- [ ] Create k6 scenario cho workflow APIs
- [ ] Test get active workflow endpoint
- [ ] Test get transitions endpoint
- [ ] Test activate workflow (concurrent requests)
- [ ] Measure response times
- [ ] Optimize queries nếu cần

**Estimated:** 6 hours  
**Priority:** Medium  
**Dependencies:** T2.4  
**Assignee:** Backend Developer

---

### Task T4.4: Data Migration Testing

**Công Việc:**
- [ ] Test migration trên staging database
- [ ] Verify data integrity sau migration
- [ ] Test rollback procedure
- [ ] Test compatibility với existing requests
- [ ] Document migration steps

**Estimated:** 4 hours  
**Priority:** High  
**Dependencies:** T1.1, T1.2  
**Assignee:** Backend Developer

---

### Task T4.5: Bug Fixing

**Công Việc:**
- [ ] Fix bugs từ integration testing
- [ ] Fix bugs từ E2E testing
- [ ] Fix UI/UX issues
- [ ] Fix performance bottlenecks
- [ ] Regression testing sau fixes

**Estimated:** 8 hours  
**Priority:** High  
**Dependencies:** T4.1, T4.2  
**Assignee:** Full-stack Developer

---

### Task T4.6: User Documentation

**Files:** `docs/workflow-management-user-guide.md`

**Công Việc:**
- [ ] Write user guide cho workflow management
- [ ] Create screenshots cho UI
- [ ] Document common workflows
- [ ] Write FAQ section
- [ ] Record demo video (optional)

**Estimated:** 6 hours  
**Priority:** Medium  
**Dependencies:** Phase 3  
**Assignee:** Technical Writer

---

### Task T4.7: Training Materials

**Công Việc:**
- [ ] Create training slides
- [ ] Prepare demo data
- [ ] Schedule training sessions
- [ ] Conduct admin training
- [ ] Collect feedback

**Estimated:** 4 hours  
**Priority:** Medium  
**Dependencies:** T4.6  
**Assignee:** Project Manager

---

## Phase 5: DEPLOYMENT & TRAINING

**Thời Lượng:** 5 ngày (Tuần 5)  
**Chủ Trì:** DevOps + Project Manager  
**Mục Tiêu:** Deploy production và đào tạo người dùng

### Deliverables

- [ ] Production deployment
- [ ] User training completed
- [ ] Monitoring setup
- [ ] Support plan

### Tiêu Chí Hoàn Thành (DoD)

- [ ] Deploy thành công lên production
- [ ] Monitoring alerts configured
- [ ] User training completed
- [ ] Support process established
- [ ] Project retrospective done

---

### Task T5.1: Production Deployment Planning

**Công Việc:**
- [ ] Create deployment checklist
- [ ] Schedule deployment window
- [ ] Prepare rollback plan
- [ ] Notify stakeholders
- [ ] Backup production database

**Estimated:** 4 hours  
**Priority:** High  
**Dependencies:** Phase 4  
**Assignee:** DevOps Engineer

---

### Task T5.2: Deploy to Staging

**Công Việc:**
- [ ] Deploy code lên staging environment
- [ ] Run migrations
- [ ] Seed default workflows
- [ ] Verify all features trên staging
- [ ] Get UAT sign-off

**Estimated:** 4 hours  
**Priority:** High  
**Dependencies:** T4.5  
**Assignee:** DevOps Engineer

---

### Task T5.3: Deploy to Production

**Công Việc:**
- [ ] Execute deployment plan
- [ ] Run database migrations
- [ ] Seed default data
- [ ] Verify health checks
- [ ] Monitor logs và errors

**Estimated:** 4 hours  
**Priority:** High  
**Dependencies:** T5.2  
**Assignee:** DevOps Engineer

---

### Task T5.4: Post-Deployment Monitoring

**Công Việc:**
- [ ] Monitor application logs
- [ ] Monitor database performance
- [ ] Track error rates
- [ ] Respond to issues
- [ ] Create deployment report

**Estimated:** 4 hours  
**Priority:** High  
**Dependencies:** T5.3  
**Assignee:** DevOps Engineer

---

### Task T5.5: User Training Sessions

**Công Việc:**
- [ ] Conduct training for admins
- [ ] Hands-on practice sessions
- [ ] Q&A và troubleshooting
- [ ] Collect training feedback
- [ ] Provide training materials

**Estimated:** 8 hours  
**Priority:** High  
**Dependencies:** T4.7  
**Assignee:** Project Manager

---

### Task T5.6: Project Retrospective

**Công Việc:**
- [ ] Organize retrospective meeting
- [ ] Review what went well
- [ ] Identify improvements
- [ ] Document lessons learned
- [ ] Plan next phases

**Estimated:** 4 hours  
**Priority:** Medium  
**Dependencies:** T5.4  
**Assignee:** Project Manager

---

## 📅 TIMELINE & GANTT CHART

### Timeline Tổng Thể

```
Week 1: [██████████] Phase 1 - Database & Backend Core (Days 1-5)
Week 2: [██████████] Phase 2 - Backend API & Services (Days 6-10)
Week 3: [██████████] Phase 3 - Frontend Admin UI (Days 11-15)
Week 4: [██████████] Phase 4 - Integration & Testing (Days 16-20)
Week 5: [██████████] Phase 5 - Deployment & Training (Days 21-25)
```

### Detailed Gantt Chart

```
Task ID  | Task Name                              | Week 1 | Week 2 | Week 3 | Week 4 | Week 5
---------|----------------------------------------|--------|--------|--------|--------|--------
T1.1     | Migration workflow_definitions         | ████   |        |        |        |
T1.2     | Update workflow_transitions            |  ███   |        |        |        |
T1.3     | Model WorkflowDefinition               |  ████  |        |        |        |
T1.4     | Model WorkflowTransition               |   ███  |        |        |        |
T1.5     | Update CustomerRequestCase             |    ██  |        |        |        |
T1.6     | Database Seeder                        |     ██ |        |        |        |
T1.7     | Tests for Models                       |      █ |        |        |        |
---------|----------------------------------------|--------|--------|--------|--------|--------
T2.1     | WorkflowDefinitionService              |        | ████   |        |        |
T2.2     | WorkflowTransitionService              |        | ████   |        |        |
T2.3     | Update DomainService                   |        |  ███   |        |        |
T2.4     | WorkflowDefinitionController           |        |   ███  |        |        |
T2.5     | API Routes                             |        |    ██  |        |        |
T2.6     | Excel Import/Export                    |        |    ███ |        |        |
T2.7     | Audit Logging                          |        |     ██ |        |        |
T2.8     | Integration Tests                      |        |      ██|        |        |
---------|----------------------------------------|--------|--------|--------|--------|--------
T3.1     | Types & API Service                    |        |        | ███    |        |
T3.2     | WorkflowManagementHub                  |        |        | ████   |        |
T3.3     | WorkflowFormModal                      |        |        |  ███   |        |
T3.4     | WorkflowDetailView                     |        |        |   ███  |        |
T3.5     | TransitionMatrixEditor                 |        |        |    ████|        |
T3.6     | TransitionFormModal                    |        |        |     ███|        |
T3.7     | Import/Export UI                       |        |        |      ██|        |
T3.8     | Routes & Navigation                    |        |        |       █|        |
T3.9     | Unit Tests                             |        |        |       ██|        |
---------|----------------------------------------|--------|--------|--------|--------|--------
T4.1     | Integration Testing                    |        |        |        | ████   |
T4.2     | E2E Tests                              |        |        |        |  ████  |
T4.3     | Performance Testing                    |        |        |        |   ███  |
T4.4     | Migration Testing                      |        |        |        |    ██  |
T4.5     | Bug Fixing                             |        |        |        |     ███|
T4.6     | User Documentation                     |        |        |        |      ██|
T4.7     | Training Materials                     |        |        |        |       █|
---------|----------------------------------------|--------|--------|--------|--------|--------
T5.1     | Deployment Planning                    |        |        |        |        |  ███
T5.2     | Deploy to Staging                      |        |        |        |        |   ███
T5.3     | Deploy to Production                   |        |        |        |        |    ███
T5.4     | Post-Deployment Monitoring             |        |        |        |        |     ███
T5.5     | User Training                          |        |        |        |        |      ████
T5.6     | Project Retrospective                  |        |        |        |        |        ██
```

---

## 👥 RESOURCE PLANNING

### Team Composition

| Role | Số Lượng | Phase Tham Gia | Estimated Hours |
|------|----------|----------------|-----------------|
| **Backend Developer** | 1-2 | Phase 1, 2, 4 | 120 hours |
| **Frontend Developer** | 1 | Phase 3, 4 | 80 hours |
| **Full-stack Developer** | 1 | Phase 4 | 40 hours |
| **QA/Test Engineer** | 1 | Phase 4, 5 | 40 hours |
| **DevOps Engineer** | 0.5 | Phase 5 | 20 hours |
| **Project Manager** | 0.5 | Phase 5 | 20 hours |
| **Technical Writer** | 0.5 | Phase 4 | 12 hours |

### Total Effort Estimation

| Category | Hours | Percentage |
|----------|-------|------------|
| Backend Development | 120 | 37.5% |
| Frontend Development | 80 | 25% |
| Testing & QA | 60 | 18.75% |
| DevOps & Deployment | 20 | 6.25% |
| Documentation & Training | 32 | 10% |
| Project Management | 20 | 6.25% |
| **Total** | **332 hours** | **100%** |

---

## ⚠️ RISK MANAGEMENT

### Risk Matrix

| Risk | Impact | Probability | Score | Mitigation Strategy |
|------|--------|-------------|-------|---------------------|
| **Data migration loss** | High (5) | Low (2) | 10 | Backup trước migration, test rollback procedure, phased rollout |
| **Breaking existing transitions** | High (5) | Medium (3) | 15 | Compatibility layer, feature flag, gradual rollout, thorough testing |
| **UI/UX confusion** | Medium (3) | Medium (3) | 9 | Clear warnings, user training, documentation, intuitive design |
| **Performance degradation** | Medium (3) | Low (2) | 6 | Proper indexing, query optimization, performance testing |
| **Scope creep** | Medium (3) | Medium (3) | 9 | Strict scope control, phase future enhancements to Phase 5 |
| **Resource unavailability** | Medium (3) | Low (2) | 6 | Cross-training, documentation, buffer time in schedule |
| **Integration issues** | High (5) | Medium (3) | 15 | Early integration testing, daily builds, continuous integration |

### Risk Mitigation Plans

#### Risk 1: Data Migration Loss

**Prevention:**
- Full database backup trước migration
- Test migration trên staging environment
- Write reversible migrations với proper `down()` methods
- Dry run migration trên production copy

**Contingency:**
- Rollback plan sẵn sàng
- Database restore procedure documented
- Emergency contact list prepared

#### Risk 2: Breaking Existing Transitions

**Prevention:**
- Compatibility layer cho requests cũ (workflow_definition_id = NULL)
- Feature flag để enable/disable multi-workflow
- Gradual rollout: 10% → 50% → 100% users
- Comprehensive integration tests

**Contingency:**
- Quick rollback mechanism
- Hotfix ready cho critical issues
- Support team on standby during rollout

---

## 📦 DELIVERABLES TỔNG THỂ

### Phase 1 Deliverables

- [x] Migration script: `workflow_definitions` table
- [x] Migration script: Update `workflow_transitions` table
- [x] Model: `WorkflowDefinition.php`
- [x] Model: `WorkflowTransition.php`
- [x] Model: Updated `CustomerRequestCase.php`
- [x] Seeder: `WorkflowDefinitionSeeder.php`
- [x] Unit tests cho models

### Phase 2 Deliverables

- [x] Service: `WorkflowDefinitionService.php`
- [x] Service: `WorkflowTransitionService.php`
- [x] Updated: `CustomerRequestCaseDomainService.php`
- [x] Controller: `WorkflowDefinitionController.php`
- [x] Routes: API endpoints cho workflow management
- [x] Excel import/export service
- [x] Audit logging integration
- [x] Integration tests

### Phase 3 Deliverables

- [x] Types: TypeScript interfaces
- [x] API Service: `workflowApi.ts`
- [x] Component: `WorkflowManagementHub.tsx`
- [x] Component: `WorkflowFormModal.tsx`
- [x] Component: `WorkflowDetailView.tsx`
- [x] Component: `TransitionMatrixEditor.tsx`
- [x] Component: `TransitionFormModal.tsx`
- [x] Component: Import/Export modals
- [x] Routes: Frontend navigation
- [x] Unit tests cho components

### Phase 4 Deliverables

- [x] Integration test report
- [x] E2E test suite (Playwright)
- [x] Performance test report (k6)
- [x] Migration test report
- [x] Bug fix log
- [x] User documentation
- [x] Training materials

### Phase 5 Deliverables

- [x] Deployment checklist
- [x] Staging deployment report
- [x] Production deployment report
- [x] Monitoring dashboard
- [x] Training session recordings
- [x] Project retrospective report

---

## ✅ DEFINITION OF DONE (DoD)

### DoD cho Backend Tasks

- [ ] Code follows Laravel 12 conventions
- [ ] All methods have PHPDoc comments
- [ ] Unit tests written và pass (>80% coverage)
- [ ] Integration tests written và pass
- [ ] Audit logging implemented
- [ ] Error handling proper (try-catch, validation)
- [ ] Performance optimized (indexes, query optimization)
- [ ] Code review approved
- [ ] API documentation updated

### DoD cho Frontend Tasks

- [ ] Component follows React 19 patterns
- [ ] TypeScript types defined
- [ ] Responsive design (desktop/tablet)
- [ ] Form validation implemented
- [ ] Error handling proper
- [ ] Loading states handled
- [ ] Accessibility checks pass
- [ ] Unit tests written và pass
- [ ] Code review approved

### DoD cho Phase Completion

- [ ] All tasks completed
- [ ] All tests pass (unit, integration, E2E)
- [ ] Performance targets met
- [ ] Documentation updated
- [ ] Stakeholder approval
- [ ] Retrospective conducted

### DoD cho Project Completion

- [ ] All 5 phases completed
- [ ] Production deployment successful
- [ ] User training completed
- [ ] Monitoring active
- [ ] Support plan in place
- [ ] Project sign-off from stakeholders

---

## 📊 SUCCESS METRICS

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time (get active workflow) | < 5ms | k6 performance tests |
| API Response Time (get transitions) | < 10ms | k6 performance tests |
| Unit Test Coverage | > 80% | PHPUnit, Vitest reports |
| E2E Test Pass Rate | 100% | Playwright reports |
| Zero Critical Bugs in Production | Yes | Bug tracking system |
| Deployment Success Rate | 100% | Deployment logs |

### Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| User Adoption Rate | > 90% in 2 weeks | Usage analytics |
| User Satisfaction Score | > 4.5/5 | Post-training survey |
| Support Tickets (Week 1) | < 5 tickets | Support system |
| Workflow Configuration Time | < 5 minutes per workflow | Time tracking |
| System Downtime | 0 minutes | Monitoring logs |

---

## 🔄 CHANGE MANAGEMENT

### Change Request Process

1. **Submit Change Request** → Document in change log
2. **Impact Analysis** → Assess impact on timeline, resources, scope
3. **Stakeholder Approval** → Get approval from project sponsor
4. **Update Plan** → Revise plan document
5. **Communicate** → Notify all team members
6. **Implement** → Execute change
7. **Verify** → Validate change implemented correctly

### Change Log

| Date | Change Request | Impact | Status |
|------|----------------|--------|--------|
| YYYY-MM-DD | [Description] | [Timeline/Resources/Scope] | [Pending/Approved/Rejected] |

---

## 📚 APPENDICES

### Appendix A: API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v5/workflow-definitions` | List workflows | ✅ |
| GET | `/api/v5/workflow-definitions/{id}` | Get workflow detail | ✅ |
| POST | `/api/v5/workflow-definitions` | Create workflow | ✅ |
| PUT | `/api/v5/workflow-definitions/{id}` | Update workflow | ✅ |
| DELETE | `/api/v5/workflow-definitions/{id}` | Delete workflow | ✅ |
| POST | `/api/v5/workflow-definitions/{id}/activate` | Activate workflow | ✅ |
| POST | `/api/v5/workflow-definitions/{id}/deactivate` | Deactivate workflow | ✅ |
| POST | `/api/v5/workflow-definitions/{id}/clone` | Clone workflow | ✅ |
| GET | `/api/v5/workflow-definitions/{id}/transitions` | Get transitions | ✅ |
| POST | `/api/v5/workflow-definitions/{id}/transitions/import` | Import from Excel | ✅ |
| GET | `/api/v5/workflow-definitions/{id}/transitions/export` | Export to Excel | ✅ |

### Appendix B: Database Schema Diagram

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  workflow_definitions   │         │   internal_users        │
├─────────────────────────┤         ├─────────────────────────┤
│ PK id                   │         │ PK id                   │
│    code                 │         │    full_name            │
│    name                 │         │    email                │
│    process_type         │         │    user_code            │
│    is_active            │         └─────────────────────────┘
│    version              │                    ▲
│    config (JSON)        │                    │
│    created_by (FK) ─────┼────────────────────┤
│    activated_by (FK) ───┼────────────────────┤
└─────────────────────────┘                    │
              │                                │
              │ 1                              │
              │                                │
              │ N                              │
              ▼                                │
┌─────────────────────────┐                    │
│  workflow_transitions   │                    │
├─────────────────────────┤                    │
│ PK id                   │                    │
│    workflow_definition_ │(FK)────────────────┤
│    from_status_code     │                    │
│    to_status_code       │                    │
│    allowed_roles (JSON) │                    │
│    required_fields      │                    │
│    is_active            │                    │
└─────────────────────────┘                    │
                                               │
              ┌────────────────────────────────┘
              │
              ▼
┌─────────────────────────┐
│ customer_request_cases  │
├─────────────────────────┤
│ PK id                   │
│    workflow_definition_ │(FK)
│    request_code         │
│    current_status_code  │
│    performer_user_id    │
└─────────────────────────┘
```

### Appendix C: Excel Template Format

**File Name:** `workflow_transitions_template.xlsx`

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| `from_status_code` | ✅ | Mã trạng thái nguồn | `new_intake` |
| `from_status_name_vi` | ❌ | Tên trạng thái nguồn (Tiếng Việt) | `Tiếp nhận` |
| `to_status_code` | ✅ | Mã trạng thái đích | `assigned_to_receiver` |
| `to_status_name_vi` | ❌ | Tên trạng thái đích (Tiếng Việt) | `Giao R thực hiện` |
| `allowed_roles` | ✅ | Roles được phép (JSON array) | `["R","A"]` |
| `required_fields` | ❌ | Fields bắt buộc (JSON array) | `["performer_user_id"]` |
| `is_auto_transition` | ❌ | Có phải auto transition? | `false` |
| `sort_order` | ❌ | Thứ tự hiển thị | `10` |
| `is_active` | ❌ | Trạng thái active | `true` |
| `transition_config` | ❌ | Config (JSON) | `{...}` |
| `description` | ❌ | Mô tả | `Giao việc cho R` |

### Appendix D: Permission Matrix

| Permission | Description | Default Role |
|------------|-------------|--------------|
| `workflow.view` | Xem danh sách workflows | Admin, Manager |
| `workflow.create` | Tạo workflow mới | Admin |
| `workflow.edit` | Chỉnh sửa workflow (khi inactive) | Admin |
| `workflow.activate` | Kích hoạt workflow | Admin |
| `workflow.deactivate` | Vô hiệu hóa workflow | Admin |
| `workflow.delete` | Xóa workflow | Admin |
| `workflow.clone` | Nhân bản workflow | Admin |
| `workflow.transitions.view` | Xem transitions | Admin, Manager |
| `workflow.transitions.edit` | Chỉnh sửa transitions | Admin |
| `workflow.transitions.import` | Import từ Excel | Admin |
| `workflow.transitions.export` | Export ra Excel | Admin, Manager |

---

## 📝 NOTES & ASSUMPTIONS

### Assumptions

1. **Team Availability:** Resources được cam kết full-time trong 5 tuần
2. **Environment:** Staging environment available cho testing
3. **Data:** Production data available (anonymized) cho migration testing
4. **Stakeholders:** Key stakeholders available cho UAT và training
5. **Infrastructure:** Server capacity đủ cho performance requirements

### Notes

1. **Buffer Time:** Đã include 20% buffer trong estimates cho unexpected issues
2. **Parallel Work:** Một số tasks có thể chạy song song để reduce timeline
3. **Phased Rollout:** Recommend phased rollout để minimize risk
4. **Future Enhancements:** Phase 5 có thể mở rộng cho các process types khác

---

## 🔗 REFERENCES

### Related Documents

- `CAU_HINH_DONG_LUONG_YC.md` - Chi tiết kiến trúc multi-workflow
- `QUY_TRINH_TAO_VA_CHUYEN_YC.md` - Quy trình tạo và chuyển yêu cầu
- `customer-request-workflow-v2-phased-plan.md` - Workflow V2 phased plan
- `QWEN.md` - Project overview và conventions

### External Resources

- Laravel 12 Documentation: https://laravel.com/docs/12.x
- React 19 Documentation: https://react.dev
- Playwright Documentation: https://playwright.dev
- k6 Documentation: https://k6.io/docs

---

**Tài liệu này được tạo ngày 2026-03-28 và sẽ được cập nhật trong suốt quá trình thực hiện dự án.**

**Người Phê Duyệt:** ___________________  **Ngày:** _______________

**Project Manager:** ___________________  **Ngày:** _______________

**Tech Lead:** ___________________  **Ngày:** _______________
