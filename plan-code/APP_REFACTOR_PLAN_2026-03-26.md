# VNPT Business Frontend - App.tsx Refactor Plan

**Ngày tạo:** 2026-03-26  
**Mục tiêu:** Giảm file App.tsx từ 6000+ dòng xuống còn ~1000-1500 dòng  
**Phương pháp:** Incremental refactoring - từng bước, không big-bang rewrite

---

## 1. Phân tích hiện trạng

### Cấu trúc App.tsx hiện tại (6000+ dòng)

| Section | Dòng ước tính | Mô tả |
|---------|--------------|-------|
| Imports | ~150 | React, types, services, components |
| Lazy components | ~50 | Suspense lazy imports |
| State declarations | ~200 | 100+ useState declarations |
| Refs | ~30 | useRef for caching, debouncing |
| resetModuleData | ~80 | Reset tất cả state |
| Dataset loading | ~200 | ensureDatasetLoaded, loadDatasets |
| Auth effects | ~100 | Bootstrap auth, password change |
| Tab loading effect | ~200 | Load data by activeTab |
| Toast management | ~30 | addToast with deduplication |
| Prefetch logic | ~80 | prefetchTabModules |
| Page query utilities | ~100 | Pagination, debounce, signature |
| load*Page functions | ~300 | 7 page loading functions |
| Export functions | ~150 | Export projects, contracts, RACI |
| Import utilities | ~200 | normalizeImport*, buildHeaderIndex |
| handleImportData | ~800 | XL function cho tất cả modules |
| CRUD handlers | ~1200 | 50+ handlers cho 20+ entities |
| Bulk operations | ~400 | Access control bulk updates |
| Integration settings | ~300 | Backblaze, Google Drive, alerts |
| Dashboard calculations | ~300 | useMemo stats, KPIs |
| Auth UI rendering | ~200 | Login, password change, no-permission |
| Main render | ~400 | Sidebar, AppPages, Toast, Modals |
| Modal rendering | ~600 | 20+ modal conditional renders |
| **TOTAL** | **~6000+** | |

---

## 2. Nguyên tắc refactor

### ✅ NÊN LÀM
- **Incremental**: Từng bước nhỏ, giữ nguyên functionality
- **Type-safe**: Giữ nguyên TypeScript types
- **Testable**: Mỗi phần tách ra có thể test độc lập
- **Backward compatible**: Không breaking changes
- **Progressive**: Có thể dừng ở bất kỳ bước nào

### ❌ KHÔNG NÊN
- Big-bang rewrite
- Thay đổi architecture hoàn toàn
- Touch vào business logic core
- Breaking changes cho existing code

---

## 3. Kế hoạch chi tiết theo phases

### PHASE 1: Tách Utility Functions (Giảm ~400 dòng)

**Mục tiêu:** Tách các hàm utility ra file riêng

#### 1.1 Tạo `frontend/utils/importUtils.ts`
```typescript
// Các hàm normalize import
- normalizeImportToken
- normalizeImportDate  
- normalizeImportNumber
- normalizeStatusActive
- normalizeEmployeeStatusImport
- normalizeGenderImport
- normalizeVpnImport
- normalizeProductRecord
- validateImportedBirthDate
- isProductDeleteDependencyError
- isCustomerDeleteDependencyError
- isImportInfrastructureError
```

#### 1.2 Tạo `frontend/utils/importValidation.ts`
```typescript
// Các hàm validation và header processing
- buildHeaderIndex
- getImportCell
- buildImportFailureRows
- summarizeImportResult
- exportImportFailureFile
- rollbackImportedRows
```

#### 1.3 Tạo `frontend/utils/queryUtils.ts`
```typescript
// Pagination và query utilities
- normalizeQuerySignature
- beginPageLoad
- isLatestPageLoad
- schedulePageQueryLoad
```

**Kết quả Phase 1:** Giảm ~400 dòng, tăng khả năng test utility functions

---

### PHASE 2: Tách Import Logic theo Module (Giảm ~800 dòng)

**Mục tiêu:** Tách handleImportData thành các hàm riêng per module

#### 2.1 Tạo `frontend/hooks/useImportDepartments.ts`
```typescript
export function useImportDepartments() {
  const handleImportDepartments = async (payload: ImportPayload) => {
    // Logic import departments từ handleImportData
  };
  return { handleImportDepartments };
}
```

