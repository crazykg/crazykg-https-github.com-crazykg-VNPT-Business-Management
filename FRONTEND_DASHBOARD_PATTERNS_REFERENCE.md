# Frontend Dashboard/Admin Page Patterns - VNPT Business Management System

## Document Overview
This guide details the frontend patterns and architecture for building standalone admin/dashboard pages in the VNPT Business Management system. It uses **RevenueManagementHub** and **FeeCollectionHub** as reference implementations for the new **Product-Customer Configuration Dashboard**.

---

## 1. HUB PAGE STRUCTURE PATTERN

### 1.1 Hub Component Architecture

Hub pages are **container components** that:
- Host multiple related sub-views (tabs/panels)
- Manage shared state (filters, period selection)
- Handle authorization checks
- Provide URL state synchronization
- Use lazy loading for sub-components

#### File Structure:
```
frontend/components/
├── RevenueManagementHub.tsx          (Main hub — orchestrator)
├── revenue-mgmt/                      (Sub-views)
│   ├── RevenueOverviewDashboard.tsx
│   ├── RevenueByContractView.tsx
│   ├── RevenueByCollectionView.tsx
│   ├── RevenueForecastView.tsx
│   └── RevenueReportView.tsx
└── fee-collection/                    (Alternative hub structure)
    ├── FeeCollectionDashboard.tsx
    ├── InvoiceList.tsx
    ├── ReceiptList.tsx
    └── DebtAgingReport.tsx
```

### 1.2 Hub Component Template (RevenueManagementHub)

```typescript
// Key structure:
export function RevenueManagementHub({ canRead, canManageTargets, departments }: Props) {
  const { activeView, setActiveView, syncFromUrl, ...other_state } = useRevenueStore();

  // 1. Restore state from URL on mount
  useEffect(() => {
    syncFromUrl();
  }, [syncFromUrl]);

  // 2. Authorization gate
  if (!canRead) {
    return <PermissionDeniedView />;
  }

  // 3. Sub-view navigation tabs
  const subNavItems = [
    { id: 'OVERVIEW', icon: 'dashboard', label: 'Tổng quan' },
    { id: 'BY_CONTRACT', icon: 'contract', label: 'Theo hợp đồng' },
    // ...
  ];

  // 4. Handle view changes with prefetching
  const handleViewChange = useCallback((view: typeof activeView) => {
    setActiveView(view);
  }, [setActiveView]);

  const handlePrefetchView = useCallback((view: RevenueSubView) => {
    // Prefetch data for smoother transitions
    if (view === 'OVERVIEW') {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.revenue.overview(filters),
        queryFn: () => fetchRevenueOverview(filters),
        staleTime: 60_000,
      });
    }
  }, [/* dependencies */]);

  // 5. Render conditional sub-view
  const activeViewNode = useMemo(() => {
    if (activeView === 'OVERVIEW') return <RevenueOverviewDashboard {...} />;
    if (activeView === 'BY_CONTRACT') return <RevenueByContractView {...} />;
    // ...
  }, [activeView, /* other deps */]);

  // 6. Layout with Suspense boundary
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sub-navigation bar */}
      <div className="flex-none border-b border-gray-200 bg-white">
        <div className="flex items-center px-4 gap-1 overflow-x-auto">
          {subNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleViewChange(item.id)}
              onMouseEnter={() => handlePrefetchView(item.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeView === item.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area with lazy loading */}
      <div className="flex-1 min-h-0 overflow-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          }
        >
          {activeViewNode}
        </Suspense>
      </div>
    </div>
  );
}
```

#### Key Patterns:
- **Sub-nav tabs**: Horizontal button bar with icons and labels
- **Active state**: Border-bottom indicator + color change
- **Prefetching**: `onMouseEnter` triggers data prefetch before user clicks
- **Suspense**: Wraps the view with loading spinner fallback
- **Shared state**: Zustand store for cross-tab state
- **URL sync**: State persists in URL query params

---

