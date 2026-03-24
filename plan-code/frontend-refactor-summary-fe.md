# VNPT Business Frontend - Summary of Changes

## Session Date: 2026-03-23

---

## 1. Fix Flash/Blink Animation Issue (CHƯA THỰC HIỆN)

### Problem
- `animate-fade-in` CSS class gây ra hiện tượng flash/blinking khi chuyển tab
- Root cause: Animation được kích hoạt mỗi lần re-render với opacity 0→1

### Solution (Dự kiến)
Xóa class `animate-fade-in` khỏi header, stats, và content container divs trong tất cả list components.

### Files Cần Sửa (20 files):
| File | Changes |
|------|---------|
| `ReminderList.tsx` | Xóa khỏi header, filters, list grid |
| `EmployeeList.tsx` | Xóa khỏi header, content wrapper |
| `DepartmentList.tsx` | Xóa khỏi header, stats grid, content wrapper |
| `ProjectList.tsx` | Xóa khỏi header, KPI grid, content wrapper |
| `OpportunityList.tsx` | Xóa khỏi header, stats grid, content wrapper |
| `CustomerList.tsx` | Xóa khỏi header, stats, content wrapper |
| `CusPersonnelList.tsx` | Xóa khỏi header, stats grid, content wrapper |
| `DocumentList.tsx` | Xóa khỏi header, stats grid, content wrapper |
| `ContractList.tsx` | Xóa khỏi header, KPI grids (2), content wrapper, loading skeletons |
| `AuditLogList.tsx` | Xóa khỏi header, content wrapper |
| `UserDeptHistoryList.tsx` | Xóa khỏi main container |
| `SupportMasterManagement.tsx` | Xóa khỏi header |
| `IntegrationSettingsPanel.tsx` | Xóa khỏi header |
| `CustomerRequestManagementHub.tsx` | Xóa 6 instances (header, stats, sections, content, history, modal panel) |
| `BusinessList.tsx` | Xóa khỏi content wrapper |
| `ProductList.tsx` | Xóa khỏi content wrapper |
| `VendorList.tsx` | Xóa khỏi content wrapper |
| `Dashboard.tsx` | Xóa khỏi main container |
| `InternalUserDashboard.tsx` | Xóa khỏi main container |

### Sẽ Giữ Lại (Intentional)
- Dropdown menus (import/export buttons) - animation phù hợp cho menu appearance
- Modals (Modals.tsx, ContractModal.tsx) - animation phù hợp cho modal dialogs
- Sidebar navigation - animation phù hợp cho collapse/expand

### Kết Quả Mong Đợi
⏳ Chưa thực hiện
⏳ Chưa test

---

## 2. Migrate from Custom Tab Routing to react-router-dom v6 (CHƯA THỰC HIỆN)

### Problem
- Custom routing dùng `activeTab` state với conditional rendering
- Không có deep linking (không thể bookmark/share specific pages)
- Không hỗ trợ browser back/forward
- URL state không sync (filters/pagination lost on refresh)
- Poor scalability cho growing application

### Solution (Dự kiến)
Implement react-router-dom v6 với proper routing trong khi vẫn giữ existing data loading logic.

### Files Sẽ Tạo:
| File | Purpose |
|------|---------|
| `router/ProtectedRoute.tsx` | Auth guard component cho protected routes |
| `router/routes.tsx` | Route configuration (for future use) |
| `router/index.tsx` | Router exports |
| `components/Layout/AppLayout.tsx` | Layout shell với Sidebar |
| `AppWithRouter.tsx` | Main router wrapper với auth initialization |

### Files Sẽ Sửa:
| File | Changes |
|------|---------|
| `index.tsx` | Đổi từ `<App />` sang `<AppWithRouter />` |
| `App.tsx` | Thêm `useNavigate`, `useLocation` hooks; URL↔activeTab sync logic; `AppProps` interface |
| `package.json` | Thêm `react-router-dom` dependency |

