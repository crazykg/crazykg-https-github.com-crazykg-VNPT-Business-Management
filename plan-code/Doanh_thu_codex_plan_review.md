# Quản trị Doanh thu — Codex Plan Review & Index Audit

## Context

Yêu cầu: Phân tích toàn diện chức năng menu **Quản trị Doanh thu** (gồm cả tab **Thu Cước** và tab **Quản trị Doanh thu**), đánh giá hiện trạng các tab, kiểm tra logic nghiệp vụ, kiểm tra hiệu năng database index, và ghi nhận vào file markdown.

**Hai tab thuộc nhóm "Tài chính & Doanh thu" trong sidebar:**
1. `revenue_mgmt` — Quản trị Doanh thu (5 sub-view, chỉ OVERVIEW hoạt động)
2. `fee_collection` — Thu Cước (4 sub-view, tất cả đều hoạt động)

---

## Phần 1: Hiện trạng tổng quan

### 1.1 Tab Thu Cước (`fee_collection`) — ✅ Hoàn thành 4/4 sub-view

| Sub-view | Component | Trạng thái | API Backend |
|----------|-----------|-----------|-------------|
| Dashboard | `FeeCollectionDashboard.tsx` | ✅ Hoạt động | `GET /api/v5/fee-collection/dashboard` |
| Hóa đơn | `InvoiceList.tsx` + `InvoiceModal.tsx` + `InvoiceBulkGenerateModal.tsx` | ✅ Hoạt động | `CRUD /api/v5/invoices` + `POST bulk-generate` |
| Phiếu thu | `ReceiptList.tsx` + `ReceiptModal.tsx` | ✅ Hoạt động | `CRUD /api/v5/receipts` + `POST reverse` |
| Báo cáo công nợ | `DebtAgingReport.tsx` | ✅ Hoạt động | `GET debt-aging` + `debt-by-customer` + `debt-trend` |

### 1.2 Tab Quản trị Doanh thu (`revenue_mgmt`) — ✅ 5/5 sub-view hoạt động

| Sub-view | Component | Trạng thái | API Backend |
|----------|-----------|-----------|-------------|
| Tổng quan (Overview) | `RevenueOverviewDashboard.tsx` | ✅ Hoạt động | `GET /api/v5/revenue/overview` + targets CRUD |
| Theo hợp đồng | `RevenueByContractView.tsx` | ✅ Hoạt động | `GET /api/v5/revenue/by-contract` + `/{id}` |
| Theo thu cước | `RevenueByCollectionView.tsx` | ✅ Hoạt động | `GET /api/v5/revenue/by-collection` |
| Dự báo | `RevenueForecastView.tsx` | ✅ Hoạt động | `GET /api/v5/revenue/forecast` |
| Báo cáo | `RevenueReportView.tsx` | ✅ Hoạt động | `GET /api/v5/revenue/report` |

---

## Phần 2: Kiến trúc Database — 7 bảng

| Bảng | Migration | SoftDeletes | Rows |
|------|-----------|-------------|------|
| `invoices` | `2026_03_25_100000` | ✓ | unlimited |
| `invoice_items` | `2026_03_25_100100` | ✗ (hard-delete+re-insert) | per invoice |
| `receipts` | `2026_03_25_100200` | ✓ | unlimited |
| `dunning_logs` | `2026_03_25_100300` | ✗ (immutable audit) | per invoice |
| `revenue_targets` | `2026_03_24_100000` | ✓ | 1 per period/dept/type |
| `revenue_snapshots` | `2026_03_24_100100` | ✗ (immutable point-in-time) | historical |
| `payment_schedules.invoice_id` | `2026_03_25_100400` | (extension) | FK linkage |

---

## Phần 3: Index Audit — Phân tích chi tiết

### 3.1 Bảng `invoices` — 7 indexes

| Index Name | Columns | Type | Query hưởng lợi |
|-----------|---------|------|-----------------|
| `idx_inv_code` | `invoice_code` | INDEX | Lookup by code, search |
| `idx_inv_contract` | `contract_id` | INDEX | Filter by contract |
| `idx_inv_customer` | `customer_id` | INDEX | Filter by customer, JOIN customers |
| `idx_inv_status` | `status` | INDEX | Filter by status |
| `idx_inv_due_date` | `due_date` | INDEX | Overdue detection |
| `idx_inv_date_status` | `invoice_date, status` | COMPOSITE | Dashboard byMonth, period-flow KPIs |
| `idx_inv_amounts` | `paid_amount, total_amount` | COMPOSITE | Outstanding calculation covering |

