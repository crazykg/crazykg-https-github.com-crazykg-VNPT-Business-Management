# Wave 14 — SupportConfig

## Scope

- Cat service groups
- Cat support request statuses
- Cat worklog activity types
- Cat support SLA configs

## Files

- `backend/app/Http/Controllers/Api/V5/SupportConfigController.php`
- `backend/app/Services/V5/Domain/SupportConfigDomainService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`

## Verification

- `php artisan route:list --path=api/v5/support-service-groups`
- `php artisan route:list --path=api/v5/support-request-statuses`
- `php artisan route:list --path=api/v5/worklog-activity-types`
- `php artisan route:list --path=api/v5/support-sla-configs`
- `php artisan test --filter='SupportServiceGroupWorkflowBindingTest|SupportSlaConfigScopedCrudTest|V5DomainRouteBindingTest'`
