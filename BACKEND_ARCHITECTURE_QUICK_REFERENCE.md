# Backend Architecture Quick Reference

## Directory Structure

```
backend/
├── routes/api.php                          Main API router
├── routes/api/
│   ├── master-data.php                    Customers, Products, Vendors (CRUD endpoints)
│   ├── customers.php                      Customer-specific routes
│   ├── contracts.php                      Contract routes (CRUD + revenue-analytics)
│   ├── fee-collection.php                 Fee collection dashboard & invoices/receipts
│   ├── revenue.php                        Revenue management (overview, targets, forecast)
│   └── ...
│
├── app/Http/Controllers/Api/V5/
│   ├── V5BaseController.php              Base with V5DomainSupportService, V5AccessAuditService
│   ├── CustomerController.php            index, store, update, destroy, insight (with cache)
│   ├── ProductController.php             index, store, update, destroy, quotations
│   ├── ContractController.php            index, show, store, update, destroy, revenueAnalytics
│   ├── RevenueManagementController.php   Delegates to Revenue/* services
│   ├── FeeCollectionController.php       Delegates to FeeCollection/* services
│   └── ...
│
├── app/Services/V5/
│   ├── Domain/
│   │   ├── CustomerDomainService.php                CRUD + KPI building
│   │   ├── CustomerInsightService.php              360° view (contracts, services, upsell)
│   │   ├── ProductDomainService.php                Product CRUD
│   │   ├── ContractDomainService.php               Contract CRUD + payments
│   │   ├── LeadershipDashboardService.php          Leadership dashboard
│   │   └── ... (32 more domain services)
│   │
│   ├── Contract/
│   │   ├── ContractRevenueAnalyticsService.php    Revenue analytics (period bucketing, KPIs)
│   │   ├── ContractPaymentService.php
│   │   ├── ContractRenewalService.php
│   │   └── ...
│   │
│   ├── FeeCollection/
│   │   ├── FeeCollectionDashboardService.php      Dashboard (KPIs, by_month, debtors, overdue)
│   │   ├── DebtAgingReportService.php
│   │   ├── InvoiceDomainService.php
│   │   ├── ReceiptDomainService.php
│   │   └── ...
│   │
│   ├── Revenue/
│   │   ├── RevenueOverviewService.php             Dashboard with period buckets, alerts
│   │   ├── RevenueTargetService.php               Target CRUD + suggest() endpoint
│   │   ├── RevenueByContractService.php           Revenue breakdown per contract
│   │   ├── RevenueForecastService.php             Forecast computations
│   │   └── RevenueReportService.php               Report generation
│   │
│   ├── V5DomainSupportService.php                Utility: table checks, column checks, serialization
│   ├── V5AccessAuditService.php                  Audit logging
│   └── ...
│
├── app/Models/
│   ├── Customer.php              relationships: projects(), contracts(), opportunities()
│   ├── Contract.php              relationships: customer, project, items, childContracts
│   ├── Product.php               (minimal implementation)
│   ├── ContractItem.php          links contract to product
│   ├── RevenueTarget.php         revenue target planning
│   ├── RevenueSnapshot.php       closed period actual values
│   └── Invoice.php, Receipt.php  fee collection entities
│
└── database/migrations/
    ├── 2026_*_create_contracts_table
    ├── 2026_*_create_contract_items_table
    ├── 2026_*_create_payment_schedules_table
    ├── 2026_*_create_invoices_table
    ├── 2026_*_create_receipts_table
    ├── 2026_*_create_revenue_targets_table
    ├── 2026_*_create_revenue_snapshots_table
    └── ...
```

## API Route Patterns

### Endpoint Structure
```
GET    /api/v5/customers              → CustomerDomainService::index()
GET    /api/v5/customers/{id}/insight → CustomerInsightService::buildInsight()  [CACHED 300s]
POST   /api/v5/customers              → CustomerDomainService::store()
PUT    /api/v5/customers/{id}         → CustomerDomainService::update()
DELETE /api/v5/customers/{id}         → CustomerDomainService::destroy()

GET    /api/v5/products               → ProductDomainService::index()
POST   /api/v5/products               → ProductDomainService::store()
PUT    /api/v5/products/{id}          → ProductDomainService::update()
DELETE /api/v5/products/{id}          → ProductDomainService::destroy()

GET    /api/v5/contracts              → ContractDomainService::index()
GET    /api/v5/contracts/{id}         → ContractDomainService::show()
GET    /api/v5/contracts/revenue-analytics  → ContractRevenueAnalyticsService::analytics()
POST   /api/v5/contracts              → ContractDomainService::store()
PUT    /api/v5/contracts/{id}         → ContractDomainService::update()
DELETE /api/v5/contracts/{id}         → ContractDomainService::destroy()

GET    /api/v5/fee-collection/dashboard      → FeeCollectionDashboardService::dashboard()  [CACHED 120s]
GET    /api/v5/fee-collection/debt-aging     → DebtAgingReportService::report()
GET    /api/v5/fee-collection/debt-by-customer
GET    /api/v5/fee-collection/debt-trend

GET    /api/v5/revenue/overview      → RevenueOverviewService::overview()
GET    /api/v5/revenue/targets       → RevenueTargetService::index()
GET    /api/v5/revenue/targets/suggest → RevenueTargetService::suggest()  [SUGGESTION PATTERN]
POST   /api/v5/revenue/targets       → RevenueTargetService::store()
POST   /api/v5/revenue/targets/bulk  → RevenueTargetService::bulkStore()
GET    /api/v5/revenue/by-contract   → RevenueByContractService::index()
GET    /api/v5/revenue/forecast      → RevenueForecastService::forecast()
GET    /api/v5/revenue/report        → RevenueReportService::report()
```

