# Target Segments Tab - Implementation Plan

**Based on UI Exploration Report**
**Date:** March 30, 2026

---

## EXECUTIVE SUMMARY

You need to add a "Target Segments" tab to the **Product Form Modal**. This should follow the tabbed architecture of **ProjectFormModal** but modified for a simple flat table (not hierarchical).

### Key Decision:
- **Option A:** Add a "Target Segments" tab to ProductFormModal (like ProjectFormModal)
  - ✅ Consistent with system patterns
  - ✅ Better UX for managing related product segments
  - ✅ Reference: ProjectFormModal uses tabs successfully

- **Option B:** Create separate ProductTargetSegmentsModal (like ProductFeatureCatalogModal)
  - ✅ Keeps ProductFormModal focused
  - ✅ Similar to ProductFeatureCatalogModal pattern
  - ⚠️ Requires additional modal management in App.tsx

**RECOMMENDATION:** Option A - Add tab to ProductFormModal (cleaner, more integrated)

---

## IMPLEMENTATION ARCHITECTURE

### Current ProductFormModal Structure:
```
ProductFormModal (no tabs currently)
├── Section: Phân loại (Classification)
├── Section: Thông tin sản phẩm (Product Info)
├── Section: Thông tin kinh doanh (Business Info)
└── Section: Bổ sung (Additional Info)
```

### Proposed ProductFormModal Structure (with tabs):
```
ProductFormModal (REFACTORED WITH TABS)
├── Tab Navigation Bar
│   ├── "Thông tin chung" (Info Tab)
│   ├── "Phân khúc thị trường" (Target Segments Tab)
│   └── (Disable 2nd tab until product saved, like ProjectFormModal)
├── Content Area (conditional)
│   ├── [Tab: Info] ProductFormInfoTab
│   │   ├── Section: Phân loại
│   │   ├── Section: Thông tin sản phẩm
│   │   ├── Section: Thông tin kinh doanh
│   │   └── Section: Bổ sung
│   └── [Tab: Segments] ProductFormSegmentsTab
│       └── Inline Table Editor
│           ├── Add row button
│           ├── Columns: [Name, Description, Priority, Action]
│           └── Delete row buttons
└── Footer: Cancel / Save buttons
```

---

## STEP 1: CREATE NEW TYPES

**File:** `/frontend/types/product.ts`

Add after existing Product types:

```typescript
export type TargetSegmentStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductTargetSegment {
  id: string | number;
  uuid?: string | null;
  product_id: string | number;
  segment_name: string;
  segment_description?: string | null;
  segment_priority?: number | null;
  status: TargetSegmentStatus;
  display_order: number;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  created_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
  updated_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
}

// Extend Product interface to include target_segments
// Either as nested field or managed separately depending on backend API
```

---

## STEP 2: REFACTOR ProductFormModal

**File:** `/frontend/components/modals/ProductFormModal.tsx`

### 2A. Create ProductFormInfoTab Component

Extract current ProductFormModal content into new tab component:

```typescript
interface ProductFormInfoTabProps {
  type: 'ADD' | 'EDIT';
  data?: Product | null;
  errors: ProductFormErrors;
  formData: Partial<Product>;
  businesses: Business[];
  vendors: Vendor[];
  onFieldChange: (field: ProductFormField, value: any) => void;
  onFieldError: (field: ProductFormField) => void;
  // ... other props needed
}

export const ProductFormInfoTab: React.FC<ProductFormInfoTabProps> = ({
  // ... render the 4 sections
});
```

### 2B. Update ProductFormModal Main Component