**Đánh giá:** ✅ Tốt — Phủ tất cả query patterns chính.

**⚠️ Thiếu / Nên bổ sung:**

1. **`idx_inv_overdue_covering`** — composite `(status, due_date, deleted_at, total_amount, paid_amount)`
   - **Lý do:** Query overdue xuất hiện ở 5+ nơi (overdueScope, buildKpis, buildTopDebtors, buildUrgentOverdue, buildAgingRows). Hiện tại MySQL phải combine idx_inv_status + idx_inv_due_date → covering index sẽ tránh random I/O về clustered index.
   - **Query pattern:** `WHERE status NOT IN (...) AND due_date < CURDATE() AND deleted_at IS NULL AND (total_amount - paid_amount) > 0`
   - **Ưu tiên: CAO**

2. **`idx_inv_customer_status`** — composite `(customer_id, status, deleted_at)`
   - **Lý do:** buildTopDebtors, buildAgingRows, debtByCustomer đều JOIN + GROUP BY customer_id với filter status + deleted_at. Composite index tối ưu cả WHERE + GROUP BY.
   - **Ưu tiên: TRUNG BÌNH**

3. **UNIQUE constraint trên `invoice_code`** — hiện chỉ là INDEX, không phải UNIQUE
   - **Lý do:** Code auto-generated (INV-YYYYMM-NNNN), cần đảm bảo uniqueness ở DB level. Plan document gốc ghi `UNIQUE KEY uq_invoice_code (invoice_code, deleted_at)` nhưng migration thực tế chỉ có `->index('invoice_code')`.
   - **Ưu tiên: CAO — data integrity issue**

### 3.2 Bảng `receipts` — 7 indexes

| Index Name | Columns | Type | Query hưởng lợi |
|-----------|---------|------|-----------------|
| `idx_rcp_code` | `receipt_code` | INDEX | Lookup by code |
| `idx_rcp_invoice` | `invoice_id` | INDEX | Reconciliation |
| `idx_rcp_contract` | `contract_id` | INDEX | Filter by contract |
| `idx_rcp_customer` | `customer_id` | INDEX | Filter by customer |
| `idx_rcp_date` | `receipt_date` | INDEX | Date filtering |
| `idx_rcp_status` | `status` | INDEX | Status filtering |
| `idx_rcp_trend` | `receipt_date, invoice_id, status` | COMPOSITE | Trend/reconciliation |

**Đánh giá:** ✅ Tốt — idx_rcp_trend là covering index tốt.

**⚠️ Thiếu / Nên bổ sung:**

4. **`idx_rcp_reconcile`** — composite `(invoice_id, status, deleted_at, amount)`
   - **Lý do:** reconcileInvoice() chạy `SUM(amount) WHERE invoice_id = ? AND status = 'CONFIRMED' AND deleted_at IS NULL` — covering index tránh disk seek cho mỗi receipt row.
   - **Ưu tiên: CAO** (chạy mỗi lần tạo/reverse receipt)

5. **UNIQUE constraint trên `receipt_code`** — tương tự invoice_code
   - **Ưu tiên: CAO — data integrity issue**

### 3.3 Bảng `invoice_items` — 1 index

| Index Name | Columns | Type |
|-----------|---------|------|
| `idx_ii_invoice` | `invoice_id` | INDEX |

**Đánh giá:** ✅ OK — bảng child, FK cascade, chỉ cần index trên parent FK.

### 3.4 Bảng `dunning_logs` — 3 indexes

| Index Name | Columns | Type |
|-----------|---------|------|
| `idx_dl_invoice` | `invoice_id` | INDEX |
| `idx_dl_customer` | `customer_id` | INDEX |
| `idx_dl_level` | `dunning_level` | INDEX |

**Đánh giá:** ✅ OK — Low cardinality trên dunning_level (1/2/3), nhưng ít row per invoice nên acceptable.

### 3.5 Bảng `revenue_targets` — 4 indexes

| Index Name | Columns | Type |
|-----------|---------|------|
| `uq_target_period_dept_type` | `period_type, period_key, dept_id, target_type` | UNIQUE |
| `idx_rt_period` | `period_type, period_key` | COMPOSITE |
| `idx_rt_dept` | `dept_id` | INDEX |
| `idx_rt_active` | `deleted_at` | INDEX |

