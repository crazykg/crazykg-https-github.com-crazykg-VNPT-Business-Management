ISSUE-12 through ISSUE-35 are otherwise substantively addressed. One remaining net-new gap stands out.

### ISSUE-36: Traffic admission still relies on liveness and misses the session-store dependency
- Category: operations
- Severity: high
- Plan section: A9. Session Scaling — Multi-Node Sanctum (lines 1366-1436), A11. Production Deployment Strategy (lines 1538-1565)
- Problem: After splitting Redis roles, the plan still says the load balancer uses `/livez`, while `/readyz` checks DB, cache, and queue but not the separate session Redis connection introduced in A9.
- Evidence: A11 says `/livez` is “used by k8s/LB” and “LB uses `/livez` for keepalive.” The `/readyz` example probes `DB::select('SELECT 1')`, `Cache::store('redis')->get(...)`, and `Queue::size()`, but there is no probe for the `session` Redis connection from A9.
- Why it matters: At 2000 users, a node can be process-alive but unable to serve authenticated traffic if the session Redis path is degraded. With LB routing based on liveness, that node can stay in rotation and produce avoidable auth/session failures.
- Suggested fix: Use `/readyz` for LB traffic admission, reserve `/livez` for process supervision only, and add an explicit readiness probe for the `session` Redis connection alongside DB/cache/queue checks.

### VERDICT
- Status: REVISE
- Reason: The latest revision closes ISSUE-32 through ISSUE-35, but readiness/liveness wiring is still incomplete for the multi-Redis topology and remains a real production risk.