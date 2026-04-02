# Code Base Hệ Thống - Tài liệu Tổng quan

**Cập nhật**: 2026-03-27

## Quick Metrics

| Category | Count |
|----------|-------|
| Backend Services | 78 files |
| Frontend Components | 109 TSX files |
| Backend Tests | 49 tests |
| Frontend Tests | 49 tests |
| E2E Tests | 7 specs |
| Plan Documents | 40 files |
| Skills | 13 skills |

## Mục lục

1. [Tổng quan Kiến trúc](#tổng-quan-kiến-trúc)
2. [Backend Services](#backend-services)
3. [Frontend Components](#frontend-components)
4. [Database](#database)
5. [Testing](#testing)
6. [Skills](#skills)
7. [Recent Scan](#recent-scan)

---

## Tổng quan Kiến trúc

### Monorepo Structure

```
QLCV/
├── frontend/          -> React + Vite + TypeScript
├── backend/           -> Laravel API
├── perf/              -> Load testing
├── plan-code/         -> Architecture plans
├── docs/              -> Documentation
└── skills/ -> Repo skills
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React ^19.2.4, Vite ^6.2.0, TypeScript ~5.8.2, TailwindCSS ^3.4.19 |
| State | Zustand ^5.0.12 |
| Backend | Laravel ^12.0, PHP ^8.2, Sanctum ^4.0 |
| Testing | Vitest ^2.1.9, Playwright ^1.58.2, PHPUnit ^11.5.3 |

## Backend Services

- Service directories (13): Compatibility, Contract, CustomerRequest, Document, Domain, FeeCollection, IntegrationSettings, Legacy, ProjectProcedure, Revenue, Support, SupportConfig, Workflow
- PHP service files: 78
- Latest migrations:
- `2026_03_25_150000_add_healthcare_classification_to_customers_table.php`
- `2026_03_25_160000_create_product_feature_catalog_tables.php`
- `2026_03_25_200000_add_performance_indexes_to_fee_collection.php`
- `2026_03_25_210000_add_payment_cycle_and_estimated_value_to_projects.php`
- `2026_03_25_210100_create_project_revenue_schedules_table.php`

## Frontend Components

- Component groups (5): contract-revenue, customer-request, fee-collection, procedure, revenue-mgmt
- TSX component files: 109
- Shared stores (4): index, revenueStore, toastStore, uiStore
- Custom hooks (37): useAccessControl, useAppNavigation, useAuth, useBusinesses, useContracts, useCustomerPersonnel, useCustomerRequestAttachments, useCustomerRequestCreatorWorkspace, useCustomerRequestDashboard, useCustomerRequestDetail, useCustomerRequestDispatcherWorkspace, useCustomerRequestList, useCustomerRequestOptimisticState, useCustomerRequestPerformerWorkspace, useCustomerRequestQuickAccess, useCustomerRequestResponsiveLayout, useCustomerRequestSearch, useCustomerRequestTransition, useCustomers, useDatasetLoading, useDepartments, useDocuments, useEmployees, useEscKey, useFeedbacks, useImportDepartments, useImportEmployees, useIntegrationSettings, useModalManagement, usePageDataLoading, useProducts, useProjects, useReminders, useTabSession, useToastQueue, useUserDeptHistory, useVendors

## Database

- Backend migrations scanned: 168
- Latest migrations:
- `2026_03_25_150000_add_healthcare_classification_to_customers_table.php`
- `2026_03_25_160000_create_product_feature_catalog_tables.php`
- `2026_03_25_200000_add_performance_indexes_to_fee_collection.php`
- `2026_03_25_210000_add_payment_cycle_and_estimated_value_to_projects.php`
- `2026_03_25_210100_create_project_revenue_schedules_table.php`

## Testing

- Frontend unit tests: 49
- Frontend E2E specs: 7
- Backend PHP tests: 49

## Skills

- Repo skills (13): businesses, chuc-nang-moi, contracts, crc, customers, departments, employees, fee-collection, init-he-thong, products, projects, revenue-mgmt, support-master

## Recent Scan

- Last scan timestamp: 2026-03-27T10:16:35.032Z
- Change summary:
- Khong co thay doi dang ke so voi lan quet truoc.