**Đánh giá:** ✅ Tốt — UNIQUE constraint đúng, prefix index hữu ích.

**⚠️ Lưu ý:** UNIQUE index `uq_target_period_dept_type` KHÔNG bao gồm `deleted_at` → nếu soft-delete rồi tạo mới cùng key sẽ bị duplicate. Code hiện xử lý bằng `forceDelete` old soft-deleted records (ISSUE-4 R2 fix) — **application-level workaround cho DB constraint gap.**

### 3.6 Bảng `revenue_snapshots` — 3 indexes

| Index Name | Columns | Type |
|-----------|---------|------|
| `uq_snapshot_period_dimension` | `period_type, period_key, dimension_type, dimension_id` | UNIQUE |
| `idx_rs_period` | `period_type, period_key` | COMPOSITE |
| `idx_rs_dimension` | `dimension_type, dimension_id` | COMPOSITE |

**Đánh giá:** ✅ Tốt — Immutable table, upsert on snapshot generation.

### 3.7 Bảng `payment_schedules` — extension

| Index Name | Columns | Type |
|-----------|---------|------|
| `idx_ps_invoice` | `invoice_id` | INDEX |

**Đánh giá:** ✅ OK cho 1:1 linkage.

---

## Phần 4: Logic nghiệp vụ — Review

### 4.1 Invoice Status Machine ✅
```
DRAFT → ISSUED → PARTIAL → PAID (terminal)
                          → CANCELLED (terminal, pre-issue)
                          → VOID (terminal, post-issue write-off)
```
- `outstanding` = computed in PHP (`total_amount - paid_amount`), không lưu DB ✅
- `is_overdue` = query-time only via `overdueScope()` ✅
- Consistency: overdueScope() dùng nhất quán ở InvoiceDomainService, FeeCollectionDashboardService, DebtAgingReportService ✅

### 4.2 Receipt Reversal Pattern ✅
- Original: `is_reversed=false, is_reversal_offset=false`
- Offset: `is_reversal_offset=true, amount < 0, original_receipt_id=FK`
- reconcileInvoice: SUM all CONFIRMED receipts (bao gồm negative) → net payment
- **Không dùng status REVERSED** — tránh mutation status audit ✅

### 4.3 Revenue Reconciliation ✅
- Contracts (payment_schedules) = data source cơ bản
- Invoices supersede linked payment_schedules khi fee_collection active
- Open periods: live calculation; Closed periods: revenue_snapshots (fallback live)

### 4.4 ⚠️ Potential Issues Identified

**ISSUE-1: Debt Trend query không chính xác về mặt thời gian**
- `debtTrend()` GROUP BY `invoice_date` month nhưng dùng `total_amount - paid_amount` tại THỜI ĐIỂM QUERY → không phải point-in-time. Kết quả: outstanding cho tháng cũ sẽ hiển thị giá trị hiện tại, không phải giá trị tại cuối tháng đó.
- **Fix:** Dùng revenue_snapshots cho closed months, hoặc document rõ ràng là "approximation".

**ISSUE-2: SQL Injection tiềm tàng trong DebtAgingReportService**
- `buildAgingRows()` interpolate `$today` trực tiếp vào SQL string: `"WHEN invoices.due_date >= '{$today}'"`. Dù `$today` từ `now()->toDateString()` (an toàn), pattern này nên chuyển sang parameter binding.
- **Fix:** Dùng `DB::raw("CASE WHEN invoices.due_date >= ? ...")` + `addBinding()`.

**ISSUE-3: Plan document vs Migration mismatch**
- Plan document ghi `outstanding DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED` nhưng migration thực tế KHÔNG có GENERATED column — computed in PHP.
- Plan document ghi `UNIQUE KEY uq_invoice_code (invoice_code, deleted_at)` nhưng migration chỉ có `INDEX`.
- **Cần:** Đồng bộ plan document hoặc thêm migration bổ sung.

---

## Phần 5: Khuyến nghị bổ sung Index — Migration mới

File: `backend/database/migrations/2026_03_25_200000_add_performance_indexes_to_fee_collection.php`

