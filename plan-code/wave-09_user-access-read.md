# Wave 09 — UserAccess read endpoints

## Scope

- Tao `UserAccessController`
- Cat read routes `roles`, `permissions`, `user-access`
- Giu nguyen write routes trong `V5MasterDataController`

## Files

- `backend/app/Http/Controllers/Api/V5/UserAccessController.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`

## Verification

- `php artisan route:list --path=api/v5/roles`
- `php artisan route:list --path=api/v5/permissions`
- `php artisan route:list --path=api/v5/user-access`
- `php artisan test --filter='UserAccessCrudTest|V5DomainRouteBindingTest'`