### ⚠️ WARNING: Infinite Loop Issue (ĐÃ GẶP PHẢI)

**Lỗi đã xảy ra khi thực hiện:**
Khi implement bidirectional URL↔activeTab sync với 2 useEffects, đã gây ra infinite loop:
- useEffect 1: activeTab → URL (navigate khi activeTab thay đổi)
- useEffect 2: URL → activeTab (setActiveTab khi location.pathname thay đổi)

**Nguyên nhân:**
- Khi activeTab thay đổi → navigate() → location.pathname thay đổi → setActiveTab() → activeTab thay đổi → navigate() → ... (vòng lặp vô tận)
- Lỗi: `Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.`

**Giải pháp (ĐÃ ÁP DỤNG):**
Chỉ sử dụng **unidirectional sync** (URL → activeTab ONLY):
```typescript
// ✅ ĐÚNG - Chỉ sync từ URL vào activeTab
useEffect(() => {
  const tabFromPath = getTabIdFromPath(location.pathname);
  if (tabFromPath && tabFromPath !== activeTab) {
    setActiveTab(tabFromPath);
  }
}, [location.pathname, getTabIdFromPath]);
// ❌ SAI - Không sync activeTab → URL vì sẽ gây infinite loop
```

**Bài học rút ra:**
- KHÔNG bao giờ tạo bidirectional binding giữa state và URL trong cùng một component
- Nếu cần sync 2 chiều, phải có cơ chế prevent re-trigger (flag, ref, hoặc custom hook)
- Ưu tiên sync 1 chiều: URL → state (đủ cho most use cases)

---

### Key Implementation Details (ĐÃ THỰC HIỆN):

**App.tsx - URL Sync (Unidirectional Only):**
```typescript
// Map tab ID to URL path
const getRoutePathFromTabId = (tabId: string): string => {
  if (tabId === 'dashboard') return '/';
  if (tabId === 'user_dept_history') return '/user-dept-history';
  if (tabId === 'customer_request_management') return '/customer-request-management';
  // ... etc
  return `/${tabId.replace(/_/g, '-')}`;
};

// Map URL path back to tab ID
const getTabIdFromPath = useCallback((pathname: string): string | null => {
  const path = pathname.replace(/^\//, '') || 'dashboard';
  if (path === '') return 'dashboard';
  
  // Handle special cases
  const specialCases: Record<string, string> = {
    'user-dept-history': 'user_dept_history',
    'customer-request-management': 'customer_request_management',
    // ... etc
  };
  
  if (specialCases[path]) return specialCases[path];
  
  // Convert kebab-case back to snake_case
  const tabId = path.replace(/-/g, '_');
  return availableTabs.includes(tabId) ? tabId : 'dashboard';
}, [availableTabs]);

// ✅ Sync from URL to activeTab ONLY (unidirectional)
useEffect(() => {
  const tabFromPath = getTabIdFromPath(location.pathname);
  if (tabFromPath && tabFromPath !== activeTab) {
    setActiveTab(tabFromPath);
  }
}, [location.pathname, getTabIdFromPath]);
```

**AppWithRouter.tsx - Auth + Router:**
```typescript
const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const bootstrap = await fetchAuthBootstrap();
      if (bootstrap.user) {
        setUser(bootstrap.user);
      }
    };
    initAuth();
  }, []);

  return { user, isLoading, setUser };
};
```

### Kết Quả Mong Đợi
⏳ Chưa thực hiện
⏳ Chưa test

---

## 3. Refactor App.tsx - Reduce Size and Improve Maintainability (CHƯA THỰC HIỆN)

### Problem
- `App.tsx` was ~6700 lines, 668KB (minified)
- All logic in one file: auth, data loading, conditional rendering of 22+ pages
- Difficult to maintain and onboard new developers

### Solution (Dự kiến)
Separate page rendering logic into dedicated `AppPages.tsx` component.

