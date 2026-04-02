# Product-Customer Linking: Visual Data Reference

## Current System Architecture (What Exists)

```
┌─────────────────────────────────────────────────────────────────────┐
│                       VNPT BUSINESS SYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐                  ┌──────────────────┐        │
│  │   PRODUCTS       │                  │   CUSTOMERS      │        │
│  │   TABLE          │                  │   TABLE          │        │
│  ├──────────────────┤                  ├──────────────────┤        │
│  │ id               │                  │ id               │        │
│  │ product_code     │                  │ customer_code    │        │
│  │ product_name     │                  │ customer_name    │        │
│  │ service_group    │◄──┐NO LINK      │ customer_sector  │        │
│  │ domain_id        │   │ EXISTS      │ healthcare_...   │        │
│  │ vendor_id        │   │             │ bed_capacity     │        │
│  │ package_name     │   │             │ tax_code         │        │
│  │ standard_price   │   │             │ address          │        │
│  │ unit             │   │             │ data_scope       │        │
│  │ description      │   │             │ (audit fields)   │        │
│  │ is_active        │   │             └──────────────────┘        │
│  │ (audit fields)   │   │                                          │
│  └──────────────────┘   │                                          │
│                         │                                          │
│                    ❌ MISSING LINK                                 │
│                         │                                          │
│                         └────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────────────┘
```

## Current Indirect Links (Transaction-Based)

```
┌────────────┐
│ CUSTOMER   │
└────────────┘
      │
      │ has
      │
      ▼
┌────────────────────┐       ┌──────────────┐
│ CONTRACT           │──────│ PRODUCT      │
│ (customer_id)      │has   │ (via items)  │
└────────────────────┘    └──────────────┘
      │
      │ contains
      ▼
┌────────────────────┐
│ CONTRACT_ITEMS     │
│ (product_id)       │
└────────────────────┘

STATUS: Historical record only (what was actually sold)
PURPOSE: Financial tracking, not customer targeting
```

## What SERVICE_GROUPS Represent

```
PRODUCTS TABLE: service_group column
├─ GROUP_A (Dịch vụ nhóm A - Service Group A)
│  └─ Color: Sky Blue
│  └─ Usage: Unknown - NO DOCUMENTATION
│  └─ Link to Customer Types: UNDEFINED
│
├─ GROUP_B (Dịch vụ nhóm B - Service Group B) [DEFAULT]
│  └─ Color: Emerald Green
│  └─ Usage: Unknown - NO DOCUMENTATION
│  └─ Link to Customer Types: UNDEFINED
│
└─ GROUP_C (Dịch vụ nhóm C - Service Group C)
   └─ Color: Amber
   └─ Usage: Unknown - NO DOCUMENTATION
   └─ Link to Customer Types: UNDEFINED

⚠️  CRITICAL: These are not documented as customer-targeting mechanism
    They appear to be internal business classifications only
```

## Customer Segmentation Data (UNUSED FOR PRODUCTS)

```
CUSTOMER CLASSIFICATION DATA AVAILABLE:
┌─────────────────────────────────────────────────┐
│                                                 │
│  customer_sector VARCHAR(30)                   │
│  ├─ Healthcare (presumably)                    │
│  ├─ Telecom                                    │
│  ├─ Government                                 │
│  ├─ Education                                  │
│  └─ Other industries                           │
│                                                 │
│  healthcare_facility_type VARCHAR(50)          │
│  ├─ Hospital                                   │
│  ├─ Clinic                                     │
│  ├─ Pharmacy                                   │
│  ├─ Laboratory                                 │
│  └─ Diagnostic Center                          │
│                                                 │
│  bed_capacity INTEGER                          │
│  └─ For sizing products by facility size       │
│                                                 │
└─────────────────────────────────────────────────┘

STATUS: EXISTS in database ✅
USAGE: NOT CONNECTED TO PRODUCTS ❌
QUALITY: No enum validation ⚠️
```

## What Would Need To Exist: Solution 1 (Quick)

```
MINIMAL APPROACH: Add JSON Column to Products

┌────────────────────────────────────────────┐
│ ALTER TABLE products ADD:                  │
├────────────────────────────────────────────┤
│ target_customer_sectors JSON NULLABLE      │
│  Example: ["healthcare", "telecom"]        │
│                                            │
│ is_available_nationwide BOOLEAN DEFAULT... │
│  Example: true / false                     │
└────────────────────────────────────────────┘

BENEFITS:
✅ Simple (5-minute schema change)
✅ Fast implementation (hours)
✅ Searchable
✅ Backwards compatible

LIMITATIONS:
❌ Less structured
❌ No audit trail
❌ Hard to validate sectors
❌ Difficult to enforce constraints
```

## What Would Need To Exist: Solution 2 (Recommended)

