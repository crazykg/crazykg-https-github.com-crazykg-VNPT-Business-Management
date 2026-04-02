### ISSUE-110: The plan still contains non-executable code patterns
- Category: scope
- Severity: high
- Plan section: P5D Split `v5Api.ts`; 8A React.memo + useMemo/useCallback (lines 859-866, 1078-1089)
- Problem: The remaining code examples are still not fully self-executable, so this document still depends on inference or the companion DEV plan for implementation-safe details.
- Evidence: `qc.invalidateQueries({ queryKey: queryKeys.revenue.overview });` uses a query-key factory as if it were a concrete key, and `export const Sidebar = React.memo(Sidebar);` / similar self-referential patterns are still shown as implementation examples.
- Why it matters: Your acceptance bar says this plan itself must be implementable by any AI coding model with no ambiguity. These snippets still require guesswork.
- Suggested fix: Replace the remaining illustrative snippets with compile-safe, repo-accurate patterns in this plan, or mark them explicitly as non-normative pseudocode and point to the exact companion DEV sections that contain the executable form.

### VERDICT
- Status: NOT READY
- Remaining blocking issues: ISSUE-110