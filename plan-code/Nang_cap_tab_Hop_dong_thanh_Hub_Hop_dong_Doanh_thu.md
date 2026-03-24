# Nâng cấp tab Hợp đồng thành Hub "Hợp đồng & Doanh thu"

> **Ngày lập:** 2026-03-22
> **Tab:** `?tab=contracts`
> **Trạng thái:** Chờ triển khai

---

## 1. Bối cảnh & Mục tiêu

Tab `?tab=contracts` hiện chỉ có 1 view: KPI cards + bảng danh sách hợp đồng. Thiếu hoàn toàn phần **phân tích doanh thu** — người dùng không trả lời được:

- Doanh thu dự kiến theo chu kỳ thanh toán là bao nhiêu?
- Doanh thu lũy kế (hiện tại + mang sang) qua từng tháng/quý?
- Doanh thu từng hạng mục sản phẩm trong hợp đồng?
- Tình trạng thu tiền quá hạn chi tiết?

**Mục tiêu:** Chuyển thành hub 2 sub-view, giữ nguyên view danh sách hiện tại + bổ sung view doanh thu mới.

---

## 2. Kiến trúc tổng quan

```
?tab=contracts
├── Shared header: tiêu đề + period selector + view toggle
├── [VIEW: CONTRACTS] ← default, giữ nguyên logic hiện tại
│   ├── 3 KPI lớn + 4 KPI nhỏ (đã có)
│   ├── Filter bar (search + status)
│   └── Bảng hợp đồng + pagination
└── [VIEW: REVENUE] ← MỚI
    ├── 5 KPI cards doanh thu
    ├── Biểu đồ SVG: Doanh thu dự kiến vs thực thu theo tháng (grouped bar)
    ├── Biểu đồ SVG: Doanh thu lũy kế (line chart)
    ├── Bảng: Doanh thu theo chu kỳ thanh toán
    ├── Bảng: Doanh thu theo hợp đồng (expandable → drill-down hạng mục)
    └── Bảng: Chi tiết đợt thanh toán quá hạn
```

---

## 3. Files cần tạo/sửa

| File | Thay đổi |
|---|---|
| `backend/app/Services/V5/Contract/ContractRevenueAnalyticsService.php` | **MỚI** — service tính toán doanh thu |
| `backend/app/Http/Controllers/Api/V5/ContractController.php` | Thêm method `revenueAnalytics()` |
| `backend/routes/api.php` | Thêm route `GET /contracts/revenue-analytics` |
| `frontend/types.ts` | Thêm `ContractRevenueAnalytics` + sub-interfaces |
| `frontend/services/v5Api.ts` | Thêm `fetchContractRevenueAnalytics()` |
| `frontend/components/ContractList.tsx` | Thêm view toggle + extract shared header/period |
| `frontend/components/contract-revenue/ContractRevenueView.tsx` | **MỚI** — main revenue view |
| `frontend/components/contract-revenue/RevenueBarChart.tsx` | **MỚI** — SVG grouped bar chart |
| `frontend/components/contract-revenue/RevenueCumulativeChart.tsx` | **MỚI** — SVG cumulative line chart |
| `frontend/App.tsx` | Thêm prop truyền `paymentSchedules` xuống ContractList |

---

## 4. Phase 1 — Backend: Revenue Analytics Endpoint

### 4.1. Service mới: `ContractRevenueAnalyticsService.php`

**Path:** `backend/app/Services/V5/Contract/ContractRevenueAnalyticsService.php`

**Request params:**
```
GET /api/v5/contracts/revenue-analytics
  ?period_from=2026-01-01        (required, YYYY-MM-DD)
  &period_to=2026-03-31          (required, YYYY-MM-DD)
  &grouping=month                (month|quarter, default: month)
  &contract_id=123               (optional, drill-down 1 HĐ)
```

