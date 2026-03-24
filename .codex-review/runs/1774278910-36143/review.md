### ISSUE-1: Grace period is changing `continuity_status`, which contradicts the stated model
- Category: correctness
- Severity: high
- Plan section: `4.2 Xác định continuity_status` (lines 133-140)
- Problem: The plan classifies some positive-gap renewals as `CONTINUOUS` when they are within grace days. That conflicts with the plan’s own goal that `CONTINUOUS` means `gap=0`, `GAP` means `gap>0`.
- Evidence: Goal section says `CONTINUOUS (gap=0), EARLY (gap<0), GAP (gap>0)` (line 37), but section 4.2 says `if ($gapDays > 0 && $gapDays <= $graceDays) → 'CONTINUOUS'` (line 138).
- Why it matters: This can fail badge rendering, `gap_count`, and continuity KPI logic, and it blurs business meaning between “late but not penalized” and “actually continuous”.
- Suggested fix: Keep `continuity_status` purely date-based (`gap<0`, `gap=0`, `gap>0`) and apply grace only to `penalty_rate`, not to status.

### ISSUE-2: The 15-day / 5% example is not guaranteed by the proposed arithmetic
- Category: correctness
- Severity: high
- Plan section: `3.2 Migration: add_addendum_fields_to_integration_settings` and `4.3 Tính penalty_rate` (lines 85-93, 142-159)
- Problem: The plan uses `0.003333` per day, then asserts that 15 days equals exactly `0.05`, but `15 * 0.003333 = 0.049995` unless an explicit rounding rule is defined.
- Evidence: Setting value is `0.003333` (line 92); formula is `min($penaltyDays * $ratePerDay, $maxRate)` (line 153); example claims the result is `0.05` (lines 156-158).
- Why it matters: One acceptance criterion is exact: `penalty_rate = 5% when gap=15 days`. Without explicit decimal-rounding semantics, the plan can produce `4.9995%`, causing wrong `expected_amount`.
- Suggested fix: Add a plan-level rule for decimal precision and rounding order for `penalty_rate` before persistence and before schedule calculation.

### ISSUE-3: The plan does not define how parent-linked `DRAFT` contracts work when dates are missing
- Category: correctness
- Severity: high
- Plan section: `4.1`, `5.1`, `5.2` (lines 113-131, 197-203, 212-234)
- Problem: Existing CRUD allows `DRAFT` contracts without `effective_date`/`expiry_date`, but the plan computes renewal metadata immediately when `parent_contract_id` is present and does not define null-date behavior.
- Evidence: `computeGapDays(Contract $parent, string $addendumEffectiveDate): int` requires a date string (line 199), and `store()` says `if ($validated['parent_contract_id'] ?? null) { ... applyRenewalMetaToContract(...) }` (lines 215-219). Validation only adds `parent_contract_id` and `addendum_type` (lines 230-234); there is no rule for missing dates.
- Why it matters: This can break backward-compatible contract creation/update for `DRAFT` addenda or force hidden validation behavior not captured in the plan.
- Suggested fix: Specify one of two flows: either require the needed dates when `parent_contract_id` is set, or explicitly allow `DRAFT` addenda with deferred computation and define interim field values.

### ISSUE-4: The `store()` / `update()` integration plan is not implementable as written
- Category: sequencing
- Severity: high
- Plan section: `5.2 Sửa ContractDomainService` (lines 210-234)
- Problem: The `store()` snippet references `$contractId` before the contract is saved, and the `update()` section is only a placeholder comment rather than a concrete sequence.
- Evidence: `validateNoCircularParent($contractId, $parent->id)` appears “trước khi save” (lines 214-218), but no `$contractId` exists yet. `update()` only says `// re-trigger renewal meta computation nếu có parent` (lines 224-227).
- Why it matters: This leaves a key authoritative service integration undefined and increases the chance of inconsistent create/update behavior.
- Suggested fix: Rewrite the plan with a concrete create/update sequence, including when the contract exists, when validation runs, and when metadata is recomputed and persisted.

