### ISSUE-2: Sections 1-8 are still not synchronized with the verified current state
- Category: correctness
- Severity: high
- Plan section: `### 1.1`; `### 2.1`; `### 2.2`; `### 3.2`; `### 9.2`; `### 9.3`
- Problem: The plan says Sections 1-8 are fully synchronized with Section 9, but several “verified” facts still conflict with both Section 9 and the repo.
- Evidence: Section 1.1 states `Moi thay doi trong Sections 1-8 da dong bo voi Section 9.` But Section 2.1 lists `8 stores ... productStore`, while [frontend/shared/stores](/Users/pvro86gmail.com/Downloads/QLCV/frontend/shared/stores) has no `productStore.ts`. Section 2.1/3.6 still say `Hien tai: 7 specs`, while Sections 1.2, 9.2, and the repo under [frontend/e2e](/Users/pvro86gmail.com/Downloads/QLCV/frontend/e2e) show 12 specs. Section 3.2 still says `Khong tim thay config/cors.php`, while Phase A and Section 9.3 say `config/cors.php` exists, which matches [backend/config/cors.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/config/cors.php).
- Why it matters: Acceptance criterion (5) fails again because the document no longer has a single trustworthy current-state baseline. It also distorts risk and phase priority.
- Suggested fix: Re-sync all narrative sections to one current-state baseline. Remove stale references to `productStore`, update all E2E counts to 12 where describing current state, and replace outdated “missing CORS” text with the verified current status.

### ISSUE-6: The scorecard is still internally inconsistent and not reproducible
- Category: correctness
- Severity: critical
- Plan section: `### 1.1`; `### 2.1`; `### 2.2`; `### 3.1`; `### 3.2`; `## Phu luc B`; `### 9.6`
- Problem: The plan now publishes multiple conflicting score sets, and Appendix B still does not provide a reproducible path to the published numbers.
- Evidence: Section 1.1 says FE/BE/system are `7.1 / 8.2 / 7.7`, but section headers still show `2.1 = 5.5`, `2.2 = 7.8`, `3.1 = 7.8`, `3.2 = 8.1`. Appendix B still calculates `FE combined = 6.7`, `BE combined = 8.0`, `System total = 7.4`. The item table in 1.2 also does not yield Section 1.1’s numbers. Appendix B’s evidence command for item 20 is `find __tests__ ...`, but the repo also contains [frontend/shared/queryKeys.test.ts](/Users/pvro86gmail.com/Downloads/QLCV/frontend/shared/queryKeys.test.ts), so the listed command does not fully reproduce the frontend test inventory.
- Why it matters: Acceptance criterion (5) is still not met. A “single authoritative scorecard” cannot coexist with contradictory sub-scores and non-reproducible evidence commands.
- Suggested fix: Choose one authoritative score set, recompute every section from the same item table, update all section headers and Appendix B to match it exactly, and correct the evidence commands so another reviewer can reproduce the published counts.

### ISSUE-8: Phase 4 health-check completion is credited against the wrong endpoint
- Category: correctness
- Severity: medium
- Plan section: `### Phase 4: Excellence`; `### Phase 4 — Excellence`; `### 9.2`
- Problem: The plan treats an admin-only route as if it satisfies the generic “health check endpoint + uptime monitoring” task and the `/api/health` acceptance criterion.
- Evidence: Phase 4 defines `4.7 | Health check endpoint + uptime monitoring`, and Phase 4 acceptance requires `Health check endpoint /api/health tra HTTP 200`. But Section 9.2 marks 4.7 as done based on `Route /api/v5/admin/health/tables ... middleware permission:system.health.view`, which matches [backend/routes/api/admin.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/routes/api/admin.php#L10).
- Why it matters: Acceptance criterion (4) is weakened because the task definition, completion evidence, and acceptance check are not the same thing. It also overstates Phase 4 progress.
- Suggested fix: Decide which one is authoritative. Either keep 4.7 open until a dedicated uptime-friendly `/api/health` endpoint exists, or redefine the task and acceptance criteria to the existing admin-protected route.

### VERDICT
- Status: REVISE
- Reason: The plan still has unsynchronized current-state facts, contradictory scorecards, and one Phase 4 acceptance gate that does not match the endpoint being used as evidence.