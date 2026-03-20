# Wave 15 — Integration settings

## Scope

- Cat Backblaze B2 settings
- Cat Google Drive settings
- Cat contract alert settings
- Cat reminders va user dept history

## Files

- `backend/app/Http/Controllers/Api/V5/IntegrationSettingsController.php`
- `backend/app/Services/V5/Domain/IntegrationSettingsDomainService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`

## Verification

- `php artisan route:list --path=api/v5/integrations`
- `php artisan route:list --path=api/v5/utilities`
- `php artisan route:list --path=api/v5/reminders`
- `php artisan test --filter='V5DomainRouteBindingTest'`