### ISSUE-5: There is no recomputation strategy when the parent or config changes after children already exist
- Category: correctness
- Severity: high
- Plan section: `4.1`, `5.1`, `5.2`, `9. Rủi ro & Mitigation` (lines 116-129, 204-205, 224-227, 397)
- Problem: `gap_days` depends on `parent.expiry_date`, and `penalty_rate` depends on settings, but the plan only mentions recomputing when the child’s own `effective_date` or `parent_contract_id` changes.
- Evidence: Formula uses `parent.expiry_date` (lines 116-129). `update()` only watches `effective_date` / `parent_contract_id` (lines 224-227). A `recalculate-penalty` endpoint is mentioned only as mitigation (line 397), not as part of the execution sequence.
- Why it matters: If the parent expiry date changes, or grace/rate settings change, existing addenda and schedules can become stale, which breaks continuity reporting and payment accuracy.
- Suggested fix: Add an explicit lifecycle policy for descendant recomputation and schedule refresh on parent-date changes and on settings changes, including whether it is synchronous, queued, or manual.

### ISSUE-6: Soft-delete handling is based on incorrect database semantics
- Category: correctness
- Severity: high
- Plan section: `3.1 Migration`, `9. Rủi ro & Mitigation` (lines 73-75, 396-399)
- Problem: The plan treats soft delete as if it would trigger `ON DELETE SET NULL`, but foreign-key `ON DELETE` only applies to hard deletes.
- Evidence: FK is `ON DELETE SET NULL` (line 75). Risk mitigation says `Parent contract bị xóa (soft delete) | ON DELETE SET NULL + UI warning` (line 398).
- Why it matters: With soft deletes on `contracts`, child rows will still keep `parent_contract_id`; chain traversal, validation, and UI can behave incorrectly if trashed parents are not handled explicitly.
- Suggested fix: Define soft-delete behavior explicitly in the plan: whether parent lookups use `withTrashed`, how chains serialize trashed ancestors, and whether addenda can still reference them.

### ISSUE-7: The plan does not include the required admin UI path for managing penalty config
- Category: scope
- Severity: high
- Plan section: `2. Acceptance Criteria`, `3.2`, `6. Frontend`, `7. Sequence` (lines 46, 85-93, 283-356)
- Problem: One acceptance criterion requires the config to be changeable via admin UI, but the implementation plan only inserts keys into `integration_settings` and does not plan any backend/frontend settings management work.
- Evidence: Acceptance says `Penalty config lưu trong integration_settings; có thể thay đổi qua admin UI` (line 46). Frontend sections 6.1-6.4 only cover contract list/modal/revenue view; sequence steps 9-13 contain no settings UI.
- Why it matters: Even if backend calculation works, the plan still would not satisfy the admin-configurability requirement.
- Suggested fix: Add a concrete settings-management slice to the plan: API read/write path, validation, permissions, and admin UI placement.

### ISSUE-8: Chain depth requirements are contradictory
- Category: scope
- Severity: medium
- Plan section: `2. Goals`, `9. Rủi ro & Mitigation` (lines 35, 401)
- Problem: The plan simultaneously says the chain has no level limit and also says depth should be capped at 5.
- Evidence: Goal 1 says `parent–child chain, không giới hạn cấp` (line 35). Risk mitigation says `Giới hạn chain depth = 5` (line 401).
- Why it matters: Validation, API response shape, UI timeline rendering, and circular-guard logic all depend on a single, consistent depth rule.
- Suggested fix: Choose one invariant and carry it through validation, API behavior, UI behavior, and tests.

### ISSUE-9: KPI definitions and frontend outcome are still ambiguous
- Category: correctness
- Severity: medium
- Plan section: `5.2 buildContractKpis()`, `6.2 ContractList.tsx`, `2. Acceptance Criteria` (lines 236-242, 311-315, 52)
- Problem: The plan does not fully lock down KPI semantics or UI delivery. `continuity_rate` excludes `EARLY`, and the frontend KPI section presents alternatives instead of one required implementation.
- Evidence: `continuity_rate => % phụ lục CONTINUOUS / (CONTINUOUS + GAP) * 100` (line 241). Frontend says `Hoặc giữ nguyên...` (line 315). Acceptance expects KPI correctness (line 52).
- Why it matters: Different implementers can ship different KPI numbers and UI, making acceptance subjective and regression-prone.
- Suggested fix: Define exact KPI formulas, denominator handling, treatment of `EARLY`, and one mandatory frontend KPI presentation.

### VERDICT
- Status: REVISE
- Reason: The plan has several high-severity correctness and sequencing gaps around status semantics, decimal math, CRUD compatibility, recomputation lifecycle, soft deletes, and missing admin-config work, so it is not implementation-ready yet.