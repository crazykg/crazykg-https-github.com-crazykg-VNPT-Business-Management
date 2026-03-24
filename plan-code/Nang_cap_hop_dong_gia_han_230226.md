# Nâng cấp Hợp đồng: Phụ lục, Gia hạn & Dòng tiền liên tục

**Version:** 1.4 — 2026-03-23 (sau Codex Round 4 — ISSUE-10 và ISSUE-15 schema/settings docs fixed)
**Author:** QLCV Engineering
**Status:** Under Review

---

## 1. Bối cảnh & Vấn đề

Hệ thống hiện tại quản lý hợp đồng như các đơn vị độc lập. Không có cơ chế liên kết hợp đồng gốc với phụ lục gia hạn. Điều này dẫn đến:

- **Mất mạch dòng tiền**: khi HĐ A hết hạn 31/12/2026 và Phụ lục B bắt đầu 01/01/2027, hệ thống không nhận ra chúng cùng một nguồn doanh thu.
- **Không cảnh báo khoảng trống**: nếu khách hàng ký muộn (15/01/2027), hệ thống không biết có 15 ngày "gap" ảnh hưởng doanh thu.
- **Không áp dụng logic chiết khấu/phạt**: manager không có dữ liệu để áp giá trị thanh toán thấp hơn khi gia hạn trễ.

### Kịch bản cụ thể

```
HĐ A (gốc):   [01/01/2026 ─────────────────────────── 31/12/2026]  value=10.000.000đ/tháng

Phụ lục B — liên tục (ngay ngày kế tiếp):
              [01/01/2027 ──── 31/03/2027]  gap_days=1 → CONTINUOUS → 100% = 10.000.000đ/tháng

Phụ lục C — trễ 15 ngày:
              [15/01/2027 ── 31/03/2027]  gap_days=15 → GAP
              → nếu grace=0: penalty=5% → expected=9.500.000đ/tháng
              → nếu grace=15: penalty_rate=null → expected=10.000.000đ/tháng (trong ân hạn)
```

---

## 2. Goals & Acceptance Criteria

### Goals
1. Liên kết phụ lục với HĐ gốc (parent–child chain, **tối đa 10 cấp**).
2. Tự động tính `gap_days` = khoảng cách ngày giữa hết hạn HĐ gốc và hiệu lực phụ lục.
3. Xác định `continuity_status` **thuần theo ngày, không phụ thuộc grace period**:
   - `STANDALONE` (không có parent), `EARLY` (gap≤0), `CONTINUOUS` (gap=1), `GAP` (gap>1).
   - **Grace period chỉ ảnh hưởng `penalty_rate`, không thay đổi `continuity_status`.**
4. Áp dụng `penalty_rate` dựa trên `gap_days` theo cấu hình; tự động điều chỉnh `expected_amount` các kỳ thanh toán.
5. Hiển thị chain HĐ gốc → phụ lục trên UI, cảnh báo rõ khi có gap.
6. KPI dashboard phản ánh: số HĐ có gap, tỷ lệ gia hạn liên tục, dòng tiền bị gián đoạn.
7. Admin có thể thay đổi penalty config qua UI.

### Acceptance Criteria
- [ ] Tạo phụ lục với `parent_contract_id` → `gap_days` và `continuity_status` được tính đúng.
- [ ] `gap_days = 1`, `continuity_status = CONTINUOUS` khi addendum.effective_date = parent.expiry_date + 1 ngày (ngay ngày tiếp nối).
- [ ] `gap_days = 15`, `continuity_status = GAP` khi addendum.effective_date = parent.expiry_date + 15 ngày (15/01 khi parent hết hạn 31/12).
- [ ] `penalty_rate = 0.0500` (chính xác 4 chữ số thập phân) khi gap=15, grace=0, rate/day=0.003333.
- [ ] `penalty_rate = null` khi `gap_days <= 1 + grace_period_days` (CONTINUOUS, EARLY, hoặc GAP trong ân hạn).
- [ ] `penalty_rate` không vượt `max_penalty_rate` (cap).
- [ ] Penalty config đọc/ghi qua `/api/v5/utilities/contract-renewal-settings`, admin UI có form tương ứng.
- [ ] Payment schedules của addendum có `expected_amount = original_amount * (1 - penalty_rate)`.
- [ ] DRAFT addendum với `parent_contract_id` nhưng không có `effective_date`: `gap_days = null`, `continuity_status = STANDALONE` — không bị reject.
- [ ] Khi DRAFT addendum được cập nhật thêm `effective_date`: tự động recompute gap/status/penalty.
- [ ] Circular parent bị reject: tạo phụ lục với `parent_contract_id` trỏ về chính nó hoặc ancestor chain → ValidationException.
- [ ] Parent soft-deleted: child giữ `parent_contract_id` (vẫn truy vết được), nhưng `continuity_status` tự động reset về `STANDALONE`.
- [ ] Chain traversal dùng `withTrashed()` và trong `parent_contract` summary có `deleted_at: string|null` để frontend biết parent đã bị xóa.
- [ ] UI hiển thị badge "Liên tục" / "Trễ 15n" / "Sớm 5n" trên dòng phụ lục trong bảng.
- [ ] KPI `gap_count` và `continuity_rate` hiển thị đúng theo công thức đã định nghĩa.
- [ ] `php artisan test --filter=ContractAddendu` pass 100%.

