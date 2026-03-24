### ISSUE-10: One residual schema comment still uses the old `gap_days` meaning
- Category: correctness
- Severity: medium
- Plan section: `3.1 Migration: add_addendum_columns_to_contracts` (line 77)
- Problem: The SQL comment for `contracts.gap_days` still says `0=liên tục`, which conflicts with the accepted rule `EARLY(gap≤0)`, `CONTINUOUS(gap=1)`, `GAP(gap>1)`.
- Evidence: `COMMENT 'Khoảng cách ngày so với parent.expiry_date (âm=sớm, 0=liên tục, dương=trễ)...'`
- Why it matters: This is the persisted schema documentation for the feature. Leaving the old meaning there reintroduces ambiguity for future maintenance and data interpretation.
- Suggested fix: Update the column comment to match the final semantics, e.g. `gap≤0 = EARLY, gap=1 = CONTINUOUS, gap>1 = GAP`.

### ISSUE-15: The settings description still documents the old grace rule and old no-penalty value
- Category: correctness
- Severity: medium
- Plan section: `3.2 Migration: add_renewal_settings_to_integration_settings` (line 102)
- Problem: The `contract_renewal_grace_days` description still says `gap ≤ grace → penalty_rate = 0`, but the accepted/current rule is `penalty_rate = null` when `gap_days <= 1 + grace_days`.
- Evidence: `Ngày ân hạn — gap ≤ grace → penalty_rate = 0 (nhưng status vẫn GAP)` vs acceptance `penalty_rate = null khi gap_days <= 1 + grace_period_days` (line 51) and logic `if ($gapDays === null || $gapDays <= 1 + $config['grace_days'])` (line 171).
- Why it matters: This leaves the configuration semantics inconsistent in the plan itself, and it can lead to the wrong admin/help text or wrong implementation assumptions around boundary behavior.
- Suggested fix: Update the settings description to the final rule: `gap_days <= 1 + grace_days → penalty_rate = null`, while status remains `GAP` for `gap > 1`.

### VERDICT
- Status: REVISE
- Reason: The core logic is now aligned, but two residual documentation contradictions remain in the schema/settings definitions, so the plan is not fully internally consistent yet.