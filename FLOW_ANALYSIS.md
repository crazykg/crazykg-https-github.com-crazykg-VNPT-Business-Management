# Luồng XML và HTTP Flow Analysis
## URL: `http://localhost:5174/?tab=customer_request_management`

---

## 📋 Phần 1: XML Workflow Diagram

### File: `workflowa.drawio (1).xml`

**Mục đích:** Biểu đồ quy trình quản lý Yêu cầu Khách hàng (Customer Request Workflow) bằng Draw.io

**Định dạng:** XML cấu trúc mxGraphModel (Draw.io format)
- **Host:** app.diagrams.net
- **Version:** 29.6.1
- **Page:** Page-1
- **Canvas size:** 827x1169 pixels

### Quy trình chính (Business Flow):

```
┌─────────────────────────────────────────────────────────────────┐
│                     Yêu cầu từ Khách hàng                        │
│              (Tiếp nhận Yêu cầu từ khách hàng)                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Người nhập YC (Creator) Đánh giá khả năng:                     │
│  1. Tự hỗ trợ được?                                            │
│  2. Giao việc cho ai?                                          │
└────┬─────────────────────────────────────────────────────────┬─┘
     │                                                           │
     │ Không (Ngoài khả năng)                 Có (Có thể xử lý)│
     │                                                           │
     ▼                                                           ▼
┌──────────────────┐                            ┌─────────────────────┐
│ Giao YC cho PM   │                            │ Giao YC cho R       │
│ (Dispatcher)     │                            │ (Performer)         │
│                  │                            │                     │
│Trạng thái:       │                            │Người xem: PM,       │
│ - Mới tiếp nhận  │                            │ Creator, Performer  │
│                  │                            │                     │
│Người xem:        │                            │Trạng thái:          │
│ - PM             │                            │ - Mới tiếp nhận     │
│ - Creator        │                            └─────┬───────────────┘
└────────┬─────────┘                                  │
         │                                           │
         ▼                                           │
┌─────────────────────────────────────────────┐     │
│ PM (Dispatcher) Đánh giá khả năng thực hiện │     │
│                                             │     │
│ 1. Có thể thực hiện?                        │     │
│ 2. Giao cho ai?                             │     │
└──────────┬──────────────────────────────┬───┘     │
           │                              │         │
           │ Không                        │ Có      │
           │                              │         │
           ▼                              ▼         │
    ┌─────────────────┐           ┌──────────────┐  │
    │ Không thực hiện │           │ (Tiếp tục)   │  │
    │                 │           │ Assign R     │  │
    │Trạng thái:      │           └──────────────┘  │
    │ - Không thực hiện                             │
    │                 │                             │
    │Người xem:       │                             │
    │ - PM            │                             │
    │ - Creator       │                             │
    └─────────────────┘                             │
                                                    │
    ┌───────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────┐
│ Thông báo Khách hàng                             │
│ (Notify Customer)                                │
│                                                  │
│ Trạng thái: Hoàn tất / Chưa hoàn tất             │
└──────────────────────────────────────────────────┘
```

**Các trạng thái (Status Codes):**
1. **Mới tiếp nhận (new_intake)** - Ban đầu
2. **Chờ giao việc (pending_dispatch)** - Creator đánh giá, chờ PM
3. **Đã giao (dispatched)** - PM đã giao cho Performer
4. **Không thực hiện (not_executed)** - PM từ chối
5. **Hoàn tất/Chưa hoàn tất (completed/not_completed)** - Cuối quy trình

**Các vai trò (Roles):**
- **Creator (C)**: Người nhập yêu cầu (received_by_user_id)
- **Dispatcher (D)**: Quản lý dự án/PM (dispatcher_user_id)
- **Performer (P)**: Người thực hiện (performer_user_id)

---

## 📡 Phần 2: HTTP Code Flow

### 2.1 **Initial Page Load Sequence**

```
Browser Request:
GET http://localhost:5174/?tab=customer_request_management HTTP/1.1
```

#### Flow Step-by-Step:

