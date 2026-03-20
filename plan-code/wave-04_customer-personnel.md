# Wave 04 — CustomerPersonnel

## Mục tiêu

- cutover toàn bộ routes `CustomerPersonnel` khỏi `V5MasterDataController`
- giữ nguyên alias routes hiện có
- khóa lại behavior CRUD bằng test runtime riêng

## Phạm vi thực hiện

- move public methods:
  - `customerPersonnel`
  - `storeCustomerPersonnel`
  - `updateCustomerPersonnel`
  - `deleteCustomerPersonnel`

- file đích:
  - `app/Http/Controllers/Api/V5/CustomerPersonnelController.php`
  - `app/Services/V5/Domain/CustomerPersonnelDomainService.php`

## File bị touch

- `backend/app/Http/Controllers/Api/V5/CustomerPersonnelController.php`
- `backend/app/Services/V5/Domain/CustomerPersonnelDomainService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`
- `backend/tests/Feature/CustomerPersonnelCrudTest.php`

## PRE_REF gợi ý cho rollback

```bash
PRE_REF=v5mdc-wave-04-pre
```

## Verify tối thiểu

- `php artisan test --filter=V5DomainRouteBindingTest`
- `php artisan test --filter=CustomerPersonnelCrudTest`
- alias routes `customer_personnel`, `cus-personnel`, `cus_personnel` vẫn trỏ handler mới
