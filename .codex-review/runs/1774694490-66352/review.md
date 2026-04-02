ISSUE-27 through ISSUE-31 are substantively addressed. Remaining findings below are net-new.

### ISSUE-32: Rollout procedure still points to the old health endpoint
- Category: correctness
- Severity: medium
- Plan section: A11. Production Deployment Strategy (lines 1504-1565)
- Problem: The deploy runbook still tells operators to call `/api/v5/health` in step 3e, even though the section later says rollout admission must use `/readyz`.
- Evidence: Step 3e says `curl http://localhost:8002/api/v5/health → 200`, while the same section later states `Step 3e uses /readyz (not /health)`.
- Why it matters: During rollout, operators need one unambiguous endpoint. This contradiction is easy to copy into runbooks and reintroduces the exact health-check confusion A11 was meant to remove.
- Suggested fix: Update step 3e to `/readyz`, remove the old `/health` reference entirely, and keep `/health/detailed` operator-only.

### ISSUE-33: A7’s production connection formula conflicts with the sample MySQL config
- Category: correctness
- Severity: high
- Plan section: A7. Database Connection Budget + Pooling (lines 1217-1232)
- Problem: A7 correctly defines production targets of 350 and 550 connections, but the sample `my.cnf` still sets `max_connections = 200`.
- Evidence: The topology table lists `Production (min) = 350` and `Production (target) = 550`, while the Tier 1 config snippet below sets `max_connections = 200`.
- Why it matters: If the snippet is applied as written in production, the cluster-wide sizing fix is defeated and MySQL can still saturate under normal or failover load.
- Suggested fix: Parameterize `max_connections` by environment and make the sample values match the topology table, or explicitly label the `200` example as dev/staging only.

### ISSUE-34: Redis failover architecture is assumed but not actually defined
- Category: operations
- Severity: high
- Plan section: A9. Session Scaling (lines 1366-1436), A18. HA/DR (lines 1958-1975)
- Problem: The plan now drills Redis failover via Sentinel, but it never defines the Redis HA topology that Sentinel would manage.
- Evidence: A18 says to “stop primary, verify Sentinel promotes,” but nowhere in A9 or A18 does the plan define Redis primary/replica nodes, Sentinel count, or a managed Redis alternative.
- Why it matters: At 2000 users, sessions and queues are critical-path. A failover drill is not executable if the underlying HA architecture is still unspecified.
- Suggested fix: Extend A9/A18 with a concrete Redis HA design: either managed Redis with automatic failover, or explicit primary/replica plus 3 Sentinel nodes per critical Redis service, with connection strings and promotion rules.

### ISSUE-35: The backup runbook still defaults to dumping from the primary database
- Category: operations
- Severity: medium
- Plan section: A18. HA/DR — Backup, Recovery, Failover (lines 1932-1946)
- Problem: The backup script uses `mysqldump -h $DB_HOST`, which in this plan is the primary, and does not direct backups to the replica or a snapshot-based path.
- Evidence: A18’s cron example dumps from `$DB_HOST`; no line says backups should be offloaded to the replica when healthy.
- Why it matters: On a growing production MySQL 8 system, routine logical dumps from the primary add avoidable I/O pressure and operational risk.
- Suggested fix: Update A18 to prefer replica-based backups or physical snapshots/XtraBackup for production, and keep primary-host dumps as an emergency fallback only.

### VERDICT
- Status: REVISE
- Reason: ISSUE-27 through ISSUE-31 are fixed, but the latest revision still has a few important internal inconsistencies and under-specified operational details around rollout commands, production DB sizing, Redis HA, and backup execution.