```
PROPER APPROACH: Create Explicit Mapping Tables

┌─────────────────────────────────────────────────────────────────┐
│ product_customer_segment_mappings                              │
├─────────────────────────────────────────────────────────────────┤
│ id BIGINT PK                                                    │
│ product_id BIGINT FK → products.id                             │
│ customer_sector VARCHAR(50)  [healthcare, telecom, etc.]       │
│ is_recommended BOOLEAN (True = suggested, False = supported)   │
│ is_supported BOOLEAN (True = works, False = deprecated)        │
│ notes TEXT (Why is this product for this sector?)              │
│ created_at, updated_at, deleted_at TIMESTAMP                  │
│ created_by, updated_by INTEGER FK                              │
│                                                                 │
│ UNIQUE(product_id, customer_sector)                            │
│ INDEX(customer_sector)                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ product_healthcare_facility_mappings                           │
├─────────────────────────────────────────────────────────────────┤
│ id BIGINT PK                                                    │
│ product_id BIGINT FK → products.id                             │
│ healthcare_facility_type VARCHAR(50) [hospital, clinic, etc.]  │
│ min_bed_capacity INT (Minimum facility size)                   │
│ max_bed_capacity INT (Maximum facility size, NULL = no max)    │
│ is_recommended BOOLEAN                                         │
│ notes TEXT (Specific recommendations for this facility type)   │
│ created_at, updated_at, deleted_at TIMESTAMP                  │
│ created_by, updated_by INTEGER FK                              │
│                                                                 │
│ INDEX(healthcare_facility_type)                                │
│ INDEX(product_id, min_bed_capacity, max_bed_capacity)          │
└─────────────────────────────────────────────────────────────────┘

BENEFITS:
✅ Clean separation of concerns
✅ Full audit trail (who changed what when)
✅ Flexible (can mark recommended vs supported)
✅ Easy to query with JOINs
✅ Can enforce constraints
✅ Scalable for future enhancements
✅ Can track capacity ranges for sizing

LIMITATIONS:
❌ More schema migration work
❌ Slightly more complex queries
❌ Requires data population
```

## How These Solutions Connect to Products

```
SOLUTION 1 (JSON COLUMN):
┌──────────────┐
│ PRODUCT      │
├──────────────┤
│ id           │
│ product_name │
│ target_      │
│  customer_   │ ◄── ["healthcare", "telecom"]
│  sectors     │
│              │
└──────────────┘
         │
         │ QUERY: SELECT * FROM products 
         │        WHERE JSON_CONTAINS(target_customer_sectors, '"healthcare"')
         │
         ▼
    Filtering happens in database
    Join to customers happens in application code

═══════════════════════════════════════════════════════════════════

SOLUTION 2 (MAPPING TABLES):
┌──────────────┐         ┌──────────────────────────────┐
│ PRODUCT      │         │ SEGMENT_MAPPINGS             │
├──────────────┤         ├──────────────────────────────┤
│ id (PK)      │────┬───│ product_id (FK) [1]          │
│ product_name │    │   │ customer_sector [healthcare] │
│ ...          │    │   │ is_recommended [true]        │
└──────────────┘    │   └──────────────────────────────┘
                    │
                    ├───│ customer_sector [telecom]     │
                    │   │ is_recommended [false]        │
                    │   └──────────────────────────────┘
                    │
                    └───│ customer_sector [gov]         │
                        │ is_recommended [true]         │
                        └──────────────────────────────┘

QUERY: SELECT DISTINCT p.* 
       FROM products p
       JOIN segment_mappings m ON p.id = m.product_id
       WHERE m.customer_sector = 'healthcare' 
       AND m.is_recommended = true
```

## Missing API Endpoints

```
CURRENTLY EXIST:
✅ GET    /api/v5/products
✅ POST   /api/v5/products
✅ PUT    /api/v5/products/{id}
✅ DELETE /api/v5/products/{id}
✅ GET    /api/v5/products/{id}/features
✅ PUT    /api/v5/products/{id}/features

MISSING (NEEDED FOR LINKING):
❌ GET    /api/v5/products?customer_sector=healthcare
   Purpose: Filter products by customer sector

❌ GET    /api/v5/customers/{id}/applicable-products
   Purpose: Get products suitable for a specific customer

❌ GET    /api/v5/products/{id}/target-customers
   Purpose: See who should buy this product

❌ GET    /api/v5/product-customer-mappings
   Purpose: View all mappings

❌ POST   /api/v5/product-customer-mappings
   Purpose: Create a product-sector mapping

❌ PUT    /api/v5/product-customer-mappings/{id}
   Purpose: Update recommendation status

❌ DELETE /api/v5/product-customer-mappings/{id}
   Purpose: Remove a mapping
```

## Data Flow: Current vs Needed