```typescript
// Add new active tab state
const [activeTab, setActiveTab] = useState<'info' | 'segments'>('info');

// Add state for target segments
const [targetSegments, setTargetSegments] = useState<Array<Partial<ProductTargetSegment>>>([]);

// Add handlers for target segments
const handleAddTargetSegment = () => {
  const newSegment: Partial<ProductTargetSegment> = {
    id: `new-${Date.now()}`,
    segment_name: '',
    segment_description: '',
    segment_priority: 1,
    status: 'ACTIVE',
    display_order: (targetSegments.length || 0) + 1,
  };
  setTargetSegments((prev) => [...prev, newSegment]);
};

const handleUpdateSegment = (segmentId: string | number, field: keyof ProductTargetSegment, value: any) => {
  setTargetSegments((prev) =>
    prev.map((seg) => (String(seg.id) === String(segmentId) ? { ...seg, [field]: value } : seg))
  );
};

const handleRemoveSegment = (segmentId: string | number) => {
  setTargetSegments((prev) => prev.filter((seg) => String(seg.id) !== String(segmentId)));
};

// When saving product:
const handleSubmit = async () => {
  // Validate product form
  const validationErrors = validateProductForm(formData);
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    // ... focus on error
    return;
  }

  setIsSubmitting(true);
  try {
    // Save main product
    const productData = await onSave({
      ...formData,
      service_group: normalizeProductServiceGroup(formData.service_group),
    });
    
    // Save target segments if any
    if (targetSegments.length > 0) {
      await saveProductTargetSegments(productData.id, targetSegments);
    }
    
    setModalType(null);
  } finally {
    setIsSubmitting(false);
  }
};

// In JSX, replace current render with layout pattern:
return (
  <ProductFormLayout
    activeTab={activeTab}
    isPersistedProduct={type === 'EDIT' && Boolean(data?.id)}
    content={
      activeTab === 'info' ? (
        <ProductFormInfoTab {...infoTabProps} />
      ) : (
        <ProductFormSegmentsTab
          segments={targetSegments}
          onAddSegment={handleAddTargetSegment}
          onUpdateSegment={handleUpdateSegment}
          onRemoveSegment={handleRemoveSegment}
        />
      )
    }
    onTabSwitch={setActiveTab}
    onClose={onClose}
    onSubmit={handleSubmit}
    type={type}
  />
);
```

---

## STEP 3: CREATE ProductFormSegmentsTab

**File:** `/frontend/components/modals/ProductFormSegmentsTab.tsx` (NEW)

```typescript
import React from 'react';
import type { ProductTargetSegment, TargetSegmentStatus } from '../../types/product';

interface ProductFormSegmentsTabProps {
  segments: Array<Partial<ProductTargetSegment>>;
  onAddSegment: () => void;
  onUpdateSegment: (segmentId: string | number, field: keyof ProductTargetSegment, value: any) => void;
  onRemoveSegment: (segmentId: string | number) => void;
}

const SEGMENT_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Tạm ngưng' },
];

export const ProductFormSegmentsTab: React.FC<ProductFormSegmentsTabProps> = ({
  segments,
  onAddSegment,
  onUpdateSegment,
  onRemoveSegment,
}) => {
  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-slate-700">Danh sách phân khúc thị trường</h3>
        <button
          onClick={onAddSegment}
          className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 font-medium"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Thêm phân khúc
        </button>
      </div>

      {/* Inline Table Editor */}
      <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 overflow-visible">
        <table className="w-full table-fixed text-left bg-white rounded-lg shadow-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[25%]">Tên phân khúc</th>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[40%]">Mô tả</th>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[15%] text-center">Độ ưu tiên</th>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[12%] text-center">Trạng thái</th>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[8%] text-center">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {segments.length > 0 ? (
              segments.map((segment) => (
                <tr key={segment.id} className="hover:bg-slate-50">
                  {/* Segment Name */}
                  <td className="p-2">
                    <input
                      type="text"
                      className="w-full text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm"
                      value={segment.segment_name || ''}
                      onChange={(e) => onUpdateSegment(segment.id!, 'segment_name', e.target.value)}
                      placeholder="Ví dụ: Phân khúc cao cấp"
                    />
                  </td>

                  {/* Description */}
                  <td className="p-2">
                    <input
                      type="text"
                      className="w-full text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm"
                      value={segment.segment_description || ''}
                      onChange={(e) => onUpdateSegment(segment.id!, 'segment_description', e.target.value)}
                      placeholder="Mô tả phân khúc"
                    />
                  </td>

                  {/* Priority */}
                  <td className="p-2">
                    <input
                      type="number"
                      min="1"
                      max="999"
                      className="w-full text-sm border border-slate-300 rounded-md text-center focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm"
                      value={segment.segment_priority || 1}
                      onChange={(e) => onUpdateSegment(segment.id!, 'segment_priority', parseInt(e.target.value) || 1)}
                    />
                  </td>

                  {/* Status */}
                  <td className="p-2">
                    <select
                      className="w-full text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm"
                      value={segment.status || 'ACTIVE'}
                      onChange={(e) => onUpdateSegment(segment.id!, 'status', e.target.value as TargetSegmentStatus)}
                    >
                      {SEGMENT_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Delete Button */}
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveSegment(segment.id!)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-500 text-sm">
                  Chưa có phân khúc nào. Hãy bấm "Thêm phân khúc" để tạo mới.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

## STEP 4: CREATE ProductFormLayout

**File:** `/frontend/components/modals/ProductFormLayout.tsx` (NEW - similar to ProjectFormLayout)

```typescript
import React from 'react';
import { ModalWrapper } from './shared';

