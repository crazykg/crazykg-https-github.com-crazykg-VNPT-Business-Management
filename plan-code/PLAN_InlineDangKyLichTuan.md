# Kế hoạch — Đăng ký lịch tuần trực tiếp trên bảng Lịch làm việc

> **Module:** Lịch làm việc đơn vị (`department_weekly_schedule_management`)
> **Ngày tạo:** 2026-03-21
> **File liên quan:** `frontend/components/DepartmentWeeklyScheduleManagement.tsx`

---

## 1. Tổng quan yêu cầu

| # | Yêu cầu | Ghi chú |
|---|---------|---------|
| 1 | Cho phép đăng ký lịch **trực tiếp** từ tab "Lịch làm việc" | Không cần tab "Đăng ký" riêng |
| 2 | Click vào ô trong bảng → hiện modal popup đăng ký cho đúng ngày + buổi đó | Modal giữa màn hình |
| 3 | Form chỉ hiển thị **nội dung của người dùng hiện tại** | Filter theo `created_by === currentUserId` |
| 4 | Admin (`isAdminViewer`) xem được tất cả entries | Không bị filter |
| 5 | Bảng "Lịch làm việc" **ai cũng xem được** | Read-only khi không có quyền write |
| 6 | **Ẩn nút "Cập nhật lịch tuần"** ở header | Nút `handleSave` (bulk save) bị xóa |
| 7 | **Ẩn tab "Đăng ký"** | Chỉ giữ lại tab "Lịch làm việc" |
| 8 | Logic API/validate **không thay đổi** | Tái sử dụng toàn bộ handlers hiện tại |

---

## 2. Luồng giao diện

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Lịch làm việc đơn vị                          ❌ NÚT "Cập nhật lịch tuần"  │
│  [Phòng ban ▼]  [Năm ▼]  [Tuần ▼]              [📅 Lịch làm việc]          │
│                                              ❌ TAB "Đăng ký" đã xóa       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────── BẢNG LỊCH LÀM VIỆC ──────────────────────────────┐   │
│  │ Thứ  │ Ngày  │ Buổi │ Nội dung làm việc    │ Thành phần   │ Địa điểm │   │
│  ├──────┼───────┼──────┼──────────────────────┼──────────────┼──────────┤   │
│  │      │       │ Sáng │ 7h30, Đi họp Sở GD   │ Châu Kim Tuấn│ Sở NN   │   │
│  │ Hai  │ 16/03 │      │ Họp đột xuất GP2      │ Phan Văn Rô  │ GP2     │←──┼── click → mở popup
│  │      │       │ Chiều│ Họp bệnh viện UB      │ Dương Hải Bằng│ 70 ĐK  │   │
│  ├──────┼───────┼──────┼──────────────────────┼──────────────┼──────────┤   │
│  │      │       │ Sáng │ -                     │ -            │ -        │←──┼── click → mở popup
│  │ Ba   │ 17/03 │      │                       │              │          │   │
│  │      │       │ Chiều│ -                     │ -            │ -        │   │
│  └──────┴───────┴──────┴──────────────────────┴──────────────┴──────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

  ▼ MODAL POPUP GIỮA MÀN HÌNH (mở khi click vào row) ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  │▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│▒│  │
  │  │▒  📝 Đăng ký lịch làm việc                              [✕ Đóng] ▒│  │
  │  │▒  Thứ Hai — 16/03 | Buổi Sáng                                    ▒│  │
  │  ├▒─────────────────────────────────────────────────────────────────▒│  │
  │  │▒                                                                 ▒│  │
  │  │▒  ┌── Dòng #1 ───────────────────────────── [Cập nhật] [Xóa] ──▒│  │
  │  │▒  │  Nội dung làm việc *                                       ▒│  │
  │  │▒  │  [Họp đột xuất với phòng GP2                              ]▒│  │
  │  │▒  │  Thành phần: [Phan Văn Rô, Hồ Văn Trọng ▼]                ▒│  │
  │  │▒  │  Thành phần tự do: [                    ]                  ▒│  │
  │  │▒  │  Địa điểm: [GP2                         ]                  ▒│  │
  │  │▒  │                      Người đăng ký: Phan Văn Rô | 16/03/2026▒│  │
  │  │▒  └────────────────────────────────────────────────────────────▒│  │
  │  │▒                                                                 ▒│  │
  │  │▒  [+ Thêm dòng]                                                  ▒│  │
  │  │▒                                                                 ▒│  │
  │  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│  │
  │  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│  │
  │  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│  │
  │  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│  │
  │  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│  │
  │  └─────────────────────────────────────────────────────────────────┘  │
