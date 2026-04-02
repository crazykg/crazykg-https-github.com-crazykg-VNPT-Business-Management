# VNPT Business Management System: Products, Contracts & Customers Exploration Report

**Date**: 2026-03-29  
**Scope**: Complete data model understanding for sales suggestion feature development

---

## Executive Summary

The VNPT system has a well-established data model connecting **Products**, **Contracts**, **Customers**, and **Payment Schedules**. There is already sophisticated "Customer 360 Insight" functionality that analyzes customer history and recommends upsell products. This document maps out all components needed for building a sales suggestion system based on product/contract analysis.

**Key Finding**: No existing "similar customer" or "customer segmentation" logic currently exists, but the infrastructure is ready to build upon.

---

## 1. FRONTEND DATA TYPES & INTERFACES

### 1.1 Product Interface
**File**: `frontend/types.ts` (lines 328-346)

```typescript
export interface Product {
  id: string | number;
  uuid?: string;
  service_group?: string | null;           // GROUP_A, GROUP_B, GROUP_C
  product_code: string;
  product_name: string;
  package_name?: string | null;
  domain_id: string | number;              // Links to business domain (VAT calculation)
  vendor_id: string | number;
  standard_price: number;
  unit?: string | null;                    // e.g., "per month", "per year", etc.
  description?: string | null;
  attachments?: Attachment[];
  is_active?: boolean;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}
```

**Key Fields for Sales**:
- `service_group`: Categorizes products into A/B/C for prioritization
- `domain_id`: Used to calculate VAT-adjusted pricing
- `standard_price`: Base pricing for recommendations
- `is_active`: Only active products are suggested

### 1.2 Contract Interface
**File**: `frontend/types.ts` (lines 1983-2019)

```typescript
export interface Contract {
  id: string | number;
  contract_code: string;
  contract_number?: string;
  contract_name: string;
  customer_id: string | number | null;     // CRITICAL: Link to Customer
  project_id: string | number | null;      // Optional project reference
  project_type_code?: InvestmentMode | string | null;
  value: number;
  total_value?: number;
  payment_cycle?: PaymentCycle;            // ONCE, MONTHLY, QUARTERLY, etc.
  status: ContractStatus;                  // DRAFT, SIGNED, RENEWED
  sign_date?: string | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  term_unit?: ContractTermUnit | null;     // DAY, MONTH, YEAR
  term_value?: number | null;
  items?: ContractItem[];                  // Line items (products in contract)
  // Renewal tracking
  parent_contract_id?: string | number | null;
  addendum_type?: AddendumType | null;
  gap_days?: number | null;
  continuity_status?: ContinuityStatus | null;
  penalty_rate?: number | null;            // For overdue penalties
  parent_contract?: {                      // Parent contract info for renewals
    id: number;
    contract_code: string;
    contract_name: string;
    expiry_date?: string | null;
    deleted_at?: string | null;
  } | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}
```

**Key Fields for Sales**:
- `customer_id`: CRITICAL link between Contract ↔ Customer
- `items`: Array of ContractItem (products in contract)
- `status`: SIGNED/RENEWED are "active" contracts
- `expiry_date`: For renewal/upsell timing
- `value`: Contract value for segmentation
- `payment_cycle`: Recurring vs. one-time

### 1.3 ContractItem Interface
**File**: `frontend/types.ts` (lines 1970-1981)

```typescript
export interface ContractItem {
  id: string | number;
  contract_id: string | number;            // Link to Contract
  product_id: string | number;             // Link to Product
  product_code?: string | null;
  product_name?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  vat_rate?: number | null;
  vat_amount?: number | null;
}
```

**Purpose**: Links products to contracts; contains pricing override (unit_price vs. standard_price)

### 1.4 Customer Interface
**File**: `frontend/types.ts` (lines 432-457)

```typescript
export interface Customer {
  id: string | number;
  uuid: string;
  customer_code: string | null;
  customer_code_auto_generated?: boolean | null;
  customer_name: string;
  company_name?: string | null;
  tax_code: string;
  address: string;
  customer_sector?: 'HEALTHCARE' | 'GOVERNMENT' | 'INDIVIDUAL' | 'OTHER' | null;
  healthcare_facility_type?:
    | 'PUBLIC_HOSPITAL'
    | 'PRIVATE_HOSPITAL'
    | 'MEDICAL_CENTER'
    | 'PRIVATE_CLINIC'
    | 'TYT_PKDK'
    | 'HOSPITAL_TTYT'
    | 'TYT_CLINIC'
    | 'OTHER'
    | null;
  bed_capacity?: number | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}
```

