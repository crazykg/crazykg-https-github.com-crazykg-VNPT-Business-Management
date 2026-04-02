### ISSUE-9: Current-state sections still contradict the verified March 31 baseline
- Category: correctness
- Severity: medium
- Plan section: Sections 1.2, 1.3, 2.1, 2.2 vs Section 9
- Problem: Several earlier sections still describe already-fixed items as unresolved, while Section 9 says they are complete. The plan no longer has a single authoritative current state.
- Evidence: `"FE: TypeScript Safety | 4/10 | KHONG bat strict mode — strictNullChecks/noImplicitAny tat"`; `"Frontend: ... strictNullChecks DA BAT"`; `"// \"strictNullChecks\": true, ← KHONG CO"`; versus Section 9: `` `tsconfig.json` dong 28: `"strictNullChecks": true` `` and `` `tsconfig.json` dong 29: `"noImplicitAny": true` ``
- Why it matters: Reviewers and implementers can take the wrong baseline, duplicate already-completed work, or mis-prioritize remaining gaps.
- Suggested fix: Normalize all pre-Section-9 status statements to the March 31 verified baseline, or explicitly label stale subsections as “historical pre-verification context” and defer to Section 9 as the sole source of truth.

### ISSUE-10: Phase 4 health-check task is marked complete using the wrong endpoint
- Category: correctness
- Severity: high
- Plan section: Section 5 Phase 4.7, Section 8 Phase 4 acceptance, Section 9.2 Phase 4
- Problem: The plan defines Phase 4.7 as adding an unauthenticated `/api/health`, but Section 9 marks it complete based on an authenticated admin endpoint.
- Evidence: `"Phase 4 chi can them endpoint /api/health khong yeu cau auth cho load balancer / monitoring."`; acceptance: `"[ ] Health check endpoint /api/health tra HTTP 200"`; but Section 9 says `"4.7 | Health check endpoint | ✅ DA LAM | Route /api/v5/admin/health/tables ... middleware permission:system.health.view"`
- Why it matters: This is a real sequencing and acceptance error. A load balancer or uptime monitor cannot rely on an authenticated admin route, so the task is not actually done.
- Suggested fix: Change 4.7 back to incomplete until `/api/health` exists without auth, or redefine the task and acceptance criteria if the authenticated admin endpoint is intentionally sufficient.

### VERDICT
- Status: REVISE
- Reason: The plan is close, but it still has two approval-blocking inconsistencies: stale pre-verification status claims and an incorrectly completed health-check task.