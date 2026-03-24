### ISSUE-1: Invoice-schedule cardinality is contradictory
- Category: correctness
- Severity: critical
- Plan section: 2. Phân tích hiện trạng; 4.2. Bảng `invoice_items`; 4.5. Thêm cột vào `payment_schedules`; 5.4. `bulkGenerate()`; Appendix A
- Problem: The plan states one payment schedule may map `1:1 hoặc 1:N` to invoices, but the proposed schema only supports a single `invoice_id` on each `payment_schedule`.
- Evidence: "`payment_schedules` | Kỳ thanh toán — mỗi kỳ có thể map 1:1 hoặc 1:N với hóa đơn"; "`ALTER TABLE payment_schedules ADD COLUMN invoice_id`"; "`payment_schedule_id` BIGINT ... NULL" on `invoice_items`.
- Why it matters: The core invoice-generation and reconciliation model is undefined. Split invoicing, partial issuance, and future reconciliation rules cannot be made consistent on top of a contradictory cardinality.
- Suggested fix: Lock the plan to one canonical relationship model and update schema, workflow, API, and reporting sections so they all reflect the same invoice↔schedule cardinality.

### ISSUE-2: Receipt reconciliation only covers the create happy path
- Category: correctness
- Severity: high
- Plan section: 4.3. Bảng `receipts`; 5.3. Controller; 5.5. `ReceiptDomainService`; 16.1. Backend Feature Tests
- Problem: The plan defines reconciliation only for receipt creation, but not for receipt update, delete, reject, reverse, or advance-payment reallocation.
- Evidence: "`4. Update invoice.paid_amount += receipt.amount`"; receipt statuses include "`CONFIRMED | PENDING_CONFIRM | REJECTED | REVERSED`"; controller includes `receiptUpdate` and `receiptDestroy`; tests only cover partial/full payment on create.
- Why it matters: `paid_amount`, `outstanding`, invoice status, and `payment_schedules` will drift as soon as a receipt is edited, deleted, reversed, or re-assigned. That directly threatens acceptance criterion 3.
- Suggested fix: Expand the plan with a full reconciliation lifecycle, including rollback rules, state transitions, and source-of-truth behavior for create/update/delete/reverse/advance receipts.

### ISSUE-3: Invoice code generation is not actually thread-safe
- Category: risk
- Severity: high
- Plan section: 5.4. `generateInvoiceCode()`; Appendix C
- Problem: The plan claims thread safety while using `SELECT MAX + 1`, which is still race-prone under concurrent writers.
- Evidence: "`Thread-safe: SELECT MAX + 1 within transaction`"; Appendix C uses `->max('invoice_code')` then increments the suffix.
- Why it matters: Concurrent invoice creation can still produce duplicate codes and fail on the unique key, creating intermittent production errors in a core CRUD flow.
- Suggested fix: Change the plan to use a deterministic sequence-allocation strategy and require concurrency-focused tests for code generation.

### ISSUE-4: Aging bucket definition is internally inconsistent
- Category: correctness
- Severity: high
- Plan section: 3. Kiến trúc tổng quan; 5.7. `DebtAgingReportService`; 11.1. Aging Report Table
- Problem: The overview says the aging report has "4 buckets" while listing five segments, and later sections implement five.
- Evidence: "`Aging report: 4 buckets (hiện tại, 1-30 ngày, 31-60, 61-90, >90)`"; later query defines `current`, `1-30`, `31-60`, `61-90`, `>90`.
- Why it matters: This creates avoidable UI/API/test drift, and it conflicts with the acceptance criterion that explicitly requires 5 buckets.
- Suggested fix: Normalize the plan everywhere to a single 5-bucket definition and keep the same labels in UI, API payloads, and tests.

### ISSUE-5: Dashboard KPI math mixes period flows with balance metrics
- Category: correctness
- Severity: high
- Plan section: 5.6. `FeeCollectionDashboardService`
- Problem: The dashboard defines `outstanding` as `expected - actual` for the selected period, which is not the same as current receivable balance.
- Evidence: "`expected_revenue — Tổng tiền hóa đơn phát hành trong kỳ`"; "`actual_collected — Tổng phiếu thu confirmed trong kỳ`"; "`outstanding — expected - actual`".
- Why it matters: Period receipts may settle older invoices, so this KPI can understate, overstate, or even go negative relative to real open debt. KPI cards and charts would mislead users.
- Suggested fix: Split the plan into period-flow KPIs and balance KPIs, and define outstanding from open invoice balances rather than period issued minus period collected.

### ISSUE-6: The backend plan does not follow the established V5 conventions
- Category: architecture
- Severity: high
- Plan section: 4. Database Design; 5.2. Service Layer; 5.3. Controller; 12.3. Data scope
- Problem: The plan says it follows existing domain patterns, but the proposed structure bypasses several of them.
- Evidence: Services are placed under "`app/Services/V5/FeeCollection/`"; controller is shown as "`class FeeCollectionController extends Controller`"; method signatures return `array`; migrations are specified as bare `CREATE TABLE` / `ALTER TABLE`.
- Why it matters: This conflicts with the stated constraints around Domain Services, `V5DomainSupportService`, schema guards, scoped reads, and the existing V5 controller pattern. That increases integration risk before implementation even starts.
- Suggested fix: Rewrite the architecture section so it explicitly adopts the existing V5 controller/service/migration conventions as required plan constraints, not optional implementation details.

### ISSUE-7: Audit coverage does not satisfy "all mutations"
- Category: correctness
- Severity: high
- Plan section: 5.1. Models; 5.4. `InvoiceDomainService`; 5.5. `ReceiptDomainService`; 15. Phase 4
- Problem: The plan only guarantees audit for invoices and receipts, leaving gaps for dunning actions and nested item mutations.
- Evidence: Model matrix marks "`InvoiceItem` ... Audit ❌" and "`DunningLog` ... Audit ❌"; only invoice/receipt flows explicitly say "`Audit log`".
- Why it matters: Bulk invoice generation, item sync, dunning reminders, reversals, and other mutations would not be fully traceable, violating acceptance criterion 8.
- Suggested fix: Add explicit audit requirements for every mutation path, including nested item sync, dunning CRUD, bulk generation, reversals, and soft deletes.

### ISSUE-8: Overdue status refresh is not concretely planned
- Category: sequencing
- Severity: medium
- Plan section: Appendix B; 8. Dashboard; 9. Danh sách Hóa đơn; 11. Báo cáo Công nợ; 15. Phased Rollout
- Problem: The plan depends on `OVERDUE` status across filters, KPIs, and reports, but does not commit to a concrete refresh mechanism or rollout step.
- Evidence: "`ISSUED → OVERDUE: job/query khi due_date < today && paid_amount < total_amount`"; no scheduler/job/query-refresh task appears in the rollout phases.
- Why it matters: Overdue lists, dashboard widgets, and debt reporting will become stale or inconsistent if different endpoints infer overdue differently.
- Suggested fix: Choose one overdue-evaluation strategy in the plan now, assign it to a phase, and require all dependent endpoints to use the same rule.

### VERDICT
- Status: REVISE
- Reason: The plan has multiple unresolved correctness issues in the invoice/schedule model, receipt reconciliation, KPI definitions, and platform-pattern alignment, so it is not implementation-safe yet.