#### 2.2 Tạo `frontend/hooks/useImportEmployees.ts`
```typescript
export function useImportEmployees() {
  const handleImportEmployees = async (payload: ImportPayload) => {
    // Logic import employees
  };
  return { handleImportEmployees };
}
```

#### 2.3 Tạo các hooks tương tự cho:
- `useImportBusinesses.ts`
- `useImportVendors.ts`
- `useImportProducts.ts`
- `useImportCustomers.ts`
- `useImportCustomerPersonnel.ts`
- `useImportProjects.ts`

#### 2.4 Tạo `frontend/hooks/useImportData.ts` (orchestrator)
```typescript
export function useImportData() {
  const importDepartments = useImportDepartments();
  const importEmployees = useImportEmployees();
  // ...
  
  const handleImportData = async (payload: ImportPayload) => {
    const moduleToken = normalizeImportToken(payload.moduleKey);
    
    switch (moduleToken) {
      case 'departments': return importDepartments.handleImportDepartments(payload);
      case 'employees': return importEmployees.handleImportEmployees(payload);
      // ...
    }
  };
  
  return { handleImportData };
}
```

**Kết quả Phase 2:** Giảm ~800 dòng, mỗi hook có thể test độc lập

---

### PHASE 3: Tách CRUD Handlers theo Module (Giảm ~1200 dòng)

**Mục tiêu:** Tách 50+ handler functions thành các custom hooks

#### 3.1 Tạo `frontend/hooks/useDepartments.ts`
```typescript
export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const addToast = useToast();
  
  const handleSaveDepartment = async (data: Partial<Department>) => {
    // Logic từ App.tsx
  };
  
  const handleDeleteDepartment = async () => {
    // Logic từ App.tsx
  };
  
  const loadDepartments = async () => {
    const rows = await fetchDepartments();
    setDepartments(rows || []);
  };
  
  return {
    departments,
    isSaving,
    handleSaveDepartment,
    handleDeleteDepartment,
    loadDepartments,
  };
}
```

#### 3.2 Tạo các hooks tương tự cho:
- `frontend/hooks/useEmployees.ts`
- `frontend/hooks/useBusinesses.ts`
- `frontend/hooks/useVendors.ts`
- `frontend/hooks/useProducts.ts`
- `frontend/hooks/useCustomers.ts`
- `frontend/hooks/useCustomerPersonnel.ts`
- `frontend/hooks/useProjects.ts`
- `frontend/hooks/useContracts.ts`
- `frontend/hooks/useDocuments.ts`
- `frontend/hooks/useReminders.ts`
- `frontend/hooks/useUserDeptHistory.ts`
- `frontend/hooks/useFeedbacks.ts`

**Kết quả Phase 3:** Giảm ~1200 dòng, mỗi module có hook riêng testable

---

### PHASE 4: Tách Dashboard Calculations (Giảm ~300 dòng)

#### 4.1 Tạo `frontend/utils/dashboardCalculations.ts`
```typescript
export function calculateDashboardStats(
  contracts: Contract[],
  paymentSchedules: PaymentSchedule[],
  projects: Project[],
  customers: Customer[]
): DashboardStats {
  // Logic tính toán từ dashboardStats useMemo
}

export function calculateContractKpis(
  contracts: Contract[],
  paymentSchedules: PaymentSchedule[],
  contractsPageMeta?: { kpis?: Record<string, unknown> }
): ContractAggregateKpis {
  // Logic tính contract KPIs
}

export function calculateCustomerKpis(
  customersPageMeta?: { kpis?: Record<string, unknown> }
): CustomerAggregateKpis {
  // Logic tính customer KPIs
}

export function calculateHrStatistics(
  employees: Employee[],
  departments: Department[]
): HRStatistics {
  // Delegate to existing buildHrStatistics utility
}
```

**Kết quả Phase 4:** Giảm ~300 dòng, calculations có thể unit test

---

### PHASE 5: Tách Access Control Operations (Giảm ~400 dòng)

