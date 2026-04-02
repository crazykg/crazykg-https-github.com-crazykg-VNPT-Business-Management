# VNPT Business Management System - Product Management UI Exploration Report

**Date:** March 30, 2026
**Focus:** Understanding Product Management UI patterns for designing Target Segments config tab
**Project Path:** `/Users/pvro86gmail.com/Downloads/QLCV/`

---

## 1. PRODUCT MANAGEMENT COMPONENTS - FILE STRUCTURE

### Primary Files:
- **ProductList Component:** `/frontend/components/ProductList.tsx` (13,102 tokens)
  - Main product list/catalog view with table, pagination, filtering, sorting
  - Props interface: `ProductListProps`
  - Handles multiple views: 'catalog' | 'quote'

- **ProductFormModal:** `/frontend/components/modals/ProductFormModal.tsx` (681 lines)
  - Type: 'ADD' | 'EDIT'
  - Props: `ProductFormModalProps`
  - **No tabs** - flat form with 4 sections
  - Wrapped in ModalWrapper (max-w-5xl)

- **ProductFeatureCatalogModal:** `/frontend/components/ProductFeatureCatalogModal.tsx` (10,164 tokens)
  - **Sub-entity modal** - manages ProductFeatureGroup and ProductFeature
  - Handles hierarchical data (groups → features)
  - Includes audit logging
  - Supports import/export functionality
  - Pattern: Read-only product info + editable nested catalog

- **ProductQuotationTab:** `/frontend/components/ProductQuotationTab.tsx`
  - Alternative product view for quotations

- **ProductList Types:** `/frontend/types/product.ts`

---

## 2. PRODUCT DATA MODEL

### Product Interface:
```typescript
export interface Product {
  id: string | number;
  uuid?: string;
  service_group?: string | null;
  product_code: string;
  product_name: string;
  package_name?: string | null;
  domain_id: string | number;          // Business/Domain FK
  vendor_id: string | number;           // Vendor FK
  standard_price: number;
  unit?: string | null;
  description?: string | null;
  attachments?: Attachment[];
  is_active?: boolean;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}
```

### Related Type (for reference - target segments similar pattern):
```typescript
export interface ProductFeatureGroup {
  id: string | number;
  uuid?: string | null;
  product_id: string | number;
  group_name: string;
  display_order: number;
  notes?: string | null;
  features: ProductFeature[];              // Nested entities
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  created_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
  updated_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
}

export interface ProductFeature {
  id: string | number;
  uuid?: string | null;
  product_id: string | number;
  group_id: string | number;
  feature_name: string;
  detail_description?: string | null;
  status: ProductFeatureStatus;
  display_order: number;
  // ... audit fields
}
```

---

## 3. PRODUCTFORMMODAL - DETAILED UI STRUCTURE

### File Location:
`/frontend/components/modals/ProductFormModal.tsx`

### Props Interface:
```typescript
export interface ProductFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Product | null;
  businesses: Business[];
  vendors: Vendor[];
  onClose: () => void;
  onSave: (data: Partial<Product>) => Promise<void>;
}
```

### Form Structure (NO TABS):
```
ModalWrapper {
  title: "Thêm sản phẩm" | "Cập nhật sản phẩm"
  icon: "inventory_2"
  width: "max-w-5xl"
  
  Section 1: "Phân loại" (Classification)
    - Nhóm dịch vụ (Service Group) - SearchableSelect, required
    - Trạng thái (Status) - FormSelect (Active/Inactive)
  
  Section 2: "Thông tin sản phẩm" (Product Info)
    - Mã sản phẩm (Product Code) - FormInput, required
    - Tên sản phẩm (Product Name) - FormInput, required
    - Gói cước (Package Name) - FormInput, optional
  
  Section 3: "Thông tin kinh doanh" (Business Info)
    - Lĩnh vực kinh doanh (Business Domain) - SearchableSelect, required
    - Nhà cung cấp (Vendor) - SearchableSelect, required
    - Đơn vị tính (Unit) - SearchableSelect, optional
    - Giá tiêu chuẩn (Standard Price) - FormInput, Vietnamese currency format
  
  Section 4: "Bổ sung" (Additional Info)
    - Mô tả (Description) - textarea, max 2000 chars
    - AttachmentManager - file upload component

  Footer:
    - Cancel button
    - Save button (with spinner during submission)
}
```

