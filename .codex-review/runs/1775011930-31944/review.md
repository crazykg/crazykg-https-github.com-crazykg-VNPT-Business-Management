### ISSUE-2: Store baseline is still inconsistent with both Section 9 and the repo
- Category: correctness
- Severity: high
- Plan section: `### 1.2 Diem chi tiet theo hang muc`; `### 2.1 Kien truc`; `### Phase 2: State Migration`; `### 9.2`; `### 9.4 FINDING-05`
- Problem: The plan still treats `productStore` as an existing current-state artifact, but that is not supported by the repo and conflicts with the document’s own later baseline note.
- Evidence: Sections 1.2, 2.1, 5.2, and 9.2 say `productStore` already exists and count `8 stores` on that basis. But `rg -n "productStore" frontend backend` returns no matches, and [frontend/shared/stores](/Users/pvro86gmail.com/Downloads/QLCV/frontend/shared/stores) contains `authStore.ts`, `contractStore.ts`, `filterStore.ts`, `modalStore.ts`, `revenueStore.ts`, `toastStore.ts`, `uiStore.ts`, plus `index.ts`. Section 9.4 FINDING-05 also describes the 8-file count as `contractStore.ts` plus `index.ts`, not `productStore`.
- Why it matters: This reintroduces a stale baseline into FE state-management scoring and overstates Phase 2 progress, which fails acceptance criterion (5).
- Suggested fix: Rebaseline the store inventory to the actual current state. Either describe it as `7 store modules + index.ts`, or explicitly mark `productStore` as planned rather than existing.

### ISSUE-6: The scorecard is still not internally consistent
- Category: correctness
- Severity: critical
- Plan section: `### 1.1 Diem theo layer`; `### 1.2 Diem chi tiet theo hang muc`; `## Phu luc B`; `### 9.6`
- Problem: The plan still claims a `single authoritative scorecard`, but the formulas, item values, and Section 9 totals do not agree with each other.
- Evidence: Section 1.1 says `FE Arch = mean(items 15,17,18,19) = 6.25 → 6.3`, but the current item scores in 1.2 are `#15=8`, `#17=6`, `#18=7`, `#19=7`, which average to `7.0`, not `6.3`. Section 1.1 then publishes FE/BE/system as `7.0 / 8.1 / 7.6`, while Section 9.6 publishes updated totals of `7.1 / 8.2 / 7.7`. The note in 1.3 also says `Section 9 la nguon su that duy nhat khi co mau thuan`, which directly conflicts with `single authoritative scorecard`.
- Why it matters: Acceptance criterion (5) still fails. Another reviewer cannot reproduce the published scores from the item table, and the document still contains two competing “truths.”
- Suggested fix: Choose one authoritative score set, recompute it from the current item table, update Appendix B and Section 9.6 to match exactly, and remove the fallback note that Section 9 overrides the main scorecard.

### ISSUE-9: The Phase A IDOR blocker is not evidence-aligned with the current enforcement path
- Category: risk
- Severity: high
- Plan section: `### 3.2 Bao mat`; `**BE-SEC-04**`; `### Phase A: Emergency Fixes`; `### 9.4 FINDING-02`
- Problem: The plan equates “missing `Gate::authorize()` in controllers” with “mutations are unprotected,” but the current codebase already has service-layer mutation-access checks on at least some of the flagged domains. The blocker is therefore not mapped cleanly to the real remaining risk.
- Evidence: The plan says `Receipt model — KHONG CO ReceiptPolicy — receiptUpdate/receiptDestroy unprotected` and `ContractPolicy.update() bi bypass hoan toan`. But the repo already enforces service-layer checks via `assertModelMutationAccess(...)` in [ContractDomainService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Domain/ContractDomainService.php#L565), [InvoiceDomainService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/FeeCollection/InvoiceDomainService.php#L284), and [ReceiptDomainService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/FeeCollection/ReceiptDomainService.php#L221).
- Why it matters: Acceptance criteria (1) and (5) require P0 security items to be concrete and evidence-based. As written, A8 overstates some gaps and does not clearly separate missing controller-level policy wiring from truly missing ownership enforcement.
- Suggested fix: Rewrite A8 as an endpoint-by-endpoint matrix that shows the actual current protection path for each mutating endpoint: route middleware, service-layer mutation-access check, policy enforcement, and uncovered gaps. Keep only genuinely uncovered endpoints in the go-live blocker set.

### VERDICT
- Status: REVISE
- Reason: The plan is closer, but it still has an inaccurate store baseline, a non-reproducible scorecard, and a Phase A access-control blocker that is not fully aligned with the codebase’s actual enforcement path.