```php
Schema::table('invoices', function (Blueprint $table) {
    // R1: Overdue covering index — 5+ query locations
    $table->index(
        ['status', 'due_date', 'deleted_at', 'total_amount', 'paid_amount'],
        'idx_inv_overdue_cover'
    );

    // R2: Customer+status composite — aging/debtor queries
    $table->index(
        ['customer_id', 'status', 'deleted_at'],
        'idx_inv_cust_status'
    );

    // R3: Unique invoice_code (matching plan document)
    // Note: scoped to non-deleted via application logic
    // Cannot use unique(invoice_code, deleted_at) because deleted_at is NULL for active
    // Use unique index with partial/functional approach or app-level guard
});

Schema::table('receipts', function (Blueprint $table) {
    // R4: Reconciliation covering index
    $table->index(
        ['invoice_id', 'status', 'deleted_at', 'amount'],
        'idx_rcp_reconcile'
    );
});
```

### Tổng kết khuyến nghị Index

| # | Bảng | Index | Ưu tiên | Lý do |
|---|------|-------|---------|-------|
| R1 | invoices | `(status, due_date, deleted_at, total_amount, paid_amount)` | 🔴 CAO | Overdue query chạy ở 5+ nơi |
| R2 | invoices | `(customer_id, status, deleted_at)` | 🟡 TB | Aging + debtor GROUP BY |
| R3 | invoices | UNIQUE on `invoice_code` | 🔴 CAO | Data integrity |
| R4 | receipts | `(invoice_id, status, deleted_at, amount)` | 🔴 CAO | reconcileInvoice mỗi write |
| R5 | receipts | UNIQUE on `receipt_code` | 🔴 CAO | Data integrity |

---

## Phần 6: Kế hoạch phát triển 4 sub-view còn thiếu trong Quản trị Doanh thu

### 6.1 Sub-view "Theo hợp đồng" (BY_CONTRACT)

**Mục đích:** Xem doanh thu drill-down theo từng hợp đồng.

**Backend:**
- Tái sử dụng `ContractRevenueAnalyticsService` (đã có `GET /api/v5/contracts/revenue-analytics`)
- Bổ sung endpoint: `GET /api/v5/revenue/by-contract` — paginated, với filters (dept_id, period_from/to, contract_status)

**Frontend:**
- Component mới: `frontend/components/revenue-mgmt/RevenueByContractView.tsx`
- Hiển thị: bảng hợp đồng với cột (mã HĐ, khách hàng, dự kiến, thực thu, tỷ lệ, trạng thái)
- Drill-down: click vào HĐ → expand payment_schedules + invoices

### 6.2 Sub-view "Theo thu cước" (BY_COLLECTION)

**Mục đích:** Liên kết doanh thu từ góc nhìn invoice/receipt (fee collection).

**Backend:**
- Tái sử dụng FeeCollectionDashboardService KPIs
- Bổ sung endpoint: `GET /api/v5/revenue/by-collection` — reconciled view (invoice vs schedule)

**Frontend:**
- Component mới: `frontend/components/revenue-mgmt/RevenueByCollectionView.tsx`
- Hiển thị: so sánh kỳ vọng (schedules) vs thực thu (receipts), drill-down by customer

### 6.3 Sub-view "Dự báo" (FORECAST)

**Mục đích:** Dự báo doanh thu dựa trên pipeline hiện tại.

**Backend:**
- Endpoint mới: `GET /api/v5/revenue/forecast`
- Logic: SUM upcoming payment_schedules (PENDING/INVOICED) + contract renewal predictions
- Thời gian: 3/6/12 tháng tới

**Frontend:**
- Component mới: `frontend/components/revenue-mgmt/RevenueForecastView.tsx`
- Biểu đồ: dự kiến theo tháng (stacked: đã ký vs đang thương lượng)
- KPIs: tổng pipeline, dự kiến thu, rủi ro

### 6.4 Sub-view "Báo cáo" (REPORT)

**Mục đích:** Báo cáo tổng hợp đa chiều.

**Backend:**
- Endpoint mới: `GET /api/v5/revenue/report` — with breakdown dimension (department/customer/product/time)

**Frontend:**
- Component mới: `frontend/components/revenue-mgmt/RevenueReportView.tsx`
- 4 report tabs: Theo phòng ban | Theo khách hàng | Theo sản phẩm | Theo thời gian
- Export Excel support

---

## Phần 7: Files chính cần tạo/sửa