**Response shape:**
```json
{
  "data": {
    "kpis": {
      "expected_revenue": 500000000,
      "actual_collected": 320000000,
      "outstanding": 180000000,
      "overdue_amount": 45000000,
      "overdue_count": 3,
      "carry_over_from_previous": 80000000,
      "cumulative_collected": 400000000,
      "collection_rate": 64,
      "avg_days_to_collect": 18,
      "on_time_rate": 72
    },
    "by_period": [
      {
        "period_key": "2026-01",
        "period_label": "Tháng 1/2026",
        "expected": 150000000,
        "actual": 120000000,
        "overdue": 10000000,
        "cumulative_expected": 150000000,
        "cumulative_actual": 120000000,
        "carry_over": 30000000,
        "schedule_count": 12,
        "paid_count": 9
      }
    ],
    "by_cycle": [
      {
        "cycle": "MONTHLY",
        "cycle_label": "Hàng tháng",
        "contract_count": 15,
        "expected": 200000000,
        "actual": 150000000,
        "percentage_of_total": 40
      }
    ],
    "by_contract": [
      {
        "contract_id": 123,
        "contract_code": "HD-2026-001",
        "contract_name": "Hợp đồng dịch vụ ABC",
        "customer_name": "VNPT Hà Nội",
        "payment_cycle": "MONTHLY",
        "contract_value": 100000000,
        "expected_in_period": 50000000,
        "actual_in_period": 35000000,
        "outstanding": 15000000,
        "items": null
      }
    ],
    "by_item": null,
    "overdue_details": []
  }
}
```

Khi `contract_id` được truyền, `by_item` sẽ chứa (với allocated revenue):
```json
"by_item": [
  {
    "product_id": 5,
    "product_code": "SP-001",
    "product_name": "Dịch vụ hosting",
    "unit": "tháng",
    "quantity": 12,
    "unit_price": 5000000,
    "line_total": 60000000,
    "proportion": 60,
    "allocated_expected": 30000000,
    "allocated_actual": 21000000,
    "allocated_outstanding": 9000000
  }
]
```

### 4.2. SQL Logic chính

**by_period** — group payment_schedules theo `expected_date`:

**Khi grouping=month:**
```sql
-- MySQL:
DATE_FORMAT(ps.expected_date, '%Y-%m') as period_key
-- SQLite:
strftime('%Y-%m', ps.expected_date) as period_key
-- Label: "Tháng 1/2026"
```

**Khi grouping=quarter:**
```sql
-- MySQL:
CONCAT(YEAR(ps.expected_date), '-Q', QUARTER(ps.expected_date)) as period_key
-- SQLite:
strftime('%Y', ps.expected_date) || '-Q' || ((CAST(strftime('%m', ps.expected_date) AS INTEGER) - 1) / 3 + 1) as period_key
-- Label: "Q1/2026"
-- Sample: period_key="2026-Q1", period_label="Q1/2026"
```

**Full query (áp dụng `$periodExpr` dynamic):**
```sql
SELECT
  {$periodExpr} as period_key,
  SUM(ps.expected_amount) as expected,
  SUM(CASE WHEN UPPER(ps.status)='PAID' THEN ps.actual_paid_amount ELSE 0 END) as actual,
  SUM(CASE WHEN UPPER(ps.status)='OVERDUE'
      THEN ps.expected_amount - COALESCE(ps.actual_paid_amount,0) ELSE 0 END) as overdue,
  COUNT(*) as schedule_count,
  SUM(CASE WHEN UPPER(ps.status)='PAID' THEN 1 ELSE 0 END) as paid_count
FROM payment_schedules ps
WHERE ps.contract_id IN (SELECT id FROM contracts WHERE ...)
  AND ps.expected_date BETWEEN ? AND ?
GROUP BY period_key
ORDER BY period_key
```

**carry_over** — sum of unpaid schedules trước `period_from`:
```sql
SELECT COALESCE(SUM(ps.expected_amount - COALESCE(ps.actual_paid_amount,0)), 0)
FROM payment_schedules ps
WHERE ps.contract_id IN (...)
  AND ps.expected_date < ?  -- period_from
  AND UPPER(ps.status) NOT IN ('PAID','CANCELLED')
```

**cumulative** — PHP roll-forward algorithm:

