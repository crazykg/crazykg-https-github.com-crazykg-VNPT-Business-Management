### ISSUE-10: Test-mode cache invalidation is still semantically incorrect
- Category: correctness
- Severity: medium
- Plan section: Phase 3B: CacheService Abstraction (lines 355-401); Verification Plan (lines 1179-1186)
- Problem: The updated cache abstraction avoids tag-driver crashes, but it does not preserve invalidation behavior in the `array` test driver, and the verification step still assumes Redis activity during the test suite.
- Evidence: `flushTags()` is a no-op for array/file drivers (`TTL handles expiry in non-prod`), while verification still says `redis-cli monitor during test suite`.
- Why it matters: Any test that reads cached data, mutates the underlying model, and reads again can observe stale results for the full TTL, and Redis monitoring will show nothing when tests are using the array cache driver.
- Suggested fix: Define test behavior explicitly: either disable caching by default in tests, or add a driver-neutral invalidation mechanism for tests; move Redis hit/miss verification to a dedicated Redis-backed integration run.

### ISSUE-11: Sparse fieldsets remain too generic for a no-breaking-change rollout
- Category: correctness
- Severity: medium
- Plan section: Phase 8C: Backend Payload Trimming — Sparse Fieldsets (lines 985-1006)
- Problem: The fieldset design uses raw table-column introspection and `select($requested)` without endpoint-specific allowlists or compatibility gates.
- Evidence: The plan uses `Schema::getColumnListing($table)`, intersects arbitrary `fields`, then applies `$query->select($requested)`, and instructs the frontend to send `?fields=id,invoice_code,status,total_amount,due_date`.
- Why it matters: This can drop columns needed for eager loading, computed fields, service serializers, sorting, or existing frontend assumptions, and it can expose unintended columns merely because they exist in the table.
- Suggested fix: Replace table-wide introspection with endpoint-level field allowlists and add parity tests before enabling `fields=` on any list endpoint.

### VERDICT
- Status: REVISE
- Reason: The major prior issues were addressed, but the plan still has two correctness gaps around cache behavior in the mandated test environment and the safety of the sparse-fieldset rollout.