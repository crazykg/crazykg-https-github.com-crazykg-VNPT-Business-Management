# Frontend Dashboard Patterns - Executive Summary

## Quick Overview

This document summarizes the key architectural patterns observed in the VNPT Business Management system for building dashboard/admin pages.

---

## 1. HUB PAGE ARCHITECTURE

**Pattern**: Composite component with multiple sub-views and shared state

```
HubPage (Container)
├── Sub-navigation bar (tabs)
├── Shared state (filters, selections)
├── Authorization gate
├── Sub-view components (lazy-loaded)
└── Suspense boundary
```

**Examples**: 
- RevenueManagementHub (5 sub-views: Overview, By Contract, By Collection, Forecast, Report)
- FeeCollectionHub (4 sub-views: Dashboard, Invoices, Receipts, Debt Report)

**Key Features**:
- Tab-based navigation with icon + label
- Active state indicator (bottom border + color)
- Data prefetch on mouse hover
- Lazy loading with Suspense fallback
- Permission-based sub-view access

---

## 2. STATE MANAGEMENT APPROACHES

### Approach A: Zustand Store (Shared State)
**Used by**: RevenueManagementHub

Pros:
- State persists across tab switches
- URL synchronization built-in
- Clean separation of concerns

Structure:
```
useRevenueStore() — manages:
  - activeView (current tab)
  - Filters (period, department, grouping)
  - Report options
  - syncFromUrl() / syncToUrl()
```

### Approach B: Component State (Local Only)
**Used by**: FeeCollectionHub

Pros:
- Simpler for standalone views
- No global store overhead
- Manual URL sync

Structure:
```
Component useState():
  - activeView
  - filters
  - manual URL updates via updateUrl()
```

**Decision**: Use Approach A for complex multi-tab dashboards, Approach B for simple hubs.

---

## 3. SIDEBAR INTEGRATION

**Pattern**: Hierarchical menu with collapsible groups

```
Sidebar
├── Dashboard (root)
└── MenuGroups[]
    ├── Finance & Revenue
    │   ├── Revenue Management ← HubPage
    │   ├── Fee Collection ← HubPage
    │   └── Product-Customer Config ← NEW
    ├── Catalog & Products
    └── Utilities/Admin
        ├── Support Master Management ← Config hub
        └── Integration Settings ← Config panel
```

**Adding new page**:
1. Add menu item to appropriate group
2. Register permission in `authorization.ts`
3. Add lazy import in `AppPages.tsx`
4. Add conditional rendering in AppPages component

---

## 4. AUTHORIZATION PATTERN

**Pattern**: Permission-based access control with role fallback

```typescript
// Three-level permission system:

// 1. Tab access
const canAccessTab = (user, 'product_customer_config')
  → hasPermission(user, 'product_customer_config.read')

// 2. Modal access
const canOpenModal = (user, 'EDIT_PRODUCT_CUSTOMER_CONFIG')
  → hasPermission(user, 'product_customer_config.write')

// 3. Role/permission fallback
hasPermission(user, permission):
  - ADMIN role → always true
  - '*' permission → always true
  - permission in user.permissions → true
  - else → false
```

**Implementation**:
```typescript
// authorization.ts
TAB_PERMISSION_MAP = {
  product_customer_config: 'product_customer_config.read',
}

// In AppPages.tsx
<ProductCustomerConfigDashboard
  canRead={hasPermission(authUser, 'product_customer_config.read')}
  canWrite={hasPermission(authUser, 'product_customer_config.write')}
/>

// In component
if (!canRead) {
  return <PermissionDenied />;
}
```

---

## 5. LAZY LOADING PATTERN

**Pattern**: Code splitting via React.lazy() + dynamic imports

```typescript
// AppPages.tsx

const ProductCustomerConfigDashboard = lazy(() =>
  import('./components/ProductCustomerConfigDashboard').then((m) => ({
    default: m.ProductCustomerConfigDashboard
  }))
);

// Conditional rendering
{activeTab === 'product_customer_config' && (
  <Suspense fallback={<LoadingSpinner />}>
    <ProductCustomerConfigDashboard {...props} />
  </Suspense>
)}
```