---

## 3. Thiết kế Database

### 3.1 Migration: `add_addendum_columns_to_contracts`

```sql
ALTER TABLE contracts
  ADD COLUMN parent_contract_id BIGINT UNSIGNED NULL
      COMMENT 'FK → contracts.id — HĐ gốc của phụ lục này',
  ADD COLUMN addendum_type VARCHAR(32) NULL
      COMMENT 'EXTENSION | AMENDMENT | LIQUIDATION',
  ADD COLUMN gap_days INT NULL
      COMMENT 'Khoảng cách ngày: gap≤0=EARLY, gap=1=CONTINUOUS, gap>1=GAP. Công thức: parent.expiry_date.diffInDays(effective_date). NULL khi DRAFT hoặc thiếu effective_date',
  ADD COLUMN continuity_status VARCHAR(32) NULL DEFAULT 'STANDALONE'
      COMMENT 'STANDALONE | EARLY(gap≤0) | CONTINUOUS(gap=1) | GAP(gap>1) — thuần ngày, không phụ thuộc grace',
  ADD COLUMN penalty_rate DECIMAL(5,4) NULL DEFAULT NULL
      COMMENT 'Tỷ lệ giảm giá trị thanh toán (0.0500 = 5%). NULL = không phạt',
  ADD INDEX idx_contracts_parent (parent_contract_id),
  ADD CONSTRAINT fk_contracts_parent
    FOREIGN KEY (parent_contract_id) REFERENCES contracts(id) ON DELETE RESTRICT;
```

> **⚠ ISSUE-6 fix:** Dùng `ON DELETE RESTRICT` thay `ON DELETE SET NULL` vì contracts dùng soft delete — ON DELETE chỉ kích hoạt với hard delete. Soft-delete của parent được xử lý ở application layer (xem §4.6).

**Constraints:**
- `parent_contract_id` tối đa 10 cấp chain depth; service validate khi store/update.
- `addendum_type`: `EXTENSION`, `AMENDMENT`, `LIQUIDATION`.
- `continuity_status`: `STANDALONE` | `EARLY` (gap≤0) | `CONTINUOUS` (gap=1) | `GAP` (gap>1).
- `gap_days` = `NULL` khi parent_contract_id IS NULL HOẶC khi chưa có `effective_date`.
- `penalty_rate` = `NULL` khi `gap_days IS NULL` hoặc `gap_days <= 1 + grace_days` (CONTINUOUS, EARLY, hoặc GAP trong ân hạn).

### 3.2 Migration: `add_renewal_settings_to_integration_settings`

Thêm 3 key vào bảng `integration_settings`:

| key | value mặc định | type | description |
|-----|----------------|------|-------------|
| `contract_renewal_grace_days` | `0` | int | Ngày ân hạn — `gap_days <= 1 + grace_days` → `penalty_rate = null` (nhưng `continuity_status` vẫn `GAP` khi gap>1) |
| `contract_renewal_penalty_rate_per_day` | `0.003333` | decimal(10,6) | Tỷ lệ phạt /ngày; kết quả được round(4, HALF_UP) |
| `contract_renewal_max_penalty_rate` | `0.1500` | decimal(5,4) | Trần phạt tối đa |

> **⚠ ISSUE-2 fix:** Sau khi tính `$raw = $penaltyDays * $ratePerDay`, áp dụng `round($raw, 4, PHP_ROUND_HALF_UP)` **trước** khi compare với max. Ví dụ: `15 × 0.003333 = 0.049995` → `round(0.049995, 4, PHP_ROUND_HALF_UP) = 0.0500`. Giá trị được persist vào `contracts.penalty_rate` là `0.0500`.

### 3.3 Migration: `add_penalty_columns_to_payment_schedules`

```sql
ALTER TABLE payment_schedules
  ADD COLUMN original_amount DECIMAL(18,2) NULL
      COMMENT 'Giá trị gốc trước khi áp dụng penalty',
  ADD COLUMN penalty_rate DECIMAL(5,4) NULL DEFAULT NULL
      COMMENT 'Copy từ contract.penalty_rate tại thời điểm generate',
  ADD COLUMN penalty_amount DECIMAL(18,2) NULL
      COMMENT 'Số tiền bị trừ: original_amount * penalty_rate (làm tròn về 0 VND)';
```

**Bất biến:** `expected_amount = original_amount - penalty_amount` khi penalty > 0.
Các payment_schedules của HĐ không có penalty: `original_amount = NULL`, `penalty_rate = NULL`, `penalty_amount = NULL` (backward compatible — không đụng đến dữ liệu cũ).

---

## 4. Logic Nghiệp vụ

### 4.1 Tính gap_days

> **⚠ ISSUE-10 fix:** Công thức duy nhất — `gap_days = parent.expiry_date.diffInDays(effective_date)`. Không trừ/cộng 1. Mọi ví dụ, acceptance, test đều dùng công thức này.

