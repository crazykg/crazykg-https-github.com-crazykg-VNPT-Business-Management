### ISSUE-2: Stale frontend baseline is still not fully corrected
- Category: correctness
- Severity: medium
- Plan section: `### 1.2 Diem chi tiet theo hang muc`; `### 2.1 Kien truc`
- Problem: The Round 3 plan still understates the current Zustand/shared-store footprint and unit-test count, so the “fixed” baseline is still not fully aligned to the repository.
- Evidence: The plan says `Zustand co shared stores (uiStore, toastStore, revenueStore)` at line 55 and `3 shared stores` at line 80, but current files under [frontend/shared/stores](/Users/pvro86gmail.com/Downloads/QLCV/frontend/shared/stores) include `authStore.ts`, `filterStore.ts`, `modalStore.ts`, `revenueStore.ts`, `toastStore.ts`, and `uiStore.ts`. The plan also says `107 unit tests` at lines 58 and 130, while the current repo has 110 non-E2E test/spec files.
- Why it matters: Acceptance criterion (5) requires the scoring baseline to be defensible from the codebase. The latest revision is better, but it still contains factual drift.
- Suggested fix: Recount the current frontend shared stores and non-E2E tests from the repo and update the state-management/test-coverage evidence lines to match.

### ISSUE-6: The scoring rubric still contradicts its own calculations
- Category: correctness
- Severity: high
- Plan section: `## 1. Bang diem tong hop`; `## Phu luc B: Scoring Rubric`
- Problem: The new scoring appendix still does not produce the published numbers, and it breaks its own stated rounding rule.
- Evidence: Line 894 says `round to nearest 0.5`, but line 897 shows `avg(#17, #18, #19, #20) = 5.5 → 6.0`, which is neither mathematically correct nor consistent with the stated rule. Line 898 shows `Diem BE bao mat ... = 8.11 → 8.0`, but the published backend security score is `8.3 / 10` at lines 32 and 251. Lines 902-905 then round layer totals to tenths, not to the stated `0.5` rule.
- Why it matters: Acceptance criterion (5) is still not met. Reviewers still cannot reproduce the plan’s numbers from the rubric, so the scoring remains non-auditable.
- Suggested fix: Use one explicit rounding rule for every level of the model, recalculate all derived scores from that rule, and ensure the appendix matches the published tables exactly.

### VERDICT
- Status: REVISE
- Reason: Round 3 fixes most prior issues, but the plan still has residual baseline drift and the scoring methodology remains internally inconsistent.