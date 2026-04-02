ISSUE-1: A8/P3.1 authorization sample does not fit this Laravel app
Severity: critical
Category: correctness
Evidence: The plan says to add `$this->authorize()` in controllers and shows a `CustomerPolicy` using `App\Models\User`, `resolveAccessibleDepartmentIds()`, and `$customer->department_id`. In [Controller.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Http/Controllers/Controller.php#L1) the base controller is empty, so `$this->authorize()` is not available. Existing policies use `InternalUser`, not `User`, in [ContractPolicy.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Policies/ContractPolicy.php#L13), [InvoicePolicy.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Policies/InvoicePolicy.php#L13), and [CustomerRequestCasePolicy.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Policies/CustomerRequestCasePolicy.php#L13). The access service exposes `resolveDepartmentIdsForUser()`, not `resolveAccessibleDepartmentIds()`, in [UserAccessService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Support/Auth/UserAccessService.php#L232). `Customer` has no direct `department_id` field in [Customer.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Models/Customer.php#L15).
Suggestion: Rewrite the authorization tasks for this codebase: either add `AuthorizesRequests` to the base controller first or use `Gate::authorize(...)`; use `InternalUser`; use `resolveDepartmentIdsForUser()`; and derive customer scope via related projects/contracts, matching [CustomerDomainService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Domain/CustomerDomainService.php#L674).

ISSUE-2: The Phase 2 store tasks are too generic for the current frontend behavior
Severity: high
Category: completeness
Evidence: P2.1-P2.5 say “similar to contract” and the sample uses `contractApi.list/create/update/remove`, but the real APIs are `fetchContractsPage/createContract/updateContract/deleteContract` in [contractApi.ts](/Users/pvro86gmail.com/Downloads/QLCV/frontend/services/api/contractApi.ts#L146). The current flows have entity-specific behavior that the plan omits: employee creation uses `createEmployeeWithProvisioning` and temporary-password handling in [App.tsx](/Users/pvro86gmail.com/Downloads/QLCV/frontend/App.tsx#L1494), project save adds `sync_items`/`sync_raci` and reloads project items in [App.tsx](/Users/pvro86gmail.com/Downloads/QLCV/frontend/App.tsx#L893), customer delete has dependency-error modal handling in [App.tsx](/Users/pvro86gmail.com/Downloads/QLCV/frontend/App.tsx#L1560), and contract delete also updates payment schedules in [App.tsx](/Users/pvro86gmail.com/Downloads/QLCV/frontend/App.tsx#L1571).
Suggestion: Replace the generic “copy contractStore pattern” tasks with per-entity plans that list the real API functions, side effects, error handling, and all touched files for employee/project/customer/contract/product migrations.

ISSUE-3: P2.7 targets the wrong integration points for splitting `CustomerRequestCaseWriteService`
Severity: high
Category: correctness
Evidence: The plan says “Controller KHONG thay doi — chi inject Orchestrator thay vi WriteService”, but [CustomerRequestCaseController.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Http/Controllers/Api/V5/CustomerRequestCaseController.php#L17) does not inject `CustomerRequestCaseWriteService` at all. The current dependencies are in [CustomerRequestCaseDomainService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Domain/CustomerRequestCaseDomainService.php#L45) and [CustomerRequestCaseExecutionService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/CustomerRequest/CustomerRequestCaseExecutionService.php#L18), both of which depend on `CustomerRequestCaseWriteService`.
Suggestion: Update P2.7 to refactor the domain and execution services, keep a thin compatibility facade if needed, and add those files to the task/file list and verification scope.

ISSUE-4: The route-audit command in P3.1 is not valid on this Laravel 12 app
Severity: high
Category: correctness
Evidence: The plan uses `php artisan route:list --method=POST --method=PUT --method=PATCH --method=DELETE --columns=method,uri,action`. On this repo, `route:list --help` supports `--json` and `--method`, but not `--columns`; running the exact command errors with “The `--columns` option does not exist.” Repeating `--method` is also misleading here: without `--columns`, the output shows only `DELETE` routes, so the last method wins instead of producing a union.
Suggestion: Replace this with `route:list --json` plus `jq` filtering over methods, or run separate commands per method and merge the results.

ISSUE-5: The route-parity verification is too weak and the baseline is stale
Severity: high
Category: correctness
Evidence: P2.8 proposes a count-based test with a baseline of `170`, but the current app already has `334` `api/v5/*` routes. That means dozens of route removals could happen and the test would still pass. The pre/post `diff <(jq -S . ...)` commands also compare whole arrays, so additions or ordering changes will fail even though the stated goal is only “no route removed”.
Suggestion: Snapshot route identity tuples such as `{method, uri, action}` sorted deterministically, and assert that the pre-change set is a subset of the post-change set. Use the real current baseline if a count guard is kept at all.

ISSUE-6: P3.2 read-rate-limiter implementation and verify steps do not match current routing
Severity: high
Category: correctness
Evidence: All current V5 routes are already grouped with `throttle:api.write` in [routes/api.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/routes/api.php#L43) and module loading in [AppServiceProvider.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Providers/AppServiceProvider.php#L67). The sample “wrap GET routes” snippet is not executable as-is because routes are split across many included files. The verify command curls `/api/v5/products` unauthenticated, but that route is protected by `auth:sanctum` before throttle middleware in the live route definition.
Suggestion: Implement read throttling by adjusting the existing route groups or current limiter strategy, not by a placeholder GET wrapper. Verify with authenticated requests or a purpose-built public test endpoint.

ISSUE-7: The A6 frontend sample does not follow current Vite/TypeScript patterns
Severity: medium
Category: correctness
Evidence: The sample uses `process.env.NODE_ENV === 'development'`, but the frontend already uses `import.meta.env.DEV` in [AppWithRouter.tsx](/Users/pvro86gmail.com/Downloads/QLCV/frontend/AppWithRouter.tsx#L27). The proposed test objects only contain `roles` and `permissions`, while `AuthUser` requires `id`, `username`, `full_name`, `email`, `status`, and `dept_scopes` in [legacy.ts](/Users/pvro86gmail.com/Downloads/QLCV/frontend/types/legacy.ts#L285). Under the repo’s `lint` script (`tsc --noEmit`), those samples are not aligned with the current type surface.
Suggestion: Use `import.meta.env.DEV` for the warning branch and write tests using the existing `buildUser` helper pattern from [authorization.test.ts](/Users/pvro86gmail.com/Downloads/QLCV/frontend/__tests__/authorization.test.ts#L5).

ISSUE-8: The environment-hardening tasks are missing the config-cache refresh step
Severity: medium
Category: completeness
Evidence: A1-A3 and A7 instruct changing env values only, but the app reads those through config files in [vnpt_auth.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/config/vnpt_auth.php#L12), [session.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/config/session.php#L50), and the planned `config/cors.php`. On a cached Laravel deployment, changing `.env` alone will not update runtime config until the cache is rebuilt. This is an inference from standard Laravel deployment behavior.
Suggestion: Add an explicit deployment step after each env/config change: `php artisan config:clear && php artisan config:cache` or the project’s equivalent restart/cache-refresh process.

ISSUE-9: The 5-day estimate for “all mutating endpoints” policy coverage is not credible
Severity: medium
Category: feasibility
Evidence: The current app exposes `181` mutating `api/v5/*` routes, while P3.1 asks for endpoint-to-policy matrixing, policy creation, controller/service authorization updates, and IDOR tests “cho moi entity” in 5 days. Given the spread across many domains and the existing mixed enforcement model (request permissions, service-level scope checks, a few policies), this estimate is materially low.
Suggestion: Re-scope P3.1 by domain, prioritize truly unprotected mutations first, and break it into smaller deliverables with route-level inventory per module.

ISSUE-10: The Phase 4 security-audit verify command uses an outdated npm flag
Severity: low
Category: correctness
Evidence: The plan uses `npm audit --production --audit-level=high`, but the installed npm help shows `--omit=dev` / `--include=prod` style options instead of `--production`.
Suggestion: Replace it with `npm audit --omit=dev --audit-level=high`.

VERDICT: REVISE