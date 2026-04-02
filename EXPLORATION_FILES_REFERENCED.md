# Backend Architecture Exploration - Files Referenced

## Exploration Date
2026-03-29

## API Routes Examined

### Core Routes
- `backend/routes/api.php` — Main API router with middleware stack
- `backend/routes/api/master-data.php` — Customers, Products, Departments, Employees, Vendors, Businesses endpoints
- `backend/routes/api/customers.php` — Customer-specific routes including `insight` endpoint
- `backend/routes/api/contracts.php` — Contract CRUD + `revenue-analytics` endpoint
- `backend/routes/api/fee-collection.php` — Fee collection dashboard, debt aging, invoices, receipts
- `backend/routes/api/revenue.php` — Revenue management (overview, targets, forecast, report)

**Key Finding**: Routes are organized by feature/domain with consistent pattern:
```php
Route::get('/resource', [ControllerClass::class, 'method'])
    ->middleware('permission:resource.read');
```

---

## Controllers Examined

### Files
- `backend/app/Http/Controllers/Api/V5/V5BaseController.php` — Base controller with injected services
- `backend/app/Http/Controllers/Api/V5/CustomerController.php` — CRUD + insight with caching
- `backend/app/Http/Controllers/Api/V5/ProductController.php` — Product CRUD + feature catalogs + quotations
- `backend/app/Http/Controllers/Api/V5/ContractController.php` — CRUD + revenue analytics delegation
- `backend/app/Http/Controllers/Api/V5/RevenueManagementController.php` — Multi-service delegation pattern
- `backend/app/Http/Controllers/Api/V5/FeeCollectionController.php` — Dashboard + CRUD delegations

**Key Pattern**: Controllers delegate to specialized services, never implement business logic directly.

**Cache Example** (CustomerController):
```php
public function insight(int $id): JsonResponse
{
    $cacheKey = "v5:customer-insight:{$id}:v1";
    
    $payload = Cache::remember(
        $cacheKey,
        self::INSIGHT_CACHE_TTL_SECONDS,  // 300
        fn () => $this->insightService->buildInsight($id)->getData(true)
    );
    
    return response()->json($payload);
}
```

---

## Service Layer - Domain Services

### Files Examined
- `backend/app/Services/V5/Domain/CustomerDomainService.php` (154+ lines)
  - Responsibility: Customer CRUD + KPI building
  - Pattern: index() includes filtering, sorting, read scope, KPI aggregation
  - Returns: List response with KPIs in metadata
  
- `backend/app/Services/V5/Domain/CustomerInsightService.php` (150+ lines)
  - Responsibility: 360° customer aggregation (contracts, services, opportunities, CRC, upsell)
  - Pattern: Multi-section response structure
  - Key Method: `buildUpsellCandidates()` — query products NOT in customer's contracts, sort by popularity
  
- `backend/app/Services/V5/Domain/ProductDomainService.php` — Product CRUD
- `backend/app/Services/V5/Domain/ContractDomainService.php` — Contract CRUD + payments
- `backend/app/Services/V5/Domain/LeadershipDashboardService.php` — Leadership dashboard
- `backend/app/Services/V5/Domain/ProductFeatureCatalogDomainService.php`
- `backend/app/Services/V5/Domain/ProductQuotationDomainService.php`

**All Domain Services Follow Pattern**:
1. Check table/column existence
2. Build query with filtering, sorting, pagination
3. Apply read scope (data access control)
4. Serialize results
5. Return JSON response

---

## Service Layer - Analytics Services

### Files Examined
- `backend/app/Services/V5/Contract/ContractRevenueAnalyticsService.php` (150+ lines)
  - Responsibility: Revenue analytics with period bucketing
  - Pattern: Period bucket generation → Data aggregation → KPI computation
  - Supports: month/quarter grouping, contract-specific filtering
  - Response includes: kpis, by_period, by_cycle, by_contract, by_item, overdue_details

- `backend/app/Services/V5/FeeCollection/FeeCollectionDashboardService.php` (150+ lines)
  - Responsibility: Fee collection dashboard
  - Cache: 2 minutes (v5:fc:dashboard:{from}:{to}:v1)
  - Pattern: Cache::remember() → Build data → Return
  - Response includes: kpis, by_month, top_debtors, urgent_overdue
  - Method: `flushCache()` — Pattern-based cache invalidation