interface ProductFormLayoutProps {
  activeTab: 'info' | 'segments';
  isPersistedProduct: boolean;
  content: React.ReactNode;
  onTabSwitch: (tab: 'info' | 'segments') => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  type: 'ADD' | 'EDIT';
  disableClose?: boolean;
  isSubmitting?: boolean;
}

export const ProductFormLayout: React.FC<ProductFormLayoutProps> = ({
  activeTab,
  isPersistedProduct,
  content,
  onTabSwitch,
  onClose,
  onSubmit,
  type,
  disableClose = false,
  isSubmitting = false,
}) => {
  return (
    <ModalWrapper
      onClose={onClose}
      title={type === 'ADD' ? 'Thêm sản phẩm' : 'Cập nhật sản phẩm'}
      icon="inventory_2"
      width="max-w-6xl"
      disableClose={disableClose || isSubmitting}
    >
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'info'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => onTabSwitch('info')}
        >
          Thông tin chung
        </button>
        <button
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            !isPersistedProduct && activeTab !== 'segments'
              ? 'border-transparent text-slate-400 cursor-not-allowed'
              : activeTab === 'segments'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => onTabSwitch('segments')}
          disabled={!isPersistedProduct}
        >
          Phân khúc thị trường
        </button>
      </div>

      {/* Prerequisite Notice */}
      {!isPersistedProduct && (
        <div className="px-6 py-2 border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
          Lưu sản phẩm thành công để mở tab Phân khúc thị trường.
        </div>
      )}

      {/* Content */}
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
        {content}
        <div className="pb-24"></div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-100 transition-colors"
        >
          Hủy
        </button>
        <button
          onClick={() => void onSubmit()}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-deep-teal transition-colors"
        >
          <span className={`material-symbols-outlined text-lg ${isSubmitting ? 'animate-spin' : ''}`}>
            {isSubmitting ? 'progress_activity' : 'check'}
          </span>
          {isSubmitting ? 'Đang lưu...' : type === 'ADD' ? 'Thêm sản phẩm' : 'Lưu thay đổi'}
        </button>
      </div>
    </ModalWrapper>
  );
};
```

---

## STEP 5: UPDATE App.tsx

**Key locations to update:**

### 5A. Add modal state for target segments:
```typescript
const [productTargetSegments, setProductTargetSegments] = useState<Array<Partial<ProductTargetSegment>>>([]);
```

### 5B. Add API call handler:
```typescript
const handleSaveProductTargetSegments = React.useCallback(async (productId: string | number, segments: Array<Partial<ProductTargetSegment>>) => {
  try {
    // Call API to save target segments
    await saveProductTargetSegments(productId, segments);
    addToast('success', 'Phân khúc thị trường', 'Đã cập nhật phân khúc thị trường sản phẩm.');
  } catch (error) {
    addToast('error', 'Phân khúc thị trường', 'Lỗi cập nhật phân khúc thị trường.');
    throw error;
  }
}, [addToast]);
```

### 5C. Update ProductFormModal rendering:
```typescript
{modalType === 'EDIT_PRODUCT' && <ProductFormModal 
  type="EDIT" 
  data={selectedProduct} 
  businesses={businesses} 
  vendors={vendors} 
  onClose={() => setModalType(null)} 
  onSave={handleEditProductSave}
  initialTargetSegments={productTargetSegments}
  onSaveTargetSegments={handleSaveProductTargetSegments}
/>}
```

---

## STEP 6: UPDATE ProductFormModal SIGNATURE

**Updated Props Interface:**

```typescript
export interface ProductFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Product | null;
  businesses: Business[];
  vendors: Vendor[];
  onClose: () => void;
  onSave: (data: Partial<Product>) => Promise<void>;
  initialTargetSegments?: Array<Partial<ProductTargetSegment>>;
  onSaveTargetSegments?: (productId: string | number, segments: Array<Partial<ProductTargetSegment>>) => Promise<void>;
}
```

---

## FILE ORGANIZATION SUMMARY

### New Files to Create:
1. **ProductFormSegmentsTab.tsx** - `/frontend/components/modals/ProductFormSegmentsTab.tsx`
2. **ProductFormLayout.tsx** - `/frontend/components/modals/ProductFormLayout.tsx`
3. **ProductFormInfoTab.tsx** - `/frontend/components/modals/ProductFormInfoTab.tsx` (extracted from ProductFormModal)

### Files to Refactor:
1. **ProductFormModal.tsx** - Add tab state + segments management
2. **App.tsx** - Add segment state + handlers
3. **product.ts** - Add ProductTargetSegment types

### Files to Reference (NO CHANGES):
- ModalWrapper (reuse as-is)
- ProjectFormModal (reference pattern)
- ProjectFormLayout (reference pattern)
- ProjectTabs (reference pattern)

---

## VALIDATION REQUIREMENTS

### ProductTargetSegment Validation:
```typescript
export type ProductSegmentFormField = 'segment_name' | 'segment_description' | 'segment_priority';

