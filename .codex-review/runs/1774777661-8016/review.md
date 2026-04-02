### ISSUE-1: Feature-table fallback no longer matches the guard matrix
- Category: correctness
- Severity: medium
- Plan section: §3.4 lines 124-125, §5.2 lines 421-433
- Problem: The guard matrix promises two distinct graceful-degradation behaviors for feature data, but the service snippet collapses them into one combined check.
- Evidence: §3.4 says missing `product_feature_groups` => `feature_groups: []`, while missing `product_features` => `feature_groups[].features: []`; §5.2 uses one condition: `if ($this->support->hasTable('product_feature_groups') && $this->support->hasTable('product_features'))`.
- Why it matters: If `product_feature_groups` exists but `product_features` does not, the plan no longer returns the fallback shape it explicitly promised.
- Suggested fix: Align §5.2 with §3.4 by guarding the two tables independently and showing both fallback branches in the service flow.

### ISSUE-2: Cache invalidation matrix still misses stale `/insight` paths
- Category: architecture
- Severity: high
- Plan section: §9.2 lines 696-700
- Problem: The invalidation matrix only clears product-detail caches on product updates, and it only mentions `product_target_segments` seed/import rather than normal write paths.
- Evidence: Line 698 invalidates only `v5:customer-insight:*:pd:{pid}:v1` for product updates; line 700 lists `product_target_segments seed/import`, not ongoing CRUD/update paths.
- Why it matters: `/insight` also contains product name/price/description and targeted/popular recommendations. Product edits or target-segment edits can leave cached `/insight` responses stale.
- Suggested fix: Add explicit `/insight` invalidation for product updates and for every `product_target_segments` write path, even if the chosen policy is a broad flush.

### ISSUE-4: Winner-selection rule and SQL ordering still disagree
- Category: correctness
- Severity: high
- Plan section: §4.2b lines 191-195, §4.3 lines 268-276
- Problem: The documented winner-selection precedence does not match the actual `ORDER BY` in the MySQL 8 snippet.
- Evidence: The rule says `1. Lowest priority`, `2. exact facility_type match`; the SQL orders `CASE WHEN pts.facility_type = ... THEN 0 ELSE 1 END` before `pts.priority`.
- Why it matters: The implementation can pick a different winner than the stated algorithm, which makes ranking behavior inconsistent and hard to validate.
- Suggested fix: Make the SQL ordering exactly mirror the written precedence, or revise the written rule so both sections describe the same ranking logic.

### VERDICT
- Status: REVISE
- Reason: The round-2 fixes are largely present, but there are still three material inconsistencies around schema fallback behavior, cache invalidation coverage, and winner-selection ordering.