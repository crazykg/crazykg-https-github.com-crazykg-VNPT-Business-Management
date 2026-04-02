ISSUE-12 through ISSUE-26 are substantively addressed in A7-A17. Remaining findings below are net-new.

### ISSUE-27: Redis DB isolation does not actually isolate eviction behavior
- Category: correctness
- Severity: high
- Plan section: A9. Session Scaling — Multi-Node Sanctum (lines 1323-1357), A8. Queue Operating Policy (lines 1278-1287)
- Problem: A9 assumes `REDIS_CACHE_DB=0` can be evictable while `REDIS_SESSION_DB=1` and `REDIS_QUEUE_DB=2` are non-evictable on the same Redis host. Redis eviction policy is instance-wide, not per logical DB.
- Evidence: A9 uses one `REDIS_HOST` and labels DB0 as `allkeys-lru` and DB1/DB2 as `noeviction`. No section introduces separate Redis instances/clusters.
- Why it matters: At 2000 users, cache pressure can still evict session or queue keys, or a global `noeviction` policy can make cache writes fail under memory pressure.
- Suggested fix: Revise A8/A9/A14 to require separate Redis instances/services for cache vs session/queue, or explicitly run one non-evicting Redis for critical data and move evictable cache to a separate store.

### ISSUE-28: Queue retry policy is missing idempotency and duplicate-execution rules
- Category: correctness
- Severity: high
- Plan section: A8. Queue Operating Policy (lines 1249-1319), Phase 4 / Domain Events (lines 559-595)
- Problem: A8 standardizes retries, backoff, and worker supervision, but does not define which jobs must be idempotent, unique, or deduplicated before retrying.
- Evidence: A8 adds `tries`, `backoff`, `timeout`, `failed()`, and manual retry guidance, but there is no mention of idempotency keys, `ShouldBeUnique`, unique locks, or side-effect classification.
- Why it matters: At 2000 users, retries plus rolling deploys can replay exports, notifications, reconciliation, or other side effects and create duplicate outcomes.
- Suggested fix: Add a retry-safety policy that classifies each job as idempotent/non-idempotent, requires unique locks or dedupe keys where needed, and forbids blind retries for externally visible side effects.

### ISSUE-29: HA/DR and restore testing are still missing for stateful services
- Category: operations
- Severity: high
- Plan section: A7-A11 (lines 1193-1499), missing from Verification Plan (lines 1866-1903)
- Problem: The plan now makes MySQL primary/replica and Redis central to cache, sessions, and queues, but still does not define backup, PITR, Redis persistence, or failover drills.
- Evidence: The updated plan contains no backup/restore/PITR/AOF/RDB/Sentinel/restore-test section. A10 and A11 cover monitoring and deploys, not recovery.
- Why it matters: At 2000 users, a bad migration, primary failure, or Redis loss becomes an availability and data-loss event without a tested recovery path.
- Suggested fix: Add an HA/DR section covering MySQL backups and PITR, replica promotion rules, Redis persistence/failover strategy, restore drill cadence, and named recovery owners.

### ISSUE-30: Health checks conflate readiness with dependency probing and include side effects
- Category: operations
- Severity: medium
- Plan section: A11. Production Deployment Strategy (lines 1474-1483)
- Problem: The single `/health` endpoint is used for rollout gating but synchronously probes DB/Redis/queue and performs a Redis write, rather than separating liveness from readiness.
- Evidence: A11’s health route does `DB::connection()->getPdo()`, `Cache::store('redis')->put('health_ping', 1, 60)`, and `Queue::size()` in one endpoint, and rollout step 3e uses it for node admission.
- Why it matters: During partial dependency degradation, nodes can be marked unhealthy together and amplify an outage; stateful health checks also add noise and failure coupling.
- Suggested fix: Split checks into `livez` and `readyz`, keep liveness process-local, make readiness dependency-aware but side-effect free, and reserve deep diagnostics for operator-only endpoints.

### ISSUE-31: DB connection budgeting is not stated cluster-wide
- Category: architecture
- Severity: high
- Plan section: A7. Database Connection Budget + Pooling (lines 1197-1245), A11. Production Deployment Strategy (lines 1426-1460)
- Problem: A7 defines one connection budget and sets `max_connections = 200`, but does not say whether that budget is per node or for the whole cluster. A11’s rolling deploy implies multiple app nodes behind the LB.
- Evidence: A7 shows a single table totaling `~140` connections and one `pm.max_children=80`; A11 says “deploy one node at a time” but provides no cluster-wide connection formula or failover headroom.
- Why it matters: With 2+ app nodes, the stated limits can still overrun MySQL during normal traffic or during single-node failover.
- Suggested fix: Amend A7 to define per-node and cluster-wide formulas, include failover headroom, and gate rollout on measured DB connection utilization under load.

### VERDICT
- Status: REVISE
- Reason: The 15 accepted issues are addressed, but the updated supplementary plan still has a few important second-order gaps around Redis isolation, retry safety, recovery planning, health-check design, and cluster-wide connection sizing.