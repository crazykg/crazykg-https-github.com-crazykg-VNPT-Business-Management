### ISSUE-12: DB connection budget and replica consistency plan missing
- Category: architecture
- Severity: high
- Plan section: A2. Read Replica Configuration (lines 1109-1122)
- Problem: A2 adds read/write hosts, but not DB connection budgeting/pooling, web-vs-queue connection caps, or read-after-write consistency rules.
- Evidence: A2 is only a `config/database.php` read/write snippet and says reads will auto-route to replica. There is no mention of `max_connections`, pooling/proxying, replica lag, or primary-only read paths.
- Why it matters: At 2000 concurrent users, PHP workers plus queue workers can exhaust MySQL connections, and replica lag will create stale reads right after writes.
- Suggested fix: Add an ops workstream before P3 exit that defines connection budgets per process type, pooling/proxy approach, lag thresholds, and which endpoints must stay on primary after mutation.

### ISSUE-13: Redis queue migration lacks retry and worker operating policy
- Category: operations
- Severity: high
- Plan section: Phase 3 / 3A (lines 346-353), A5 (lines 1144-1154)
- Problem: The plan switches the queue driver to Redis but does not define retries, backoff, timeouts, failed-job handling, queue priority, or worker supervision.
- Evidence: `3A` only changes `QUEUE_CONNECTION=redis`. A5 only says to “Monitor queue job performance.”
- Why it matters: At 2000 users, transient job failures and worker starvation will accumulate quickly and can block notifications, cache refreshes, and downstream reconciliation flows.
- Suggested fix: Add a queue-ops section covering `tries`, backoff, timeouts, idempotency, named queues, Horizon/Supervisor, failure alerts, and deploy-time drain/restart order.

### ISSUE-14: Session scaling plan is absent for multi-node Sanctum
- Category: architecture
- Severity: high
- Plan section: Missing from P0-P8/A1-A6; closest related sections are P3 (lines 342-483) and A1 (lines 1095-1107)
- Problem: The plan scales cache and client state, but not Redis-backed session storage and cookie/session behavior across multiple app nodes.
- Evidence: The plan has no session section at all; P3 covers cache/queue, A1 covers authorization only.
- Why it matters: At 2000 concurrent users, mixing sessions and cache without isolation/capacity rules can cause eviction, mass logout, or Redis contention.
- Suggested fix: Add a session-ops subsection covering dedicated Redis connection/DB, eviction policy, cookie domain/Secure/SameSite settings, non-sticky multi-node behavior, and failover/runbook expectations.

### ISSUE-15: Production error monitoring and APM are not covered
- Category: operations
- Severity: high
- Plan section: A5. Observability — Telescope + Metrics (lines 1144-1154)
- Problem: A5 is dev-oriented and does not provide production-grade error tracking, tracing, or alerting.
- Evidence: A5 installs Telescope with `composer require laravel/telescope --dev` and lists slow-query/cache/queue inspection only.
- Why it matters: At 2000 users, 5xx bursts, queue failures, Redis saturation, and frontend exceptions need real-time alerts and release correlation.
- Suggested fix: Expand A5 into a production observability track with Sentry/APM, request tracing, infrastructure metrics, alert thresholds, and release annotations.

### ISSUE-16: Production deployment strategy is missing
- Category: operations
- Severity: critical
- Plan section: A4. Docker Development Environment (lines 1132-1142), Rollback strategy (lines 1211-1215)
- Problem: The plan defines a dev environment and git rollback, but not how production is rolled out safely across app, queue, and scheduler processes.
- Evidence: A4 is explicitly for development only. Rollback guidance is branch/tag based; there is no rolling, canary, blue-green, health check, drain, or cache warm-up section.
- Why it matters: At 2000 users, safe rollout depends on traffic shifting and process coordination, not just reverting commits.
- Suggested fix: Add a deployment chapter covering runtime topology, readiness/health checks, rollout strategy, worker drain/restart order, config/cache build steps, and cache warm-up before full cutover.