```
opening_carry_over = carry_over_from_previous (unpaid trước period_from)

Cho mỗi period P[i] (i = 0, 1, ...):
  P[0].carry_over         = opening_carry_over
  P[i].cumulative_expected = opening_carry_over + SUM(P[0..i].expected)
  P[i].cumulative_actual   = SUM(P[0..i].actual)
  P[i+1].carry_over       = P[i].cumulative_expected - P[i].cumulative_actual

Kết quả:
  - cumulative_expected: lũy kế DT dự kiến (bao gồm nợ mang sang)
  - cumulative_actual: lũy kế DT thực thu
  - carry_over: nợ chuyển sang kỳ kế tiếp
  - Khoảng cách 2 đường trên line chart = tồn đọng thực tế
```

Công thức đảm bảo opening debt được roll-forward đúng qua mỗi period.

**avg_days_to_collect** (driver-safe):
```sql
-- MySQL:  AVG(DATEDIFF(ps.actual_paid_date, ps.expected_date))
-- SQLite: AVG(CAST(julianday(ps.actual_paid_date) - julianday(ps.expected_date) AS INTEGER))
-- PHP:    AVG({$dateDiffExpr('ps.actual_paid_date', 'ps.expected_date')})
SELECT AVG({$dateDiffExpr}) as avg_days
FROM payment_schedules ps
WHERE UPPER(ps.status)='PAID' AND ps.actual_paid_date IS NOT NULL
  AND ps.expected_date BETWEEN ? AND ?
```

**on_time_rate** — % đợt PAID có `actual_paid_date <= expected_date`.

**by_item** — khi có `contract_id` (revenue allocation per item):

Payment schedules không liên kết trực tiếp với từng contract_item, nên phải **phân bổ doanh thu theo tỷ trọng giá trị hạng mục** (proportional allocation).

```sql
-- Bước 1: Lấy hạng mục + line_total
SELECT ci.product_id, p.product_code, p.product_name, p.unit,
  ci.quantity, ci.unit_price, ci.quantity * ci.unit_price as line_total
FROM contract_items ci
JOIN products p ON p.id = ci.product_id
WHERE ci.contract_id = ?
ORDER BY line_total DESC
```

```php
// Bước 2: Tính tỷ trọng + phân bổ revenue (dùng SUM(line_total) làm denominator)
$itemTotal = array_sum(array_column($items, 'line_total'));
$denominator = max($itemTotal, 1);  // tránh division by zero
$expectedInPeriod = /* from by_contract for this contract_id */;
$actualInPeriod = /* from by_contract for this contract_id */;
$outstandingInPeriod = $expectedInPeriod - $actualInPeriod;

// Phân bổ bằng proportion trên SUM(line_total), không phải contract.value
// Lý do: contract.value có thể != SUM(line_total) do discount, tax, hoặc manual override
$allocatedExpectedSum = 0;
$allocatedActualSum = 0;
$allocatedOutstandingSum = 0;

foreach ($items as $i => &$item) {
    $proportion = $item['line_total'] / $denominator;  // 0..1, tổng = 1.0
    $item['proportion'] = round($proportion * 100, 1);
    $item['allocated_expected'] = round($expectedInPeriod * $proportion);
    $item['allocated_actual']   = round($actualInPeriod * $proportion);
    $item['allocated_outstanding'] = round($outstandingInPeriod * $proportion);

    $allocatedExpectedSum += $item['allocated_expected'];
    $allocatedActualSum += $item['allocated_actual'];
    $allocatedOutstandingSum += $item['allocated_outstanding'];
}

// Remainder handling: gán chênh lệch do rounding vào item có line_total lớn nhất
// Đảm bảo tổng allocated = tổng contract-level chính xác
if (count($items) > 0) {
    $lastIdx = 0; // item đầu tiên (đã sort DESC by line_total)
    $items[$lastIdx]['allocated_expected']    += ($expectedInPeriod - $allocatedExpectedSum);
    $items[$lastIdx]['allocated_actual']      += ($actualInPeriod - $allocatedActualSum);
    $items[$lastIdx]['allocated_outstanding'] += ($outstandingInPeriod - $allocatedOutstandingSum);
}
```

Updated `RevenueByItem` interface:
```ts
export interface RevenueByItem {
  product_id: number;
  product_code: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  proportion: number;               // 0-100%
  allocated_expected: number;        // DT dự kiến phân bổ cho item
  allocated_actual: number;          // DT thực thu phân bổ cho item
  allocated_outstanding: number;     // Tồn đọng phân bổ cho item
}
```

