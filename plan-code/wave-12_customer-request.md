# Wave 12 — CustomerRequest

## Scope

- Tao `CustomerRequestController` + `CustomerRequestDomainService`
- Cat toan bo route `customer-requests` canonical va alias
- Chuyen test truc tiep khoi `V5MasterDataController`

## Files

- `backend/app/Http/Controllers/Api/V5/CustomerRequestController.php`
- `backend/app/Services/V5/Domain/CustomerRequestDomainService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`
- `backend/tests/Feature/CustomerRequestIntakeStageValidationTest.php`

## Verification

- `php artisan route:list --path=api/v5/customer-requests`
- `php artisan route:list --path=api/v5/customer_requests`
- `php artisan test --filter='CustomerRequest|V5DomainRouteBindingTest'`
