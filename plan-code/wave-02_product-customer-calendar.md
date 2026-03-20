# Wave 02 — Product + Customer + Calendar

## Mục tiêu

- hoàn tất phần còn thiếu của Wave 02 theo `Nang_cap_kien_truc_he_thong_v1.md`
- giữ nguyên contract cho routes public
- không xóa methods gốc trong `V5MasterDataController.php`

## Trạng thái hiện tại

### Đã cutover sẵn từ trước

- Customer
  - route đã trỏ `App\Http\Controllers\Api\V5\CustomerController`
  - service đã tách `App\Services\V5\Domain\CustomerDomainService`

### Thực hiện trong wave này

- Product
  - move public methods:
    - `products`
    - `storeProduct`
    - `updateProduct`
    - `deleteProduct`
  - file đích:
    - `app/Http/Controllers/Api/V5/ProductController.php`
    - `app/Services/V5/Domain/ProductDomainService.php`

- Calendar
  - move public methods:
    - `monthlyCalendars`
    - `updateCalendarDay`
    - `generateCalendarYear`
  - file đích:
    - `app/Http/Controllers/Api/V5/MonthlyCalendarController.php`
    - `app/Services/V5/Domain/MonthlyCalendarDomainService.php`

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
  - `parseNullableInt`
  - `normalizeNullableString`

## File bị touch

- `backend/app/Http/Controllers/Api/V5/ProductController.php`
- `backend/app/Http/Controllers/Api/V5/MonthlyCalendarController.php`
- `backend/app/Services/V5/Domain/ProductDomainService.php`
- `backend/app/Services/V5/Domain/MonthlyCalendarDomainService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`

## PRE_REF gợi ý cho rollback

```bash
PRE_REF=v5mdc-wave-02-pre
```

## Rollback scope

```bash
git restore --source="$PRE_REF" backend/routes/api.php
git restore --source="$PRE_REF" backend/tests/Feature/V5DomainRouteBindingTest.php
git restore --source="$PRE_REF" backend/app/Http/Controllers/Api/V5/ProductController.php
git restore --source="$PRE_REF" backend/app/Http/Controllers/Api/V5/MonthlyCalendarController.php
git restore --source="$PRE_REF" backend/app/Services/V5/Domain/ProductDomainService.php
git restore --source="$PRE_REF" backend/app/Services/V5/Domain/MonthlyCalendarDomainService.php
php artisan route:clear
php artisan config:clear
php artisan cache:clear
php artisan test --filter=V5DomainRouteBindingTest
```

## Verify tối thiểu

- `php artisan test --filter=V5DomainRouteBindingTest`
- routes `/api/v5/products*` trỏ controller mới
- routes `/api/v5/monthly-calendars*` trỏ controller mới
- middleware permissions không drift
