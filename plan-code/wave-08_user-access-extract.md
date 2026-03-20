# Wave 08 — UserAccess Internal Extract

## Scope

- Tao `UserAccessDomainService`
- Chuyen logic 6 endpoint vao service:
  - `roles`
  - `permissions`
  - `userAccess`
  - `updateUserRoles`
  - `updateUserPermissions`
  - `updateUserDeptScopes`
- `routes/api.php` chua doi binding o wave nay

## Files du kien cham

- `backend/app/Services/V5/Domain/UserAccessDomainService.php`
- `backend/app/Http/Controllers/Api/V5MasterDataController.php`
- `backend/tests/Feature/UserAccessCrudTest.php`

## Verify

- `php artisan test --filter='UserAccessCrudTest'`
- `php artisan test --filter='V5DomainRouteBindingTest|UserAccessCrudTest'`