- `backend/app/Services/V5/Revenue/RevenueOverviewService.php` (150+ lines)
  - Responsibility: Revenue overview dashboard
  - Pattern: Complex multi-step (buckets → contracts → targets → reconciliation → alerts)
  - Features: Period bucketing (month/quarter), fee collection reconciliation, alerts generation

- `backend/app/Services/V5/Revenue/RevenueTargetService.php` (150+ lines)
  - Responsibility: Revenue target CRUD + **suggest() endpoint** ← KEY PATTERN
  - Methods: index(), store(), update(), destroy(), bulkStore(), **suggest()**
  - Suggestion Logic: Query historical data → Compute suggestions → Return with confidence scores

---

## Service Layer - Utility Services

### Files Examined
- `backend/app/Services/V5/V5DomainSupportService.php`
  - Methods: 
    - `hasTable(string)` — Check if table exists
    - `hasColumn(string, string)` — Check if column exists
    - `selectColumns(string, array)` — Get available columns
    - `readFilterParam(Request, string)` — Get filter parameter
    - `resolveSortColumn(Request, array, string)` — Get sort field
    - `resolveSortDirection(Request)` — Get sort direction
    - `resolvePaginationParams(Request, int, int)` — Get page/per_page
    - `serializeCustomer(Customer)`, `serializeContract(Contract)`, etc. — Serialization helpers
    - `buildPaginationMeta()` — Pagination metadata builder
    - `missingTable()` — 503 response for missing tables

- `backend/app/Services/V5/V5AccessAuditService.php`
  - Responsibility: Audit logging of mutations

---

## Models Examined

### Files
- `backend/app/Models/Customer.php`
  - Relations: projects(), contracts(), opportunities()
  - Soft deletes enabled
  
- `backend/app/Models/Contract.php`
  - Relations: customer, project, items, childContracts, parentContract
  - Scopes: active(), expiring(int), byDepartment(int)
  - Key columns: status (SIGNED, RENEWED, DRAFT), value, payment_cycle, sign_date, expiry_date

- `backend/app/Models/Product.php` — Minimal (soft deletes only)
- Other models referenced: ContractItem, RevenueTarget, RevenueSnapshot, Invoice, Receipt

---

## Frontend Integration Points

### Files Examined
- `frontend/services/v5Api.ts` (6800+ lines)
  - Functions:
    - `fetchCustomerInsight(id)` → GET `/api/v5/customers/{id}/insight`
    - `fetchContractRevenueAnalytics(params)` → GET `/api/v5/contracts/revenue-analytics?{params}`
    - `fetchFeeCollectionDashboard(params)` → GET `/api/v5/fee-collection/dashboard?{params}`
  - Pattern: apiFetch() wrapper → validation → parseItemJson() or res.json()
  - Error handling: parseErrorMessage() with error codes

- `frontend/components/Dashboard.tsx` (150+ lines)
  - Example dashboard component with KPI cards, status breakdowns, charts
  - Pattern: Display formatted currency, date, status labels with color codes

- `frontend/components/contract-revenue/ContractRevenueView.tsx` (100+ lines)
  - Example analytics view component
  - Pattern: useState for data + isLoading, useEffect for data fetching, conditional rendering
  - Features: Period selection, grouping toggle (month/quarter), sorting, detail expansion

- `frontend/components/revenue-mgmt/RevenueByCollectionView.tsx`
  - Uses FeeCollectionDashboard type
  - Pattern: fetch data → state management → conditional rendering

- `frontend/types.ts` (6800+ lines)
  - Type definitions for all API responses
  - Key types:
    - `CustomerInsight` — 360° customer view
    - `ContractRevenueAnalytics` — Revenue analytics response
    - `FeeCollectionDashboard` — Fee collection dashboard response
    - `RevenueOverviewResponse` — Revenue overview response

---

## Architecture Patterns Found

### Pattern 1: Domain Service (CRUD)
**Files**: CustomerDomainService, ProductDomainService, ContractDomainService
- Responsibility: CRUD + KPI aggregation
- Response structure: { data: [], meta: { page, per_page, total, kpis } }

