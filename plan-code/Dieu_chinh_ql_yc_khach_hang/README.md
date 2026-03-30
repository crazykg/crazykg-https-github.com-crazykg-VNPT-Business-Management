# Điều Chỉnh Quản Lý Yêu Cầu Khách Hàng - Plan Index

**Cập nhật cuối:** 2026-03-28
**Trạng thái:** Approved for Implementation

---

## 📚 TÀI LIỆU TRONG THƯ MỤC NÀY

| File | Mục Đích | Status |
|------|----------|--------|
| **CAU_HINH_DONG_LUONG_YC.md** | Tài liệu chi tiết về cấu hình động multi-workflow (2,500+ lines) | ✅ Complete |
| **QUY_TRINH_TAO_VA_CHUYEN_YC.md** | Quy trình tạo và chuyển yêu cầu (Version 1.1) | ✅ Updated |
| **KE_HOACH_DONG_BO_CRC_VOI_WORKFLOW_DONG.md** | Kế hoạch đồng bộ frontend CRC với workflow động backend | 📝 Draft |
| **luong_xu_ly_QL_YC_khach_hang.md** | Luồng xử lý QL yêu cầu khách hàng (Reference) | 📖 Reference |
| **BAO_CAO_CAP_NHAT_PLAN.md** | Báo cáo tổng kết cập nhật plan | ✅ Complete |
| **2026_03_28_000001_create_workflow_definitions_table.php** | Migration script sample | ✅ Sample |
| **WorkflowDefinitionSeeder.php** | Seeder sample cho default workflow | ✅ Sample |
| **workflowa.xlsx** | Excel data cho transitions (Reference) | 📖 Reference |
| **README.md** | File này - Index và quick reference | ✅ Complete |

---

## 🎯 MỤC TIÊU CHÍNH

### Multi-Workflow Support

Hệ thống hiện tại chỉ hỗ trợ **một luồng workflow cố định**. Cập nhật này thêm:

- ✅ **Định nghĩa nhiều workflow** cho cùng một process type
- ✅ **Kích hoạt/vô hiệu hóa** workflow từ Admin UI
- ✅ **Chỉ 1 workflow active** tại một thời điểm
- ✅ **Chuyển đổi mượt mà** giữa các phiên bản workflow
- ✅ **Import/export** ma trận transitions từ Excel

### Đồng bộ CRC với Workflow Động

Sau khi đã có workflow-management ở backend/admin, cần thêm bước đồng bộ frontend CRC để:

- ✅ Hiển thị transition theo `allowed_next_processes` từ backend
- ✅ Giảm hardcode status/role trong workspace CRC
- ✅ Chuẩn hóa status metadata và action visibility
- ✅ Giảm rủi ro lệch UI khi admin thay đổi workflow

Tài liệu chi tiết: `KE_HOACH_DONG_BO_CRC_VOI_WORKFLOW_DONG.md`

---

## 📊 DATABASE SCHEMA OVERVIEW

### workflow_definitions

```
┌─────────────────────────────────────────────────────────────┐
│ workflow_definitions                                        │
├─────────────────────────────────────────────────────────────┤
│ id (PK)          BIGINT                                     │
│ code             VARCHAR(50)  -- LUONG_A, LUONG_B           │
│ name             VARCHAR(255) -- Luồng xử lý A              │
│ process_type     VARCHAR(50)  -- customer_request           │
│ is_active        BOOLEAN      -- Chỉ 1 active               │
│ version          VARCHAR(20)  -- 1.0, 1.1, 2.0              │
│ config           JSON         -- Notification, SLA          │
│ activated_at     TIMESTAMP                                  │
│ deleted_at       TIMESTAMP                                  │
└─────────────────────────────────────────────────────────────┘
```

### workflow_transitions (Updated)

```
┌─────────────────────────────────────────────────────────────┐
│ workflow_transitions                                        │
├─────────────────────────────────────────────────────────────┤
│ id (PK)               BIGINT                                │
│ workflow_definition_id BIGINT (FK) -- NEW                   │
│ from_status_code      VARCHAR(80)                           │
│ to_status_code        VARCHAR(80)                           │
│ allowed_roles         JSON                                  │
│ required_fields       JSON                                  │
│ transition_config     JSON                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 KEY COMPONENTS

### Backend

| Component | File Path (Reference) |
|-----------|----------------------|
| **Models** | |
| WorkflowDefinition | `backend/app/Models/WorkflowDefinition.php` |
| WorkflowTransition | `backend/app/Models/WorkflowTransition.php` |
| **Services** | |
| WorkflowDefinitionService | `backend/app/Services/V5/Workflow/WorkflowDefinitionService.php` |
| WorkflowTransitionService | `backend/app/Services/V5/Workflow/WorkflowTransitionService.php` |
| **Controllers** | |
| WorkflowDefinitionController | `backend/app/Http/Controllers/V5/WorkflowDefinitionController.php` |
| WorkflowTransitionController | `backend/app/Http/Controllers/V5/WorkflowTransitionController.php` |

### Frontend

| Component | File Path (Reference) |
|-----------|----------------------|
| **Components** | |
| WorkflowManagementHub | `frontend/src/modules/workflow/components/WorkflowManagementHub.tsx` |
| WorkflowDefinitionModal | `frontend/src/modules/workflow/components/WorkflowDefinitionModal.tsx` |
| WorkflowTransitionMatrix | `frontend/src/modules/workflow/components/WorkflowTransitionMatrix.tsx` |
| **Store** | |
| workflowStore | `frontend/src/modules/workflow/stores/workflowStore.ts` |

---

## 🌐 API ENDPOINTS

### Workflow Definitions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v5/workflow-definitions` | List workflows |
| GET | `/api/v5/workflow-definitions/{id}` | Get detail |
| POST | `/api/v5/workflow-definitions` | Create |
| PUT | `/api/v5/workflow-definitions/{id}` | Update |
| DELETE | `/api/v5/workflow-definitions/{id}` | Delete |
| POST | `/api/v5/workflow-definitions/{id}/activate` | Activate |
| POST | `/api/v5/workflow-definitions/{id}/deactivate` | Deactivate |