**Segmentation Fields**:
- `customer_sector`: Healthcare, Government, Individual, Other
- `healthcare_facility_type`: Specific healthcare sub-type (for hospital targeting)
- `bed_capacity`: Hospital size indicator

### 1.5 CustomerInsight Interface (EXISTING UPSELL LOGIC!)
**File**: `frontend/types.ts` (lines 470-501)

```typescript
export interface CustomerInsightUpsellCandidate {
  product_id: string | number;
  product_name: string;
  standard_price: number;
  unit?: string | null;
  service_group?: string | null;
  service_group_label: string;             // Vietnamese: "Dịch vụ nhóm A"
  reason: string;
  popularity: number;                      // How many OTHER customers use this
  is_priority: boolean;                    // true if GROUP_A
  reference_customers: string[];           // ≤3 customer names as proof
}

export interface CustomerInsight {
  customer: Customer;
  contracts_summary: {
    total_count: number;
    total_value: number;
    active_value: number;
    by_status: Record<string, number>;
  };
  services_used: CustomerInsightServiceUsed[];  // Products already in use
  crc_summary: {                                 // Support cases
    total_cases: number;
    open_cases: number;
    by_status: Record<string, number>;
  };
  upsell_candidates: CustomerInsightUpsellCandidate[];  // Suggested products
}
```

### 1.6 PaymentSchedule Interface
**File**: `frontend/types.ts` (lines 2021-2043)

```typescript
export interface PaymentSchedule {
  id: string | number;
  contract_id: string | number;
  project_id?: string | number | null;
  milestone_name: string;
  cycle_number: number;
  expected_date: string;
  expected_amount: number;
  actual_paid_date?: string | null;
  actual_paid_amount: number;
  status: PaymentScheduleStatus;            // PENDING, PAID, OVERDUE, etc.
  notes?: string | null;
  confirmed_by?: string | number | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  attachments?: Attachment[];
  // Penalty audit
  original_amount?: number | null;
  penalty_rate?: number | null;
  penalty_amount?: number | null;
  created_at?: string;
  updated_at?: string;
}
```

**Payment Analysis Fields**:
- `expected_amount` vs `actual_paid_amount`: Collection analytics
- `status`: For identifying at-risk contracts
- `penalty_rate`: Late payment penalties

---

## 2. BACKEND DATA MODELS (Eloquent)

### 2.1 Backend Product Model
**File**: `backend/app/Models/Product.php`

```php
class Product extends Model {
    use SoftDeletes;
    protected $table = 'products';
}
```

**Status**: Minimal model — no explicit relationships defined yet. Relationships are lazy-loaded via ContractItem.

### 2.2 Backend Contract Model
**File**: `backend/app/Models/Contract.php`

```php
class Contract extends Model {
    use SoftDeletes;
    protected $table = 'contracts';
    
    protected $fillable = [
        'contract_code', 'contract_name', 'customer_id', 'project_id',
        'project_type_code', 'value', 'payment_cycle', 'status',
        'sign_date', 'effective_date', 'expiry_date', 'term_unit',
        'term_value', 'expiry_date_manual_override', 'parent_contract_id',
        'addendum_type', 'gap_days', 'continuity_status', 'penalty_rate'
    ];
    
    // Key relationships:
    public function customer(): BelongsTo {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
    
    public function project(): BelongsTo {
        return $this->belongsTo(Project::class, 'project_id');
    }
    
    public function parentContract(): BelongsTo {
        return $this->belongsTo(self::class, 'parent_contract_id');
    }
    
    public function childContracts(): HasMany {
        return $this->hasMany(self::class, 'parent_contract_id');
    }
    
    public function items(): HasMany {
        return $this->hasMany(ContractItem::class, 'contract_id');
    }
    
    // Query scopes:
    public function scopeActive(Builder $query): Builder {
        return $query->whereIn('status', ['SIGNED', 'RENEWED']);
    }
    
    public function scopeExpiring(Builder $query, int $days = 30): Builder {
        return $query
            ->active()
            ->whereDate('expiry_date', '>=', now()->toDateString())
            ->whereDate('expiry_date', '<=', now()->addDays($days)->toDateString());
    }
}
```

### 2.3 Backend Customer Model
**File**: `backend/app/Models/Customer.php`