Updated drill-down UI columns:
- Product | ĐVT | SL | Đơn giá | Thành tiền | Tỷ trọng | DT kỳ | Thực thu | Tồn đọng

### 4.3. Route + Controller + DI Wiring

**Route** (`routes/api.php`) — thêm TRƯỚC route resource (tránh conflict `{id}`):
```php
Route::get('/contracts/revenue-analytics', [ContractController::class, 'revenueAnalytics'])
    ->middleware('permission:contracts.read');
```

**Controller DI** (`ContractController.php`) — giữ nguyên parent constructor pattern:
```php
// Hiện tại:
public function __construct(
    V5DomainSupportService $support,
    V5AccessAuditService $accessAudit,
    private readonly ContractDomainService $contractService
) {
    parent::__construct($support, $accessAudit);
}

// Sau khi sửa — chỉ thêm 1 parameter:
public function __construct(
    V5DomainSupportService $support,
    V5AccessAuditService $accessAudit,
    private readonly ContractDomainService $contractService,
    private readonly ContractRevenueAnalyticsService $revenueAnalyticsService,  // MỚI
) {
    parent::__construct($support, $accessAudit);  // GIỮ NGUYÊN
}

// Method mới:
public function revenueAnalytics(Request $request): JsonResponse
{
    return $this->revenueAnalyticsService->analytics($request);
}
```

**Service constructor** (`ContractRevenueAnalyticsService.php`):
```php
class ContractRevenueAnalyticsService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
    ) {}
    // ...
}
```

**Laravel auto-wiring:** Cả 3 services sử dụng constructor injection → Laravel container tự resolve. Không cần đăng ký manual trong ServiceProvider.

### 4.4. Schema guards

Mọi query đều bọc `hasTable('payment_schedules')` + `hasColumn()`. Detect DB driver cho tất cả date expressions:

```php
$driver = DB::connection()->getDriverName();

// Period grouping (month)
$periodExpr = $driver === 'sqlite'
    ? "strftime('%Y-%m', ps.expected_date)"
    : "DATE_FORMAT(ps.expected_date, '%Y-%m')";

// Period grouping (quarter)
$quarterExpr = $driver === 'sqlite'
    ? "strftime('%Y', ps.expected_date) || '-Q' || ((CAST(strftime('%m', ps.expected_date) AS INTEGER) - 1) / 3 + 1)"
    : "CONCAT(YEAR(ps.expected_date), '-Q', QUARTER(ps.expected_date))";

// Date difference (days) — cho avg_days_to_collect + days_overdue
$dateDiffExpr = fn(string $dateA, string $dateB) => $driver === 'sqlite'
    ? "CAST(julianday($dateA) - julianday($dateB) AS INTEGER)"
    : "DATEDIFF($dateA, $dateB)";

// Current date
$curDateExpr = $driver === 'sqlite' ? "date('now')" : "CURDATE()";
```

**Áp dụng:**
- `avg_days_to_collect`: `AVG({$dateDiffExpr('ps.actual_paid_date', 'ps.expected_date')})`
- `days_overdue`: `{$dateDiffExpr($curDateExpr, 'ps.expected_date')} as days_overdue`
- `on_time_rate`: `ps.actual_paid_date <= ps.expected_date` (standard SQL, cả 2 driver đều hỗ trợ)

---

## 5. Phase 2 — Frontend types + API function

### 5.1. Types (`frontend/types.ts`)