### Key Implementation Details:

**Error Handling:**
```typescript
type ProductFormErrors = Partial<Record<ProductFormField, string>>;
const PRODUCT_FIELD_ORDER = [
  'service_group', 'product_code', 'product_name', 'package_name',
  'domain_id', 'vendor_id', 'unit', 'standard_price', 'description'
];
```

**Special Features:**
1. **Vietnamese Currency Formatting:**
   - `parseVietnameseCurrencyInput()` - converts "1.000,50" → 1000.50
   - `formatVietnameseCurrencyInput()` - reverses the process
   - `formatVietnameseAmountInWords()` - converts to text: "Một nghìn đông"

2. **Field-Focused Error Display:**
   - `focusField()` - scrolls to first error field
   - `data-product-field` attributes for targeting

3. **Attachment Management:**
   - Separate upload/delete handlers
   - Integration with `AttachmentManager` component
   - File persistence state

**State Management:**
```typescript
const [formData, setFormData] = useState<Partial<Product>>({
  service_group: normalizeProductServiceGroup(data?.service_group || DEFAULT_PRODUCT_SERVICE_GROUP),
  product_code: data?.product_code || '',
  product_name: data?.product_name || '',
  // ... all fields
  attachments: Array.isArray(data?.attachments) ? data.attachments : [],
  is_active: data?.is_active !== false,
});
const [errors, setErrors] = useState<ProductFormErrors>({});
const [isSubmitting, setIsSubmitting] = useState(false);
const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
```

---

## 4. PRODUCTFEATURECATALOGMODAL - SUB-ENTITY CRUD PATTERN

### File Location:
`/frontend/components/ProductFeatureCatalogModal.tsx` (partially read, ~100+ lines)

### This is the KEY REFERENCE for Target Segments pattern!

### Props Interface:
```typescript
interface ProductFeatureCatalogModalProps {
  product: Product;
  canManage?: boolean;
  onClose: () => void;
  onNotify?: NotifyFn;
}
```

### Key Features:
1. **Read-only product info** at top
2. **Hierarchical inline editing**: Groups → Features
3. **Audit logging** with actor information
4. **Import/Export** functionality
5. **Change summary tracking** (FORM vs IMPORT sources)
6. **Type-safe status handling** (ACTIVE/INACTIVE)
7. **Display order management** (for sorting)

### Important Types:
```typescript
type DraftFeature = {
  id: string | number;
  persistedId?: string | number | null;
  uuid?: string | null;
  feature_name: string;
  detail_description: string;
  status: ProductFeatureStatus;
  display_order: number;
  created_at?: string | null;
  created_by?: string | number | null;
  // ... audit tracking fields
};

type DraftGroup = {
  id: string | number;
  persistedId?: string | number | null;
  uuid?: string | null;
  group_name: string;
  notes: string;
  display_order: number;
  // ... audit tracking
  features: DraftFeature[];
};
```

---

## 5. APP.TSX - PRODUCT CRUD INTEGRATION

### File Location:
`/frontend/App.tsx`

### Modal Type Constants:
```typescript
const AVAILABLE_TABS = [
  'dashboard', 'internal_user_dashboard', ..., 
  'products', 'clients', ..., // Product-related modules
  ...
] as const;
```

### Product CRUD Handlers (lines 288-344):

**Create Handler:**
```typescript
const handleCreateProductSave = React.useCallback(async (data: Partial<Product>) => {
  setIsSaving(true);
  try {
    const created = await createProduct({
      ...data,
      service_group: normalizeProductServiceGroup(data.service_group || DEFAULT_PRODUCT_SERVICE_GROUP),
      unit: normalizeProductUnitForSave(data.unit),
    });
    setProducts((previous) => [created, ...(previous || [])]);
    setModalType(null);
  } finally {
    setIsSaving(false);
  }
}, []);
```