## Service Layer Patterns

### Pattern 1: Domain Service (CRUD)
```php
class CustomerDomainService
{
    public function index(Request $request): JsonResponse
    {
        // 1. Check table exists
        // 2. Build query with filtering/search
        // 3. Apply sorting
        // 4. Apply read scope (data access control)
        // 5. Build KPIs for the list
        // 6. Paginate and serialize
        return response()->json([
            'data' => $rows,
            'meta' => [
                'page' => ..., 'per_page' => ..., 'total' => ...,
                'kpis' => [...],  // ← KPIs in metadata
            ]
        ]);
    }
}
```

### Pattern 2: Insight Service (360° Aggregation)
```php
class CustomerInsightService
{
    public function buildInsight(int $customerId): JsonResponse
    {
        return response()->json([
            'data' => [
                'customer'              => $customer,
                'contracts_summary'     => $this->buildContractsSummary($customerId),
                'services_used'         => $this->buildServicesUsed($customerId),
                'opportunities_summary' => $this->buildOpportunitiesSummary($customerId),
                'crc_summary'           => $this->buildCrcSummary($customerId),
                'upsell_candidates'     => $this->buildUpsellCandidates($customerId),  // ← SUGGESTIONS
            ],
        ]);
    }
}
```

### Pattern 3: Analytics Service (Dashboard)
```php
class FeeCollectionDashboardService
{
    public function dashboard(Request $request): JsonResponse
    {
        $from = $request->input('period_from');
        $to = $request->input('period_to');
        
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
    
    public static function flushCache(): void
    {
        // Pattern-based cache flush after mutations
    }
}
```

### Pattern 4: Suggestion Service (REFERENCE PATTERN)
```php
class RevenueTargetService
{
    public function suggest(Request $request): JsonResponse
    {
        $validated = $request->validate([...]);
        
        // 1. Query historical data
        $historicalActuals = $this->fetchHistoricalActuals(...);
        
        // 2. Compute suggestions
        $suggestions = [];
        foreach ($historicalActuals as $periodKey => $actualAmount) {
            $suggested = $this->computeSuggestedTarget($periodKey, $actualAmount);
            $suggestions[] = [
                'period_key' => $periodKey,
                'historical_actual' => $actualAmount,
                'suggested_target' => $suggested,
                'growth_rate' => ($suggested / $actualAmount - 1) * 100,
                'confidence' => 0.85,
            ];
        }
        
        return response()->json(['data' => $suggestions]);
    }
}
```

## Key Service Responsibilities

| Service | Responsibility |
|---------|-----------------|
| V5DomainSupportService | Table/column existence checks, serialization, pagination helpers |
| V5AccessAuditService | Audit logging of mutations |
| CustomerDomainService | Customer CRUD + KPI aggregation |
| CustomerInsightService | 360° customer view (contracts, services, opportunities, CRC, upsell) |
| ContractRevenueAnalyticsService | Revenue analytics with period bucketing, KPIs, contract breakdown |
| FeeCollectionDashboardService | Fee collection dashboard (KPIs, by_month, debtors, overdue) |
| RevenueOverviewService | Revenue dashboard (by_period, by_source, alerts) |
| RevenueTargetService | Revenue targets CRUD + **suggest()** endpoint |
| ProductDomainService | Product CRUD |
| ProductQuotationDomainService | Quotation management |

## Cache Strategy

```
Cache Key Format: "v5:{domain}:{entity_id}:{version}"

TTL Values:
  - Insight data: 300 seconds (5 min)       [CustomerInsight, frequent views, rare changes]
  - Dashboard data: 120 seconds (2 min)     [Fee collection, frequent updates]
  
Invalidation:
  - Automatic via mutation listeners        [After store/update/delete]
  - Static flush methods for batch ops      [FeeCollectionDashboardService::flushCache()]
  - TTL-based expiry as safety net
  
Example:
  $cacheKey = "v5:customer-insight:{$id}:v1";
  Cache::remember($cacheKey, 300, fn() => $this->buildInsight($id));
  Cache::forget($cacheKey);  // Invalidate on update
```

