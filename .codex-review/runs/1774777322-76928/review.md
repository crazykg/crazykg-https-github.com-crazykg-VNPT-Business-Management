### ISSUE-1: Guard matrix is not propagated into the implementation snippets
- Category: sequencing
- Severity: high
- Plan section: §3.4 (lines 114-128), §4.3 (lines 238-244), §5.2 (lines 392-400)
- Problem: The plan now defines the required `hasTable()`/`hasColumn()` matrix, but the concrete service snippets still show direct queries against guarded columns/tables without those checks.
- Evidence: §3.4 says every dependency must have guards; later snippets still do `select('customer_sector', 'healthcare_facility_type', 'bed_capacity')` and query `product_feature_groups` / `product_features` directly.
- Why it matters: Acceptance criterion 6 is about the implemented flow, not only a policy table. A developer following §4.3 and §5.2 literally can still ship unguarded SQL.
- Suggested fix: Update the main implementation snippets to include the guard branches, or explicitly mark them as partial pseudocode and cross-reference the guard matrix as mandatory.

### ISSUE-2: Cache invalidation is still internally inconsistent and not fully concrete
- Category: architecture
- Severity: high
- Plan section: §5.3 (lines 418-423), §9.2-§9.3 (lines 659-687)
- Problem: The plan adds a broader invalidation matrix, but it still contains conflicting cache rules and relies on wildcard `Cache::forget()` / `Cache::flush('pattern')` style descriptions rather than one concrete invalidation mechanism.
- Evidence: §5.3 still says detail cache is invalidated only on `product update, feature catalog update`; §9.2 uses wildcard keys like `v5:customer-insight:{cid}:*` with `Cache::forget()`; line 663 says `Cache::flush('v5:customer-insight:*')`; §9.3 then switches to `Cache::tags()` or `SCAN + DEL`.
- Why it matters: Acceptance criterion 5 asks for proper invalidation. As written, the plan still leaves room for stale cache behavior or an implementation path that does not actually work.
- Suggested fix: Make §9 the single source of truth and replace wildcard `Cache::forget/flush` pseudo-APIs with one Redis-compatible strategy, then remove the conflicting cache guidance from §5.3.

### ISSUE-4: The multi-match fix regressed in the main algorithm snippet
- Category: correctness
- Severity: high
- Plan section: §4.2b (lines 198-223), §4.3 (lines 249-277)
- Problem: The plan says the `MIN/MAX` aggregation bug is fixed, but the actual `buildUpsellCandidates()` snippet still uses the old aggregate approach.
- Evidence: §4.2b says to replace `MIN(priority) + MAX(sales_notes)` with winner-row selection via `ROW_NUMBER()`; §4.3 still shows `MIN(pts.priority) as segment_priority` and `MAX(pts.sales_notes) as sales_notes`.
- Why it matters: This reintroduces the exact inconsistency the plan claimed to remove: priority can come from one segment row while `sales_notes` comes from another.
- Suggested fix: Rewrite the §4.3 targeted-query snippet so it joins the winner-segment subquery and removes the old aggregate fields entirely.

### ISSUE-7: The winner-selection section includes a MySQL-incompatible path
- Category: correctness
- Severity: medium
- Plan section: §4.2b (lines 198-223)
- Problem: The proposed winner-selection implementation mentions `DISTINCT ON product_id`, which is not supported by MySQL 8.
- Evidence: Line 222 says `DISTINCT ON product_id (hoặc GROUP BY + trick)`.
- Why it matters: The target stack is MySQL 8. Including a PostgreSQL-only construct, plus a vague `GROUP BY + trick` fallback, makes the implementation guidance unreliable.
- Suggested fix: Narrow the plan to one MySQL-8-supported approach only, such as a `ROW_NUMBER()` subquery with `rn = 1`, and remove DB-incompatible alternatives.

### VERDICT
- Status: REVISE
- Reason: The accepted fixes are present, but several sections still contradict them, especially around schema-guard implementation, cache invalidation, and the winner-selection query.