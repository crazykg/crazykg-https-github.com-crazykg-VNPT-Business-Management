# Product-Customer Linking Data Structure Exploration
**Date**: 2026-03-29  
**Duration**: Very thorough exploration of existing data linking mechanisms  
**Objective**: Identify what data currently exists that links products to customer types

---

## Executive Summary

The VNPT Business Management system has a **fragmentary approach to product-customer linking**:

### Current State:
- ✅ **Products Table Exists** with basic fields (product_code, product_name, service_group, etc.)
- ✅ **Customers Table Has Segmentation Data** (customer_sector, healthcare_facility_type, bed_capacity)
- ✅ **Support Service Groups** (GROUP_A, GROUP_B, GROUP_C) mapped to products via service_group field
- ✅ **Product Features Catalog** system exists (product_feature_groups, product_features)
- ❌ **NO Explicit Product-Customer Type Mapping Table** exists
- ❌ **NO Product Categories/Tags/Segments Table** exists
- ❌ **NO Direct Linkage Between Products and Customer Types**

### Key Finding:
**Service groups (GROUP_A/B/C) are the ONLY product classification mechanism currently in place**, but they appear to be **internal business groupings, NOT customer-facing segments**. There is no documented customer type mapping to these groups.

---

## 1. Product Model & Database Structure

### 1.1 Product Model (`backend/app/Models/Product.php`)
```php
class Product extends Model
{
    use SoftDeletes;
    protected $table = 'products';
}
```
**Status**: Minimal model with no relationships defined

### 1.2 Products Table Columns (From ProductDomainService)

| Column | Type | Purpose | Notes |
|--------|------|---------|-------|
| id | INTEGER | Primary key | Auto-increment |
| service_group | varchar(50) | Internal grouping | Values: GROUP_A, GROUP_B, GROUP_C; Default: GROUP_B |
| product_code | varchar(100) | Product identifier | UNIQUE, Required |
| product_name | varchar(255) | Display name | Required |
| package_name | varchar(255) | Package/bundle name | Optional, NULLABLE |
| domain_id | INTEGER | Business domain | FK to business_domains table |
| vendor_id | INTEGER | Vendor reference | FK to vendors table |
| standard_price | DECIMAL(18,2) | Base pricing | Default: 0.00 |
| unit | varchar(50) | Unit of measure | Optional, e.g., "Gói", "Bộ" |
| description | TEXT | Product description | Optional, NULLABLE |
| is_active | BOOLEAN | Active status | Default: true |
| created_at, updated_at | TIMESTAMP | Audit fields | Standard Laravel timestamps |
| created_by, updated_by | INTEGER | Audit users | References users table |
| deleted_at | TIMESTAMP | Soft delete | SoftDeletes trait |

### 1.3 Products Table Observations

**What's Missing for Customer Targeting:**
- ❌ No `target_customer_type` or `applicable_customer_sector` field
- ❌ No `customer_segment_id` or `product_category_id` field
- ❌ No `business_domain_name` or direct customer sector mapping
- ❌ No `target_healthcare_facility` or facility-specific flags

**What's Present:**
- ✅ `service_group`: Basic internal classification (GROUP_A/B/C)
- ✅ `domain_id`: Links to business_domains (but mostly for accounting/organizational purposes)

---

## 2. Customers Table Segmentation Data

### 2.1 Customers Table Columns (From Customer Model & Migrations)