```php
class Customer extends Model {
    use SoftDeletes;
    protected $table = 'customers';
    
    protected $fillable = [
        'uuid', 'customer_code', 'customer_code_auto_generated',
        'customer_name', 'tax_code', 'address',
        'customer_sector', 'healthcare_facility_type', 'bed_capacity',
        'data_scope', 'created_by', 'updated_by'
    ];
    
    // Key relationships:
    public function projects(): HasMany {
        return $this->hasMany(Project::class, 'customer_id');
    }
    
    public function contracts(): HasMany {
        return $this->hasMany(Contract::class, 'customer_id');
    }
    
    public function opportunities(): HasMany {
        return $this->hasMany(Opportunity::class, 'customer_id');
    }
}
```

### 2.4 Backend ContractItem Model
**File**: `backend/app/Models/ContractItem.php`

```php
class ContractItem extends Model {
    protected $table = 'contract_items';
    
    protected $fillable = [
        'contract_id', 'product_id', 'quantity', 'unit_price',
        'vat_rate', 'vat_amount', 'created_by', 'updated_by'
    ];
    
    protected $casts = [
        'quantity' => 'float',
        'unit_price' => 'float',
        'vat_rate' => 'float',
        'vat_amount' => 'float',
    ];
    
    public function contract(): BelongsTo {
        return $this->belongsTo(Contract::class, 'contract_id');
    }
    
    public function product(): BelongsTo {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
```

---

## 3. DATABASE SCHEMA

### 3.1 Products Table
**Migration**: `2026_02_23_134500_create_v5_enterprise_master_tables.php`

**Schema** (inferred from later migrations):
- `id` (PK)
- `uuid` (unique, nullable)
- `service_group` (nullable) — GROUP_A, GROUP_B, GROUP_C
- `product_code` (unique)
- `product_name`
- `package_name` (nullable)
- `domain_id` (FK to business_domains) — for VAT lookup
- `vendor_id` (FK to vendors)
- `standard_price` (decimal)
- `unit` (nullable) — "per month", "per year", etc.
- `description` (nullable)
- `is_active` (boolean)
- `created_at`, `updated_at`
- `created_by`, `updated_by` (user IDs)
- `deleted_at` (soft delete)

### 3.2 Customers Table
**Migration**: `2026_02_23_134500_create_v5_enterprise_master_tables.php`

**Schema**:
- `id` (PK)
- `uuid` (unique, nullable)
- `customer_code` (unique) — auto-generated or manual
- `customer_code_auto_generated` (boolean)
- `customer_name`
- `company_name` (nullable) — Added later
- `tax_code` (nullable)
- `address` (text)
- `customer_sector` (nullable) — HEALTHCARE, GOVERNMENT, INDIVIDUAL, OTHER
- `healthcare_facility_type` (nullable) — PUBLIC_HOSPITAL, PRIVATE_HOSPITAL, etc.
- `bed_capacity` (nullable, int)
- `data_scope` (nullable) — for multi-tenancy
- `created_at`, `updated_at`
- `created_by`, `updated_by`
- `deleted_at` (soft delete)

### 3.3 Contracts Table
**Migration**: `2026_02_23_134500_create_v5_enterprise_master_tables.php`

**Schema**:
- `id` (PK)
- `contract_code` (unique)
- `contract_number` (nullable, added later)
- `contract_name`
- `customer_id` (FK to customers) — **CRITICAL**
- `project_id` (FK to projects, nullable)
- `project_type_code` (nullable) — InvestmentMode
- `value` (decimal) — contract value
- `total_value` (nullable, decimal) — added later
- `payment_cycle` (nullable) — ONCE, MONTHLY, QUARTERLY, YEARLY
- `status` (varchar(20)) — DRAFT, SIGNED, RENEWED
- `sign_date` (date, nullable)
- `effective_date` (date, nullable) — Added in migration 2026_02_27_180000
- `expiry_date` (date, nullable)
- `expiry_date_manual_override` (boolean)
- `term_unit` (nullable) — DAY, MONTH, YEAR (added in 2026_03_01_030000)
- `term_value` (float, nullable) — added in 2026_03_01_030000
- `parent_contract_id` (FK, nullable) — for renewals/addenda
- `addendum_type` (nullable) — for renewal tracking
- `gap_days` (int, nullable) — gap between parent expiry and this effective
- `continuity_status` (nullable) — for tracking continuity
- `penalty_rate` (float, nullable) — penalty multiplier for late payments
- `data_scope` (nullable)
- `created_at`, `updated_at`
- `created_by`, `updated_by`
- `deleted_at` (soft delete)

