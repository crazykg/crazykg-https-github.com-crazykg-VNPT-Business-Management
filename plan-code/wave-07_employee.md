# Wave 07 — Employee

## Scope

- Cutover `internal-users` va alias `employees`
- Tach cac hanh vi:
  - list
  - create
  - bulk create
  - update
  - delete
  - reset password

## Files du kien cham

- `backend/app/Http/Controllers/Api/V5/EmployeeController.php`
- `backend/app/Services/V5/Domain/EmployeeDomainService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`
- `backend/tests/Feature/EmployeeCrudTest.php`

## Route muc tieu

- `GET /api/v5/internal-users`
- `POST /api/v5/internal-users`
- `POST /api/v5/internal-users/bulk`
- `POST /api/v5/internal-users/{id}/reset-password`
- `PUT /api/v5/internal-users/{id}`
- `DELETE /api/v5/internal-users/{id}`
- alias `/api/v5/employees...`

## Verify

- `php artisan route:list --path=api/v5/internal-users`
- `php artisan route:list --path=api/v5/employees`
- `php artisan test --filter='V5DomainRouteBindingTest|EmployeeCrudTest'`