| Column | Type | Purpose | Notes |
|--------|------|---------|-------|
| id | INTEGER | Primary key | Auto-increment |
| customer_code | varchar(100) | Customer identifier | UNIQUE |
| customer_name | varchar(255) | Display name | Required |
| uuid | varchar(36) | UUID identifier | UNIQUE, for API |
| tax_code | varchar(100) | Tax ID | Optional |
| address | TEXT | Physical address | Optional |
| **customer_sector** | varchar(30) | **CUSTOMER SEGMENT TYPE** | **Optional, NULLABLE** |
| **healthcare_facility_type** | varchar(50) | **Healthcare-specific type** | **Optional for healthcare sector only** |
| **bed_capacity** | INTEGER | **Hospital bed count** | **Optional, for healthcare facilities** |
| customer_code_auto_generated | BOOLEAN | Auto-generation flag | Default: false |
| data_scope | varchar(255) | Data scoping | For multi-tenant isolation |
| created_by, updated_by | INTEGER | Audit users | FK to users table |
| created_at, updated_at | TIMESTAMP | Timestamps | Standard Laravel |
| deleted_at | TIMESTAMP | Soft delete | SoftDeletes trait |

### 2.2 Customer Segmentation Insights

**Via Migration `2026_03_25_150000_add_healthcare_classification_to_customers_table.php`:**
- Added `customer_sector` field to segment customers by industry/sector
- Added `healthcare_facility_type` for healthcare-specific segmentation
- Added `bed_capacity` for hospital size classification

**Customer Sector Values** (Likely):
- Healthcare
- Telecom
- Government
- Education
- Other sectors

**Healthcare Facility Types** (Likely):
- Hospital
- Clinic
- Pharmacy
- Laboratory
- Diagnostic Center

### 2.3 Customer Sectoring Status

**What Exists:**
- ✅ Customers have sector classification
- ✅ Healthcare sub-segmentation exists
- ✅ Data to identify customer type is present

**Gap:**
- ❌ No explicit mapping stating "Product X is for Healthcare Customers"
- ❌ No API endpoint to filter products by customer sector
- ❌ No product recommendations based on customer type

---

## 3. Service Groups (GROUP_A/B/C) Analysis

### 3.1 Service Group Definition
From `frontend/utils/productServiceGroup.ts`:

```typescript
export type ProductServiceGroupCode = 'GROUP_A' | 'GROUP_B' | 'GROUP_C';

interface ProductServiceGroupMeta {
  code: ProductServiceGroupCode;
  label: string;        // Vietnamese label
  shortLabel: string;   // Short Vietnamese label
  badgeClassName: string;
  aliases: string[];
}

// Metadata
GROUP_A: {
  code: 'GROUP_A',
  label: 'Dịch vụ nhóm A',      // Service Group A
  shortLabel: 'Nhóm A',          // Group A
  badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700',
}

GROUP_B: {
  code: 'GROUP_B',
  label: 'Dịch vụ nhóm B',      // Service Group B
  shortLabel: 'Nhóm B',          // Group B
  badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

GROUP_C: {
  code: 'GROUP_C',
  label: 'Dịch vụ nhóm C',      // Service Group C
  shortLabel: 'Nhóm C',          // Group C
  badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700',
}
```

### 3.2 Service Group Usage

**Where Used:**
1. ✅ Products table has `service_group` column (varchar(50), default 'GROUP_B')
2. ✅ Product CRUD operations validate against these three values
3. ✅ Frontend displays service group with color-coded badges
4. ✅ Product listings can be filtered by service_group (theoretically)

**Added in Migration:**
`2026_03_22_170000_add_service_group_to_products_table.php`
- Adds `service_group` column to products table
- Defaults all products to 'GROUP_B'
- Creates index on service_group

### 3.3 Service Group Classification

**Current Classification:**
- ✅ Internal business grouping system
- ✅ Three-tier hierarchy
- ✅ Applied to ALL products

**What Service Groups Represent:**
- 🤔 **UNKNOWN** - No documentation found explaining what GROUP_A, GROUP_B, GROUP_C mean
- 🤔 Could be by product complexity (Simple, Medium, Complex)
- 🤔 Could be by pricing tier
- 🤔 Could be by customer segment (but no documented mapping)
- 🤔 Could be by support level required

**Critical Gap:**
❌ **NO documented mapping between SERVICE GROUPS and CUSTOMER SEGMENTS**

---

## 4. Business Domains Table