**Edit Handler:**
```typescript
const handleEditProductSave = React.useCallback(async (data: Partial<Product>) => {
  if (!selectedProduct) return;
  
  setIsSaving(true);
  try {
    const updated = await updateProduct(selectedProduct.id, {
      ...data,
      service_group: normalizeProductServiceGroup(data.service_group || DEFAULT_PRODUCT_SERVICE_GROUP),
      unit: normalizeProductUnitForSave(data.unit),
    });
    setProducts((previous) =>
      previous.map((product) => (String(product.id) === String(updated.id) ? updated : product))
    );
    setSelectedProduct(updated);
    setModalType(null);
  } finally {
    setIsSaving(false);
  }
}, [selectedProduct]);
```

**Delete Handler:**
```typescript
const handleDeleteProductConfirm = React.useCallback(async () => {
  if (!selectedProduct) return;
  
  try {
    await deleteProduct(selectedProduct.id);
    setProducts((previous) =>
      previous.filter((product) => String(product.id) !== String(selectedProduct.id))
    );
    setModalType(null);
  } catch (error) {
    if (isProductDeleteDependencyError(error)) {
      setProductDeleteDependencyMessage(error instanceof Error ? error.message : null);
      setModalType('CANNOT_DELETE_PRODUCT');
      return;
    }
    throw error;
  }
}, [selectedProduct]);
```

### Modal Rendering (line 1527-1531):
```typescript
{modalType === 'ADD_PRODUCT' && 
  <ProductFormModal 
    type="ADD" 
    data={null} 
    businesses={businesses} 
    vendors={vendors} 
    onClose={() => setModalType(null)} 
    onSave={handleCreateProductSave} 
  />}

{modalType === 'EDIT_PRODUCT' && 
  <ProductFormModal 
    type="EDIT" 
    data={selectedProduct} 
    businesses={businesses} 
    vendors={vendors} 
    onClose={() => setModalType(null)} 
    onSave={handleEditProductSave} 
  />}

{modalType === 'DELETE_PRODUCT' && selectedProduct && 
  <DeleteProductModal 
    data={selectedProduct} 
    onClose={() => setModalType(null)} 
    onConfirm={handleDeleteProductConfirm} 
  />}

{modalType === 'CANNOT_DELETE_PRODUCT' && selectedProduct && 
  <CannotDeleteProductModal 
    data={selectedProduct} 
    reason={productDeleteDependencyMessage} 
    onClose={() => setModalType(null)} 
  />}

{modalType === 'PRODUCT_FEATURE_CATALOG' && selectedProduct && 
  <ProductFeatureCatalogModal 
    product={selectedProduct} 
    canManage={hasPermission(authUser, 'products.write')} 
    onClose={() => setModalType(null)} 
    onNotify={addToast} 
  />}
```

---

## 6. TABBED MODAL PATTERN - ProjectFormModal Reference

### File Location:
`/frontend/components/modals/ProjectFormModal.tsx`

### Key Difference from ProductFormModal:
**ProjectFormModal HAS TABS** - perfect reference for Target Segments!

### Tab Structure:

**Type Definition:**
```typescript
export type ProjectFormActiveTab = 'info' | 'items' | 'raci' | 'revenue_schedules';
```

**State Management:**
```typescript
const [activeTab, setActiveTab] = useState<ProjectFormActiveTab>(initialTab);

const handleTabSwitch = (tab: ProjectFormActiveTab) => {
  // Validates requirements before switching
  // e.g., can't access 'items' tab until project saved
  if (!isPersistedProject && tab !== 'info') {
    setActiveTab('info');
    return;
  }
  setActiveTab(tab);
};
```

### Layout Component (ProjectFormLayout):
File: `/frontend/components/modals/ProjectFormSections.tsx` (lines 231-350)