```ts
// --- Revenue Analytics ---
export interface RevenueAnalyticsKpis {
  expected_revenue: number;
  actual_collected: number;
  outstanding: number;
  overdue_amount: number;
  overdue_count: number;
  carry_over_from_previous: number;
  cumulative_collected: number;
  collection_rate: number;        // 0-100
  avg_days_to_collect: number;    // ngày TB
  on_time_rate: number;           // 0-100
}

export interface RevenueByPeriod {
  period_key: string;             // "2026-01"
  period_label: string;
  expected: number;
  actual: number;
  overdue: number;
  cumulative_expected: number;
  cumulative_actual: number;
  carry_over: number;
  schedule_count: number;
  paid_count: number;
}

export interface RevenueByCycle {
  cycle: PaymentCycle;
  cycle_label: string;
  contract_count: number;
  expected: number;
  actual: number;
  percentage_of_total: number;
}

export interface RevenueByContract {
  contract_id: number;
  contract_code: string;
  contract_name: string;
  customer_name: string;
  payment_cycle: string;
  contract_value: number;
  expected_in_period: number;
  actual_in_period: number;
  outstanding: number;
  items: RevenueByItem[] | null;
}

export interface RevenueByItem {
  product_id: number;
  product_code: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  proportion: number;             // 0-100
  allocated_expected: number;     // DT dự kiến phân bổ
  allocated_actual: number;       // DT thực thu phân bổ
  allocated_outstanding: number;  // Tồn đọng phân bổ
}

export interface OverdueDetail {
  schedule_id: number;
  contract_id: number;
  contract_code: string;
  customer_name: string;
  milestone_name: string;
  expected_date: string;
  expected_amount: number;
  days_overdue: number;
}

export interface ContractRevenueAnalytics {
  kpis: RevenueAnalyticsKpis;
  by_period: RevenueByPeriod[];
  by_cycle: RevenueByCycle[];
  by_contract: RevenueByContract[];
  by_item: RevenueByItem[] | null;
  overdue_details: OverdueDetail[];
}
```

### 5.2. API function (`frontend/services/v5Api.ts`)

```ts
export interface RevenueAnalyticsParams {
  period_from: string;
  period_to: string;
  grouping?: 'month' | 'quarter';
  contract_id?: number;
}

export const fetchContractRevenueAnalytics = async (
  params: RevenueAnalyticsParams
): Promise<ContractRevenueAnalytics> => {
  const qs = new URLSearchParams();
  qs.set('period_from', params.period_from);
  qs.set('period_to', params.period_to);
  if (params.grouping) qs.set('grouping', params.grouping);
  if (params.contract_id) qs.set('contract_id', String(params.contract_id));

  const res = await apiFetch(`/api/v5/contracts/revenue-analytics?${qs.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error('Không tải được dữ liệu doanh thu.');
  const json = await res.json();
  return json.data;
};
```

---

## 6. Phase 3 — ContractList.tsx: Thêm view toggle

### 6.1. Thêm state + type

```ts
type ContractViewMode = 'CONTRACTS' | 'REVENUE';
const [viewMode, setViewMode] = useState<ContractViewMode>('CONTRACTS');
```

### 6.2. Thêm prop mới

```ts
interface ContractListProps {
  // ...existing props...
  paymentSchedules?: PaymentSchedule[];   // truyền từ App.tsx
}
```

### 6.3. Shared period selector — semantic contract

Period selector là **shared UI component** (1 bộ preset + custom dates), nhưng **semantic khác nhau** tùy view:

| View | Field được filter | Ý nghĩa |
|---|---|---|
| **CONTRACTS** | `contracts.sign_date` | Ngày ký hợp đồng — lọc danh sách HĐ ký trong kỳ |
| **REVENUE** | `payment_schedules.expected_date` | Ngày dự kiến thanh toán — lọc dòng tiền trong kỳ |

**State flow:**
```
periodPreset / customDateFrom / customDateTo (shared state)
       ↓
resolvePresetDates() → { dateFrom, dateTo, label }
       ↓