### Tạo mới:
| File | Mục đích |
|------|----------|
| `backend/database/migrations/2026_03_25_200000_add_performance_indexes_to_fee_collection.php` | Index bổ sung R1-R5 |
| `frontend/components/revenue-mgmt/RevenueByContractView.tsx` | Sub-view theo HĐ |
| `frontend/components/revenue-mgmt/RevenueByCollectionView.tsx` | Sub-view theo thu cước |
| `frontend/components/revenue-mgmt/RevenueForecastView.tsx` | Sub-view dự báo |
| `frontend/components/revenue-mgmt/RevenueReportView.tsx` | Sub-view báo cáo |
| `backend/app/Services/V5/Revenue/RevenueByContractService.php` | Business logic theo HĐ |
| `backend/app/Services/V5/Revenue/RevenueForecastService.php` | Business logic dự báo |
| `backend/app/Services/V5/Revenue/RevenueReportService.php` | Business logic báo cáo |
| `plan-code/Doanh_thu_codex_plan_review.md` | File review/audit output |

### Sửa:
| File | Thay đổi |
|------|----------|
| `frontend/components/RevenueManagementHub.tsx` | Replace 4 placeholder với component thực |
| `frontend/shared/stores/revenueStore.ts` | Thêm state cho sub-views mới |
| `frontend/types.ts` | Thêm interfaces cho by-contract, forecast, report |
| `frontend/services/v5Api.ts` | Thêm API functions |
| `backend/routes/api.php` | Thêm routes |
| `backend/app/Http/Controllers/Api/V5/RevenueManagementController.php` | Thêm endpoint methods |

---

## Phần 8: Thứ tự thực hiện (Step-by-step)

### Phase A: Index + Markdown audit (chạy trước)
1. ✅ Tạo migration `add_performance_indexes_to_fee_collection.php` (R1-R5)
2. ✅ Fix ISSUE-2 trong `DebtAgingReportService.php` — parameterize SQL
3. ✅ Tạo file `plan-code/Doanh_thu_codex_plan_review.md` — copy nội dung phân tích
4. ✅ Chạy `php artisan test` — 245 tests passed

### Phase B: Backend — 3 services + routes + controller mới
5. ✅ Tạo `RevenueByContractService.php` — tái sử dụng ContractRevenueAnalyticsService patterns
6. ✅ Tạo `RevenueForecastService.php` — upcoming schedules + pipeline logic
7. ✅ Tạo `RevenueReportService.php` — multi-dimension aggregation
8. ✅ Thêm 5 endpoints vào `RevenueManagementController.php`
9. ✅ Thêm 5 routes vào `api.php`
10. ✅ Chạy `php artisan test` — 245 tests passed

### Phase C: Frontend — types + API + 4 components
11. ✅ Thêm interfaces vào `types.ts`
12. ✅ Thêm API functions vào `v5Api.ts`
13. ✅ Tạo `RevenueByContractView.tsx` — drill-down, search, sort, pagination
14. ✅ Tạo `RevenueByCollectionView.tsx` — reuse FeeCollectionDashboard data
15. ✅ Tạo `RevenueForecastView.tsx` — horizon selector, forecast bars, by-status
16. ✅ Tạo `RevenueReportView.tsx` — 4 dimension tabs (phòng ban, KH, sản phẩm, thời gian)
17. ✅ Update `RevenueManagementHub.tsx` — replace 4 placeholder
18. ✅ TypeScript check: 0 new errors (1 pre-existing unrelated)
19. ✅ Backend tests: 245 passed (2229 assertions)

---

## Phần 9: Verification

### Scope đã chọn: ✅ Full — Index + 4 sub-view (cả backend lẫn frontend)

### Test thủ công:
1. Chạy migration: `cd backend && php artisan migrate`
2. Kiểm tra index: `SHOW INDEX FROM invoices; SHOW INDEX FROM receipts;`
3. Frontend dev server: `cd frontend && npm run dev` → navigate đến tab Quản trị Doanh thu
4. Kiểm tra tất cả 5 sub-view hoạt động, không còn placeholder

### Test tự động:
1. `cd backend && php artisan test` — đảm bảo migration không break existing tests
2. `cd frontend && npm test` — unit tests
3. `cd frontend && npm run test:e2e` — E2E (nếu có)

### Performance validation:
1. `EXPLAIN` các query overdue, aging, dashboard trên invoices 10K+ rows
2. Xác nhận index R1, R4 được sử dụng (không full table scan)