### 4.1 Business Domains Purpose
From migration references: `business_domains` table exists with:
- `id`, `domain_code`, `domain_name`
- `focal_point_name`, `focal_point_phone`, `focal_point_email` (added in 2026_03_23_120000)

### 4.2 Business Domain Usage in Products

**In ProductDomainService:**
```php
private function tableRowExists(string $table, int $id): bool
{
    if (! $this->support->hasTable($table)) {
        return false;
    }

    $query = DB::table($table)->where('id', $id);
    if ($this->support->hasColumn($table, 'deleted_at')) {
        $query->whereNull('deleted_at');
    }

    return $query->exists();
}

// Product validation:
$domainId = $this->support->parseNullableInt($validated['domain_id'] ?? null);
if ($domainId === null || ! $this->tableRowExists('business_domains', $domainId)) {
    return response()->json(['message' => 'domain_id is invalid.'], 422);
}
```

**Purpose:** 
- ✅ Used for organizational/accounting categorization
- ✅ Each product must be assigned to a business domain
- ✅ Likely represents VNPT's internal business lines

**Does NOT represent:**
- ❌ Customer type
- ❌ Target customer segment
- ❌ Applicability to specific customer sectors

---

## 5. Support Service Groups Table

### 5.1 Support Service Groups

From migrations: `support_service_groups` table exists with:
- `id`, `group_name`, `is_active`
- `group_code` (added in 2026_03_01_130000)
- Unique constraint on group_name
- Links to customers via `2026_03_07_090000_link_support_service_groups_to_customers.php`

### 5.2 Support Groups vs Product Groups

**Key Difference:**
- **Support Service Groups**: For IT support/request management categorization
- **Product Service Groups (GROUP_A/B/C)**: For product classification

**Relationship to Products:**
- ❌ Support service groups and product service groups are **NOT directly linked**
- ⚠️ Possible indirect relationship through customer-request-product flow

**In CustomerRequestCases:**
- Product ID can be referenced (product_id field)
- Service group context comes from support assignment, not product

---

## 6. Related Tables That Could Enable Linking

### 6.1 Contract Items Table
```
contract_items:
  - id (PK)
  - contract_id (FK)
  - product_id (FK to products)
  - quantity, unit_price, line_total
  - created_at, updated_at
```
**Usage**: Tracks which products are sold to which contracts (indirectly to customers)
**Limitation**: Only shows actual purchases, not product applicability

### 6.2 Customer Request Cases Table
```
customer_request_cases:
  - id (PK)
  - customer_id (FK to customers)
  - product_id (nullable FK to products)
  - request_type, status, created_at
```
**Usage**: Links customer requests to products
**Limitation**: Only when product is explicitly mentioned in request

### 6.3 Invoice Items Table
```
invoice_items:
  - id (PK)
  - invoice_id (FK)
  - product_id (FK to products)
  - quantity, unit_price, amount
```
**Usage**: Billing line items
**Limitation**: Financial record, not targeting/recommendation data

### 6.4 Product Quotation Tables
```
product_quotations:
  - id (PK)
  - customer_id (FK to customers)
  - ...

product_quotation_items:
  - id (PK)
  - quotation_id (FK)
  - product_id (FK to products)
  - product_name, quantity, unit_price
```
**Usage**: Quote generation to customers
**Potential**: Could identify which products are quoted to which customer sectors
**Status**: ✅ Has customer & product data, but NO targeting logic

---

## 7. Product Features Catalog

### 7.1 Product Feature System
From migration `2026_03_25_160000_create_product_feature_catalog_tables.php`:

