# Wave 13 — Contract

## Scope

- Cat `generate-payments`
- Cat `payment-schedules`
- Cat `updatePaymentSchedule`

## Files

- `backend/app/Http/Controllers/Api/V5/ContractController.php`
- `backend/app/Services/V5/Domain/ContractDomainService.php`
- `backend/routes/api.php`
- `backend/tests/Feature/V5DomainRouteBindingTest.php`

## Verification

- `php artisan route:list --path=api/v5/contracts`
- `php artisan route:list --path=api/v5/payment-schedules`
- `php artisan test --filter='ContractPaymentGenerationTest|PaymentScheduleConfirmationTest|V5DomainRouteBindingTest'`