### Files Sẽ Tạo:
| File | Purpose | Lines |
|------|---------|-------|
| `AppPages.tsx` | Contains all conditional rendering logic for pages | ~450 |

### Files Sẽ Sửa:
| File | Changes |
|------|---------|
| `App.tsx` | Remove ~270 lines of conditional rendering code; now uses `<AppPages />` component |

### Before vs After (Dự kiến):

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| App.tsx lines | ~6,700 | ~4,500 | -33% |
| App.tsx size (minified) | 668 KB | 479 KB | -28% |
| Total bundle size | Similar | Similar | Code organized better |

### App.tsx Will Contain:
- Auth state management
- Data loading functions (fetch, create, update, delete)
- Modal handlers
- Toast/notification system
- URL sync with router
- Password change flow
- Sidebar + main layout

### AppPages.tsx Will Contain:
- Pure conditional rendering logic
- Props interface with all required data and callbacks
- No state management
- No side effects

### Kết Quả Mong Đợi
⏳ Chưa thực hiện
⏳ Chưa test

---

## 4. Next Steps for Another Project/Session

### Phase 1: Migrate Data Loading to Route Loaders (Recommended)
**Goal**: Use react-router-dom v6.4+ loaders for data fetching

```typescript
// routes.ts
{
  path: 'customers',
  element: <CustomerList />,
  loader: async ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '10';
    const q = url.searchParams.get('q') || '';

    return fetchCustomersPage({ page: Number(page), per_page: Number(perPage), q });
  }
}
```

**Files to modify:**
- `App.tsx` - Remove data loading logic, use `useLoaderData()`
- `router/routes.tsx` - Add loaders to each route
- Each `*List.tsx` component - Update to use loader data

**Benefits:**
- Data loads before component renders
- No more loading states for initial load
- Better UX with pending states
- Leverages React Router's built-in features

---

### Phase 2: Extract Individual Pages (Optional)
**Goal**: Further reduce App.tsx by extracting each page's data loading

```typescript
// pages/CustomersPage.tsx
export const CustomersPage = () => {
  const { customers, meta, loading } = useCustomersData();
  return <CustomerList customers={customers} ... />;
};

// hooks/useCustomersData.ts
export const useCustomersData = () => {
  const [customers, setCustomers] = useState([]);
  // ... data loading logic
  return { customers, meta, loading };
};
```

**Files to create:**
- `hooks/useCustomersData.ts`
- `hooks/useEmployeesData.ts`
- `hooks/useProductsData.ts`
- ... etc for each resource
- `pages/CustomersPage.tsx`
- `pages/EmployeesPage.tsx`
- ... etc

**Benefits:**
- App.tsx reduces to ~500 lines
- Each page is self-contained
- Easier to test individual pages
- Better code splitting

---

### Phase 3: URL State Sync (Recommended)
**Goal**: Sync filters, sort, pagination to URL query params

```typescript
// In CustomerList.tsx
const [searchParams, setSearchParams] = useSearchParams();

const page = Number(searchParams.get('page') || '1');
const perPage = Number(searchParams.get('per_page') || '10');
const search = searchParams.get('q') || '';

// Update URL on change
const handleSearchChange = (newSearch: string) => {
  setSearchParams({ page: '1', per_page: String(perPage), q: newSearch });
};
```

**Files to modify:**
- Each `*List.tsx` component with server-side pagination
- `CustomerList.tsx`, `EmployeeList.tsx`, `ProjectList.tsx`, etc.

**Benefits:**
- Refresh preserves filter state
- Can bookmark specific filtered views
- Share URLs with specific search/sort/pagination

---

### Phase 4: Code Splitting Optimization
**Goal**: Reduce initial bundle size with better lazy loading

**Current state:**
- App.tsx: 479 KB (still large)
- Some chunks > 500 KB

