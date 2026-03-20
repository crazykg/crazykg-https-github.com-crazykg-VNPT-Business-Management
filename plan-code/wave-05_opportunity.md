# Wave 05 — Opportunity

## Scope

- Cutover `opportunity-stages` và các alias còn trỏ về `V5MasterDataController`
- Hội tụ thêm logic stage catalog vào `OpportunityController` + `OpportunityDomainService`

## Files dự kiến chạm

- `backend/app/Http/Controllers/Api/V5/OpportunityController.php`
- `backend/app/Services/V5/Domain/OpportunityDomainService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`
- `backend/tests/Feature/OpportunityStageCrudTest.php`

## Route mục tiêu

- `GET /api/v5/opportunity-stages`
- `GET /api/v5/opportunity_stages`
- `POST /api/v5/opportunity-stages`
- `PUT /api/v5/opportunity-stages/{id}`
- `POST /api/v5/opportunity_stages`
- `PUT /api/v5/opportunity_stages/{id}`

## Verify

- `php artisan route:list --path=api/v5/opportunity-stages`
- `php artisan route:list --path=api/v5/opportunity_stages`
- `php artisan test --filter='V5DomainRouteBindingTest|OpportunityStageCrudTest'`