## 2. SIDEBAR NAVIGATION INTEGRATION

### 2.1 Tab Registration in Sidebar.tsx

The sidebar uses a **hierarchical menu structure** with collapsible groups:

```typescript
const menuGroups: MenuGroup[] = [
  {
    id: 'finance',
    label: 'Tài chính & Doanh thu',
    icon: 'payments',
    items: [
      { id: 'revenue_mgmt', icon: 'bar_chart', label: 'Quản trị Doanh thu' },
      { id: 'fee_collection', icon: 'receipt_long', label: 'Thu cước' },
      // NEW: Add here
      // { id: 'product_customer_config', icon: 'settings', label: 'Cấu hình SP-KH' },
    ]
  },
  {
    id: 'util',  // Utilities/Admin section
    label: 'Tiện ích',
    icon: 'widgets',
    items: [
      { id: 'support_master_management', icon: 'tune', label: 'Quản lý danh mục' },
      { id: 'integration_settings', icon: 'settings', label: 'Cấu hình tích hợp' },
      // NEW: Could also go here
      // { id: 'product_customer_config', icon: 'settings', label: 'Cấu hình SP-KH' },
    ]
  }
];
```

#### Adding a New Tab:
1. Choose the appropriate menu group (or create a new one)
2. Add entry with `id`, `icon`, and `label`
3. Register in `authorization.ts` TAB_PERMISSION_MAP
4. Add to `AppPages.tsx` routing

### 2.2 Sidebar Behavior Features

```typescript
// Tab filtering based on permissions
const visibleItems = group.items.filter((item) => visibleTabIds.has(item.id));

// Collapsible groups
const toggleGroup = (groupId: string) => {
  setExpandedGroups(prev => 
    prev.includes(groupId) 
      ? prev.filter(id => id !== groupId) 
      : [...prev, groupId]
  );
};

// Prefetch support
const handleItemPrefetch = (id: string) => {
  onPrefetchTab?.(id);
};

// Responsive collapse on mobile
const handleItemClick = (id: string) => {
  setActiveTab(id);
  if (window.innerWidth < 1024) {
    onClose();  // Close sidebar on mobile after selection
  }
};
```

---

## 3. LAZY LOADING PATTERN (AppPages.tsx)

### 3.1 Dynamic Component Registration

All pages use **lazy loading with React.lazy()**:

```typescript
// AppPages.tsx

const RevenueManagementHub = lazy(() =>
  import('./components/RevenueManagementHub').then((module) => ({ 
    default: module.RevenueManagementHub 
  }))
);

const FeeCollectionHub = lazy(() =>
  import('./components/FeeCollectionHub').then((module) => ({ 
    default: module.FeeCollectionHub 
  }))
);

// NEW: Add for Product-Customer Config Dashboard
const ProductCustomerConfigDashboard = lazy(() =>
  import('./components/ProductCustomerConfigDashboard').then((module) => ({ 
    default: module.ProductCustomerConfigDashboard 
  }))
);
```

### 3.2 Tab Routing in AppPages Component

```typescript
export const AppPages: React.FC<AppPagesProps> = ({
  activeTab,
  authUser,
  // ... props
}) => {
  return (
    <>
      {activeTab === 'revenue_mgmt' && (
        <RevenueManagementHub
          canRead={hasPermission(authUser, 'revenue.read')}
          canManageTargets={hasPermission(authUser, 'revenue.targets')}
          departments={departments}
        />
      )}

      {activeTab === 'fee_collection' && (
        <FeeCollectionHub
          contracts={contracts}
          customers={customers}
          currentUser={authUser}
          canAdd={hasPermission(authUser, 'fee_collection.write')}
          canEdit={hasPermission(authUser, 'fee_collection.write')}
          canDelete={hasPermission(authUser, 'fee_collection.delete')}
        />
      )}

      {/* NEW: Add similar conditional rendering */}
      {activeTab === 'product_customer_config' && (
        <ProductCustomerConfigDashboard
          products={products}
          customers={customers}
          canRead={hasPermission(authUser, 'product_customer_config.read')}
          canWrite={hasPermission(authUser, 'product_customer_config.write')}
          onNotify={addToast}
        />
      )}
    </>
  );
};
```

