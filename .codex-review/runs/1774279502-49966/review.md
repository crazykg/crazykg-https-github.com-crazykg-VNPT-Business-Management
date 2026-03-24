### ISSUE-10: Gap-day examples, acceptance, and tests are still inconsistent
- Category: correctness
- Severity: critical
- Plan section: `1. Bối cảnh & Vấn đề`, `2. Acceptance Criteria`, `4.1 Tính gap_days`, `8. Test Cases` (lines 25-28, 49-50, 134-139, 542-546, 582)
- Problem: The plan mixes two incompatible interpretations of “15 days late.” Some sections say `15/01/2027` gives `gap_days=15`, while the formal formula and tests say the same date gives `gap_days=14`.
- Evidence: `"[15/01/2027 ...] gap_days=15"` (line 26), acceptance requires ``gap_days = 15`` for `parent.expiry_date + 16 ngày` (line 49), but section 4.1 says `addendum.effective_date = 2027-01-15 → gap_days = 14` and explicitly notes `14 (không phải 15)` (lines 136-139). Tests also assert `gap_days=14` and UI text `"Trễ 14 ngày (-4.67%)"` (lines 543-546, 582).
- Why it matters: This leaves the team without a single source of truth for acceptance, UI copy, and penalty math. The plan is not testable as written.
- Suggested fix: Normalize every example, acceptance bullet, test name, and UI string to one convention, using exact dates in the examples so `gap_days` is unambiguous.

### ISSUE-11: `applyRenewalMetaToContract()` has conflicting signatures inside the plan
- Category: architecture
- Severity: medium
- Plan section: `5.1 Service mới: ContractRenewalService`, `5.2 Sửa ContractDomainService` (lines 277-278, 328)
- Problem: The service contract defines `applyRenewalMetaToContract(Contract $addendum, ?Contract $parent): void`, but the update flow calls it with a third `$effectiveDate` argument.
- Evidence: Method list defines `applyRenewalMetaToContract(Contract $addendum, ?Contract $parent): void` (lines 277-278), while update sequence says `applyRenewalMetaToContract($contract, $parent, $effectiveDate)` (line 328).
- Why it matters: The update path is underspecified. Implementers cannot tell whether the method should read dates from the model, accept explicit inputs, or both.
- Suggested fix: Choose one signature and use it consistently in the service contract, create/update sequences, and test plan.

### ISSUE-12: Parent-expiry recomputation still leaves schedule state ambiguous
- Category: sequencing
- Severity: high
- Plan section: `4.7 Recomputation lifecycle`, `5.1 Service mới`, `5.2 Sửa ContractDomainService`, `9. Rủi ro & Mitigation` (lines 255-259, 279-280, 330-333, 595)
- Problem: The plan says a parent `expiry_date` change dispatches `RecomputeChildRenewalMetaJob`, but that job “recompute[s] and save[s]” child meta and explicitly does not touch existing schedules. Elsewhere, the normal update path does call `applyPenaltyToSchedules()` when schedules exist, and the risk table narrows the restriction to rows already `PAID/PARTIAL`.
- Evidence: Lifecycle says `Parent expiry_date thay đổi → Dispatch RecomputeChildRenewalMetaJob` (line 255) and `Không regenerate payment_schedules đã tồn tại` (line 259). Update flow says recomputed meta with existing schedules should call `applyPenaltyToSchedules(...)` (lines 330-333). Risk table says only schedules `đã PAID/PARTIAL` must not be regenerated (line 595).
- Why it matters: After a parent-date change, contract-level `gap_days`/`penalty_rate` can diverge from `payment_schedules`, especially for unconfirmed rows. That breaks consistency in downstream revenue views and schedule amounts.
- Suggested fix: Define one explicit rule for parent-date changes: whether unconfirmed schedules are updated, whether only penalty fields change, and how confirmed rows are excluded.

### ISSUE-13: Soft-delete serialization field name is not aligned
- Category: correctness
- Severity: medium
- Plan section: `2. Acceptance Criteria`, `4.6 Soft-delete của parent contract`, `5.4 Serialization`, `6.1 Types` (lines 59, 243, 398, 442)
- Problem: The acceptance criteria require `parent_deleted: true`, but the serializer and frontend type use `deleted: true`.
- Evidence: Acceptance says `đánh dấu parent_deleted: true trong serialization` (line 59). Later sections define `deleted: true` / `deleted: bool` / `deleted?: boolean` (lines 243, 398, 442).
- Why it matters: The API contract is still not locked. Backend and frontend can each implement a different field and still believe they followed the plan.
- Suggested fix: Pick one field name and use it consistently in acceptance criteria, serializer output, TypeScript types, and tests.

### ISSUE-14: The payment-service extension point is still named incorrectly
- Category: architecture
- Severity: medium
- Plan section: `4.4 Áp dụng penalty vào payment_schedules`, `5.3 Sửa ContractPaymentService::generatePayments()`, `7. Sequence` (lines 191, 366, 520)
- Problem: The plan still says to modify `ContractPaymentService::generatePayments()`, but that is not the authoritative method name in the current payment service.
- Evidence: The plan repeatedly references `generatePayments()` in `ContractPaymentService` (lines 191, 366, 520). In the current codebase, `ContractPaymentService` exposes `generateContractPayments()`, while `ContractDomainService::generatePayments()` is the delegating wrapper.
- Why it matters: This increases the risk of patching the wrong layer and missing the actual schedule-generation path that writes `expected_amount`.
- Suggested fix: Update the plan to name the real payment-service entrypoint and, if needed, the internal schedule-generation method where the row amounts are assigned.

### VERDICT
- Status: REVISE
- Reason: The first-round issues are largely addressed, but the updated plan still has blocking internal inconsistencies around `gap_days`, recomputation behavior, API contract naming, and the actual payment-service integration point.