### ISSUE-17: Zero-downtime schema and backfill protocol is missing
- Category: sequencing
- Severity: high
- Plan section: P1C (lines 128-177), P7C (lines 891-907), A6 (lines 1156-1167)
- Problem: The plan introduces indexes, backfills, and partitioning without a zero-downtime migration policy.
- Evidence: P1C adds composite indexes, P7C references migration backfills, and A6 proposes partitioning, but there is no expand/contract, online DDL, or backward-compatible schema sequencing guidance.
- Why it matters: At 2000 users, blocking DDL or incompatible code/schema ordering can create lock contention, failed deploys, and write stalls.
- Suggested fix: Add a migration policy for additive-first schema changes, separate backfill windows, online DDL tooling, dual-read/dual-write where needed, and explicit cutover/cleanup steps.

### ISSUE-18: No live monitoring or abort thresholds during rollout/migration
- Category: operations
- Severity: high
- Plan section: Verification Plan (lines 1189-1226)
- Problem: The plan verifies after each phase, but not during live rollout, migration, or backfill execution.
- Evidence: Verification is post-change test/load-test oriented. The only runtime cache check is manual `redis-cli monitor`; there are no live abort gates for error rate, queue lag, lock waits, or replica lag.
- Why it matters: At 2000 users, failures usually surface during rollout. Without live guardrails, production can degrade before anyone stops the change.
- Suggested fix: Add a rollout runbook with live dashboards and stop conditions for 5xx rate, p95 latency, DB lock waits, queue backlog, Redis memory, replica lag, and session/auth error spikes.

### ISSUE-19: HTTP compression and Vite asset precompression are missing
- Category: architecture
- Severity: high
- Plan section: P8 / 8D-8E (lines 1022-1078)
- Problem: The plan optimizes chunking and measures gzipped size, but never adds gzip/brotli serving or precompressed build artifacts.
- Evidence: P8 targets “< 300KB gzipped” and edits `vite.config.ts` for chunking only. There is no runtime compression or build-time gzip/brotli generation step.
- Why it matters: At 2000 users, uncompressed JS/CSS/JSON wastes bandwidth and increases latency, especially on first load and dashboard-heavy pages.
- Suggested fix: Add a delivery-optimization section covering reverse-proxy compression for text/JSON, Vite gzip/brotli artifact generation, and staging verification under load.

### ISSUE-20: HTTP cache-header strategy is absent
- Category: architecture
- Severity: high
- Plan section: A3. API Version Header (lines 1124-1130), P3 (lines 342-483)
- Problem: The plan adds Redis caching and version headers, but not browser/CDN cache semantics for safe GETs or no-store rules for sensitive responses.
- Evidence: A3 only adds `X-API-Version` and `X-Cache-Status`. No section mentions `Cache-Control`, `ETag`, `Last-Modified`, `304`, or `Vary`.
- Why it matters: At 2000 users, every browser refetch still hits origin, and missing `Vary`/`no-store` rules can create auth-related caching bugs.
- Suggested fix: Add an HTTP caching matrix by endpoint/asset type with `Cache-Control`, validators, `Vary`, and explicit exclusions for per-user or sensitive responses.

### ISSUE-21: Cache stampede and over-broad invalidation controls are missing
- Category: architecture
- Severity: high
- Plan section: Phase 3 / 3C-3E (lines 404-483)
- Problem: The cache design defines TTLs and broad tags, but not jitter, single-flight locking, prewarming, or safeguards against flushing hot collections on every write.
- Evidence: P3 uses short TTLs like 5 minutes and entity-wide tags such as `'invoices'` and `'contracts'`; the observer flushes list/detail tags on every save/delete.
- Why it matters: At 2000 users, synchronized expiry or broad tag flushes can create periodic DB spikes and collapse cache hit rates.
- Suggested fix: Extend P3 with TTL jitter, lock-based regeneration, background refresh for dashboards, and narrower invalidation keys for hot list segments.

