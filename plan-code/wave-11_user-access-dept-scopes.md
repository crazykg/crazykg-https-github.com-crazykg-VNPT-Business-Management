# Wave 11 — UserAccess dept-scope cutover

## Scope

- Cat `PUT /user-access/{id}/dept-scopes`
- Hoan tat cutover route/controller cho toan bo UserAccess

## Files

- `backend/app/Http/Controllers/Api/V5/UserAccessController.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`

## Verification

- `php artisan route:list --path=api/v5/user-access`
- `php artisan test --filter='UserAccessCrudTest|V5DomainRouteBindingTest'`
- `php artisan test`
