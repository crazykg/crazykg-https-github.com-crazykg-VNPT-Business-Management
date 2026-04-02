### ISSUE-101: Promoted prerequisites are still contradicted by later tables and summary rows
- Category: sequencing
- Severity: high
- Plan section: Promoted Supplements; A7-A19 prioritization table; summary timeline (lines 24-35, 1356-1370, 2363-2376)
- Problem: The plan now promotes A1/A8/A12/A19 as hard prerequisites, but later tables still describe some of them as downstream or fully parallel work.
- Evidence: Promoted Supplements says A8 must complete before P3A and A12 before P1C, but the A-item table still says `A8 ... Depends on P3A` and `A12 ... Depends on P1C`; the summary timeline still includes `Parallel | A1-A19`.
- Why it matters: An AI can still follow the later table/timeline and execute the wrong order, despite the new prerequisite section.
- Suggested fix: Make the A-item table and summary timeline fully consistent with the promoted-prerequisite model, excluding A1/A8/A12/A19 from the generic “parallel” bucket.

### ISSUE-105: The parent-cache invalidation fix still relies on an unsafe FK naming shortcut
- Category: architecture
- Severity: high
- Plan section: 3F Cache Dependency Matrix for Related Models (lines 562-595)
- Problem: The new observer now tries to flush parent L2 detail tags, but it derives the parent key by concatenating `relationMethod + '_id'`, which is not reliable for camelCase relations.
- Evidence: `CustomerRequestStatusInstance::class => ['customerRequestCase' => 'customer-request-cases']` is mapped, then the sample code resolves the parent with `$model->getAttribute($relationMethod . '_id')`.
- Why it matters: For relations like `customerRequestCase`, that lookup becomes `customerRequestCase_id`, not the actual FK column, so the parent detail cache can still remain stale.
- Suggested fix: Store the exact FK column or a resolver callback in `PARENT_TAG_MAP`, rather than deriving it from the relation method name.

### ISSUE-110: The plan still is not fully self-executable for a blind AI model
- Category: scope
- Severity: high
- Plan section: A3 API Version Header; P5D; 8A; Protected file edit protocol (lines 1295-1311, 859-866, 1077-1089, 2480-2499)
- Problem: The plan still contains non-executable or ambiguous implementation guidance, and the expanded protected-file protocol now conflicts with some of the work it authorizes.
- Evidence: A3 says to register middleware by appending to a `v5` group in `bootstrap/app.php`, but the plan nowhere defines such a middleware group; P5D still shows `qc.invalidateQueries({ queryKey: queryKeys.revenue.overview });`; 8A still shows patterns like `export const Sidebar = React.memo(Sidebar);`; the protected-file protocol says `Only deletions and import changes allowed (no new logic)` even for `backend/bootstrap/app.php`, `backend/routes/api.php`, and `frontend/services/v5Api.ts`.
- Why it matters: The acceptance criterion says this plan itself must be implementable by any AI model with no ambiguity; today, an AI following it literally can still hit undefined middleware wiring and impossible protected-file rules.
- Suggested fix: Make this document self-contained for execution: replace ambiguous snippets with repo-accurate patterns, define the middleware registration path concretely, and narrow the protected-file protocol so it permits minimal additive changes where the plan explicitly requires them.

### VERDICT
- ISSUE-102, ISSUE-107, ISSUE-108, and ISSUE-111 are materially fixed.
- The plan is close, but it is still **not fully ready** for blind execution because ISSUE-101, ISSUE-105, and ISSUE-110 remain open.
- The remaining problems are no longer about missing architecture; they are about internal consistency and AI-executability.