```php
Schema::create('product_feature_groups', function (Blueprint $table) {
    $table->bigIncrements('id');
    $table->uuid('uuid')->nullable()->unique();
    $table->unsignedBigInteger('product_id');  // FK
    $table->string('group_name', 255);
    $table->unsignedInteger('display_order')->default(1);
    $table->text('notes')->nullable();
    $table->timestamps();
    $table->softDeletes();
    
    $table->foreign('product_id')
        ->references('id')
        ->on('products')
        ->cascadeOnDelete();
});

Schema::create('product_features', function (Blueprint $table) {
    $table->bigIncrements('id');
    $table->uuid('uuid')->nullable()->unique();
    $table->unsignedBigInteger('product_id');  // FK
    $table->unsignedBigInteger('group_id');    // FK to feature groups
    $table->string('feature_name', 255);
    $table->longText('detail_description')->nullable();
    $table->string('status', 20)->default('ACTIVE');
    $table->unsignedInteger('display_order')->default(1);
    $table->timestamps();
    $table->softDeletes();
});
```

### 7.2 Features Catalog Purpose
- ✅ Product feature management (groups & individual features)
- ✅ Organized display order
- ✅ Feature descriptions and status
- ❌ **NOT for customer targeting** - just feature documentation

---

## 8. Frontend Product Management

### 8.1 Product List Component
From frontend analysis: 
- React hooks-based product management (`hooks/useProducts.ts`)
- CRUD operations (create, read, update, delete)
- Service group normalization
- Product unit normalization
- Attachment management

**What's in Frontend:**
- ✅ Product listing UI
- ✅ Add/Edit/Delete product forms
- ✅ Service group selection dropdown
- ✅ Product feature catalog modal
- ✅ Product quotation system
- ❌ **NO customer filtering by sector**
- ❌ **NO product recommendations by customer type**
- ❌ **NO customer segment selection in product UI**

### 8.2 API Integration
From `services/v5Api.ts`:
```typescript
export async function fetchProducts(): Promise<Product[]>
export async function createProduct(data: Partial<Product>): Promise<Product>
export async function updateProduct(id: number, data: Partial<Product>): Promise<Product>
export async function deleteProduct(id: number): Promise<void>
```

**Endpoints Hit:**
- GET `/api/v5/products` - List all products
- POST `/api/v5/products` - Create product
- PUT `/api/v5/products/{id}` - Update product
- DELETE `/api/v5/products/{id}` - Delete product

**No Endpoints For:**
- ❌ Filter products by customer sector
- ❌ Get products applicable to customer
- ❌ Get customer recommendations
- ❌ Map service groups to customer types

---

## 9. API Endpoint Analysis

### 9.1 Product Controller Routes
From `backend/app/Http/Controllers/Api/V5/ProductController.php`:

```php
// Basic CRUD
GET    /api/v5/products              -> index()      // List products
POST   /api/v5/products              -> store()      // Create product
PUT    /api/v5/products/{id}         -> update()     // Update product
DELETE /api/v5/products/{id}         -> destroy()    // Delete product

// Feature catalog
GET    /api/v5/products/{id}/features                     -> featureCatalog()
GET    /api/v5/products/{id}/features/list                -> featureCatalogList()
PUT    /api/v5/products/{id}/features                     -> updateFeatureCatalog()

// Quotations
GET    /api/v5/products/quotations                        -> quotations()
POST   /api/v5/products/quotations                        -> storeQuotation()
GET    /api/v5/products/quotations/{id}                   -> showQuotation()
PUT    /api/v5/products/quotations/{id}                   -> updateQuotation()
```

**Missing Endpoints:**
- ❌ `GET /api/v5/products?customer_sector=healthcare` - Filter by sector
- ❌ `GET /api/v5/customers/{id}/applicable-products` - Products for customer
- ❌ `GET /api/v5/products/{id}/target-customers` - Who can use this
- ❌ `POST /api/v5/product-customer-mappings` - Create explicit mapping

---

## 10. Search Results Summary

### 10.1 What Does NOT Exist (Verified)
```bash
# Tables that don't exist:
❌ product_categories
❌ product_tags
❌ product_segments
❌ product_targets
❌ target_customers
❌ customer_segments
❌ product_customer_mappings
❌ product_applicability
❌ sector_product_mappings
```

### 10.2 What DOES Exist (Verified)
```
✅ products (with service_group field)
✅ customers (with customer_sector & healthcare fields)
✅ support_service_groups
✅ business_domains
✅ contract_items (products linked via contracts)
✅ customer_request_cases (products linked to requests)
✅ product_quotations (products linked to quotes)
✅ product_feature_groups / product_features
```

