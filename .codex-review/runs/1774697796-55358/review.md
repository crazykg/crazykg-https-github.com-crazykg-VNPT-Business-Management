### ISSUE-101: Supplementary items are still mis-sequenced as if they were optional
- Category: sequencing
- Severity: critical
- Plan section: Dependency Chain; A7-A19 table/timeline; P2A; A1; P3A; A8; A12; A19 (lines 15-22, 1175-1189, 184-255, 1095-1107, 346-354, 1266-1364, 1596-1624, 1939-2080, 2176-2187)
- Problem: Several “supplementary” recommendations are actually prerequisites for earlier phases, but the plan still presents A7-A19 as parallel/additional work.
- Evidence: The summary says `Parallel | A7-A19`, while A19 says `Before P2`, P2A says access guards must wait for Policies, A8 only appears after P3A queue->Redis, and A12 is introduced after P1C is already doing schema/index work.
- Why it matters: An AI or team following the phase order literally can execute unsafe or incomplete steps in the wrong order.
- Suggested fix: Promote A1, A8, A12, and A19 into the main phase chain with hard entry/exit gates, not the “parallel supplements” bucket.

### ISSUE-102: Core infra changes still have no executable integration-test lane
- Category: risk
- Severity: critical
- Plan section: P3B; Verification Plan (lines 355-402, 2225-2235)
- Problem: The plan intentionally disables cache behavior in tests and leaves Redis validation mostly manual, so the riskiest production paths are not actually gated.
- Evidence: P3B says to add `<env name="CACHE_ENABLED" value="false"/>` so tests bypass cache entirely; verification item 7 is only a manual `redis-cli monitor` check.
- Why it matters: P3, A7-A18, and any Redis/session/queue behavior can regress without CI catching it.
- Suggested fix: Add a second, explicit integration suite on MySQL + Redis + real queue workers, with commands, ownership, and pass/fail criteria per affected phase.

### ISSUE-103: Read-replica guidance is technically inconsistent and not copy-safe
- Category: correctness
- Severity: high
- Plan section: A2; A7 read-replica rules (lines 1109-1123, 1250-1262)
- Problem: The plan mixes Laravel’s normal read/write split with `DB::connection('mysql::read')`, which is not a defined connection strategy here.
- Evidence: A2 says `DB::connection('mysql')->...` auto-routes reads to replica, then A7 says `Add DB::connection('mysql::read') for replica-safe endpoints only`.
- Why it matters: An implementer can produce either nonexistent connection calls or stale read-after-write behavior.
- Suggested fix: Choose one concrete Laravel pattern and document it precisely: either named replica connections or standard read/write config with sticky/read-your-writes rules.

### ISSUE-104: After-commit behavior is still missing from the design
- Category: correctness
- Severity: critical
- Plan section: P3E; P4A-P4B; A8 (lines 425-452, 524-551, 1297-1304)
- Problem: The plan defines observers, events, and queued work around transactional writes, but never requires them to run only after commit.
- Evidence: Cache invalidation happens on `saved`/`deleted`; the Action example wraps writes in `DB::transaction(...)`; queue config is shown without any after-commit rule.
- Why it matters: Caches can be flushed or rebuilt from uncommitted state, and jobs/listeners can observe records that later roll back.
- Suggested fix: Add a cross-cutting rule that cache invalidation, domain events, and queued jobs touching mutated data must be after-commit, with Laravel-specific implementation guidance.

### ISSUE-105: Cache invalidation still misses related-model dependencies
- Category: architecture
- Severity: high
- Plan section: P2B; P3C-P3E; A14 (lines 289-317, 404-479, 1746-1751)
- Problem: L2 response caches are defined around rich detail payloads, but invalidation only flushes the changed model’s own tag.
- Evidence: `InvoiceResource` includes `items`, `contract`, and `customer`, while the observer only flushes `invoices` and `invoice:{id}` based on the changed model class.
- Why it matters: Parent/detail caches can stay stale when child or related records change.
- Suggested fix: Add an endpoint-to-model dependency matrix and explicit parent-tag invalidation rules before enabling L2 response caching.

