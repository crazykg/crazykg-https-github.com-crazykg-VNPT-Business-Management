# VNPT Business Management System - Backend Architecture & API Patterns Exploration

**Date**: 2026-03-29  
**Focus**: Backend service layer, API patterns, analytics/suggestion logic for building a Product Suggestion & Analytics feature

---

## Table of Contents

1. [Routes & API Endpoints Structure](#routes--api-endpoints-structure)
2. [Controller Patterns](#controller-patterns)
3. [Service Layer Architecture](#service-layer-architecture)
4. [Existing Domain Services](#existing-domain-services)
5. [Analytics & Dashboard Service Patterns](#analytics--dashboard-service-patterns)
6. [Data Models & Relationships](#data-models--relationships)
7. [Frontend Integration Patterns](#frontend-integration-patterns)
8. [Key Architecture Insights](#key-architecture-insights)
9. [Patterns for Building Product Suggestions Service](#patterns-for-building-product-suggestions-service)

---

## 1. Routes & API Endpoints Structure

### Route Organization
- **Location**: `backend/routes/api.php` (main router) + `backend/routes/api/*.php` (feature-specific)
- **Middleware Stack**: `auth:sanctum`, `password.change`, `active.tab`, `throttle:api.write`
- **Permission-based Access**: Each route protected by `middleware('permission:...')`

### Key Route Files

#### `backend/routes/api/master-data.php`
```php
// Customers, Products, Employees, Departments, Vendors, Businesses
Route::get('/customers', [CustomerController::class, 'index'])
    ->middleware('permission:customers.read');
Route::get('/customers/{id}/insight', [CustomerController::class, 'insight'])
    ->middleware('permission:customers.read');

Route::get('/products', [ProductController::class, 'index'])
    ->middleware('permission:products.read');

Route::get('/vendors', [VendorController::class, 'index'])
    ->middleware('permission:vendors.read');
```

#### `backend/routes/api/contracts.php`
```php
Route::get('/contracts', [ContractController::class, 'index'])
    ->middleware('permission:contracts.read');
Route::get('/contracts/revenue-analytics', [ContractController::class, 'revenueAnalytics'])
    ->middleware('permission:contracts.read');
Route::get('/payment-schedules', [ContractController::class, 'paymentSchedules'])
    ->middleware('permission:contracts.read');
```

#### `backend/routes/api/fee-collection.php` (Analytics Pattern Reference)
```php
Route::get('/fee-collection/dashboard', [FeeCollectionController::class, 'dashboard'])
    ->middleware('permission:fee_collection.read');
Route::get('/fee-collection/debt-aging', [FeeCollectionController::class, 'debtAgingReport'])
    ->middleware('permission:fee_collection.read');
Route::get('/fee-collection/debt-by-customer', [FeeCollectionController::class, 'debtByCustomer'])
    ->middleware('permission:fee_collection.read');
```

#### `backend/routes/api/revenue.php` (Complex Analytics Pattern)
```php
Route::get('/revenue/overview', [RevenueManagementController::class, 'overview'])
    ->middleware('permission:revenue.read');
Route::get('/revenue/targets/suggest', [RevenueManagementController::class, 'targetSuggest'])
    ->middleware('permission:revenue.read');
Route::get('/revenue/by-contract', [RevenueManagementController::class, 'byContract'])
    ->middleware('permission:revenue.read');
Route::get('/revenue/forecast', [RevenueManagementController::class, 'forecast'])
    ->middleware('permission:revenue.read');
```

---

## 2. Controller Patterns

### Base Controller Pattern
```php
class V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit
    ) {}
}
```
- Injects `V5DomainSupportService` for table/column checks
- Injects `V5AccessAuditService` for audit logging

### CustomerController Pattern (Simple Insight Example)
**File**: `backend/app/Http/Controllers/Api/V5/CustomerController.php`

```php
public function __construct(
    V5DomainSupportService $support,
    V5AccessAuditService $accessAudit,
    private readonly CustomerDomainService $customerService,
    private readonly CustomerInsightService $insightService,
) {
    parent::__construct($support, $accessAudit);
}

public function insight(int $id): JsonResponse
{
    $cacheKey = "v5:customer-insight:{$id}:v1";
    
    // Cache for 5 minutes (INSIGHT_CACHE_TTL_SECONDS = 300)
    $payload = Cache::remember(
        $cacheKey,
        self::INSIGHT_CACHE_TTL_SECONDS,
        fn () => $this->insightService->buildInsight($id)->getData(true)
    );
    
    return response()->json($payload);
}
```

**Key Patterns**:
- Delegates to domain service (e.g., `CustomerDomainService`, `CustomerInsightService`)
- Implements **cache invalidation** on update/delete
- Returns `JsonResponse` consistently
- Uses validation for request inputs

### ContractController Pattern (Analytics Delegation)
**File**: `backend/app/Http/Controllers/Api/V5/ContractController.php`

```php
public function __construct(
    V5DomainSupportService $support,
    V5AccessAuditService $accessAudit,
    private readonly ContractDomainService $contractService,
    private readonly ContractRevenueAnalyticsService $revenueAnalyticsService
) {
    parent::__construct($support, $accessAudit);
}

public function revenueAnalytics(Request $request): JsonResponse
{
    return $this->revenueAnalyticsService->analytics($request);
}
```

### RevenueManagementController Pattern (Multi-Service Aggregation)
**File**: `backend/app/Http/Controllers/Api/V5/RevenueManagementController.php`

```php
public function __construct(
    V5DomainSupportService $support,
    V5AccessAuditService $accessAudit,
    private readonly RevenueOverviewService $overviewService,
    private readonly RevenueTargetService $targetService,
    private readonly RevenueByContractService $byContractService,
    private readonly RevenueForecastService $forecastService,
    private readonly RevenueReportService $reportService
) {
    parent::__construct($support, $accessAudit);
}

public function overview(Request $request): JsonResponse
{
    return $this->overviewService->overview($request);
}

public function targetSuggest(Request $request): JsonResponse
{
    return $this->targetService->suggest($request);  // ← SUGGESTION PATTERN
}
```

---

## 3. Service Layer Architecture

### Directory Structure
```
backend/app/Services/V5/
├── Domain/
│   ├── CustomerDomainService.php
│   ├── CustomerInsightService.php
│   ├── ProductDomainService.php
│   ├── ContractDomainService.php
│   ├── LeadershipDashboardService.php
│   └── ... (32 more domain services)
├── Contract/
│   ├── ContractRevenueAnalyticsService.php
│   ├── ContractPaymentService.php
│   ├── ContractRenewalService.php
│   └── ...
├── FeeCollection/
│   ├── FeeCollectionDashboardService.php
│   ├── DebtAgingReportService.php
│   ├── InvoiceDomainService.php
│   └── ...
├── Revenue/
│   ├── RevenueOverviewService.php
│   ├── RevenueTargetService.php
│   ├── RevenueByContractService.php
│   ├── RevenueForecastService.php
│   └── RevenueReportService.php
├── CustomerRequest/
│   ├── CustomerRequestCaseDashboardService.php
│   ├── CustomerRequestCaseWriteService.php
│   └── ...
└── V5DomainSupportService.php  (Utility Service)
```

### Service Layer Patterns

#### **Pattern 1: Domain Service (CRUD + Business Logic)**
**Example**: `CustomerDomainService`

Responsibilities:
- Read (index with pagination, filters, sorting)
- Create (store)
- Update
- Delete
- Custom business logic (scopes, KPI building)

```php
public function index(Request $request): JsonResponse
{
    // 1. Check table exists
    if (!$this->support->hasTable('customers')) {
        return $this->support->missingTable('customers');
    }
    
    // 2. Build query with filtering
    $query = Customer::query()
        ->select($this->support->selectColumns('customers', [/*columns*/]));
    
    // 3. Apply filters (search, sector)
    if ($search !== '') {
        $query->where(...); // multi-column search
    }
    
    // 4. Apply sorting
    $sortBy = $this->support->resolveSortColumn($request, [...]);
    $sortDir = $this->support->resolveSortDirection($request);
    $query->orderBy($sortBy, $sortDir);
    
    // 5. Apply read scope (data access control)
    $this->applyReadScope($request, $query);
    
    // 6. Build KPIs for the list
    $kpis = $this->buildCustomerKpis($query);
    
    // 7. Paginate
    if ($this->support->shouldPaginate($request)) {
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $rows = collect($paginator->items())
            ->map(fn (Customer $c) => $this->support->serializeCustomer($c))
            ->values();
        
        return response()->json([
            'data' => $rows,
            'meta' => array_merge(
                $this->support->buildPaginationMeta($page, $perPage, $paginator->total()),
                ['kpis' => $kpis]  // ← KPIs included in list response
            ),
        ]);
    }
    
    return response()->json(['data' => $rows, 'meta' => ['kpis' => $kpis]]);
}
```

**Key Insights**:
- KPIs included in pagination metadata (not separate endpoint)
- Supports table existence checks (graceful degradation)
- Supports read scope enforcement (data isolation)
- Supports simple vs full pagination
- Serialization happens via `$support->serialize*()` methods

---

#### **Pattern 2: Insight Service (Customer 360 / Aggregation)**
**Example**: `CustomerInsightService`

Responsibilities:
- Aggregate data from multiple tables
- Compute derived metrics
- Return structured insight object

```php
public function buildInsight(int $customerId): JsonResponse
{
    if (!$this->support->hasTable('customers')) {
        return $this->support->missingTable('customers');
    }
    
    $customer = DB::table('customers')
        ->whereNull('deleted_at')
        ->where('id', $customerId)
        ->first();
    
    if (!$customer) {
        return response()->json(['message' => 'Không tìm thấy khách hàng.'], 404);
    }
    
    return response()->json([
        'data' => [
            'customer'              => $customer,
            'contracts_summary'     => $this->buildContractsSummary($customerId),
            'services_used'         => $this->buildServicesUsed($customerId),
            'opportunities_summary' => $this->buildOpportunitiesSummary($customerId),
            'crc_summary'           => $this->buildCrcSummary($customerId),
            'upsell_candidates'     => $this->buildUpsellCandidates($customerId),  // ← SUGGESTION
        ],
    ]);
}
```

**Composition Sections**:
1. **contracts_summary**: count, total_value, active_value, by_status breakdown
2. **services_used**: products already in customer's contracts
3. **opportunities_summary**: pipeline counts/amounts by stage
4. **crc_summary**: open/total support-case counts by status
5. **upsell_candidates**: active products NOT in customer's contracts (sorted by popularity)

**Upsell Logic**:
```php
private function buildUpsellCandidates(int $customerId): array
{
    if (!$this->support->hasTable('products') || !$this->support->hasTable('contracts')) {
        return [];
    }
    
    // 1. Get products currently used by customer
    $usedProductIds = DB::table('contract_items as ci')
        ->join('contracts as c', 'c.id', '=', 'ci.contract_id')
        ->where('c.customer_id', $customerId)
        ->whereNull('c.deleted_at')
        ->pluck('ci.product_id')
        ->toArray();
    
    // 2. Find products NOT used, sorted by usage across all customers (popularity)
    $candidates = DB::table('products as p')
        ->leftJoin('contract_items as ci', 'ci.product_id', '=', 'p.id')
        ->whereNull('p.deleted_at')
        ->where('p.status', 'ACTIVE')  // only active products
        ->whereNotIn('p.id', $usedProductIds ?: [0])
        ->groupBy('p.id')
        ->select(
            'p.id',
            'p.product_code',
            'p.product_name',
            DB::raw('COUNT(DISTINCT ci.contract_id) as usage_count')
        )
        ->orderByDesc('usage_count')
        ->limit(self::UPSELL_LIMIT)  // Top 8
        ->get()
        ->toArray();
    
    return $candidates;
}
```

---

#### **Pattern 3: Analytics Service (Revenue/Fee Dashboard)**
**Examples**: 
- `FeeCollectionDashboardService`
- `ContractRevenueAnalyticsService`
- `RevenueOverviewService`

Responsibilities:
- Compute multi-dimensional aggregations
- Support period-based filtering (month/quarter/year)
- Support grouping/bucketing logic
- Support caching with cache invalidation

**FeeCollectionDashboardService Structure**:
```php
public function dashboard(Request $request): JsonResponse
{
    $validated = $request->validate([
        'period_from' => ['required', 'date'],
        'period_to'   => ['required', 'date', 'after_or_equal:period_from'],
    ]);
    
    $from = $validated['period_from'];
    $to   = $validated['period_to'];
    
    // Cache for 2 minutes — invalidated by invoice/receipt mutations
    $cacheKey = "v5:fc:dashboard:{$from}:{$to}:v1";
    $data = Cache::remember($cacheKey, 120, function () use ($from, $to) {
        return [
            'kpis'           => $this->buildKpis($from, $to),
            'by_month'       => $this->buildByMonth($from, $to),
            'top_debtors'    => $this->buildTopDebtors(),
            'urgent_overdue' => $this->buildUrgentOverdue(),
        ];
    });
    
    return response()->json(['data' => $data]);
}

// Static cache flush method (called after mutations)
public static function flushCache(): void
{
    try {
        $store = Cache::getStore();
        if (method_exists($store, 'flush')) {
            // Pattern-based flush for Redis
        }
    } catch (\Throwable) {
        // Silently ignore — cache will expire in 2 minutes
    }
}
```

**KPI Computation**:
```php
private function buildKpis(string $from, string $to): array
{
    // Period-Flow KPIs
    $periodInvoiced = (float) DB::table('invoices')
        ->whereBetween('invoice_date', [$from, $to])
        ->whereNotIn('status', ['CANCELLED', 'VOID', 'DRAFT'])
        ->whereNull('deleted_at')
        ->sum('total_amount');
    
    $periodCollected = (float) DB::table('receipts')
        ->whereBetween('receipt_date', [$from, $to])
        ->where('status', 'CONFIRMED')
        ->whereNull('deleted_at')
        ->sum('amount');
    
    $collectionRate = $periodInvoiced > 0
        ? min(100, (int) round($periodCollected / $periodInvoiced * 100))
        : 0;
    
    // Average days to collect
    $avgDays = DB::table('receipts')
        ->join('invoices', 'invoices.id', '=', 'receipts.invoice_id')
        ->whereBetween('receipts.receipt_date', [$from, $to])
        ->where('receipts.status', 'CONFIRMED')
        ->whereNull('receipts.deleted_at')
        ->selectRaw("AVG(DATEDIFF(receipts.receipt_date, invoices.invoice_date)) as avg_days")
        ->value('avg_days');
    
    // Balance KPIs (point-in-time)
    $outstandingRow = DB::table('invoices')
        ->whereNotIn('status', ['PAID', 'CANCELLED', 'VOID', 'DRAFT'])
        ->whereNull('deleted_at')
        ->selectRaw('
            COALESCE(SUM(total_amount - paid_amount), 0) as total_outstanding,
            COALESCE(SUM(CASE WHEN due_date < CURDATE() AND (total_amount - paid_amount) > 0 
                THEN (total_amount - paid_amount) ELSE 0 END), 0) as total_overdue,
            COUNT(CASE WHEN due_date < CURDATE() AND (total_amount - paid_amount) > 0 
                THEN 1 END) as overdue_count
        ')
        ->first();
    
    return [
        'expected_revenue'     => round($periodInvoiced, 2),
        'actual_collected'     => round($periodCollected, 2),
        'collection_rate'      => $collectionRate,
        'avg_days_to_collect'  => round((float) ($avgDays ?? 0), 1),
        'outstanding'          => round((float) ($outstandingRow->total_outstanding ?? 0), 2),
        'overdue_amount'       => round((float) ($outstandingRow->total_overdue ?? 0), 2),
        'overdue_count'        => (int) ($outstandingRow->overdue_count ?? 0),
    ];
}
```

**Period Bucketing Pattern** (used by RevenueOverviewService):
```php
private function buildPeriodBuckets(Carbon $from, Carbon $to, string $grouping): array
{
    $buckets = [];
    $cursor = $from->copy()->startOfMonth();
    $end = $to->copy()->endOfMonth();
    
    if ($grouping === 'quarter') {
        $cursor = $from->copy()->firstOfQuarter();
        $end = $to->copy()->endOfQuarter();
        
        while ($cursor->lte($end)) {
            $q = (int) ceil($cursor->month / 3);
            $key = $cursor->year . '-Q' . $q;
            $label = 'Quý ' . $q . '/' . $cursor->year;
            $buckets[$key] = [
                'period_key' => $key,
                'period_label' => $label,
                'period_start' => $cursor->copy()->toDateString(),
                'period_end' => $cursor->copy()->endOfQuarter()->toDateString(),
            ];
            $cursor->addQuarterNoOverflow();
        }
    } else {  // month
        while ($cursor->lte($end)) {
            $key = $cursor->format('Y-m');
            $label = 'Tháng ' . $cursor->month . '/' . $cursor->year;
            $buckets[$key] = [
                'period_key' => $key,
                'period_label' => $label,
                'period_start' => $cursor->copy()->startOfMonth()->toDateString(),
                'period_end' => $cursor->copy()->endOfMonth()->toDateString(),
            ];
            $cursor->addMonthNoOverflow();
        }
    }
    
    return $buckets;
}
```

---

#### **Pattern 4: Suggestion Service (TARGET PATTERN FOR OUR FEATURE)**
**Example**: `RevenueTargetService::suggest()`

```php
public function suggest(Request $request): JsonResponse
{
    // 1. Validate input parameters
    $validated = $request->validate([
        'period_type' => ['sometimes', Rule::in(['MONTHLY', 'QUARTERLY', 'YEARLY'])],
        'year' => ['sometimes', 'integer', 'min:2020', 'max:2099'],
        'dept_id' => ['sometimes', 'integer', 'min:0'],
    ]);
    
    // 2. Query historical data
    $historicalActuals = $this->fetchHistoricalActuals(
        (string) ($validated['period_type'] ?? 'MONTHLY'),
        (int) ($validated['year'] ?? now()->year),
        (int) ($validated['dept_id'] ?? 0)
    );
    
    // 3. Compute suggestions based on trends
    $suggestions = [];
    foreach ($historicalActuals as $periodKey => $actualAmount) {
        // Apply growth rate, seasonality, etc.
        $suggested = $this->computeSuggestedTarget($periodKey, $actualAmount);
        $suggestions[] = [
            'period_key' => $periodKey,
            'historical_actual' => $actualAmount,
            'suggested_target' => $suggested,
            'growth_rate' => ($suggested / $actualAmount - 1) * 100,
            'confidence' => 0.85,  // confidence score
        ];
    }
    
    return response()->json(['data' => $suggestions]);
}
```

---

## 4. Existing Domain Services

### Customer-Related Services
- **CustomerDomainService**: CRUD + KPI building
- **CustomerInsightService**: 360° view (contracts, services, opportunities, CRC, **upsell**)
- **CustomerPersonnelDomainService**: Contact management

### Product-Related Services
- **ProductDomainService**: CRUD
- **ProductFeatureCatalogDomainService**: Feature-feature relationships
- **ProductQuotationDomainService**: Quotation management
- **ProductQuotationExportService**: Export to PDF/Word/Excel

### Contract-Related Services
- **ContractDomainService**: CRUD + payment generation
- **ContractRevenueAnalyticsService**: Revenue analytics with period bucketing
- **ContractPaymentService**: Payment processing
- **ContractRenewalService**: Renewal logic

### Revenue Management Services
- **RevenueOverviewService**: Dashboard with period buckets, KPIs, by_period, by_source, alerts
- **RevenueTargetService**: Target CRUD + **suggest endpoint**
- **RevenueByContractService**: Revenue breakdowns per contract
- **RevenueForecastService**: Forecast computations
- **RevenueReportService**: Report generation

### Fee Collection Services
- **FeeCollectionDashboardService**: Dashboard (KPIs, by_month, top_debtors, urgent_overdue)
- **DebtAgingReportService**: Debt aging analysis
- **InvoiceDomainService**: Invoice CRUD
- **ReceiptDomainService**: Receipt CRUD

---

## 5. Analytics & Dashboard Service Patterns

### Pattern: Cache Strategy
```
Cache Key Format: "v5:{domain}:{entity_id}:{version}"
Examples:
  - "v5:customer-insight:{id}:v1"
  - "v5:fc:dashboard:{from}:{to}:v1"
  - "v5:revenue:overview:{from}:{to}:v1"

TTL Strategy:
  - Insight data: 300 seconds (5 min) — frequent views, rare changes
  - Dashboard data: 120 seconds (2 min) — frequent updates
  - Cache invalidation: Automatic via mutation listeners
```

### Pattern: Response Structure
```json
// Simple List Response (with KPIs in metadata)
{
  "data": [/* items */],
  "meta": {
    "page": 1,
    "per_page": 10,
    "total": 100,
    "kpis": {/* summary metrics */}
  }
}

// Dashboard Response (complex structure)
{
  "meta": {
    "fee_collection_available": true,
    "data_sources": ["contracts", "invoices"]
  },
  "data": {
    "kpis": {/* summary metrics */},
    "by_period": [/* period buckets with metrics */],
    "by_source": [/* breakdown by source */],
    "alerts": [/* business alerts */]
  }
}

// Insight Response (multi-section aggregation)
{
  "data": {
    "customer": {/* entity */},
    "contracts_summary": {/* summary */},
    "services_used": [/* list */],
    "opportunities_summary": {/* summary */},
    "crc_summary": {/* summary */},
    "upsell_candidates": [/* suggestions */]
  }
}
```

### Pattern: Validation & Error Handling
```php
// Standard validation
$validated = $request->validate([
    'period_from' => ['required', 'date'],
    'period_to' => ['required', 'date', 'after_or_equal:period_from'],
    'grouping' => ['sometimes', Rule::in(['month', 'quarter'])],
]);

// Table existence checks
if (!$this->support->hasTable('contracts')) {
    return $this->support->missingTable('contracts');  // 503 response
}

// Custom validation with error response
if ($periodTo->lt($periodFrom)) {
    return response()->json([
        'message' => 'period_to phải lớn hơn hoặc bằng period_from.',
        'errors' => ['period_to' => ['period_to phải lớn hơn hoặc bằng period_from.']],
    ], 422);
}
```

---

## 6. Data Models & Relationships

### Customer Model
```php
class Customer extends Model
{
    use SoftDeletes;
    
    protected $table = 'customers';
    protected $fillable = [
        'uuid', 'customer_code', 'customer_code_auto_generated',
        'customer_name', 'company_name', 'tax_code', 'address',
        'customer_sector', 'healthcare_facility_type', 'bed_capacity',
        'data_scope', 'created_by', 'updated_by',
    ];
    
    public function projects(): HasMany { return $this->hasMany(Project::class); }
    public function contracts(): HasMany { return $this->hasMany(Contract::class); }
    public function opportunities(): HasMany { return $this->hasMany(Opportunity::class); }
}
```

### Contract Model
```php
class Contract extends Model
{
    use SoftDeletes;
    
    protected $table = 'contracts';
    protected $fillable = [
        'contract_code', 'contract_name', 'customer_id', 'project_id',
        'project_type_code', 'value', 'payment_cycle', 'status',
        'sign_date', 'effective_date', 'expiry_date', 'term_unit',
        'term_value', 'expiry_date_manual_override', 'parent_contract_id',
        'addendum_type', 'gap_days', 'continuity_status', 'penalty_rate',
        'data_scope', 'created_by', 'updated_by',
    ];
    
    public function scopeActive(Builder $query): Builder {
        return $query->whereIn('status', ['SIGNED', 'RENEWED']);
    }
    
    public function scopeExpiring(Builder $query, int $days = 30): Builder {
        return $query->active()->whereDate('expiry_date', '>=', now())
            ->whereDate('expiry_date', '<=', now()->addDays($days));
    }
    
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function items(): HasMany { return $this->hasMany(ContractItem::class); }
}
```

### Product Model (Minimal)
```php
class Product extends Model
{
    use SoftDeletes;
    protected $table = 'products';
}
```

### Key Tables Referenced in Queries
- **contracts**: id, customer_id, status, sign_date, expiry_date, value, payment_cycle
- **contract_items**: id, contract_id, product_id, unit_price, quantity
- **customers**: id, customer_code, customer_name, customer_sector, tax_code
- **products**: id, product_code, product_name, status, domain_id
- **payment_schedules**: contract_id, expected_date, expected_amount, actual_paid_date, actual_paid_amount, status
- **invoices**: id, invoice_date, total_amount, paid_amount, due_date, status
- **receipts**: id, invoice_id, receipt_date, amount, status
- **revenue_targets**: id, period_type, period_key, dept_id, target_amount, actual_amount
- **revenue_snapshots**: target_id, snapshot_date, actual_amount

---

## 7. Frontend Integration Patterns

### Frontend Types Definition

```typescript
// Customer Insight Response
interface CustomerInsight {
  customer: {/* customer entity */};
  contracts_summary: {
    total_count: number;
    total_value: number;
    active_value: number;
    by_status: Record<string, any>;
  };
  services_used: CustomerInsightServiceUsed[];  // products in contracts
  opportunities_summary: {
    pipeline_count: number;
    pipeline_amount: number;
    by_stage: Record<string, any>;
  };
  crc_summary: {
    open_count: number;
    total_count: number;
    by_status: Record<string, any>;
  };
  upsell_candidates: CustomerInsightUpsellCandidate[];  // ← SUGGESTIONS
}

// Revenue Analytics Response
interface ContractRevenueAnalytics {
  kpis: RevenueAnalyticsKpis;
  by_period: Array<{
    period_key: string;
    period_label: string;
    expected: number;
    actual: number;
    outstanding: number;
    overdue: number;
    schedule_count: number;
    paid_count: number;
  }>;
  by_cycle: any[];
  by_contract: any[];
  by_item: RevenueByItem[] | null;
  overdue_details: any[];
}

// Fee Collection Dashboard Response
interface FeeCollectionDashboard {
  kpis: FeeCollectionKpis;
  by_month: Array<{
    month: string;
    expected: number;
    actual: number;
    collection_rate: number;
  }>;
  top_debtors: Array<{
    customer_name: string;
    total_outstanding: number;
    days_overdue: number;
  }>;
  urgent_overdue: Array<{
    customer_name: string;
    amount: number;
    days_overdue: number;
  }>;
}
```

### Frontend API Fetch Pattern

```typescript
// In frontend/services/v5Api.ts

export const fetchCustomerInsight = async (id: string | number): Promise<{ data: CustomerInsight }> => {
  const res = await apiFetch(`/api/v5/customers/${id}/insight`);
  return res.json() as Promise<{ data: CustomerInsight }>;
};

export const fetchContractRevenueAnalytics = async (
  params: RevenueAnalyticsParams
): Promise<ContractRevenueAnalytics> => {
  const query = new URLSearchParams();
  query.set('period_from', params.period_from);
  query.set('period_to', params.period_to);
  if (params.grouping) query.set('grouping', params.grouping);
  if (typeof params.contract_id === 'number') query.set('contract_id', String(params.contract_id));
  
  const res = await apiFetch(`/api/v5/contracts/revenue-analytics?${query.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'FETCH_CONTRACT_REVENUE_ANALYTICS_FAILED'));
  return parseItemJson<ContractRevenueAnalytics>(res);
};

export const fetchFeeCollectionDashboard = async (params: {
  period_from: string;
  period_to: string;
}): Promise<{ data: FeeCollectionDashboard }> => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  const res = await apiFetch(`/api/v5/fee-collection/dashboard?${qs}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'FETCH_FEE_COLLECTION_DASHBOARD_FAILED'));
  return res.json();
};
```

### Frontend Dashboard Component Pattern

```typescript
// Components display dashboards via tabs/views
// Example: ContractRevenueView in frontend/components/contract-revenue/ContractRevenueView.tsx

export const ContractRevenueView: React.FC<ContractRevenueViewProps> = ({
  periodFrom,
  periodTo,
  periodLabel,
  onNotify,
}) => {
  const [analytics, setAnalytics] = useState<ContractRevenueAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [grouping, setGrouping] = useState<'month' | 'quarter'>('month');
  
  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      try {
        const result = await fetchContractRevenueAnalytics({
          period_from: periodFrom || '',
          period_to: periodTo || '',
          grouping,
        });
        setAnalytics(result);
      } catch (error) {
        onNotify?.('error', 'Lỗi', 'Không thể tải dữ liệu');
      } finally {
        setIsLoading(false);
      }
    };
    
    void loadAnalytics();
  }, [periodFrom, periodTo, grouping]);
  
  if (isLoading) return <LoadingSpinner />;
  if (!analytics) return <EmptyState />;
  
  return (
    <div>
      {/* Display KPIs */}
      <KPICards kpis={analytics.kpis} />
      
      {/* Display period breakdown */}
      <PeriodTable byPeriod={analytics.by_period} />
      
      {/* Display contracts breakdown */}
      <ContractTable byContract={analytics.by_contract} />
    </div>
  );
};
```

---

## 8. Key Architecture Insights

### Insight #1: Composition Over Inheritance
- Controllers delegate to multiple specialized services
- Each service handles a specific concern (Domain CRUD, Analytics, Suggestions)
- Allows flexible service swapping without controller changes

### Insight #2: Table Existence Checks for Graceful Degradation
```php
if (!$this->support->hasTable('contracts')) {
    return $this->support->missingTable('contracts');  // 503
}
```
- System continues with reduced functionality if tables not migrated
- Supports multi-tenant setups with optional modules

### Insight #3: KPIs in Response Metadata
- List endpoints return KPIs in `meta.kpis` (not separate query)
- Avoids N+1 queries; aggregations already computed for filtering
- Frontend can show stats without additional API calls

### Insight #4: Cache Invalidation Strategy
```php
// Mutation listener (e.g., in ContractDomainService::store)
CustomerInsightService::invalidateCache($customerId);

// Static flush method for batch operations
FeeCollectionDashboardService::flushCache();
```
- Fine-grained cache invalidation (per-customer insight)
- Bulk cache flush available for massive changes
- TTL-based expiry as additional safety net

### Insight #5: Period Bucketing as Core Pattern
- Used by both RevenueForecastService and RevenueOverviewService
- Supports month/quarter grouping dynamically
- Generates both buckets and labels for UI

### Insight #6: Data Access Control via Read Scope
```php
private function applyReadScope(Request $request, Builder $query): void
{
    // Filter by user's department/data_scope
    if ($this->support->hasColumn('customers', 'data_scope')) {
        $userScope = auth()->user()->data_scope;
        $query->where('data_scope', $userScope);
    }
}
```
- Row-level access control applied at query level
- Transparent to higher layers (controller, frontend)

### Insight #7: Suggestion Logic Pattern
- Used in `CustomerInsightService::buildUpsellCandidates()`
- Query excludes already-used items
- Sorts by popularity (usage_count DESC)
- Limited to top N results (LIMIT 8)
- Can be extended with scoring/ranking logic

### Insight #8: Revenue Reconciliation
```php
// RevenueOverviewService: invoice supersedes linked payment_schedule when fee collection active
if ($this->feeCollectionAvailable) {
    // Prefer invoice data over payment_schedule
    $dataSources[] = 'invoices';
}
```
- System reconciles multiple data sources
- Clear precedence when conflicts exist
- Reports data source in response metadata

---

## 9. Patterns for Building Product Suggestions Service

Based on exploration, here's the recommended architecture:

### Structure
```
backend/app/Services/V5/Product/
├── ProductSuggestionsService.php          (Main suggestions engine)
├── ProductSuggestionsScoringService.php   (Scoring logic)
└── ProductSuggestionsAnalyticsService.php (Analytics/insights)
```

### Service Layer Pattern (Recommended)
```php
// ProductSuggestionsService.php
namespace App\Services\V5\Product;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ProductSuggestionsService
{
    private const CACHE_TTL = 300;  // 5 minutes
    
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly ProductSuggestionsScoringService $scoringService,
        private readonly ProductSuggestionsAnalyticsService $analyticsService,
    ) {}
    
    // Main endpoint
    public function suggestions(Request $request, ?int $customerId = null): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'include_analytics' => ['sometimes', 'boolean'],
            'customer_id' => ['sometimes', 'integer'],
        ]);
        
        $limit = (int) ($validated['limit'] ?? 10);
        $includeAnalytics = (bool) ($validated['include_analytics'] ?? false);
        $customerId = $customerId ?? (int) ($validated['customer_id'] ?? 0);
        
        if ($customerId <= 0) {
            return response()->json(['message' => 'Customer ID required'], 400);
        }
        
        // Check table exists
        if (!$this->support->hasTable('products') || !$this->support->hasTable('contracts')) {
            return $this->support->missingTable('products or contracts');
        }
        
        $cacheKey = "v5:product-suggestions:{$customerId}:limit_{$limit}:v1";
        
        $suggestions = Cache::remember($cacheKey, self::CACHE_TTL, function () use (
            $customerId,
            $limit,
            $includeAnalytics
        ) {
            $candidates = $this->getCandidates($customerId, $limit);
            
            // Score and rank candidates
            $scored = collect($candidates)
                ->map(fn ($candidate) => [
                    ...$candidate,
                    'score' => $this->scoringService->computeScore($candidate, $customerId),
                ])
                ->sortByDesc('score')
                ->values();
            
            // Optionally include analytics
            if ($includeAnalytics) {
                $scored = $scored->map(fn ($item) => [
                    ...$item,
                    'analytics' => $this->analyticsService->getProductAnalytics($item['id']),
                ]);
            }
            
            return $scored;
        });
        
        return response()->json(['data' => $suggestions]);
    }
    
    public function invalidateCache(int $customerId): void
    {
        Cache::forget("v5:product-suggestions:{$customerId}:*");
    }
    
    private function getCandidates(int $customerId, int $limit): array
    {
        // Get products NOT in customer's contracts
        $usedProductIds = DB::table('contract_items as ci')
            ->join('contracts as c', 'c.id', '=', 'ci.contract_id')
            ->where('c.customer_id', $customerId)
            ->whereNull('c.deleted_at')
            ->pluck('ci.product_id')
            ->toArray();
        
        return DB::table('products as p')
            ->leftJoin('contract_items as ci', 'ci.product_id', '=', 'p.id')
            ->whereNull('p.deleted_at')
            ->where('p.status', 'ACTIVE')
            ->whereNotIn('p.id', $usedProductIds ?: [0])
            ->groupBy('p.id', 'p.product_code', 'p.product_name', 'p.description')
            ->select(
                'p.id',
                'p.product_code',
                'p.product_name',
                'p.description',
                DB::raw('COUNT(DISTINCT ci.contract_id) as popularity'),
                DB::raw('COUNT(DISTINCT ci.id) as total_items_sold'),
                DB::raw('AVG(ci.unit_price) as avg_price'),
            )
            ->orderByDesc('popularity')
            ->limit($limit * 2)  // Fetch more for scoring
            ->get()
            ->toArray();
    }
}
```

### Endpoint Route
```php
// backend/routes/api/master-data.php
Route::get('/products/suggestions', [ProductController::class, 'suggestions'])
    ->middleware('permission:products.read');

Route::get('/customers/{id}/product-suggestions', [CustomerController::class, 'productSuggestions'])
    ->middleware('permission:customers.read');
```

### Controller Integration
```php
// backend/app/Http/Controllers/Api/V5/ProductController.php
public function __construct(
    V5DomainSupportService $support,
    V5AccessAuditService $accessAudit,
    private readonly ProductDomainService $productService,
    private readonly ProductSuggestionsService $suggestionsService,  // ← New
    // ... existing services
) {
    parent::__construct($support, $accessAudit);
}

public function suggestions(Request $request): JsonResponse
{
    return $this->suggestionsService->suggestions($request);
}
```

### Frontend Integration
```typescript
// frontend/services/v5Api.ts
export const fetchProductSuggestions = async (params: {
  customer_id: number;
  limit?: number;
  include_analytics?: boolean;
}): Promise<{ data: ProductSuggestion[] }> => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  
  const res = await apiFetch(`/api/v5/products/suggestions?${qs}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'FETCH_PRODUCT_SUGGESTIONS_FAILED'));
  return res.json();
};
```

---

## Summary of Key Patterns

| Pattern | Example | Usage |
|---------|---------|-------|
| **Domain Service** | CustomerDomainService | CRUD + KPI aggregation for lists |
| **Insight Service** | CustomerInsightService | Multi-section aggregation (360° view) |
| **Analytics Service** | FeeCollectionDashboardService | Dashboard with KPIs + breakdowns + caching |
| **Suggestion Service** | RevenueTargetService::suggest() | Generate recommendations from data |
| **Period Bucketing** | RevenueOverviewService | Month/quarter grouping for analytics |
| **Cache Invalidation** | CustomerInsightService::invalidateCache() | Fine-grained cache control |
| **Table Checks** | $this->support->hasTable() | Graceful degradation |
| **Data Access Control** | applyReadScope() | Row-level filtering |
| **KPI in Metadata** | $meta['kpis'] | List response enrichment |

---

## Recommended Next Steps

1. **Create ProductSuggestionsService** following the pattern above
2. **Add routes** in `backend/routes/api/master-data.php`
3. **Integrate into ProductController** with proper cache invalidation
4. **Frontend Components**: Create React components for suggestion display
5. **Testing**: Add unit tests for scoring logic and caching behavior