#### 5.1 Tạo `frontend/hooks/useAccessControl.ts`
```typescript
export function useAccessControl() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userAccessRecords, setUserAccessRecords] = useState<UserAccessRecord[]>([]);
  const addToast = useToast();
  
  const refreshAccessControlData = async () => {
    // Load roles, permissions, userAccess
  };
  
  const handleUpdateAccessRoles = async (userId: number, roleIds: number[]) => {
    // Update roles logic
  };
  
  const handleBulkUpdateAccessRoles = async (updates: Array<{ userId: number; roleIds: number[] }>) => {
    // Bulk update logic
  };
  
  const handleBulkUpdateAccessPermissions = async (updates: Array<{
    userId: number;
    overrides: Array<{ permission_id: number; type: 'GRANT' | 'DENY' }>;
  }>) => {
    // Bulk permissions logic
  };
  
  const handleBulkUpdateAccessScopes = async (updates: Array<{
    userId: number;
    scopes: Array<{ dept_id: number; scope_type: string }>;
  }>) => {
    // Bulk scopes logic
  };
  
  return {
    roles,
    permissions,
    userAccessRecords,
    refreshAccessControlData,
    handleUpdateAccessRoles,
    handleBulkUpdateAccessRoles,
    handleBulkUpdateAccessPermissions,
    handleBulkUpdateAccessScopes,
  };
}
```

**Kết quả Phase 5:** Giảm ~400 dòng

---

### PHASE 6: Tách Integration Settings (Giảm ~300 dòng)

#### 6.1 Tạo `frontend/hooks/useIntegrationSettings.ts`
```typescript
export function useIntegrationSettings() {
  const [backblazeB2Settings, setBackblazeB2Settings] = useState<BackblazeB2IntegrationSettings | null>(null);
  const [googleDriveSettings, setGoogleDriveSettings] = useState<GoogleDriveIntegrationSettings | null>(null);
  const [contractExpiryAlertSettings, setContractExpiryAlertSettings] = useState<ContractExpiryAlertSettings | null>(null);
  const [contractPaymentAlertSettings, setContractPaymentAlertSettings] = useState<ContractPaymentAlertSettings | null>(null);
  
  const [isBackblazeB2SettingsLoading, setIsBackblazeB2SettingsLoading] = useState(false);
  const [isBackblazeB2SettingsSaving, setIsBackblazeB2SettingsSaving] = useState(false);
  const [isBackblazeB2SettingsTesting, setIsBackblazeB2SettingsTesting] = useState(false);
  // ... other loading states
  
  const refreshBackblazeB2Settings = async () => {
    // Load Backblaze settings
  };
  
  const refreshGoogleDriveSettings = async () => {
    // Load Google Drive settings
  };
  
  // ... other refresh functions
  
  const handleSaveBackblazeB2Settings = async (payload: BackblazeB2IntegrationSettingsUpdatePayload) => {
    // Save logic
  };
  
  const handleTestBackblazeB2Integration = async (payload: BackblazeB2IntegrationSettingsUpdatePayload) => {
    // Test logic
  };
  
  // ... other handlers
  
  return {
    backblazeB2Settings,
    googleDriveSettings,
    contractExpiryAlertSettings,
    contractPaymentAlertSettings,
    loadingStates: { ... },
    refreshIntegrationSettings,
    handleSaveBackblazeB2Settings,
    handleSaveGoogleDriveSettings,
    handleSaveContractExpiryAlertSettings,
    handleSaveContractPaymentAlertSettings,
    handleTestBackblazeB2Integration,
    handleTestGoogleDriveIntegration,
  };
}
```

**Kết quả Phase 6:** Giảm ~300 dòng

---

### PHASE 7: Tách Modal Management (Giảm ~200 dòng)

#### 7.1 Tạo `frontend/hooks/useModalManagement.ts`
```typescript
export interface ModalState {
  type: ModalType | null;
  importModuleOverride: string | null;
  selectedDept: Department | null;
  selectedEmployee: Employee | null;
  // ... other selections
}

export function useModalManagement() {
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [importModuleOverride, setImportModuleOverride] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  // ... other selections
  
  const primeModalDatasets = async (type: ModalType) => {
    // Load required datasets for modal
  };
  
  const handleOpenModal = (type: ModalType, item?: any) => {
    // Open modal logic with permission check
  };
  
  const handleOpenImportModalForModule = (moduleKey: string) => {
    // Open import modal logic
  };
  
  const handleCloseModal = () => {
    // Close modal logic with cleanup
  };
  
  return {
    modalState: { modalType, importModuleOverride, ... },
    selectedItems: { selectedDept, selectedEmployee, ... },
    handleOpenModal,
    handleOpenImportModalForModule,
    handleCloseModal,
  };
}
```

**Kết quả Phase 7:** Giảm ~200 dòng