```
gap_days = số ngày lịch từ parent.expiry_date đến addendum.effective_date (có dấu)

Ví dụ CHUẨN (parent.expiry_date = 2026-12-31):
  addendum.effective_date = 2027-01-01  →  gap_days = 1   → CONTINUOUS (ngay ngày kế tiếp)
  addendum.effective_date = 2027-01-15  →  gap_days = 15  → GAP 15 ngày ✓ (user intent: "trễ 15 ngày")
  addendum.effective_date = 2026-12-20  →  gap_days = -11 → EARLY 11 ngày
  addendum.effective_date = 2026-12-31  →  gap_days = 0   → EARLY (overlap cùng ngày)
```

Công thức PHP:
```php
// startOfDay() để loại bỏ timezone drift
$parentExpiry = Carbon::parse($parent->expiry_date)->startOfDay();
$actualStart  = Carbon::parse($addendumEffectiveDate)->startOfDay();
$gapDays      = (int) $parentExpiry->diffInDays($actualStart, false);
// diffInDays($other, false): positive khi actualStart > parentExpiry, negative khi sớm hơn
```

**Pre-condition:** Chỉ compute khi `parent->expiry_date` và `addendum->effective_date` đều không null. Nếu một trong hai null → `gap_days = null`, `continuity_status = 'STANDALONE'`.

### 4.2 Xác định continuity_status *(thuần ngày, không phụ thuộc grace)*

```php
if ($gapDays === null)  → 'STANDALONE'  // thiếu dates, defer
if ($gapDays <= 0)      → 'EARLY'       // cùng ngày hoặc overlap — cần warning
if ($gapDays === 1)     → 'CONTINUOUS'  // ngay ngày kế tiếp — liên tục hoàn hảo
if ($gapDays > 1)       → 'GAP'         // có khoảng trống — bất kể grace hay không
```

> Grace period KHÔNG thay đổi `continuity_status`. Addendum với `gap_days = 3` và `grace_days = 5` vẫn là `GAP`, nhưng `penalty_rate = null` (no penalty). UI: "Trễ 3 ngày (miễn phạt)".

### 4.3 Tính penalty_rate

```php
$config = $this->renewalService->resolveRenewalConfig();
// $config = ['grace_days' => int, 'rate_per_day' => float, 'max_rate' => float]

// ⚠ ISSUE-15 fix: guard duy nhất là gap_days <= 1 + grace_days
// Bao gồm: EARLY(gap≤0), CONTINUOUS(gap=1), và GAP trong ân hạn (2..1+grace)
if ($gapDays === null || $gapDays <= 1 + $config['grace_days']) {
    $penaltyRate = null;
} else {
    // penaltyDays = gap_days (không trừ 1) — user nhận biết "trễ N ngày" = gap_days=N
    // Verification: gap=15, grace=0 → 15 × 0.003333 = 0.049995 → round = 0.0500 ✓
    $rawRate     = $gapDays * $config['rate_per_day'];
    $rounded     = round($rawRate, 4, PHP_ROUND_HALF_UP); // ⚠ bắt buộc round trước cap
    $penaltyRate = min($rounded, $config['max_rate']);
}
```

**Ví dụ tính toán đầy đủ — bảng chuẩn (gap_days = expiry.diffInDays(effective)):**
| gap | grace | guard (gap ≤ 1+grace) | raw = gap×rate | rounded(4,HALF_UP) | cap(0.15) | penalty_rate |
|-----|-------|----------------------|----------------|---------------------|-----------|--------------|
| 1   | 0     | 1 ≤ 1 → **null**     | —              | —                   | —         | null (CONTINUOUS)|
| 2   | 0     | 2 ≤ 1 → NO           | 0.006666       | 0.0067              | 0.0067    | 0.0067       |
| 6   | 5     | 6 ≤ 6 → **null**     | —              | —                   | —         | null (boundary ✓)|
| 7   | 5     | 7 ≤ 6 → NO           | 0.023331       | 0.0233              | 0.0233    | 0.0233       |
| 15  | 0     | 15 ≤ 1 → NO          | 0.049995       | **0.0500**          | 0.0500    | **0.0500 ✓** |
| 15  | 15    | 15 ≤ 16 → **null**   | —              | —                   | —         | null (in grace ✓)|
| 100 | 0     | 100 ≤ 1 → NO         | 0.333300       | 0.3333              | **0.1500**| 0.1500 (capped)|

### 4.4 Áp dụng penalty vào payment_schedules

Khi `generateContractPayments()` (`ContractPaymentService`) được gọi trên addendum contract:
```
original_amount = base_amount_per_cycle  (tính theo contract.value và payment_cycle bình thường)
penalty_rate    = contract.penalty_rate  (null nếu không có penalty)

Nếu penalty_rate IS NOT NULL:
  penalty_amount  = round(original_amount * penalty_rate, 0)  // làm tròn đến VND
  expected_amount = original_amount - penalty_amount

Nếu penalty_rate IS NULL:
  original_amount = NULL (không ghi vào DB)
  penalty_amount  = NULL
  expected_amount = base_amount_per_cycle  (như bình thường)
```

**Rule:** Penalty áp dụng đều cho tất cả kỳ trong phụ lục. Ba kỳ MONTHLY với penalty 5%: mỗi kỳ đều giảm 5%.

