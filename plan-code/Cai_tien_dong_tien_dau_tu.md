# Plan gộp: Cải tiến Dòng tiền Đầu tư — 2 thay đổi

## File duy nhất cần sửa

| # | File | Lý do |
|---|------|-------|
| 1 | `frontend/components/ContractModal.tsx` | Ẩn Preview sau sinh + Thêm cột Số tiền |

Không ảnh hưởng backend, types, v5Api, PaymentScheduleTab hay bất kỳ file nào khác.

---

## Thay đổi 1: Ẩn Preview sau khi sinh kỳ thanh toán thành công

### Bối cảnh

Hiện tại block `{allocationMode === 'MILESTONE' && (...)}` (dòng 1727-1935) **luôn hiện** khi mode = MILESTONE. Sau khi bấm "Sinh kỳ thanh toán" thành công, Preview hiện cùng data với `<PaymentScheduleTab>` bên dưới → **trùng lặp, rối người dùng**.

### Logic hiển thị mới

| Trạng thái | Hiện Preview? | Lý do |
|---|---|---|
| Chưa có kỳ nào (`schedules.length === 0`) | ✅ Hiện | Giúp user xem trước trước khi sinh |
| User thay đổi settings (mode/advance/retention/installments/count) | ✅ Hiện | So sánh cấu hình mới vs data cũ |
| Vừa sinh thành công, chưa đổi settings | ❌ Ẩn | Data thực đã ở PaymentScheduleTab |
| Mở modal, đã có schedules, chưa đổi settings | ❌ Ẩn | Không cần preview |

### Chi tiết triển khai

**Bước 1 — Thêm state `previewDirty`** (gần dòng 538, sau `milestoneInstallments`):

```typescript
const [previewDirty, setPreviewDirty] = useState(true);
```

**Bước 2 — Reset `previewDirty = true` khi initialFormData thay đổi** (trong useEffect dòng 603-617):

Thêm `setPreviewDirty(true);` vào block reset.

**Bước 3 — Đặt `previewDirty = true` khi user thay đổi settings**:

Tại các setter sau, bổ sung `setPreviewDirty(true)`:
- `setAllocationMode(...)` → khi onChange select "Cách phân bổ" (dòng 1624)
- `setAdvancePercentage(...)` → khi onChange input "Tạm ứng (%)" (dòng 1643)
- `setRetentionPercentage(...)` → khi onChange input "Giữ lại (%)" (dòng 1658)
- `setInstallmentCount(...)` → khi onChange input "Số đợt" (dòng 1670)
- `handleMilestoneInputModeChange(...)` → khi chuyển AUTO↔CUSTOM (đã có, thêm setPreviewDirty)
- `handleMilestoneInstallmentChange(...)` → khi sửa bảng custom (đã có, thêm setPreviewDirty)
- `handleAddMilestoneInstallment()` → khi thêm đợt (đã có, thêm setPreviewDirty)
- `handleRemoveMilestoneInstallment(...)` → khi xóa đợt (đã có, thêm setPreviewDirty)
- `syncMilestoneInstallmentsFromAuto()` → khi bấm "Lấy theo cấu hình tự động" (đã có, thêm setPreviewDirty)

**Cách triển khai gọn nhất**: Không sửa từng chỗ. Thay vào đó, wrap vào 3 handler:

```typescript
const handleAllocationSettingChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
  setter(value);
  setPreviewDirty(true);
};
```

Hoặc đơn giản hơn — dùng `useEffect` theo dõi tất cả dependency:

```typescript
useEffect(() => {
  setPreviewDirty(true);
}, [allocationMode, advancePercentage, retentionPercentage, installmentCount, milestoneInputMode, milestoneInstallments]);
```

> Cách này đơn giản nhất, không cần sửa từng onChange. `previewDirty` sẽ tự `true` khi bất kỳ setting nào thay đổi.

**Bước 4 — Đặt `previewDirty = false` sau khi sinh thành công** (trong `handleGenerateSchedules`, dòng ~1273):

```typescript
// trong finally block hoặc sau await thành công:
setPreviewDirty(false);
```

Chính xác hơn, thêm vào đoạn try-success (trước finally):

```typescript
setIsGenerating(true);
try {
  await onGenerateSchedules(contractId, { ... });
  setPreviewDirty(false);  // ← THÊM DÒNG NÀY
} catch {
  // Error toast is handled at App level.
} finally {
  setIsGenerating(false);
}
```

**Bước 5 — Tính `showMilestonePreview`** (computed, gần dòng 870):

```typescript
const showMilestonePreview = allocationMode === 'MILESTONE' && (previewDirty || schedules.length === 0);
```

**Bước 6 — Thay điều kiện render Preview** (dòng 1727):

Hiện tại:
```jsx
{allocationMode === 'MILESTONE' && (
  <div className="rounded-xl border border-violet-200 ...">
```

Sửa thành:
```jsx
{showMilestonePreview && (
  <div className="rounded-xl border border-violet-200 ...">
```

### Xác minh

1. Mở modal EDIT, đã có schedules, mode MILESTONE → Preview **ẩn** ✓
2. Đổi advancePercentage → Preview **hiện lại** ✓
3. Bấm "Sinh kỳ thanh toán" thành công → Preview **ẩn** ✓
4. Đổi installmentCount sau khi sinh → Preview **hiện lại** ✓
5. Mở modal EDIT, chưa có schedules → Preview **hiện** ✓