type ProductSegmentFormErrors = Partial<Record<ProductSegmentFormField, string>>;

export const validateProductSegment = (segment: Partial<ProductTargetSegment>): ProductSegmentFormErrors => {
  const errors: ProductSegmentFormErrors = {};
  
  const name = String(segment.segment_name ?? '').trim();
  if (!name) {
    errors.segment_name = 'Vui lòng nhập tên phân khúc.';
  } else if (name.length > 255) {
    errors.segment_name = 'Tên phân khúc không được vượt quá 255 ký tự.';
  }
  
  const description = String(segment.segment_description ?? '').trim();
  if (description.length > 500) {
    errors.segment_description = 'Mô tả không được vượt quá 500 ký tự.';
  }
  
  const priority = Number(segment.segment_priority ?? 1);
  if (!Number.isFinite(priority) || priority < 1 || priority > 999) {
    errors.segment_priority = 'Độ ưu tiên phải từ 1 đến 999.';
  }
  
  return errors;
};
```

---

## API INTEGRATION POINTS

### Assumed Backend Endpoints:
```
POST   /api/v5/products/{productId}/target-segments
       - Create/update all target segments for a product
       - Body: { segments: ProductTargetSegment[] }

GET    /api/v5/products/{productId}/target-segments
       - Fetch all target segments for a product

DELETE /api/v5/products/{productId}/target-segments/{segmentId}
       - Delete a single target segment