### 4.5 Circular reference guard

```php
// Dùng trong ContractRenewalService::validateNoCircularParent()
// Chỉ gọi khi UPDATE (thay đổi parent_contract_id của contract đã có ID)
// Khi CREATE mới: không thể circular vì contract chưa tồn tại

private function validateNoCircularParent(int $existingContractId, int $proposedParentId): void
{
    if ($existingContractId === $proposedParentId) {
        throw ValidationException::withMessages(['parent_contract_id' => 'Hợp đồng không thể là phụ lục của chính nó.']);
    }
    // Duyệt ancestor chain của proposedParent
    $depth   = 0;
    $current = $proposedParentId;
    while ($current !== null && $depth <= 10) {
        if ($current === $existingContractId) {
            throw ValidationException::withMessages(['parent_contract_id' => 'Tham chiếu vòng tròn trong chain hợp đồng.']);
        }
        $current = Contract::withTrashed()->find($current)?->parent_contract_id;
        $depth++;
    }
    if ($depth > 10) {
        throw ValidationException::withMessages(['parent_contract_id' => 'Chain hợp đồng vượt quá 10 cấp.']);
    }
}
```

### 4.6 Soft-delete của parent contract

> **⚠ ISSUE-6 fix:** `ON DELETE RESTRICT` trên FK, soft delete xử lý ở application layer.

Khi parent bị soft-deleted:
1. Service-level: `ContractDomainService::destroy()` — trước khi soft-delete parent, set `continuity_status = 'STANDALONE'` cho tất cả **direct children** (không recursive, vì children vẫn cần biết chain history).
2. `parent_contract_id` của children **không được set null** — giữ lại để truy vết.
3. Serialization: `parent_contract` summary sẽ có thêm field `deleted_at: string|null` — khi không null thì parent đã bị xóa (chuẩn hóa theo tên field thực trong DB, thống nhất với §5.4 và §6.1).
4. Chain traversal dùng `Contract::withTrashed()->find($id)`.
5. UI: hiển thị "HĐ gốc đã bị xóa" (italic, màu xám) thay vì code thực.

### 4.7 Recomputation lifecycle

> **⚠ ISSUE-5 fix:** Định nghĩa rõ khi nào cần recompute.

| Trigger | Scope | Cách xử lý |
|---------|-------|-------------|
| Addendum `effective_date` thay đổi | Chính addendum | Sync trong `update()` — recompute gap/status/penalty |
| Addendum `parent_contract_id` thay đổi | Chính addendum | Sync trong `update()` — recompute toàn bộ |
| Parent `expiry_date` thay đổi | Direct children (1 cấp) | Dispatch `RecomputeChildRenewalMetaJob` (queued) |
| Penalty config settings thay đổi | Không tự động | On-demand via `POST /api/v5/utilities/contract-renewal-settings/recalculate` |
| Parent bị soft-deleted | Direct children | Sync trong `destroy()` — reset `continuity_status = 'STANDALONE'` |

`RecomputeChildRenewalMetaJob`: load tất cả `contracts` với `parent_contract_id = $parentId` (không withTrashed). Với mỗi child:
1. Recompute `gap_days`, `continuity_status`, `penalty_rate` → save contract.
2. Gọi `applyPenaltyToSchedules($child->id, $child->penalty_rate)`:
   - Cập nhật `original_amount`, `penalty_rate`, `penalty_amount`, `expected_amount` cho schedules có status `PENDING / INVOICED / OVERDUE`.
   - Bỏ qua schedules `PAID / PARTIAL / CANCELLED` — preserve accounting data.
3. Không regenerate (delete+insert) toàn bộ schedules — chỉ update penalty fields trên rows hiện có.

---

## 5. Backend — Cấu trúc Code

### 5.0 Chính sách hasColumn() guards *(ISSUE-16 fix)*

> Codebase đã dùng `$this->support->hasColumn($table, $col)` làm guard cho schema resilience. **Tất cả** reads/writes/selects cho các cột mới phải tuân theo cùng quy tắc:

| Cột mới | Table | Guard required? | Pattern |
|---------|-------|-----------------|---------|
| `parent_contract_id` | `contracts` | ✅ | `if ($this->support->hasColumn('contracts', 'parent_contract_id'))` |
| `addendum_type` | `contracts` | ✅ | trước khi write |
| `gap_days` | `contracts` | ✅ | trước KPI SELECT và write |
| `continuity_status` | `contracts` | ✅ | trước KPI SELECT và write |
| `penalty_rate` | `contracts` | ✅ | trước KPI SELECT và write |
| `original_amount` | `payment_schedules` | ✅ | trước khi write/read (đã có trong §5.3) |
| `penalty_rate` | `payment_schedules` | ✅ | trước khi write/read |
| `penalty_amount` | `payment_schedules` | ✅ | trước khi write/read |

**Quy tắc fallback:** Nếu cột chưa exist (schema chưa migrate):
- Read/KPI: coi như 0 / null / 'STANDALONE'
- Write: skip field — không ném exception
- Serialization: trả về null cho field đó

`ContractRenewalService` nhận `V5DomainSupportService $support` qua dependency injection để dùng `hasColumn()`.

