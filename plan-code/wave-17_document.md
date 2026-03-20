# Wave 17 — Document

## Scope

- Cat CRUD documents
- Cat upload/delete attachment tam
- Cat signed download routes

## Files

- `backend/app/Http/Controllers/Api/V5/DocumentController.php`
- `backend/app/Services/V5/Domain/DocumentDomainService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`

## Verification

- `php artisan route:list --path=api/v5/documents`
- `php artisan route:list --path=api/v5/attachments`
- `php artisan test --filter='V5DomainRouteBindingTest'`