---

### PHASE 8: Tách Authentication Logic (Giảm ~150 dòng)

#### 8.1 Tạo `frontend/hooks/useAuth.ts`
```typescript
export function useAuth() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginInfoMessage, setLoginInfoMessage] = useState('');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [passwordChangeForm, setPasswordChangeForm] = useState({ ... });
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  
  const handleLogin = async (payload: { username: string; password: string }) => {
    // Login logic
  };
  
  const handleLogout = async () => {
    // Logout logic
  };
  
  const handleChangePasswordRequired = async () => {
    // Password change logic
  };
  
  const handleTabEvicted = useCallback(() => {
    // Tab eviction handling
  }, []);
  
  useEffect(() => {
    // Auth bootstrap effect
  }, []);
  
  useEffect(() => {
    // Tab eviction handler registration
  }, [handleTabEvicted]);
  
  useTabSession({
    isAuthenticated: authUser !== null,
    onEvicted: handleTabEvicted,
  });
  
  return {
    authUser,
    isAuthLoading,
    isLoginLoading,
    loginError,
    loginInfoMessage,
    passwordChangeRequired,
    passwordChangeForm,
    isPasswordChanging,
    passwordChangeError,
    handleLogin,
    handleLogout,
    handleChangePasswordRequired,
  };
}
```

**Kết quả Phase 8:** Giảm ~150 dòng

---

### PHASE 9: Tách Toast Management (Giảm ~50 dòng)

#### 9.1 Tạo `frontend/hooks/useAppToast.ts`
```typescript
export function useAppToast() {
  const { toasts, addToast: enqueueToast, removeToast, clearToasts } = useToastQueue();
  const recentToastByKeyRef = useRef<Map<string, number>>(new Map());
  
  const addToast = useCallback((type: 'success' | 'error', title: string, message: string) => {
    const toastKey = `${type}|${title}|${message}`;
    const now = Date.now();
    const lastShownAt = recentToastByKeyRef.current.get(toastKey) ?? 0;
    if (now - lastShownAt < 2500) {
      return;
    }
    recentToastByKeyRef.current.set(toastKey, now);
    recentToastByKeyRef.current.forEach((timestamp, key) => {
      if (now - timestamp > 30000) {
        recentToastByKeyRef.current.delete(key);
      }
    });
    enqueueToast(type, title, message);
  }, [enqueueToast]);
  
  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
  };
}
```

**Kết quả Phase 9:** Giảm ~50 dòng

---

### PHASE 10: Tách Navigation & Routing (Giảm ~100 dòng)

#### 10.1 Tạo `frontend/hooks/useAppNavigation.ts`
```typescript
export function useAppNavigation(availableTabs: string[], visibleTabIds: Set<string>) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [internalUserSubTab, setInternalUserSubTab] = useState<InternalUserSubTab>('dashboard');
  
  const getRoutePathFromTabId = useCallback((tabId: string): string => {
    // Mapping logic
  }, []);
  
  const getTabIdFromPath = useCallback((pathname: string): string | null => {
    // Reverse mapping logic
  }, [availableTabs]);
  
  // Sync from URL to activeTab
  useEffect(() => {
    const tabFromPath = getTabIdFromPath(location.pathname);
    if (tabFromPath && tabFromPath !== activeTab) {
      setActiveTab(tabFromPath);
    }
  }, [location.pathname, getTabIdFromPath]);
  
  const handleNavigateTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
    navigate(getRoutePathFromTabId(tabId));
  }, [navigate, getRoutePathFromTabId]);
  
  // Fallback tab logic
  useEffect(() => {
    if (!visibleTabIds.has(activeTab)) {
      const fallbackTab = availableTabs.find((tabId) => visibleTabIds.has(tabId)) || 'dashboard';
      if (fallbackTab !== activeTab) {
        handleNavigateTab(fallbackTab);
      }
    }
  }, [activeTab, visibleTabIds, handleNavigateTab]);
  
  return {
    activeTab,
    internalUserSubTab,
    setInternalUserSubTab,
    handleNavigateTab,
    getRoutePathFromTabId,
    getTabIdFromPath,
  };
}
```

**Kết quả Phase 10:** Giảm ~100 dòng

---

### PHASE 11: Tách Dataset Loading (Giảm ~250 dòng)

