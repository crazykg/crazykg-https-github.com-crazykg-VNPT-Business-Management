# Product-Customer Configuration Dashboard - Implementation Guide

## Quick Start Implementation

This guide provides a step-by-step template to build the "Product-Customer Configuration Dashboard" using the established patterns.

---

## STEP 1: Create the Main Hub Component

**File**: `frontend/components/ProductCustomerConfigDashboard.tsx`

```typescript
import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { Product, Customer } from '../types';
import { queryClient } from '../shared/queryClient';
import { queryKeys } from '../shared/queryKeys';
import {
  fetchProductCustomerMatrix,
  fetchProductCustomerDetails,
} from '../services/v5Api';

// Import sub-views
import { ProductCustomerMatrixView } from './product-customer-config/ProductCustomerMatrixView';
import { ProductCustomerDetailView } from './product-customer-config/ProductCustomerDetailView';
import { ProductCustomerReportView } from './product-customer-config/ProductCustomerReportView';

type SubView = 'MATRIX' | 'DETAILS' | 'REPORTS';

interface Props {
  products: Product[];
  customers: Customer[];
  canRead: boolean;
  canWrite: boolean;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
}

const SUB_NAV_ITEMS = [
  { id: 'MATRIX' as const, icon: 'grid_view', label: 'Ma trận SP-KH' },
  { id: 'DETAILS' as const, icon: 'list', label: 'Chi tiết' },
  { id: 'REPORTS' as const, icon: 'bar_chart', label: 'Báo cáo' },
];

export function ProductCustomerConfigDashboard({
  products,
  customers,
  canRead,
  canWrite,
  onNotify,
}: Props) {
  const [activeView, setActiveView] = useState<SubView>('MATRIX');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300">lock</span>
          <p className="mt-2 text-sm">
            Bạn không có quyền xem Cấu hình Sản phẩm - Khách hàng.
          </p>
        </div>
      </div>
    );
  }

  const handleViewChange = useCallback((view: SubView) => {
    setActiveView(view);
  }, []);

  const handlePrefetchView = useCallback((view: SubView) => {
    if (view === 'MATRIX') {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.productCustomerConfig?.matrix?.() ?? ['product_customer_config', 'matrix'],
        queryFn: () => fetchProductCustomerMatrix({}),
        staleTime: 60_000,
      });
    }
  }, []);

  const activeViewNode = useMemo(() => {
    if (activeView === 'MATRIX') {
      return (
        <ProductCustomerMatrixView
          products={products}
          customers={customers}
          canWrite={canWrite}
          onNotify={onNotify}
        />
      );
    }

    if (activeView === 'DETAILS') {
      return (
        <ProductCustomerDetailView
          products={products}
          customers={customers}
          selectedProductId={selectedProductId}
          selectedCustomerId={selectedCustomerId}
          onSelectProduct={setSelectedProductId}
          onSelectCustomer={setSelectedCustomerId}
          canWrite={canWrite}
          onNotify={onNotify}
        />
      );
    }

    return (
      <ProductCustomerReportView
        products={products}
        customers={customers}
        onNotify={onNotify}
      />
    );
  }, [activeView, products, customers, selectedProductId, selectedCustomerId, canWrite, onNotify]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sub-navigation */}
      <div className="flex-none border-b border-gray-200 bg-white">
        <div className="flex items-center px-4 gap-1 overflow-x-auto">
          {SUB_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleViewChange(item.id)}
              onMouseEnter={() => handlePrefetchView(item.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeView === item.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
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

---

## STEP 2: Create Sub-view Components

### 2.1 Matrix View (product-customer-config/ProductCustomerMatrixView.tsx)

```typescript
import React, { useState, useMemo } from 'react';
import { Product, Customer } from '../../types';

interface Props {
  products: Product[];
  customers: Customer[];
  canWrite: boolean;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
}