### Workflow Transitions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v5/workflow-definitions/{id}/transitions` | Get transitions |
| POST | `/api/v5/workflow-definitions/{id}/transitions` | Add transition |
| PUT | `/api/v5/workflow-transitions/{id}` | Update transition |
| DELETE | `/api/v5/workflow-transitions/{id}` | Delete transition |
| POST | `/api/v5/workflow-definitions/{id}/transitions/bulk-import` | Bulk import |

---

## 📦 MIGRATION STEPS

### 1. Run Migration

```bash
php artisan migrate
```

### 2. Seed Default Data

```bash
php artisan db:seed --class=WorkflowDefinitionSeeder
```

### 3. Verify

```bash
php artisan tinker
>>> App\Models\WorkflowDefinition::count()
>>> App\Models\WorkflowTransition::where('workflow_definition_id', 1)->count()
```

---

## 🔐 PERMISSIONS

| Permission | Description | Required Role |
|------------|-------------|---------------|
| `workflow.view` | Xem workflows | All authenticated |
| `workflow.create` | Tạo workflow | Admin, Manager |
| `workflow.update` | Chỉnh sửa workflow | Admin, Manager |
| `workflow.activate` | Kích hoạt workflow | **Admin only** |
| `workflow.deactivate` | Vô hiệu hóa workflow | **Admin only** |
| `workflow.delete` | Xóa workflow | Admin only |
| `workflow.transition.manage` | Quản lý transitions | Admin, Manager |
| `workflow.transition.import` | Import từ Excel | **Admin only** |

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Database & Backend

- [ ] Create migration file
- [ ] Run migration on dev database
- [ ] Create WorkflowDefinition model
- [ ] Create WorkflowTransition model
- [ ] Implement WorkflowDefinitionService
- [ ] Implement WorkflowTransitionService
- [ ] Create WorkflowDefinitionController
- [ ] Create WorkflowTransitionController
- [ ] Add route definitions
- [ ] Create seeder
- [ ] Write unit tests

### Phase 2: Frontend

- [ ] Create workflowStore (Zustand)
- [ ] Create WorkflowManagementHub component
- [ ] Create WorkflowDefinitionModal component
- [ ] Create WorkflowTransitionMatrix component
- [ ] Create WorkflowListView component
- [ ] Create WorkflowDetailView component
- [ ] Add navigation menu item
- [ ] Write E2E tests

### Phase 3: Testing & Deployment

- [ ] Deploy to staging
- [ ] UAT with admin users
- [ ] Fix bugs from UAT
- [ ] Performance testing (k6)
- [ ] Deploy to production
- [ ] Monitor & support

---

## 📖 QUICK REFERENCE

### Get Active Workflow

```php
$activeWorkflow = WorkflowDefinition::query()
    ->processType('customer_request')
    ->active()
    ->first();
```

### Get Transitions for Workflow

```php
$transitions = WorkflowTransition::query()
    ->forWorkflow($workflowId)
    ->fromStatus($statusCode)
    ->active()
    ->get();
```

### Activate Workflow (Transaction-Safe)

```php
DB::transaction(function () use ($workflowId) {
    // Deactivate all others
    WorkflowDefinition::where('process_type', 'customer_request')
        ->where('id', '!=', $workflowId)
        ->update(['is_active' => false]);
    
    // Activate selected
    WorkflowDefinition::find($workflowId)->update(['is_active' => true]);
});
```

---

## 🚨 IMPORTANT NOTES

### ⚠️ Cannot Edit Active Workflow

- Không thể chỉnh sửa workflow đang active
- Phải deactivate trước khi edit
- Không thể xóa workflow đang active

### ⚠️ Only 1 Active Workflow

- Chỉ 1 workflow active per process_type
- Activate workflow mới sẽ tự động deactivate workflow cũ
- Database constraint đảm bảo tính nhất quán

### ⚠️ Transition Validation

- Transitions được filter theo `workflow_definition_id`
- Validate transition tồn tại trước khi execute
- Check user permission theo `allowed_roles`

---

## 📞 SUPPORT

### Documentation

- **Main Guide:** `CAU_HINH_DONG_LUONG_YC.md`
- **Process Flow:** `QUY_TRINH_TAO_VA_CHUYEN_YC.md`
- **Report:** `BAO_CAO_CAP_NHAT_PLAN.md`

### Code Samples

- **Migration:** `2026_03_28_000001_create_workflow_definitions_table.php`
- **Seeder:** `WorkflowDefinitionSeeder.php`

---

## 📈 NEXT STEPS

1. **Review plan** với team
2. **Estimate effort** chi tiết
3. **Create tasks** trong project management
4. **Assign resources**
5. **Begin implementation**

---

**END OF README**