#### 11.1 Tạo `frontend/hooks/useDatasetLoading.ts`
```typescript
export function useDatasetLoading(authUser: AuthUser | null, passwordChangeRequired: boolean) {
  const [datasetLoadingByKey, setDatasetLoadingByKey] = useState<Record<string, boolean>>({});
  const loadedModulesRef = useRef<Set<string>>(new Set());
  const datasetLoadInFlightRef = useRef<Record<string, Promise<void>>>({});
  
  const updateDatasetLoadingState = useCallback((datasetKey: string, isLoading: boolean) => {
    // State update logic
  }, []);
  
  const ensureDatasetLoaded = useCallback(async (datasetKey: string, forceReload = false) => {
    // Load dataset logic
  }, [authUser, passwordChangeRequired]);
  
  const loadDatasets = useCallback(async (datasetKeys: string[], forceReloadTargets: Set<string> = new Set()) => {
    // Load multiple datasets
  }, [ensureDatasetLoaded]);
  
  const resetDatasetLoading = useCallback(() => {
    // Reset all dataset loading state
  }, []);
  
  return {
    datasetLoadingByKey,
    ensureDatasetLoaded,
    loadDatasets,
    resetDatasetLoading,
  };
}
```

**Kết quả Phase 11:** Giảm ~250 dòng

---

### PHASE 12: Tách Prefetch Logic (Giảm ~100 dòng)

#### 12.1 Tạo `frontend/hooks/useTabPrefetch.ts`
```typescript
export function useTabPrefetch() {
  const prefetchedTabsRef = useRef<Set<string>>(new Set());
  
  const prefetchTabModules = useCallback((tab: string) => {
    const normalizedTab = String(tab || '').trim();
    if (!normalizedTab || prefetchedTabsRef.current.has(normalizedTab)) {
      return;
    }
    
    const prefetchTasks: Array<Promise<unknown>> = [];
    switch (normalizedTab) {
      case 'dashboard':
        prefetchTasks.push(import('./components/Dashboard'));
        break;
      case 'internal_user_dashboard':
      case 'internal_user_list':
        prefetchTasks.push(import('./components/InternalUserModuleTabs'));
        break;
      // ... other cases
    }
    
    prefetchedTabsRef.current.add(normalizedTab);
    void Promise.allSettled(prefetchTasks);
  }, []);
  
  return { prefetchTabModules };
}
```

**Kết quả Phase 12:** Giảm ~100 dòng

---

### PHASE 13: Tách Page Loading Effects (Giảm ~200 dòng)

#### 13.1 Tạo `frontend/hooks/usePageDataLoading.ts`
```typescript
export function usePageDataLoading(
  activeTab: string,
  internalUserSubTab: InternalUserSubTab,
  authUser: AuthUser | null,
  datasetLoading: ReturnType<typeof useDatasetLoading>
) {
  const pageLoadVersionRef = useRef<Record<string, number>>({});
  const pageQueryInFlightSignatureRef = useRef<Record<string, string>>({});
  const pageQueryDebounceRef = useRef<Record<string, number>>({});
  const recentTabDataLoadRef = useRef<Map<string, number>>(new Map());
  
  // loadEmployeesPage
  const loadEmployeesPage = useCallback(async (query?: PaginatedQuery) => {
    // Page loading logic
  }, []);
  
  // loadCustomersPage
  const loadCustomersPage = useCallback(async (query?: PaginatedQuery) => {
    // Page loading logic
  }, []);
  
  // loadProjectsPage
  const loadProjectsPage = useCallback(async (query?: PaginatedQuery) => {
    // Page loading logic
  }, []);
  
  // loadContractsPage
  const loadContractsPage = useCallback(async (query?: PaginatedQuery) => {
    // Page loading logic
  }, []);
  
  // loadDocumentsPage
  const loadDocumentsPage = useCallback(async (query?: PaginatedQuery) => {
    // Page loading logic
  }, []);
  
  // loadAuditLogsPage
  const loadAuditLogsPage = useCallback(async (query?: PaginatedQuery) => {
    // Page loading logic
  }, []);
  
  // loadFeedbacksPage
  const loadFeedbacksPage = useCallback(async (query?: PaginatedQuery) => {
    // Page loading logic
  }, []);
  
  // Tab loading effect
  useEffect(() => {
    const loadByActiveTab = async () => {
      // Dataset plan by tab logic
    };
    void loadByActiveTab();
  }, [activeTab, internalUserSubTab, authUser]);
  
  return {
    loadEmployeesPage,
    loadCustomersPage,
    loadProjectsPage,
    loadContractsPage,
    loadDocumentsPage,
    loadAuditLogsPage,
    loadFeedbacksPage,
  };
}
```

