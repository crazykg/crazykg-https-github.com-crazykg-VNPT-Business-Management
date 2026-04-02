### ISSUE-14: Customer scope evidence regressed and now contradicts the repo
- Category: correctness
- Severity: high
- Plan section: `A8: IDOR audit — 4 key entities`; `9. OWASP Top 10 (2021) Mapping`
- Problem: The updated plan now states the wrong current-state evidence for customer scoping, and the proposed `CustomerPolicy` is narrower than the repo’s existing customer read-scope logic.
- Evidence: The plan says at [2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L342](/Users/pvro86gmail.com/Downloads/QLCV/plan-code/2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L342) that `CustomerDomainService currently has NO dept scope filtering at all`, and at [2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L370](/Users/pvro86gmail.com/Downloads/QLCV/plan-code/2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L370) it limits policy scope to contracts only with a Phase 3 TODO for projects. The OWASP A01 row repeats the same stale claim at [2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L1420](/Users/pvro86gmail.com/Downloads/QLCV/plan-code/2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L1420). In the repo, [CustomerDomainService.php#L664](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Domain/CustomerDomainService.php#L664), [CustomerDomainService.php#L702](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Domain/CustomerDomainService.php#L702), and [CustomerDomainService.php#L725](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Domain/CustomerDomainService.php#L725) already apply customer read scope through contracts, projects, and `created_by`, and [Customer.php#L34](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Models/Customer.php#L34) defines both `projects()` and `contracts()`.
- Why it matters: This is a Phase A access-control task. Following the plan literally would implement update/delete authorization that is narrower than the app’s current customer visibility model, which risks false 403s and leaves the OWASP A01 evidence inaccurate.
- Suggested fix: Rewrite A8 and the A01 OWASP row to match the repo’s real baseline. The policy example should align with current customer scope rules: contract dept link OR project dept link OR `created_by`, or the plan should explicitly justify any narrower go-live rule and call out the compatibility impact.

### ISSUE-15: P3.2 is still not fully executable as written
- Category: scope
- Severity: medium
- Plan section: `P3.2: GET rate limiting`
- Problem: The task still has an incomplete touch list and a non-concrete test setup.
- Evidence: The file list at [2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L976](/Users/pvro86gmail.com/Downloads/QLCV/plan-code/2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L976) names only `AppServiceProvider.php`, `routes/api.php`, and the test, but the implementation note at [2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L994](/Users/pvro86gmail.com/Downloads/QLCV/plan-code/2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L994) says to wrap GET endpoints in every `backend/routes/api/*.php` file; this repo currently has 12 such route files. The test setup at [2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L1033](/Users/pvro86gmail.com/Downloads/QLCV/plan-code/2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L1033) still says permission seeding “depends” on implementation and suggests `Sanctum::actingAs`, but [EnsurePermission.php#L17](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Http/Middleware/EnsurePermission.php#L17) authorizes via `UserAccessService::hasPermission()`, and `/api/v5/products` is protected by `permission:products.read` in [master-data.php#L72](/Users/pvro86gmail.com/Downloads/QLCV/backend/routes/api/master-data.php#L72). Existing tests seed DB permissions directly, for example [SupportServiceGroupPermissionAccessTest.php#L28](/Users/pvro86gmail.com/Downloads/QLCV/backend/tests/Feature/SupportServiceGroupPermissionAccessTest.php#L28).
- Why it matters: As written, the task is not directly executable and the verification can fail on authorization before it ever proves the read limiter works.
- Suggested fix: Expand the file list to the actual route files that need edits, and replace the placeholder permission note with one concrete setup path using seeded `permissions` plus `user_permissions` or `role_permission` rows, matching the existing feature-test pattern.

### ISSUE-16: The Docker verification still targets a protected API route as if it were public
- Category: correctness
- Severity: low
- Plan section: `P4.1: Docker + docker-compose`
- Problem: The Phase 4 verify command expects unauthenticated data from a route that is protected by auth and permission middleware.
- Evidence: The plan’s verify step at [2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L1225](/Users/pvro86gmail.com/Downloads/QLCV/plan-code/2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L1225) uses `curl -s http://localhost:8002/api/v5/products | head -1  # {"data":[...]}`. In the repo, all V5 module routes are grouped under `auth:sanctum` in [api.php#L43](/Users/pvro86gmail.com/Downloads/QLCV/backend/routes/api.php#L43), and `/api/v5/products` also requires `permission:products.read` in [master-data.php#L72](/Users/pvro86gmail.com/Downloads/QLCV/backend/routes/api/master-data.php#L72).
- Why it matters: The Docker acceptance step will report a false failure even when the containers are healthy.
- Suggested fix: Verify container health with `/api/health`, or use an authenticated seeded request for `/api/v5/products`.

### ISSUE-17: The scoring rubric still has a non-runnable access-control metric
- Category: risk
- Severity: medium
- Plan section: `10. Scoring Rubric`
- Problem: One of the core measurement commands still does not match the repo layout and does not cleanly measure what the rubric claims.
- Evidence: The rubric uses `rg 'Gate::authorize' Controllers/ -c` at [2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L1444](/Users/pvro86gmail.com/Downloads/QLCV/plan-code/2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L1444), but this repo’s controllers live under files such as [CustomerController.php#L1](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Http/Controllers/Api/V5/CustomerController.php#L1), not `Controllers/`. The plan also allows “`Gate::authorize()` hoac policy check” in A8 at [2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L329](/Users/pvro86gmail.com/Downloads/QLCV/plan-code/2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin_DEV.md#L329), so counting only `Gate::authorize` calls in one path undercounts valid authorization coverage.
- Why it matters: Acceptance criterion 5 is still not fully met because the scoring method is not reproducible and can mis-score access-control progress.
- Suggested fix: Replace that metric with a repo-accurate command and a clearer denominator, for example a route-to-authorization inventory over `backend/app/Http/Controllers` plus any approved service-level authorization points, using the same endpoint matrix the plan already requires for A8 and P3.1.

### VERDICT
- Status: REVISE
- Reason: Most Round 3 fixes are present, but the plan still has one stale customer-scope regression, one non-executable Phase 3 rate-limit task, one invalid Docker verify command, and one scoring metric that is not yet defensible against the actual repo.