#### Benefits:
- Code-split automatically by webpack
- Only loads when tab is active
- Faster initial page load
- Reduced bundle size

---

## 4. AUTHORIZATION PATTERN (authorization.ts)

### 4.1 Permission Mapping Structure

```typescript
// Tab-level permissions
const TAB_PERMISSION_MAP: Record<string, string | null> = {
  revenue_mgmt: 'revenue.read',
  fee_collection: 'fee_collection.read',
  // NEW:
  product_customer_config: 'product_customer_config.read',
};

// Modal-level permissions
const MODAL_PERMISSION_MAP: Partial<Record<Exclude<ModalType, null>, string | null>> = {
  ADD_PRODUCT: 'products.write',
  EDIT_PRODUCT: 'products.write',
  DELETE_PRODUCT: 'products.delete',
  // NEW for config:
  EDIT_PRODUCT_CUSTOMER_CONFIG: 'product_customer_config.write',
};

// Import-specific permissions
const IMPORT_PERMISSION_BY_MODULE: Record<string, string | null> = {
  products: 'products.import',
  // NEW:
  product_customer_config: 'product_customer_config.import',
};
```

### 4.2 Permission Checking Functions

```typescript
// Check if user has permission
export const hasPermission = (user: AuthUser | null, permission: string | null | undefined): boolean => {
  if (!permission) return true;  // No permission required
  if (!user) return false;

  const roles = (user.roles || []).map((role) => String(role).toUpperCase());
  if (roles.includes('ADMIN')) return true;  // Admins bypass

  const permissions = new Set((user.permissions || []).map((perm) => String(perm).trim()));
  if (permissions.has('*')) return true;  // Wildcard permission

  return permissions.has(permission);
};

// Check if user can access a tab
export const canAccessTab = (user: AuthUser | null, tabId: string): boolean => {
  if (tabId === 'support_master_management') {
    // Special case: multiple permission alternatives
    return (
      hasPermission(user, 'support_requests.read')
      || hasPermission(user, 'support_service_groups.read')
      || hasPermission(user, 'support_contact_positions.read')
    );
  }
  return hasPermission(user, TAB_PERMISSION_MAP[tabId] ?? null);
};
```

### 4.3 Usage in Components

```typescript
// In RevenueManagementHub
if (!canRead) {
  return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      <div className="text-center">
        <span className="material-symbols-outlined text-4xl text-gray-300">lock</span>
        <p className="mt-2 text-sm">Bạn không có quyền xem Quản trị Doanh thu.</p>
      </div>
    </div>
  );
}

// In FeeCollectionHub
const canAdd = canAddProp ?? hasPermission(currentUser, 'fee_collection.write');
const canEdit = canEditProp ?? hasPermission(currentUser, 'fee_collection.write');
const canDelete = canDeleteProp ?? hasPermission(currentUser, 'fee_collection.delete');
```

---

## 5. SHARED STATE MANAGEMENT (Zustand Stores)

### 5.1 Revenue Store Example (revenueStore.ts)

For pages that need **cross-view state persistence**:

```typescript
import { create } from 'zustand';

interface RevenueStoreState {
  // View navigation
  activeView: RevenueSubView;
  reportTab: 'department' | 'customer' | 'product' | 'time';
  forecastHorizon: 3 | 6 | 12;

  // Period filters (shared across sub-views)
  periodFrom: string;
  periodTo: string;
  periodType: RevenuePeriodType;
  grouping: 'month' | 'quarter';
  selectedDeptId: number | null;
  year: number;

  // Actions
  setActiveView: (view: RevenueSubView) => void;
  setPeriod: (from: string, to: string) => void;
  // ... other setters
  syncFromUrl: () => void;  // Restore from URL
  syncToUrl: () => void;    // Persist to URL
}

export const useRevenueStore = create<RevenueStoreState>((set, get) => ({
  // Initial state
  activeView: 'OVERVIEW',
  periodFrom: getDefaultPeriodFrom(),
  periodTo: getDefaultPeriodTo(),
  // ...

  // Actions
  setActiveView: (view) => {
    set({ activeView: view });
    get().syncToUrl();  // Persist to URL
  },
  
  syncFromUrl: () => {
    // Parse URL query params and restore state
    const params = new URLSearchParams(window.location.search);
    const view = params.get('rv_view') as RevenueSubView | null;
    if (view && VALID_VIEWS.includes(view)) {
      set({ activeView: view });
    }
  },
  
  syncToUrl: () => {
    // Persist state to URL query params
    const state = get();
    const params = new URLSearchParams(window.location.search);
    params.set('rv_view', state.activeView);
    params.set('rv_from', state.periodFrom);
    // ... other params
    window.history.replaceState({}, '', `?${params.toString()}`);
  },
}));
```

#### When to Use:
- **With**: Complex multi-tab dashboards where state should persist across views
- **Without**: Simple list pages where component-local state is sufficient

---

## 6. DATA TABLE/GRID PATTERNS

### 6.1 Table Column Configuration (ProductList Pattern)

```typescript
// Define column metadata
interface ProductTableColumn {
  key: ProductTableColumnKey;
  label: string;
  sortable?: boolean;
  colStyle?: React.CSSProperties;  // Fixed width for horizontal scroll
  headerClassName: string;
  cellClassName: string;
}

const BASE_PRODUCT_TABLE_COLUMNS: ProductTableColumn[] = [
  {
    key: 'stt',
    label: 'STT',
    sortable: false,
    colStyle: { width: 72, minWidth: 72 },
    headerClassName: 'w-[72px] min-w-[72px] whitespace-nowrap px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[72px] min-w-[72px] whitespace-nowrap px-5 py-2.5 align-middle text-sm font-semibold text-slate-500',
  },
  {
    key: 'product_code',
    label: 'Mã SP',
    sortable: true,
    colStyle: { width: 160, minWidth: 160 },
    headerClassName: 'w-[160px] min-w-[160px] whitespace-nowrap px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[160px] min-w-[160px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-5 py-2.5 align-middle text-sm font-semibold',
  },
  // ... more columns
];

const PRODUCT_TABLE_MIN_WIDTH = 2372;  // Total width for horizontal scroll
```

### 6.2 Table Rendering Structure

```typescript
export const ProductList: React.FC<ProductListProps> = ({
  products = [],
  businesses = [],
  vendors = [],
  onOpenModal,
  canEdit = false,
  canDelete = false,
}) => {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilterId, setDomainFilterId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(null);

  // Filter logic
  const filteredProducts = useMemo(() => {
    let result = (products || []).filter(product => {
      const matchesSearch = normalizedSearch === '' 
        || product.product_name.includes(normalizedSearch);
      const matchesDomain = domainFilterId === '' 
        || product.domain_id === domainFilterId;
      return matchesSearch && matchesDomain;
    });

    // Sort if needed
    if (sortConfig !== null) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [products, searchTerm, domainFilterId, sortConfig]);

  // Pagination
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredProducts.slice(start, start + rowsPerPage);
  }, [filteredProducts, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / rowsPerPage);

  return (
    <div className="flex flex-col h-full">
      {/* Header with filters */}
      <div className="flex-none bg-white border-b border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap">
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
          <select
            value={domainFilterId}
            onChange={(e) => setDomainFilterId(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          >
            <option value="">Tất cả lĩnh vực</option>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.domain_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table container */}
      <div className="flex-1 overflow-x-auto bg-gray-50">
        <table className="w-full border-collapse">
          <thead className="bg-white sticky top-0">
            <tr className="border-b border-gray-200">
              {BASE_PRODUCT_TABLE_COLUMNS.map(col => (
                <th key={col.key} className={col.headerClassName}>
                  <div className="flex items-center justify-between gap-2">
                    <span>{col.label}</span>
                    {col.sortable && (
                      <button
                        onClick={() => setSortConfig({
                          key: col.key as keyof Product,
                          direction: sortConfig?.key === col.key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                        })}
                        className="cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {sortConfig?.key === col.key && sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((product, idx) => (
              <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-100">
                <td className={BASE_PRODUCT_TABLE_COLUMNS[0].cellClassName}>{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                <td className={BASE_PRODUCT_TABLE_COLUMNS[1].cellClassName}>{product.product_code}</td>
                {/* ... more cells */}
                <td className="text-right px-5 py-2.5">
                  {canEdit && <button onClick={() => onOpenModal('EDIT_PRODUCT', product)}>Sửa</button>}
                  {canDelete && <button onClick={() => onOpenModal('DELETE_PRODUCT', product)}>Xóa</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex-none bg-white border-t border-gray-200 p-4">
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={setRowsPerPage}
          totalRows={filteredProducts.length}
        />
      </div>
    </div>
  );
};
```

