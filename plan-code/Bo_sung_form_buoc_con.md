# Bổ sung Từ ngày / Đến ngày / Tiến độ cho form thêm bước con + Validate ngày con ≤ cha

## Bối cảnh

Form thêm bước con (hiện ở dòng 937-999 `StepRow.tsx`) chỉ có 3 field: **Tên bước con**, **ĐV chủ trì**, **Ngày** (duration). Ô ngày hiện tại quá nhỏ, khó thấy. Cần bổ sung **Từ ngày**, **Đến ngày**, **Tiến độ** và validate ngày bước con phải nằm trong khoảng ngày của bước cha.

---

## Các file cần sửa

| # | File | Thay đổi |
|---|------|----------|
| 1 | `frontend/components/ProjectProcedureModal.tsx` | Thêm 3 state mới + truyền props + sửa `handleAddChildStep` gửi thêm field |
| 2 | `frontend/components/procedure/StepRow.tsx` | Thêm 3 props + mở rộng form thêm bước con + validate client-side |
| 3 | `frontend/services/v5Api.ts` | Thêm `actual_start_date`, `actual_end_date`, `progress_status` vào payload `addCustomProcedureStep` |
| 4 | `backend/.../ProjectProcedureController.php` | Thêm validation rules cho 3 field mới trong `addCustomStep()` |

---

## Chi tiết triển khai

### 1. Backend — `ProjectProcedureController.php` (`addCustomStep`, dòng 962)

**Thêm validation rules** (sau dòng 975, cùng block validation hiện tại):

```php
'actual_start_date' => 'sometimes|nullable|date',
'actual_end_date'   => 'sometimes|nullable|date|after_or_equal:actual_start_date',
'progress_status'   => 'sometimes|nullable|string|max:50',
```

**Thêm vào `ProjectProcedureStep::create()`** (dòng 1018-1030, thêm 3 field):

```php
'actual_start_date' => $request->input('actual_start_date'),
'actual_end_date'   => $request->input('actual_end_date'),
'progress_status'   => $request->input('progress_status', 'CHUA_THUC_HIEN'),
```

> Lưu ý: `progress_status` hiện đang hardcode `'CHUA_THUC_HIEN'`. Sửa để nhận từ request, fallback về `'CHUA_THUC_HIEN'` nếu không truyền.

---

### 2. Frontend — `v5Api.ts` (`addCustomProcedureStep`, dòng 2775)

Mở rộng payload type (dòng 2777):

```typescript
export const addCustomProcedureStep = async (
  procedureId: string | number,
  payload: {
    step_name: string;
    phase?: string | null;
    lead_unit?: string | null;
    expected_result?: string | null;
    duration_days?: number;
    parent_step_id?: string | number | null;
    actual_start_date?: string | null;    // ← THÊM
    actual_end_date?: string | null;      // ← THÊM
    progress_status?: string | null;      // ← THÊM
  },
): Promise<ProjectProcedureStep> => {
```

Không cần sửa body — `JSON.stringify(payload)` đã gửi tất cả field.

---

### 3. Frontend — `ProjectProcedureModal.tsx`

#### 3a. Thêm 3 state mới (sau dòng 240, cùng block `newChildName/Unit/Days`):

```typescript
const [newChildStartDate,  setNewChildStartDate]  = useState('');
const [newChildEndDate,    setNewChildEndDate]     = useState('');
const [newChildStatus,     setNewChildStatus]      = useState('CHUA_THUC_HIEN');
```

#### 3b. Reset state khi cancel/thành công (trong `handleAddChildStep` dòng 662):

Tìm chỗ reset `setNewChildName('')`, `setNewChildUnit('')`, `setNewChildDays('')` (dòng ~679-681), thêm:

```typescript
setNewChildStartDate('');
setNewChildEndDate('');
setNewChildStatus('CHUA_THUC_HIEN');
```

Cũng thêm reset trong `handleToggleAddChild` khi mở form (nếu có reset block).

#### 3c. Sửa `handleAddChildStep` — gửi thêm 3 field (dòng 670-676):

```typescript
await addCustomProcedureStep(activeProcedure.id, {
  step_name:         newChildName.trim(),
  phase:             parentStep.phase,
  lead_unit:         newChildUnit.trim() || null,
  duration_days:     newChildDays ? parseInt(newChildDays, 10) : 0,
  parent_step_id:    parentStep.id,
  actual_start_date: newChildStartDate || null,       // ← THÊM
  actual_end_date:   newChildEndDate || null,          // ← THÊM
  progress_status:   newChildStatus || 'CHUA_THUC_HIEN', // ← THÊM
});
```

#### 3d. Cập nhật `useCallback` dependencies (dòng 688):

```typescript
}, [activeProcedure, newChildName, newChildUnit, newChildDays, newChildStartDate, newChildEndDate, newChildStatus]);
```

#### 3e. Truyền props mới xuống StepRow (dòng ~1544-1547):

