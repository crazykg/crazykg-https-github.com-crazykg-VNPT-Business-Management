### ISSUE-1: KPI count does not meet acceptance
- Category: correctness
- Severity: high
- Plan section: `## 2. Kiến trúc tổng quan`, `### 7.3 Row 1` (lines 31-37, 444-454)
- Problem: Plan only renders 5 KPI cards plus 3 mini badges, so the revenue view exposes 8 KPIs, not the required 10.
- Evidence: Plan says revenue view has "`5 KPI cards doanh thu`" and Row 1 defines 5 cards + 3 badges, while response `kpis` includes 10 fields.
- Why it matters: Acceptance criterion `(2)` can fail even if backend returns all metrics; `overdue_count` and `cumulative_collected` are not placed anywhere.
- Suggested fix: Map all 10 KPI fields to explicit UI slots and state which two currently-unused KPIs will be shown.

### ISSUE-2: `grouping=quarter` is declared but not designed
- Category: correctness
- Severity: high
- Plan section: `### 4.1. Service mới`, `### 4.2. SQL Logic chính`, `### 4.4. Schema guards`, `### 7.2`, `### 8` (lines 67-71, 151-165, 216-221, 423-439, 456-517)
- Problem: The plan accepts `grouping=quarter` and adds a month/quarter toggle, but all aggregation logic shown is monthly only.
- Evidence: SQL uses `DATE_FORMAT(..., '%Y-%m')` / `strftime('%Y-%m', ...)`; sample `period_key` is `"2026-01"` and `period_label` is monthly.
- Why it matters: The quarter toggle can only be cosmetic unless backend period bucketing, labels, and ordering are specified for both MySQL and SQLite.
- Suggested fix: Add concrete quarterly aggregation expressions, quarter labels, sort keys, and response examples for both DB drivers.

### ISSUE-3: Carry-over math is underdefined for the cumulative view
- Category: correctness
- Severity: high
- Plan section: `### 4.2. SQL Logic chính`, `### Q2` (lines 168-177, 546-547)
- Problem: Plan defines one opening `carry_over_from_previous` query, but does not define how that value feeds `by_period.carry_over`, `cumulative_expected`, or `cumulative_actual`.
- Evidence: "`carry_over` — sum of unpaid schedules trước `period_from`" and "`cumulative` — tính trên application (PHP loop cộng dồn từng period)`", then Q2 claims the line chart answers "`hiện tại + mang sang`".
- Why it matters: The core business question can be answered incorrectly if cumulative series only sum in-range rows and never roll forward opening debt.
- Suggested fix: Specify the exact roll-forward formula per period: opening carry-over, in-period expected, collections, overdue movement, and closing carry-over.

### ISSUE-4: Item drill-down is a contract composition view, not item-level revenue
- Category: correctness
- Severity: critical
- Plan section: `### 4.2. SQL Logic chính`, `#### Row 4` (lines 189-198, 469-474)
- Problem: `by_item` only returns `quantity`, `unit_price`, `line_total`, and `proportion`; it does not define expected/actual/outstanding revenue per item for the selected period.
- Evidence: SQL for `by_item` selects only contract item master data, and the UI columns are "`Product | ĐVT | SL | Đơn giá | Thành tiền | Tỷ trọng`".
- Why it matters: Acceptance criterion `(4)` and the original request ask for item-level revenue drill-down, not just contract item value breakdown.
- Suggested fix: Define a revenue allocation method from `payment_schedules` to `contract_items` using the existing schema, then expose per-item expected/actual/outstanding for the chosen period.

### ISSUE-5: Shared period selector conflicts with backward compatibility
- Category: architecture
- Severity: high
- Plan section: `## 2. Kiến trúc tổng quan`, `### 6.3. Shared header layout`, `### 6.4. Conditional render` (lines 26-27, 349-399)
- Problem: The plan says the selector is shared across both views and default contracts logic stays unchanged, but it does not define whether the shared control means signing-date filtering, revenue-date filtering, or two different semantics behind one UI.
- Evidence: "`Shared header: tiêu đề + period selector + view toggle`", "`[VIEW: CONTRACTS] ← default, giữ nguyên logic hiện tại`", and `<PeriodSelector ... />`.
- Why it matters: This is where acceptance `(1)` and `(3)` can conflict; the contracts subview can regress or become semantically inconsistent.
- Suggested fix: Define the selector contract explicitly: shared preset state only vs shared component, what dates it controls in each view, and what must remain unchanged in the contracts subview.

### ISSUE-6: Overdue table bypasses the shared period and backend analytics
- Category: correctness
- Severity: medium
- Plan section: `#### Row 5: Chi tiết đợt quá hạn` (lines 476-479)
- Problem: The overdue table is sourced from raw frontend `paymentSchedules` instead of the analytics endpoint, with no stated filter by `periodFrom/periodTo`.
- Evidence: "`Lọc từ `paymentSchedules.filter(s => s.status === 'OVERDUE')` (frontend, đã có sẵn)`".
- Why it matters: The revenue screen can show KPI/chart numbers for one period and overdue rows from all time, so the shared selector is not truly shared.
- Suggested fix: Move overdue-detail data into the analytics response and define it as filtered by the same selected period.

### ISSUE-7: Backend wiring is incomplete for the current service pattern
- Category: sequencing
- Severity: medium
- Plan section: `## 3. Files cần tạo/sửa`, `### 4.3. Route + Controller` (lines 46-48, 202-211)
- Problem: Plan adds a new service and controller method calling `$this->revenueService`, but does not describe constructor wiring, facade/domain-service integration, or any required route-binding updates.
- Evidence: Files list adds `ContractRevenueAnalyticsService.php` and `ContractController.php`, while controller example directly calls `$this->revenueService->analytics($request)`.
- Why it matters: The plan is not implementation-ready; the dependency path and ownership inside the existing contract domain layer are left ambiguous.
- Suggested fix: Add an explicit wiring step showing where the new service is injected and how the contract domain/controller flow is extended.

### ISSUE-8: Verification plan does not prove acceptance
- Category: risk
- Severity: medium
- Plan section: `## 11. Verification (Kiểm tra)` (lines 559-568)
- Problem: Verification only runs `php artisan test --filter=Contract` and `npm run lint`, which is weaker than “all existing tests pass” and does not guarantee TypeScript compilation.
- Evidence: Steps 1-2 are exactly "`php artisan test --filter=Contract`" and "`npm run lint`".
- Why it matters: Acceptance criteria `(5)` and `(6)` can still fail after these checks, especially for route bindings, SQLite compatibility, and actual TS type errors.
- Suggested fix: Expand verification to full affected backend suites including SQLite/route coverage, plus explicit TS typecheck or build command.

### VERDICT
- Status: REVISE
- Reason: Plan covers the feature at a high level, but it leaves core revenue semantics, quarter aggregation, item-level drill-down, shared period behavior, and acceptance-proof verification under-specified.