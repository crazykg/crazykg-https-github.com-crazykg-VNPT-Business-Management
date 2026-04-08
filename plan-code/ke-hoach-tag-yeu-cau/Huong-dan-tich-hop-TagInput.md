# Hướng dẫn tích hợp TagInput vào CustomerRequestCreateModal

## Bước 1: Thêm props vào CustomerRequestCreateModalProps

Thêm vào type `CustomerRequestCreateModalProps` (khoảng dòng 27):

```typescript
type CustomerRequestCreateModalProps = {
  // ... existing props ...
  
  /* Tags */
  formTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
};
```

## Bước 2: Thêm import Tag type

Thêm vào import section (khoảng dòng 15):

```typescript
import type {
  Attachment,
  Customer,
  CustomerPersonnel,
  Employee,
  ProjectItemMaster,
  SupportServiceGroup,
  YeuCauProcessField,
  Tag, // <-- THÊM DÒNG NÀY
} from '../../types';
```

## Bước 3: Destructure props trong component

Thêm vào destructuring (khoảng dòng 70):

```typescript
export const CustomerRequestCreateModal: React.FC<CustomerRequestCreateModalProps> = ({
  // ... existing props ...
  formTags,
  onTagsChange,
}) => {
```

## Bước 4: Thêm TagInput vào form

Thêm section Tags vào sau phần Task liên quan và trước phần Đính kèm:

```tsx
{/* Task liên quan */}
{renderTaskSection()}

{/* Tags — MỚI */}
<div className="rounded-2xl border border-slate-200 bg-white p-3.5">
  <div className="mb-2.5 flex items-center justify-between gap-3">
    <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
      Thẻ (Tags)
    </h4>
  </div>
  <TagInput
    value={formTags}
    onChange={onTagsChange}
    placeholder="Nhập tag và nhấn Enter..."
    disabled={isSaving}
  />
  <p className="mt-1.5 text-xs text-slate-400">
    Gắn thẻ để dễ tìm kiếm và phân loại yêu cầu. Nhấn Enter để tạo tag mới.
  </p>
</div>

{/* Đính kèm — đặt ngay dưới Tags */}
{renderAttachmentSection()}
```

## Bước 5: Cập nhật parent component (CustomerRequestManagementHub)

Trong file `CustomerRequestManagementHub.tsx` hoặc nơi gọi modal, thêm state và props:

```tsx
// Import Tag type
import type { Tag } from '../types';

// Thêm state
const [createFormTags, setCreateFormTags] = useState<Tag[]>([]);

// Truyền props vào modal
<CustomerRequestCreateModal
  // ... existing props ...
  formTags={createFormTags}
  onTagsChange={setCreateFormTags}
/>
```

## Bước 6: Gửi tags lên backend khi tạo request

Trong hàm `handleSave` hoặc tương tự, sau khi tạo request thành công:

```tsx
const handleSave = async () => {
  // ... existing save logic ...
  
  const response = await apiFetch('/api/v5/customer-request-cases', {
    method: 'POST',
    body: JSON.stringify({
      // ... existing data ...
    }),
  });

  const data = await response.json();
  const newCaseId = data.id;

  // Gửi tags lên backend
  if (createFormTags.length > 0 && newCaseId) {
    const tagNames = createFormTags.map(t => t.name);
    const tagColors = createFormTags.reduce((acc, t) => {
      acc[t.name] = t.color;
      return acc;
    }, {} as Record<string, string>);

    await apiFetch(`/api/v5/customer-request-cases/${newCaseId}/tags/bulk`, {
      method: 'POST',
      body: JSON.stringify({
        tag_names: tagNames,
        tag_colors: tagColors,
      }),
    });
  }

  // Reset form
  setCreateFormTags([]);
  // ... existing reset logic ...
};
```

## Bước 7: Load tags khi edit request

Nếu có chức năng edit request, load tags từ backend:

```tsx
// Khi mở modal edit
useEffect(() => {
  if (editingCaseId) {
    const loadTags = async () => {
      const response = await apiFetch(`/api/v5/customer-request-cases/${editingCaseId}/tags`);
      const data = await response.json();
      setEditFormTags(data.tags || []);
    };
    loadTags();
  }
}, [editingCaseId]);
```

## Bước 8: Cập nhật API response để include tags

Trong backend controller `CustomerRequestCaseController`, thêm tags vào response:

```php
// Trong method show() hoặc index()
$case->load('tags:id,name,color');

return response()->json([
    'data' => $case,
    'tags' => $case->tags->map(fn($tag) => [
        'id' => $tag->id,
        'name' => $tag->name,
        'color' => $tag->color,
    ]),
]);
```

---

## Test Checklist

- [ ] Có thể nhập tag mới và nhấn Enter để tạo
- [ ] Có thể chọn màu cho tag mới
- [ ] Có thể search tag có sẵn từ suggestions
- [ ] Có thể chọn nhiều tag
- [ ] Có thể xóa tag đã chọn
- [ ] Tags được gửi lên backend khi tạo request
- [ ] Tags được load khi edit request
- [ ] Tag usage_count được cập nhật đúng