┌─── CONTRACTS view ─────────────────────┐
│ onQueryChange({ filters: {             │
│   sign_date_from: dateFrom,            │  ← filter theo sign_date
│   sign_date_to: dateTo,               │
│ }})                                    │
└────────────────────────────────────────┘
┌─── REVENUE view ───────────────────────┐
│ fetchContractRevenueAnalytics({        │
│   period_from: dateFrom,               │  ← filter theo expected_date
│   period_to: dateTo,                   │
│ })                                     │
└────────────────────────────────────────┘
```

**Backward compatibility:** Contracts view giữ nguyên **hành vi nghiệp vụ** hiện tại — KPI cards, filter bar, bảng dữ liệu, pagination, export đều không thay đổi. Thay đổi UI duy nhất là header title (từ "Hợp đồng" → "Hợp đồng & Doanh thu") và thêm view toggle buttons — đây là **thay đổi cosmetic**, không ảnh hưởng business behavior hay data flow.

> **Acceptance criterion (1) cập nhật:** "Default view giữ nguyên business behavior — KPIs, data table, filters, pagination, export. Header title và navigation thay đổi để accommodate hub layout."

### 6.4. Shared header layout

```tsx
<header className="...">
  <div>
    <h2>Hợp đồng & Doanh thu</h2>    {/* đổi tiêu đề */}
    <p className="...">Quản lý hợp đồng, theo dõi doanh thu và thu tiền.</p>
  </div>
  <div className="flex items-center gap-3">
    {/* View toggle */}
    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
      <button onClick={() => setViewMode('CONTRACTS')}
        className={viewMode === 'CONTRACTS' ? 'bg-primary text-white' : 'bg-white text-slate-600'}>
        <span className="material-symbols-outlined text-sm">description</span>
        Hợp đồng
      </button>
      <button onClick={() => setViewMode('REVENUE')}
        className={viewMode === 'REVENUE' ? 'bg-primary text-white' : 'bg-white text-slate-600'}>
        <span className="material-symbols-outlined text-sm">bar_chart</span>
        Doanh thu
      </button>
    </div>
    {/* Export + Thêm mới — chỉ hiện khi CONTRACTS */}
    {viewMode === 'CONTRACTS' && (<>...export/add buttons...</>)}
  </div>
</header>

{/* Period selector — shared cho cả 2 views */}
<PeriodSelector ... />

```

### 6.4. Conditional render

```tsx
{viewMode === 'CONTRACTS' ? (
  <>
    {/* KPI cards + filter bar + table — GIỮ NGUYÊN code hiện tại */}
  </>
) : (
  <ContractRevenueView
    periodFrom={dateFrom}
    periodTo={dateTo}
    periodLabel={periodLabel}
    paymentSchedules={paymentSchedules}
    contracts={contracts}
    customers={customers}
    projects={projects}
    onNotify={onNotify}
  />
)}
```

---

## 7. Phase 4 — ContractRevenueView.tsx (component MỚI)

### 7.1. Props + State

```ts
interface ContractRevenueViewProps {
  periodFrom: string | null;
  periodTo: string | null;
  periodLabel: string;
  paymentSchedules?: PaymentSchedule[];
  contracts?: Contract[];
  customers?: Customer[];
  projects?: Project[];
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
}

// Internal state:
const [analytics, setAnalytics] = useState<ContractRevenueAnalytics | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [grouping, setGrouping] = useState<'month' | 'quarter'>('month');
const [expandedContractId, setExpandedContractId] = useState<number | null>(null);
const [sortBy, setSortBy] = useState<string>('outstanding');
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
```

### 7.2. Data loading

```ts
useEffect(() => {
  if (!periodFrom || !periodTo) return;
  setIsLoading(true);
  fetchContractRevenueAnalytics({ period_from: periodFrom, period_to: periodTo, grouping })
    .then(setAnalytics)
    .catch(err => onNotify?.('error', 'Lỗi', err.message))
    .finally(() => setIsLoading(false));
}, [periodFrom, periodTo, grouping]);
```

### 7.3. Layout (top → bottom)

#### Row 1: 10 KPI — 5 cards chính + 5 secondary metrics

**5 KPI cards chính** (`grid-cols-2 md:grid-cols-5`):

| # | Label | Data | Icon | Màu |
|---|---|---|---|---|
| 1 | Doanh thu dự kiến | `kpis.expected_revenue` | `account_balance` | Blue |
| 2 | Đã thu được | `kpis.actual_collected` | `payments` | Emerald |
| 3 | Tồn đọng chưa thu | `kpis.outstanding` | `pending` | Amber |
| 4 | Quá hạn thanh toán | `kpis.overdue_amount` (`overdue_count` đợt) | `warning` | Red (highlight khi >0) |
| 5 | Dồn kỳ trước | `kpis.carry_over_from_previous` | `history` | Purple |

**5 secondary metrics** (strip bar bên dưới, `grid-cols-5`):

| # | Label | Data | Hiển thị |
|---|---|---|---|
| 6 | Tỷ lệ thu tiền | `kpis.collection_rate` | Percentage badge + mini progress bar |
| 7 | Số ngày thu TB | `kpis.avg_days_to_collect` | Number + "ngày" suffix |
| 8 | Tỷ lệ đúng hạn | `kpis.on_time_rate` | Percentage badge (green/amber/red) |
| 9 | Số đợt quá hạn | `kpis.overdue_count` | Count badge (red nếu >0) |
| 10 | Lũy kế đã thu | `kpis.cumulative_collected` | Currency format |

> **Mapping đầy đủ 10/10 fields** từ `RevenueAnalyticsKpis` → UI slots. Không có field nào bị bỏ sót.

#### Row 2: Toggle tháng/quý + 2 biểu đồ SVG cạnh nhau

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <RevenueBarChart data={analytics.by_period} />
  <RevenueCumulativeChart data={analytics.by_period} />
</div>
```