### 5.1 Service mới: `ContractRenewalService`

File: `backend/app/Services/V5/Contract/ContractRenewalService.php`

```
Methods:
├── computeGapDays(?string $parentExpiryDate, ?string $addendumEffectiveDate): ?int
│     → null nếu một trong hai là null
├── computeContinuityStatus(?int $gapDays): string
│     → 'STANDALONE'|'EARLY'|'CONTINUOUS'|'GAP'
├── computePenaltyRate(?int $gapDays, array $config): ?float
│     → null nếu gap null, gap≤1 (CONTINUOUS/EARLY), hoặc gap trong grace; float(4dp) HALF_UP nếu gap > 1+grace
├── applyRenewalMetaToContract(Contract $addendum, ?Contract $parent, ?string $effectiveDateOverride = null): void
│     → signature nhất quán: 2 bắt buộc + 1 optional. Khi gọi từ store(): $effectiveDateOverride=null (dates đã trên model)
│     → Khi gọi từ update() với effective_date thay đổi chưa save: truyền $effectiveDateOverride = $newEffectiveDate
│     → sets gap_days, continuity_status, penalty_rate trên model (chưa save — caller save)
├── applyPenaltyToSchedules(int $contractId, ?float $penaltyRate): void
│     → Cập nhật PENDING/INVOICED/OVERDUE schedules với penalty fields mới
│     → Bỏ qua PAID/PARTIAL/CANCELLED schedules (preserve accounting data)
├── resolveRenewalConfig(): array{grace_days:int, rate_per_day:float, max_rate:float}
├── validateNoCircularParent(int $existingContractId, int $proposedParentId): void
│     → throws ValidationException; chỉ gọi khi UPDATE
└── validateChainDepthForCreate(int $parentId): void
      → throws nếu parent's ancestor chain >= 10 levels
```

### 5.2 Sửa `ContractDomainService`

**store() — sequence đầy đủ:**

> **⚠ ISSUE-3 & 4 fix:** Xử lý DRAFT không có dates; không dùng `$contractId` trước khi save.

```
1. Validate input (thêm parent_contract_id, addendum_type vào rules)
2. Nếu parent_contract_id present:
   a. Load parent = Contract::find($parentId) — reject nếu không tồn tại
   b. Gọi renewalService->validateChainDepthForCreate($parentId)
   c. [Không gọi validateNoCircularParent — new contract không có ID, không thể circular]
3. Tạo Contract instance, điền các fields từ $validated
4. Nếu parent present AND effective_date present:
   a. renewalService->applyRenewalMetaToContract($contract, $parent)
      (sets gap_days, continuity_status, penalty_rate trên instance)
5. Nếu parent present AND effective_date absent (DRAFT):
   a. $contract->continuity_status = 'STANDALONE'  // deferred
   b. $contract->gap_days = null
   c. $contract->penalty_rate = null
6. $contract->save()
7. Sync items nếu có
8. Return serialized contract
```

**update() — sequence đầy đủ:**

```
1. Validate input
2. Xác định có cần recompute renewal meta không:
   $needsRecompute = isset($validated['effective_date']) || isset($validated['parent_contract_id'])
3. Nếu $needsRecompute:
   a. Resolve parent:
      - Dùng $validated['parent_contract_id'] nếu có, else $contract->parent_contract_id
   b. Nếu parent_contract_id thay đổi:
      - Gọi renewalService->validateNoCircularParent($contract->id, $newParentId)
      - Gọi renewalService->validateChainDepthForCreate($newParentId)
   c. Resolve effective_date:
      - Dùng $validated['effective_date'] nếu có, else $contract->effective_date
   d. Load parent contract (with trashed nếu cần)
   e. Gọi renewalService->applyRenewalMetaToContract($contract, $parent, $resolvedEffectiveDate)
      // truyền $resolvedEffectiveDate (string|null) thay vì để method đọc từ model chưa saved
4. $contract->fill($validated)->save()
5. Nếu renewal meta recomputed VÀ payment_schedules tồn tại:
   - Gọi renewalService->applyPenaltyToSchedules($contract->id, $contract->penalty_rate)
     (chỉ update schedules chưa có PAID/PARTIAL payments)
```

**store/update validation rules — thêm:**
```php
'parent_contract_id' => ['nullable', 'integer', 'exists:contracts,id'],
'addendum_type'      => ['nullable', Rule::in(['EXTENSION', 'AMENDMENT', 'LIQUIDATION'])],
// Không thêm required cho effective_date khi có parent — DRAFT được phép thiếu dates
```

**destroy() — thêm:**
```php
// Trước khi soft-delete: reset continuity_status của direct children
Contract::where('parent_contract_id', $contract->id)
    ->update(['continuity_status' => 'STANDALONE']);
```

**buildContractKpis() — KPI mới:**

> **⚠ ISSUE-9 fix:** Công thức KPI được lock down.