```
1. Browser nhận URL với parameter ?tab=customer_request_management
   │
   ▼
2. HTML index.html tải → React bootstrap (index.tsx)
   │
   ▼
3. App.tsx component khởi tạo:
   - useState('dashboard') ← activeTab = 'dashboard' (default)
   - Tạo availableTabs array chứa tất cả tab IDs
   │
   ▼
4. useEffect #1: syncTabFromUrl() chạy
   ├─ window.location.search = "?tab=customer_request_management"
   ├─ URLSearchParams.get('tab') = "customer_request_management"
   ├─ Kiểm tra: availableTabs.includes('customer_request_management') ✓
   └─ setActiveTab('customer_request_management')
   │
   ▼
5. useEffect #2: URL state synchronization
   └─ window.history.replaceState(...) cập nhật browser history
   │
   ▼
6. useEffect #3: Load dữ liệu theo activeTab (loadByActiveTab)
   ├─ activeModule = 'customer_request_management'
   ├─ Kiểm tra throttle: 600ms (ngăn load lặp liên tiếp)
   │
   ├─ CRITICAL DATA (phải load ngay):
   │  └─ supportServiceGroups
   │
   └─ DEFERRED DATA (tải sau 100ms):
      ├─ customers
      ├─ customerPersonnel
      └─ employees
```

### 2.2 **Data Loading Plan for customer_request_management Tab**

```javascript
// Từ App.tsx line 995-998
customer_request_management: {
  critical: ['supportServiceGroups'],
  deferred: ['customers', 'customerPersonnel', 'employees'],
}
```

#### Timeline:

| Thời điểm | Hành động | API Call |
|-----------|----------|----------|
| **T=0ms** | Tab click → activeTab change | - |
| **T=0ms** | loadDatasets(critical) bắt đầu | `GET /api/v5/support-service-groups` |
| **T=0-50ms** | Critical data fetch | Fetch supportServiceGroups |
| **T=50-100ms** | Render component → CustomerRequestManagementHub | - |
| **T=100ms** | scheduleDeferredDatasetLoad chạy | - |
| **T=100-500ms** | Deferred load chạy (requestAnimationFrame) | `GET /api/v5/customers`, `/api/v5/employees`, etc. |
| **T=500ms+** | Dữ liệu đầy đủ, UI render hoàn chỉnh | - |

### 2.3 **Data Loading Functions**

```typescript
// Từ App.tsx
const loadDatasets = async (targets: string[], forceReload: Set<string>) => {
  // targets = ['supportServiceGroups']

  for (const target of targets) {
    if (Cache[target] && !forceReload.has(target)) {
      continue; // Use cached data
    }

    // Fetch từ API v5
    const response = await apiFetch(`/api/v5/${kebabCase(target)}`);
    const data = response.json();
    setState(data); // Update component state
    Cache[target] = data;
  }
}

const scheduleDeferredDatasetLoad = (targets: string[]) => {
  // targets = ['customers', 'customerPersonnel', 'employees']

  requestAnimationFrame(() => {
    // Fetch in background, don't block UI
    Promise.all(targets.map(t => loadDatasets([t], new Set())));
  });
}
```