**Recommendations:**
1. Lazy load modals
2. Lazy load heavy components (CustomerRequestManagementHub, SupportMasterManagement)
3. Use `build.rollupOptions.output.manualChunks` for better chunking

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-charts': ['recharts'], // if used
        }
      }
    }
  }
});
```

---

## 5. Commands Reference

### Development
```bash
cd frontend
npm run dev           # Vite dev server with proxy to backend:8002
npm run build         # Production build
npm run lint          # TypeScript type check
npm run test          # Vitest unit tests
```

### Testing Router Migration
```bash
# Start dev server
npm run dev

# Test in browser:
# 1. Navigate to different pages via sidebar
# 2. Check URL changes (/departments, /customers, etc.)
# 3. Test browser back/forward buttons
# 4. Refresh page - should preserve current page
# 5. Type direct URL - should navigate correctly
# 6. Test logout/login flow
```

### Troubleshooting
```bash
# If build fails with TypeScript errors
npm run lint

# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build

# Check bundle size
npm run build
# Review dist/ output for chunk sizes
```

---

## 6. Key Architecture Decisions

### Why Incremental Approach?
- Preserved existing data loading patterns (centralized in App.tsx)
- Minimal disruption to working code
- Can test each phase independently
- Easy to rollback if issues found

### Why Keep Conditional Rendering?
- App.tsx already manages all data centrally
- Avoids massive rewrite of 22+ page components
- Can migrate page-by-page later
- Router handles navigation, App handles data

### Why Not Full Migration?
- Time constraints
- Risk of breaking production
- Existing patterns work well for data loading
- Can refactor incrementally in future sessions

---

## 7. Files Summary

### Created Files (0 - CHƯA THỰC HIỆN):
```
frontend/
├── router/
│   ├── ProtectedRoute.tsx      # Auth guard - CHƯA TẠO
│   ├── routes.tsx              # Route config - CHƯA TẠO
│   └── index.tsx               # Router exports - CHƯA TẠO
├── components/
│   └── Layout/
│       └── AppLayout.tsx       # Layout shell - CHƯA TẠO
├── AppWithRouter.tsx           # Router wrapper - CHƯA TẠO
└── AppPages.tsx                # Page rendering logic - CHƯA TẠO
```

### Modified Files (0 - CHƯA THỰC HIỆN):
```
frontend/
├── index.tsx                   # Entry point - use AppWithRouter - CHƯA SỬA
├── package.json                # Added react-router-dom - CHƯA SỬA
├── App.tsx                     # URL sync, props interface - CHƯA SỬA
├── components/
│   ├── BusinessList.tsx        # Xóa animate-fade-in - CHƯA SỬA
│   ├── ContractList.tsx        # Xóa animate-fade-in - CHƯA SỬA
│   ├── CustomerList.tsx        # Xóa animate-fade-in - CHƯA SỬA
│   ├── CusPersonnelList.tsx    # Xóa animate-fade-in - CHƯA SỬA
│   ├── Dashboard.tsx           # Xóa animate-fade-in - CHƯA SỬA
│   ├── DepartmentList.tsx      # Xóa animate-fade-in - CHƯA SỬA
│   ├── DocumentList.tsx        # Xóa animate-fade-in - CHƯA SỬA
│   ├── EmployeeList.tsx        # Xóa animate-fade-in - CHƯA SỬA
│   ├── IntegrationSettingsPanel.tsx  # Xóa animate-fade-in - CHƯA SỬA
│   ├── InternalUserDashboard.tsx     # Xóa animate-fade-in - CHƯA SỬA
│   ├── OpportunityList.tsx     # Xóa animate-fade-in - CHƯA SỬA
│   ├── ProductList.tsx         # Xóa animate-fade-in - CHƯA SỬA
│   ├── ProjectList.tsx         # Xóa animate-fade-in - CHƯA SỬA
│   ├── ReminderList.tsx        # Xóa animate-fade-in - CHƯA SỬA
│   ├── SupportMasterManagement.tsx   # Xóa animate-fade-in - CHƯA SỬA
│   ├── UserDeptHistoryList.tsx       # Xóa animate-fade-in - CHƯA SỬA
│   ├── VendorList.tsx          # Xóa animate-fade-in - CHƯA SỬA
│   └── CustomerRequestManagementHub.tsx  # Xóa animate-fade-in - CHƯA SỬA
└── AuditLogList.tsx            # Xóa animate-fade-in - CHƯA SỬA
```

---

## 8. Testing Checklist

### Animation Fix
- [ ] Switch between all tabs - no flash/blinking
- [ ] Dropdowns still animate (import/export buttons)
- [ ] Modals still animate on open/close
- [ ] Sidebar collapse/expand animates smoothly

### Router Migration
- [ ] Sidebar navigation updates URL
- [ ] Direct URL navigation works
- [ ] Browser back/forward works
- [ ] Refresh preserves current page
- [ ] Login flow works
- [ ] Logout redirects to login
- [ ] Permission checks work (redirect if no access)

### Refactor
- [ ] All pages render correctly
- [ ] Data loads correctly
- [ ] Modals open/save work
- [ ] No console errors
- [ ] Build succeeds without errors

---

## 9. Performance Metrics

### Bundle Size (Dự kiến)
```
Before:
- App.tsx: 668 KB
- Total chunks: Similar

