# Wave 06 — Project + Department

## Scope

- Hoàn tất phần còn lại của `ProjectController`:
  - `project-items`
  - `project-types`
- `DepartmentController` đã ở đúng controller/service riêng từ trước; wave này chỉ cần giữ parity route và test của cụm project catalog

## Files dự kiến chạm

- `backend/app/Http/Controllers/Api/V5/ProjectController.php`
- `backend/app/Services/V5/Domain/ProjectDomainService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`
- `backend/tests/Feature/ProjectCatalogCrudTest.php`

## Route mục tiêu

- `GET /api/v5/project-items`
- `GET /api/v5/project_items`
- `GET /api/v5/project-types`
- `POST /api/v5/project-types`
- `PUT /api/v5/project-types/{id}`

## Verify

- `php artisan route:list --path=api/v5/project-items`
- `php artisan route:list --path=api/v5/project-types`
- `php artisan test --filter='V5DomainRouteBindingTest|ProjectCatalogCrudTest'`
