### ISSUE-1: A8 authorization sample still does not match the real backend auth model
- Category: correctness
- Severity: critical
- Plan section: `A8: IDOR audit — 4 key entities`, `P3.1: Mo rong Policies cho mutating endpoints`
- Problem: The updated plan fixed the high-level direction, but the concrete `CustomerPolicy` and test sample are still not executable against this repo.
- Evidence: The plan sample still uses `$user->hasRole('admin')`, passes `$user` into `resolveDepartmentIdsForUser($user)`, and queries `contracts()->whereIn('department_id', ...)`. In the repo, [InternalUser.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Models/InternalUser.php#L11) has no `hasRole()` method, [UserAccessService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Support/Auth/UserAccessService.php#L232) expects an `int $userId`, and contract department handling is schema-tolerant elsewhere because `contracts` may use `dept_id` or `department_id` as seen in [ContractDomainService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Domain/ContractDomainService.php#L1605). The test sample also uses `InternalUser::factory()`, `Department::factory()`, and `Contract::factory()`, but the repo only has [UserFactory.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/database/factories/UserFactory.php#L1).
- Why it matters: This is a Phase A security task. If the implementation follows the sample literally, the team will hit broken code paths before they even get to the IDOR fix.
- Suggested fix: Replace the sample with repo-accurate code: use `app(UserAccessService::class)->isAdmin((int) $user->getKey())`, pass `resolveDepartmentIdsForUser((int) $user->getKey())`, resolve customer scope via the same schema-aware logic already used in [CustomerDomainService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Domain/CustomerDomainService.php#L674), and rewrite the test example without nonexistent factories.

### ISSUE-2: The `contractStore` sample still has a wrong import path
- Category: correctness
- Severity: low
- Plan section: `P2.1: contractStore.ts`
- Problem: The sample code still contains at least one path that does not match the real frontend layout.
- Evidence: The plan snippet for `frontend/shared/stores/contractStore.ts` says `import type { Contract } from '../types';`. Existing stores under `frontend/shared/stores/` import from `../../types`, for example [authStore.ts](/Users/pvro86gmail.com/Downloads/QLCV/frontend/shared/stores/authStore.ts#L2).
- Why it matters: This plan is supposed to be executable. Wrong sample imports create avoidable implementation churn and reduce trust in the task details.
- Suggested fix: Change the sample to the actual repo path, e.g. `../../types` or the more specific contract type module used by the team.

### ISSUE-5: The route-parity fix is still not CI-safe and still keeps the old false-positive diff gate
- Category: correctness
- Severity: high
- Plan section: `PREREQUISITE GATE`, `P2.6: Route parity verify + CompatibilityLookupService review`, `P2.8: Route-list snapshot test (CI)`
- Problem: The plan added a stronger test, but the shell gates still compare full JSON arrays, and the new PHPUnit snapshot test depends on creating a baseline file at runtime in a path that does not exist in the repo.
- Evidence: The plan still uses `diff <(jq -S . pre) <(jq -S . post)` while claiming the goal is “khong co route nao bi xoa”; that diff will also fail on legitimate additions or ordering changes. The new test writes `tests/fixtures/route-baseline.json`, but the repo currently has no `backend/tests/fixtures` directory or committed baseline file.
- Why it matters: The route gate can still fail for the wrong reason locally, and the CI test will not enforce anything reliably on a fresh checkout.
- Suggested fix: Remove the raw `diff` gate and use only a deterministic set comparison over committed baseline data. Add `backend/tests/fixtures/route-baseline.json` to the repo, create the `backend/tests/fixtures` directory explicitly, and compare sorted `{method, uri, action}` tuples rather than full JSON blobs.

### ISSUE-11: The plan still has no OWASP Top 10 mapping
- Category: architecture
- Severity: high
- Plan section: `Sections 1-8 overall`
- Problem: Acceptance criterion 3 requires accurate OWASP Top 10 mapping, but the plan still does not contain one.
- Evidence: Searching the updated plan shows only one OWASP mention, in `P4.7` as “OWASP Testing Guide v4.2” for the external pentest. There is no section mapping Phase A/P3/P4 controls to OWASP categories.
- Why it matters: Without explicit mapping, the security roadmap is not traceable to the stated acceptance criteria and cannot show coverage gaps systematically.
- Suggested fix: Add a dedicated OWASP mapping section that links each security task to OWASP 2021 categories, with a short justification and current codebase evidence for each mapping.

### ISSUE-12: The score targets are still not defensible, and the baseline evidence under them is stale
- Category: risk
- Severity: high
- Plan section: `1. Trang thai tong hop`, `2. Diem hien tai`
- Problem: The plan still assigns phase scores (`7.5 / 10`, `8.0 / 10`, `8.5 / 10`, `9.0 / 10`) without any scoring rubric, weights, or threshold rules, and Section 2 still contains stale baseline numbers.
- Evidence: The plan shows the score table but no methodology. Section 2 still says `App.tsx | 1,491 dong` and `Unit tests | 110 files`, while the repo currently has `1587` lines in `frontend/App.tsx` and `108` non-E2E frontend tests from direct filesystem checks.
- Why it matters: Acceptance criterion 5 is unmet. A readiness score without a rubric and with stale evidence is not auditable.
- Suggested fix: Add a scoring rubric with weighted dimensions, pass/fail thresholds, and the exact metrics/commands used to compute each phase score. Refresh Section 2 from current repo data before using it as evidence.

### ISSUE-13: P3.2 verification is still not fully executable because the referenced test is not part of the task
- Category: scope
- Severity: medium
- Plan section: `P3.2: GET rate limiting`
- Problem: The plan now verifies via PHPUnit, but it does not actually include creation of the test it depends on.
- Evidence: `P3.2` lists only `backend/app/Providers/AppServiceProvider.php` and `backend/routes/api.php` as touched files, yet the verify step requires `php artisan test --filter=ReadRateLimitTest`. The plan nowhere adds `backend/tests/Feature/ReadRateLimitTest.php`.
- Why it matters: The phase acceptance is not actually measurable from the task as written; the verification artifact is missing from scope.
- Suggested fix: Add `backend/tests/Feature/ReadRateLimitTest.php` to the file list and include a minimal test outline covering authenticated GET burst behavior and expected `429` response.

### VERDICT
- Status: REVISE
- Reason: The accepted fixes improved the plan materially, but there are still blocking execution errors in the Phase A authorization sample, the route-parity gate remains incomplete, and the plan still does not satisfy the OWASP-mapping and scoring-methodology acceptance criteria.