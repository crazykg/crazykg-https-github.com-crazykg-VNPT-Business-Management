### ISSUE-101: Prerequisite mapping still conflicts with later schedule and phase text
- Category: sequencing
- Severity: high
- Plan section: Promoted Supplements; P1C; A1/A8/A12 tables; summary timeline (lines 24-35, 173-221, 1231-1238, 1328-1342, 2332-2343)
- Problem: Hard prerequisites were added, but later tables and implementation sections still describe the same items as downstream or parallel work.
- Evidence: Promoted Supplements says A1 before P2A, A8 before P3A, A12 before P1C, but later tables still say `A1 ... After P4`, `A8 ... Depends on P3A`, `A12 ... Depends on P1C`, and the summary still says `Parallel | A7-A19`. P1C still shows `Schema::table(...)->index(...)` while A12 later requires online DDL with `ALGORITHM=INPLACE, LOCK=NONE`.
- Why it matters: An AI can still follow the wrong section and execute the old order or the wrong migration pattern.
- Suggested fix: Make every dependency table, timeline, and gated phase section consistent with the promoted-supplement rules, and explicitly cross-reference A12/A8/A1 inside P1C/P3A/P2A.

### ISSUE-102: The new integration test profile is not repo-accurate as written
- Category: correctness
- Severity: high
- Plan section: Integration Test Suite — Redis + MySQL (lines 2393-2418)
- Problem: The new integration suite uses environment keys that do not match this Laravel 12 repo’s actual cache configuration.
- Evidence: The sample `phpunit-integration.xml` sets `<env name="CACHE_DRIVER" value="redis"/>`.
- Why it matters: In this repo the cache config is driven by `CACHE_STORE`; the suite can run while silently leaving the wrong cache backend active, so the ISSUE-102 fix is not reliable.
- Suggested fix: Make the sample profile repo-accurate and add a short verification step that prints the effective cache/session/queue drivers before the integration suite runs.

### ISSUE-105: The related-model cache fix still does not invalidate parent L2 detail caches
- Category: architecture
- Severity: high
- Plan section: 3F Cache Dependency Matrix for Related Models (lines 540-581)
- Problem: The new matrix identifies related models, but the sample implementation only flushes parent list tags, not the specific parent detail tags that L2 caches use.
- Evidence: The matrix is about cached detail endpoints like `GET /invoices/{id}`, but the code only does `flushTags([$parentTag])` with the comment `// L1 list of parent`.
- Why it matters: A child change such as `InvoiceItem` can still leave `invoice:{id}` stale, so the original ISSUE-105 is not actually closed.
- Suggested fix: Extend `PARENT_TAG_MAP` to include parent-id resolution and flush both the parent list tag and the precise parent detail tag(s).

### ISSUE-107: The expanded rollback section relies on mechanisms not defined elsewhere
- Category: risk
- Severity: high
- Plan section: A19; Rollback strategy (lines 2095-2236, 2429-2445)
- Problem: The new rollback paths depend on implementation elements that the rest of the plan never specifies.
- Evidence: A19 implements exception rendering in `bootstrap/app.php`, but rollback says `remove ApiErrorHandler middleware`. P2 rollback says to gate new responses behind `Accept: application/vnd.qlcv.v5.1+json`, but no P2/A3 section defines that header-negotiation mechanism.
- Why it matters: The rollback procedure is not executable during an incident, which makes the new rollback coverage unreliable.
- Suggested fix: Either fully specify those mechanisms in the relevant phase sections with file paths and code patterns, or replace them with rollback steps that match the actual design.

### ISSUE-108: The formal load-test fix still mixes two different toolchains
- Category: correctness
- Severity: high
- Plan section: 0A; 0D; Verification Plan (lines 43-47, 74-87, 2388)
- Problem: The updated plan improves the load-test specification, but it still mixes the existing `npm run load` harness with `k6`-specific reporting language.
- Evidence: 0A and the Verification Plan still say `cd perf && npm run load`, while 0D says `Save k6 JSON output`.
- Why it matters: An AI cannot know whether to keep the current Node perf runner, replace it with k6, or build an adapter between them.
- Suggested fix: Choose one load-test harness explicitly and make the command, output format, and artifacts consistent everywhere in the plan.

### ISSUE-110: The plan is still not fully blind-AI-executable, and the in-document estimates remain optimistic
- Category: scope
- Severity: high
- Plan section: A3; P5D; 8A; summary; protected-file sections (lines 1277-1283, 845-853, 1061-1075, 2345-2347, 2447-2455)
- Problem: Several snippets are still not executable as written, protected-file handling is still only fully defined for `App.tsx`, and the effort summary in this document was not re-baselined after adding new soak/toggle/integration work.
- Evidence: `response->header(...)` in A3, `qc.invalidateQueries({ queryKey: queryKeys.revenue.overview });` in P5D, `export const Sidebar = React.memo(Sidebar);` in 8A, and the summary still says `~668 engineer-hours (~16.7 person-weeks)` despite the newly added integration suite and P2 header-soak rollback. The regression section still mentions `authorization.ts`, but the detailed protocol is only for `App.tsx`.
- Why it matters: A blind AI model can still copy broken examples, and the schedule inside this plan still understates the safeguards the same plan requires.
- Suggested fix: Replace illustrative-but-invalid snippets with compile-safe patterns, extend the protected-file protocol beyond `App.tsx`, and update the effort summary in this plan itself.

### ISSUE-111: A19 still does not preserve the existing `TAB_EVICTED` contract
- Category: correctness
- Severity: high
- Plan section: A19 Standardized API Error Handling (lines 2117-2232)
- Problem: The new error taxonomy collapses tab eviction into generic conflict handling, but the current frontend already relies on a distinct `TAB_EVICTED` machine code.
- Evidence: The taxonomy says `CONFLICT | 409 | Tab eviction, duplicate, state conflict`, and the frontend integration section only describes generic `apiError.code` parsing with no explicit compatibility rule for `TAB_EVICTED`.
- Why it matters: Backward compatibility can break in the active-tab/session-eviction flow even if the new envelope is implemented correctly.
- Suggested fix: Preserve `TAB_EVICTED` as a first-class machine code, or document an explicit backend/frontend compatibility mapping and migration step before A19 rollout.

### VERDICT
- Most claimed fixes are real: ISSUE-103, ISSUE-104, ISSUE-106, and ISSUE-109 are materially resolved.
- The plan is improved, but it is still **not yet ready** for blind execution by any AI model because ISSUE-101, ISSUE-102, ISSUE-105, ISSUE-107, ISSUE-108, ISSUE-110, and ISSUE-111 remain open.
- The main remaining risks are internal contradiction, non-executable rollback/test instructions, and unresolved compatibility details.