# Products & Contracts Exploration: Quick Summary

## 📊 What I Explored

1. **Frontend TypeScript Interfaces** (`frontend/types.ts`)
   - Product, Contract, ContractItem, Customer, PaymentSchedule
   - CustomerInsight with upsell_candidates
   
2. **Backend Models** (`backend/app/Models/`)
   - Product, Contract, ContractItem, Customer (with relationships)
   
3. **Database Schema** (migrations)
   - products, contracts, contract_items, customers, payment_schedules
   - Foreign keys and indexes
   
4. **API Endpoints** (`frontend/services/v5Api.ts`)
   - `/api/v5/products`, `/api/v5/contracts`, `/api/v5/customers`
   - **Key endpoint**: `/api/v5/customers/{id}/insight` ← Upsell suggestions here!
   
5. **Backend Services** (Domain Services)
   - ProductDomainService
   - ContractDomainService
   - **CustomerInsightService** ← Core upsell engine!
   
6. **Frontend Components**
   - ProductList.tsx, ContractList.tsx, Customer 360 Insight panels

---

## 🎯 Key Data Relationships

```
CUSTOMER
  ├── contracts (HasMany Contract)
  │   ├── items (HasMany ContractItem)
  │   │   └── product (BelongsTo Product)
  │   └── payment_schedules (HasMany PaymentSchedule)
  └── opportunities (HasMany Opportunity)

PRODUCT
  ├── contracts via ContractItem
  └── features (ProductFeature)

CONTRACT
  ├── customer (BelongsTo Customer)
  ├── items (HasMany ContractItem)
  ├── payment_schedules (HasMany PaymentSchedule)
  └── parent_contract (for renewals)
```

---

## 🔍 What Already Exists: CustomerInsightService

**Location**: `backend/app/Services/V5/Domain/CustomerInsightService.php`

This is the **core engine for upsell recommendations**. It provides:

### Methods:
- `buildInsight(customerId)` — Main entry point
- `buildContractsSummary()` — How many/much they've bought
- `buildServicesUsed()` — Products they already use
- `buildUpsellCandidates()` — **What to suggest next**
- `buildOpportunitiesSummary()` — Open pipeline
- `buildCrcSummary()` — Support cases

### Upsell Algorithm (buildUpsellCandidates):

1. **Get products customer already uses**
   - Query contract_items → products in active contracts
   
2. **Check for HIS products**
   - If customer has ANY HIS → exclude ALL HIS from suggestions
   - Business rule: hospitals choose either HIS or non-HIS ecosystem
   
3. **Pre-aggregate popularity** (single query, not correlated subqueries)
   - Count how many OTHER customers use each product
   - This is social proof: "47 other hospitals use this"
   
4. **Query upsell candidates**
   - Only active products (is_active=true)
   - NOT in customer's existing contracts
   - Order by: GROUP_A first (priority), then popularity DESC
   - Limit to 8 suggestions
   
5. **Get reference customers** (≤3 names per product)
   - Who else is using this product?
   - Social proof: "Hospitals A, B, C use this"

### Result Structure:
```typescript
{
  product_id: 5,
  product_name: "HIS Enterprise",
  standard_price: 50000,
  unit: "per year",
  service_group: "GROUP_A",
  service_group_label: "Dịch vụ nhóm A",
  reason: "Dịch vụ nhóm A",
  popularity: 47,           // 47 other customers
  is_priority: true,        // GROUP_A gets badge
  reference_customers: ["Hospital A", "Hospital B", "Clinic C"]
}
```

### Cache:
- 5 minutes per customer: `v5:customer-insight:{id}:v1`
- Invalidated on customer/contract/CRC updates

---

## 📋 Data Available for Sales Suggestions

### Customer Segmentation Dimensions:
- `customer_sector` (HEALTHCARE, GOVERNMENT, INDIVIDUAL, OTHER)
- `healthcare_facility_type` (PUBLIC_HOSPITAL, PRIVATE_HOSPITAL, MEDICAL_CENTER, etc.)
- `bed_capacity` (for hospital size clustering)
- `customer_name`, `tax_code`, `address`

### Contract Behavior:
- `payment_cycle` (ONCE, MONTHLY, QUARTERLY, YEARLY)
- `status` (DRAFT, SIGNED, RENEWED) — renewals = loyal customers
- `value` (contract amount)
- `term_unit`, `term_value` (duration)
- `expiry_date` (renewal opportunity timing)

### Payment Health:
- `PaymentSchedule.expected_amount` vs `actual_paid_amount` → Collection rate
- `PaymentSchedule.status` (PENDING, PAID, OVERDUE) → Payment discipline
- `Contract.penalty_rate` → Late payment risk