**Kết quả Phase 13:** Giảm ~200 dòng

---

### PHASE 14: Tách Export Functions (Giảm ~150 dòng)

#### 14.1 Tạo `frontend/utils/exportUtils.ts`
```typescript
export async function exportProjectsByCurrentQuery(
  authUser: AuthUser,
  currentQuery: PaginatedQuery
): Promise<Project[]> {
  // Export projects logic
}

export async function exportContractsByCurrentQuery(
  authUser: AuthUser,
  currentQuery: PaginatedQuery
): Promise<Contract[]> {
  // Export contracts logic
}

export async function exportProjectRaciByProjectIds(
  authUser: AuthUser,
  projectIds: Array<string | number>
): Promise<ProjectRaciRow[]> {
  // Export RACI logic
}
```

**Kết quả Phase 14:** Giảm ~150 dòng

---

### PHASE 15: Cleanup App.tsx cuối cùng (Giảm ~200 dòng)

Sau khi tách tất cả các phần trên, App.tsx sẽ được cleanup:

#### Cấu trúc App.tsx mới (~1000-1500 dòng)
```typescript
import React, { Suspense, lazy, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Custom hooks
import { useAuth } from './hooks/useAuth';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useAppToast } from './hooks/useAppToast';
import { useDatasetLoading } from './hooks/useDatasetLoading';
import { usePageDataLoading } from './hooks/usePageDataLoading';
import { useTabPrefetch } from './hooks/useTabPrefetch';
import { useDepartments } from './hooks/useDepartments';
import { useEmployees } from './hooks/useEmployees';
import { useBusinesses } from './hooks/useBusinesses';
import { useVendors } from './hooks/useVendors';
import { useProducts } from './hooks/useProducts';
import { useCustomers } from './hooks/useCustomers';
import { useCustomerPersonnel } from './hooks/useCustomerPersonnel';
import { useProjects } from './hooks/useProjects';
import { useContracts } from './hooks/useContracts';
import { useDocuments } from './hooks/useDocuments';
import { useReminders } from './hooks/useReminders';
import { useUserDeptHistory } from './hooks/useUserDeptHistory';
import { useFeedbacks } from './hooks/useFeedbacks';
import { useAccessControl } from './hooks/useAccessControl';
import { useIntegrationSettings } from './hooks/useIntegrationSettings';
import { useModalManagement } from './hooks/useModalManagement';
import { useImportData } from './hooks/useImportData';

// Utils
import { calculateDashboardStats, calculateContractKpis, calculateCustomerKpis } from './utils/dashboardCalculations';
import { buildHrStatistics } from './utils/hrAnalytics';
import { exportProjectsByCurrentQuery, exportContractsByCurrentQuery, exportProjectRaciByProjectIds } from './utils/exportUtils';

// Components
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { ToastContainer } from './components/Toast';
import { AppPages } from './AppPages';
import { AppErrorBoundary } from './components/AppErrorBoundary';

// Lazy components
const ProjectProcedureModal = lazy(() => import('./components/ProjectProcedureModal').then((module) => ({ default: module.ProjectProcedureModal })));
const ContractModal = lazy(() => import('./components/ContractModal').then((module) => ({ default: module.ContractModal })));
// ... other lazy imports

const App: React.FC = () => {
  // Auth hook
  const auth = useAuth();
  
  // Navigation hook
  const navigation = useAppNavigation(availableTabs, visibleTabIds);
  
  // Toast hook
  const toast = useAppToast();
  
  // Dataset loading hook
  const datasetLoading = useDatasetLoading(auth.authUser, auth.passwordChangeRequired);
  
  // Page data loading hook
  const pageDataLoading = usePageDataLoading(
    navigation.activeTab,
    navigation.internalUserSubTab,
    auth.authUser,
    datasetLoading
  );
  
  // Module hooks
  const departments = useDepartments();
  const employees = useEmployees();
  const businesses = useBusinesses();
  const vendors = useVendors();
  const products = useProducts();
  const customers = useCustomers();
  const customerPersonnel = useCustomerPersonnel();
  const projects = useProjects();
  const contracts = useContracts();
  const documents = useDocuments();
  const reminders = useReminders();
  const userDeptHistory = useUserDeptHistory();
  const feedbacks = useFeedbacks();
  const accessControl = useAccessControl();
  const integrationSettings = useIntegrationSettings();
  const modalManagement = useModalManagement();
  const importData = useImportData();
  const prefetch = useTabPrefetch();
  
  // Calculations
  const dashboardStats = useMemo(() => 
    calculateDashboardStats(
      contracts.contracts,
      contracts.paymentSchedules,
      projects.projects,
      customers.customers
    ), 
    [contracts, projects, customers]
  );
  
  const contractAggregateKpis = useMemo(() => 
    calculateContractKpis(contracts.contracts, contracts.paymentSchedules, contracts.contractsPageMeta),
    [contracts]
  );
  
  const customerAggregateKpis = useMemo(() => 
    calculateCustomerKpis(customers.customersPageMeta),
    [customers]
  );
  
  const hrStatistics = useMemo(() => 
    buildHrStatistics(employees.employees, departments.departments),
    [employees, departments]
  );
  
  // Export functions
  const exportProjects = async () => exportProjectsByCurrentQuery(auth.authUser, pageDataLoading.currentQuery);
  const exportContracts = async () => exportContractsByCurrentQuery(auth.authUser, pageDataLoading.currentQuery);
  const exportRaci = async (ids: Array<string | number>) => exportProjectRaciByProjectIds(auth.authUser, ids);
  
  // Render loading states
  if (auth.isAuthLoading) {
    return <AuthLoading />;
  }
  
  if (!auth.authUser) {
    return <LoginPage {...auth} onSubmit={auth.handleLogin} />;
  }
  
  if (auth.passwordChangeRequired) {
    return <PasswordChangeScreen {...auth} onSubmit={auth.handleChangePasswordRequired} />;
  }
  
  if (visibleTabIds.size === 0) {
    return <NoPermissionScreen onLogout={auth.handleLogout} />;
  }
  
  // Main render
  return (
    <AppErrorBoundary>
      <div className="flex h-screen bg-bg-light overflow-hidden flex-col lg:flex-row">
        <Sidebar
          activeTab={navigation.activeTab}
          setActiveTab={navigation.handleNavigateTab}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentUser={auth.authUser}
          visibleTabIds={visibleTabIds}
          onLogout={auth.handleLogout}
          onPrefetchTab={prefetch.prefetchTabModules}
        />
        
        <main className="flex-1 overflow-y-auto bg-bg-light w-full">
          <Suspense fallback={<LazyModuleFallback />}>
            <AppPages
              activeTab={navigation.activeTab}
              authUser={auth.authUser}
              // ... pass all props from hooks
            />
          </Suspense>
        </main>
        
        <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
        
        {/* Modals */}
        <Suspense fallback={null}>
          {/* Conditional modal renders using modalManagement state */}
        </Suspense>
      </div>
    </AppErrorBoundary>
  );
};

export default App;
```

