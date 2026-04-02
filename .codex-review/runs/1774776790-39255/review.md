### ISSUE-1: Schema guard coverage is incomplete
- Category: correctness
- Severity: high
- Plan section: lines 164-170, 315-323, 584
- Problem: The plan only guards the new `product_target_segments` table, but the new flow also depends on specific customer columns and feature-catalog tables/columns without defining guarded fallbacks.
- Evidence: `"$hasTargetSegments = $this->support->hasTable('product_target_segments');"`, `select('customer_sector', 'healthcare_facility_type', 'bed_capacity')`, `DB::table('product_feature_groups')`, `DB::table('product_features')`, and `hasTable() guard cho bảng mới`.
- Why it matters: Acceptance criterion 6 requires graceful degradation via `hasTable()`/`hasColumn()`. As written, partially migrated or inconsistent schemas can still hard-fail in `/insight` or the new detail endpoint.
- Suggested fix: Add an explicit guard matrix to the plan for every new table/column dependency and define the fallback payload for each missing-schema case.

### ISSUE-2: Cache invalidation does not cover the real data dependencies
- Category: risk
- Severity: critical
- Plan section: lines 341-345, 547-554
- Problem: The invalidation plan misses several new dependencies and defers the hardest invalidation path to a future CRUD flow that is out of scope.
- Evidence: Detail cache says `Invalidated khi: product update, feature catalog update`; the `/insight` cache table still lists only `customer update/delete, contract save`; line 554 says invalidation for `product_target_segments` will be implemented via a `future admin CRUD endpoint`.
- Why it matters: `/insight` now depends on product-target mappings and product fields, while `/insight/product-detail/{pid}` depends on contract/customer state too. Without a concrete invalidation mechanism, both endpoints can serve stale recommendations and stale detail data.
- Suggested fix: Revise the plan with a concrete invalidation matrix and mechanism for both endpoints, including customer segment edits, contract mutations, product updates, feature updates, and `product_target_segments` changes.

### ISSUE-3: Fallback behavior contradicts the proposed limits
- Category: correctness
- Severity: high
- Plan section: lines 147-150, 157-158, 580-583
- Problem: The plan says degraded cases should fall back to current behavior, but the algorithm hard-limits the popular bucket to 4 items.
- Evidence: `Limit: 4 items (fallback)`, `private const POPULAR_LIMIT = 4;`, and `nếu không có targeted → hiện tất cả ở nhóm "Phổ biến", giống hiện tại`.
- Why it matters: In exactly the scenarios the plan expects to degrade gracefully, users would get fewer suggestions than today. That is a behavioral regression.
- Suggested fix: Clarify the fill rule in the plan so fallback scenarios preserve the current total suggestion count instead of always capping popular results at 4.

### ISSUE-4: Multi-match segment resolution is underspecified and can return mismatched notes
- Category: correctness
- Severity: medium
- Plan section: lines 192-203
- Problem: The targeted query aggregates per product but does not define one canonical matching segment row.
- Evidence: `MIN(pts.priority) as segment_priority` together with `MAX(pts.sales_notes) as sales_notes`.
- Why it matters: A product that matches multiple rows can get priority from one segment and `sales_notes` from another, so the UI may show misleading advisory text.
- Suggested fix: Add a plan step that defines deterministic winner selection per product, with explicit tie-breaks, and derive all segment-returned fields from that one row.

### ISSUE-5: The frontend detail-state design is race-prone
- Category: correctness
- Severity: medium
- Plan section: lines 507-526
- Problem: The plan uses one shared `productDetail` state for all cards and does not describe stale-response protection.
- Evidence: `const [productDetail, setProductDetail] = useState<UpsellProductDetail | null>(null);` and `const { data } = await fetchUpsellProductDetail(customer.id, productId); setProductDetail(data);`.
- Why it matters: If a user expands A then B quickly, the slower response can render the wrong detail under the currently expanded card.
- Suggested fix: Update the plan so detail state is keyed by `productId` and includes request-cancellation or stale-response handling.

### ISSUE-6: Verification is too generic for the risky paths
- Category: sequencing
- Severity: medium
- Plan section: lines 558-572
- Problem: The verification section relies on manual checks and generic suite runs, but it does not define targeted regression coverage for the new logic.
- Evidence: The section lists manual API/UI validation plus `php artisan test`, `npm run test`, and `npm run lint`, but no explicit new cases.
- Why it matters: The risky failures here are scenario-specific: absent schema, empty target-segment data, multiple matching rows, `reference_customers` compatibility, and cache invalidation. Those are easy to miss without named test cases.
- Suggested fix: Expand the plan with explicit backend/frontend regression cases for targeted vs popular classification, graceful degradation, backward-compatible response fields, multi-match resolution, and cache behavior.

### VERDICT
- Status: REVISE
- Reason: The plan is directionally reasonable, but it does not yet satisfy the acceptance bar on schema guards, cache invalidation, and backward-compatible fallback behavior.