---

## Thay đổi 2: Thêm cột "Số tiền" vào bảng Editor các đợt thanh toán

### Bối cảnh

Bảng Editor custom (dòng 1804-1872) hiện có 5 cột:

```
Đợt | Tên đợt | % giá trị HĐ | Ngày dự kiến | Thao tác
```

Cần thêm cột **Số tiền** (read-only) ngay sau cột `% giá trị HĐ` để user thấy ngay số VND tương ứng khi nhập %.

### Chi tiết triển khai

**Bước 1 — Thêm header cột** (sau dòng 1810):

Hiện tại:
```jsx
<th className="...">% giá trị HĐ</th>
<th className="...">Ngày dự kiến</th>
```

Sửa thành:
```jsx
<th className="...">% giá trị HĐ</th>
<th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-violet-500 font-bold">Số tiền</th>
<th className="...">Ngày dự kiến</th>
```

**Bước 2 — Cập nhật `colSpan` của dòng trống** (dòng 1818):

Hiện tại: `colSpan={5}`
Sửa thành: `colSpan={6}`

**Bước 3 — Thêm cell Số tiền vào mỗi row** (sau cell `% giá trị HĐ`, tức sau dòng 1848):

Hiện tại:
```jsx
{/* cell % giá trị HĐ */}
</td>
<td className="px-3 py-2">
  {/* cell Ngày dự kiến */}
  <input type="date" .../>
</td>
```

Thêm cell mới giữa `% giá trị HĐ` và `Ngày dự kiến`:

```jsx
</td>
<td className="px-3 py-2 text-right text-sm font-medium text-slate-600 whitespace-nowrap">
  {formatPreviewMoney(roundMoney(parseCurrency(formData.value || 0) * clampPercentage(installment.percentage, 0) / 100))} đ
</td>
<td className="px-3 py-2">
```

**Logic tính:**
```
Số tiền = ROUND(contractValue × percentage / 100, 2)
```

- `parseCurrency(formData.value || 0)` — giá trị hợp đồng
- `clampPercentage(installment.percentage, 0)` — % đợt (0-100)
- `roundMoney(...)` — làm tròn 2 chữ số
- `formatPreviewMoney(...)` — format vi-VN (đã có sẵn helper)

**Đặc điểm cột:**
- **Read-only** — không phải input, chỉ là text
- **Reactive** — thay đổi `%` hoặc giá trị HĐ → số tiền cập nhật ngay
- **Style** — `text-right text-sm font-medium text-slate-600` — nhẹ hơn cột chính, phân biệt đây là computed

### Kết quả mong đợi

**Trước:**
```
ĐỢT │ TÊN ĐỢT            │ % GIÁ TRỊ HĐ     │ NGÀY DỰ KIẾN  │ THAO TÁC
─────┼─────────────────────┼───────────────────┼───────────────┼──────────
 #1  │ Thanh toán đợt 1    │ 26,67          %  │ 01/09/2026    │ Xóa
 #2  │ Thanh toán đợt 2    │ 26,67          %  │ 01/03/2027    │ Xóa
 #3  │ Thanh toán đợt 3    │ 26,66          %  │ 01/09/2027    │ Xóa
```

**Sau:**
```
ĐỢT │ TÊN ĐỢT            │ % GIÁ TRỊ HĐ     │       SỐ TIỀN │ NGÀY DỰ KIẾN  │ THAO TÁC
─────┼─────────────────────┼───────────────────┼───────────────┼───────────────┼──────────
 #1  │ Thanh toán đợt 1    │ 26,67          %  │ 261.874.314 đ │ 01/09/2026    │ Xóa
 #2  │ Thanh toán đợt 2    │ 26,67          %  │ 261.874.314 đ │ 01/03/2027    │ Xóa
 #3  │ Thanh toán đợt 3    │ 26,66          %  │ 261.670.724 đ │ 01/09/2027    │ Xóa
```

**Cập nhật min-width bảng** (dòng 1805):

Hiện tại: `min-w-[760px]`
Sửa thành: `min-w-[900px]` — đủ chỗ cho cột mới.

### Xác minh

1. Nhập 26.67% với HĐ = 982,019,190 → hiện `261.874.314 đ` ✓
2. Đổi % thành 30 → số tiền cập nhật thành `294.605.757 đ` ✓
3. Đổi giá trị HĐ → tất cả số tiền cập nhật ✓
4. Cột Số tiền không cho sửa (read-only) ✓

---

## Checklist tổng hợp

- [ ] Thêm state `previewDirty` + useEffect track dependencies
- [ ] `setPreviewDirty(false)` sau generate thành công
- [ ] Tính `showMilestonePreview` và thay điều kiện render
- [ ] Thêm header `<th>Số tiền</th>` vào bảng Editor
- [ ] Thêm cell Số tiền (read-only, computed) vào mỗi row
- [ ] Cập nhật `colSpan` 5→6 và `min-w-[760px]`→`min-w-[900px]`
- [ ] Chạy `npx tsc --noEmit` → 0 lỗi
