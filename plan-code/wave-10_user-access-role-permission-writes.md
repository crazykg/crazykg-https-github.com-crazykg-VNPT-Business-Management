# Wave 10 — UserAccess role/permission writes

## Scope

- Cat `PUT /user-access/{id}/roles`
- Cat `PUT /user-access/{id}/permissions`
- Giu `dept-scopes` tai `V5MasterDataController` cho den Wave 11

## Files

- `backend/app/Http/Controllers/Api/V5/UserAccessController.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`

## Verification

- `php artisan route:list --path=api/v5/user-access`
- `php artisan test --filter='UserAccessCrudTest|V5DomainRouteBindingTest'`