### 6.3 Key Table Patterns

#### Fixed Column Widths
```typescript
// Use colStyle + min-width in className for horizontal scroll support
colStyle: { width: 160, minWidth: 160 }
headerClassName: 'w-[160px] min-w-[160px] whitespace-nowrap px-5 py-3'

// Total table width calculation
const PRODUCT_TABLE_MIN_WIDTH = 2372;  // Sum of all columns
```

#### Sorting
```typescript
const handleSort = (key: keyof Product) => {
  setSortConfig(prev => ({
    key,
    direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
  }));
};

// Sort implementation
if (sortConfig !== null) {
  result = [...result].sort((a, b) => {
    const comparison = a[sortConfig.key] < b[sortConfig.key] ? -1 : 1;
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });
}
```

#### Pagination
```typescript
const [currentPage, setCurrentPage] = useState(1);
const [rowsPerPage, setRowsPerPage] = useState(10);

const paginatedData = useMemo(() => {
  const start = (currentPage - 1) * rowsPerPage;
  return filteredProducts.slice(start, start + rowsPerPage);
}, [filteredProducts, currentPage, rowsPerPage]);

const totalPages = Math.ceil(filteredProducts.length / rowsPerPage);
```

---

## 7. EXISTING SETTINGS/ADMIN CONFIGURATION PATTERNS

### 7.1 Support Master Management Hub

The `SupportMasterManagement` component serves as a reference for **configuration management**:

```typescript
export const SupportMasterManagement: React.FC<SupportMasterManagementProps> = ({
  supportServiceGroups,
  supportContactPositions,
  supportRequestStatuses,
  projectTypes,
  worklogActivityTypes,
  supportSlaConfigs,
  onCreateSupportServiceGroup,
  onUpdateSupportServiceGroup,
  // ... more handlers
  canReadServiceGroups,
  canWriteServiceGroups,
  // ... more permissions
}) => {
  const [activeTab, setActiveTab] = useState<'service_groups' | 'positions' | 'statuses' | 'types' | 'activities' | 'sla'>(
    'service_groups'
  );

  return (
    <div className="flex flex-col h-full">
      {/* Tab navigation */}
      <div className="flex border-b border-gray-200">
        <button onClick={() => setActiveTab('service_groups')} 
          className={activeTab === 'service_groups' ? 'active' : ''}>
          Nhóm dịch vụ
        </button>
        {/* ... more tabs */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'service_groups' && (
          <ServiceGroupsSection
            groups={supportServiceGroups}
            canRead={canReadServiceGroups}
            canWrite={canWriteServiceGroups}
            onCreate={onCreateSupportServiceGroup}
            onUpdate={onUpdateSupportServiceGroup}
          />
        )}
        {/* ... more tab content */}
      </div>
    </div>
  );
};
```