### 3.4 Contract Items Table
**Migration**: `2026_03_19_170000_create_contract_items_table.php`

**Schema**:
```sql
CREATE TABLE contract_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    contract_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(12,2) DEFAULT 1,
    unit_price DECIMAL(15,2) DEFAULT 0,
    vat_rate FLOAT NULL,
    vat_amount FLOAT NULL,
    created_by BIGINT UNSIGNED NULL,
    updated_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    
    UNIQUE KEY uq_ci_contract_product (contract_id, product_id),
    INDEX idx_ci_contract (contract_id),
    
    FOREIGN KEY fk_ci_contract REFERENCES contracts(id) ON DELETE CASCADE,
    FOREIGN KEY fk_ci_product REFERENCES products(id)
);
```

### 3.5 Payment Schedules Table
**Inferred from migrations** `2026_02_27_210500`, `2026_03_01_020000`, `2026_03_19_160000`

**Schema** (reconstructed from procedure references):
- `id` (PK)
- `contract_id` (FK to contracts)
- `project_id` (FK to projects, nullable)
- `milestone_name` (varchar) — e.g., "Phase 1", "Q1 Payment"
- `cycle_number` (int) — 1, 2, 3... for ordering
- `expected_date` (date) — when payment expected
- `expected_amount` (decimal) — planned amount
- `actual_paid_date` (date, nullable)
- `actual_paid_amount` (decimal)
- `status` (varchar) — PENDING, PAID, OVERDUE, COMPLETED
- `notes` (text, nullable)
- `confirmed_by` (FK to users, nullable)
- `confirmed_by_name` (varchar, nullable)
- `confirmed_at` (timestamp, nullable)
- `original_amount` (decimal, nullable) — for penalty tracking
- `penalty_rate` (float, nullable)
- `penalty_amount` (float, nullable)
- `created_at`, `updated_at`
- `deleted_at` (soft delete)

**Indexes**:
- `idx_ps_contract_expected_status` on `(contract_id, expected_date, status)`
- `idx_ps_contract_expected` on `(contract_id, expected_date)`

---

## 4. API ENDPOINTS

### 4.1 Frontend Services (v5Api.ts)

#### Products

```typescript
export const fetchProducts = async (): Promise<Product[]>
  => fetchList<Product>('/api/v5/products');

export const fetchProductsPaginated = (query: PaginatedQuery): Promise<PaginatedResult<Product>>
  => fetchPaginatedList<Product>('/api/v5/products', query);

export const fetchProductFeatureCatalog = async (productId: string | number): Promise<ProductFeatureCatalog>
  => GET /api/v5/products/{productId}/feature-catalog

export const createProduct = (payload: Product): Promise<{ data: Product }>
  => POST /api/v5/products

export const updateProduct = (id: string | number, payload: Partial<Product>): Promise<{ data: Product }>
  => PUT/PATCH /api/v5/products/{id}
```

#### Contracts

```typescript
export const fetchContracts = async (): Promise<Contract[]>
  => fetchList<Contract>('/api/v5/contracts');

export const fetchContractsPaginated = (query: PaginatedQuery): Promise<PaginatedResult<Contract>>
  => fetchPaginatedList<Contract>('/api/v5/contracts', query);

export const fetchContractRevenueAnalytics = (query: PaginatedQuery)
  => GET /api/v5/contracts/revenue-analytics?{query}

export const createContract = (payload: StoreContractRequest): Promise<{ data: Contract }>
  => POST /api/v5/contracts

export const updateContract = (id: string | number, payload: UpdateContractRequest): Promise<{ data: Contract }>
  => PUT/PATCH /api/v5/contracts/{id}

export const fetchPaymentSchedules = (query: PaginatedQuery): Promise<PaginatedResult<PaymentSchedule>>
  => GET /api/v5/contracts/payment-schedules?{query}

export const updatePaymentSchedule = (id: string | number, payload: PaymentScheduleConfirmationPayload)
  => PUT /api/v5/contracts/payment-schedules/{id}
```

#### Customers

```typescript
export const fetchCustomers = async (): Promise<Customer[]>
  => fetchList<Customer>('/api/v5/customers');

export const fetchCustomersPaginated = (query: PaginatedQuery): Promise<PaginatedResult<Customer>>
  => fetchPaginatedList<Customer>('/api/v5/customers', query);

// **THIS IS THE KEY ENDPOINT FOR SALES SUGGESTIONS**
export const fetchCustomerInsight = async (id: string | number): Promise<{ data: CustomerInsight }>
  => GET /api/v5/customers/{id}/insight
  
  // Returns:
  // - contracts_summary (count, value, breakdown)
  // - services_used (products already purchased)
  // - upsell_candidates (recommended products NOT in use)
  //   - popularity: how many other customers use this
  //   - reference_customers: ≤3 customer names as proof
  //   - is_priority: true if GROUP_A
  // - crc_summary (support cases)
```