**Tab Navigation HTML:**
```typescript
<div className="flex border-b border-slate-200">
  <button
    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors 
      ${activeTab === 'info' 
        ? 'border-primary text-primary' 
        : 'border-transparent text-slate-500 hover:text-slate-700'}`}
    onClick={() => onTabSwitch('info')}
  >
    Thông tin chung
  </button>
  
  <button
    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors 
      ${!isPersistedProject && activeTab !== 'items'
        ? 'border-transparent text-slate-400 cursor-not-allowed'
        : activeTab === 'items'
          ? 'border-primary text-primary'
          : 'border-transparent text-slate-500 hover:text-slate-700'}`}
    onClick={() => onTabSwitch('items')}
    disabled={!isPersistedProject}
  >
    Hạng mục dự án ({itemCount})
  </button>
  
  <button
    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors 
      ${!isPersistedProject && activeTab !== 'raci'
        ? 'border-transparent text-slate-400 cursor-not-allowed'
        : activeTab === 'raci'
          ? 'border-primary text-primary'
          : 'border-transparent text-slate-500 hover:text-slate-700'}`}
    onClick={() => onTabSwitch('raci')}
    disabled={!isPersistedProject}
  >
    Đội ngũ dự án ({raciCount})
  </button>
  
  <button
    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors 
      ${!isPersistedProject && activeTab !== 'revenue_schedules'
        ? 'border-transparent text-slate-400 cursor-not-allowed'
        : activeTab === 'revenue_schedules'
          ? 'border-primary text-primary'
          : 'border-transparent text-slate-500 hover:text-slate-700'}`}
    onClick={() => onTabSwitch('revenue_schedules')}
    disabled={!isPersistedProject}
  >
    Phân kỳ doanh thu
  </button>
</div>

{!isPersistedProject && (
  <div className="px-6 py-2 border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
    Lưu dự án thành công để mở tab Hạng mục dự án và Đội ngũ dự án.
  </div>
)}

<div className="p-6">
  {content}  {/* Conditional rendering based on activeTab */}
  <div className="pb-24"></div>
</div>
```

### Tab Content Rendering Pattern:
```typescript
const projectContent =
  activeTab === 'info' ? (
    <ProjectInfoTab {...props} />
  ) : activeTab === 'items' ? (
    <ProjectItemsTab {...props} />
  ) : activeTab === 'raci' ? (
    <ProjectRaciTab {...props} />
  ) : (
    <ProjectRevenueSchedulePanel {...props} />
  );

// Then in JSX:
<ProjectFormLayout
  activeTab={activeTab}
  content={projectContent}
  onTabSwitch={handleTabSwitch}
  // ... other props
/>
```

---

## 7. INLINE TABLE EDITING PATTERN - ProjectItemsTab Reference

### File Location:
`/frontend/components/modals/ProjectTabs.tsx` (ProjectItemsTab component)

### Key Features:

**Tab Props Interface:**
```typescript
interface ProjectItemsTabProps {
  errors: Record<string, string>;
  formData: Partial<Project>;
  formatCurrency: (value: number) => string;
  formatNumber: (num: number | string | undefined | null) => string;
  formatPercent: (value: number) => string;
  handleAddItem: () => void;
  handleDownloadProjectItemTemplate: () => void;
  handleItemBlur: (itemId: string, field: keyof ProjectItem) => void;
  handleRemoveItem: (itemId: string) => void;
  handleUpdateItem: (itemId: string, field: keyof ProjectItem, value: any) => void;
  isItemImportSaving: boolean;
  isProjectProductOptionsLoading: boolean;
  itemImportMenuRef: React.RefObject<HTMLDivElement | null>;
  itemImportSummary: ProjectImportSummary | null;
  itemSummary: { baseTotal: number; discountTotal: number; lineTotal: number };
  parseNumber: (str: string | number) => number;
  productById: Map<string, Product>;
  // ... more props
}
```

**Add Row Button Pattern:**
```typescript
<div className="flex justify-between items-center mb-2">
  <h3 className="text-sm font-bold text-slate-700">Danh sách sản phẩm/dịch vụ</h3>
  <div className="flex items-center gap-2">
    {/* Import menu */}
    <button 
      onClick={handleAddItem} 
      className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 font-medium"
    >
      <span className="material-symbols-outlined text-sm">add</span> Thêm hạng mục
    </button>
  </div>
</div>
```