```php
// Thêm vào SELECT:
'addendum_count'  => SUM(CASE WHEN parent_contract_id IS NOT NULL THEN 1 ELSE 0 END)
'gap_count'       => SUM(CASE WHEN continuity_status = 'GAP' THEN 1 ELSE 0 END)

// continuity_rate: tính sau khi có counts
// Mẫu số = CONTINUOUS + GAP (không tính EARLY — ký sớm được coi là "tốt", không vào mẫu số)
// Tử số = CONTINUOUS
$continuousCount = SUM(CASE WHEN continuity_status = 'CONTINUOUS' THEN 1 ELSE 0 END)
$denominator     = $continuousCount + $gapCount
$continuityRate  = $denominator > 0 ? intval($continuousCount / $denominator * 100) : 100
```

### 5.3 Sửa `ContractPaymentService::generateContractPayments()`

> **⚠ ISSUE-14 fix:** Method thực là `generateContractPayments()` (public, line ~220). Penalty logic được inject vào **vòng lặp row-building** tại `foreach ($scheduleSpecs as $index => $scheduleSpec)` — nơi mà `$row['expected_amount']` được gán trước khi insert batch vào DB.

```php
// Trong vòng lặp row-building (foreach $scheduleSpecs):
$penaltyRate = $contract->penalty_rate; // float|null từ contract model

if ($this->support->hasColumn('payment_schedules', 'original_amount')
    && $penaltyRate !== null && $penaltyRate > 0) {
    $originalAmount = max(0, $expectedAmount);
    $penaltyAmount  = (int) round($originalAmount * $penaltyRate, 0); // VND, no cents
    $expectedAmount = $originalAmount - $penaltyAmount;
    $row['original_amount'] = $originalAmount;
    $row['penalty_rate']    = $penaltyRate;
    $row['penalty_amount']  = $penaltyAmount;
} else {
    // backward compat: không ghi penalty columns cho HĐ không có penalty
    if ($this->support->hasColumn('payment_schedules', 'original_amount')) {
        $row['original_amount'] = null;
        $row['penalty_rate']    = null;
        $row['penalty_amount']  = null;
    }
}
$row['expected_amount'] = max(0, $expectedAmount);
```

### 5.4 Serialization — sửa `V5DomainSupportService::serializeContract()`

```php
'parent_contract_id' => $contract->parent_contract_id,
'addendum_type'      => $contract->addendum_type,
'gap_days'           => $contract->gap_days,
'continuity_status'  => $contract->continuity_status ?? 'STANDALONE',
'penalty_rate'       => $contract->penalty_rate,
'parent_contract'    => $this->resolveParentSummary($contract),
// resolveParentSummary: dùng withTrashed, trả về {id, contract_code, contract_name, expiry_date, deleted_at: string|null}
// deleted_at = null nếu parent còn active; ISO string nếu đã bị soft-deleted
// null nếu không có parent (STANDALONE)
```

> `addendum_chain` (list of children) chỉ trả về khi load detail endpoint (`show()`), không load trong list để tránh N+1.

### 5.5 Routes — thêm endpoints

```php
// GET /api/v5/contracts/{id}/addendum-chain
Route::get('/contracts/{id}/addendum-chain', [ContractController::class, 'addendumChain'])
    ->middleware('permission:contracts.read');

// GET /api/v5/utilities/contract-renewal-settings
Route::get('/utilities/contract-renewal-settings', [IntegrationSettingsController::class, 'contractRenewalSettings'])
    ->middleware('permission:integration-settings.read');

// PUT /api/v5/utilities/contract-renewal-settings
Route::put('/utilities/contract-renewal-settings', [IntegrationSettingsController::class, 'updateContractRenewalSettings'])
    ->middleware('permission:integration-settings.write');

// POST /api/v5/utilities/contract-renewal-settings/recalculate
// → Trigger recompute penalty_rate cho tất cả addenda (on-demand, queued)
Route::post('/utilities/contract-renewal-settings/recalculate', [IntegrationSettingsController::class, 'recalculateRenewalPenalties'])
    ->middleware('permission:integration-settings.write');
```

---

## 6. Frontend — Thay đổi

### 6.1 Types — thêm vào `Contract` interface (`frontend/types.ts`)

```typescript
parent_contract_id?: number | string | null;
addendum_type?: 'EXTENSION' | 'AMENDMENT' | 'LIQUIDATION' | null;
gap_days?: number | null;
continuity_status?: 'STANDALONE' | 'EARLY' | 'CONTINUOUS' | 'GAP' | null;
penalty_rate?: number | null; // 0.0500 = 5%
parent_contract?: {
  id: number;
  contract_code: string;
  contract_name: string;
  expiry_date?: string | null;
  deleted_at?: string | null; // null = active; ISO string = đã bị soft-deleted
} | null;
```

Thêm vào `PaginationMeta.kpis`:
```typescript
addendum_count?: number;
gap_count?: number;
continuity_rate?: number; // 0-100
```

### 6.2 ContractList.tsx — bảng danh sách

**Badge "Liên kết" trên cột Mã HĐ** (không thêm cột riêng để giữ bảng gọn):
- HĐ có `parent_contract_id`: hiển thị icon `account_tree` + tooltip "Phụ lục của {parent_code}"
- `continuity_status = 'GAP'` + `penalty_rate > 0`: badge đỏ "Trễ {N}n (-{X}%)"
- `continuity_status = 'GAP'` + `penalty_rate = null`: badge cam "Trễ {N}n (miễn phạt)"
- `continuity_status = 'EARLY'`: badge tím nhạt "Sớm {|N|}n"
- `continuity_status = 'CONTINUOUS'`: badge xanh nhạt "Liên tục"

