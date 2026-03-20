# Wave 03 — AuditLog + Workflow + SupportConfig-Positions

## Mục tiêu

- cutover Wave 03 theo `Nang_cap_kien_truc_he_thong_v1.md`
- chuẩn hóa controller/service cho các route config hỗ trợ
- giữ nguyên canonical routes và legacy alias routes
- chưa xóa methods gốc trong `V5MasterDataController.php`

## Phạm vi thực hiện

- AuditLog
  - move public methods:
    - `auditLogs`
  - file đích:
    - `app/Http/Controllers/Api/V5/AuditLogController.php`
    - `app/Services/V5/Domain/AuditLogDomainService.php`

- SupportConfig-Positions
  - move public methods:
    - `supportContactPositions`
    - `storeSupportContactPosition`
    - `storeSupportContactPositionsBulk`
    - `updateSupportContactPosition`
  - file đích:
    - `app/Http/Controllers/Api/V5/SupportContactPositionController.php`
    - `app/Services/V5/Domain/SupportContactPositionDomainService.php`

- Workflow
  - move public methods:
    - `workflowStatusCatalogs`
    - `storeWorkflowStatusCatalog`
    - `updateWorkflowStatusCatalog`
    - `workflowStatusTransitions`
    - `storeWorkflowStatusTransition`
    - `updateWorkflowStatusTransition`
    - `workflowFormFieldConfigs`
    - `storeWorkflowFormFieldConfig`
    - `updateWorkflowFormFieldConfig`
  - file đích:
    - `app/Http/Controllers/Api/V5/WorkflowConfigController.php`
    - `app/Services/V5/Domain/WorkflowConfigDomainService.php`

## File bị touch

- `backend/app/Http/Controllers/Api/V5/AuditLogController.php`
- `backend/app/Http/Controllers/Api/V5/SupportContactPositionController.php`
- `backend/app/Http/Controllers/Api/V5/WorkflowConfigController.php`
- `backend/app/Services/V5/Domain/AuditLogDomainService.php`
- `backend/app/Services/V5/Domain/SupportContactPositionDomainService.php`
- `backend/app/Services/V5/Domain/WorkflowConfigDomainService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`
- `backend/tests/Feature/SupportContactPositionCrudTest.php`
- `backend/tests/Feature/WorkflowConfigCrudTest.php`

## PRE_REF gợi ý cho rollback

```bash
PRE_REF=v5mdc-wave-03-pre
```

## Rollback scope

```bash
git restore --source="$PRE_REF" backend/routes/api.php
git restore --source="$PRE_REF" backend/tests/Feature/V5DomainRouteBindingTest.php
git restore --source="$PRE_REF" backend/tests/Feature/SupportContactPositionCrudTest.php
git restore --source="$PRE_REF" backend/tests/Feature/WorkflowConfigCrudTest.php
git restore --source="$PRE_REF" backend/app/Http/Controllers/Api/V5/AuditLogController.php
git restore --source="$PRE_REF" backend/app/Http/Controllers/Api/V5/SupportContactPositionController.php
git restore --source="$PRE_REF" backend/app/Http/Controllers/Api/V5/WorkflowConfigController.php
git restore --source="$PRE_REF" backend/app/Services/V5/Domain/AuditLogDomainService.php
git restore --source="$PRE_REF" backend/app/Services/V5/Domain/SupportContactPositionDomainService.php
git restore --source="$PRE_REF" backend/app/Services/V5/Domain/WorkflowConfigDomainService.php
php artisan route:clear
php artisan config:clear
php artisan cache:clear
php artisan test --filter=V5DomainRouteBindingTest
```

## Verify tối thiểu

- `php artisan test --filter=V5DomainRouteBindingTest`
- `php artisan test --filter=SupportContactPositionCrudTest`
- `php artisan test --filter=WorkflowConfigCrudTest`
- alias routes `/audit_logs`, `/support_contact_positions`, `/workflow_status_*` vẫn trỏ đúng controller mới
