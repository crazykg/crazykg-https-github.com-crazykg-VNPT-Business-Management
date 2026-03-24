### ISSUE-5: Backward-compatibility claim still conflicts with planned UI changes
- Category: scope
- Severity: high
- Plan section: `### 6.3. Shared period selector — semantic contract`, `### 6.4. Shared header layout`, `### 11.3. Manual E2E verification` (lines 496-526, 783)
- Problem: The plan still says the default contracts view is backward compatible and “không thay đổi gì”, but it explicitly changes the header title/description and hoists the period selector into a shared header.
- Evidence: "`Không có regression.`" (line 496), then "`<h2>Hợp đồng & Doanh thu</h2> {/* đổi tiêu đề */}`" and shared `<PeriodSelector ... />` (lines 503-526), while manual verification says default view is "`không thay đổi gì`" (line 783).
- Why it matters: Acceptance criterion `(1)` is about the default view staying unchanged; the plan still introduces visible default-view changes.
- Suggested fix: Either preserve the existing contracts header/layout in `CONTRACTS` mode and add the hub chrome outside it, or explicitly narrow the acceptance target from “unchanged view” to “unchanged business behavior”.

### ISSUE-7: Controller DI plan regresses the existing base-controller contract
- Category: architecture
- Severity: high
- Plan section: `### 4.3. Route + Controller + DI Wiring` (lines 287-315)
- Problem: The new `ContractController` constructor omits `V5DomainSupportService` and `V5AccessAuditService` and does not call `parent::__construct(...)`, even though the current controller extends `V5BaseController`.
- Evidence: The plan’s constructor is just `public function __construct(... ) {}` (lines 290-294). Current base controller requires those dependencies in [V5BaseController.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Http/Controllers/Api/V5/V5BaseController.php#L10), and current controller currently calls the parent constructor in [ContractController.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Http/Controllers/Api/V5/ContractController.php#L11).
- Why it matters: This is not implementation-ready in the current architecture and would break controller initialization unless the inheritance contract is changed elsewhere.
- Suggested fix: Revise the wiring plan to preserve the existing base-controller constructor path and specify exactly how the analytics service is injected without breaking existing controller methods.

### ISSUE-9: SQLite compatibility is still incomplete for date-difference logic
- Category: correctness
- Severity: high
- Plan section: `### 4.2. SQL Logic chính`, `### 4.4. Schema guards`, `#### Row 5: Chi tiết đợt quá hạn` (lines 219-225, 319-325, 657-668)
- Problem: The plan adds SQLite handling for period bucketing, but it still uses MySQL-specific `DATEDIFF` and `CURDATE()` for `avg_days_to_collect` and `days_overdue` with no SQLite equivalent or PHP fallback.
- Evidence: `AVG(DATEDIFF(ps.actual_paid_date, ps.expected_date))` (lines 219-225), `DATEDIFF(CURDATE(), ps.expected_date)` (lines 661-668), while schema guards only cover `DATE_FORMAT` vs `strftime` (lines 319-325).
- Why it matters: SQLite `:memory:` tests can still fail even if month/quarter grouping works, so the stated compatibility constraint is not actually met.
- Suggested fix: Add driver-specific day-difference expressions for MySQL and SQLite, or move day-delta calculations to PHP after fetching raw dates.

### ISSUE-10: API contract example for `by_item` is now internally inconsistent
- Category: correctness
- Severity: low
- Plan section: `### 4.1. Service mới`, `### 4.2. SQL Logic chính`, `### 5.1. Types`, `#### Row 4` (lines 133-145, 261-277, 378-389, 634-635)
- Problem: The response example for `by_item` still shows the old shape without `allocated_expected`, `allocated_actual`, and `allocated_outstanding`, while later sections require those fields.
- Evidence: The example JSON under `contract_id` only includes `line_total` and `proportion` (lines 133-145), but the updated `RevenueByItem` interface and UI columns include allocated revenue fields (lines 261-277, 378-389, 634-635).
- Why it matters: The backend response contract in the plan is contradictory, which can lead to mismatched implementation between API and UI.
- Suggested fix: Update the `by_item` response example in section 4.1 to the final agreed payload shape and keep all contract examples aligned.

### VERDICT
- Status: REVISE
- Reason: Most prior gaps were addressed, but the updated plan still has a backward-compatibility contradiction, a controller wiring regression, incomplete SQLite-safe SQL, and one remaining API-contract inconsistency.