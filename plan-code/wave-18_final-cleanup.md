# Wave 18 — Final cleanup

## Scope

- Xoa route ownership cu cua `V5MasterDataController`
- Chuyen implementation legacy sang service noi bo `V5MasterDataLegacyService`
- Cap nhat wrapper services sang legacy service moi

## Files

- `backend/app/Services/V5/Legacy/V5MasterDataLegacyService.php`
- `backend/app/Services/V5/Domain/*DomainService.php`
- `backend/routes/api.php`

## Verification

- `rg -n "V5MasterDataController::class" backend/routes/api.php`
- `php artisan test`