**Thêm filter "Loại HĐ":** dropdown `Tất cả | HĐ gốc | Phụ lục | Có khoảng trống`

**KPI strip — bắt buộc:**

> **⚠ ISSUE-9 fix:** Định nghĩa một phương án duy nhất — không có "hoặc".

- KPI #6 "Sắp hết hiệu lực": **thêm badge đỏ nhỏ `gap_count` cảnh báo** nếu > 0, tooltip "Có {N} phụ lục bị gián đoạn".
- KPI #2 "Ký kết trong kỳ": thêm sub-text `continuity_rate`% màu xanh nếu ≥ 80%, cam nếu < 80%.

### 6.3 Modal tạo/sửa HĐ — section "Phụ lục"

```
Section: Phụ lục hợp đồng (toggle — ẩn theo mặc định)
├── HĐ gốc: [SearchableSelect → debounce 300ms → tìm theo mã/tên HĐ]
│           (bắt buộc khi section mở)
├── Loại phụ lục: [Gia hạn | Sửa đổi | Thanh lý]  (bắt buộc khi section mở)
└── Preview tự động (hiện khi CẢ HAI parent đã chọn VÀ effective_date đã nhập):
    ├── Khoảng cách: {N} ngày   → màu xanh lá (gap=1, CONTINUOUS), tím nhạt (gap≤0, EARLY), cam (gap>1 within grace), đỏ (gap>1+grace)
    ├── Trạng thái: badge CONTINUOUS / GAP / EARLY
    ├── Tỷ lệ penalty: {X}% (hoặc "Không phạt — trong ân hạn {M} ngày")
    └── Giá trị TT dự kiến: {Y}đ/kỳ (tính từ contract.value và payment_cycle)
```

**Compute preview client-side** dùng cùng logic với backend (grace period fetch từ `/api/v5/utilities/contract-renewal-settings`).

### 6.4 ContractRevenueView — Timeline chain

- HĐ có `parent_contract_id`: vẽ đường nối sang trái đến HĐ gốc (nếu đang hiển thị cùng viewport)
- Tô màu đoạn gap giữa HĐ gốc và phụ lục: đỏ nhạt nếu `continuity_status = GAP`
- Hiển thị `original_amount` gạch ngang và `expected_amount` bold khi có penalty
- HĐ gốc đã bị xóa: hiển thị "(đã xóa)" italic

### 6.5 Admin UI — Cài đặt Gia hạn *(ISSUE-7 fix)*

Vị trí: tab "Tiện ích" → panel "Cài đặt hợp đồng" → section "Gia hạn & Phụ lục".

```
Fields:
├── Ngày ân hạn (grace_days): [number input, min=0, max=365]
├── Tỷ lệ phạt / ngày trễ (%): [decimal input, default=0.3333%, step=0.0001]
├── Tỷ lệ phạt tối đa (%): [decimal input, default=15%, max=100%]
└── [Lưu cài đặt] + [Áp dụng lại cho tất cả phụ lục chưa có lịch TT]
    → button "Áp dụng lại" gọi POST /recalculate (confirm dialog trước)
```

---

## 7. Thứ tự Thực hiện (Sequence)

```
Phase 1 — Database & Backend core
├── Step 1: Migration add_addendum_columns_to_contracts (ON DELETE RESTRICT)
├── Step 2: Migration add_penalty_columns_to_payment_schedules
├── Step 3: Migration add_renewal_settings_to_integration_settings (3 keys)
├── Step 4: ContractRenewalService + unit tests (tất cả methods)
├── Step 5: ContractDomainService::store() + destroy() tích hợp RenewalService
├── Step 6: ContractDomainService::update() tích hợp RenewalService
├── Step 7: RecomputeChildRenewalMetaJob (queued job)
├── Step 8: ContractPaymentService::generateContractPayments() — inject penalty vào row-building loop
├── Step 9: serializeContract() thêm fields + resolveParentSummary()
├── Step 10: IntegrationSettingsController: contractRenewalSettings CRUD + recalculate endpoint
└── Step 11: PHPUnit tests (ContractAddendumCrudTest, ContractRenewalPenaltyTest)

Phase 2 — Frontend
├── Step 12: types.ts — thêm fields Contract + PaginationMeta.kpis
├── Step 13: ContractList.tsx — badge liên kết + filter "Loại HĐ" + KPI sub-metrics
├── Step 14: Modal tạo/sửa — section phụ lục + preview client-side
├── Step 15: ContractRevenueView — timeline chain với gap highlight
└── Step 16: Admin UI — panel cài đặt gia hạn (Tiện ích → Hợp đồng)
```

---

## 8. Test Cases