**Inline Edit Table Structure:**
```typescript
<div className="border border-slate-200 rounded-lg bg-slate-50 p-4 overflow-visible">
  <table className="w-full table-fixed text-left bg-white rounded-lg shadow-sm">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[30%]">Sản phẩm</th>
        <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-[10%] text-center whitespace-nowrap">Đơn vị tính</th>
        <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-[8%] text-center whitespace-nowrap">SL</th>
        <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[14%] text-right whitespace-nowrap">Đơn giá</th>
        <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[9%] text-right whitespace-nowrap">% CK</th>
        <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[13%] text-right whitespace-nowrap">Giảm giá</th>
        <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[11%] text-right whitespace-nowrap">Thành tiền</th>
        <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-[5%] text-center whitespace-nowrap">Xóa</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-200">
      {formData.items && formData.items.length > 0 ? (
        formData.items.map((item) => (
          <tr key={item.id} className="hover:bg-slate-50">
            <td className="p-2">
              <SearchableSelect
                compact
                value={item.productId}
                options={projectProductSelectOptions}
                onChange={(value) => handleUpdateItem(item.id, 'productId', value)}
                disabled={isProjectProductOptionsLoading}
                triggerClassName="w-full text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm h-9"
              />
            </td>
            <td className="p-2">
              <div className="flex h-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 text-center text-sm font-medium text-slate-600">
                <span className="line-clamp-2">{selectedProduct?.unit || '—'}</span>
              </div>
            </td>
            <td className="p-2">
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full text-sm border border-slate-300 rounded-md text-center focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm"
                value={item.quantity === 0 ? '' : item.quantity}
                onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                placeholder="0"
              />
            </td>
            {/* More editable cells... */}
            <td className="p-2 text-center">
              <button
                type="button"
                onClick={() => handleRemoveItem(item.id)}
                className="text-slate-400 hover:text-red-600 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </td>
          </tr>
        ))
      ) : (
        <tr><td colSpan={8} className="p-4 text-center text-slate-500 text-sm">Chưa có hạng mục nào</td></tr>
      )}
    </tbody>
  </table>
</div>
```

**Delete Row Handler:**
```typescript
<button
  type="button"
  onClick={() => handleRemoveItem(item.id)}
  className="text-slate-400 hover:text-red-600 transition-colors"
>
  <span className="material-symbols-outlined text-sm">delete</span>
</button>
```

---

## 8. MODAL WRAPPER COMPONENT

### File Location:
`/frontend/components/modals/shared.tsx`

### Interface:
```typescript
export interface ModalWrapperProps {
  children: React.ReactNode;
  onClose: () => void;
  title: React.ReactNode;
  icon: string;
  width?: string;                    // Tailwind class (default: 'max-w-[560px]')
  heightClass?: string;              // Tailwind class
  minHeightClass?: string;           // Tailwind class
  maxHeightClass?: string;           // Tailwind class (default: 'max-h-[90vh]')
  panelClassName?: string;           // Tailwind class (default: 'rounded-xl')
  disableClose?: boolean;            // Prevents closing while saving
  headerAside?: React.ReactNode;     // Right-aligned content in header
  headerClassName?: string;          // Custom header classes
}
```

### Key Features:
- **Fixed overlay** with backdrop blur
- **Flex layout** for header/content/footer
- **Animated entry** (animate-fade-in)
- **Custom scrollbar** on content area
- **ESC key support** (unless disableClose)

### Usage in ProductFormModal:
```typescript
<ModalWrapper
  onClose={onClose}
  title={type === 'ADD' ? 'Thêm sản phẩm' : 'Cập nhật sản phẩm'}
  icon="inventory_2"
  width="max-w-5xl"
  disableClose={isSubmitting || isUploadingAttachments}
>
  {/* Form content */}
</ModalWrapper>
```

---

## 9. SHARED FORM COMPONENTS

### File Location:
`/frontend/components/modals/shared.tsx`

### FormInput Component:
```typescript
export interface FormInputProps {
  label: string;
  value?: string | number | null;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  type?: React.HTMLInputTypeAttribute;
  min?: string;
  max?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  error,
  type = 'text',
  min,
  max,
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      value={value || ''}
      onChange={onChange}
      // ... input styling with error states
    />
    {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
  </div>
);
```