### ISSUE-106: The frontend migration still has no single-source-of-truth plan
- Category: architecture
- Severity: high
- Plan section: P5; P6; Rollback strategy (lines 701-731, 734-766, 770-867, 2248)
- Problem: The plan adds TanStack hooks while preserving raw APIs and legacy imports, but never defines which layer owns each screen’s data during migration.
- Evidence: P5 says each module exports both raw API functions and TanStack hooks; rollback for P5 is effectively “don’t import hooks”.
- Why it matters: Mixed ownership will cause duplicate fetches, conflicting cache lifecycles, and hard-to-debug state drift.
- Suggested fix: Add a page-by-page migration matrix with one authoritative data source per screen and explicit retirement steps for legacy hooks/App.tsx loaders.

### ISSUE-107: Rollback is incomplete for client-visible contract changes
- Category: risk
- Severity: high
- Plan section: P2; A15; A19; Rollback strategy (lines 184-319, 1756-1802, 1939-2080, 2245-2249)
- Problem: The rollback section covers cache/TanStack/Zustand, but not new error envelopes, validation behavior, response serialization changes, or throttling.
- Evidence: The rollback block lists only P3, P5, and P6; A19 introduces a new global error envelope and code taxonomy.
- Why it matters: Backward compatibility can break for the frontend or internal clients with no fast operational escape hatch.
- Suggested fix: Add canary/rollback rules and toggles for every contract-visible change, especially P2, A15, A19, and A13.

### ISSUE-108: The performance gates are not executable as currently defined
- Category: risk
- Severity: high
- Plan section: P0; Verification Plan (lines 30-63, 53-59, 2232-2243)
- Problem: The plan ties acceptance to 500/1000/2000-concurrency gates, but only specifies `npm run load` with no required environment, traffic model, or dataset profile.
- Evidence: P0 prescribes `cd perf && PERF_BASE_URL=http://localhost:8002 npm run load`, then sets phase exits at up to `2000 concurrent`.
- Why it matters: The performance “pass/fail” gate is not reproducible, so claimed scale readiness remains subjective.
- Suggested fix: Define a formal load-test spec: authenticated vs anonymous traffic, seeded data volume, warm/cold cache runs, polling cadence, multi-node staging setup, and a dedicated high-concurrency scenario.

### ISSUE-109: A7 violates the explicit no-stack-change constraint
- Category: scope
- Severity: high
- Plan section: A7 (lines 1245-1248)
- Problem: The plan offers Laravel Octane/Swoole as a scaling option.
- Evidence: `OR Laravel Octane (Swoole) — persistent connections, 10x throughput`.
- Why it matters: Octane changes the runtime model and operational stack, which the request explicitly forbids.
- Suggested fix: Remove Octane from the plan and constrain scaling options to the existing PHP-FPM/Laravel/MySQL/Redis stack.

### ISSUE-110: The plan is still not blind-AI-executable, and the effort numbers are optimistic
- Category: scope
- Severity: high
- Plan section: P4B; A1; A3; P5; P6; Verification; Protected file protocol; Summary (lines 585-587, 1107, 1126-1129, 764-767, 775-777, 865-867, 2189-2191, 2225-2235, 2251-2258)
- Problem: Some instructions assume files/providers not present in this repo, some snippets are illustrative rather than executable, protected-file handling is only fully defined for `App.tsx`, and the estimates ignore the mandatory verification cadence the plan itself imposes.
- Evidence: The plan says `EventServiceProvider registration`, `Register in AuthServiceProvider`, uses `response->header(...)`, assigns P5 `12 days` and P6 `6 days`, while also requiring one-PR-per-store, full E2E before/after protected edits, and per-phase perf runs.
- Why it matters: Any AI model will still need repo-specific guesswork, and a 2-3 developer team planning from these numbers is likely to skip safeguards to stay on schedule.
- Suggested fix: Convert all examples to repo-accurate executable instructions, expand the protected-file registry beyond `App.tsx`, and re-baseline effort with explicit time for QA, perf validation, rollout prep, and review.

### VERDICT
- Status: NOT READY for blind implementation by “any AI model”.
- Blocking issues: ISSUE-101, ISSUE-102, ISSUE-103, ISSUE-104, ISSUE-105, ISSUE-107, ISSUE-108.
- Approval condition: Fix sequencing, add a real infra test lane, correct replica/commit semantics, complete cache dependency mapping, and make contract-changing phases rollback-safe.