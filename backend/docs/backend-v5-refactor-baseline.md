# Backend V5 Refactor Baseline

Updated: `2026-03-24`

## Freeze policy
- `backend/app/Services/V5/Legacy/V5MasterDataLegacyService.php` is now a retired compatibility shell.
- `backend/app/Services/V5/Domain/CustomerRequestCaseDomainService.php`
- `backend/app/Services/V5/V5DomainSupportService.php`

Only targeted refactor or hotfix changes should land directly in these files while the post-legacy cleanup continues.

## Baseline metrics

| Artifact | Current lines | Guardrail |
| --- | ---: | --- |
| `app/Services/V5/Legacy/V5MasterDataLegacyService.php` | 25 | Must not increase |
| `app/Services/V5/Domain/CustomerRequestCaseDomainService.php` | 1,450 | Must not increase |
| `app/Services/V5/CustomerRequest/CustomerRequestCaseDashboardService.php` | 446 | Informational |
| `app/Services/V5/CustomerRequest/CustomerRequestCaseReadQueryService.php` | 460 | Informational |
| `app/Services/V5/CustomerRequest/CustomerRequestCaseReadModelService.php` | 682 | Informational |
| `app/Services/V5/CustomerRequest/CustomerRequestCaseExecutionService.php` | 293 | Informational |
| `app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php` | 1,295 | Informational |
| `app/Http/Controllers/Api/V5/ProjectProcedureController.php` | 195 | Must stay at or below 300 |
| `app/Services/V5/V5DomainSupportService.php` | 1,172 | Must not increase |
| `app/Services/V5/Support/LifecycleSupport.php` | 341 | Informational |

## Post-legacy status
- Runtime code no longer references `V5MasterDataLegacyService`.
- `V5MasterDataLegacyService` remains only as a fail-fast compatibility shell.
- Current refactor focus has moved to `CustomerRequestCaseDomainService` and `V5DomainSupportService`.
- Shared lifecycle/status and opportunity-stage catalog logic now lives in `LifecycleSupport`.
- Shared `CustomerRequestCase` read/query logic now lives in `CustomerRequestCaseReadQueryService`.
- Shared `CustomerRequestCase` serialization/detail aggregation now lives in `CustomerRequestCaseReadModelService`.
- Shared `CustomerRequestCase` worklog/estimate execution now lives in `CustomerRequestCaseExecutionService`.
- Shared `CustomerRequestCase` write/transition orchestration now lives in `CustomerRequestCaseWriteService`.

## Allowed temporary legacy delegation in domain layer
- None.

No additional `legacy->` usage should be introduced under `backend/app/Services/V5/Domain`.

## Service inheritance guard
- No business service under `backend/app/Services` is allowed to `extends Controller`.
- Any new service under `backend/app/Services` must remain framework-agnostic.
