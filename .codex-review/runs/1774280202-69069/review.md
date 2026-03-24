### ISSUE-10: Gap semantics are still inconsistent in non-core sections
- Category: correctness
- Severity: high
- Plan section: `1. Bối cảnh & Vấn đề`, `2. Goals`, `3.1 Migration`, `6.3 Modal tạo/sửa HĐ` (lines 23, 39, 77, 493 vs. lines 48-49, 155-158)
- Problem: The core logic now uses `gap_days = 1 → CONTINUOUS`, `gap_days > 1 → GAP`, `gap_days <= 0 → EARLY`, but several other sections still describe the old `gap=0 continuous` model.
- Evidence: The scenario still says `01/01/2027 ... gap_days=0` (line 23), Goals still say `CONTINUOUS (gap=0)` (line 39), the DB column comment still says `0=liên tục` (line 77), and the preview color legend still marks green at `(0)` (line 493). The formal acceptance and logic sections use `gap_days = 1` for `CONTINUOUS` (lines 48-49, 157).
- Why it matters: This leaves the plan internally contradictory for product, backend, and frontend implementers. It also weakens the acceptance criteria because different sections point to different invariants.
- Suggested fix: Normalize every remaining reference to the current rule: `EARLY <= 0`, `CONTINUOUS = 1`, `GAP > 1`, including examples, column comments, UI copy, and preview logic.

### ISSUE-14: The old `generatePayments()` name still appears after the write-path fix
- Category: architecture
- Severity: medium
- Plan section: `4.4 Áp dụng penalty vào payment_schedules`, `5.3 Sửa ContractPaymentService::generateContractPayments()`, `7. Thứ tự Thực hiện` (lines 191, 375, 534)
- Problem: The plan correctly fixed section 5.3 to `generateContractPayments()`, but other sections still refer to `generatePayments()`.
- Evidence: Section 4.4 says `Khi generatePayments() được gọi` (line 191) and Sequence Step 8 still says `ContractPaymentService::generatePayments()` (line 534), while section 5.3 uses the correct method name `generateContractPayments()` (line 375).
- Why it matters: This reintroduces ambiguity around the actual write path, which was the core risk behind the previous finding.
- Suggested fix: Rename the remaining references to `generateContractPayments()` and, if useful, explicitly note that `ContractDomainService::generatePayments()` is only the delegating wrapper.

### ISSUE-15: The penalty/grace boundary is still off by one, and the no-penalty sentinel is inconsistent
- Category: correctness
- Severity: high
- Plan section: `2. Acceptance Criteria`, `3.1 Constraints`, `4.3 Tính penalty_rate` (lines 51, 94, 169-176, 183-186)
- Problem: The new penalty formula is based on `(gap_days - 1 - grace_days)`, but the guard condition and acceptance text still use the old threshold. This creates boundary cases where the plan would compute `0.0000` instead of the documented `null` no-penalty state.
- Evidence: Acceptance still says ``penalty_rate = 0 when gap_days <= grace_period_days`` (line 51), constraints say `penalty_rate = NULL khi gap_days <= grace_days` (line 94), but the formula uses `$penaltyDays = $gapDays - 1 - $config['grace_days']` (line 173) and defines `null` as the “no penalty” sentinel (line 170). With `gap_days=6` and `grace_days=5`, this falls into the `else` branch and yields `0.0000`, not `null`.
- Why it matters: This breaks the plan’s own semantic distinction between “no penalty” and “computed penalty,” and it can also misclassify UI badge states that rely on `penalty_rate > 0` vs `penalty_rate = null`.
- Suggested fix: Change the no-penalty boundary to `gap_days <= 1 + grace_days`, update the acceptance/constraint wording to use `null` consistently, and add an explicit boundary test such as `gap=6, grace=5 → penalty_rate=null`.

### ISSUE-16: `hasColumn()` guard usage is not specified consistently enough for the new contract fields
- Category: risk
- Severity: medium
- Plan section: `5.2 Sửa ContractDomainService`, `5.3 Sửa ContractPaymentService::generateContractPayments()`, `5.4 Serialization` (lines 303-315, 383-397, 405-413)
- Problem: The session constraint requires `hasColumn()` guards, but the plan only calls them out for `payment_schedules` penalty columns. It does not state the same guard strategy for the new `contracts` fields in domain writes, KPI queries, and serialization.
- Evidence: The only explicit guard usage in the plan is around `payment_schedules.original_amount` (lines 383-397). Sections 5.2 and 5.4 directly read/write `parent_contract_id`, `gap_days`, `continuity_status`, and `penalty_rate` without an explicit guard strategy (lines 303-315, 405-413).
- Why it matters: This is a rollout and backward-compatibility risk in a codebase that already relies on schema guards. The plan should be explicit here because these authoritative services run in mixed-schema situations.
- Suggested fix: Add a plan-level rule that all reads/writes/selects for newly added contract and payment-schedule columns must use the existing support-layer `hasColumn()` / guarded attribute helpers.

### VERDICT
- Status: REVISE
- Reason: The major Round-2 fixes are mostly in place, but the updated plan still has several contradictory leftovers around gap semantics, a real off-by-one bug in the grace boundary, a partial regression on the payment write-path naming, and incomplete guard strategy for rollout safety.