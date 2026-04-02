### ISSUE-2: The document now contains two conflicting codebase baselines
- Category: correctness
- Severity: high
- Plan section: `### 1.2 Diem chi tiet theo hang muc`; `## 2. Chi tiet diem Frontend`; `### 9.2`; `### 9.4`
- Problem: The original score/detail sections still describe the older repo state, while Section 9 reports a newer verified repo state. The plan no longer has a single source of truth for current codebase facts.
- Evidence: Section 1/2 still says `App.tsx` is `1,563` lines, there are `6 shared stores`, and only `7 specs` at lines 56, 81, 88-93, and 131-132. Section 9 says `App.tsx = 1,597 dong`, there are `8 stores`, and `12 E2E specs` at lines 995, 1021, 1146-1169.
- Why it matters: Acceptance criterion (5) fails again. Reviewers cannot tell which baseline the roadmap, scores, and priorities are supposed to use.
- Suggested fix: Either update Sections 1-8 to the verified `2026-03-31` state, or explicitly relabel Sections 1-8 as a frozen `2026-03-30 baseline` and Section 9 as a separate delta/current-state report.

### ISSUE-3: The new enforcement finding is broader than the current go-live blocker scope
- Category: risk
- Severity: critical
- Plan section: `### Phase A: Emergency Fixes`; `### 9.4 Findings moi`; `### 9.5 De xuat hanh dong tiep theo`
- Problem: The new codebase verification shows that policy enforcement is missing in `30/31` controllers, but the go-live blocker only requires adding `Gate::authorize()` to 3 controllers without showing why the remaining 27 are safe to defer.
- Evidence: Lines 740-747 and 1103-1119 state that policies exist but are only called in `CustomerController`, with `30 controllers con lai` lacking enforcement. Yet the blocker list at lines 1181-1184 only covers `ContractController`, `FeeCollectionController`, and `CustomerRequestCaseController`, while line 1204 defers the other `27 controllers` to post-go-live hardening.
- Why it matters: Acceptance criterion (1) is not fully met. The document now presents a systemic broken-access-control enforcement gap, but only partially scopes the P0 pre-launch remediation.
- Suggested fix: Add a minimal endpoint risk matrix proving why only those 3 controllers are P0, or expand Phase A blockers to every mutating controller currently missing policy enforcement.

### ISSUE-5: Phase 2 is marked in progress even though its own prerequisite gate is still open
- Category: sequencing
- Severity: high
- Plan section: `### Phase 2: State Migration`; `### 9.2 Chi tiet — Lo trinh kien truc`
- Problem: The plan says Phase 2 cannot start until its safety gate is complete, but Section 9 says Phase 2 is already 40% complete while the gate is only partially satisfied.
- Evidence: Lines 414-417 define the prerequisite gate before Phase 2 begins. But line 412 marks Phase 2 as `DANG THUC HIEN (40%)`, line 994 says item `2.0` is only `MOT PHAN`, and line 1006 says the route-list snapshot test still does not exist.
- Why it matters: Acceptance criterion (2) fails. The plan is explicitly allowing refactor work to proceed before the required safety net is actually in place.
- Suggested fix: Either treat current work as pre-gate preparation and keep Phase 2 “not started,” or close the gate immediately before counting Phase 2 as underway.

### ISSUE-6: The plan now publishes two incompatible scorecards
- Category: correctness
- Severity: high
- Plan section: `## 1. Bang diem tong hop`; `### Cach tinh diem tong`; `### 9.6 Diem da cap nhat sau kiem tra`
- Problem: The new verification appendix introduces a second set of “current” scores that conflicts with the main summary and rubric outputs, with no declared authoritative score set.
- Evidence: Section 1 and Appendix B still publish FE/BE/system scores of `6.7 / 8.0 / 7.4` at lines 32-34 and 917-927. Section 9.6 then updates them to `7.1 / 8.2 / 7.7` at lines 1218-1222.
- Why it matters: Acceptance criterion (5) is broken again. A defensible scoring methodology cannot produce two different current answers inside the same document without a formal baseline/current distinction.
- Suggested fix: Split the scorecards into clearly labeled `Baseline` and `Current verified state` sections with separate formulas, or replace the old summary entirely with the verified current numbers.

### ISSUE-7: Phase A env hardening is marked complete using template-file evidence, not deployment evidence
- Category: risk
- Severity: critical
- Plan section: `### Phase A: Emergency Fixes`; `## 7. Production Hardening Checklist`
- Problem: A1-A5 are marked `DA LAM`, but the evidence points only to `.env.example` line numbers. That proves the template changed, not that the live deployment configuration is actually hardened.
- Evidence: Lines 723-727 mark `VNPT_AUTH_COOKIE_SECURE`, `SESSION_ENCRYPT`, `SameSite`, `APP_DEBUG`, and `LOG_LEVEL` as done based on `.env.example` lines. The production checklist at lines 791-797 still treats these as deployment-time checks.
- Why it matters: With production imminent, this can create a false sense of readiness. Template changes do not close a P0 environment-hardening blocker unless the runtime config is verified.
- Suggested fix: Reclassify A1-A5 as `template fixed / production verification pending` unless there is deployment-environment evidence, or add an explicit pre-deploy verification step against the actual runtime config.

### VERDICT
- Status: REVISE
- Reason: The new verification appendix adds useful evidence, but it also reintroduces split baselines, conflicting scorecards, an open Phase 2 gate, and a broader pre-go-live authorization gap than the blocker scope currently covers.