### ISSUE-9: debtTrend reversal handling is still self-contradictory
- Category: correctness
- Severity: high
- Plan section: 5.7. DebtAgingReportService
- Problem: The updated debt-trend formula both excludes reversal offsets from the receipt sum and says those same negative offsets are included to make the net math correct.
- Evidence: "`AND r.is_reversal_offset = FALSE ← only count positive receipts net`" and immediately after: "`SUM(r.amount) ... includes both positive and negative confirmed receipts → net math is correct.`"
- Why it matters: The plan still has two incompatible formulas for the same KPI. One overstates outstanding after reversals; the other is the intended net calculation. This leaves the report logic non-deterministic again.
- Suggested fix: Keep one receipt-sum rule only. If reversal offsets are part of the accounting model, the debt-trend formula must include them consistently and remove the `is_reversal_offset = FALSE` condition.

### ISSUE-11: Receipt reversal fields are used in logic/types but not defined consistently in the schema
- Category: architecture
- Severity: high
- Plan section: 4.3. Bảng `receipts`; 5.5. ReceiptDomainService; 6.2. Types
- Problem: The reversal design now depends on `is_reversed`, `is_reversal_offset`, and `original_receipt_id`, but the receipts table definition still lacks those columns and still documents a `REVERSED` status that the new model says should not exist.
- Evidence: In schema: "`COMMENT 'CONFIRMED | PENDING_CONFIRM | REJECTED | REVERSED'`"; in service logic: "`Mark original receipt.is_reversed = true`", "`original_receipt_id = receipt.id`", "`is_reversal = true`"; in types: "`No REVERSED status`", plus `is_reversed`, `is_reversal_offset`, `original_receipt_id`.
- Why it matters: The backend model, migration plan, and frontend contract no longer describe the same persisted receipt shape. That makes the reversal flow impossible to implement cleanly and will break validation/serialization assumptions.
- Suggested fix: Update the database design and migration plan to add the reversal-tracking columns, remove the stale `REVERSED` status from the receipt schema contract, and normalize the field name to one canonical key (`is_reversal_offset` or equivalent) across schema, service logic, and types.

### VERDICT
- Status: REVISE
- Reason: The plan is close, but the debt-trend formula and the receipt-reversal data contract still contain hard contradictions that would cause incorrect implementation.