```

---

## 3. Thay đổi kỹ thuật

### 3.1 File duy nhất cần sửa

```
frontend/components/DepartmentWeeklyScheduleManagement.tsx
```

**Không cần thay đổi backend, API, types, hay bất kỳ file nào khác.**

> **Lưu ý quan trọng:** Đây là change **pure-UI**. Tất cả handlers (`handleSaveEntry`, `handleDeleteEntry`, `handleAddEntry`, `updateEntry`, `buildPayload`, `canDeleteEntry`) đều đã tồn tại và được tái sử dụng nguyên vẹn. Logic phân quyền, validation, API calls giữ nguyên — chỉ thay đổi cách user trigger actions (click vào row thay vì vào tab REGISTER).

---

### 3.2 Ẩn tab "Đăng ký"

Xóa hoặc ẩn toàn bộ block tab navigation chứa "Lịch làm việc" và "Đăng ký". Chỉ giữ lại tiêu đề và bộ lọc (Phòng ban, Năm, Tuần).

**Trước (có 2 tabs):**
```tsx
<div className="flex items-center gap-2 mb-4">
  <button className={activeViewTab === 'schedule' ? 'active' : ''}>
    📅 Lịch làm việc
  </button>
  <button className={activeViewTab === 'register' ? 'active' : ''}>
    ✏️ Đăng ký
  </button>
</div>
```

**Sau (chỉ còn bộ lọc):**
```tsx
<div className="flex items-center gap-2 mb-4">
  {/* Chỉ hiển thị bộ lọc: Phòng ban, Năm, Tuần */}
</div>
```

**State `activeViewTab` vẫn giữ lại** (phòng khi khôi phục sau), nhưng luôn set mặc định là `'schedule'` và không cho phép chuyển tab.

> **Lưu ý:** Việc ẩn tab "Đăng ký" không xóa logic xử lý của tab này — nó chỉ không còn hiển thị trên UI. Toàn bộ logic đăng ký được trigger trực tiếp từ bảng "Lịch làm việc" qua click vào row.

---

### 3.4 State mới

Thêm 1 state variable vào component, ngay sau `activeViewTab`:

```typescript
// Slot đang được chỉnh sửa trên bảng SCHEDULE
const [editingSlot, setEditingSlot] = useState<{
  calendarDate: string;
  session: DepartmentWeeklyScheduleSession;
} | null>(null);
```

---

### 3.5 Helper: lọc entries theo user

Thêm hàm helper `getUserEntriesForSlot` sau `canDeleteEntry`:

```typescript
const getUserEntriesForSlot = (
  calendarDate: string,
  session: DepartmentWeeklyScheduleSession
): EditableScheduleEntry[] => {
  return editableEntries.filter((entry) => {
    if (entry.calendar_date !== calendarDate || entry.session !== session) return false;
    if (!entry.id) return true;                          // Draft entries (của mình, chưa lưu)
    if (isAdminViewer) return true;                      // Admin xem tất cả
    return normalizeId(entry.created_by) === actorIdToken; // Chỉ entries của mình
  });
};
```

> **Lưu ý:** Logic này **tái sử dụng hoàn toàn** từ cách filter của tab REGISTER. Không có logic mới về phân quyền — chỉ áp dụng cùng rule sang context khác (modal thay vì panel inline).

---

### 3.6 Reset `editingSlot` khi đổi context

```typescript
useEffect(() => {
  setEditingSlot(null);
}, [selectedDepartmentId, selectedWeekStartDate, activeViewTab]);
```

---

### 3.7 Ẩn nút "Cập nhật lịch tuần"

Xóa hoặc ẩn hoàn toàn block `<div className="flex flex-wrap gap-3">` chứa button `handleSave` (khoảng line 864–873).

Hàm `handleSave()` giữ nguyên trong code, không xóa (phòng khi cần dùng lại).

---

### 3.8 Làm rows trong bảng SCHEDULE có thể click

Trên mỗi `<tr>` trong bảng preview, thêm:

```tsx
<tr
  key={...}
  className={`
    align-top
    ${canWriteSchedules ? 'cursor-pointer transition-colors hover:bg-primary/5' : ''}
    ${editingSlot?.calendarDate === row.day.date && editingSlot?.session === row.session
      ? 'bg-primary/10'
      : ''}
  `}
  onClick={() => {
    if (!canWriteSchedules) return;
    setEditingSlot({ calendarDate: row.day.date, session: row.session });
  }}