### 4.2 Backend Controllers

#### ProductController
**File**: `backend/app/Http/Controllers/Api/V5/ProductController.php`

```php
public function index(Request $request): JsonResponse
public function store(StoreProductRequest $request): JsonResponse
public function update(UpdateProductRequest $request, int $id): JsonResponse
public function destroy(Request $request, int $id): JsonResponse
public function featureCatalog(Request $request, int $id): JsonResponse
public function featureCatalogList(Request $request, int $id): JsonResponse
public function updateFeatureCatalog(Request $request, int $id): JsonResponse
public function exportQuotationWord(Request $request): Response
public function exportQuotationPdf(Request $request): Response
public function exportQuotationExcel(Request $request): Response
public function quotations(Request $request): JsonResponse
```

#### ContractController
**File**: `backend/app/Http/Controllers/Api/V5/ContractController.php`

```php
public function index(Request $request): JsonResponse
public function show(Request $request, int $id): JsonResponse
public function revenueAnalytics(Request $request): JsonResponse
public function store(StoreContractRequest $request): JsonResponse
public function update(UpdateContractRequest $request, int $id): JsonResponse
public function destroy(Request $request, int $id): JsonResponse
public function generatePayments(Request $request, int $id): JsonResponse
public function paymentSchedules(Request $request): JsonResponse
public function updatePaymentSchedule(Request $request, int $id): JsonResponse
```

#### CustomerController
**File**: `backend/app/Http/Controllers/Api/V5/CustomerController.php`

```php
public function index(Request $request): JsonResponse
public function store(StoreCustomerRequest $request): JsonResponse
public function update(UpdateCustomerRequest $request, int $id): JsonResponse
public function destroy(Request $request, int $id): JsonResponse

/**
 * GET /api/v5/customers/{id}/insight
 * The KEY endpoint for sales analysis!
 * Returns CustomerInsight with upsell_candidates, services_used, etc.
 * Cached for 5 minutes per customer_id.
 */
public function insight(int $id): JsonResponse {
    $cacheKey = "v5:customer-insight:{$id}:v1";
    $payload = Cache::remember(
        $cacheKey,
        300,  // 5 minutes
        fn () => $this->insightService->buildInsight($id)->getData(true)
    );
    return response()->json($payload);
}
```

---

## 5. EXISTING UPSELL/INSIGHT LOGIC

### 5.1 CustomerInsightService
**File**: `backend/app/Services/V5/Domain/CustomerInsightService.php`

This is the CORE service for sales analytics. It builds comprehensive "Customer 360" insights including upsell recommendations.

#### Key Methods:

```php
public function buildInsight(int $customerId): JsonResponse {
    // Returns JSON with:
    return [
        'data' => [
            'customer'              => Customer object,
            'contracts_summary'     => buildContractsSummary(),
            'services_used'         => buildServicesUsed(),
            'opportunities_summary' => buildOpportunitiesSummary(),
            'crc_summary'           => buildCrcSummary(),
            'upsell_candidates'     => buildUpsellCandidates(),
        ],
    ];
}

private function buildContractsSummary(int $customerId): array {
    // Calculates:
    // - total_count: number of contracts
    // - total_value: sum with VAT applied
    // - active_value: value of SIGNED+RENEWED contracts
    // - by_status: breakdown by contract status
    
    // Key optimization: Loads VAT multiplier map once in PHP
    // instead of per-row CASE statement in SQL
}

private function buildServicesUsed(int $customerId): array {
    // Returns products already in customer's active contracts:
    // [
    //   {
    //     product_id, product_name, unit, service_group,
    //     contract_count: (how many contracts use this),
    //     total_value: (with VAT)
    //   },
    //   ...
    // ]
}

private function buildUpsellCandidates(int $customerId): array {
    // **MAIN ALGORITHM FOR SALES SUGGESTIONS**
    
    // Step 1: Get products customer already uses
    $usedProductIds = [...];
    
    // Step 2: Check if customer has HIS product
    //   If yes → exclude ALL HIS products from suggestions
    $hasHisProduct = [...];
    
    // Step 3: Pre-aggregate popularity (SINGLE QUERY)
    //   Problem: Correlated subqueries are slow (N queries for N products)
    //   Solution: Single derived table with popularity counts
    $popularitySubquery = /* pre-aggregate all product popularity */;
    
    // Step 4: Query upsell candidates
    //   - Only active (is_active=true) products
    //   - NOT in customer's existing products
    //   - Exclude HIS products if customer has HIS
    //   - Order by: GROUP_A first (is_priority), then popularity DESC
    //   - Limit: 8 suggestions
    
    // Step 5: Get reference_customers (≤3 names per product)
    //   - Join contract_items → contracts → customers
    //   - Show which other customers use this product
    //   - Provides social proof: "Hospitals X, Y, Z use this"
    
    return [
        [
            'product_id' => 15,
            'product_name' => 'HIS Enterprise Package',
            'standard_price' => 50000,
            'unit' => 'per year',
            'service_group' => 'GROUP_A',
            'service_group_label' => 'Dịch vụ nhóm A',
            'reason' => 'Dịch vụ nhóm A',
            'popularity' => 47,  // 47 other customers use this
            'is_priority' => true,  // GROUP_A gets priority badge
            'reference_customers' => ['Hospital A', 'Hospital B', 'Clinic C']
        ],
        // ... up to 8 total
    ];
}

private function buildOpportunitiesSummary(int $customerId): array {
    // Pipeline analysis: open opportunities by stage
    // total_count, total_amount, by_stage breakdown
}

private function buildCrcSummary(int $customerId): array {
    // Support cases: total, open, by status
}
```