### 7.2 Integration Settings Pattern

The `IntegrationSettingsPanel` is a reference for **config form management**:

```typescript
export const IntegrationSettingsPanel: React.FC<IntegrationSettingsPanelProps> = ({
  backblazeB2Settings,
  googleDriveSettings,
  isLoading,
  isSaving,
  onSave,
  onTest,
}) => {
  const [activeSection, setActiveSection] = useState<'b2' | 'google'>('b2');

  return (
    <div className="flex flex-col h-full">
      {/* Settings categories */}
      <div className="flex border-b">
        <button onClick={() => setActiveSection('b2')}>Backblaze B2</button>
        <button onClick={() => setActiveSection('google')}>Google Drive</button>
      </div>

      {/* Config forms */}
      <div className="flex-1 overflow-auto p-6">
        {activeSection === 'b2' && (
          <B2SettingsForm
            settings={backblazeB2Settings}
            isLoading={isLoading}
            isSaving={isSaving}
            onSave={onSave}
            onTest={onTest}
          />
        )}
        {/* ... more sections */}
      </div>
    </div>
  );
};
```

---

## 8. FEE COLLECTION HUB EXAMPLE (Alternative Pattern)

### 8.1 Alternative Hub Structure (Component-Local State)

The `FeeCollectionHub` uses **component-local state** (without a Zustand store):