#### Row 3: Bảng doanh thu theo chu kỳ thanh toán

Dùng `analytics.by_cycle`. Columns: Chu kỳ | Số HĐ | DT dự kiến | Đã thu | Tỷ trọng (progress bar).

#### Row 4: Bảng doanh thu theo hợp đồng (expandable)

Dùng `analytics.by_contract`. Columns: Mã HĐ | Tên HĐ | Khách hàng | Chu kỳ | Giá trị HĐ | DT kỳ | Thực thu | Tồn đọng.

Click expand → load `fetchContractRevenueAnalytics({ ...params, contract_id })` → hiển thị bảng `by_item` bên trong row:
- Product | ĐVT | SL | Đơn giá | Thành tiền | Tỷ trọng | DT kỳ | Thực thu | Tồn đọng (mini progress bar)

#### Row 5: Chi tiết đợt quá hạn (từ analytics endpoint)

**Nguồn:** Thêm `overdue_details` array vào analytics response (KHÔNG dùng frontend `paymentSchedules` filter).

Backend bổ sung trong response:
```json
"overdue_details": [
  {
    "schedule_id": 45,
    "contract_id": 123,
    "contract_code": "HD-2026-001",
    "customer_name": "VNPT Hà Nội",
    "milestone_name": "Đợt 3",
    "expected_date": "2026-02-15",
    "expected_amount": 15000000,
    "days_overdue": 35
  }
]
```

SQL (driver-safe):
```sql
SELECT ps.id as schedule_id, ps.contract_id, c.contract_code,
  cust.customer_name, ps.milestone_name, ps.expected_date, ps.expected_amount,
  {$dateDiffExpr($curDateExpr, 'ps.expected_date')} as days_overdue
  -- MySQL:  DATEDIFF(CURDATE(), ps.expected_date)
  -- SQLite: CAST(julianday(date('now')) - julianday(ps.expected_date) AS INTEGER)
FROM payment_schedules ps
JOIN contracts c ON c.id = ps.contract_id
LEFT JOIN customers cust ON cust.id = c.customer_id
WHERE ps.contract_id IN ({scoped_contract_ids})
  AND UPPER(ps.status) = 'OVERDUE'
  AND ps.expected_date BETWEEN {period_from} AND {period_to}
ORDER BY days_overdue DESC
```

UI columns: Mã HĐ | Khách hàng | Đợt TT | Ngày dự kiến | Số tiền | Số ngày quá hạn

> **Lưu ý:** Filter theo `expected_date` trong period đã chọn — nhất quán với shared period selector.

---

## 8. Phase 5 — SVG Charts (pure, không thư viện)

### 8.1. `RevenueBarChart.tsx` — Grouped bar chart (DT dự kiến vs Thực thu)

```
Pattern: Giống ring chart đã có — pure SVG trong viewBox
- viewBox="0 0 {width} {height}" với width tính theo số period
- Mỗi period: 2 bars cạnh nhau (expected=blue, actual=emerald)
- X axis: period labels
- Y axis: tự tính scale từ max value, hiển thị ticks
- Tooltip: hover state bằng React useState
- Responsive: SVG tự scale theo container
```