**Benefits**:
- Automatic code splitting by webpack
- Only loads when tab is active
- Reduces initial bundle size
- Better performance metrics

---

## 6. TABLE/GRID PATTERNS

**Pattern**: Fixed-width columns with horizontal scroll for large datasets

```typescript
// Column configuration
interface TableColumn {
  key: string;
  label: string;
  sortable: boolean;
  colStyle: { width: 160, minWidth: 160 }  // Fixed width
  headerClassName: 'w-[160px] min-w-[160px]'
  cellClassName: 'w-[160px] min-w-[160px]'
}

// Functionality
- Sortable columns (click header to toggle asc/desc)
- Pagination (page size + current page)
- Filtering (search + select filters)
- Row actions (edit, delete buttons)
- Export options (CSV, Excel, PDF)

// Horizontal scroll support
<div className="overflow-x-auto">
  <table className="w-full" style={{ minWidth: TOTAL_WIDTH }}>
    {/* Fixed-width columns */}
  </table>
</div>
```

**Reference**: ProductList component (2372px minimum width for all columns)

---

## 7. DATA FETCHING & CACHING

**Pattern**: React Query with hierarchical query keys

```typescript
// Query key structure
queryKeys = {
  productCustomerConfig: {
    all: () => ['product_customer_config'],
    matrix: (filters) => [...all(), 'matrix', filters],
    detail: (productId, customerId) => [...all(), productId, customerId],
  }
}

// Prefetching on hover
const handlePrefetchView = useCallback((view) => {
  if (view === 'MATRIX') {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.productCustomerConfig.matrix(filters),
      queryFn: () => fetchProductCustomerMatrix(filters),
      staleTime: 60_000,  // 1 minute cache
    });
  }
}, [filters]);

// In template
<button
  onMouseEnter={() => handlePrefetchView('MATRIX')}
  onClick={() => setActiveView('MATRIX')}
>
  View
</button>
```

---

## 8. RESPONSIVE DESIGN

**Pattern**: Mobile-first with sidebar collapse

```typescript
// Mobile breakpoint: 1024px
// Desktop: sidebar always visible
// Mobile: hamburger menu + overlay

// Sidebar behavior
if (window.innerWidth < 1024) {
  // Mobile: close sidebar after selection
  onClose();
} else {
  // Desktop: keep open
}

// Table overflow
<div className="overflow-x-auto">
  {/* Tables have horizontal scroll on small screens */}
</div>

// Responsive grid
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

---

## 9. CONFIGURATION MANAGEMENT HUBS

**Special pattern** for admin/settings pages (not data management)

**Reference**: SupportMasterManagement, IntegrationSettingsPanel

```typescript
// Structure
ConfigHub
├── Tabs (different config types)
├── Form/Table for each type
└── Create/Edit/Delete actions

// Example: SupportMasterManagement has 6 tabs:
- Service Groups
- Contact Positions
- Request Statuses
- Project Types
- Activity Types
- SLA Configs

// Pattern:
1. List/Table of items
2. Form modal for create/edit
3. Delete confirmation
4. Save mutations with cache invalidation
```

---

## 10. STYLING CONVENTIONS

**Color palette**:
- Primary: `blue-600` (actions, active states)
- Success: `green-600` (positive actions)
- Warning: `yellow-600` (cautions)
- Danger: `red-600` (destructive actions)
- Neutral: `gray-*` (backgrounds, borders)

**Spacing**:
- Padding: `p-4`, `p-6` (sections)
- Gap: `gap-2`, `gap-3`, `gap-4` (flexbox spacing)
- Border: `border-gray-200` (dividers)

**Interactive**:
- Hover: `hover:bg-gray-100`, `hover:text-gray-900`
- Focus: `focus:ring-2 focus:ring-blue-500`
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`