```typescript
export const FeeCollectionHub: React.FC<FeeCollectionHubProps> = ({
  contracts, customers, currentUser, addToast,
  canAdd: canAddProp, canEdit: canEditProp, canDelete: canDeleteProp,
}) => {
  // Component-local state (not persisted in store)
  const [activeView, setActiveView] = useState<SubView>('DASHBOARD');
  const [periodFrom, setPeriodFrom] = useState(presets[0].from);
  const [periodTo, setPeriodTo] = useState(presets[0].to);
  const [selectedPreset, setSelectedPreset] = useState<string>(presets[0].label);
  const [invoiceCustomerFilter, setInvoiceCustomerFilter] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');

  // URL state sync (manual, not store-based)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('fc_view') as SubView | null;
    if (view && SUB_VIEWS.some((v) => v.id === view)) setActiveView(view);
  }, []);

  const updateUrl = useCallback((view: SubView, from: string, to: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('fc_view', view);
    params.set('fc_period_from', from);
    params.set('fc_period_to', to);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, []);

  // Sub-view tabs (compact layout)
  const SUB_VIEWS: { id: SubView; label: string; icon: string }[] = [
    { id: 'DASHBOARD', label: 'Tổng quan', icon: 'dashboard' },
    { id: 'INVOICES', label: 'Hóa đơn', icon: 'receipt_long' },
    { id: 'RECEIPTS', label: 'Phiếu thu', icon: 'payments' },
    { id: 'DEBT_REPORT', label: 'Báo cáo công nợ', icon: 'analytics' },
  ];

  // Render structure
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Compact header with tabs and filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* Title */}
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">receipt_long</span>
            <h1 className="text-base font-semibold text-gray-800">Thu cước & Công nợ</h1>
          </div>

          {/* Tabs (compact button group) */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-gray-50 ml-2">
            {SUB_VIEWS.map((v) => (
              <button key={v.id} onClick={() => handleViewChange(v.id)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeView === v.id
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                <span className="material-symbols-outlined text-sm">{v.icon}</span>
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>

          {/* Period selector (conditional) */}
          {activeView === 'DASHBOARD' && (
            <div className="flex items-center gap-2 ml-auto">
              {/* Preset buttons */}
              <div className="flex border border-gray-200 rounded bg-gray-50">
                {presets.map((p) => (
                  <button key={p.label} onClick={() => handlePreset(p)}
                    className={`px-2.5 py-1 text-xs font-medium ${
                      selectedPreset === p.label ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
              {/* Date range inputs */}
              <input type="date" value={periodFrom} onChange={(e) => handlePeriodFromChange(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs w-32" />
              <span>—</span>
              <input type="date" value={periodTo} onChange={(e) => handlePeriodToChange(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs w-32" />
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {activeView === 'DASHBOARD' && (
          <FeeCollectionDashboard
            periodFrom={periodFrom}
            periodTo={periodTo}
            onNotify={onNotify}
            onNavigateToInvoices={handleNavigateToInvoices}
          />
        )}
        {/* ... more views */}
      </div>
    </div>
  );
};
```

#### Key Differences from Revenue Hub:
- **No Zustand store** — uses component state only
- **Manual URL sync** — `updateUrl()` called explicitly
- **Compact header** — tabs + filters in single bar
- **Navigation callbacks** — `onNavigateToInvoices()` allows cross-tab jumps with filters

---

## 9. IMPLEMENTATION CHECKLIST FOR NEW DASHBOARD

To build the "Product-Customer Configuration Dashboard", follow this checklist:

### 9.1 File Structure Setup
- [ ] Create `/frontend/components/ProductCustomerConfigDashboard.tsx` (main hub)
- [ ] Create sub-views folder: `/frontend/components/product-customer-config/`
  - [ ] `ProductCustomerMatrixView.tsx` — matrix/grid view
  - [ ] `ProductCustomerConfigListView.tsx` — detail list
  - [ ] `ProductCustomerReportView.tsx` — reports/analytics
- [ ] Create Zustand store (if needed): `/frontend/shared/stores/productCustomerConfigStore.ts`
- [ ] Add API hooks: `/frontend/shared/hooks/useProductCustomerConfig.ts`

### 9.2 Authorization Setup
- [ ] Add to `authorization.ts`:
  ```typescript
  const TAB_PERMISSION_MAP = {
    product_customer_config: 'product_customer_config.read',
  };
  const MODAL_PERMISSION_MAP = {
    EDIT_PRODUCT_CUSTOMER_CONFIG: 'product_customer_config.write',
  };
  ```
- [ ] Define permission string in backend

### 9.3 Sidebar Integration
- [ ] Add to `Sidebar.tsx` menu group (choose: 'finance', 'cat', or 'util')
  ```typescript
  { id: 'product_customer_config', icon: 'settings', label: 'Cấu hình SP-KH' }
  ```

### 9.4 Page Registration
- [ ] Add lazy import in `AppPages.tsx`
- [ ] Add conditional rendering in `AppPages` component
- [ ] Pass required props (products, customers, permissions, handlers)

### 9.5 Data Tables (if applicable)
- [ ] Define column configuration (width, sorting, etc.)
- [ ] Implement filtering logic
- [ ] Add pagination support
- [ ] Support export (CSV/Excel/PDF) if needed

### 9.6 Testing Checklist
- [ ] Authorization gates work (show lock icon if no permission)
- [ ] Tab switching loads correct sub-view
- [ ] URL state persists on refresh
- [ ] Prefetching works (data ready on tab switch)
- [ ] Responsive design (mobile sidebar collapse, table horizontal scroll)
- [ ] Filters reset pagination properly
- [ ] Sorting maintains filter context
- [ ] Permissions enforced on actions (edit, delete buttons hidden)

---

## 10. STYLING & RESPONSIVE PATTERNS

### 10.1 Flexbox Layout Container
```typescript
<div className="flex flex-col h-full min-h-0">
  {/* flex-col: vertical stacking */}
  {/* h-full: take all available height */}
  {/* min-h-0: allow content to shrink below min */}

  {/* Header - fixed height */}
  <div className="flex-none border-b border-gray-200 bg-white">
    {/* flex-none: don't participate in flex grow/shrink */}
  </div>

  {/* Content - scrollable */}
  <div className="flex-1 overflow-auto">
    {/* flex-1: grow to fill available space */}
    {/* overflow-auto: scroll when content overflows */}
  </div>
</div>
```

### 10.2 Horizontal Scrolling Table
```typescript
<div className="overflow-x-auto">
  <table className="w-full" style={{ minWidth: PRODUCT_TABLE_MIN_WIDTH }}>
    {/* Columns with fixed widths */}
    <th className="w-[160px] min-w-[160px] whitespace-nowrap">
      {/* w-[160px]: exact width */}
      {/* min-w-[160px]: prevent shrinking below width */}
      {/* whitespace-nowrap: no text wrapping */}
    </th>
  </table>
</div>
```

### 10.3 Responsive Sidebar Integration
```typescript
// Sidebar automatically closes on mobile when item clicked
if (window.innerWidth < 1024) {
  onClose();  // Mobile: close sidebar
}

// Desktop: sidebar stays open
// Mobile: hamburger menu, overlay, auto-close on selection
```

---

## 11. QUERY & CACHE MANAGEMENT

### 11.1 React Query Setup
```typescript
// Query keys structure
const queryKeys = {
  products: {
    all: () => ['products'] as const,
    list: (filters) => [...queryKeys.products.all(), 'list', filters] as const,
    detail: (id) => [...queryKeys.products.all(), id] as const,
  },
  productCustomerConfig: {
    all: () => ['product_customer_config'] as const,
    matrix: (filters) => [...queryKeys.productCustomerConfig.all(), 'matrix', filters] as const,
    detail: (productId, customerId) => [...queryKeys.productCustomerConfig.all(), productId, customerId] as const,
  },
};

// Usage in component
const { data, isLoading } = useQuery({
  queryKey: queryKeys.productCustomerConfig.matrix({ dept_id: selectedDeptId }),
  queryFn: () => fetchProductCustomerMatrix({ dept_id: selectedDeptId }),
  staleTime: 60_000,  // 1 minute
});
```

### 11.2 Prefetching on Tab Hover
```typescript
const handlePrefetchView = useCallback((view: ConfigSubView) => {
  if (view === 'MATRIX') {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.productCustomerConfig.matrix(filters),
      queryFn: () => fetchProductCustomerMatrix(filters),
      staleTime: 60_000,
    });
  }
}, [filters]);

// In template
<button
  onMouseEnter={() => handlePrefetchView('MATRIX')}
  onClick={() => setActiveView('MATRIX')}
>
  Matrix View
</button>
```

---

## 12. QUICK REFERENCE: FILE LOCATIONS

| Pattern | File |
|---------|------|
| Hub page template | `RevenueManagementHub.tsx`, `FeeCollectionHub.tsx` |
| Sub-view example | `revenue-mgmt/RevenueOverviewDashboard.tsx` |
| Sidebar menu | `components/Sidebar.tsx` |
| Page routing | `AppPages.tsx` |
| Authorization | `utils/authorization.ts` |
| Zustand store | `shared/stores/revenueStore.ts` |
| API hooks | `shared/hooks/useRevenue.ts` |
| Table pattern | `components/ProductList.tsx` (lines 254-450) |
| Config hub reference | `SupportMasterManagement.tsx` |
| Settings panel reference | `IntegrationSettingsPanel.tsx` |
| Query keys | `shared/queryKeys.ts` |

---

## 13. NEXT STEPS

1. **Create hub component** — Use RevenueManagementHub as template
2. **Define sub-views** — Create matrix, list, and report views
3. **Set up authorization** — Add permission mappings in authorization.ts
4. **Register in sidebar** — Add menu item to Sidebar.tsx
5. **Add to AppPages** — Lazy load and conditionally render
6. **Implement data fetching** — Create hooks in shared/hooks/
7. **Add store** (optional) — If cross-view state needed
8. **Build tables/grids** — Use ProductList pattern for matrix view
9. **Test permissions** — Verify auth gates and button visibility
10. **Add export features** — Consider CSV/Excel export if needed

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-29  
**System**: VNPT Business Management  
**Reference Components**: RevenueManagementHub, FeeCollectionHub, ProductList, SupportMasterManagement