Props:
```ts
interface RevenueBarChartProps {
  data: RevenueByPeriod[];
}
```

### 8.2. `RevenueCumulativeChart.tsx` — Dual-line chart (lũy kế)

```
- 2 đường: cumulative_expected (xanh dương dashed), cumulative_actual (xanh lá solid)
- Area fill dưới actual line (emerald/10 opacity)
- Dots tại mỗi data point
- Hover → tooltip hiển thị giá trị
```

Props:
```ts
interface RevenueCumulativeChartProps {
  data: RevenueByPeriod[];
}
```

---

## 9. Phase 6 — App.tsx wiring

### 9.1. Thêm prop `paymentSchedules` vào ContractList

```tsx
{activeTab === 'contracts' && (
  <ContractList
    {...existingProps}
    paymentSchedules={paymentSchedules}       // THÊM MỚI
  />
)}
```

### 9.2. Không cần thêm state mới

`ContractRevenueView` tự quản lý `analytics` state bằng `fetchContractRevenueAnalytics()`. Không cần hoist lên App.tsx.

---

## 10. Tổng hợp KPIs — Trả lời câu hỏi người dùng

### Q1: "Doanh thu dự kiến phân ra dòng tiền theo chu kỳ"
→ **Bảng `by_cycle`** + KPI card #1 (`expected_revenue`) + **Bar chart** (cột xanh dương)

### Q2: "Doanh thu lũy kế theo chu kỳ (hiện tại + mang sang)"
→ **Line chart lũy kế** (`cumulative_expected`, `cumulative_actual`) + KPI card #5 (`carry_over_from_previous`) + cột `carry_over` trong `by_period`

### Q3: "Doanh thu từng hạng mục nếu chọn xem"
→ **Expand row** trong bảng `by_contract` → hiển thị `by_item` (product breakdown) → tỷ trọng từng sản phẩm

### Đề xuất thêm:
- **Số ngày thu TB** (`avg_days_to_collect`) — đánh giá hiệu quả thu nợ
- **Tỷ lệ đúng hạn** (`on_time_rate`) — đánh giá kỷ luật thanh toán
- **Chi tiết quá hạn** — bảng riêng với tên KH, số ngày quá hạn, để action ngay

---

## 11. Verification (Kiểm tra)

### 11.1. Backend tests (full scope)
```bash
# Tất cả contract-related tests (SQLite :memory:)
cd backend && php artisan test --filter=Contract

# Route binding test — đảm bảo route mới được đăng ký đúng
cd backend && php artisan test --filter=V5DomainRouteBindingTest

# Architecture guardrails — đảm bảo controller injection OK
cd backend && php artisan test --filter=BackendArchitectureGuardrailsTest

# Full backend suite — acceptance criterion (5)
cd backend && composer test
```

### 11.2. Frontend typecheck + build
```bash
# TypeScript strict compilation — acceptance criterion (6)
cd frontend && npx tsc --noEmit

# Full lint
cd frontend && npm run lint

# Production build (verify no build errors)
cd frontend && npm run build
```

### 11.3. Manual E2E verification
1. `?tab=contracts` → default view "Hợp đồng" — **business behavior giữ nguyên** (KPIs, table, filters, export). Header title đổi thành "Hợp đồng & Doanh thu", thêm view toggle.
2. Click "Doanh thu" → load analytics API → hiển thị 10 KPIs + charts + tables
3. Đổi kỳ (Quý này → Tháng này) → cả 2 views cập nhật, period semantics đúng
4. Click expand trên 1 hợp đồng → drill-down hạng mục với allocated revenue
5. Toggle Grouping tháng ↔ quý → bar chart + line chart + bảng `by_period` thay đổi
6. Overdue table chỉ hiện đợt trong kỳ đã chọn
7. Edge case: DB chưa có `payment_schedules` → tất cả KPI = 0, không crash
8. Edge case: Hợp đồng không có contract_items → by_item = [] (empty, không error)

### 11.4. SQLite compatibility check
Verify quarterly SQL expressions chạy đúng trên SQLite (test env):
```bash
cd backend && php artisan test --filter=ContractPaymentGenerationTest
```