### ISSUE-22: Read-path rate limiting is missing
- Category: risk
- Severity: high
- Plan section: Missing from P0-P8/A1-A6; closest related sections are P0 (lines 26-67) and P3 (lines 342-483)
- Problem: The plan optimizes expensive GET endpoints but never limits abusive or accidental high-frequency reads.
- Evidence: There is no throttle/limiter section anywhere in the plan despite heavy focus on dashboards, lists, and master-data endpoints.
- Why it matters: At 2000 users, a few noisy clients or polling tabs can saturate cache and DB even if average traffic is fine.
- Suggested fix: Add per-endpoint read throttles with different budgets for master data, dashboards, search/list endpoints, and export-style reads.

### ISSUE-23: Service Worker / PWA caching strategy is missing
- Category: architecture
- Severity: medium
- Plan section: P5-P8 (lines 603-1078)
- Problem: The frontend plan covers TanStack Query and lazy loading, but not app-shell/static asset caching or controlled offline-safe behavior.
- Evidence: P5 adds QueryClient and code splitting; P8 adds `React.lazy` and manual chunks. No section mentions Service Worker, precache, runtime caching, or versioned invalidation.
- Why it matters: At 2000 users, repeated cold loads after deploys still hit origin harder than necessary, and resilience to transient network issues stays weak.
- Suggested fix: Add a conservative Service Worker/PWA track for versioned asset precache and tightly scoped runtime caching, with a kill switch and deployment-safe invalidation rules.

### ISSUE-24: Error-boundary pattern is missing from the frontend plan
- Category: correctness
- Severity: medium
- Plan section: P8 / 8D (lines 1022-1055)
- Problem: The plan introduces `React.lazy` and `Suspense` but not route-level or feature-level `ErrorBoundary` coverage.
- Evidence: 8D shows `Suspense fallback` only. No boundary/reset pattern is described for chunk-load failures or rendering exceptions.
- Why it matters: At 2000 users, one broken widget or failed lazy chunk can blank an entire route or the whole SPA.
- Suggested fix: Add standard error-boundary placement rules for routes, hubs, and modal shells, plus reset/retry UX and forwarding to production monitoring.

### ISSUE-25: CSRF and session-fixation hardening are not covered
- Category: risk
- Severity: high
- Plan section: Missing from P0-P8/A1-A6; closest related section is A1 (lines 1095-1107)
- Problem: The plan does not address Sanctum CSRF bootstrap/recovery, session regeneration on login/privilege change, or secure cookie policy for multi-node deployment.
- Evidence: A1 handles authorization policies only. The plan contains no mention of CSRF, session regeneration, SameSite/Secure cookies, or invalidating old session IDs.
- Why it matters: At 2000 users, auth/session weaknesses become systemic: 419 storms, fixation windows, or inconsistent cookie behavior behind proxies/load balancers.
- Suggested fix: Add an auth-hardening section covering CSRF-cookie flow, 419 recovery, session regeneration/invalidation points, cookie policy, trusted proxies, and regression tests.

### ISSUE-26: Brute-force and credential-abuse controls are incomplete
- Category: risk
- Severity: high
- Plan section: Missing from P0-P8/A1-A6; closest related section is A1 (lines 1095-1107)
- Problem: The plan has no explicit controls for login, refresh, password change/reset, or high-fanout enumeration endpoints beyond current generic rate limits.
- Evidence: There is no mention of lockout, IP/user/device-based throttling, suspicious-auth alerts, or escalation for repeated failures.
- Why it matters: At 2000 users, credential stuffing or scripted enumeration can degrade availability and bypass the intended load envelope.
- Suggested fix: Add an abuse-protection workstream with dedicated auth throttles, progressive backoff/temporary lockouts, suspicious-activity alerts, and separate limits for login, refresh, password change, and export/search endpoints.

### VERDICT
- Status: REVISE
- Reason: The plan is strong on application refactors and caching, but it still omits several production-scale operating, delivery, and security controls required for a safe 2000-concurrent-user rollout.