### Pattern 2: Insight Service (360° Aggregation)
**Files**: CustomerInsightService
- Responsibility: Multi-section aggregation
- Response structure: { data: { customer, contracts_summary, services_used, opportunities_summary, crc_summary, upsell_candidates } }

### Pattern 3: Analytics Service (Dashboard)
**Files**: FeeCollectionDashboardService, ContractRevenueAnalyticsService, RevenueOverviewService
- Responsibility: Complex multi-dimensional analysis
- Features: Period bucketing, KPI computation, caching, cache invalidation

### Pattern 4: Suggestion Service ← TARGET PATTERN
**Files**: RevenueTargetService (suggest() method)
- Responsibility: Generate recommendations based on historical data
- Method: suggest(Request) → JsonResponse with suggestions array
- Response: { data: [{ period_key, historical_actual, suggested_target, growth_rate, confidence }] }

### Pattern 5: Cache Invalidation
**Files**: CustomerController, FeeCollectionDashboardService
- Single-entity cache: Cache::forget($cacheKey)
- Batch cache: FeeCollectionDashboardService::flushCache()
- TTL strategy: 300s for insight, 120s for dashboard

### Pattern 6: Period Bucketing
**Files**: RevenueOverviewService, ContractRevenueAnalyticsService
- Supports: month/quarter grouping
- Output: Array of periods with { period_key, period_label, period_start, period_end }

### Pattern 7: Data Access Control
**Files**: CustomerDomainService (applyReadScope method)
- Pattern: Where clause filtered by user's data_scope
- Location: Applied at query builder level before pagination

### Pattern 8: Table Existence Checks
**Files**: All domain/analytics services
- Pattern: if (!$this->support->hasTable(...)) return $this->support->missingTable(...)
- Response: 503 Service Unavailable
- Benefit: Graceful degradation for optional modules

---

## Key Insights

1. **Service Composition**: Controllers are thin; all logic in services
2. **Cache Strategy**: 
   - Insight data: 5 minutes (frequent views, rare changes)
   - Dashboard data: 2 minutes (frequent updates)
   - Cache invalidation via mutation listeners
3. **KPIs in Metadata**: List responses include KPIs without separate queries
4. **Period Bucketing**: Core pattern for time-series analytics
5. **Suggestion Logic**: Products NOT in customer contracts, sorted by popularity
6. **Graceful Degradation**: Table/column checks allow optional modules
7. **Data Isolation**: Row-level access control via read scope
8. **Response Consistency**: All endpoints return { data, meta } or { data, meta, errors }

---

## Files Not Examined (Not Necessary for Understanding)

- Database migrations (schema understood from model relationships)
- Request validation classes (consistent pattern across files)
- Model factories and seeders
- Test files
- Admin command scripts

---

## Recommended Files to Create/Modify

For implementing Product Suggestions feature:

1. **Create**: `backend/app/Services/V5/Product/ProductSuggestionsService.php`
2. **Create**: `backend/app/Services/V5/Product/ProductSuggestionsScoringService.php`
3. **Create**: `backend/app/Services/V5/Product/ProductSuggestionsAnalyticsService.php`
4. **Modify**: `backend/routes/api/master-data.php` — Add suggestions routes
5. **Modify**: `backend/app/Http/Controllers/Api/V5/ProductController.php` — Add suggestions method
6. **Modify**: `backend/app/Services/V5/Domain/ProductDomainService.php` — Add cache invalidation
7. **Create**: `frontend/components/ProductSuggestions.tsx` — React component
8. **Modify**: `frontend/services/v5Api.ts` — Add fetchProductSuggestions()
9. **Modify**: `frontend/types.ts` — Add ProductSuggestion types

---

## Summary

The VNPT system follows a well-established service layer architecture:
- **Thin Controllers**: Delegate to services
- **Service Specialization**: Each service has a single responsibility (CRUD, Analytics, Suggestions, etc.)
- **Consistent Patterns**: All services follow similar structure (validation → logic → cache → response)
- **Smart Caching**: TTL-based with manual invalidation on mutations
- **Graceful Degradation**: Table/column checks allow optional features
- **Type Safety**: Frontend has comprehensive type definitions for all API responses

The **Suggestion Pattern** is already implemented in `RevenueTargetService::suggest()` and can be adapted for products.