```

### Frontend Service Integration:
```typescript
// services/v5Api.ts (add these functions)

export async function fetchProductTargetSegments(productId: string | number): Promise<ProductTargetSegment[]> {
  // GET /api/v5/products/{productId}/target-segments
}

export async function saveProductTargetSegments(productId: string | number, segments: Array<Partial<ProductTargetSegment>>): Promise<void> {
  // POST /api/v5/products/{productId}/target-segments
}

export async function deleteProductTargetSegment(productId: string | number, segmentId: string | number): Promise<void> {
  // DELETE /api/v5/products/{productId}/target-segments/{segmentId}
}
```

---

## UI/UX CONSIDERATIONS

### Tab Prerequisites:
- ✅ "Phân khúc thị trường" tab disabled until product is saved
- ✅ Show hint: "Lưu sản phẩm thành công để mở tab Phân khúc thị trường."
- ✅ Match ProjectFormModal pattern

### Inline Editing:
- ✅ Real-time input updates (no separate "edit" mode)
- ✅ Empty state: "Chưa có phân khúc nào. Hãy bấm 'Thêm phân khúc' để tạo mới."
- ✅ Add/Remove row buttons at top
- ✅ Delete button per row with hover effect

### Error Handling:
- ✅ Validate all segments before save
- ✅ Show field-level errors
- ✅ Scroll to first error
- ✅ Toast notification for errors

### Mobile Responsiveness:
- Table columns may need to reflow on small screens
- Consider horizontal scroll fallback
- Keep buttons accessible

---

## TESTING CHECKLIST

- [ ] Create product, cannot access segments tab
- [ ] Save product, segments tab becomes enabled
- [ ] Add segment row, verify form state
- [ ] Update segment fields, verify state updates
- [ ] Delete segment row, confirm removal
- [ ] Save product with segments, verify API call
- [ ] Reload product, verify segments persist
- [ ] Validation errors display correctly
- [ ] No segments state shows empty message
- [ ] Tab switching works smoothly
- [ ] ESC key closes modal (if not saving)
- [ ] Disable close button during save

---

## ROLLOUT PLAN

### Phase 1: Backend API (if needed)
- [ ] Create ProductTargetSegment migration/model
- [ ] Implement CRUD endpoints
- [ ] Add validation & authorization

### Phase 2: Frontend Component Development
- [ ] Create ProductFormSegmentsTab.tsx
- [ ] Create ProductFormLayout.tsx
- [ ] Refactor ProductFormModal.tsx
- [ ] Extract ProductFormInfoTab.tsx

### Phase 3: Integration
- [ ] Update App.tsx with handlers
- [ ] Update types/product.ts
- [ ] Add service functions to v5Api.ts
- [ ] Update lazy imports

### Phase 4: Testing & Polish
- [ ] Unit tests for components
- [ ] E2E tests for full flow
- [ ] Cross-browser testing
- [ ] Performance optimization

---

## REFERENCE PATTERNS USED

| Pattern | Reference Component | Usage |
|---------|---------------------|-------|
| Tab Navigation | ProjectFormLayout | Tab buttons + active styling |
| Tab Prerequisites | ProjectFormModal | Can't edit items until parent saved |
| Inline Table Editing | ProjectItemsTab | Add/Update/Delete rows |
| Modal State Management | App.tsx | Modal type + selected entity |
| Form Validation | ProductFormModal | Type-safe field validation |
| Layout Structure | ModalWrapper | Modal container |

---

## SUCCESS CRITERIA

✅ Product form has two tabs: "Thông tin chung" and "Phân khúc thị trường"
✅ Target segments tab is disabled until product is saved
✅ Can add/edit/delete segments in inline table
✅ All segments saved when product is saved
✅ Consistent with existing ProjectFormModal UI pattern
✅ Full keyboard support (Tab, Enter, Escape)
✅ Mobile responsive
✅ Proper error handling + validation
✅ Toast notifications for success/errors