### Backend
```
ContractAddendumCrudTest:
  test_create_addendum_sets_continuous_when_no_gap()
    → effective=parent.expiry+1day → gap_days=1, continuity_status=CONTINUOUS, penalty_rate=null
  test_create_addendum_sets_gap_15_with_correct_penalty()
    → effective=2027-01-15, parent_expiry=2026-12-31 → gap_days=15 (Jan15-Dec31=15)
    → continuity_status=GAP
    → penalty_rate=0.0500 (15 × 0.003333 → round(4,HALF_UP) = 0.0500)
  test_create_addendum_within_grace_no_penalty()
    → gap_days=6, grace_days=5 → guard: 6 ≤ 1+5=6 → continuity_status=GAP, penalty_rate=null
    → Boundary: gap_days=7, grace_days=5 → 7 > 6 → penalty_rate=0.0233 (7×0.003333→0.0233)
  test_create_addendum_sets_early_status()
    → effective_date = parent.expiry_date (same day) → gap_days=0 → EARLY, penalty=null
  test_create_draft_addendum_without_dates_defers_computation()
    → status=DRAFT, no effective_date → gap_days=null, continuity_status=STANDALONE
  test_update_draft_addendum_with_effective_date_triggers_recompute()
    → add effective_date → gap_days và continuity_status được compute
  test_circular_parent_rejected_on_update()
    → ValidationException khi chain vòng tròn
  test_chain_depth_10_rejected()
    → ValidationException khi depth > 10
  test_parent_soft_delete_resets_child_continuity()
    → children.continuity_status = 'STANDALONE' sau khi parent bị xóa
  test_penalty_applied_to_payment_schedules()
    → gap=15, grace=0 → penalty_rate=0.0500 → expected_amount = original * 0.95
  test_penalty_capped_at_max_rate()
    → gap=100, rate/day=0.003333, max=0.15 → penalty_rate=0.1500
  test_penalty_null_when_within_grace()
    → gap=10, grace=15 → penalty_rate=null, expected_amount = original (unchanged)

ContractRenewalPenaltyTest (unit):
  test_gap_days_continuous()          → effective=expiry+1 → gap_days=1 → CONTINUOUS
  test_gap_days_late_15()             → effective=expiry+15 → gap_days=15 → GAP
  test_gap_days_early()               → effective=expiry (same day) → gap_days=0 → EARLY
  test_gap_days_null_when_no_dates()  → null
  test_penalty_rate_rounds_half_up()  → gap=15, grace=0, rate=0.003333 → 0.0500 ✓
  test_penalty_rate_grace_boundary()  → gap=6, grace=5 → guard 6≤1+5=6 → null (boundary)
  test_penalty_rate_grace_exceeded()  → gap=7, grace=5 → 7>6 → 7×0.003333=0.0233
  test_penalty_rate_capped()          → gap=100, grace=0 → 0.1500
  test_continuity_status_gap_despite_grace() → gap=6, grace=5 → 'GAP' (not 'CONTINUOUS')
  test_hascolumn_guard_skips_write_when_column_missing() → no exception, col skipped
```

### Frontend
```
__tests__/ContractAddendum.test.ts:
  test badge rendering: CONTINUOUS / GAP / EARLY / GAP+miễn phạt
  test preview panel: effective=Jan15, expiry=Dec31 → "Trễ 15 ngày (-5.00%)"
  test preview panel: gap=5, grace=5 → "Trễ 5 ngày (miễn phạt)"
  test parent deleted: parent_contract.deleted_at != null → show "(đã xóa)"
  test parent search async
  test admin settings form save → PUT /api/v5/utilities/contract-renewal-settings
```

---

## 9. Rủi ro & Mitigation

| Rủi ro | Severity | Mitigation |
|--------|----------|------------|
| Circular reference chain (A→B→A) | High | `validateNoCircularParent()` trong update(); CREATE không cần (ID chưa tồn tại) |
| Parent expiry_date thay đổi sau khi children đã có payment schedules | High | `RecomputeChildRenewalMetaJob` recompute meta; KHÔNG regenerate schedules đã PAID/PARTIAL |
| Settings thay đổi sau khi schedules đã tạo | Medium | On-demand recalculate endpoint; warn admin trước khi apply |
| Parent contract bị soft-deleted | Medium | `ON DELETE RESTRICT` (app layer); reset child `continuity_status = 'STANDALONE'`; withTrashed trong serialization |
| Gap tính sai do timezone | Low | `Carbon::parse(...)->startOfDay()` nhất quán cho tất cả date comparisons |
| User nhập effective_date trước khi chọn parent | Low | Preview ẩn cho đến khi cả 2 fields có giá trị |
| Chain quá dài (>10) | Medium | validateChainDepthForCreate() reject ngay tại store/update |
| Decimal rounding penalty khác nhau giữa PHP và TypeScript preview | Medium | Frontend dùng cùng logic: `Math.round(raw * 10000) / 10000`, cap về max_rate |

---

## 10. Không nằm trong scope (Out of Scope)

- Tự động chuyển trạng thái HĐ gốc → `RENEWED` khi tạo phụ lục (sẽ làm phase sau, yêu cầu workflow approval).
- Thông báo tự động (email/push) nhắc gia hạn trước N ngày.
- Import phụ lục hàng loạt từ Excel.
- Approval workflow cho phụ lục (multi-level sign-off).
- Penalty tier khác nhau theo loại khách hàng hoặc loại dịch vụ.