### 2.4 **API Endpoints Called**

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/v5/support-service-groups` | GET | Lấy danh sách nhóm dịch vụ | `{ data: [...], meta: {...} }` |
| `/api/v5/customers` | GET | Lấy danh sách khách hàng | `{ data: [...], meta: {...} }` |
| `/api/v5/customer-personnel` | GET | Lấy danh sách nhân viên KH | `{ data: [...], meta: {...} }` |
| `/api/v5/employees` | GET | Lấy danh sách nhân viên nội bộ | `{ data: [...], meta: {...} }` |

**Lưu ý:**
- Tất cả API calls được **deduplicated** qua `inFlightGetRequests` Map trong `apiFetch()`
- Có **45s timeout** cho mỗi request
- Tự động **401 refresh token** nếu session hết hạn
- Có **GET deduplication**: nếu 2 request giống nhau trong 100ms, chỉ gửi 1 lần

---

## 📊 Phần 3: Component Rendering Flow

### 3.1 **Component Hierarchy**

```
App.tsx (Main Container)
│
├─ if (activeTab === 'customer_request_management') {
│  │
│  ▼
│  <CustomerRequestManagementHub
│  │   ├─ Props from App:
│  │   │  ├─ customers
│  │   │  ├─ customerPersonnel
│  │   │  ├─ projectItems
│  │   │  ├─ employees
│  │   │  ├─ supportServiceGroups
│  │   │  ├─ currentUserId = authUser?.id
│  │   │  ├─ isAdminViewer = hasRole('ADMIN')
│  │   │  ├─ canReadRequests = hasPermission('support_requests.read')
│  │   │  ├─ canWriteRequests = hasPermission('support_requests.write')
│  │   │  ├─ canDeleteRequests = hasPermission('support_requests.delete')
│  │   │  ├─ canImportRequests = hasPermission('support_requests.import')
│  │   │  ├─ canExportRequests = hasPermission('support_requests.export')
│  │   │  └─ onNotify = addToast callback
│  │   │
│  │   ▼
│  │   customerRequestManagementHub.tsx (9,300 lines)
│  │   │
│  │   ├─ Custom Hooks (từ ./customer-request/hooks/):
│  │   │  ├─ useCustomerRequestList(...)
│  │   │  ├─ useCustomerRequestDetail(...)
│  │   │  ├─ useCustomerRequestDashboard(...)
│  │   │  ├─ useCustomerRequestCreatorWorkspace(...)
│  │   │  ├─ useCustomerRequestDispatcherWorkspace(...)
│  │   │  ├─ useCustomerRequestPerformerWorkspace(...)
│  │   │  ├─ useCustomerRequestTransition(...)
│  │   │  ├─ useCustomerRequestSearch(...)
│  │   │  ├─ useCustomerRequestAttachments(...)
│  │   │  └─ useCustomerRequestQuickAccess(...)
│  │   │
│  │   └─ Sub-Components:
│  │      ├─ <CustomerRequestListPane /> ← Danh sách YC
│  │      ├─ <CustomerRequestDetailPane /> ← Chi tiết YC
│  │      ├─ <CustomerRequestDashboardCards /> ← KPI cards
│  │      ├─ <CustomerRequestQuickAccessBar /> ← Quick access
│  │      ├─ <CustomerRequestWorkspaceTabs /> ← Role-based tabs
│  │      │  ├─ <CustomerRequestCreatorWorkspace /> ← Creator view
│  │      │  ├─ <CustomerRequestDispatcherWorkspace /> ← Dispatcher view
│  │      │  ├─ <CustomerRequestPerformerWorkspace /> ← Performer view
│  │      │  └─ <CustomerRequestOverviewWorkspace /> ← Overview view
│  │      ├─ <CustomerRequestTransitionModal /> ← Chuyển trạng thái
│  │      ├─ <CustomerRequestCreateModal /> ← Tạo YC mới
│  │      └─ <Modals /> ← Other modals
│  │
│  └─ apiFetch layer (services/v5Api.ts):
│     ├─ Fetch customer request cases
│     ├─ Fetch customer request details
│     ├─ Fetch worklog entries
│     ├─ Fetch estimates
│     ├─ Fetch attachments
│     └─ Fetch KPI dashboard data
│
└─ Toast notifications (UI feedback)
```

### 3.2 **Permission Check Flow**

```typescript
// Từ App.tsx line 6816-6827
const isAdminViewer = Boolean(
  authUser && (
    authUser.roles?.includes('ADMIN') ||
    authUser.permissions?.includes('*')
  )
);

const canImportRequests = hasPermission(authUser, 'support_requests.import');
const canExportRequests = hasPermission(authUser, 'support_requests.export');
const canReadRequests = hasPermission(authUser, 'support_requests.read');
const canWriteRequests = hasPermission(authUser, 'support_requests.write');
const canDeleteRequests = hasPermission(authUser, 'support_requests.delete');

// hasPermission từ utils/authorization.ts
function hasPermission(user: AuthUser, action: string): boolean {
  if (!user) return false;
  if (user.permissions?.includes('*')) return true; // Admin wildcard
  return user.permissions?.includes(action) || false;
}
```

---

## 🔄 Phần 4: Hook Logic Details

### 4.1 **useCustomerRequestList Hook**

```typescript
// components/customer-request/hooks/useCustomerRequestList.ts

hook useCustomerRequestList(
  supportServiceGroups,
  employees,
  customers,
) {
  // State
  const [cases, setCases] = useState<YeuCau[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 10 });
  const [filters, setFilters] = useState<FilterQuery>({
    search: '',
    status: null,
    priority: null,
    serviceGroup: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load cases từ API
  const loadCases = async (page, filters) => {
    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/api/v5/customer-request-cases?page=${page}&q=${filters.search}&status=${filters.status}...`
      );
      const data = await response.json();
      setCases(data.data);
      setPagination(data.meta);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger load on mount
  useEffect(() => {
    loadCases(1, filters);
  }, [supportServiceGroups]); // Reload khi service groups change

  return { cases, pagination, filters, isLoading, loadCases };
}
```

### 4.2 **useCustomerRequestDetail Hook**

```typescript
// Fetch full detail của 1 case
hook useCustomerRequestDetail(caseId, currentUserId) {
  const [detail, setDetail] = useState<DetailedYeuCau | null>(null);
  const [worklog, setWorklog] = useState<YeuCauWorklog[]>([]);
  const [estimate, setEstimate] = useState<YeuCauEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadDetail = async (id) => {
    // GET /api/v5/customer-request-cases/{id}
    // Trả về: { case_info, worklogs, estimates, attachments, ... }
    const response = await apiFetch(`/api/v5/customer-request-cases/${id}`);
    const data = await response.json();

    setDetail(data.case);
    setWorklog(data.worklogs || []);
    setEstimate(data.estimate || null);
  };

  return { detail, worklog, estimate, isLoading, loadDetail };
}
```

---

## 🔌 Phần 5: API Request/Response Pattern

### 5.1 **GET /api/v5/customer-request-cases**

**Request:**
```http
GET /api/v5/customer-request-cases?page=1&per_page=10&q=search_term&status=dispatched HTTP/1.1
Host: 127.0.0.1:8002
Cookie: vnpt_business_auth_token=eyJ...; vnpt_business_tab_token=...
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "request_code": "CRC-202603-0001",
      "summary": "Yêu cầu nâng cấp hệ thống",
      "status_code": "dispatched",
      "priority": "high",
      "received_by_user_id": 5,
      "dispatcher_user_id": 3,
      "performer_user_id": 7,
      "service_group_id": 2,
      "estimated_hours": 40,
      "created_at": "2026-03-20T10:00:00Z",
      "updated_at": "2026-03-22T14:30:00Z"
    },
    ...
  ],
  "meta": {
    "page": 1,
    "per_page": 10,
    "total": 156,
    "total_pages": 16,
    "kpis": {
      "total_cases": 156,
      "new_count": 12,
      "dispatched_count": 45,
      "in_progress_count": 38,
      "completed_count": 61
    }
  }
}
```

### 5.2 **GET /api/v5/customer-request-cases/{id}**

**Request:**
```http
GET /api/v5/customer-request-cases/1 HTTP/1.1
```

**Response:**
```json
{
  "case": {
    "id": 1,
    "request_code": "CRC-202603-0001",
    "summary": "Yêu cầu nâng cấp hệ thống",
    "description": "Chi tiết yêu cầu...",
    "status_code": "dispatched",
    "created_by": { "id": 5, "full_name": "Nguyễn A" },
    "dispatcher": { "id": 3, "full_name": "Trần PM" },
    "performer": { "id": 7, "full_name": "Hoàng K" },
    ...
  },
  "worklogs": [
    {
      "id": 101,
      "user_id": 7,
      "work_date": "2026-03-21",
      "actual_hours": 8,
      "work_content": "Phân tích requirement",
      "created_at": "2026-03-21T17:00:00Z"
    }
  ],
  "estimate": {
    "id": 501,
    "estimated_hours": 40,
    "estimated_by": { "id": 3, "full_name": "Trần PM" },
    "created_at": "2026-03-20T11:00:00Z"
  },
  "attachments": [
    {
      "id": 201,
      "file_name": "requirement.pdf",
      "file_size": 2048576,
      "uploaded_at": "2026-03-20T10:30:00Z"
    }
  ]
}
```

### 5.3 **POST /api/v5/customer-request-cases**

**Request:**
```http
POST /api/v5/customer-request-cases HTTP/1.1
Content-Type: application/json

{
  "summary": "Yêu cầu mới từ khách hàng",
  "description": "Chi tiết yêu cầu",
  "customer_id": 15,
  "service_group_id": 2,
  "priority": "medium",
  "estimated_hours": 30,
  "attachments": [...]
}
```

**Response:**
```json
{
  "id": 157,
  "request_code": "CRC-202603-0157",
  "summary": "Yêu cầu mới từ khách hàng",
  "status_code": "new_intake",
  "created_at": "2026-03-23T10:00:00Z"
}
```

### 5.4 **PUT /api/v5/customer-request-cases/{id}/transition**

**Request:**
```http
PUT /api/v5/customer-request-cases/1/transition HTTP/1.1
Content-Type: application/json

{
  "to_status_code": "dispatched",
  "performer_user_id": 7,
  "dispatcher_notes": "Giao cho Hoàng K xử lý"
}
```

**Response:**
```json
{
  "id": 1,
  "status_code": "dispatched",
  "status_instance_id": 1001,
  "performer_user_id": 7,
  "transition_at": "2026-03-22T14:30:00Z"
}
```

---

## 🎯 Phần 6: URL State Management

### 6.1 **URL Query Parameters**

```typescript
// URL có thể nhận các parameters:
// Ví dụ: http://localhost:5174/?tab=customer_request_management&crc_q=search&crc_status=dispatched&crc_sort=created_at

// Từ App.tsx line 1650-1657:
useEffect(() => {
  const url = new URL(window.location.href);

  if (!activeTab || activeTab === 'dashboard') {
    url.searchParams.delete('tab');
  } else {
    url.searchParams.set('tab', activeTab);
  }

  // Cập nhật URL mà không reload page
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}, [activeTab]);
```

### 6.2 **URL Parameters Pattern**

Mỗi module dùng prefix riêng để tránh xung đột:

| Module | Prefix | Ví dụ |
|--------|--------|-------|
| Products | `products_` | `products_q`, `products_sort_key`, `products_page` |
| Customers | `customers_` | `customers_q`, `customers_sort_key` |
| Customer Requests | `crc_` | `crc_q`, `crc_status`, `crc_sort`, `crc_page` |
| Contracts | `contracts_` | `contracts_q`, `contracts_status` |

---

## 📈 Phần 7: Performance Optimizations

### 7.1 **Data Deduplication**

```typescript
// services/v5Api.ts
const inFlightGetRequests = new Map<string, Promise<Response>>();

export const apiFetch = async (input: string, init?: RequestInit) => {
  const cacheKey = `GET_${input}`;

  // Nếu request tương tự đang chạy, tái sử dụng
  if (init?.method !== 'POST' && init?.method !== 'PUT' && inFlightGetRequests.has(cacheKey)) {
    return inFlightGetRequests.get(cacheKey)!;
  }

  const promise = fetch(input, init);
  inFlightGetRequests.set(cacheKey, promise);

  promise.finally(() => inFlightGetRequests.delete(cacheKey));

  return promise;
};
```

### 7.2 **Deferred Loading**

```typescript
// App.tsx line 1044
scheduleDeferredDatasetLoad(datasetPlan.deferred || [], forceReloadTargets);

// Được implement là:
const scheduleDeferredDatasetLoad = (targets: string[], forceReload: Set<string>) => {
  let deferredLoadRafId = requestAnimationFrame(() => {
    loadDatasets(targets, forceReload);
  });
  // Hoặc với timeout nếu RAF không khả dụng
};
```

### 7.3 **Lazy Component Loading**

```typescript
// App.tsx line 241-242
const CustomerRequestManagementHub = lazy(() =>
  import('./components/CustomerRequestManagementHub').then((module) => ({ default: module.CustomerRequestManagementHub }))
);

// Render trong Suspense boundary để show loading state
<Suspense fallback={<LoadingSpinner />}>
  {activeTab === 'customer_request_management' && <CustomerRequestManagementHub />}
</Suspense>
```

### 7.4 **Request Throttling**

```typescript
// App.tsx line 901-912
const throttledTabLoadKey = `${activeModule}::${...}`;
const now = Date.now();
const lastLoadedAt = recentTabDataLoadRef.current.get(throttledTabLoadKey) ?? 0;

if (now - lastLoadedAt < 600) {
  return; // Không load lại trong 600ms
}

recentTabDataLoadRef.current.set(throttledTabLoadKey, now);

// Cleanup old entries (30 giây)
recentTabDataLoadRef.current.forEach((timestamp, key) => {
  if (now - timestamp > 30000) {
    recentTabDataLoadRef.current.delete(key);
  }
});
```

---

## 🔐 Phần 8: Security Flow

### 8.1 **Authentication**

```typescript
// Backend: Sanctum cookie-based auth
// Cookies:
// - vnpt_business_auth_token (60 min lifetime)
// - vnpt_business_refresh_token (7 days lifetime)
// - vnpt_business_tab_token (session)

// Frontend: apiFetch.ts
if (response.status === 401) {
  // Token hết hạn, tự động refresh
  const refreshed = await refreshAccessToken();
  if (refreshed) {
    // Retry request
    return apiFetch(input, init);
  }
  // Nếu refresh fail, redirect to login
  window.location.href = '/login';
}
```

### 8.2 **Authorization**

```typescript
// utils/authorization.ts
export function hasPermission(user: AuthUser, action: string): boolean {
  if (!user?.permissions) return false;

  // Admin wildcard
  if (user.permissions.includes('*')) return true;

  // Exact permission match
  return user.permissions.includes(action);
}

export function canAccessTab(user: AuthUser, tabId: string): boolean {
  // Check specific permissions for each tab
  const tabPermissions: Record<string, string[]> = {
    'customer_request_management': ['support_requests.read'],
    'contracts': ['contracts.read'],
    'projects': ['projects.read'],
    // ...
  };

  const required = tabPermissions[tabId];
  return required?.some(perm => hasPermission(user, perm)) ?? true;
}
```

### 8.3 **Tab Isolation**

```typescript
// Middleware: EnsureActiveTab.php
// Backend kiểm tra vnpt_business_tab_token để đảm bảo
// request đến từ tab hiện tại, không từ tab cũ

if (sessionTabToken !== requestTabToken) {
  return response(403, 'TAB_EVICTED');
}
```

---

## 📝 Phần 9: State Management Flow

### 9.1 **App.tsx State (Main Container)**

```typescript
const [activeTab, setActiveTab] = useState('dashboard');
const [customers, setCustomers] = useState<Customer[]>([]);
const [employees, setEmployees] = useState<Employee[]>([]);
const [supportServiceGroups, setSupportServiceGroups] = useState<SupportServiceGroup[]>([]);
// ... 50+ other state variables
```

### 9.2 **Zustand Store (Future migration)**

```typescript
// shared/stores/uiStore.ts (Zustand)
interface UiState {
  activeTab: string;
  internalUserSubTab: string;
  sidebarCollapsed: boolean;

  setActiveTab: (tab: string) => void;
  setInternalUserSubTab: (subTab: string) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'dashboard',
  internalUserSubTab: 'dashboard',
  sidebarCollapsed: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setInternalUserSubTab: (subTab) => set({ internalUserSubTab: subTab }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
```

### 9.3 **Custom Hook State**

```typescript
// components/customer-request/hooks/useCustomerRequestList.ts
const [cases, setCases] = useState<YeuCau[]>([]);
const [loading, setLoading] = useState(false);
const [pagination, setPagination] = useState<PaginationMeta>({
  page: 1,
  per_page: 10,
  total: 0,
  total_pages: 0,
});

// Call API & update state
const loadCases = async (page = 1, filters = {}) => {
  setLoading(true);
  try {
    const response = await apiFetch(`/api/v5/customer-request-cases?page=${page}...`);
    const data = await response.json();
    setCases(data.data);
    setPagination(data.meta);
  } finally {
    setLoading(false);
  }
};
```

---

## 🎬 Phần 10: Complete Timeline

### User Action → UI Update Timeline

```
T=0ms:    User clicks "Quản lý Yêu cầu" in Sidebar
          └─ Link href="/?tab=customer_request_management"
          └─ onClick handler calls setActiveTab('customer_request_management')

T=0-50ms: URL updates
          └─ window.history.replaceState(...)
          └─ Browser URL bar: http://localhost:5174/?tab=customer_request_management

T=50-100ms: App re-renders (activeTab changed)
          └─ <CustomerRequestManagementHub /> component loads
          └─ Suspense shows loading state

T=100-150ms: loadByActiveTab hook effect fires
          └─ Determine critical data: ['supportServiceGroups']
          └─ Call: apiFetch('/api/v5/support-service-groups')
          └─ Backend processes query

T=150-200ms: Critical data returns
          └─ Response: { data: [...], meta: {...} }
          └─ setSupportServiceGroups(data)

T=200-300ms: CustomerRequestManagementHub renders with critical data
          └─ Shows dashboard cards with KPIs
          └─ Shows empty list (waiting for case data)

T=300-350ms: scheduleDeferredDatasetLoad runs
          └─ requestAnimationFrame callback executes
          └─ Start loading deferred datasets:
             ├─ apiFetch('/api/v5/customers')
             ├─ apiFetch('/api/v5/customer-personnel')
             └─ apiFetch('/api/v5/employees')

T=350-500ms: Multiple API calls in flight
          └─ Network requests being processed by backend
          └─ Deduplication check: same request? Reuse promise

T=500-600ms: First deferred data returns
          └─ setCustomers(data)
          └─ Component re-renders with more info

T=600-1000ms: All deferred data returns
          └─ setEmployees(data)
          └─ setCustomerPersonnel(data)

T=1000ms: Full page loaded
          └─ All data populated
          └─ UI fully interactive
          └─ User can search, filter, create, edit cases
```

---

## 📚 Summary

### XML Workflow (`workflowa.drawio.xml`)
- **Purpose**: Visualize the business process for Customer Request Management
- **Format**: Draw.io XML format for diagramming
- **Contains**: Flow diagrams showing status transitions, roles, and decisions

### HTTP Code Flow (`http://localhost:5174/?tab=customer_request_management`)
1. **URL Processing**: Parse `?tab=customer_request_management` parameter
2. **Tab Routing**: Set `activeTab` state to match URL parameter
3. **Permission Check**: Verify user has access to this tab via `canAccessTab()`
4. **Data Loading**:
   - Critical: `supportServiceGroups` (immediate)
   - Deferred: `customers`, `employees`, `customerPersonnel` (100ms+)
5. **Component Rendering**: Mount `CustomerRequestManagementHub` with all sub-components
6. **API Calls**: Multiple GET requests to `/api/v5/*` endpoints for data
7. **State Management**: Update Redux/Zustand stores with fetched data
8. **UI Interaction**: User can now filter, search, create, edit customer requests

### Performance Features
- **GET Deduplication**: Avoid sending identical requests
- **Deferred Loading**: Non-critical data loads after UI renders
- **Request Throttling**: Max 1 load per 600ms for same tab
- **Lazy Code Splitting**: Component bundled separately
- **Caching**: Master data cached for 15 minutes