```tsx
newChildStartDate={newChildStartDate}
newChildEndDate={newChildEndDate}
newChildStatus={newChildStatus}
onSetChildStartDate={setNewChildStartDate}
onSetChildEndDate={setNewChildEndDate}
onSetChildStatus={setNewChildStatus}
```

---

### 4. Frontend — `StepRow.tsx`

#### 4a. Thêm props vào `StepRowProps` (sau dòng 237, cùng block `onSetChildDays`):

```typescript
newChildStartDate: string;
newChildEndDate: string;
newChildStatus: string;
onSetChildStartDate: React.Dispatch<React.SetStateAction<string>>;
onSetChildEndDate: React.Dispatch<React.SetStateAction<string>>;
onSetChildStatus: React.Dispatch<React.SetStateAction<string>>;
```

#### 4b. Destructure trong component (dòng 243+):

Thêm vào destructure list:
```typescript
newChildStartDate, newChildEndDate, newChildStatus,
onSetChildStartDate, onSetChildEndDate, onSetChildStatus,
```

#### 4c. Tính giới hạn ngày từ bước cha (thêm computed trong form section, dòng ~938):

```typescript
// Giới hạn ngày con: phải nằm trong [parentStart, parentEnd]
const parentStart = draft.actual_start_date ?? step.actual_start_date ?? null;
const parentEnd   = (() => {
  const days = step.duration_days;
  if (days && days > 0 && parentStart) {
    return computeEndDate(parentStart, days);
  }
  return draft.actual_end_date ?? step.actual_end_date ?? null;
})();
```

> `computeEndDate` đã được import/truyền sẵn vào StepRow. Nếu chưa → import từ `@/utils/procedureHelpers`.

#### 4d. Auto-tính Đến ngày con khi nhập Từ ngày (handler inline):

```typescript
const handleChildStartDateChange = (val: string) => {
  onSetChildStartDate(val);
  const days = newChildDays ? parseInt(newChildDays, 10) : 0;
  if (days > 0 && val) {
    onSetChildEndDate(computeEndDate(val, days) ?? '');
  } else if (!val) {
    onSetChildEndDate('');
  }
};
```

#### 4e. Sửa form — Thay thế dòng 937-998

**Layout hiện tại:**
```
└+ │ [Tên bước con...] │ [ĐV chủ trì...] │ │ [Ngày] │ ← colSpan=6: [Thêm] [Hủy]
```

**Layout mới:**
```
└+ │ [Tên bước con...] │ [ĐV chủ trì...] │ │ [Ngày] │ [Từ ngày] │ [Đến ngày] │ [Tiến độ ▾] │ ← colSpan=3: [Thêm] [Hủy]
```