export const ProductCustomerMatrixView: React.FC<Props> = ({
  products,
  customers,
  canWrite,
  onNotify,
}) => {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  // Build matrix data
  const matrixData = useMemo(() => {
    return products.map((product) => ({
      productId: product.id,
      productCode: product.product_code,
      productName: product.product_name,
      customers: customers.map((customer) => ({
        customerId: customer.id,
        customerName: customer.customer_name,
        // Fetch config data from API
        isConfigured: true, // TODO: fetch from config data
        lastUpdated: null, // TODO: fetch timestamp
      })),
    }));
  }, [products, customers]);

  const toggleCell = (productId: string, customerId: string) => {
    if (!canWrite) return;
    
    const cellKey = `${productId}-${customerId}`;
    const newSelected = new Set(selectedCells);
    if (newSelected.has(cellKey)) {
      newSelected.delete(cellKey);
    } else {
      newSelected.add(cellKey);
    }
    setSelectedCells(newSelected);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-200 px-4 py-2 text-left font-semibold">
                Sản phẩm
              </th>
              {customers.map((customer) => (
                <th
                  key={customer.id}
                  className="border border-gray-200 px-4 py-2 text-center font-semibold whitespace-nowrap"
                >
                  {customer.customer_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixData.map((row) => (
              <tr key={row.productId} className="hover:bg-gray-50">
                <td className="border border-gray-200 px-4 py-2 font-semibold">
                  {row.productCode} - {row.productName}
                </td>
                {row.customers.map((cell) => {
                  const cellKey = `${row.productId}-${cell.customerId}`;
                  const isSelected = selectedCells.has(cellKey);
                  return (
                    <td
                      key={cell.customerId}
                      className="border border-gray-200 px-4 py-2 text-center"
                    >
                      <button
                        onClick={() => toggleCell(row.productId, cell.customerId)}
                        disabled={!canWrite}
                        className={`w-8 h-8 rounded transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        } ${!canWrite ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      >
                        {isSelected && (
                          <span className="material-symbols-outlined text-sm">check</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      {canWrite && (
        <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              // Save configuration
              onNotify('success', 'Cấu hình', 'Lưu cấu hình thành công');
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Lưu cấu hình
          </button>
        </div>
      )}
    </div>
  );
};
```

### 2.2 Detail View (product-customer-config/ProductCustomerDetailView.tsx)

```typescript
import React from 'react';
import { Product, Customer } from '../../types';

interface Props {
  products: Product[];
  customers: Customer[];
  selectedProductId: string | null;
  selectedCustomerId: string | null;
  onSelectProduct: (id: string | null) => void;
  onSelectCustomer: (id: string | null) => void;
  canWrite: boolean;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
}

export const ProductCustomerDetailView: React.FC<Props> = ({
  products,
  customers,
  selectedProductId,
  selectedCustomerId,
  onSelectProduct,
  onSelectCustomer,
  canWrite,
  onNotify,
}) => {
  const selectedProduct = products.find((p) => String(p.id) === selectedProductId);
  const selectedCustomer = customers.find((c) => String(c.id) === selectedCustomerId);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filters */}
      <div className="flex-none bg-white border-b border-gray-200 p-4 gap-4 flex">
        <select
          value={selectedProductId ?? ''}
          onChange={(e) => onSelectProduct(e.target.value || null)}
          className="border border-gray-300 rounded px-3 py-2"
        >
          <option value="">-- Chọn sản phẩm --</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.product_code} - {p.product_name}
            </option>
          ))}
        </select>

        <select
          value={selectedCustomerId ?? ''}
          onChange={(e) => onSelectCustomer(e.target.value || null)}
          className="border border-gray-300 rounded px-3 py-2"
        >
          <option value="">-- Chọn khách hàng --</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.customer_name}
            </option>
          ))}
        </select>
      </div>

      {/* Details */}
      <div className="flex-1 overflow-auto p-6">
        {selectedProduct && selectedCustomer ? (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <h3 className="font-semibold text-blue-900">
                Cấu hình: {selectedProduct.product_code} ↔ {selectedCustomer.customer_name}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Thông tin Sản phẩm</h4>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-gray-500">Mã:</dt>
                    <dd>{selectedProduct.product_code}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Tên:</dt>
                    <dd>{selectedProduct.product_name}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Gói cước:</dt>
                    <dd>{selectedProduct.package_name}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Thông tin Khách hàng</h4>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-gray-500">Tên:</dt>
                    <dd>{selectedCustomer.customer_name}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Mã KH:</dt>
                    <dd>{selectedCustomer.customer_code}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Email:</dt>
                    <dd>{selectedCustomer.email || '-'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {canWrite && (
              <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
                <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Sửa cấu hình
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            Chọn sản phẩm và khách hàng để xem chi tiết
          </div>
        )}
      </div>
    </div>
  );
};
```

### 2.3 Report View (product-customer-config/ProductCustomerReportView.tsx)

```typescript
import React, { useMemo } from 'react';
import { Product, Customer } from '../../types';

interface Props {
  products: Product[];
  customers: Customer[];
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
}

export const ProductCustomerReportView: React.FC<Props> = ({
  products,
  customers,
  onNotify,
}) => {
  const stats = useMemo(() => {
    const totalConfigs = products.length * customers.length;
    const configuredCount = Math.floor(totalConfigs * 0.65); // Placeholder
    const pendingCount = totalConfigs - configuredCount;

    return {
      totalConfigs,
      configuredCount,
      pendingCount,
      configuredPercentage: Math.round((configuredCount / totalConfigs) * 100),
    };
  }, [products, customers]);

  return (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Tổng cấu hình</div>
          <div className="text-2xl font-bold text-blue-900">{stats.totalConfigs}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Đã cấu hình</div>
          <div className="text-2xl font-bold text-green-900">{stats.configuredCount}</div>
          <div className="text-xs text-green-700">{stats.configuredPercentage}%</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Chưa cấu hình</div>
          <div className="text-2xl font-bold text-yellow-900">{stats.pendingCount}</div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Top sản phẩm được cấu hình nhiều</h3>
        <div className="space-y-2">
          {products.slice(0, 5).map((product) => (
            <div key={product.id} className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">{product.product_code} - {product.product_name}</span>
              <div className="w-24 bg-gray-200 rounded h-2">
                <div className="bg-blue-600 h-2 rounded" style={{ width: '70%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

---

## STEP 3: Update AppPages.tsx

Add lazy import at top:

```typescript
const ProductCustomerConfigDashboard = lazy(() =>
  import('./components/ProductCustomerConfigDashboard').then((module) => ({ 
    default: module.ProductCustomerConfigDashboard 
  }))
);
```

Add conditional rendering in return:

```typescript
{activeTab === 'product_customer_config' && (
  <ProductCustomerConfigDashboard
    products={products}
    customers={customers}
    canRead={hasPermission(authUser, 'product_customer_config.read')}
    canWrite={hasPermission(authUser, 'product_customer_config.write')}
    onNotify={addToast}
  />
)}
```

---

## STEP 4: Update authorization.ts

```typescript
const TAB_PERMISSION_MAP: Record<string, string | null> = {
  // ... existing entries
  product_customer_config: 'product_customer_config.read',
};

const MODAL_PERMISSION_MAP = {
  // ... existing entries
  EDIT_PRODUCT_CUSTOMER_CONFIG: 'product_customer_config.write',
};

const IMPORT_PERMISSION_BY_MODULE = {
  // ... existing entries
  product_customer_config: 'product_customer_config.import',
};
```

---

## STEP 5: Update Sidebar.tsx

Add to finance or util group:

```typescript
{
  id: 'finance',
  label: 'Tài chính & Doanh thu',
  icon: 'payments',
  items: [
    { id: 'revenue_mgmt', icon: 'bar_chart', label: 'Quản trị Doanh thu' },
    { id: 'fee_collection', icon: 'receipt_long', label: 'Thu cước' },
    // ADD THIS:
    { id: 'product_customer_config', icon: 'settings', label: 'Cấu hình SP-KH' },
  ]
}
```

---

## STEP 6: Update API Hooks (if needed)

**File**: `frontend/shared/hooks/useProductCustomerConfig.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export function useProductCustomerMatrix(filters?: any) {
  return useQuery({
    queryKey: queryKeys.productCustomerConfig?.matrix?.(filters) ?? ['product_customer_config', 'matrix'],
    queryFn: () => fetchProductCustomerMatrix(filters),
    staleTime: 60_000,
  });
}

export function useProductCustomerDetail(productId: string, customerId: string) {
  return useQuery({
    queryKey: queryKeys.productCustomerConfig?.detail?.(productId, customerId) ?? 
      ['product_customer_config', productId, customerId],
    queryFn: () => fetchProductCustomerDetail(productId, customerId),
    enabled: !!productId && !!customerId,
  });
}

export function useUpdateProductCustomerConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: any) => updateProductCustomerConfig(config),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.productCustomerConfig?.all?.() ?? ['product_customer_config'],
      });
    },
  });
}
```

---

## STEP 7: Testing Checklist

- [ ] Sidebar shows "Cấu hình SP-KH" menu item
- [ ] Clicking opens dashboard without permission error
- [ ] All three sub-views load correctly
- [ ] Tab switching works smoothly
- [ ] Matrix view cells are clickable (if canWrite)
- [ ] Detail view filters work
- [ ] Report view displays stats
- [ ] URL persists state on refresh
- [ ] Authorization gates work (lock icon if no permission)
- [ ] Responsive on mobile (sidebar collapse)

---

## STEP 8: Styling Guidelines

Use existing patterns:
- **Colors**: Primary `blue-600`, Success `green-600`, Warning `yellow-600`, Danger `red-600`
- **Spacing**: `p-4`, `p-6`, gap-2/3/4 for spacing
- **Hover**: `hover:bg-gray-100`, `hover:text-gray-900`
- **Borders**: `border-gray-200`, `border-b-2` for active states
- **Text**: `text-sm` for labels, `text-lg` for headings

---

## Files to Create/Modify

| File | Action | Priority |
|------|--------|----------|
| `ProductCustomerConfigDashboard.tsx` | Create | HIGH |
| `product-customer-config/ProductCustomerMatrixView.tsx` | Create | HIGH |
| `product-customer-config/ProductCustomerDetailView.tsx` | Create | HIGH |
| `product-customer-config/ProductCustomerReportView.tsx` | Create | HIGH |
| `AppPages.tsx` | Modify | HIGH |
| `authorization.ts` | Modify | HIGH |
| `Sidebar.tsx` | Modify | HIGH |
| `shared/hooks/useProductCustomerConfig.ts` | Create | MEDIUM |
| `shared/stores/productCustomerConfigStore.ts` | Create | LOW (optional) |
| Backend: New permission | Implement | HIGH |

---

**Template Version**: 1.0  
**Status**: Ready to implement  
**Estimated Time**: 2-4 hours