## Request/Response Patterns

### List Response (with KPIs in metadata)
```json
{
  "data": [{/*items*/}],
  "meta": {
    "page": 1,
    "per_page": 10,
    "total": 100,
    "kpis": {/*summary metrics*/}
  }
}
```

### Dashboard Response (complex structure)
```json
{
  "meta": {
    "fee_collection_available": true,
    "data_sources": ["contracts", "invoices"]
  },
  "data": {
    "kpis": {/*summary metrics*/},
    "by_period": [{/*period buckets with metrics*/}],
    "by_source": [{/*breakdown by source*/}],
    "alerts": [{/*business alerts*/}]
  }
}
```

### Insight Response (multi-section aggregation)
```json
{
  "data": {
    "customer": {/*entity*/},
    "contracts_summary": {/*summary*/},
    "services_used": [{/*list*/}],
    "opportunities_summary": {/*summary*/},
    "crc_summary": {/*summary*/},
    "upsell_candidates": [{/*suggestions*/}]
  }
}
```

### Suggestion Response
```json
{
  "data": [{
    "product_id": 1,
    "product_code": "PRD-001",
    "product_name": "Product Name",
    "score": 85.5,
    "popularity": 42,
    "avg_price": 5000000,
    "reason": "High usage, complementary to existing products"
  }]
}
```

## Period Bucketing Pattern

```php
private function buildPeriodBuckets(Carbon $from, Carbon $to, string $grouping): array
{
    $buckets = [];
    $cursor = $from->copy()->startOfMonth();
    $end = $to->copy()->endOfMonth();
    
    if ($grouping === 'quarter') {
        // Quarter bucketing logic
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

## Frontend Integration

### API Fetch Pattern (frontend/services/v5Api.ts)
```typescript
export const fetchCustomerInsight = async (id: string | number) => {
  const res = await apiFetch(`/api/v5/customers/${id}/insight`);
  return res.json() as Promise<{ data: CustomerInsight }>;
};

export const fetchContractRevenueAnalytics = async (params) => {
  const query = new URLSearchParams();
  query.set('period_from', params.period_from);
  query.set('period_to', params.period_to);
  if (params.grouping) query.set('grouping', params.grouping);
  
  const res = await apiFetch(`/api/v5/contracts/revenue-analytics?${query.toString()}`);
  if (!res.ok) throw new Error(...);
  return parseItemJson(res);
};
```

### Component Pattern (React)
```typescript
export const RevenueView: React.FC<Props> = ({ periodFrom, periodTo }) => {
  const [data, setData] = useState<ContractRevenueAnalytics | null>(null);
  
  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchContractRevenueAnalytics({
          period_from: periodFrom || '',
          period_to: periodTo || '',
        });
        setData(result);
      } catch (error) {
        // error handling
      }
    };
    
    void load();
  }, [periodFrom, periodTo]);
  
  return (
    <div>
      <KPICards kpis={data?.kpis} />
      <PeriodTable byPeriod={data?.by_period} />
    </div>
  );
};
```

## Building a Product Suggestions Service (Example)

### Structure
```
backend/app/Services/V5/Product/
├── ProductSuggestionsService.php
├── ProductSuggestionsScoringService.php
└── ProductSuggestionsAnalyticsService.php
```

### Route
```php
// backend/routes/api/master-data.php
Route::get('/products/suggestions', [ProductController::class, 'suggestions'])
    ->middleware('permission:products.read');
```

### Service Implementation
```php
class ProductSuggestionsService
{
    public function suggestions(Request $request, ?int $customerId = null): JsonResponse
    {
        // 1. Validate & extract parameters
        // 2. Get candidates (products NOT in customer's contracts)
        // 3. Score and rank candidates
        // 4. Return with optional analytics
        
        return response()->json(['data' => $suggestions]);
    }
    
    public function invalidateCache(int $customerId): void
    {
        Cache::forget("v5:product-suggestions:{$customerId}:*");
    }
}
```

---

## Quick Implementation Checklist

- [ ] Create `ProductSuggestionsService` in `backend/app/Services/V5/Product/`
- [ ] Add scoring logic in `ProductSuggestionsScoringService`
- [ ] Add route in `backend/routes/api/master-data.php`
- [ ] Integrate into `ProductController`
- [ ] Add cache invalidation in `ProductDomainService::store/update/destroy`
- [ ] Create frontend API function in `frontend/services/v5Api.ts`
- [ ] Create React component for suggestion display
- [ ] Add types to `frontend/types.ts`
- [ ] Test caching behavior
- [ ] Add audit logging via `V5AccessAuditService`
