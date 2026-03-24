### ISSUE-2: Receipt reversal still produces the wrong net balance
- Category: correctness
- Severity: critical
- Plan section: 5.5. ReceiptDomainService
- Problem: The revised reverse flow still excludes the original positive receipt from the reconciliation sum while keeping only the new negative receipt in scope.
- Evidence: "`Create new receipt` ... `negative amount` ... `status = CONFIRMED`"; "`Set original receipt.status = REVERSED (excluded from SUM by status filter)`"; "`Source of truth: SUM(amount) ... status = 'CONFIRMED'`."
- Why it matters: After reversal, the confirmed-sum no longer contains the original positive amount, so the invoice balance goes negative instead of back to zero. The explanatory note claims “net zero effect,” but the stated rules do not produce that result.
- Suggested fix: Revise the plan so reversal uses exactly one accounting pattern consistently. Either keep the original receipt confirmed and add a negative confirmed offset, or mark the original reversed and do not create a second negative receipt that is included in the confirmed sum.

### ISSUE-8: The overdue model is still inconsistent across schema, filters, and UI
- Category: correctness
- Severity: high
- Plan section: 4.1. Bảng `invoices`; 5.8. Overdue Status Refresh; 6.2. Types; 6.5. URL State Sync; 9.1-9.3. Danh sách Hóa đơn
- Problem: The plan says `OVERDUE` is no longer persisted and should be handled through `is_overdue` / `filter_overdue=true`, but multiple sections still treat it as a stored status.
- Evidence: In schema: "`COMMENT 'DRAFT | ISSUED | PARTIAL | PAID | OVERDUE | CANCELLED | VOID'`"; in §5.8: "`Status column trong DB KHÔNG BAO GIỜ = 'OVERDUE'`" and "`?filter_overdue=true`"; in UI examples: "`fc_status=OVERDUE`", filter options include "`OVERDUE`", and actions use "`status ∈ {ISSUED, PARTIAL, OVERDUE}`".
- Why it matters: Backend filters, serialized payloads, table badges, URL state, and action guards now have conflicting contracts. That will cause broken filtering and inconsistent behavior around overdue invoices.
- Suggested fix: Normalize the whole plan to one overdue contract: remove `OVERDUE` from persisted schema/status lists and rewrite all filter/action/UI examples to use `is_overdue` / `filter_overdue=true`.

### ISSUE-9: The debt-trend formula is still not aligned with invoice-based outstanding
- Category: correctness
- Severity: high
- Plan section: 5.7. DebtAgingReportService
- Problem: The chosen point-in-time formula subtracts all confirmed receipts by date, without constraining them to receipts actually allocated to the invoices counted in the numerator.
- Evidence: "`outstanding_eom = SUM(invoices.total_amount) - SUM(receipts.amount WHERE receipt_date <= last_day_of(M))`"; the receipt-side query only filters by `receipt_date`, `status`, and `deleted_at`.
- Why it matters: Advance receipts (`invoice_id = NULL`), reversal entries, and receipts unrelated to the included invoice set can distort historical debt. That makes the trend inconsistent with the module’s invoice-based outstanding logic.
- Suggested fix: Define the trend from invoice-level balances as of month-end, or explicitly limit the receipt subtraction to receipts allocated to eligible invoices up to that cutoff.

### ISSUE-10: The high-level dashboard summary still says 6 KPI cards
- Category: scope
- Severity: low
- Plan section: 3. Kiến trúc tổng quan; 8.1. KPI Cards
- Problem: The overview section still describes the dashboard as having 6 KPI cards, while the detailed dashboard section and acceptance criteria require 7.
- Evidence: In §3: "`6 KPI cards`"; in §8.1: "`7 thẻ, 2 hàng: 4 period-flow + 3 balance`."
- Why it matters: The plan still has two different UI contracts for the same screen, which creates avoidable implementation drift.
- Suggested fix: Update the overview section so every dashboard reference consistently states 7 KPI cards.

### VERDICT
- Status: REVISE
- Reason: The plan is close, but receipt reversal math, overdue handling, and debt-trend calculation still have correctness gaps, and the dashboard summary remains internally inconsistent.