>
```

- `cursor-pointer` + `hover:bg-primary/5`: chỉ khi có quyền write
- `bg-primary/10`: highlight row của slot đang mở
- Người dùng read-only: không có cursor đặc biệt, không mở modal

---

### 3.9 Modal Popup Editor

Thay vì render inline panel bên dưới bảng, dùng **Modal Popup** căn giữa màn hình với backdrop mờ. Render ở cuối component (trước dấu đóng `</div>` của `DepartmentWeeklyScheduleManagement`):

**Đặc điểm:**
- Backdrop mờ `bg-black/50` phủ toàn màn hình
- Click ra ngoài modal → đóng (kiểm tra `e.target === e.currentTarget`)
- Modal width `max-w-2xl` (960px), căn giữa
- Body scrollable `max-h-[60vh] overflow-y-auto` — phù hợp khi có nhiều entries
- Animation `animate-in fade-in zoom-in` (nếu project dùng tailwindcss-animate)
- Nút ✕ đóng modal ở góc phải header
- Header cố định, chỉ body scrollable

```tsx
{editingSlot && canWriteSchedules && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onClick={(e) => {
      if (e.target === e.currentTarget) setEditingSlot(null);
    }}
  >
    <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">edit_calendar</span>
          <span className="text-sm font-bold text-slate-900">
            {/* Tên ngày + buổi: "Thứ Hai — 16/03 | Buổi Sáng" */}
            {DAY_NAMES[orderedPreviewWeekDays.find(d => d.date === editingSlot.calendarDate)?.day_of_week ?? 2]}
            {' — '}
            {formatDisplayDate(editingSlot.calendarDate)}
            {' | Buổi '}
            {SESSION_LABELS[editingSlot.session]}
          </span>
        </div>
        <button
          onClick={() => setEditingSlot(null)}
          className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-500">close</span>
        </button>
      </div>

      {/* Body: entries của user hiện tại */}
      <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
        {getUserEntriesForSlot(editingSlot.calendarDate, editingSlot.session).length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
            <p className="text-sm">Chưa có nội dung nào cho buổi này</p>
          </div>
        ) : (
          getUserEntriesForSlot(editingSlot.calendarDate, editingSlot.session).map((entry, index) => (
            <EntryFormCard
              key={entry.local_id}
              entry={entry}
              index={index}
              onSave={() => handleSaveEntry(entry)}
              onDelete={() => handleDeleteEntry(entry)}
              onUpdate={(field, value) => updateEntry(entry.local_id, ...)}
              ...
            />
          ))
        )}

        {/* Nút Thêm dòng */}
        <button
          onClick={() => handleAddEntry(editingSlot.calendarDate, editingSlot.session)}
          className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-primary hover:text-primary transition-colors font-medium"
        >
          + Thêm dòng
        </button>
      </div>
    </div>
  </div>
)}
```

**Đặc điểm:**
- Backdrop mờ `bg-black/50` phủ toàn màn hình
- Click ra ngoài modal → đóng (kiểm tra `e.target === e.currentTarget`)
- Modal width `max-w-2xl` (960px), căn giữa
- Body scrollable `max-h-[60vh] overflow-y-auto` — phù hợp khi có nhiều entries
- Animation `animate-in fade-in zoom-in` (nếu project dùng tailwindcss-animate)

---

### 3.10 Đóng modal khi nhấn Escape

```typescript
useEffect(() => {
  if (!editingSlot) return;

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setEditingSlot(null);
  };

  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [editingSlot]);