#### Key Optimizations:

1. **VAT Calculation**: Loaded once per request, not per-row
2. **Popularity Pre-aggregation**: Single derived table query
3. **Reference Customers**: Distinct customer names, limited to 3 per product
4. **HIS Product Logic**: If customer has ANY HIS product, exclude ALL HIS products

#### Cache Strategy:

```php
// 5-minute cache per customer
$cacheKey = "v5:customer-insight:{$customerId}:v1";
Cache::remember($cacheKey, 300, fn () => /* build insight */);

// Cache invalidated when:
// - Customer is updated/deleted
// - Contract is added/updated/deleted
// - CRC case is added/updated/deleted
```

---

## 6. FRONTEND COMPONENTS

### 6.1 ProductList.tsx
**File**: `frontend/components/ProductList.tsx`

- Displays products in a table with filters/search
- Columns: product_code, package_name, description, standard_price, service_group, product_name, domain_id, vendor_id, unit, is_active, actions
- Integrates with ProductQuotationTab for quotation building
- Export to CSV/Excel/PDF

### 6.2 ContractList.tsx
**File**: `frontend/components/ContractList.tsx`

- Displays contracts with filtering by status, sign_date
- Shows contract summary: count, total value, payment metrics
- Links to ContractRevenueView for analytics
- Integrates PaymentSchedule display

### 6.3 Customer 360 Insight Panel (Used in CustomerDetails)

Components that leverage `fetchCustomerInsight`:
- Displays upsell_candidates with reference_customers
- Shows services_used (products already purchased)
- Shows contracts_summary (count, value breakdown)
- Shows crc_summary (open support cases)

---

## 7. DATA RELATIONSHIPS & FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                        CUSTOMER                             │
│  (customer_sector, healthcare_facility_type, bed_capacity)  │
└──────────────────────────────────────────────────────────────┘
                           ▲
                           │ customer_id FK
                           │
┌─────────────────────────────────────────────────────────────┐
│                        CONTRACT                             │
│  (status, value, payment_cycle, expiry_date, items[])       │
│  (parent_contract_id for renewals)                          │
└──────────────────────────────────────────────────────────────┘
                           ▲
                           │ contract_id FK
                           │
┌─────────────────────────────────────────────────────────────┐
│                     CONTRACT_ITEM                           │
│  (quantity, unit_price, vat_rate, vat_amount)               │
└──────────────────────────────────────────────────────────────┘
                           ▲
                           │ product_id FK
                           │
┌─────────────────────────────────────────────────────────────┐
│                        PRODUCT                              │
│  (service_group, domain_id, standard_price, is_active)      │
└──────────────────────────────────────────────────────────────┘

PAYMENT FLOW (for revenue analysis):
┌─────────────────────────────────────────────────────────────┐
│                        CONTRACT                             │
│  (value, payment_cycle, status, term_unit, term_value)      │
└──────────────────────────────────────────────────────────────┘
                           ▼
           Generated via sp_generate_contract_payments
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   PAYMENT_SCHEDULE                          │
│  (contract_id, expected_date, expected_amount,              │
│   actual_paid_amount, status, penalty_rate)                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. KEY FINDINGS FOR SALES SUGGESTIONS

