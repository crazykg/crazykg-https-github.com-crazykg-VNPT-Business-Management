### ISSUE-1: Cache tag strategy conflicts with the mandated test setup
- Category: correctness
- Severity: critical
- Plan section: Phase 3: Redis Cache (lines 235-304); Verification Plan (lines 973-984)
- Problem: The cache design assumes tag-capable cache drivers everywhere, but the stated test setup uses SQLite `:memory:` with the `array` cache driver.
- Evidence: The plan standardizes on `Cache::tags(['invoices'])->remember(...)` and `Cache::tags([$tag])->flush()`, then requires `composer test` and `redis-cli monitor` as verification.
- Why it matters: This is not executable under the current harness. The main invalidation mechanism will either fail in tests or behave differently from production, so the phase cannot be validated safely.
- Suggested fix: Add a driver-aware cache/testing strategy and separate Redis integration validation from the default array-cache test suite.

### ISSUE-2: API Resource rollout has no hard compatibility gate
- Category: correctness
- Severity: high
- Plan section: Phase 2B: API Resource Classes (lines 164-218)
- Problem: The plan acknowledges response-shape breakage risk but only mitigates it with E2E runs after each conversion.
- Evidence: It explicitly says to switch controllers from `response()->json(...)` to `new InvoiceResource(...)`, and notes `response shape changes may break frontend expectations`.
- Why it matters: “No breaking changes” across 337 routes is a contract problem, not just an E2E problem. E2E coverage will not catch all schema, nullability, pagination-meta, or field-order regressions.
- Suggested fix: Add response-contract baselining and compatibility criteria before resource conversion, with endpoint-by-endpoint schema parity checks.

### ISSUE-3: Authorization is deferred even while request logic is being moved
- Category: architecture
- Severity: high
- Plan section: Phase 2A: FormRequests (lines 136-162); A1: Authorization Policies (lines 880-892)
- Problem: FormRequests are standardized with `authorize(): true`, while the plan separately admits resource-level ownership checks do not exist and defers policies to a later recommendation.
- Evidence: `return true; // EnsurePermission middleware handles auth` in P2, then A1 states `No resource-level ownership checks`.
- Why it matters: Refactoring validation out of services without a parallel authorization audit can remove implicit guards and widen access during migration.
- Suggested fix: Make authorization parity a prerequisite for affected write endpoints, or explicitly limit P2 until policy coverage is defined.

### ISSUE-4: Cache invalidation ownership is split across two mechanisms
- Category: sequencing
- Severity: high
- Plan section: Phase 3D: CacheInvalidationObserver (lines 256-304); Phase 4B: Domain Events (lines 392-428)
- Problem: P3 assigns invalidation to model observers, then P4 adds `FlushRelatedCaches` listeners for domain events without defining which mechanism owns which cache layer.
- Evidence: P3 flushes tags on every `saved`/`deleted`; P4 says `FlushRelatedCaches.php -> triggered by all entity events`.
- Why it matters: This creates both over-flushing and coverage gaps during migration, depending on whether a write path is legacy-service, model-driven, or action/event-driven.
- Suggested fix: Define one invalidation authority per cache layer and a transition rule for mixed legacy/new write paths.

### ISSUE-5: The Zustand phase depends on editing a protected file
- Category: scope
- Severity: high
- Plan section: Phase 6: Zustand Expansion (lines 597-673); Regression safety net (lines 986-989)
- Problem: The plan makes `App.tsx` a primary edit target even though the constraints say it is protected and the plan itself warns against modifying protected files.
- Evidence: `Files to modify: App.tsx` and `App.tsx reduction: ~7,400 -> ~6,650`, while the safety net says `Never modify protected files (App.tsx, authorization.ts, etc.) without isolated testing`.
- Why it matters: A core phase is not achievable as written under the stated operating constraints, so the schedule and scope are unreliable.
- Suggested fix: Rework the migration around seams outside `App.tsx`, or add an explicit exception gate with narrower, audited protected-file edits.

### ISSUE-6: The index plan is not evidence-driven enough
- Category: risk
- Severity: medium
- Plan section: Phase 7A: Missing Composite Indexes (lines 679-715)
- Problem: The plan prescribes a new batch of indexes without requiring duplicate-index checks, left-prefix analysis, or `EXPLAIN` evidence first.
- Evidence: The context says there are already `254 indexes`, yet P7 immediately adds `add_performance_composite_indexes` with fixed index definitions.
- Why it matters: On a write-heavy CRM/ERP, extra indexes can regress inserts/updates and still fail to improve the real slow queries.
- Suggested fix: Add a pre-phase index audit with query evidence, duplicate detection, before/after `EXPLAIN`, and rollback criteria for each index.

### ISSUE-7: The scale target is asserted, not validated
- Category: correctness
- Severity: medium
- Plan section: Summary Timeline (lines 956-969); Verification Plan (lines 973-984)
- Problem: The plan targets `500-2000 concurrent users` and claims major perf gains, but the verification step is only a generic smoke run.
- Evidence: P3 claims `5-10x read perf`, P7 claims `Query perf at scale`, while verification only requires `cd perf && npm run smoke`.
- Why it matters: Functional regression tests and smoke benchmarks do not demonstrate concurrency safety, queue throughput, DB saturation behavior, or p95/p99 response times.
- Suggested fix: Add explicit load/soak testing with SLOs and phase exit criteria for 500, 1000, and 2000 concurrent users.

### ISSUE-8: “Lazy loading” is not explicitly implemented as a runtime technique
- Category: scope
- Severity: medium
- Plan section: Phase 5 (lines 432-593); Phase 8D (lines 853-874)
- Problem: One of the required techniques is lazy loading, but the plan only covers file splitting and Vite chunking.
- Evidence: The frontend sections discuss splitting `v5Api.ts`, splitting `Modals.tsx`, and `manualChunks(id)` in `vite.config.ts`; they do not define `React.lazy`, route-level lazy loading, or on-demand modal loading.
- Why it matters: Build-time chunking alone does not guarantee smaller initial runtime cost or deferred loading behavior.
- Suggested fix: Add a dedicated lazy-loading workstream with target screens/modals, loading boundaries, affected files, and verification metrics.

### ISSUE-9: The six additional recommendations do not meet the plan’s own acceptance structure
- Category: scope
- Severity: medium
- Plan section: Additional Recommendations (lines 878-952)
- Problem: A1-A6 are listed as recommendations, but unlike the main phases they do not carry effort, risk, dependencies, or verification criteria.
- Evidence: The sections describe policies, read replicas, headers, Docker, observability, and partitioning, but omit the planning metadata used elsewhere.
- Why it matters: They cannot be prioritized or accepted consistently, and they do not satisfy the requirement to cover the requested techniques/recommendations with actionable reviewable detail.
- Suggested fix: Either remove A1-A6 from acceptance scope or give each the same metadata as the main phases.

### VERDICT
- Status: REVISE
- Reason: The plan is directionally strong, but it has one blocking correctness issue and multiple high-severity gaps around testability, contract safety, authorization sequencing, and validation of the 500-2000 user target.