**Kết quả Phase 15:** App.tsx còn ~1000-1500 dòng, chủ yếu là wiring và rendering

---

## 4. Tổng kết số dòng giảm

| Phase | Mô tả | Dòng giảm |
|-------|-------|-----------|
| 1 | Utility functions | ~400 |
| 2 | Import logic | ~800 |
| 3 | CRUD handlers | ~1200 |
| 4 | Dashboard calculations | ~300 |
| 5 | Access control | ~400 |
| 6 | Integration settings | ~300 |
| 7 | Modal management | ~200 |
| 8 | Authentication | ~150 |
| 9 | Toast management | ~50 |
| 10 | Navigation | ~100 |
| 11 | Dataset loading | ~250 |
| 12 | Prefetch logic | ~100 |
| 13 | Page loading effects | ~200 |
| 14 | Export functions | ~150 |
| 15 | Cleanup final | ~200 |
| **TOTAL** | | **~5800** |

### Kết quả cuối cùng
- **Trước:** ~6000+ dòng
- **Sau:** ~1000-1500 dòng
- **Giảm:** ~75-80%

---

## 5. Lợi ích đạt được

### ✅ Maintainability
- Mỗi file nhỏ hơn, dễ đọc và hiểu
- Logic được tổ chức theo domain/module
- Dễ tìm code cần sửa

### ✅ Testability
- Mỗi hook có thể test độc lập
- Utility functions có unit tests
- Mock dependencies dễ dàng