**Chi tiết từng cell mới (thêm sau `<td>` của Ngày, thay thế `<td colSpan={6}>`:**

**Cell Từ ngày:**
```html
<td className="px-2 py-2">
  <input
    type="date"
    value={newChildStartDate}
    disabled={isAddingChildSubmitting}
    min={parentStart ?? undefined}
    max={parentEnd ?? undefined}
    onChange={(e) => handleChildStartDateChange(e.target.value)}
    className="w-full px-2 py-1.5 rounded-lg text-xs border border-teal-200 bg-white focus:border-teal-400 outline-none"
  />
</td>
```

**Cell Đến ngày:**
```html
<td className="px-2 py-2">
  {(() => {
    const days = newChildDays ? parseInt(newChildDays, 10) : 0;
    const isAutoCalc = days > 0 && !!newChildStartDate;
    return (
      <input
        type="date"
        value={newChildEndDate}
        disabled={isAddingChildSubmitting || isAutoCalc}
        readOnly={isAutoCalc}
        tabIndex={isAutoCalc ? -1 : 0}
        min={newChildStartDate || parentStart || undefined}
        max={parentEnd ?? undefined}
        onChange={isAutoCalc ? undefined : (e) => onSetChildEndDate(e.target.value)}
        title={isAutoCalc ? `Tự tính: Từ ngày + ${days} - 1 ngày` : undefined}
        className={`w-full px-2 py-1.5 rounded-lg text-xs border outline-none ${
          isAutoCalc
            ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
            : 'border-teal-200 bg-white focus:border-teal-400'
        }`}
      />
    );
  })()}
</td>
```

**Cell Tiến độ:**
```html
<td className="px-2 py-2">
  <select
    value={newChildStatus}
    disabled={isAddingChildSubmitting}
    onChange={(e) => onSetChildStatus(e.target.value)}
    className="w-full px-2 py-1.5 rounded-lg text-xs border border-teal-200 bg-white focus:border-teal-400 outline-none"
  >
    <option value="CHUA_THUC_HIEN">Chưa TH</option>
    <option value="DANG_THUC_HIEN">Đang TH</option>
    <option value="HOAN_THANH">Hoàn thành</option>
  </select>
</td>
```

**Cell nút Thêm/Hủy — giảm colSpan:**

Hiện tại: `<td colSpan={6}>` → Sửa thành: `<td colSpan={3}>` (vì đã dùng 3 cột cho Từ ngày/Đến ngày/Tiến độ).

> **Quan trọng:** Kiểm tra tổng cột trong `<tr>` phải bằng tổng cột `<thead>`. Đếm kỹ: hiện tại `<thead>` có N cột, form row phải span đúng N.

#### 4f. Validate client-side trước khi submit

Tại nút "Thêm" (`onClick`), thêm validate:

```typescript
onClick={() => {
  // Validate ngày con nằm trong khoảng cha
  if (newChildStartDate && parentStart && newChildStartDate < parentStart) {
    alert('Từ ngày con không được trước Từ ngày cha (' + parentStart + ')');
    return;
  }
  if (newChildEndDate && parentEnd && newChildEndDate > parentEnd) {
    alert('Đến ngày con không được sau Đến ngày cha (' + parentEnd + ')');
    return;
  }
  if (newChildStartDate && newChildEndDate && newChildEndDate < newChildStartDate) {
    alert('Đến ngày phải >= Từ ngày');
    return;
  }
  onAddChildStep(step);
}}
```

> Tốt hơn dùng `toast` thay `alert` nếu project đã có toast. Hoặc hiện warning text inline dưới input.

#### 4g. Hiển thị gợi ý giới hạn ngày cha

Nếu bước cha có Từ ngày / Đến ngày, hiện 1 dòng text nhỏ phía trên form:

```html
{(parentStart || parentEnd) && (
  <td colSpan={N} className="px-3 py-1 text-[10px] text-teal-500 bg-teal-50/30 border-b border-teal-100">
    <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">info</span>
    Ngày bước con phải nằm trong khoảng {parentStart ? parentStart : '…'} → {parentEnd ? parentEnd : '…'} (ngày bước cha)
  </td>
)}
```

> Đây là optional — có thể bỏ nếu `min/max` trên input đã đủ rõ.

---

### 5. Cập nhật `handleChildDaysChange` — auto-tính lại Đến ngày khi đổi số ngày

Hiện tại `onSetChildDays` chỉ set state. Cần thêm logic: khi user đổi số ngày và Từ ngày đã có → tính lại Đến ngày.

**Cách 1 — Handler inline:**

Ở `<input type="number">` của ngày, đổi `onChange`:

```typescript
onChange={(e) => {
  const val = e.target.value;
  onSetChildDays(val);
  const days = val ? parseInt(val, 10) : 0;
  if (days > 0 && newChildStartDate) {
    onSetChildEndDate(computeEndDate(newChildStartDate, days) ?? '');
  }
}}
```

**Cách 2 — useEffect trong Modal (đơn giản hơn):**

```typescript
useEffect(() => {
  const days = newChildDays ? parseInt(newChildDays, 10) : 0;
  if (days > 0 && newChildStartDate) {
    setNewChildEndDate(computeEndDate(newChildStartDate, days) ?? '');
  }
}, [newChildDays, newChildStartDate]);
```

> **Khuyên dùng Cách 1** (handler inline) vì StepRow đã có pattern này. `useEffect` có thể gây loop nếu không cẩn thận.

---

## Lưu ý

- **`computeEndDate`**: Nếu `StepRow` chưa import trực tiếp, cần import từ `@/utils/procedureHelpers` hoặc truyền qua props. Kiểm tra xem `StepRow` hiện dùng `computeEndDate` inline hay import.
- **colSpan**: Đếm lại tổng cột `<thead>` hiện tại, đảm bảo form row span đúng. Nếu bảng có N cột, form row cần: 3 `<td/>` rỗng (checkbox, TT, A) + 1 tên + 1 ĐV + 1 kết quả + 1 ngày + 1 từ ngày + 1 đến ngày + 1 tiến độ + colSpan nút = N.
- **`min/max` trên `<input type="date">`**: Chỉ là UI hint, user vẫn có thể nhập bằng keyboard vượt giới hạn → validate JS trước submit là bắt buộc.
- Chạy `npx tsc --noEmit` sau khi xong, đảm bảo 0 lỗi.

---

## Xác minh

1. Mở form thêm bước con ở bước cha có Từ ngày 10/10/2025, Đến ngày 19/10/2025 (10 ngày)
2. Input "Từ ngày" con → date picker chỉ cho chọn 10/10 → 19/10
3. Nhập Ngày = 3, Từ ngày = 12/10/2025 → Đến ngày tự tính = 14/10/2025, read-only
4. Nhập Ngày = 0, Từ ngày = 12/10 → Đến ngày editable, max = 19/10
5. Chọn Tiến độ = "Đang TH" → submit → bước con hiện Đang TH
6. Thử nhập Từ ngày = 01/09/2025 (trước cha) → alert/warning, không cho submit
7. Thử nhập Đến ngày = 20/10/2025 (sau cha) → alert/warning, không cho submit
8. Bước cha chưa có ngày → form con không hiện giới hạn, min/max trống, vẫn nhập bình thường
9. Submit thành công → reload → bước con hiện đúng Từ ngày, Đến ngày, Tiến độ
10. Đổi số ngày khi đã có Từ ngày → Đến ngày tính lại tức thì