After (Khi hoàn thành):
- App.tsx: 479 KB (-28%)
- Total chunks: Similar organization
```

### Load Time (Dự kiến)
- Initial load: Similar (same amount of code, just organized differently)
- Tab switching: Faster (no animation overhead)
- Navigation: Same (client-side routing)

### Future Optimization Potential
- With route-based code splitting: -30-40% initial bundle
- With URL state sync: Better UX, no re-fetch on refresh
- With page extraction: Better maintainability

---

## 10. Notes for Next Developer

### Important Patterns to Preserve:
1. **Centralized data loading** - Currently in App.tsx, works well
2. **Prop drilling** - All data passed via props, no Redux/Zustand needed
3. **Server-side pagination** - Consistent pattern across list components
4. **Permission checks** - `hasPermission()` used consistently

### Areas to Avoid Breaking:
1. **Tab session management** - `useTabSession` hook handles single active tab
2. **Auth token refresh** - Auto-refresh on 401 in v5Api.ts
3. **Request deduplication** - `inFlightGetRequests` map prevents duplicate API calls
4. **Import/export logic** - Complex but working

### Good Candidates for Refactoring:
1. **Modal system** - Could extract to separate file
2. **Toast system** - Could use context instead of prop drilling
3. **Data loading** - Migrate to React Query or route loaders
4. **Form validation** - Could use React Hook Form

---

## Summary

This session - CÁC VIỆC CẦN LÀM (CHƯA THỰC HIỆN):

1. ⏳ Fix flash/blink animation issue across all 20+ list components - XÓA `animate-fade-in` CLASS
2. ⏳ Migrate from custom tab routing to react-router-dom v6 - TẠO ROUTER SYSTEM
3. ⏳ Refactor App.tsx, reducing size by 28% - TÁCH AppPages.tsx
4. ⏳ Preserve all existing functionality - CẦN TEST KỸ
5. ⏳ Create foundation for future improvements

**Thứ tự ưu tiên thực hiện:**
1. **Ưu tiên 1:** Fix animation flash - xóa `animate-fade-in` khỏi 20 files list components
2. **Ưu tiên 2:** Migrate sang react-router-dom v6 - tạo router system, sync URL
3. **Ưu tiên 3:** Refactor App.tsx - tách AppPages.tsx để giảm kích thước
4. **Sau đó:** Thực hiện các phase tiếp theo (route loaders, URL state sync, code splitting)

**Lưu ý quan trọng:**
- Avoid breaking auth/tab session logic
- Test thoroughly after mỗi thay đổi
- Backup code trước khi thực hiện
- Check build thành công sau mỗi bước
