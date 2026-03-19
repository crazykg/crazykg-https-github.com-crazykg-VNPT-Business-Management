# Cải tiến hiển thị "Số ngày" giai đoạn — thêm ngày lịch (calendar span)

## Bối cảnh

Phase header (ví dụ "Chuẩn bị") hiện hiển thị **"20 ngày"** = `SUM(duration_days)` các bước trong giai đoạn. Tuy nhiên nhiều bước triển khai song song, nên 20 ngày công không phản ánh đúng thời gian thực tế của giai đoạn.

Cần bổ sung thêm metric **ngày lịch** (calendar span) = `MAX(đến_ngày) - MIN(từ_ngày) + 1`, hiển thị thông minh theo trạng thái dữ liệu.

---

## File cần sửa

| # | File | Vị trí |
|---|------|--------|
| 1 | `frontend/components/ProjectProcedureModal.tsx` | `phaseStats` useMemo (dòng 362-375) + phase header hiển thị (dòng 1197-1202) |

Chỉ sửa **1 file**, không ảnh hưởng backend, types, hay StepRow.

---

## Chi tiết triển khai

### 1. Mở rộng `phaseStats` useMemo (dòng 362-375)

Hiện tại `phaseStats` useMemo trông như này:

```typescript
const phaseStats = useMemo(() =>
  phaseGroups.map((g) => {
    const top = g.steps.filter((s: ProjectProcedureStep) => !s.parent_step_id);
    const completed = top.filter((s: ProjectProcedureStep) => (drafts[s.id]?.progress_status ?? s.progress_status) === 'HOAN_THANH').length;
    return {
      total: top.length,
      completed,
      percent: top.length > 0 ? Math.round((completed / top.length) * 100) : 0,
      totalDays: top.reduce((sum: number, s: ProjectProcedureStep) => sum + (s.duration_days || 0), 0),
      isAllDone: completed === top.length && top.length > 0,
    };
  }),
  [phaseGroups, drafts],
);
```

Cần **thêm logic tính ngày lịch** vào return object. Logic như sau:

**Bước 1 — Thu thập tất cả `actual_start_date` và `actual_end_date` (hoặc computed end date) của các bước:**

Với mỗi bước `s` trong `top` (bước cha, không phải sub-step):
- Lấy `startDate` = `drafts[s.id]?.actual_start_date ?? s.actual_start_date` (draft-first)
- Lấy `endDate`:
  - Nếu `duration_days > 0` và có `startDate`: tự tính `endDate = startDate + duration_days - 1` (dùng helper `computeEndDate` đã import sẵn từ `../../utils/procedureHelpers`)
  - Nếu `duration_days = 0/null`: lấy `drafts[s.id]?.actual_end_date ?? s.actual_end_date` (user nhập tay)
- Bỏ qua bước không có `startDate` hoặc không có `endDate`

**Bước 2 — Tính calendar span:**
- `minDate` = MIN của tất cả `startDate` hợp lệ
- `maxDate` = MAX của tất cả `endDate` hợp lệ
- `calendarDays` = chênh lệch ngày giữa `maxDate` và `minDate` + 1
- `stepsWithDates` = số bước đã có ngày (để biết coverage)

**Bước 3 — Thêm vào return:**
```typescript
return {
  total: top.length,
  completed,
  percent: ...,
  totalDays: ...,        // giữ nguyên — tổng ngày công (SUM)
  calendarDays: ...,     // MỚI — ngày lịch thực tế (calendar span), null nếu < 2 bước có ngày
  dateRange: ...,        // MỚI — { min: string, max: string } | null — để hiển thị range
  stepsWithDates: ...,   // MỚI — số bước đã nhập ngày
  isAllDone: ...,
};
```

**Lưu ý quan trọng về `computeEndDate`:**

File đã import helper `computeEndDate` từ `../../utils/procedureHelpers` (hoặc đang dùng inline trong component). Helper này nhận `(startDate: string, durationDays: number) => string | null`. Tái dùng helper này để tính end date cho các bước có `duration_days > 0`.

---

### 2. Cập nhật hiển thị phase header (dòng 1197-1202)

Hiện tại:
```jsx
<span className="mt-0.5 block text-xs text-slate-400">
  {phCompleted}/{phTotal} bước {isAllDone && '✓'}
  {phTotalDays > 0 && (
    <span className="ml-2 text-deep-teal font-medium">• {phTotalDays} ngày</span>
  )}
</span>
```

Destructure thêm từ `phaseStats[gIdx]`:
```typescript
const { ..., calendarDays, dateRange, stepsWithDates } = phaseStats[gIdx];
```

Sửa phần hiển thị thành **thông minh theo trạng thái dữ liệu**:

| Trường hợp | Điều kiện | Hiển thị |
|---|---|---|
| Chưa bước nào có ngày | `stepsWithDates === 0` | `• 20 ngày công` |
| Có ít nhất 2 bước có ngày | `stepsWithDates >= 2 && dateRange` | `• 20 ngày công · 12/2024 → 10/2026` |
| Tất cả bước đã có ngày | `stepsWithDates === phTotal && calendarDays` | `• 20 ngày công · 15 ngày lịch` |

**Format ngày range:** dùng `MM/YYYY` (không cần ngày cụ thể ở header, chỉ cần tháng/năm cho gọn). Ví dụ: `12/2024 → 03/2025`.

**Style:**
- "ngày công" giữ style hiện tại: `text-deep-teal font-medium`
- "ngày lịch" hoặc date range: `text-slate-500 font-normal` — để phân biệt rõ 2 metric

Ví dụ kết quả render:

```
Chuẩn bị
1/10 bước • 20 ngày công · 15 ngày lịch
```

```
Chuẩn bị
0/10 bước • 20 ngày công
```

```
Chuẩn bị
3/10 bước • 20 ngày công · 12/2024 → 03/2025
```

---

## Lưu ý quan trọng

- **Draft-first**: luôn đọc `drafts[s.id]?.actual_start_date ?? s.actual_start_date` và `drafts[s.id]?.actual_end_date ?? s.actual_end_date` — để khi user sửa ngày chưa lưu thì header cập nhật ngay.
- **Chỉ tính bước cha** (`!s.parent_step_id`): bước con không tính vào phase duration.
- **Xử lý edge case**: bước có `actual_start_date` nhưng không có `actual_end_date` và `duration_days = 0` → bỏ qua bước này khi tính calendar span.
- **Performance**: logic nằm trong `useMemo` đã có, chỉ thêm phép tính O(n) nên không ảnh hưởng hiệu năng.
- Chạy `npx tsc --noEmit` sau khi xong, đảm bảo 0 lỗi TypeScript.

---

## Xác minh sau triển khai

1. Giai đoạn chưa bước nào có "Từ ngày" → hiện `• 20 ngày công` (chỉ SUM, như cũ)
2. Giai đoạn có 3/10 bước đã nhập ngày → hiện `• 20 ngày công · 01/2025 → 06/2025` (range MM/YYYY)
3. Giai đoạn 10/10 bước đều có ngày → hiện `• 20 ngày công · 45 ngày lịch` (calendar span)
4. User sửa "Từ ngày" ở 1 bước mà chưa lưu → header **cập nhật ngay** (draft-first)
5. Các bước chạy song song (cùng khoảng ngày) → ngày lịch < tổng ngày công
