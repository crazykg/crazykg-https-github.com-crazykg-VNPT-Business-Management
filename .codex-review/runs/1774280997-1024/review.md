### ISSUE-1: Strict 1:1 cardinality is still contradicted by bulk generation
- Category: correctness
- Severity: high
- Plan section: 2. Điểm kết nối với module Thu Cước; 4.5. Thêm cột vào `payment_schedules`; 5.4. `bulkGenerate()`
- Problem: The plan now claims strict `payment_schedule ↔ invoice` 1:1, but `bulkGenerate()` still groups schedules by `contract_id` and creates one invoice per group.
- Evidence: "`payment_schedules` | ... quan hệ **1:1 với invoice**"; "`Quan hệ **1:1** — mỗi payment_schedule liên kết tối đa 1 invoice`"; "`bulkGenerate()` ... `Group by contract_id` ... `For each group: create invoice`."
- Why it matters: If one contract has multiple pending schedules in the selected range, the current logic collapses multiple schedules into one invoice, which breaks the stated 1:1 model and leaves reconciliation semantics unclear again.
- Suggested fix: Make `bulkGenerate()` align with the declared cardinality by generating per-schedule invoices, or explicitly change the cardinality model everywhere to invoice→many schedules.

### ISSUE-2: Receipt reversal logic conflicts with the new idempotent reconciliation model
- Category: correctness
- Severity: critical
- Plan section: 5.5. `ReceiptDomainService`
- Problem: The revised reverse flow both marks the original receipt as `REVERSED` and creates a new negative `CONFIRMED` receipt, while `reconcileInvoice()` sums only `CONFIRMED` receipts.
- Evidence: "`Set receipt.status = REVERSED`"; "`Create new receipt with negative amount, status = CONFIRMED`"; "`Source of truth: SUM(amount) FROM receipts WHERE ... status = 'CONFIRMED'`."
- Why it matters: After reversal, the original positive receipt is excluded from the sum, and the new negative receipt is included, which drives the net total below zero instead of back to zero. The same section also describes update/destroy as manual rollback/apply, which conflicts with the stated “recalculate from SUM(receipts)” model.
- Suggested fix: Rewrite update/destroy/reverse so they only mutate receipt records, then call `reconcileInvoice()` on affected invoices. For reversal, choose one mechanism: either mark the original receipt reversed or add an offsetting negative confirmed receipt, not both.

### ISSUE-8: The overdue strategy is still internally inconsistent
- Category: correctness
- Severity: high
- Plan section: 5.5. `reconcileInvoice()`; 5.8. Overdue Status Refresh; Appendix B
- Problem: The plan says query-time overdue evaluation is the only strategy, but other sections still persist or transition invoice status to `OVERDUE`.
- Evidence: In `reconcileInvoice()`: "`paid_amount = 0 AND due_date < today → OVERDUE`"; in §5.8: "`Dùng query-time evaluation ... đây là chiến lược duy nhất`" and "`Nếu backend trả status = 'ISSUED' ... badge hiển thị OVERDUE`"; Appendix B: "`ISSUED → OVERDUE: job/query`."
- Why it matters: List filters, action guards, badges, and reporting can diverge depending on whether `OVERDUE` is persisted, computed, or both. That directly affects invoice filtering and dashboard/debt-report consistency.
- Suggested fix: Pick one overdue contract and enforce it across `reconcileInvoice()`, serialization, filters, workflow appendix, and UI action conditions. If query-time is the choice, stop persisting `OVERDUE` in service logic.

### ISSUE-9: Debt trend calculation is still left undecided
- Category: correctness
- Severity: medium
- Plan section: 5.7. `DebtAgingReportService`
- Problem: The plan still leaves the core debt-trend method unspecified.
- Evidence: "`debtTrend()` ... `Logic: snapshot-based hoặc point-in-time calculation`."
- Why it matters: The trend line can produce materially different numbers depending on the chosen method, and performance/indexing/test expectations also change. The current plan is not deterministic enough for implementation.
- Suggested fix: Lock the plan to one debt-trend calculation method and define its exact query basis, month cutoff rule, and test expectations.

### VERDICT
- Status: REVISE
- Reason: Most of the earlier issues were improved, but the updated plan still has unresolved contradictions in invoice cardinality, receipt reversal/reconciliation, overdue handling, and debt-trend definition.