---

## 11. Current Data Architecture Diagram

```
PRODUCTS TABLE
├─ id
├─ product_code
├─ product_name
├─ service_group (GROUP_A/B/C) ─── [Internal Classification, NO Customer Link]
├─ domain_id ──────────────────┐
├─ vendor_id                    └─── Accounting/Org Purposes
├─ standard_price
├─ is_active
└─ deleted_at (soft delete)

CUSTOMERS TABLE
├─ id
├─ customer_code
├─ customer_name
├─ customer_sector ────────────┐
├─ healthcare_facility_type    ├─── [Exist but NOT linked to Products]
├─ bed_capacity                │
├─ data_scope                  │
└─ deleted_at (soft delete)────┘

INDIRECT LINKS (Historical/Transactional):
├─ CONTRACT_ITEMS: product_id → customer (via contract.customer_id)
├─ CUSTOMER_REQUEST_CASES: product_id + customer_id ─ [When explicitly linked]
├─ PRODUCT_QUOTATIONS: customer_id + product_id ───── [Quote-time linking]
└─ INVOICE_ITEMS: product_id (billing only)

FEATURE CATALOG (Product Details Only):
├─ product_feature_groups: product_id → features
└─ product_features: feature descriptions
```

---

## 12. Gaps Identified

### 12.1 Data Structure Gaps
| Gap | Impact | Severity |
|-----|--------|----------|
| No product-customer-type mapping table | Cannot define which products target which customer sectors | **HIGH** |
| No product categories | Products lack hierarchical organization | **MEDIUM** |
| No product tags/keywords | Cannot do semantic search/filtering | **MEDIUM** |
| Service groups lack documentation | Unknown what GROUP_A/B/C represent | **MEDIUM** |
| No applicability flags on products | Cannot mark "for healthcare only" etc. | **HIGH** |
| Customer sector has no enum/validation | Sector values could be inconsistent | **MEDIUM** |
| Healthcare facility types not enumerated | Could have typos/variations | **LOW-MEDIUM** |

### 12.2 API Gaps
| Gap | Impact | Severity |
|-----|--------|----------|
| No filter products by customer sector | Cannot show relevant products to customer | **HIGH** |
| No get products for customer | Cannot auto-select applicable products | **HIGH** |
| No get target customers for product | Sales team cannot see who should buy this | **MEDIUM** |
| No customer-product mapping API | No way to manage explicit relationships | **HIGH** |
| No product search by attributes | Limited discoverability | **MEDIUM** |

### 12.3 Frontend Gaps
| Gap | Impact | Severity |
|-----|--------|----------|
| No customer sector filter in product list | Admin cannot filter by sector | **MEDIUM** |
| No product applicability UI | Cannot set/edit sector targeting | **HIGH** |
| No recommended products for customer | Cannot help customer find right products | **MEDIUM** |

---

## 13. What's Working Today (For Context)

### 13.1 Actual Product-Customer Connections (Read-Only)
These represent **actual usage**, not **design for targeting**:

1. **Quotation System**
   - Customer gets quoted products
   - Can see history of what was quoted before
   - NO prediction of what SHOULD be quoted

2. **Contract System**
   - Customer buys products via contracts
   - Products listed in contract items
   - Historical record only

3. **Customer Requests**
   - Customer can mention a product in request
   - System links request to product
   - Reactive, not proactive

4. **Invoicing**
   - Products billed to customer
   - Financial record

**Common Theme**: All are **after-the-fact** records. None are **prescriptive targeting mechanisms**.

---

## 14. Recommendations for Enabling Product-Customer Linking

### 14.1 Minimal Viable Solution (Quick Win)
**Add a "Target Customer Sectors" field to products:**