```

---

## 4. Form fields trong modal

Giống hoàn toàn với REGISTER tab, tái sử dụng cùng JSX pattern:

| Field | Component | Binding |
|-------|-----------|---------|
| Nội dung làm việc * | `<textarea>` | `entry.work_content` |
| Thành phần (nhân sự) | `<SearchableMultiSelect>` | `entry.participant_user_ids` |
| Thành phần tự do | `<input type="text">` | `entry.participant_text` |
| Địa điểm | `<input type="text">` | `entry.location` |
| Audit info | Text | `created_by_name`, `created_at` |

**Nút action:**
- Entry chưa có `id` (draft): hiện nút **"Lưu"** → gọi `handleSaveEntry(entry)`
- Entry đã có `id`: hiện nút **"Cập nhật"** + **"Xóa dòng"**

---

## 5. Các handlers tái sử dụng (không đổi logic)

| Handler | Mô tả | Không thay đổi |
|---------|-------|----------------|
| `handleSaveEntry(entry)` | Save/create 1 entry | ✅ |
| `handleDeleteEntry(entry)` | Xóa 1 entry | ✅ |
| `handleAddEntry(date, session)` | Thêm draft entry mới | ✅ |
| `updateEntry(localId, updater)` | Cập nhật field trong state | ✅ |
| `buildPayload([entry])` | Build payload gửi API | ✅ |
| `canDeleteEntry(entry)` | Kiểm tra quyền xóa | ✅ |

---

## 7. Phân quyền

| Role | Xem bảng | Click vào ô | Thấy entries trong modal |
|------|----------|-------------|--------------------------|
| `canReadSchedules` only | ✅ | ❌ (không có cursor/hover) | Không mở được |
| `canWriteSchedules` | ✅ | ✅ | Chỉ entries của mình |
| `isAdminViewer` + write | ✅ | ✅ | Tất cả entries của slot đó |

---

## 8. Edge cases

| Tình huống | Xử lý |
|-----------|-------|
| Slot chưa có entry nào | Hiện "Chưa có nội dung" + nút "Thêm dòng" |
| Slot có entries của người khác, không của mình | Modal rỗng + nút "Thêm dòng" |
| Xóa entry cuối cùng trong slot | Modal vẫn mở, hiện empty state + "Thêm dòng" |
| Đổi tuần/phòng ban | `editingSlot` reset về `null` |
| `scheduleId` chưa tồn tại | `handleSaveEntry` gọi create API (đã xử lý sẵn) |
| **2 user cùng click vào một slot** | **Mỗi user chỉ thấy/sửa được entries của mình → không có conflict** |
| **Click vào bảng khi modal đang mở** | **Modal không đóng — chỉ đóng khi click ✕ hoặc đổi context** |
| **Nhấn Escape** | **Modal đóng** |
| **Click ra ngoài modal (backdrop)** | **Modal đóng** |

---

## 8. Thứ tự thực hiện

```
Bước 1: Thêm state `editingSlot`
Bước 2: Thêm helper `getUserEntriesForSlot()`
Bước 3: Thêm useEffect reset `editingSlot`
Bước 4: Ẩn tab "Đăng ký"
Bước 5: Ẩn nút "Cập nhật lịch tuần"
Bước 6: Thêm onClick + hover styles vào <tr> trong bảng SCHEDULE
Bước 7: Thêm Modal Popup Editor ở cuối component
Bước 8: Thêm useEffect đóng modal khi nhấn Escape
Bước 9: Test toàn bộ luồng
```

---

## 10. Kiểm tra

```bash
# Unit tests
cd frontend && npx vitest run

# Manual test checklist
□ Mở tab "Lịch làm việc" → bảng hiện đúng (read-only với mọi user)
□ Nút "Cập nhật lịch tuần" không còn hiển thị
□ Hover vào row → nền nhạt + cursor pointer (chỉ khi có quyền write)
□ Click vào row → modal mở giữa màn hình, đúng ngày + buổi
□ Modal chỉ hiện entries của mình (không thấy entries của người khác)
□ Admin → thấy tất cả entries trong modal
□ Click "Thêm dòng" → form rỗng xuất hiện
□ Nhập nội dung → click "Lưu" → entry xuất hiện trong bảng
□ Sửa entry → click "Cập nhật" → bảng cập nhật
□ Xóa entry → entry biến khỏi bảng
□ Click row khác → modal chuyển sang slot mới
□ Click ✕ → modal đóng
□ Nhấn Escape → modal đóng
□ Click ra ngoài modal (backdrop) → modal đóng
□ Đổi tuần/phòng ban → modal tự đóng
□ User không có quyền write → không thể click, không mở modal
```
