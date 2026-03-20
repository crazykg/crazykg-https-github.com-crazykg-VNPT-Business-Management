# Wave 01 — Vendor + Business + System

## Mục tiêu

- hoàn tất cutover phần còn thiếu của Wave 01 theo `Nang_cap_kien_truc_he_thong_v1.md`
- giữ nguyên behavior public APIs
- chưa xóa methods gốc trong `V5MasterDataController.php`

## Phạm vi thực hiện

### Đã cutover sẵn từ trước

- Vendor
  - route đã trỏ `App\Http\Controllers\Api\V5\VendorController`
  - service đã tách `App\Services\V5\Domain\VendorDomainService`

### Thực hiện trong wave này

- Business
  - move public methods:
    - `businesses`
    - `storeBusiness`
    - `updateBusiness`
    - `deleteBusiness`
  - file đích:
    - `app/Http/Controllers/Api/V5/BusinessController.php`
    - `app/Services/V5/Domain/BusinessDomainService.php`

- System
  - move public methods:
    - `tableHealth`
  - file đích:
    - `app/Http/Controllers/Api/V5/SystemHealthController.php`
    - `app/Services/V5/Domain/SystemHealthService.php`

## Private/helper dependencies

- `V5DomainSupportService`
  - `hasTable`
  - `hasColumn`
  - `missingTable`
  - `selectColumns`
  - `readFilterParam`
  - `shouldPaginate`
  - `shouldUseSimplePagination`
  - `resolvePaginationParams`
  - `buildPaginationMeta`
  - `buildSimplePaginationMeta`
  - `filterPayloadByTableColumns`
  - `resolveEmployeeTable`

- `V5AccessAuditService`
  - `resolveAuthenticatedUserId`

## File bị touch

- `backend/app/Http/Controllers/Api/V5/BusinessController.php`
- `backend/app/Http/Controllers/Api/V5/SystemHealthController.php`
- `backend/app/Services/V5/Domain/BusinessDomainService.php`
- `backend/app/Services/V5/Domain/SystemHealthService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`

## PRE_REF gợi ý cho rollback

```bash
PRE_REF=v5mdc-wave-01-pre
```

## Rollback scope

```bash
git restore --source="$PRE_REF" backend/routes/api.php
git restore --source="$PRE_REF" backend/tests/Feature/V5DomainRouteBindingTest.php
git restore --source="$PRE_REF" backend/app/Http/Controllers/Api/V5/BusinessController.php
git restore --source="$PRE_REF" backend/app/Http/Controllers/Api/V5/SystemHealthController.php
git restore --source="$PRE_REF" backend/app/Services/V5/Domain/BusinessDomainService.php
git restore --source="$PRE_REF" backend/app/Services/V5/Domain/SystemHealthService.php
php artisan route:clear
php artisan config:clear
php artisan cache:clear
php artisan test --filter=V5DomainRouteBindingTest
```

## Verify tối thiểu

- `php artisan test --filter=V5DomainRouteBindingTest`
- route `/api/v5/businesses` trỏ controller mới
- route `/api/v5/health/tables` trỏ controller mới
- middleware permissions không drift