### 8.1 Data Available for Segmentation

**Customer Attributes** (for similar customer targeting):
- `customer_sector` (HEALTHCARE, GOVERNMENT, INDIVIDUAL, OTHER)
- `healthcare_facility_type` (PUBLIC_HOSPITAL, PRIVATE_HOSPITAL, MEDICAL_CENTER, etc.)
- `bed_capacity` (for hospital size clustering)
- `tax_code`, `address`, `customer_name` (for additional grouping)

**Contract Attributes** (for behavior-based recommendations):
- `payment_cycle` (ONCE, MONTHLY, QUARTERLY)
- `status` (DRAFT, SIGNED, RENEWED) — renewals indicate loyal customers
- `value` (for revenue-based segmentation)
- `term_unit`, `term_value` (contract duration)

**Product Usage** (what's popular):
- `service_group` (GROUP_A=high-priority, GROUP_B, GROUP_C)
- `popularity` count (via aggregation across all customers)
- `reference_customers` (social proof)

### 8.2 Payment Collection Insights

From `PaymentSchedule` data:
- `expected_amount` vs `actual_paid_amount` → Collection rate per customer
- `status` (PENDING, PAID, OVERDUE) → Payment discipline
- `penalty_rate` on contract → Late payment risk indicator

### 8.3 Renewal/Continuity Tracking

From `Contract`:
- `parent_contract_id` + `addendum_type` → Renewal chain
- `gap_days` → Time gap between parent expiry and renewal
- `continuity_status` → Whether renewal maintains continuity
- `expiry_date` → Renewal opportunity timing

### 8.4 NO EXISTING SIMILAR CUSTOMER LOGIC

**Critical Finding**: There is **NO** backend service for:
- Finding similar customers (by sector, facility type, contract patterns)
- Segmenting customers by RFM (Recency, Frequency, Monetary)
- Recommending products based on similar customer usage patterns

**Opportunity**: This is a blank canvas for building sophisticated segmentation.

---

## 9. ARCHITECTURE PATTERNS USED

### 9.1 Service Layer (Domain Services)

```
Backend Structure:
  app/Services/V5/Domain/
  ├── ProductDomainService.php
  ├── ContractDomainService.php
  ├── CustomerDomainService.php
  ├── CustomerInsightService.php  ← Key file!
  └── ...

Frontend Structure:
  frontend/services/
  ├── v5Api.ts  ← All API calls here
  └── ...
```

### 9.2 Query Optimization Patterns

- **VAT Rate Memoization**: Load static lookup table once, use in PHP
- **Pre-aggregated Subqueries**: Use derived tables for popularity
- **Covering Indexes**: idx_ci_product_contract for contract_items
- **Soft Deletes**: All models use `deleted_at` for logical deletion

### 9.3 Caching

- **5-minute cache** for CustomerInsight (regenerates on data change)
- Cache key format: `v5:{entity}:{id}:v1`
- Invalidated on update/delete operations

---

## 10. RECOMMENDATIONS FOR SALES SUGGESTION FEATURE

### 10.1 Data Analysis Opportunities

1. **Similar Customer Discovery**
   - Find customers in same sector with similar contract value ranges
   - Use `customer_sector` + `healthcare_facility_type` + `bed_capacity` as dimensions
   - Example: "Show me hospitals like this one that have 50-100 contracts"

2. **Product Affinity Analysis**
   - Which products are commonly bought together (market basket analysis)
   - "Customers who bought X also bought Y"
   - Use ContractItem aggregation

3. **Customer Lifecycle Segmentation**
   - RFM analysis: Recency (last contract date), Frequency (contract count), Monetary (total value)
   - Identify at-risk customers (no new contracts in 6+ months)
   - Identify growth opportunities (high-frequency, high-value customers)

4. **Payment Health Scoring**
   - Collection rate per customer (actual_paid_amount / expected_amount)
   - On-time payment ratio
   - Flag customers with overdue payments (status = OVERDUE)
   - Identify cash flow patterns (MONTHLY vs. ONCE)

5. **Renewal Pipeline**
   - Find contracts expiring in next 30/60/90 days
   - Track renewal success rate via parent_contract_id chains
   - Identify customers with gaps in coverage

### 10.2 API Endpoints to Create

Suggested new endpoints for sales suggestions:

```php
// 1. Similar customers endpoint
GET /api/v5/customers/{id}/similar
  Response: {
    similar_customers: [
      { id, customer_name, sector, facility_type, contract_count, contract_value },
      ...
    ],
    similarity_score: 0.85  // 0-1 scale
  }

// 2. Product affinity endpoint
GET /api/v5/products/{id}/frequently-bought-with
  Response: {
    product_id: 5,
    frequently_bought_with: [
      { product_id, product_name, frequency_count, co_occurrence_rate },
      ...
    ]
  }

// 3. Customer segmentation endpoint
GET /api/v5/customers/segments
  Response: {
    by_sector: { HEALTHCARE: 450, GOVERNMENT: 120, ... },
    by_rfm: {
      high_value: 50,
      at_risk: 20,
      new: 15,
      dormant: 5
    },
    payment_health: {
      excellent: 200,
      good: 150,
      at_risk: 50
    }
  }

// 4. Sales opportunities endpoint
GET /api/v5/customers/{id}/opportunities
  Response: {
    upsell_candidates: [...],  // Existing
    cross_sell_candidates: [...],  // NEW
    renewal_candidates: [...],  // Contracts expiring soon
    payment_recovery: [...],  // Overdue payments
    similar_customer_usage: [...]  // What similar customers buy
  }
```

### 10.3 Frontend Components to Create

- `SimilarCustomerList.tsx` — Show comparable customers
- `ProductAffinityChart.tsx` — Visualize product relationships
- `CustomerSegmentAnalysis.tsx` — RFM/Payment health dashboard
- `SalesOpportunityPanel.tsx` — Integrated opportunity view

---

## 11. APPENDIX: KEY SQL PATTERNS

### Finding Customer's Products (In Use vs. Available)

```sql
-- Products customer is ALREADY USING
SELECT DISTINCT p.id, p.product_name, p.service_group
FROM contract_items ci
JOIN contracts c ON c.id = ci.contract_id
JOIN products p ON p.id = ci.product_id
WHERE c.customer_id = ? AND c.status IN ('SIGNED', 'RENEWED')
ORDER BY p.product_name;

-- Products available but NOT in use (upsell candidates)
SELECT DISTINCT p.id, p.product_name, p.service_group, p.standard_price,
       COUNT(DISTINCT c2.customer_id) as popularity
FROM products p
LEFT JOIN contract_items ci ON p.id = ci.product_id
LEFT JOIN contracts c ON c.id = ci.contract_id AND c.customer_id != ?
WHERE p.is_active = 1
  AND p.id NOT IN (
    SELECT DISTINCT p2.id
    FROM contract_items ci2
    JOIN contracts c2 ON c2.id = ci2.contract_id
    WHERE c2.customer_id = ? AND c2.status IN ('SIGNED', 'RENEWED')
  )
GROUP BY p.id
ORDER BY CASE WHEN p.service_group = 'GROUP_A' THEN 0 ELSE 1 END ASC,
         popularity DESC
LIMIT 8;

-- Similar customers (same sector, similar contract value)
SELECT c2.id, c2.customer_name, c2.customer_sector, c2.healthcare_facility_type,
       COUNT(con.id) as contract_count,
       SUM(con.value) as total_contract_value
FROM customers c2
LEFT JOIN contracts con ON con.customer_id = c2.id AND con.status IN ('SIGNED', 'RENEWED')
WHERE c2.customer_sector = ?
  AND c2.healthcare_facility_type = ?
  AND c2.id != ?
GROUP BY c2.id
ORDER BY ABS(SUM(con.value) - ?) ASC  -- Similar total value
LIMIT 10;
```

---

## CONCLUSION

The VNPT system has a **robust foundation** for building sophisticated sales suggestion features:

✅ **Strong**: Products-Contracts-Customers relationships  
✅ **Strong**: Existing CustomerInsight service with upsell logic  
✅ **Strong**: Payment schedule tracking for collection analysis  
✅ **Strong**: Renewal/continuity tracking via parent_contract_id  
✅ **Strong**: Service group prioritization (GROUP_A/B/C)  

🔲 **Blank Canvas**: No similar customer discovery logic  
🔲 **Blank Canvas**: No product affinity analysis  
🔲 **Blank Canvas**: No RFM customer segmentation  
🔲 **Blank Canvas**: No payment health scoring  

**Recommendation**: Build upon `CustomerInsightService` architecture to add:
1. Similar customer finder
2. Product affinity engine
3. Payment health analytics
4. Renewal opportunity pipeline