```sql
ALTER TABLE products ADD COLUMN target_customer_sectors JSON NULLABLE;
-- Example: ["healthcare", "telecom"]

ALTER TABLE products ADD COLUMN is_available_nationwide BOOLEAN DEFAULT true;
```

**Pros:**
- ✅ Simple schema change
- ✅ Can store multiple sectors per product
- ✅ Backwards compatible
- ✅ Searchable

**Cons:**
- ❌ Less structured than a mapping table
- ❌ Harder to count usage
- ❌ No audit trail of changes

### 14.2 Recommended Solution (Proper Design)
**Create explicit product-customer-type mapping table:**

```sql
CREATE TABLE product_customer_segment_mappings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    customer_sector VARCHAR(50) NOT NULL,
    is_recommended BOOLEAN DEFAULT false,
    is_supported BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uq_product_sector (product_id, customer_sector),
    INDEX idx_sector (customer_sector)
);

-- Also track healthcare-specific mappings:
CREATE TABLE product_healthcare_facility_mappings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    healthcare_facility_type VARCHAR(50),
    min_bed_capacity INT,
    max_bed_capacity INT,
    is_recommended BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_facility (healthcare_facility_type)
);
```

**Pros:**
- ✅ Clean separation of concerns
- ✅ Audit trail (created_by, updated_by)
- ✅ Flexible (recommended vs. supported)
- ✅ Easy to query
- ✅ Can track facility capacity ranges

**Cons:**
- ❌ More database operations
- ❌ Schema migration required

### 14.3 Service Group Clarification
**Document what GROUP_A, GROUP_B, GROUP_C represent:**
- Could be renamed to `product_complexity_level` or `product_category`
- Add column `service_group_description` to explain purpose
- Create a lookup table if service groups become more complex

---

## 15. Files to Examine Further (For Implementation)

### 15.1 Backend Files
- `backend/database/migrations/2026_03_25_130400_create_product_quotation_tables.php` - Quote system
- `backend/app/Services/V5/Domain/ProductQuotationDomainService.php` - Quote logic
- `backend/app/Models/ContractItem.php` - Contract products
- `backend/app/Models/CustomerRequestCase.php` - Request products
- `backend/app/Http/Requests/V5/StoreProductRequest.php` - Product validation rules

### 15.2 Frontend Files
- `frontend/src/pages/ProductManagement.tsx` (or similar) - Product management UI
- `frontend/src/types/index.ts` - Product type definitions
- `frontend/services/v5Api.ts` - API client

### 15.3 Missing Implementation Points
- ❌ No "Add Customer Sectors to Product" UI
- ❌ No "Filter Products by Sector" API
- ❌ No "Get Products for Customer" endpoint
- ❌ No recommendation engine

---

## 16. Conclusion

### Current State Assessment:
The VNPT system has **customer data segmentation (sectors, facility types)** and **product data** existing in separate tables, but **NO explicit linking mechanism** between them.

The closest thing to linking is:
1. **Service groups** (GROUP_A/B/C) - but purpose is undocumented
2. **Transactional records** (contracts, quotes, requests) - but these are after-the-fact, not prescriptive

### Key Insight:
This system was built for **transaction management** (quotes → contracts → invoicing) rather than **product recommendation** or **customer-centric product targeting**.

### To Enable Product-Customer Linking:
You need to decide between:
1. **Quick solution**: Add JSON field to products table
2. **Proper solution**: Create explicit mapping tables with business logic

Both approaches would require:
- ✅ New API endpoints for filtering/recommendations
- ✅ Frontend UI for managing mappings
- ✅ Documentation of service groups
- ✅ Enum validation for customer sectors

---

## Appendix: Test Coverage

### Test Files Found:
- `backend/tests/Feature/ProductCrudTest.php` - Product CRUD operations
  - Tests service_group validation
  - Tests unique product codes
  - Tests product deletion (with dependency checking)
  - Tests attachment handling

**No Tests For:**
- ❌ Customer sector filtering
- ❌ Product applicability
- ❌ Customer-product mapping

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-29  
**Status**: Complete exploratory analysis
