# Plan: Menu "Quản trị Doanh thu" — Trung tâm Quản lý Doanh thu Doanh nghiệp

> **Ngày lập:** 2026-03-23
> **Trạng thái:** Chờ review
> **Phụ thuộc:** Plan "Hub Hợp đồng & Doanh thu" (đã triển khai), Plan "Thu Cước" (chờ triển khai)
> **Yêu cầu:** Tạo menu quản trị doanh thu tổng hợp, kết nối dữ liệu hợp đồng và thu cước phục vụ công tác quản lý doanh thu

---

## MỤC LỤC

1. [Bối cảnh & Mục tiêu](#1-bối-cảnh--mục-tiêu)
2. [Phân tích hiện trạng](#2-phân-tích-hiện-trạng)
3. [Kiến trúc tổng quan](#3-kiến-trúc-tổng-quan)
4. [Database Design](#4-database-design)
5. [Backend Architecture](#5-backend-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [API Endpoints](#7-api-endpoints)
8. [Sub-view: Tổng quan Doanh thu (Dashboard)](#8-sub-view-tổng-quan-doanh-thu)
9. [Sub-view: Doanh thu theo Hợp đồng](#9-sub-view-doanh-thu-theo-hợp-đồng)
10. [Sub-view: Doanh thu theo Thu cước](#10-sub-view-doanh-thu-theo-thu-cước)
11. [Sub-view: Dự báo & Kế hoạch Doanh thu](#11-sub-view-dự-báo--kế-hoạch-doanh-thu)
12. [Sub-view: Báo cáo Tổng hợp](#12-sub-view-báo-cáo-tổng-hợp)
13. [Phân quyền](#13-phân-quyền)
14. [Hiệu năng](#14-hiệu-năng)
15. [Files tạo mới & sửa](#15-files-tạo-mới--sửa)
16. [Phased Rollout](#16-phased-rollout)
17. [Test Plan](#17-test-plan)

---

## 1. Bối cảnh & Mục tiêu

### Bối cảnh

Hệ thống hiện tại có 2 nguồn dữ liệu doanh thu phân tán:

**Nguồn 1 — Hợp đồng (`contracts` + `payment_schedules`):**
- Hợp đồng CRUD, status workflow (DRAFT → SIGNED → RENEWED)
- Kỳ thanh toán tự sinh (EVEN/MILESTONE), 6 trạng thái (PENDING → PAID)
- Revenue Analytics: KPIs, by_period, by_cycle, by_contract, by_item
- ✅ Đã triển khai trong tab `?tab=contracts` (view REVENUE)

**Nguồn 2 — Thu cước (`invoices` + `receipts`):**
- Hóa đơn, phiếu thu, aging report, dunning
- ❌ Đang chờ triển khai (plan `Quan_ly_thu_cuoc.md`)

**Vấn đề hiện tại:**
- ❌ Không có cái nhìn tổng hợp: lãnh đạo phải vào 2 tab riêng biệt để nắm bức tranh doanh thu
- ❌ Không so sánh được: doanh thu dự kiến (từ hợp đồng) vs thực thu (từ thu cước) ở cùng 1 dashboard
- ❌ Không có dự báo doanh thu: dựa trên hợp đồng hiện có + pipeline cơ hội (opportunities)
- ❌ Không có kế hoạch doanh thu: chỉ tiêu theo tháng/quý/năm so với thực hiện
- ❌ Không có báo cáo tổng hợp cross-source: doanh thu theo phòng ban, khách hàng, sản phẩm/dịch vụ
- ❌ Không có cảnh báo proactive: ngưỡng doanh thu thấp hơn kế hoạch

### Mục tiêu

Tạo menu **"Quản trị Doanh thu"** (tab id: `revenue_mgmt`) trong sidebar, đóng vai trò **trung tâm chỉ huy doanh thu** cho lãnh đạo và bộ phận tài chính:

1. **Dashboard Tổng quan** — KPI doanh thu toàn công ty, so sánh kế hoạch vs thực hiện, cảnh báo
2. **Doanh thu theo Hợp đồng** — tái sử dụng + mở rộng `ContractRevenueAnalyticsService`
3. **Doanh thu theo Thu cước** — tái sử dụng + mở rộng `FeeCollectionDashboardService`
4. **Dự báo & Kế hoạch** — revenue forecast + target management
5. **Báo cáo Tổng hợp** — drill-down theo phòng ban, khách hàng, sản phẩm, thời gian

### Nguyên tắc thiết kế

| Nguyên tắc | Chi tiết |
|---|---|
| **Aggregation, not duplication** | Không duplicate data — aggregate từ `payment_schedules` + `invoices` + `receipts` |
| **Tái sử dụng tối đa** | Reuse `ContractRevenueAnalyticsService`, `FeeCollectionDashboardService`, `DebtAgingReportService` |
| **UI/UX nhất quán** | Pattern KPI cards, filter bar, sortable table, charts SVG giống các module hiện có |
| **Read-heavy optimization** | Materialized views / cache layer cho aggregate queries nặng |
| **Permission granular** | Tách quyền `revenue.read` riêng — chỉ leadership & finance team |
| **Reconciliation layer** | Doanh thu hợp đồng & thu cước là 2 TẦNG (forecast → billed → collected), KHÔNG phải 2 nguồn cộng dồn. Khi có thu cước, fee-collection supersedes contract payment_schedule data cho cùng 1 kỳ thanh toán |
| **Graceful degradation** | Mọi service/component phải hoạt động đúng khi module Thu cước chưa triển khai (invoice/receipt tables chưa tồn tại) |

---

## 2. Phân tích hiện trạng

### Data Flow hiện tại & Điểm kết nối

```
┌──────────────────────────────────────────────────────────────────┐
│                    NGUỒN DỮ LIỆU DOANH THU                       │
├───────────────────────────┬──────────────────────────────────────┤
│  HỢP ĐỒNG (đã triển khai)  │  THU CƯỚC (chờ triển khai)            │
│                           │                                      │
│  contracts                │  invoices (MỚI)                      │
│    → contract_items       │    → invoice_items                   │
│    → payment_schedules    │    → receipts                        │
│                           │    → dunning_logs                    │
│  ContractRevenue          │  FeeCollectionDashboard              │
│  AnalyticsService         │  Service                             │
│    → by_period            │    → dashboard KPIs                  │
│    → by_cycle             │    → by_month                        │
│    → by_contract          │  DebtAgingReportService              │
│    → by_item              │    → aging buckets                   │
│    → overdue_details      │    → debt_trend                     │
├───────────────────────────┴──────────────────────────────────────┤
│                     QUẢN TRỊ DOANH THU (MỚI)                     │
│                                                                   │
│  RevenueManagementService (MỚI)                                   │
│    → aggregate cả 2 nguồn                                        │
│    → revenue targets + forecast                                   │
│    → cross-dimension reports (dept, customer, product, time)     │
│                                                                   │
│  revenue_targets (MỚI) — kế hoạch doanh thu theo kỳ              │
│  revenue_snapshots (MỚI) — snapshot cuối kỳ cho báo cáo lịch sử │
└──────────────────────────────────────────────────────────────────┘
```

### Dữ liệu liên quan từ các module khác

| Entity hiện có | Vai trò trong Quản trị Doanh thu |
|---|---|
| `contracts` (SIGNED) | Doanh thu dự kiến, cơ sở tính kế hoạch |
| `payment_schedules` | Doanh thu kỳ vọng theo timeline, thực thu từ confirmation |
| `invoices` (khi triển khai) | Doanh thu hóa đơn phát hành, cơ sở tính công nợ |
| `receipts` (khi triển khai) | Thực thu chính thức, đối soát doanh thu |
| `customers` | Chiều phân tích: doanh thu theo khách hàng |
| `products` | Chiều phân tích: doanh thu theo sản phẩm/dịch vụ |
| `departments` | Chiều phân tích: doanh thu theo phòng ban |
| `projects` | Chiều phân tích: doanh thu theo dự án |
| `opportunities` | Dự báo pipeline: doanh thu tiềm năng từ cơ hội |

### Mô hình Reconciliation doanh thu (ISSUE-1 fix)

**Nguyên tắc cốt lõi:** Doanh thu hợp đồng (`payment_schedules`) và thu cước (`invoices` + `receipts`) KHÔNG phải 2 nguồn độc lập — chúng là 2 TẦNG của cùng 1 dòng doanh thu:

```
TẦNG 1 — FORECAST (Dự kiến):
  payment_schedules.expected_amount → doanh thu kỳ vọng từ hợp đồng
  Chỉ dùng khi chưa có invoice tương ứng

TẦNG 2 — BILLED (Đã phát hành HĐ):
  invoices.total_amount → doanh thu hóa đơn phát hành
  Supersedes payment_schedule khi invoice_items.payment_schedule_id IS NOT NULL

TẦNG 3 — COLLECTED (Đã thu):
  receipts.amount (linked to invoice) → thực thu chính thức
  HOẶC payment_schedules.actual_paid_amount (khi chưa có invoice system)
```

**Quy tắc chống double-count:**

```
Cho mỗi payment_schedule:
  IF linked invoice exists (payment_schedules.invoice_id IS NOT NULL):
    expected = invoice.total_amount   (TẦNG 2 supersedes TẦNG 1)
    collected = SUM(receipts.amount) WHERE invoice_id = linked_invoice
  ELSE:
    expected = payment_schedule.expected_amount   (TẦNG 1 only)
    collected = payment_schedule.actual_paid_amount (legacy confirmation)

KPI formulas (corrected):
  expected_revenue = SUM(COALESCE(invoice.total_amount, ps.expected_amount))
  actual_collected = SUM(COALESCE(receipt_sum, ps.actual_paid_amount))
  outstanding      = expected_revenue - actual_collected
```

**Khi module Thu cước chưa triển khai:**
- Tầng 2 & 3 không tồn tại → mọi metric fallback về Tầng 1 (payment_schedules only)
- Không có double-count vì chỉ có 1 tầng

**Khi module Thu cước đã triển khai:**
- Payment schedule có `invoice_id` → dùng invoice/receipt data
- Payment schedule không có `invoice_id` → giữ nguyên payment_schedule data
- NEVER sum cả hai cho cùng 1 kỳ thanh toán

---

## 3. Kiến trúc tổng quan

### Menu "Quản trị Doanh thu" trong Sidebar

```
Sidebar.tsx menuGroups → thêm group mới hoặc mở rộng group 'fin':

Phương án A — Group riêng (Khuyến nghị):
{
  id: 'revenue',
  label: 'Quản trị Doanh thu',
  icon: 'trending_up',
  items: [
    { id: 'revenue_mgmt', icon: 'monitoring', label: 'Doanh thu' }
  ]
}

Phương án B — Chung group Tài chính với Thu cước:
{
  id: 'fin',
  label: 'Tài chính',
  icon: 'account_balance',
  items: [
    { id: 'revenue_mgmt', icon: 'monitoring', label: 'Quản trị Doanh thu' },
    { id: 'fee_collection', icon: 'receipt_long', label: 'Thu cước' }
  ]
}
```

**Vị trí:** Sau group `legal` (Pháp lý & Lưu trữ), trước group `util` (Tiện ích).

**Lưu ý:** Phương án B phù hợp hơn nếu module Thu cước đã triển khai — nhóm chung "Tài chính" tránh sidebar quá nhiều group.

### Sub-views trong tab Quản trị Doanh thu

```
?tab=revenue_mgmt
├── Shared header: "Quản trị Doanh thu" + period selector (năm/quý/tháng) + sub-view toggle
│
├── [SUB-VIEW: OVERVIEW] ← default
│   ├── 8 KPI cards chính (doanh thu kế hoạch, dự kiến, thực thu, tồn đọng, tỷ lệ, tăng trưởng, ...)
│   ├── Biểu đồ: Kế hoạch vs Dự kiến vs Thực thu theo tháng (grouped bar chart)
│   ├── Biểu đồ: Doanh thu lũy kế + đường kế hoạch (line chart)
│   ├── Biểu đồ: Phân bổ doanh thu theo nguồn (hợp đồng mới, gia hạn, thu cước định kỳ)
│   ├── Widget: Top 5 KH đóng góp doanh thu cao nhất
│   ├── Widget: Top 5 phòng ban theo doanh thu
│   └── Widget: Cảnh báo (doanh thu dưới kế hoạch, quá hạn lớn, hợp đồng sắp hết hạn)
│
├── [SUB-VIEW: BY_CONTRACT]
│   ├── Period + filter: khách hàng, phòng ban, chu kỳ thanh toán, trạng thái
│   ├── KPI cards: tổng hợp đồng đang thực hiện, giá trị, đã thu, tồn đọng
│   ├── Bảng: Doanh thu theo hợp đồng (expandable → hạng mục sản phẩm)
│   ├── Biểu đồ: Doanh thu theo chu kỳ thanh toán (donut chart)
│   └── Overdue details
│
├── [SUB-VIEW: BY_COLLECTION]
│   ├── Period + filter: khách hàng, trạng thái hóa đơn
│   ├── KPI cards: hóa đơn phát hành, đã thu, công nợ, quá hạn
│   ├── Aging summary: 5 buckets (hiện tại, 1-30, 31-60, 61-90, >90)
│   ├── Bảng: Thu cước theo khách hàng (expandable → hóa đơn)
│   └── Biểu đồ: Xu hướng công nợ
│
├── [SUB-VIEW: FORECAST]
│   ├── Kế hoạch doanh thu: CRUD target theo tháng/quý/năm, phòng ban
│   ├── Bảng so sánh: Kế hoạch vs Thực hiện vs % Đạt (theo phòng ban, theo tháng)
│   ├── Biểu đồ: Forecast doanh thu 3-6 tháng tới (dựa trên hợp đồng + pipeline)
│   ├── Pipeline từ Opportunities: cơ hội × probability = weighted revenue
│   └── Gap analysis: khoảng cách giữa kế hoạch và dự báo
│
└── [SUB-VIEW: REPORT]
    ├── Báo cáo theo Phòng ban: doanh thu, tỷ lệ đạt KH, so sánh giữa các phòng
    ├── Báo cáo theo Khách hàng: top revenue, lifetime value, churn risk
    ├── Báo cáo theo Sản phẩm/Dịch vụ: doanh thu theo product, trend
    ├── Báo cáo theo Thời gian: MoM, QoQ, YoY comparison
    └── Export Excel / PDF
```

---

## 4. Database Design

### 4.1. Bảng `revenue_targets` (MỚI)

Lưu kế hoạch/chỉ tiêu doanh thu theo kỳ, phòng ban.

```sql
CREATE TABLE revenue_targets (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Kỳ kế hoạch
  period_type     VARCHAR(20) NOT NULL COMMENT 'MONTHLY | QUARTERLY | YEARLY',
  period_key      VARCHAR(10) NOT NULL COMMENT 'YYYY-MM | YYYY-QN | YYYY',
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,

  -- Phân loại
  dept_id         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 = toàn công ty, >0 = phòng ban cụ thể',
  target_type     VARCHAR(30) NOT NULL DEFAULT 'TOTAL'
                  COMMENT 'TOTAL | NEW_CONTRACT | RENEWAL | RECURRING',

  -- Giá trị
  target_amount   DECIMAL(18,2) NOT NULL DEFAULT 0.00 COMMENT 'Doanh thu kế hoạch',
  actual_amount   DECIMAL(18,2) NOT NULL DEFAULT 0.00 COMMENT 'Doanh thu thực hiện (snapshot)',
  achievement_pct DECIMAL(5,1) GENERATED ALWAYS AS (
    CASE WHEN target_amount > 0
      THEN ROUND(actual_amount / target_amount * 100, 1)
      ELSE 0
    END
  ) STORED COMMENT 'Tỷ lệ đạt KH (%)',

  -- Metadata
  notes           TEXT NULL,
  approved_by     BIGINT UNSIGNED NULL,
  approved_at     TIMESTAMP NULL,
  data_scope      VARCHAR(50) NULL,
  created_by      BIGINT UNSIGNED NULL,
  updated_by      BIGINT UNSIGNED NULL,
  created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL DEFAULT NULL,

  -- Constraints (ISSUE-4 fix: no nullable columns in unique key)
  UNIQUE KEY uq_target_period_dept_type (period_type, period_key, dept_id, target_type)
    COMMENT 'Active row uniqueness — SoftDeletes handled via app-level check',
  INDEX idx_rt_period (period_type, period_key),
  INDEX idx_rt_dept (dept_id),
  INDEX idx_rt_achievement (achievement_pct),
  INDEX idx_rt_active (deleted_at) COMMENT 'Fast filter for non-deleted rows'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Kế hoạch/chỉ tiêu doanh thu';
```

**Quyết định thiết kế:**
- `achievement_pct` GENERATED STORED → query-friendly cho bảng so sánh và cảnh báo
- `target_type` cho phép phân kế hoạch: tổng, hợp đồng mới, gia hạn, thu cước định kỳ
- `dept_id = 0` → kế hoạch toàn công ty; `> 0` → kế hoạch phòng ban (non-nullable, avoids MySQL nullable unique key issue)
- Unique constraint compound → mỗi kỳ + phòng ban + loại chỉ có 1 active record
- SoftDeletes — lưu lịch sử thay đổi kế hoạch. Unique key ở DB level không bao gồm `deleted_at` → app-level check: `whereNull('deleted_at')->where(...)` trước khi insert. Khi delete + re-create cùng scope → `forceDelete` bản cũ hoặc `update` bản đã soft-delete (ISSUE-4 R2 fix)

### 4.2. Bảng `revenue_snapshots` (MỚI)

Snapshot cuối kỳ cho báo cáo lịch sử — tránh recalculate từ transaction data.

```sql
CREATE TABLE revenue_snapshots (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Kỳ snapshot
  period_type     VARCHAR(20) NOT NULL COMMENT 'MONTHLY | QUARTERLY | YEARLY',
  period_key      VARCHAR(10) NOT NULL COMMENT 'YYYY-MM | YYYY-QN | YYYY',

  -- Chiều phân tích
  dimension_type  VARCHAR(30) NOT NULL DEFAULT 'COMPANY'
                  COMMENT 'COMPANY | DEPARTMENT | CUSTOMER | PRODUCT',
  dimension_id    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 khi dimension=COMPANY',
  dimension_label VARCHAR(255) NULL COMMENT 'Tên phòng ban / KH / SP (denormalized)',

  -- Doanh thu từ Hợp đồng (payment_schedules)
  contract_expected     DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  contract_collected    DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  contract_outstanding  DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  contract_count        INT NOT NULL DEFAULT 0,

  -- Doanh thu từ Thu cước (invoices + receipts)
  invoice_issued        DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  invoice_collected     DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  invoice_outstanding   DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  invoice_count         INT NOT NULL DEFAULT 0,

  -- Tổng hợp (reconciled — NOT additive, see 2.x reconciliation model)
  -- When fee collection active: total uses COALESCE(invoice, contract) per payment_schedule
  -- These columns store the already-reconciled totals (no double-counting)
  total_expected        DECIMAL(18,2) NOT NULL DEFAULT 0.00 COMMENT 'Reconciled expected',
  total_collected       DECIMAL(18,2) NOT NULL DEFAULT 0.00 COMMENT 'Reconciled collected',
  total_outstanding     DECIMAL(18,2) NOT NULL DEFAULT 0.00 COMMENT 'Reconciled outstanding',

  -- Kế hoạch (snapshot từ revenue_targets)
  target_amount         DECIMAL(18,2) NOT NULL DEFAULT 0.00,

  -- Metadata
  snapshot_at     TIMESTAMP NOT NULL COMMENT 'Thời điểm chụp snapshot',
  created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE KEY uq_snap_period_dim (period_type, period_key, dimension_type, dimension_id),
  INDEX idx_snap_period (period_type, period_key),
  INDEX idx_snap_dimension (dimension_type, dimension_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Snapshot doanh thu cuối kỳ';
```

**Quyết định thiết kế:**
- `dimension_type` + `dimension_id` → flexible multi-dimension: company, department, customer, product
- `dimension_label` denormalized → hiển thị báo cáo không cần JOIN
- Tách `contract_*` vs `invoice_*` → drill-down theo nguồn
- `total_*` GENERATED STORED → aggregate sẵn
- Không SoftDeletes → snapshot là immutable, chỉ overwrite bằng `--force`
- Snapshot sinh bởi artisan command (tương tự `crc:snapshot-hours`)

---

## 5. Backend Architecture

### 5.1. Models (2 mới)

| Model | Table | SoftDeletes | Audit |
|---|---|---|---|
| `RevenueTarget` | `revenue_targets` | ✅ | ✅ |
| `RevenueSnapshot` | `revenue_snapshots` | ❌ | ❌ (immutable) |

### 5.2. Service Layer

```
app/Services/V5/
├── Revenue/                                    ← MỚI: domain Quản trị Doanh thu
│   ├── RevenueOverviewService.php              ← Dashboard tổng hợp: aggregate 2 nguồn
│   ├── RevenueTargetService.php                ← CRUD kế hoạch doanh thu
│   ├── RevenueForecastService.php              ← Dự báo: pipeline + hợp đồng hiện có
│   ├── RevenueReportService.php                ← Báo cáo: by_dept, by_customer, by_product, by_time
│   └── RevenueSnapshotService.php              ← Sinh snapshot cuối kỳ
├── Contract/
│   └── ContractRevenueAnalyticsService.php     ← KHÔNG SỬA — reuse cho BY_CONTRACT sub-view
└── FeeCollection/
    ├── FeeCollectionDashboardService.php        ← KHÔNG SỬA — reuse cho BY_COLLECTION sub-view
    └── DebtAgingReportService.php               ← KHÔNG SỬA — reuse aging data
```

### 5.2a. Graceful Degradation Strategy (ISSUE-2 fix)

**Nguyên tắc:** Mọi service trong `Revenue/` PHẢI hoạt động đúng khi module Thu cước chưa triển khai.

**Implementation pattern:**

```php
// Trong RevenueOverviewService constructor:
private ?FeeCollectionDashboardService $feeCollectionDashboard;

// Check table existence once at service resolution:
private bool $feeCollectionAvailable;

public function __construct(
    ContractRevenueAnalyticsService $contractRevenue,
    V5DomainSupportService $support
) {
    $this->feeCollectionAvailable = $support->hasTable('invoices')
        && $support->hasTable('receipts');

    // Resolve FeeCollection services only if tables exist
    if ($this->feeCollectionAvailable) {
        $this->feeCollectionDashboard = app(FeeCollectionDashboardService::class);
    }
}
```

**Per-service degradation behavior:**

| Service | Khi Thu cước chưa có | Khi Thu cước đã có |
|---|---|---|
| `RevenueOverviewService` | KPIs chỉ từ `payment_schedules`. `invoice_*` fields = 0. `total_* = contract_*` | Full reconciliation per 2.x model |
| `RevenueForecastService` | Forecast chỉ từ contracts + opportunities | Forecast + invoice pipeline |
| `RevenueReportService` | Reports chỉ contract-based. `invoice_count` = 0 | Full cross-source |
| `RevenueSnapshotService` | Snapshot `invoice_*` columns = 0 | Full snapshot |
| Alert logic | No `HIGH_OVERDUE` invoice alerts | Full alerts |

**Frontend degradation:**

| Component | Khi Thu cước chưa có | Khi Thu cước đã có |
|---|---|---|
| `RevenueOverviewDashboard` | KPI cards `invoice_*` hiện "–" thay vì 0 | Full display |
| `RevenueByCollectionView` | Placeholder: "Module Thu cước chưa triển khai" | Full view |
| `RevenueReportView` | Ẩn cột/tab liên quan invoice | Full tabs |
| `RevenueAlertPanel` | Không hiện invoice-related alerts | Full alerts |

**API response includes availability flag:**

```json
{
  "meta": {
    "fee_collection_available": false,
    "data_sources": ["contracts"]
  },
  "data": { ... }
}
```

### 5.3. Controller

```php
// app/Http/Controllers/Api/V5/RevenueManagementController.php (MỚI)

class RevenueManagementController extends V5BaseController
{
    // Overview Dashboard
    public function overview(Request $request): JsonResponse
        // GET /api/v5/revenue/overview
        // Params: period_from, period_to, grouping (month|quarter), dept_id (optional)

    // Revenue Targets CRUD
    public function targetIndex(Request $request): JsonResponse
        // GET /api/v5/revenue/targets
    public function targetStore(Request $request): JsonResponse
        // POST /api/v5/revenue/targets
    public function targetUpdate(Request $request, int $id): JsonResponse
        // PUT /api/v5/revenue/targets/{id}
    public function targetDestroy(Request $request, int $id): JsonResponse
        // DELETE /api/v5/revenue/targets/{id}
    public function targetBulkStore(Request $request): JsonResponse
        // POST /api/v5/revenue/targets/bulk
        // Sinh kế hoạch hàng loạt cho nhiều phòng ban + nhiều tháng

    // Forecast
    public function forecast(Request $request): JsonResponse
        // GET /api/v5/revenue/forecast
        // Params: months_ahead (3|6|12), dept_id (optional)

    // Reports
    public function reportByDepartment(Request $request): JsonResponse
        // GET /api/v5/revenue/reports/by-department
    public function reportByCustomer(Request $request): JsonResponse
        // GET /api/v5/revenue/reports/by-customer
    public function reportByProduct(Request $request): JsonResponse
        // GET /api/v5/revenue/reports/by-product
    public function reportTimeSeries(Request $request): JsonResponse
        // GET /api/v5/revenue/reports/time-series
        // Params: comparison (MoM|QoQ|YoY)
}
```

### 5.4. RevenueOverviewService — Logic chi tiết

```php
class RevenueOverviewService
{
    // Dependencies (constructor injection)
    private ContractRevenueAnalyticsService $contractRevenue;
    private ?FeeCollectionDashboardService $feeCollectionDashboard; // nullable — nếu chưa triển khai Thu cước
    private V5DomainSupportService $support;

    /**
     * overview() — Dashboard tổng hợp
     *
     * Input: period_from, period_to, grouping (month|quarter), dept_id (optional)
     *
     * Logic:
     * 1. Gọi ContractRevenueAnalyticsService::analytics() lấy contract-based revenue
     * 2. Nếu feeCollectionAvailable → gọi dashboard() lấy invoice-based revenue
     * 3. Apply reconciliation model (2.x): invoice supersedes linked payment_schedule
     * 4. Query revenue_targets cho cùng period range → map vào từng period
     * 5. Tính aggregate KPIs
     *
     * ISSUE-3 fix — Live achievement computation:
     * - Kỳ hiện tại (period_end >= today): tính actual_amount LIVE từ payment_schedules/receipts
     * - Kỳ đã đóng (period_end < today): dùng revenue_snapshots.actual nếu có, fallback live
     * - achievement_pct tính realtime: KHÔNG phụ thuộc vào snapshot
     */
    public function overview(Request $request): array
    // Returns:
    // {
    //   kpis: RevenueOverviewKpis,
    //   by_period: RevenueOverviewPeriod[],
    //   by_source: RevenueBySource[],
    //   top_customers: TopRevenueCustomer[],
    //   top_departments: TopRevenueDepartment[],
    //   alerts: RevenueAlert[]
    // }
}
```

**KPI Cards (8 thẻ):**

```
kpis: {
  target_amount:        float,  // Kế hoạch doanh thu trong kỳ (từ revenue_targets)
  expected_revenue:     float,  // Doanh thu dự kiến — reconciled (see 2.x model: COALESCE invoice over ps)
  actual_collected:     float,  // Thực thu — reconciled (see 2.x model: COALESCE receipt over ps)
  outstanding:          float,  // Tồn đọng = expected - actual
  achievement_pct:      float,  // Tỷ lệ đạt KH = (actual / target) × 100 — LIVE computed (ISSUE-3 fix)
  collection_rate:      float,  // Tỷ lệ thu = (actual / expected) × 100
  growth_pct:           float,  // Tăng trưởng vs cùng kỳ trước
  overdue_amount:       float   // Tổng quá hạn (reconciled — no double-count per ISSUE-1 fix)
}
```

**by_period — Reconciled per-period data (ISSUE-1 R2 fix):**

```
by_period: [{
  period_key:            "2026-01",
  period_label:          "Tháng 1/2026",
  target:                float,   // Từ revenue_targets
  contract_expected:     float,   // Diagnostic: layer 1 chỉ từ payment_schedules (trước reconciliation)
  contract_actual:       float,   // Diagnostic: layer 1 actual
  invoice_expected:      float,   // Diagnostic: layer 2 chỉ từ invoices (0 nếu chưa có Thu cước)
  invoice_actual:        float,   // Diagnostic: layer 3 từ receipts
  total_expected:        float,   // RECONCILED: COALESCE(invoice, contract) — NOT additive
  total_actual:          float,   // RECONCILED: COALESCE(receipt, ps.actual) — NOT additive
  cumulative_target:     float,
  cumulative_expected:   float,   // Cumulative of reconciled total_expected
  cumulative_actual:     float,   // Cumulative of reconciled total_actual
  achievement_pct:       float    // (total_actual / target) × 100 — LIVE computed
}]
```

> **Quan trọng:** `contract_*` và `invoice_*` là breakdown chẩn đoán (diagnostic layers). `total_*` là giá trị đã reconcile theo mô hình 2.x — KHÔNG PHẢI phép cộng. Charts và KPIs sử dụng `total_*`.

**by_source — Phân bổ theo nguồn:**

```
by_source: [
  { source: "NEW_CONTRACT",  label: "Hợp đồng mới",     amount: float, pct: float },
  { source: "RENEWAL",       label: "Gia hạn",           amount: float, pct: float },
  { source: "RECURRING",     label: "Thu cước định kỳ",  amount: float, pct: float },
  { source: "ONE_TIME",      label: "Thu một lần",       amount: float, pct: float }
]
```

**Phân loại nguồn doanh thu:**
- `NEW_CONTRACT`: payment_schedules từ contracts có `status = 'SIGNED'` và `created_at` trong kỳ
- `RENEWAL`: payment_schedules từ contracts có `status = 'RENEWED'`
- `RECURRING`: payment_schedules từ contracts có `payment_cycle ∈ {MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY}`
- `ONE_TIME`: payment_schedules từ contracts có `payment_cycle = 'ONCE'`

### 5.5. RevenueTargetService — CRUD Logic

```php
class RevenueTargetService
{
    /**
     * index() — Danh sách kế hoạch + thực hiện
     *
     * Filters: period_type, period_key (year), dept_id
     * Returns: targets with achievement data:
     *   - Open periods (period_end >= today): actual_amount computed LIVE from
     *     reconciled payment_schedules/invoices/receipts (ISSUE-3 R2 fix)
     *   - Closed periods (period_end < today): actual_amount from revenue_snapshots,
     *     fallback to live computation if snapshot missing
     *   - achievement_pct always = (actual / target) × 100, computed at response time
     */
    public function index(Request $request): array

    /**
     * store() — Tạo kế hoạch doanh thu
     *
     * Validation:
     * - period_type: required, in:[MONTHLY,QUARTERLY,YEARLY]
     * - period_key: required, format tuỳ type (YYYY-MM, YYYY-Q1..Q4, YYYY)
     * - target_amount: required, numeric, min:0
     * - dept_id: integer, min:0, default:0 (0 = toàn công ty) — ISSUE-4 R2 fix
     * - target_type: in:[TOTAL,NEW_CONTRACT,RENEWAL,RECURRING], default:TOTAL
     * - Unique constraint: (period_type, period_key, dept_id, target_type)
     *   App-level check: reject if active (non-deleted) record exists with same key
     */
    public function store(Request $request): RevenueTarget

    /**
     * bulkStore() — Sinh kế hoạch hàng loạt
     *
     * Input: {
     *   year: 2026,
     *   period_type: "MONTHLY",
     *   dept_ids: [1, 2, 3],   // 0 = toàn công ty (ISSUE-4 R2 fix: use 0 not null)
     *   targets: [
     *     { period_key: "2026-01", amount: 500000000 },
     *     { period_key: "2026-02", amount: 550000000 },
     *     ...
     *   ]
     * }
     *
     * Logic: Upsert — nếu đã tồn tại thì update target_amount
     */
    public function bulkStore(Request $request): array
}
```

### 5.6. RevenueForecastService — Logic Dự báo

```php
class RevenueForecastService
{
    /**
     * forecast() — Dự báo doanh thu tương lai
     *
     * Input: months_ahead (3|6|12), dept_id (optional)
     *
     * Logic tính doanh thu dự báo cho mỗi tháng tương lai:
     *
     * 1. Contracted revenue (chắc chắn):
     *    SELECT SUM(expected_amount)
     *    FROM payment_schedules
     *    WHERE status IN ('PENDING','INVOICED')
     *      AND expected_date BETWEEN month_start AND month_end
     *      AND contract_id IN (SELECT id FROM contracts WHERE status='SIGNED')
     *
     * 2. Renewal pipeline (khả năng cao):
     *    Contracts sắp hết hạn (expiry_date trong 3 tháng tới)
     *    × renewal_probability (config: 80% default)
     *    × contract.value / 12 (monthly equivalent)
     *
     * 3. Opportunity pipeline (uncertain):
     *    SELECT SUM(value * probability / 100) as weighted_value
     *    FROM opportunities
     *    WHERE status IN ('OPEN','QUALIFIED','PROPOSAL')
     *      AND estimated_close_date BETWEEN month_start AND month_end
     *
     * 4. Historical trend adjustment:
     *    Tính seasonality factor từ doanh thu thực 12 tháng trước
     *    month_factor = actual_month_X / avg_monthly → hệ số mùa vụ
     *
     * Returns: [{
     *   month_key, month_label,
     *   contracted: float,        // Chắc chắn từ payment_schedules
     *   renewal_estimate: float,  // Ước tính gia hạn
     *   pipeline_weighted: float, // Cơ hội × xác suất
     *   trend_adjusted: float,    // Điều chỉnh theo mùa vụ
     *   forecast_total: float,    // Tổng dự báo
     *   target: float,            // Kế hoạch (nếu đã set)
     *   gap: float                // forecast - target (âm = thiếu)
     * }]
     */
    public function forecast(Request $request): array
}
```

### 5.7. RevenueReportService — Báo cáo Multi-dimension

```php
class RevenueReportService
{
    /**
     * byDepartment() — Doanh thu theo phòng ban
     *
     * Logic: Aggregate payment_schedules + invoices theo dept_id
     *   (contract.dept_id hoặc contract.project.department_id)
     *
     * Returns: [{
     *   dept_id, dept_code, dept_name,
     *   target_amount, expected_revenue, actual_collected, outstanding,
     *   achievement_pct, collection_rate,
     *   contract_count, invoice_count
     * }]
     */
    public function byDepartment(Request $request): array

    /**
     * byCustomer() — Doanh thu theo khách hàng
     *
     * Returns: [{
     *   customer_id, customer_code, customer_name,
     *   contract_count, total_contract_value,
     *   expected_revenue, actual_collected, outstanding,
     *   collection_rate,
     *   last_payment_date  // Ngày thanh toán gần nhất
     * }]
     */
    public function byCustomer(Request $request): array

    /**
     * byProduct() — Doanh thu theo sản phẩm/dịch vụ
     *
     * Logic: Aggregate từ contract_items → proportional revenue allocation
     *   (pattern giống ContractRevenueAnalyticsService::by_item)
     *
     * Returns: [{
     *   product_id, product_code, product_name, unit,
     *   total_quantity, total_line_value,
     *   allocated_expected, allocated_actual, allocated_outstanding,
     *   contract_count
     * }]
     */
    public function byProduct(Request $request): array

    /**
     * timeSeries() — So sánh MoM / QoQ / YoY
     *
     * Input: comparison (MoM|QoQ|YoY), periods_count (default: 12 for MoM, 8 for QoQ, 5 for YoY)
     *
     * Returns: [{
     *   current_period_key, current_label, current_value,
     *   previous_period_key, previous_label, previous_value,
     *   change_amount, change_pct  // (current - previous) / previous × 100
     * }]
     */
    public function timeSeries(Request $request): array
}
```

### 5.8. Artisan Command — Snapshot

```php
// app/Console/Commands/RevenueSnapshotCommand.php

// Giống pattern crc:snapshot-hours
// Usage:
//   php artisan revenue:snapshot              # Sinh snapshot tháng trước
//   php artisan revenue:snapshot 2026-03      # Tháng cụ thể
//   php artisan revenue:snapshot 2026-Q1      # Quý cụ thể
//   php artisan revenue:snapshot 2026         # Năm
//   php artisan revenue:snapshot --force      # Ghi đè nếu đã có

class RevenueSnapshotCommand extends Command
{
    protected $signature = 'revenue:snapshot
        {period? : YYYY-MM hoặc YYYY-QN hoặc YYYY, default = tháng trước}
        {--force : Ghi đè snapshot hiện có}';

    // Logic:
    // 1. Xác định period_type từ format input
    // 2. Query aggregate từ payment_schedules + invoices + receipts
    // 3. Group by 4 dimensions: COMPANY, DEPARTMENT, CUSTOMER, PRODUCT
    // 4. Upsert vào revenue_snapshots
    // 5. Update revenue_targets.actual_amount cho cùng period
}
```

### 5.9. Alert Logic — Cảnh báo proactive

```php
// Nằm trong RevenueOverviewService::overview()

alerts: [
  {
    type: "UNDER_TARGET",
    severity: "WARNING" | "CRITICAL",
    message: "Doanh thu T3/2026 đạt 65% kế hoạch (còn 10 ngày)",
    context: { period_key, achievement_pct, gap_amount, days_remaining }
  },
  {
    type: "HIGH_OVERDUE",
    severity: "CRITICAL",
    message: "Tổng nợ quá hạn > 90 ngày: 500M VND (3 khách hàng)",
    context: { overdue_amount, customer_count, bucket: "over_90" }
  },
  {
    type: "CONTRACT_EXPIRING",
    severity: "INFO",
    message: "15 hợp đồng hết hạn trong 30 ngày tới (giá trị: 2.5 tỷ)",
    context: { contract_count, total_value, days_range: 30 }
  },
  {
    type: "COLLECTION_DROP",
    severity: "WARNING",
    message: "Tỷ lệ thu T3 (58%) giảm 12% so với T2 (70%)",
    context: { current_rate, previous_rate, change_pct }
  }
]

// Ngưỡng cảnh báo (config):
// UNDER_TARGET:
//   WARNING: achievement_pct < 80% khi đã qua 70% thời gian trong kỳ
//   CRITICAL: achievement_pct < 60% khi đã qua 80% thời gian trong kỳ
// HIGH_OVERDUE:
//   CRITICAL: SUM(bucket_over_90) > configurable threshold
// COLLECTION_DROP:
//   WARNING: collection_rate giảm > 10% so với kỳ trước
```

---

## 6. Frontend Architecture

### 6.1. Cấu trúc files

```
frontend/
├── shared/stores/
│   └── revenueStore.ts                        ← MỚI: Zustand store (ISSUE-5 fix)
├── components/
│   ├── RevenueManagementHub.tsx               ← MỚI: hub component chính
│   ├── revenue-mgmt/                          ← MỚI: sub-components
│   ├── RevenueOverviewDashboard.tsx          ← Dashboard tổng quan (8 KPIs + charts + widgets)
│   ├── RevenueByContractView.tsx             ← Doanh thu theo hợp đồng (reuse ContractRevenueView patterns)
│   ├── RevenueByCollectionView.tsx           ← Doanh thu theo thu cước (reuse FeeCollection patterns)
│   ├── RevenueForecastView.tsx               ← Dự báo + kế hoạch
│   ├── RevenueTargetModal.tsx                ← Modal CRUD kế hoạch doanh thu
│   ├── RevenueTargetBulkModal.tsx            ← Modal nhập kế hoạch hàng loạt (bảng lưới)
│   ├── RevenueReportView.tsx                 ← Báo cáo tổng hợp (tabs: phòng ban, KH, SP, thời gian)
│   ├── RevenueTargetVsActualChart.tsx        ← SVG grouped bar chart (target, expected, actual)
│   ├── RevenueCumulativeWithTargetChart.tsx   ← SVG line chart (lũy kế + đường KH)
│   ├── RevenueSourceDonutChart.tsx           ← SVG donut chart (phân bổ theo nguồn)
│   ├── RevenueForecastChart.tsx              ← SVG stacked area chart (forecast breakdown)
│   ├── RevenueAlertPanel.tsx                 ← Panel cảnh báo (severity badges)
│   └── RevenuePeriodSelector.tsx             ← Period selector component (tháng/quý/năm)
│
├── contract-revenue/                          ← HIỆN CÓ: TÁI SỬ DỤNG
│   ├── RevenueBarChart.tsx
│   └── RevenueCumulativeChart.tsx
```

### 6.2. Zustand Store — `revenueStore.ts` (ISSUE-5 fix)

```typescript
// frontend/shared/stores/revenueStore.ts
interface RevenueStoreState {
  // View navigation
  activeView: 'OVERVIEW' | 'BY_CONTRACT' | 'BY_COLLECTION' | 'FORECAST' | 'REPORT';
  reportTab: 'department' | 'customer' | 'product' | 'time';

  // Period filters (shared across sub-views)
  periodFrom: string;
  periodTo: string;
  periodType: RevenuePeriodType;
  grouping: 'month' | 'quarter';
  selectedDeptId: number | null;
  year: number;

  // Fee collection availability (from API meta)
  feeCollectionAvailable: boolean;

  // Actions
  setActiveView: (view: RevenueStoreState['activeView']) => void;
  setPeriod: (from: string, to: string) => void;
  setPeriodType: (type: RevenuePeriodType) => void;
  setDeptId: (id: number | null) => void;
  setFeeCollectionAvailable: (available: boolean) => void;
  syncFromUrl: () => void;
  syncToUrl: () => void;
}
```

**Lý do:** Zustand store cho phép:
1. Cross-view period sync (chuyển sub-view giữ nguyên period)
2. Alert panel click → navigate + set filter (không cần prop drilling qua Hub)
3. Sidebar shortcut → set activeView trực tiếp
4. Follow codebase convention (`uiStore.ts`, `toastStore.ts`)

### 6.3. Types (thêm vào types.ts)

```typescript
// ── Revenue Management ─────────────────────────────

export type RevenuePeriodType = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type RevenueTargetType = 'TOTAL' | 'NEW_CONTRACT' | 'RENEWAL' | 'RECURRING';
export type RevenueComparisonMode = 'MoM' | 'QoQ' | 'YoY';
export type RevenueAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type RevenueAlertType = 'UNDER_TARGET' | 'HIGH_OVERDUE' | 'CONTRACT_EXPIRING' | 'COLLECTION_DROP';

// ── Revenue Overview ────────────────────────────────

export interface RevenueOverviewKpis {
  target_amount: number;
  expected_revenue: number;
  actual_collected: number;
  outstanding: number;
  achievement_pct: number;
  collection_rate: number;
  growth_pct: number;
  overdue_amount: number;
}

export interface RevenueOverviewPeriod {
  period_key: string;
  period_label: string;
  target: number;
  contract_expected: number;
  contract_actual: number;
  invoice_expected: number;
  invoice_actual: number;
  total_expected: number;
  total_actual: number;
  cumulative_target: number;
  cumulative_expected: number;
  cumulative_actual: number;
  achievement_pct: number;
}

export interface RevenueBySource {
  source: string;
  label: string;
  amount: number;
  pct: number;
}

export interface TopRevenueCustomer {
  customer_id: number;
  customer_name: string;
  total_collected: number;
  contract_count: number;
  pct_of_total: number;
}

export interface TopRevenueDepartment {
  dept_id: number;
  dept_code: string;
  dept_name: string;
  target_amount: number;
  actual_collected: number;
  achievement_pct: number;
}

export interface RevenueAlert {
  type: RevenueAlertType;
  severity: RevenueAlertSeverity;
  message: string;
  context: Record<string, unknown>;
}

export interface RevenueOverview {
  kpis: RevenueOverviewKpis;
  by_period: RevenueOverviewPeriod[];
  by_source: RevenueBySource[];
  top_customers: TopRevenueCustomer[];
  top_departments: TopRevenueDepartment[];
  alerts: RevenueAlert[];
}

// ── Revenue Targets ─────────────────────────────────

export interface RevenueTarget {
  id: string | number;
  period_type: RevenuePeriodType;
  period_key: string;
  period_start: string;
  period_end: string;
  dept_id?: string | number | null;
  dept_name?: string | null;
  target_type: RevenueTargetType;
  target_amount: number;
  actual_amount: number;
  achievement_pct: number;
  notes?: string | null;
  approved_by?: string | number | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── Revenue Forecast ────────────────────────────────

export interface RevenueForecastMonth {
  month_key: string;
  month_label: string;
  contracted: number;
  renewal_estimate: number;
  pipeline_weighted: number;
  trend_adjusted: number;
  forecast_total: number;
  target: number;
  gap: number;
}

// ── Revenue Reports ─────────────────────────────────

export interface RevenueByDepartmentRow {
  dept_id: number;
  dept_code: string;
  dept_name: string;
  target_amount: number;
  expected_revenue: number;
  actual_collected: number;
  outstanding: number;
  achievement_pct: number;
  collection_rate: number;
  contract_count: number;
  invoice_count: number;
}

export interface RevenueByCustomerRow {
  customer_id: number;
  customer_code: string;
  customer_name: string;
  contract_count: number;
  total_contract_value: number;
  expected_revenue: number;
  actual_collected: number;
  outstanding: number;
  collection_rate: number;
  last_payment_date?: string | null;
}

export interface RevenueByProductRow {
  product_id: number;
  product_code: string;
  product_name: string;
  unit?: string | null;
  total_quantity: number;
  total_line_value: number;
  allocated_expected: number;
  allocated_actual: number;
  allocated_outstanding: number;
  contract_count: number;
}

export interface RevenueTimeSeriesRow {
  current_period_key: string;
  current_label: string;
  current_value: number;
  previous_period_key: string;
  previous_label: string;
  previous_value: number;
  change_amount: number;
  change_pct: number;
}
```

### 6.3. API Functions (thêm vào v5Api.ts)

```typescript
// ── Revenue Overview ────────────────────────────────
export async function fetchRevenueOverview(params: {
  period_from: string;
  period_to: string;
  grouping?: 'month' | 'quarter';
  dept_id?: number;
}): Promise<RevenueOverview>

// ── Revenue Targets ─────────────────────────────────
export async function fetchRevenueTargets(params: {
  period_type?: RevenuePeriodType;
  year?: number;
  dept_id?: number;
}): Promise<PaginatedResponse<RevenueTarget>>

export async function createRevenueTarget(data: Partial<RevenueTarget>): Promise<RevenueTarget>

export async function updateRevenueTarget(
  id: number | string,
  data: Partial<RevenueTarget>
): Promise<RevenueTarget>

export async function deleteRevenueTarget(id: number | string): Promise<void>

export async function bulkCreateRevenueTargets(data: {
  year: number;
  period_type: RevenuePeriodType;
  dept_ids?: number[];
  targets: Array<{ period_key: string; amount: number }>;
}): Promise<{ created: number; updated: number }>

// ── Revenue Forecast ────────────────────────────────
export async function fetchRevenueForecast(params: {
  months_ahead?: number;
  dept_id?: number;
}): Promise<RevenueForecastMonth[]>

// ── Revenue Reports ─────────────────────────────────
export async function fetchRevenueByDepartment(params: {
  period_from: string;
  period_to: string;
}): Promise<RevenueByDepartmentRow[]>

export async function fetchRevenueByCustomer(params: {
  period_from: string;
  period_to: string;
  page?: number;
  per_page?: number;
  q?: string;
}): Promise<PaginatedResponse<RevenueByCustomerRow>>

export async function fetchRevenueByProduct(params: {
  period_from: string;
  period_to: string;
}): Promise<RevenueByProductRow[]>

export async function fetchRevenueTimeSeries(params: {
  comparison: RevenueComparisonMode;
  periods_count?: number;
}): Promise<RevenueTimeSeriesRow[]>
```

### 6.4. RevenueManagementHub.tsx — Component chính

```
Pattern: Giống FeeCollectionHub / ContractList sub-view toggle

Props (từ App.tsx):
  - currentUser: AuthUser
  - departments: Department[]
  - canManageTargets: boolean   // revenue.targets permission

State ownership (ISSUE-10 fix):
  SHARED (from revenueStore.ts — Zustand):
    - activeView, periodFrom, periodTo, periodType, selectedDeptId, year
    - feeCollectionAvailable
    - URL sync: syncFromUrl() on mount, syncToUrl() on change
  LOCAL (ephemeral UI only):
    - isTargetModalOpen, editingTarget, isExporting
    - Any transient loading/error state per sub-view

Sub-view rendering:
  - OVERVIEW       → <RevenueOverviewDashboard />
  - BY_CONTRACT    → <RevenueByContractView /> (reuse ContractRevenueView with additional filters)
  - BY_COLLECTION  → <RevenueByCollectionView /> (reuse FeeCollection dashboard patterns)
  - FORECAST       → <RevenueForecastView /> + <RevenueTargetModal />
  - REPORT         → <RevenueReportView /> (tabs: Phòng ban | Khách hàng | Sản phẩm | Thời gian)
```

### 6.5. URL State Sync

Prefix params với `rv_` (revenue):

```
?tab=revenue_mgmt&rv_view=OVERVIEW&rv_period_from=2026-01-01&rv_period_to=2026-12-31&rv_grouping=month
?tab=revenue_mgmt&rv_view=FORECAST&rv_year=2026&rv_dept_id=5
?tab=revenue_mgmt&rv_view=REPORT&rv_report_tab=department&rv_period_from=2026-01-01&rv_period_to=2026-03-31
```

---

## 7. API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/v5/revenue/overview` | `revenue.read` | Dashboard tổng hợp KPIs + charts + alerts |
| GET | `/api/v5/revenue/by-contract` | `revenue.read` | Doanh thu theo hợp đồng (delegates to ContractRevenueAnalyticsService — ISSUE-6 fix) |
| GET | `/api/v5/revenue/by-collection` | `revenue.read` | Doanh thu theo thu cước (delegates to FeeCollectionDashboardService) |
| GET | `/api/v5/revenue/targets` | `revenue.read` | Danh sách kế hoạch doanh thu |
| POST | `/api/v5/revenue/targets` | `revenue.targets` | Tạo kế hoạch |
| PUT | `/api/v5/revenue/targets/{id}` | `revenue.targets` | Cập nhật kế hoạch |
| DELETE | `/api/v5/revenue/targets/{id}` | `revenue.targets` | Xóa kế hoạch |
| POST | `/api/v5/revenue/targets/bulk` | `revenue.targets` | Nhập kế hoạch hàng loạt |
| GET | `/api/v5/revenue/forecast` | `revenue.read` | Dự báo doanh thu 3-12 tháng |
| GET | `/api/v5/revenue/reports/by-department` | `revenue.read` | Báo cáo theo phòng ban |
| GET | `/api/v5/revenue/reports/by-customer` | `revenue.read` | Báo cáo theo khách hàng |
| GET | `/api/v5/revenue/reports/by-product` | `revenue.read` | Báo cáo theo sản phẩm |
| GET | `/api/v5/revenue/reports/time-series` | `revenue.read` | So sánh MoM/QoQ/YoY |
| POST | `/api/v5/revenue/reports/export` | `revenue.export` | Export Excel cho bất kỳ report (ISSUE-7 fix) |

### 7.1. Export Architecture (ISSUE-7 fix)

**Endpoint:** `POST /api/v5/revenue/reports/export`

```php
// Request:
{
  "report_type": "overview" | "by_department" | "by_customer" | "by_product" | "time_series" | "targets",
  "format": "xlsx",        // Chỉ hỗ trợ Excel (PDF deferred)
  "params": {              // Tham số filter tương tự GET endpoint tương ứng
    "period_from": "2026-01-01",
    "period_to": "2026-12-31",
    "comparison": "MoM"    // (cho time_series)
  }
}
```

**Strategy — Sync vs Async:**
- **Nhỏ (< 1000 rows):** Sync response → stream download trực tiếp (`Content-Disposition: attachment`)
- **Lớn (≥ 1000 rows):** Async qua `GenerateAsyncExportJob` (pattern hiện có) → trả `{ export_id }`, client poll `GET /api/v5/exports/{id}`

**Controller action:**

```php
public function exportReport(Request $request): JsonResponse|StreamedResponse
{
    $validated = $request->validate([
        'report_type' => 'required|in:overview,by_department,by_customer,by_product,time_series,targets',
        'format' => 'required|in:xlsx',
        'params' => 'required|array',
    ]);

    $data = match($validated['report_type']) {
        'by_department' => $this->reportService->byDepartment($request),
        'by_customer'   => $this->reportService->byCustomer($request),
        // ... etc
    };

    if (count($data) >= 1000) {
        // Async: dispatch GenerateAsyncExportJob
        return response()->json(['export_id' => $exportId]);
    }

    // Sync: stream Excel
    return $this->support->streamExcel($data, $columns, $filename);
}
```

**Excel format:**
- Currency: `#,##0` + " đ" suffix (Vietnamese format)
- Date: DD/MM/YYYY
- Header: tiếng Việt
- Sheet name: report_type + period
- Percentage: `#0.0%`

**Permission:** `revenue.export` — tách riêng để kiểm soát ai được download dữ liệu doanh thu

---

## 8. Sub-view: Tổng quan Doanh thu

### 8.1. KPI Cards (8 thẻ, 2 hàng × 4 cột)

**Hàng 1 — Giá trị tuyệt đối:**

| # | Label | Icon | Value | Color |
|---|---|---|---|---|
| 1 | Kế hoạch | `flag` | `target_amount` (VND) | Blue |
| 2 | Dự kiến | `event_upcoming` | `expected_revenue` (VND) | Indigo |
| 3 | Thực thu | `payments` | `actual_collected` (VND) | Green |
| 4 | Tồn đọng | `account_balance_wallet` | `outstanding` (VND) | Orange |

**Hàng 2 — Tỷ lệ & xu hướng:**

| # | Label | Icon | Value | Color |
|---|---|---|---|---|
| 5 | Đạt KH | `trophy` | `achievement_pct` (%) | Green/Red theo ngưỡng |
| 6 | Tỷ lệ thu | `percent` | `collection_rate` (%) | Green/Yellow/Red |
| 7 | Tăng trưởng | `trending_up` | `growth_pct` (%) | Green nếu > 0, Red nếu < 0 |
| 8 | Quá hạn | `warning` | `overdue_amount` (VND) | Red |

**Style:** bg-white, shadow-sm, rounded-lg, p-4 — giống KPI cards ContractList.

### 8.2. Charts (2 biểu đồ chính)

**Biểu đồ 1 — Kế hoạch vs Dự kiến vs Thực thu** (SVG grouped bar chart):
- 3 bars per period: target (blue outline/dashed), expected (indigo), actual (green)
- Nếu actual < target → bar actual có viền red
- Tooltip: hiện cả 3 giá trị + achievement_pct

**Biểu đồ 2 — Doanh thu lũy kế + Đường kế hoạch** (SVG line chart):
- 3 lines: cumulative_target (blue dashed), cumulative_expected (indigo), cumulative_actual (green)
- Area fill giữa actual và target: green nếu actual > target, red nếu actual < target
- Hiệu ứng: khoảng cách 2 đường chính = tồn đọng thực tế

**Biểu đồ 3 — Phân bổ theo nguồn** (SVG donut chart):
- 4 segments: HĐ mới, Gia hạn, Thu cước định kỳ, Thu một lần
- Center: tổng doanh thu thực thu
- Legend: label + amount + pct

### 8.3. Widgets

**Top 5 KH doanh thu cao nhất:**
- Bảng nhỏ: STT, Tên KH, Doanh thu, Số HĐ, % Tổng
- Click → filter BY_CONTRACT sub-view theo customer_id

**Top 5 phòng ban:**
- Horizontal bar chart nhỏ: dept_name, actual vs target, achievement_pct badge
- Click → filter với dept_id

**Panel Cảnh báo:**
- Severity badges: 🔴 CRITICAL (red), 🟡 WARNING (yellow), 🔵 INFO (blue)
- Mỗi alert: icon + message + nút hành động (link đến sub-view liên quan)

---

## 9. Sub-view: Doanh thu theo Hợp đồng

**Tái sử dụng** `ContractRevenueAnalyticsService` + mở rộng filter theo dept_id.

### 9.1. Filter Bar

| Filter | Type | Default |
|---|---|---|
| Kỳ | Date range | Năm hiện tại |
| Nhóm theo | Select: Tháng / Quý | Tháng |
| Phòng ban | SearchableSelect | Tất cả |
| Khách hàng | SearchableSelect | Tất cả |
| Chu kỳ TT | Select: ONCE, MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY | Tất cả |

### 9.2. Nội dung

- 5 KPI cards (reuse pattern từ ContractRevenueView): expected, actual, outstanding, overdue, collection_rate
- Bảng doanh thu theo hợp đồng (expandable → hạng mục)
- Bảng doanh thu theo chu kỳ thanh toán
- Biểu đồ bar: expected vs actual by period
- Overdue details table

**Implementation:** Tạo route riêng `GET /api/v5/revenue/by-contract` (permission: `revenue.read`) delegate nội bộ đến `ContractRevenueAnalyticsService`, KHÔNG gọi trực tiếp `GET /api/v5/contracts/revenue-analytics` (permission: `contracts.read`). Điều này tránh yêu cầu user phải có cả `contracts.read` — ISSUE-6 fix.

---

## 10. Sub-view: Doanh thu theo Thu cước

**Tái sử dụng** `FeeCollectionDashboardService` + `DebtAgingReportService`.

> **Lưu ý:** Sub-view này chỉ hoạt động SAU KHI module Thu cước được triển khai. Trước đó hiện placeholder: "Module Thu cước chưa triển khai. Vui lòng sử dụng tab Hợp đồng → Revenue để xem doanh thu."

### 10.1. Filter Bar

| Filter | Type |
|---|---|
| Kỳ | Date range |
| Khách hàng | SearchableSelect |
| Trạng thái HĐ | Select: ISSUED, PARTIAL, PAID, OVERDUE |

### 10.2. Nội dung

- 6 KPI cards (reuse FeeCollectionDashboard): expected, actual, outstanding, overdue, collection_rate, avg_days
- Aging summary: 5 buckets bar chart (horizontal stacked)
- Bảng thu cước theo khách hàng (expandable → hóa đơn)
- Biểu đồ xu hướng công nợ

**Implementation:** Gọi `GET /api/v5/revenue/by-collection` (revenue-scoped endpoint, permission `revenue.read`). Backend delegates nội bộ đến `FeeCollectionDashboardService` + `DebtAgingReportService`. KHÔNG gọi trực tiếp fee-collection endpoints — giữ nhất quán permission model (ISSUE-8 fix).

---

## 11. Sub-view: Dự báo & Kế hoạch Doanh thu

### 11.1. Kế hoạch Doanh thu (CRUD)

**Bảng lưới kế hoạch:**

```
┌──────────────┬────────────┬────────────┬────────────┬─── ... ──┬────────────┬─────────┐
│ Phòng ban    │  T1/2026   │  T2/2026   │  T3/2026   │          │  T12/2026  │  Cả năm │
├──────────────┼────────────┼────────────┼────────────┼─── ... ──┼────────────┼─────────┤
│ Toàn công ty │ [500M]     │ [550M]     │ [600M]     │          │ [800M]     │ 7,650M  │
│ PB Kinh doanh│ [200M]     │ [220M]     │ [250M]     │          │ [350M]     │ 3,180M  │
│ PB Kỹ thuật  │ [150M]     │ [160M]     │ [170M]     │          │ [250M]     │ 2,280M  │
│ PB Dịch vụ   │ [100M]     │ [110M]     │ [120M]     │          │ [150M]     │ 1,440M  │
│ Chưa phân bổ │  50M       │  60M       │  60M       │          │  50M       │  750M   │
├──────────────┼────────────┼────────────┼────────────┼─── ... ──┼────────────┼─────────┤
│ THỰC HIỆN    │  480M      │  520M      │  ???       │          │            │         │
│ % ĐẠT        │  96%  ✅   │  94.5% ✅  │  ???       │          │            │         │
└──────────────┴────────────┴────────────┴────────────┴─── ... ──┴────────────┴─────────┘
```

- `[xxx]` = ô input có thể edit (permission `revenue.targets`)
- Hàng "Chưa phân bổ" = Toàn công ty - SUM(phòng ban) → auto-calculated
- Hàng "THỰC HIỆN" = actual_collected từ revenue data
- Hàng "% ĐẠT" = actual / target × 100 → color: ≥90% green, 70-89% yellow, <70% red
- Nút "Lưu kế hoạch" → gọi `POST /api/v5/revenue/targets/bulk`
- Nút "Nhập từ Excel" → import template

### 11.2. Dự báo Doanh thu

**Biểu đồ Forecast** (SVG stacked area chart):

```
Y ▲
  │     ╔══════════════════════  Target line (blue dashed)
  │   ╱▓▓▓▓▓▓▓▓▓▓▓▓╲
  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╲       ← Pipeline weighted (lightest)
  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╲
  │████████████████████████╲    ← Renewal estimate (medium)
  │████████████████████████████  ← Contracted (darkest, most certain)
  └──────────────────────────────→ Time
     T4     T5     T6     T7     T8     T9
```

- 3 layers stacked: contracted (dark green), renewal_estimate (light green), pipeline_weighted (lightest)
- Đường target (blue dashed) overlay
- Khi forecast_total < target → highlight gap area in red

**Bảng chi tiết:**

| Tháng | HĐ đã ký | Ước tính gia hạn | Pipeline | Mùa vụ | Tổng dự báo | Kế hoạch | Chênh lệch |
|---|---|---|---|---|---|---|---|
| T4/2026 | 400M | 80M | 50M | +5% | 557M | 600M | -43M 🔴 |
| T5/2026 | 380M | 90M | 70M | +3% | 556M | 600M | -44M 🔴 |

### 11.3. Gap Analysis

- Nếu forecast < target: hiện recommendation panel
  - "Cần thêm X tỷ doanh thu từ pipeline để đạt kế hoạch T4-T6"
  - "Có Y hợp đồng sắp hết hạn cần gia hạn (giá trị Z tỷ)"
  - "Pipeline hiện có W cơ hội (giá trị qualified: V tỷ)"

---

## 12. Sub-view: Báo cáo Tổng hợp

### 12.1. Tabs phụ trong REPORT sub-view

```
REPORT sub-view
├── [Tab: Phòng ban]     ← Bảng dept + achievement + bar chart so sánh
├── [Tab: Khách hàng]    ← Bảng KH + doanh thu + collection_rate (paginated)
├── [Tab: Sản phẩm]      ← Bảng product + allocated revenue + trend
└── [Tab: Thời gian]     ← Bảng MoM/QoQ/YoY comparison + line chart
```

### 12.2. Báo cáo Phòng ban

**Bảng:**

| Phòng ban | Kế hoạch | Dự kiến | Thực thu | Tồn đọng | % Đạt KH | % Thu | Số HĐ |
|---|---|---|---|---|---|---|---|
| PB Kinh doanh | 1,000M | 950M | 820M | 130M | 82% ✅ | 86% | 45 |
| PB Kỹ thuật | 500M | 480M | 350M | 130M | 70% 🟡 | 73% | 28 |

- Sort by any column
- Click row → drill-down to contracts + payment details
- Bar chart: so sánh achievement_pct giữa các phòng ban

### 12.3. Báo cáo Khách hàng

**Bảng (paginated, searchable):**

| Khách hàng | Số HĐ | Giá trị HĐ | Dự kiến | Thực thu | Tồn đọng | % Thu | TT gần nhất |
|---|---|---|---|---|---|---|---|
| VNPT Corp | 12 | 5,000M | 2,500M | 2,200M | 300M | 88% | 15/03/2026 |

### 12.4. Báo cáo Sản phẩm

**Bảng:**

| Sản phẩm | ĐVT | Tổng SL | Giá trị | DT phân bổ | Thực thu | Tồn đọng | Số HĐ |
|---|---|---|---|---|---|---|---|

### 12.5. So sánh Thời gian

**Bảng MoM:**

| Tháng | Doanh thu | vs Tháng trước | Thay đổi (%) |
|---|---|---|---|
| T3/2026 | 820M | +70M | +9.3% ↑ |
| T2/2026 | 750M | +50M | +7.1% ↑ |

**Line chart:** Doanh thu 12 tháng gần nhất, đường trend line

### 12.6. Export

Mỗi tab báo cáo đều có nút "Xuất Excel":
- Định dạng: currency VND (`toLocaleString('vi-VN') + ' đ'`), date DD/MM/YYYY
- Header tiếng Việt
- Sheet name theo report type

---

## 13. Phân quyền

### 13.1. Permissions mới

```php
// Thêm vào seeder / config permissions
'revenue.read'     => 'Xem quản trị doanh thu',       // Dashboard, reports, forecast
'revenue.targets'  => 'Quản lý kế hoạch doanh thu',   // CRUD revenue_targets
'revenue.export'   => 'Xuất báo cáo doanh thu',       // Export Excel/PDF
```

### 13.2. Frontend tab visibility

```typescript
// utils/authorization.ts — canAccessTab()
case 'revenue_mgmt':
  return hasPermission(user, 'revenue.read');
```

### 13.3. Data scope

- `revenue.read` → thấy dữ liệu phòng ban mình + tổng hợp toàn công ty (anonymized nếu không có quyền xem PB khác)
- Manager → thấy chi tiết phòng ban mình quản lý
- Director / Admin → thấy tất cả phòng ban
- `revenue.targets` → chỉ leadership / finance team được set kế hoạch

---

## 14. Hiệu năng

### 14.1. Query Optimization

**Overview Dashboard — Aggregate query nặng nhất:**

```sql
-- Thay vì JOIN payment_schedules + invoices realtime cho mỗi lần load,
-- sử dụng revenue_snapshots cho kỳ đã đóng + realtime cho kỳ hiện tại:

IF period đã đóng (period_end < today):
  SELECT FROM revenue_snapshots WHERE period_type = ? AND period_key = ?
ELSE (kỳ hiện tại):
  Realtime aggregate từ payment_schedules + invoices
```

### 14.2. Caching Strategy

```php
// Cache key patterns
Cache::remember('v5:revenue:overview:' . md5(json_encode($params)), 900, fn() => ...);
Cache::remember('v5:revenue:forecast:' . md5(json_encode($params)), 1800, fn() => ...);
Cache::remember('v5:revenue:report:dept:' . md5(json_encode($params)), 900, fn() => ...);

// Invalidation:
// - Tạo/update revenue_target → forget overview + forecast cache
// - Revenue snapshot command → forget all revenue:* cache
// - Payment confirmation (trong ContractPaymentService) → forget overview cache
// - Receipt creation (trong ReceiptDomainService) → forget overview cache
```

### 14.3. Frontend Performance

- **Lazy render sub-views:** Chỉ mount component khi sub-view active
- **Revenue Snapshots → instant load:** Kỳ đã đóng load từ snapshot (< 50ms)
- **GET deduplication:** `v5Api.ts` đã có `inFlightGetRequests`
- **AbortController:** Huỷ request cũ khi period/filter thay đổi nhanh
- **Memoized:** `useMemo` cho currency formatting, chart data transformation
- **Virtual scroll:** Cho bảng báo cáo khách hàng có > 100 rows

---

## 15. Files tạo mới & sửa

### Files MỚI (17 files)

| # | File | Mô tả |
|---|---|---|
| 1 | `backend/database/migrations/xxxx_create_revenue_targets_table.php` | Migration bảng revenue_targets |
| 2 | `backend/database/migrations/xxxx_create_revenue_snapshots_table.php` | Migration bảng revenue_snapshots |
| 3 | `backend/app/Models/RevenueTarget.php` | Model RevenueTarget |
| 4 | `backend/app/Models/RevenueSnapshot.php` | Model RevenueSnapshot |
| 5 | `backend/app/Http/Controllers/Api/V5/RevenueManagementController.php` | Controller |
| 6 | `backend/app/Services/V5/Revenue/RevenueOverviewService.php` | Service dashboard tổng hợp |
| 7 | `backend/app/Services/V5/Revenue/RevenueTargetService.php` | Service CRUD kế hoạch |
| 8 | `backend/app/Services/V5/Revenue/RevenueForecastService.php` | Service dự báo |
| 9 | `backend/app/Services/V5/Revenue/RevenueReportService.php` | Service báo cáo multi-dimension |
| 10 | `backend/app/Services/V5/Revenue/RevenueSnapshotService.php` | Service sinh snapshot |
| 11 | `backend/app/Console/Commands/RevenueSnapshotCommand.php` | Artisan command snapshot |
| 12 | `frontend/shared/stores/revenueStore.ts` | Zustand store (ISSUE-5 fix) |
| 13 | `frontend/components/RevenueManagementHub.tsx` | Hub component chính |
| 13 | `frontend/components/revenue-mgmt/RevenueOverviewDashboard.tsx` | Dashboard tổng quan |
| 14 | `frontend/components/revenue-mgmt/RevenueForecastView.tsx` | Dự báo + kế hoạch |
| 15 | `frontend/components/revenue-mgmt/RevenueTargetModal.tsx` | Modal CRUD kế hoạch |
| 16 | `frontend/components/revenue-mgmt/RevenueTargetBulkModal.tsx` | Modal nhập hàng loạt |
| 17 | `frontend/components/revenue-mgmt/RevenueReportView.tsx` | Báo cáo tổng hợp |
| 18 | `frontend/components/revenue-mgmt/RevenueByContractView.tsx` | DT theo hợp đồng |
| 19 | `frontend/components/revenue-mgmt/RevenueByCollectionView.tsx` | DT theo thu cước |
| 20 | `frontend/components/revenue-mgmt/RevenueTargetVsActualChart.tsx` | Chart target vs actual |
| 21 | `frontend/components/revenue-mgmt/RevenueCumulativeWithTargetChart.tsx` | Chart lũy kế + KH |
| 22 | `frontend/components/revenue-mgmt/RevenueSourceDonutChart.tsx` | Chart phân bổ nguồn |
| 23 | `frontend/components/revenue-mgmt/RevenueForecastChart.tsx` | Chart forecast stacked |
| 24 | `frontend/components/revenue-mgmt/RevenueAlertPanel.tsx` | Panel cảnh báo |
| 25 | `frontend/components/revenue-mgmt/RevenuePeriodSelector.tsx` | Period selector |

### Files SỬA (7 files)

| # | File | Thay đổi |
|---|---|---|
| 1 | `frontend/components/Sidebar.tsx` | Thêm group `fin`/`revenue` với item `revenue_mgmt` |
| 2 | `frontend/types.ts` | Thêm interfaces RevenueOverview, RevenueTarget, Forecast, Report types |
| 3 | `frontend/services/v5Api.ts` | Thêm API functions cho revenue overview, targets, forecast, reports |
| 4 | `frontend/utils/authorization.ts` | Thêm `revenue_mgmt` vào `canAccessTab()`, thêm permission checks |
| 5 | `frontend/App.tsx` | Thêm state + render RevenueManagementHub trong tab switch |
| 6 | `backend/routes/api.php` | Thêm route group `/revenue/*` |
| 7 | `backend/app/Services/V5/Contract/ContractRevenueAnalyticsService.php` | Thêm optional `dept_id` filter param |

### Files KHÔNG SỬA

| File | Lý do |
|---|---|
| `ContractDomainService.php` | Không can thiệp logic hợp đồng |
| `ContractPaymentService.php` | Không sửa, chỉ cache invalidation hookable |
| `FeeCollectionDashboardService.php` | Reuse qua DI, không sửa |
| `DebtAgingReportService.php` | Reuse qua DI, không sửa |
| `ContractList.tsx` | Tab hợp đồng giữ nguyên độc lập |
| `ContractRevenueView.tsx` | Giữ nguyên trong tab hợp đồng |

---

## 16. Phased Rollout

### Phase 1 (Tuần 1-2): Foundation + Overview Dashboard + Minimal Targets

**Phụ thuộc:** Không (sử dụng dữ liệu `payment_schedules` hiện có)

| Task | Files |
|---|---|
| 2 migrations (revenue_targets, revenue_snapshots) | `database/migrations/` |
| 2 models (RevenueTarget, RevenueSnapshot) | `app/Models/` |
| RevenueOverviewService (live achievement, no snapshot dependency — ISSUE-3 fix) | `Revenue/RevenueOverviewService.php` |
| RevenueTargetService (full CRUD + bulk — moved from Phase 2 — ISSUE-3 fix) | `Revenue/RevenueTargetService.php` |
| RevenueManagementController (overview + target CRUD) | `RevenueManagementController.php` |
| Routes | `api.php` |
| Frontend types + API functions | `types.ts`, `v5Api.ts` |
| Sidebar + authorization | `Sidebar.tsx`, `authorization.ts`, `App.tsx` |
| Zustand store `revenueStore.ts` (ISSUE-5 fix) | `shared/stores/revenueStore.ts` |
| RevenueManagementHub (shell + OVERVIEW) | `RevenueManagementHub.tsx` |
| RevenueOverviewDashboard (KPIs + charts) | `RevenueOverviewDashboard.tsx` |
| Charts (TargetVsActual, Cumulative, SourceDonut) | `revenue-mgmt/*.tsx` |
| Alert panel | `RevenueAlertPanel.tsx` |
| RevenueTargetModal + BulkModal | `RevenueTargetModal.tsx`, `RevenueTargetBulkModal.tsx` |

**Deliverable:** Tab "Quản trị Doanh thu" xuất hiện, dashboard tổng quan 8 KPIs + 3 charts + cảnh báo + target CRUD. Achievement tính live, không phụ thuộc snapshot. Dữ liệu từ hợp đồng hiện có.

### Phase 2 (Tuần 3-4): BY_CONTRACT + Forecast

| Task | Files |
|---|---|
| RevenueByContractView | `RevenueByContractView.tsx` |
| Revenue-scoped contract analytics endpoint (ISSUE-6 fix) | `RevenueManagementController.php` |
| Extend ContractRevenueAnalyticsService (dept_id filter) | `ContractRevenueAnalyticsService.php` |
| RevenueForecastView (dự báo + gap analysis) | `RevenueForecastView.tsx` |
| RevenueForecastService | `RevenueForecastService.php` |
| RevenueForecastChart | `RevenueForecastChart.tsx` |

**Deliverable:** Doanh thu theo hợp đồng drill-down với permission riêng, dự báo 3-6 tháng + gap analysis.

### Phase 3 (Tuần 5-6): Reports + Export

| Task | Files |
|---|---|
| RevenueReportService (4 dimensions) | `RevenueReportService.php` |
| Controller report methods | `RevenueManagementController.php` |
| Routes | `api.php` |
| RevenueReportView (4 tabs) | `RevenueReportView.tsx` |
| Export endpoint + sync/async strategy (ISSUE-7 fix) | `RevenueManagementController.php` |

**Deliverable:** Báo cáo 4 chiều, export Excel (sync < 1000 rows, async ≥ 1000).

### Phase 4 (Tuần 7-8): Thu cước Integration + Snapshot + Polish

**Phụ thuộc:** Module Thu cước đã triển khai (ít nhất Phase 1-2)

| Task | Files |
|---|---|
| RevenueByCollectionView | `RevenueByCollectionView.tsx` |
| Integrate FeeCollectionDashboardService vào overview | `RevenueOverviewService.php` |
| RevenueSnapshotService + artisan command | `RevenueSnapshotService.php`, `RevenueSnapshotCommand.php` |
| Caching layer | Services |
| Feature tests | `tests/Feature/RevenueManagement*.php` |
| E2E tests | `e2e/revenue-mgmt.smoke.spec.ts` |
| Performance tuning | Migrations (indexes), services |

**Deliverable:** Module hoàn chỉnh, tích hợp cả 2 nguồn, snapshot tự động, test coverage.

---

## 17. Test Plan

### 17.1. Backend Feature Tests

```php
// tests/Feature/RevenueTargetCrudTest.php
class RevenueTargetCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_revenue_targets()
    public function test_can_create_monthly_target()
    public function test_can_create_quarterly_target()
    public function test_unique_constraint_period_dept_type()
    public function test_bulk_create_targets_for_year()
    public function test_bulk_upsert_updates_existing()
    public function test_can_update_target_amount()
    public function test_can_soft_delete_target()
    public function test_recreate_after_soft_delete_force_deletes_old() // ISSUE-9 fix
    public function test_achievement_pct_calculated_correctly()
    public function test_requires_revenue_targets_permission()
}

// tests/Feature/RevenueOverviewTest.php
class RevenueOverviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_overview_returns_kpis_from_payment_schedules()
    public function test_overview_by_period_groups_by_month()
    public function test_overview_by_period_groups_by_quarter()
    public function test_overview_filters_by_dept_id()
    public function test_overview_includes_target_comparison()
    public function test_overview_calculates_growth_vs_previous_period()
    public function test_overview_generates_alerts_under_target()
    public function test_overview_generates_alerts_high_overdue()
    public function test_overview_by_source_categorizes_correctly()
    public function test_overview_reconciles_invoice_over_payment_schedule() // ISSUE-9 fix: reconciliation
    public function test_overview_no_double_count_when_invoice_linked()     // ISSUE-9 fix
    public function test_overview_live_actuals_for_open_period()            // ISSUE-9 fix: live vs snapshot
    public function test_overview_snapshot_actuals_for_closed_period()      // ISSUE-9 fix
    public function test_overview_snapshot_fallback_to_live_when_missing()  // ISSUE-9 fix
    public function test_requires_revenue_read_permission()
}

// tests/Feature/RevenueForecastTest.php
class RevenueForecastTest extends TestCase
{
    use RefreshDatabase;

    public function test_forecast_includes_contracted_revenue()
    public function test_forecast_includes_renewal_estimate()
    public function test_forecast_includes_opportunity_pipeline()
    public function test_forecast_calculates_gap_vs_target()
    public function test_forecast_respects_dept_filter()
}

// tests/Feature/RevenueReportTest.php
class RevenueReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_by_department_aggregates_correctly()
    public function test_report_by_customer_paginates()
    public function test_report_by_product_allocates_proportionally()
    public function test_time_series_mom_comparison()
    public function test_time_series_qoq_comparison()
    public function test_time_series_yoy_comparison()
    public function test_by_collection_returns_placeholder_when_unavailable() // ISSUE-9 fix
    public function test_by_collection_delegates_via_revenue_permission()     // ISSUE-9 fix
    public function test_export_sync_for_small_dataset()                     // ISSUE-9 fix
    public function test_export_async_for_large_dataset()                    // ISSUE-9 fix
}

// tests/Feature/RevenueSnapshotTest.php
class RevenueSnapshotTest extends TestCase
{
    use RefreshDatabase;

    public function test_snapshot_command_generates_monthly()
    public function test_snapshot_command_generates_quarterly()
    public function test_snapshot_refuses_overwrite_without_force()
    public function test_snapshot_creates_all_dimensions()
    public function test_snapshot_updates_target_actual_amount()
}
```

### 17.2. Frontend Tests

```typescript
// __tests__/revenue-management.test.ts
describe('RevenueManagementHub', () => {
  it('renders OVERVIEW sub-view by default')
  it('switches between 5 sub-views')
  it('syncs period to URL params')
  it('shows placeholder when fee_collection unavailable')
  it('reads shared state from revenueStore (not local)')  // ISSUE-10 fix
  it('preserves period filter when switching sub-views')   // ISSUE-10 fix
})

describe('RevenueOverviewDashboard', () => {
  it('displays 8 KPI cards with correct values')
  it('renders target vs actual grouped bar chart')
  it('renders cumulative line chart with target line')
  it('renders source donut chart')
  it('shows alerts sorted by severity')
  it('handles empty data gracefully')
})

describe('RevenueTargetBulkModal', () => {
  it('renders grid for 12 months × departments')
  it('calculates unallocated row correctly')
  it('validates non-negative amounts')
  it('calls bulkCreateRevenueTargets on save')
})
```
