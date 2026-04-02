### ISSUE-8: Product-detail feature catalog contract is still inconsistent
- Category: correctness
- Severity: high
- Plan section: §5.2 lines 434-445, §6.1 lines 510-513
- Problem: The backend detail-response snippet and the frontend type definition still describe different shapes for `feature_groups`.
- Evidence: §5.2 returns `['id' => $g->id, 'name' => $g->name, 'features' => $features]`, while §6.1 defines `UpsellFeatureGroup` as `{ id, group_name, features: { feature_name, detail_description? }[] }`.
- Why it matters: The expandable detail card depends on this contract. As written, backend and frontend do not agree on the field names, so the feature tree cannot be implemented cleanly from the plan alone.
- Suggested fix: Make §5.2 and §6.1 identical on the response shape by explicitly mapping backend output to the exact frontend contract, or revise the frontend type to match the backend payload.

### VERDICT
- Status: REVISE
- Reason: The round-3 fixes are in place, but the product-detail feature catalog response shape is still inconsistent between backend and frontend sections.