### ✅ Performance
- Code splitting tự nhiên hơn
- Mỗi hook có thể optimize riêng
- Giảm re-render không cần thiết

### ✅ Team Collaboration
- Mỗi người làm một hook/file
- Giảm merge conflicts
- Code review dễ hơn

---

## 6. Rủi ro và giảm thiểu

| Rủi ro | Mức độ | Giảm thiểu |
|--------|--------|------------|
| Breaking changes | Cao | Giữ nguyên API surface, chỉ tách file |
| Regressions | Trung bình | Test kỹ từng phase, rollback dễ |
| Performance issues | Thấp | Profile trước/sau mỗi phase |
| Team confusion | Trung bình | Document rõ từng bước |

---

## 7. Timeline đề xuất

| Phase | Thời gian | Priority |
|-------|-----------|----------|
| 1-3 (Core refactoring) | 3-5 days | 🔴 High |
| 4-7 (Business logic) | 3-4 days | 🟡 Medium |
| 8-12 (Infrastructure) | 2-3 days | 🟡 Medium |
| 13-15 (Final cleanup) | 2-3 days | 🟢 Low |

**Tổng thời gian:** 10-15 working days

---

## 8. Checklist thực hiện

### Phase 1: Utility Functions
- [ ] Tạo `utils/importUtils.ts`
- [ ] Tạo `utils/importValidation.ts`
- [ ] Tạo `utils/queryUtils.ts`
- [ ] Update imports trong App.tsx
- [ ] Test build

### Phase 2: Import Logic
- [ ] Tạo 8 hooks useImport*
- [ ] Tạo orchestrator useImportData
- [ ] Replace handleImportData trong App.tsx
- [ ] Test import từng module

### Phase 3: CRUD Handlers
- [ ] Tạo 12 hooks use* cho entities
- [ ] Replace handlers trong App.tsx
- [ ] Test CRUD operations

### Phase 4-15: Tiếp tục tương tự...

---

## 9. Quy tắc thực hiện

1. **Mỗi phase phải pass build trước khi qua phase tiếp theo**
2. **Không thay đổi behavior, chỉ di chuyển code**
3. **Giữ nguyên types và interfaces**
4. **Commit sau mỗi phase hoàn thành**
5. **Test manual các chức năng chính sau mỗi phase**

---

## 10. File structure sau refactor

```
frontend/
├── App.tsx (1000-1500 dòng)
├── AppPages.tsx
├── AppWithRouter.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useAppNavigation.ts
│   ├── useAppToast.ts
│   ├── useDatasetLoading.ts
│   ├── usePageDataLoading.ts
│   ├── useTabPrefetch.ts
│   ├── useImportData.ts
│   ├── useImportDepartments.ts
│   ├── useImportEmployees.ts
│   ├── useImportBusinesses.ts
│   ├── useImportVendors.ts
│   ├── useImportProducts.ts
│   ├── useImportCustomers.ts
│   ├── useImportCustomerPersonnel.ts
│   ├── useImportProjects.ts
│   ├── useDepartments.ts
│   ├── useEmployees.ts
│   ├── useBusinesses.ts
│   ├── useVendors.ts
│   ├── useProducts.ts
│   ├── useCustomers.ts
│   ├── useCustomerPersonnel.ts
│   ├── useProjects.ts
│   ├── useContracts.ts
│   ├── useDocuments.ts
│   ├── useReminders.ts
│   ├── useUserDeptHistory.ts
│   ├── useFeedbacks.ts
│   ├── useAccessControl.ts
│   ├── useIntegrationSettings.ts
│   └── useModalManagement.ts
├── utils/
│   ├── importUtils.ts
│   ├── importValidation.ts
│   ├── queryUtils.ts
│   ├── exportUtils.ts
│   ├── dashboardCalculations.ts
│   ├── hrAnalytics.ts
│   └── ... (existing utils)
└── components/
    └── ... (unchanged)
```

---

## Summary

Kế hoạch này sẽ biến App.tsx từ 6000+ dòng thành ~1000-1500 dòng thông qua:
- **15 phases** incremental refactoring
- **30+ files** mới (hooks + utils)
- **75-80%** dòng code giảm
- **Zero** breaking changes nếu follow đúng plan

Mỗi phase có thể thực hiện độc lập, dừng ở bất kỳ điểm nào mà không breaking existing functionality.