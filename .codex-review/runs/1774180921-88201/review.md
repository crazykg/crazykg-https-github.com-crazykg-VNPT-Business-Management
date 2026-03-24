### ISSUE-9: SQLite-safe date logic is still not propagated consistently
- Category: correctness
- Severity: medium
- Plan section: `### 4.2. SQL Logic chính`, `### 4.4. Schema guards`, `#### Row 5: Chi tiết đợt quá hạn` (lines 222-228, 345-360, 695-706)
- Problem: The plan adds portable `$dateDiffExpr`/`$curDateExpr` in the guard section, but other SQL examples still show raw MySQL-only `DATEDIFF(...)` and `CURDATE()`.
- Evidence: `avg_days_to_collect` still shows `AVG(DATEDIFF(ps.actual_paid_date, ps.expected_date))` and overdue SQL still shows `DATEDIFF(CURDATE(), ps.expected_date)`, while section 4.4 defines the SQLite-safe abstractions.
- Why it matters: The plan is still internally contradictory. A developer following the concrete SQL examples instead of the abstraction block can reintroduce the SQLite breakage the plan claims to have fixed.
- Suggested fix: Replace all remaining raw MySQL date-function examples with the abstracted expressions, or explicitly label those snippets as MySQL-only and provide the SQLite form beside them.

### ISSUE-11: Item revenue allocation can drift from contract totals
- Category: correctness
- Severity: high
- Plan section: `### 4.2. SQL Logic chính` (lines 246-258)
- Problem: The allocation formula divides each item’s `line_total` by `$contract->value` instead of by the sum of all item `line_total` values for that contract.
- Evidence: The plan says `$contractValue = max($contract->value, 1)` and then `$proportion = $item['line_total'] / $contractValue`.
- Why it matters: If contract header value differs from the sum of contract items, the proportions will not sum to 100% and allocated expected/actual/outstanding will not reconcile to contract-level revenue. The existing contract shape already has both `value` and `total_value` in [types.ts](/Users/pvro86gmail.com/Downloads/QLCV/frontend/types.ts#L1805), so this ambiguity is real.
- Suggested fix: Define the allocation denominator as `sum(line_total)` across the contract’s items, then specify rounding and remainder handling so allocated item totals always reconcile exactly to the parent contract totals.

### VERDICT
- Status: REVISE
- Reason: The plan is close, but it still has one portability inconsistency and one material allocation-formula gap that can produce incorrect item-level revenue numbers.