### FormSelect Component:
Used via import from `./selectPrimitives`

### SearchableSelect Component:
```typescript
// Usage in ProductFormModal
<SearchableSelect
  label="Nhóm dịch vụ"
  required
  options={serviceGroupOptions}
  value={String(formData.service_group || DEFAULT_PRODUCT_SERVICE_GROUP)}
  onChange={(value) => {
    setFormData({ ...formData, service_group: value });
    clearFieldError('service_group');
  }}
  placeholder="Chọn nhóm dịch vụ"
  error={errors.service_group}
/>
```

---

## 10. MODAL MANAGEMENT IN APP.TSX

### Modal State Variables:
```typescript
const [modalType, setModalType] = useState<ModalType | null>(null);
const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
const [isSaving, setIsSaving] = useState(false);
const [productDeleteDependencyMessage, setProductDeleteDependencyMessage] = useState<string | null>(null);
```

### Modal Type Definitions:
Includes: 'ADD_PRODUCT' | 'EDIT_PRODUCT' | 'DELETE_PRODUCT' | 'CANNOT_DELETE_PRODUCT' | 'PRODUCT_FEATURE_CATALOG'

### Lazy Loading:
```typescript
const ProductFormModal = lazy(() => 
  import('./components/modals/index').then((m) => ({ default: m.ProductFormModal }))
);
const ProductFeatureCatalogModal = lazy(() => 
  import('./components/ProductFeatureCatalogModal').then((m) => ({ default: m.ProductFeatureCatalogModal }))
);
```

### Modal Opening Pattern:
```typescript
// In ProductList component call handler
onOpenModal('EDIT_PRODUCT', product);
onOpenModal('PRODUCT_FEATURE_CATALOG', product);

// In App.tsx, ListPage component
const handleOpenProductModal = (type: ModalType, product?: Product) => {
  setSelectedProduct(product || null);
  setModalType(type);
};
```

---

## 11. VALIDATION PATTERN

### ProductFormModal Validation:
```typescript
export type ProductFormField = 
  | 'service_group' | 'product_code' | 'product_name' 
  | 'package_name' | 'domain_id' | 'vendor_id' 
  | 'standard_price' | 'unit' | 'description';

type ProductFormErrors = Partial<Record<ProductFormField, string>>;

export const validateProductForm = (data: Partial<Product>): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  
  if (!serviceGroup || !isProductServiceGroupCode(serviceGroup)) {
    errors.service_group = 'Vui lòng chọn nhóm dịch vụ.';
  }
  
  if (!productCode) {
    errors.product_code = 'Vui lòng nhập mã sản phẩm.';
  } else if (productCode.length > 100) {
    errors.product_code = 'Mã sản phẩm không được vượt quá 100 ký tự.';
  }
  
  // ... more validation rules
  
  return errors;
};

// Usage in handleSubmit:
const validationErrors = validateProductForm(formData);
if (Object.keys(validationErrors).length > 0) {
  setErrors(validationErrors);
  const firstInvalidField = PRODUCT_FIELD_ORDER.find((field) => validationErrors[field]);
  if (firstInvalidField) {
    requestAnimationFrame(() => focusField(firstInvalidField));
  }
  return;
}
```

---

## 12. ATTACHMENT MANAGER COMPONENT

### Usage in ProductFormModal:
```typescript
<AttachmentManager
  attachments={formData.attachments || []}
  onUpload={handleUploadAttachment}
  onDelete={handleDeleteAttachment}
  isUploading={isUploadingAttachments}
  helperText="Tải lên tài liệu, hình ảnh hoặc bảng giá để lưu làm minh chứng cho sản phẩm."
  emptyStateDescription="Chưa có file minh chứng nào. Bạn có thể tải tài liệu kỹ thuật, bảng giá hoặc ảnh minh họa tại đây."
  uploadButtonLabel="Tải file minh chứng"
  enableClipboardPaste
  clipboardPasteHint="Click vào khung rồi Ctrl/Cmd+V để dán nhanh ảnh chụp minh chứng."
/>
```