**Typography**:
- Labels: `text-xs` with `uppercase tracking-wider`
- Body: `text-sm`
- Headings: `text-lg` / `text-xl`
- Badges: `text-xs` with colored backgrounds

---

## 11. IMPLEMENTATION CHECKLIST

For new page (e.g., Product-Customer Config Dashboard):

- [ ] **Hub component** — with sub-nav tabs, Suspense boundary
- [ ] **Sub-view components** — lazy-imported
- [ ] **Authorization** — TAB_PERMISSION_MAP + canRead/canWrite props
- [ ] **Sidebar menu** — add to appropriate group
- [ ] **AppPages routing** — lazy import + conditional render
- [ ] **Query hooks** — if data fetching needed
- [ ] **Store** (optional) — if cross-view shared state needed
- [ ] **Styling** — use existing color/spacing conventions
- [ ] **Responsive** — test on mobile (sidebar collapse, table scroll)
- [ ] **Testing** — permissions, tab switching, data loading

---

## 12. FILE STRUCTURE REFERENCE

```
frontend/
├── components/
│   ├── RevenueManagementHub.tsx          (Hub pattern example)
│   ├── FeeCollectionHub.tsx               (Alternative pattern)
│   ├── revenue-mgmt/                      (Sub-views)
│   │   ├── RevenueOverviewDashboard.tsx
│   │   └── ...
│   ├── fee-collection/                    (Sub-views)
│   │   ├── FeeCollectionDashboard.tsx
│   │   └── ...
│   ├── SupportMasterManagement.tsx        (Config hub pattern)
│   ├── IntegrationSettingsPanel.tsx       (Settings pattern)
│   ├── ProductList.tsx                    (Table pattern)
│   ├── Sidebar.tsx                        (Menu pattern)
│   └── ...
├── AppPages.tsx                           (Page routing)
├── App.tsx                                (Main layout)
├── shared/
│   ├── stores/
│   │   ├── revenueStore.ts                (Zustand store example)
│   │   ├── authStore.ts
│   │   └── ...
│   ├── hooks/
│   │   ├── useRevenue.ts                  (Query hooks example)
│   │   └── ...
│   ├── queryKeys.ts                       (Query key structure)
│   └── queryClient.ts
├── utils/
│   ├── authorization.ts                   (Permission logic)
│   └── ...
└── services/
    └── v5Api.ts                           (API calls)
```

---

## 13. DECISION TREE

**When building a new admin/dashboard page:**

1. **Single view or multiple tabs?**
   - Single → Simple component
   - Multiple → Hub component (RevenueManagementHub pattern)

2. **Shared state across tabs?**
   - Yes → Zustand store (revenueStore pattern)
   - No → Component state (feeCollectionHub pattern)

3. **Data-heavy or configuration?**
   - Data heavy → Full tables with sorting/pagination (ProductList)
   - Configuration → Simple forms (SupportMasterManagement)

4. **Matrix/Grid view needed?**
   - Yes → Horizontal scroll table with fixed columns
   - No → Standard list view

5. **Large dataset?**
   - Yes → Pagination + lazy loading (ProductList pattern)
   - No → All in memory (RevenueHub pattern)

---

## Quick Reference Links

| Need | File | Lines |
|------|------|-------|
| Hub template | RevenueManagementHub.tsx | 1-189 |
| Alternative hub | FeeCollectionHub.tsx | 1-303 |
| Table pattern | ProductList.tsx | 254-450 |
| Config hub | SupportMasterManagement.tsx | — |
| Authorization | authorization.ts | 1-144 |
| Sidebar | Sidebar.tsx | 1-291 |
| Routing | AppPages.tsx | 1-700 |
| Store example | revenueStore.ts | 1-150 |

---

**Document**: VNPT Business Management Frontend Patterns  
**Version**: 1.0  
**Last Updated**: 2026-03-29  
**Status**: Reference Document

