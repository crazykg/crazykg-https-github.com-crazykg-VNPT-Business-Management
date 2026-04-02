### ISSUE-1: A8 customer authorization example is still inconsistent with the real V5 auth/data model
- Category: correctness
- Severity: critical
- Plan section: `A8: IDOR audit — 4 key entities`
- Problem: The updated A8 example still mixes the wrong authenticated model and an incomplete customer-scope rule, so the sample fix is not actually executable as written.
- Evidence: The plan’s `CustomerPolicy` uses `InternalUser`, but the test example now says `User::factory()->create()` and then `actingAs($userA)`. In the repo, V5 policy tests and feature tests use `InternalUser` objects or explicitly switch the auth provider, not plain `User` models. The sample policy also scopes customers only through `contracts()->whereIn('dept_id', ...)`, while current customer visibility in [CustomerDomainService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Domain/CustomerDomainService.php#L674) considers both contract- and project-based department links.
- Why it matters: This is a Phase A go-live blocker. If the team follows the sample literally, the IDOR fix can fail in test setup or silently under-protect customer records that are visible via projects but not contracts.
- Suggested fix: Rewrite the sample to use the same auth model as the V5 stack: either create/attach an `InternalUser` instance manually as existing tests do, or explicitly configure the provider in the test before using `User`. Update `CustomerPolicy` to reuse the same contract/project scope logic already present in `CustomerDomainService` instead of contracts-only logic.

### ISSUE-5: The new route-parity snapshot still compares incompatible method formats
- Category: correctness
- Severity: critical
- Plan section: `PREREQUISITE GATE — Truoc khi bat dau Phase 2`, `P2.8: Route-list snapshot test (CI)`
- Problem: The baseline generator and the PHPUnit test still serialize methods differently, so the parity gate will self-fail on normal GET routes.
- Evidence: The prerequisite baseline command writes `{method: .method, uri: .uri}` from `php artisan route:list --json`, which produces strings like `GET|HEAD`. The test then builds current tuples with `$route->methods()[0]`, which yields `GET`. Those tuples cannot match for the same route.
- Why it matters: Phase 2’s route-parity gate becomes unreliable and blocks delivery for the wrong reason.
- Suggested fix: Normalize both sides the same way. Either store `GET` only in the baseline, or have the test join route methods into the same `GET|HEAD` format. Also rename the test or filter consistently, because `test_v5_mutating_routes_are_superset_of_baseline()` currently checks all `api/v5/*` routes, not only mutating ones.

### ISSUE-11: The new OWASP mapping table is present but still inaccurate
- Category: architecture
- Severity: high
- Plan section: `9. OWASP Top 10 (2021) Mapping`
- Problem: Several OWASP rows cite the wrong tasks or incorrect repo evidence, so the mapping does not yet satisfy the “accurate” acceptance criterion.
- Evidence: The table says `A05` evidence includes `APP_DEBUG=true in .env.example`, but [backend/.env.example](/Users/pvro86gmail.com/Downloads/QLCV/backend/.env.example#L6) is `APP_DEBUG=false`. It maps `A06` to `P4.5 (CI security scan)`, but CI security scan is `P4.4` in the plan. It maps `A09` to `P4.7 (health check), P4.6 (abuse detect)`, but `P4.7` is pentest and `P4.6` is OpenAPI. It also claims `DB::raw` usage is `~20`, while the repo currently has far more occurrences, and claims no user-controlled URL fetch paths while integration services clearly make outbound HTTP calls.
- Why it matters: Acceptance criterion 3 is still unmet. A misleading OWASP table gives false confidence about security coverage.
- Suggested fix: Re-audit the whole Section 9 table against the actual repo and the actual task numbers. Correct the task references and replace approximate or incorrect evidence with command-backed facts.

### ISSUE-12: The scoring rubric exists now, but its baseline evidence is still inconsistent
- Category: risk
- Severity: medium
- Plan section: `10. Scoring Rubric`
- Problem: The rubric is an improvement, but the measured baseline it uses is still not fully defensible because at least one core metric is wrong and conflicts with Section 2.
- Evidence: Section 10 says `E2E specs: 8 files`, while the repo currently has `7` Playwright spec files under `frontend/e2e`, and Section 2 also says `7 files`. That means the baseline score is still derived from inconsistent source data.
- Why it matters: Acceptance criterion 5 requires a defensible score with evidence from the codebase. Internal metric drift weakens the credibility of the roadmap targets.
- Suggested fix: Regenerate the Section 10 baseline from the exact commands listed in the rubric and keep a single authoritative metric set shared by Section 2 and Section 10.

### ISSUE-13: The new ReadRateLimitTest outline still uses the wrong auth setup for V5 routes
- Category: correctness
- Severity: high
- Plan section: `P3.2: GET rate limiting`
- Problem: The task now includes a test file, but the test outline still authenticates as `App\Models\User` and expects `200` from `/api/v5/products`, which does not match how current V5 permission-gated routes are exercised in this repo.
- Evidence: The sample test uses `User::factory()->create()` plus `actingAs($user)->getJson('/api/v5/products')`. In the repo, `/api/v5/products` is protected by `EnsurePermission`, which checks permissions through [UserAccessService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Support/Auth/UserAccessService.php#L134), and existing V5 tests typically act as `InternalUser` instances or explicitly reconfigure the auth provider.
- Why it matters: The verification path for P3.2 is still not reliable. The example can fail on auth/permission setup instead of actually validating the limiter.
- Suggested fix: Rewrite the sample test to follow existing V5 test patterns: authenticate as an `InternalUser`-backed actor, seed the required permission state, and then assert rate limiting on that authenticated flow.

### VERDICT
- Status: REVISE
- Reason: The plan is close, but there are still blocking correctness issues in the new A8, route-parity, OWASP, and rate-limit verification sections, so the acceptance criteria are not fully met yet.