### Upload Handler:
```typescript
const handleUploadAttachment = async (file: File) => {
  setIsUploadingAttachments(true);
  try {
    const uploadedAttachment = await uploadDocumentAttachment(file);
    setFormData((previous) => ({
      ...previous,
      attachments: [...(previous.attachments || []), uploadedAttachment],
    }));
  } catch (error) {
    console.error('Product attachment upload failed:', error);
    alert('Tải file minh chứng thất bại. Vui lòng thử lại.');
  } finally {
    if (isMountedRef.current) {
      setIsUploadingAttachments(false);
    }
  }
};
```

---

## 13. PRODUCT LIST TABLE CONFIGURATION

### Table Columns:
```typescript
type ProductTableColumnKey =
  | 'stt' | 'product_code' | 'package_name' | 'description'
  | 'standard_price' | 'service_group' | 'product_name'
  | 'domain_id' | 'vendor_id' | 'unit' | 'is_active' | 'actions';

interface ProductTableColumn {
  key: ProductTableColumnKey;
  label: string;
  sortable?: boolean;
  colStyle?: React.CSSProperties;
  headerClassName: string;
  cellClassName: string;
}
```

### Table Features:
- **Pagination** with configurable rows per page
- **Sorting** - customizable sort keys and directions
- **Filtering** - by domain, service group, search term
- **View switching** - 'catalog' vs 'quote' modes
- **Import/Export** - bulk operations

---

## SUMMARY - KEY PATTERNS FOR TARGET SEGMENTS IMPLEMENTATION

### Pattern 1: Basic Form Tab (if no sub-entities needed)
**Reference:** ProductFormModal
- Flat sections with grouped fields
- No tabs
- Validation + error highlighting
- Attachment support

### Pattern 2: Sub-Entity Hierarchical Tab (for Target Segments)
**Reference:** ProductFeatureCatalogModal + ProjectFormModal tabs
- Read-only parent info at top
- Inline table for editable sub-entities
- Add row / Delete row buttons
- Change tracking

### Pattern 3: Tab Navigation
**Reference:** ProjectFormModal + ProjectFormLayout
- Type-safe tab state: `type ActiveTab = 'tab1' | 'tab2' | ...`
- Tab prerequisites (can't edit items until parent saved)
- Tab button bar with active styling
- Conditional content rendering

### Pattern 4: Inline Editing
**Reference:** ProjectItemsTab
- Row-based editing in table cells
- Individual update handlers: `handleUpdateItem(id, field, value)`
- Row deletion with confirmation
- Add row functionality

### Pattern 5: Modal Management
**Reference:** App.tsx
- Modal type enum
- Selected entity state
- CRUD handler callbacks
- Lazy-loaded modal components
- Permission-based rendering

---

## File Summary for Implementation Reference

| Component | Path | Purpose | Pattern |
|-----------|------|---------|---------|
| ProductFormModal | `/frontend/components/modals/ProductFormModal.tsx` | Main product CRUD | Flat form, no tabs |
| ProductList | `/frontend/components/ProductList.tsx` | Product table view | List display, pagination, filtering |
| ProductFeatureCatalogModal | `/frontend/components/ProductFeatureCatalogModal.tsx` | Sub-entity management | **KEY REF** - hierarchical inline editing |
| ProjectFormModal | `/frontend/components/modals/ProjectFormModal.tsx` | Multi-tab form | **KEY REF** - tab navigation pattern |
| ProjectFormSections | `/frontend/components/modals/ProjectFormSections.tsx` | Tab layout component | **KEY REF** - tab button UI & switching |
| ProjectTabs | `/frontend/components/modals/ProjectTabs.tsx` | Tab content components | **KEY REF** - inline table editing pattern |
| ModalWrapper | `/frontend/components/modals/shared.tsx` | Modal container | Base modal component |
| App.tsx | `/frontend/App.tsx` | Root app component | Modal lifecycle + CRUD handlers |
| product.ts | `/frontend/types/product.ts` | Type definitions | Data models |