```
CURRENT (TRANSACTION-BASED):

Customer                      Sales Person
    │                             │
    │ Requests Quote              │
    └────────────────────────────►│
                                  │
                            (Manual selection)
                                  │
                            Create Quote
                                  │
                      ┌───────────▼──────────────┐
                      │ PRODUCT_QUOTATIONS       │
                      ├──────────────────────────┤
                      │ customer_id              │
                      │ (created by selection)   │
                      └──────────────────────────┘
                                  │
                            (NO DATA ABOUT
                             APPLICABILITY)


NEEDED (TARGETING-BASED):

Customer                    System                   Product Manager
    │                        │                            │
    │ Check for              │                            │
    │ applicable             │ Lookup: What products    │
    │ products for           │ apply to healthcare?     │
    │ healthcare sector      │ (Query mappings)         │
    │                        │                            │
    │                        │  Uses                      │
    │                        │  product_customer_        │
    │                        │  segment_mappings         │
    │                        │                            │
    │◄──────────────────────►│                            │
    │ Show relevant          │◄──────────────────────────┤
    │ products               │ (Managed by this UI)      │
    │                        │                            │
```

## Service Group Purpose Clarification Needed

```
CURRENT STATE:
GROUP_A, GROUP_B, GROUP_C exist but PURPOSE IS UNDEFINED

POSSIBILITIES:
1. Complexity Level
   GROUP_A: Simple services
   GROUP_B: Standard services  
   GROUP_C: Complex/advanced services

2. Support Level
   GROUP_A: Self-service / Basic
   GROUP_B: Standard support
   GROUP_C: Premium / 24/7 support

3. Pricing Tier
   GROUP_A: Budget tier
   GROUP_B: Standard tier
   GROUP_C: Enterprise tier

4. Customer Type (Hypothetical, NOT DOCUMENTED)
   GROUP_A: Healthcare-specific
   GROUP_B: General/Multi-sector
   GROUP_C: Enterprise/Government

5. Internal Business Line
   GROUP_A: Line 1
   GROUP_B: Line 2
   GROUP_C: Line 3

⚠️  DECISION NEEDED: What do these groups actually mean?
    Currently: Undocumented, purpose unclear
    Recommendation: Document or rename for clarity
```

## Implementation Priority Matrix

```
         Impact
           ▲
           │
      HIGH │   ┌──────────────────────────────────┐
           │   │ Product-Customer                 │
           │   │ Mapping Table (Solution 2)       │
           │   │ PRIORITY: 1st                    │
           │   │ Impact: HIGH                     │
           │   │ Effort: MEDIUM                   │
           │   └──────────────────────────────────┘
           │
   MEDIUM  │   ┌──────────────┐  ┌──────────────┐
           │   │ API Filtering│  │ Document     │
           │   │ Endpoints    │  │ Service Grp  │
           │   │ PRIORITY: 2nd│  │ PRIORITY: 3rd│
           │   │ Impact: MED  │  │ Impact: MED  │
           │   │ Effort: LOW  │  │ Effort: LOW  │
           │   └──────────────┘  └──────────────┘
           │
      LOW  │   ┌──────────────────────────────────┐
           │   │ JSON Column (Solution 1)         │
           │   │ PRIORITY: Alternative            │
           │   │ (if time is critical)            │
           │   │ Impact: LOW                      │
           │   │ Effort: VERY LOW                 │
           │   └──────────────────────────────────┘
           │
           └──────────────────────────────────────►
                         Effort (to implement)

RECOMMENDATION SEQUENCE:
1️⃣  First: Document what SERVICE_GROUPS mean
2️⃣  Second: Create product_customer_segment_mappings table
3️⃣  Third: Build API endpoints for filtering/recommendations
4️⃣  Fourth: Build UI for managing mappings
```

## Files That Need Changes

```
Backend - To Implement:
├─ NEW: migration create_product_customer_segment_mappings.php
├─ NEW: migration create_product_healthcare_facility_mappings.php
├─ NEW: Models/ProductCustomerSegmentMapping.php
├─ NEW: Services/V5/Domain/ProductCustomerMappingDomainService.php
├─ NEW: Http/Controllers/Api/V5/ProductCustomerMappingController.php
├─ NEW: Http/Requests/V5/StoreProductMappingRequest.php
├─ MODIFY: Http/Controllers/Api/V5/ProductController.php
└─ MODIFY: Services/V5/Domain/ProductDomainService.php (add filtering)

Frontend - To Implement:
├─ NEW: pages/ProductCustomerMappings.tsx
├─ NEW: components/ProductApplicabilityEditor.tsx
├─ NEW: hooks/useProductCustomerMappings.ts
├─ MODIFY: pages/ProductManagement.tsx (add filtering)
└─ MODIFY: services/v5Api.ts (add new endpoints)

Documentation - To Create:
├─ SERVICE_GROUPS_EXPLANATION.md
├─ CUSTOMER_SECTORS_ENUM.md
├─ PRODUCT_CUSTOMER_MAPPING_GUIDE.md
└─ API_FILTERING_EXAMPLES.md
```

---

**Document Purpose**: Quick visual reference for understanding current vs needed architecture
**Status**: Complete - Ready for architecture decision
**Last Updated**: 2026-03-29