### Product Usage:
- `service_group` (GROUP_A=priority, GROUP_B, GROUP_C)
- `domain_id` (for VAT lookup)
- `standard_price` (for revenue analysis)
- `is_active` (only suggest active products)

---

## 🚫 What DOES NOT Exist Yet

**No backend services for**:
- Finding **similar customers** (by sector, size, contract patterns)
- **Product affinity** analysis ("customers who bought X also bought Y")
- **RFM segmentation** (Recency/Frequency/Monetary)
- **Payment health scoring**
- **Renewal opportunity pipeline**
- **Cross-sell recommendations**

---

## 🛠️ Key Optimizations in CustomerInsightService

### 1. VAT Rate Memoization
```php
// Problem: Every product needs VAT lookup from business_domains
// Solution: Load all VAT rates once, use in PHP
private function resolveVatRateMap(): array {
    if ($this->vatRateMap !== null) return $this->vatRateMap;
    
    $domains = DB::table('business_domains')->get();
    // Build: { domain_id → multiplier (1.10 | 1.08 | 1.00) }
    return $this->vatRateMap = $map;
}
```

### 2. Pre-aggregated Popularity
```sql
-- Problem: Correlated subquery = N queries for N products
-- Solution: Single derived table
$popularitySubquery = DB::table('contract_items as ci2')
    ->join('contracts as c2', 'c2.id', '=', 'ci2.contract_id')
    ->where('c2.customer_id', '!=', $customerId)
    ->select(
        'ci2.product_id',
        DB::raw('COUNT(DISTINCT c2.customer_id) as pop_count')
    )
    ->groupBy('ci2.product_id');

// Then LEFT JOIN once
$query = DB::table('products as p')
    ->leftJoinSub($popularitySubquery, 'pop', ...)
```

### 3. Covering Indexes
- `idx_ci_product_contract` on contract_items
- `idx_ps_contract_expected_status` on payment_schedules

---

## 🏗️ API Endpoints Reference

### Products
- `GET /api/v5/products` — List all products
- `GET /api/v5/products?pagination` — Paginated products
- `POST /api/v5/products` — Create product
- `PUT /api/v5/products/{id}` — Update product

### Contracts
- `GET /api/v5/contracts` — List all contracts
- `GET /api/v5/contracts?pagination` — Paginated contracts
- `GET /api/v5/contracts/revenue-analytics` — Analytics
- `GET /api/v5/contracts/payment-schedules` — Payment data
- `POST /api/v5/contracts` — Create contract
- `POST /api/v5/contracts/{id}/generate-payments` — Generate payment schedule

### Customers
- `GET /api/v5/customers` — List all customers
- `GET /api/v5/customers?pagination` — Paginated customers
- **`GET /api/v5/customers/{id}/insight`** ← **Key endpoint!**
  - Returns: contracts_summary, services_used, upsell_candidates, crc_summary

---

## 📁 Important Files Reference

| File | Purpose |
|------|---------|
| `frontend/types.ts` | All TypeScript interfaces |
| `frontend/services/v5Api.ts` | All API calls |
| `backend/app/Models/Product.php` | Product model |
| `backend/app/Models/Contract.php` | Contract model with relationships |
| `backend/app/Models/ContractItem.php` | Link model (Contract ↔ Product) |
| `backend/app/Models/Customer.php` | Customer model with relationships |
| `backend/app/Services/V5/Domain/CustomerInsightService.php` | **Upsell engine** |
| `backend/app/Http/Controllers/Api/V5/CustomerController.php` | Customer API (has insight() method) |
| `frontend/components/ProductList.tsx` | Product UI |
| `frontend/components/ContractList.tsx` | Contract UI |
| `backend/database/migrations/2026_02_23_134500_create_v5_enterprise_master_tables.php` | Core schema |
| `backend/database/migrations/2026_03_19_170000_create_contract_items_table.php` | ContractItem schema |

---

## 💡 Building Sales Suggestions: Options

### Option 1: Leverage CustomerInsightService
- Extend `buildUpsellCandidates()` with additional logic
- Add similar customer finding
- Add cross-sell recommendations

### Option 2: New Service (RecommendationEngine)
- Similar customer finder
- Product affinity analyzer
- Payment health scorer
- Renewal opportunity detector

### Option 3: Hybrid
- Use existing CustomerInsightService for upsell
- Add new endpoints for similar customers, product affinity, etc.

---

## ✅ Confidence Level

**HIGH** — The codebase is well-documented and organized:
- Clear separation of concerns (Models, Services, Controllers)
- Consistent API response patterns
- Good performance optimizations in place
- Comprehensive TypeScript types
- Already has sophisticated insight/recommendation logic

Ready to build upon this foundation!
