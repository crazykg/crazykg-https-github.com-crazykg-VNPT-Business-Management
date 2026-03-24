# Hướng dẫn Chức năng Gia hạn Hợp đồng

**Phiên bản:** 1.1
**Cập nhật:** 2026-03-24
**Ngôn ngữ:** Tiếng Việt

---

## 1. Tổng quan chức năng

Chức năng **gia hạn hợp đồng** cho phép quản lý chuỗi các hợp đồng liên tiếp — từ hợp đồng gốc đến các phụ lục gia hạn, sửa đổi hoặc thanh lý.

Hệ thống **tự động tính toán 3 chỉ số quan trọng**:

| Chỉ số | Ý nghĩa | Dùng cho |
|---|---|---|
| **gap_days** | Số ngày chênh lệch giữa hết hạn HĐ gốc và hiệu lực HĐ mới | Phân tích độ liên tục |
| **continuity_status** | Phân loại loại gián đoạn (EARLY, CONTINUOUS, GAP, STANDALONE) | Báo cáo & điều chỉnh giá |
| **penalty_rate** | Tỷ lệ phạt do gián đoạn — **áp dụng bằng cách GIẢM expected_amount** | Tính giá thanh toán |

### Lợi ích chính:
✅ Tự động tính phạt gián đoạn (không cần tính toán thủ công)
✅ Theo dõi chuỗi gia hạn (biết được HĐ gốc và các con cháu)
✅ Cảnh báo khi gia hạn sớm/muộn so với quy định
✅ Cấp hình ảnh toàn bộ vòng đời hợp đồng
✅ Theo dõi dòng tiền liên tục qua KPI `continuity_rate` và `gap_count`

---

## 2. Khái niệm cơ bản

### 2.1 Hợp đồng gốc (Parent Contract)
- Là hợp đồng ban đầu với khách hàng
- Có ngày hết hạn (`expiry_date`)
- Status: `SIGNED` → `RENEWED` (khi có phụ lục gia hạn)

**Ví dụ:**
```
HD-2026-001: Hợp đồng cấp phép phần mềm
- Ngày ký: 2026-01-05
- Hết hạn: 2026-12-31
- Giá trị: 150,000,000 đ
- Status: SIGNED → RENEWED (khi tạo phụ lục)
```

### 2.2 Phụ lục / Addendum (Child Contract)
- Hợp đồng mới được tạo để gia hạn, sửa đổi, hoặc thanh lý hợp đồng gốc
- Có trường `parent_contract_id` trỏ về HĐ gốc
- Có loại phụ lục (`addendum_type`)

**Ví dụ:**
```
HD-2027-001: Phụ lục gia hạn
- Parent: HD-2026-001
- Hiệu lực: 2027-01-15
- Hết hạn: 2027-12-31
- Loại: EXTENSION (gia hạn)
- Gap days: 15 (từ 2026-12-31 đến 2027-01-15)
- Penalty rate: 5% → expected_amount bị GIẢM 5%
```

### 2.3 Loại phụ lục (Addendum Types)

| Loại | Mã | Ý nghĩa |
|---|---|---|
| **EXTENSION** | `EXTENSION` | Gia hạn thời gian (chiếm 80% các trường hợp) |
| **AMENDMENT** | `AMENDMENT` | Sửa đổi nội dung/điều khoản |
| **LIQUIDATION** | `LIQUIDATION` | Thanh lý/chấm dứt hợp đồng |

---

## 3. Các trạng thái continuity_status

Được tính dựa trên `gap_days`:

```
gap_days = ngày hiệu lực HĐ mới - ngày hết hạn HĐ gốc
```

### 3.1 Bảng phân loại

| Trạng thái | Điều kiện | Gap ngày | Ý nghĩa | Phạt |
|---|---|---|---|---|
| `EARLY` | gap ≤ 0 | -11, -5, 0 | Gia hạn sớm, không gián đoạn | ❌ Không |
| `CONTINUOUS` | gap = 1 | 1 | Gia hạn liên tục, lý tưởng | ❌ Không |
| `GAP` | gap > 1 | 2, 5, 15, 30 | Có gián đoạn, cần phạt | ✅ Có |
| `STANDALONE` | Không parent hoặc thiếu ngày | — | HĐ độc lập | ❌ Không |

### 3.2 Ví dụ thực tế

**HĐ gốc hết hạn: 2026-12-31**

```
Trường hợp 1: Hiệu lực 2026-12-20
  gap_days = -11  →  EARLY  →  Không phạt ✅

Trường hợp 2: Hiệu lực 2027-01-01
  gap_days = 1  →  CONTINUOUS  →  Không phạt ✅ ⭐ lý tưởng

Trường hợp 3: Hiệu lực 2027-01-15
  gap_days = 15  →  GAP  →  Phạt ⚠️

Trường hợp 4: Hiệu lực 2027-02-15
  gap_days = 46  →  GAP  →  Phạt lớn ⚠️⚠️
```

---

## 4. Công thức tính phạt

### 4.1 Quy tắc không phạt

Phạt = `null` (không tính phạt) khi:

- ❌ `gap_days` là null (thiếu ngày)
- ❌ `gap_days ≤ 0` (gia hạn sớm — EARLY)
- ❌ `gap_days = 1` (liên tục — CONTINUOUS)
- ❌ `gap_days ≤ 1 + grace_days` (trong kỳ ân hạn)

### 4.2 Công thức tính phạt

Khi `gap_days > 1 + grace_days`:

```
penalty_rate = gap_days × rate_per_day
penalty_rate = min(penalty_rate, max_rate)  // không vượt trần
penalty_rate = round(penalty_rate, 4 chữ số thập phân)
```

### 4.3 Cấu hình mặc định

| Tham số | Giá trị mặc định | Ý nghĩa |
|---|---|---|
| `grace_days` | 0 ngày | Số ngày ân hạn (miễn phạt sau CONTINUOUS) |
| `rate_per_day` | 0.003333 | % phạt mỗi ngày gián đoạn (0.3333%/ngày) |
| `max_rate` | 15% | Phạt tối đa (trần) |

### 4.4 Ví dụ tính phạt

**Cấu hình mặc định: grace = 0, rate = 0.003333, max = 15%**

```
gap = 0   →  EARLY    →  penalty = null
gap = 1   →  CONTINUOUS → penalty = null
gap = 2   →  GAP      →  penalty = 2 × 0.003333 = 0.0067 (0.67%)
gap = 5   →  GAP      →  penalty = 5 × 0.003333 = 0.0167 (1.67%)
gap = 15  →  GAP      →  penalty = 15 × 0.003333 = 0.05 (5%) ⭐
gap = 50  →  GAP      →  penalty = 50 × 0.003333 = 0.1667 → capped → 0.15 (15%)
```

**Với ân hạn grace = 7 ngày:**

```
gap = 7   →  ≤ 1+7=8  →  penalty = null (trong grace)
gap = 8   →  > 1+7=8  →  penalty = 8 × 0.003333 = 0.0267 (2.67%)
gap = 10  →  > 1+7=8  →  penalty = 10 × 0.003333 = 0.0333 (3.33%)
```

---

## 5. Cách tạo phụ lục gia hạn

### 5.1 Qua giao diện

**Tab: Hợp đồng → Nút "+ Phụ lục gia hạn"**

1. Chọn hợp đồng gốc từ dropdown
2. Chọn loại: `EXTENSION` / `AMENDMENT` / `LIQUIDATION`
3. Nhập thông tin HĐ mới:
   - Mã HĐ (tự động hoặc nhập)
   - Ngày ký
   - **Ngày hiệu lực** ⭐ (quan trọng — ảnh hưởng gap_days)
   - Ngày hết hạn
   - Giá trị
4. **Preview tự động hiện** (khi đã chọn HĐ gốc VÀ đã nhập ngày hiệu lực):
   - Khoảng cách gap: N ngày (màu xanh = CONTINUOUS, cam = GAP trong ân hạn, đỏ = GAP có phạt)
   - Trạng thái liên tục: CONTINUOUS / GAP / EARLY
   - Tỷ lệ phạt dự kiến: X%
   - **Doanh thu dự kiến/kỳ: Y đ** (= giá trị HĐ / số kỳ × (1 − penalty_rate))
5. Lưu → Hệ thống **tự động tính**:
   - gap_days
   - continuity_status
   - penalty_rate
6. HĐ gốc **tự động chuyển thành `RENEWED`** (chỉ cho EXTENSION)

### 5.2 Qua API

**Endpoint:** `POST /api/v5/contracts`

```bash
curl -X POST http://localhost:8002/api/v5/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "contract_code": "HD-2027-001",
    "contract_name": "Phụ lục gia hạn 2027",
    "customer_id": 1,
    "project_id": 1,
    "value": 150000000,
    "status": "SIGNED",
    "payment_cycle": "ONCE",
    "parent_contract_id": 42,
    "addendum_type": "EXTENSION",
    "sign_date": "2027-01-05",
    "effective_date": "2027-01-15",
    "expiry_date": "2027-12-31"
  }'
```

**Response:**
```json
{
  "data": {
    "id": 55,
    "contract_code": "HD-2027-001",
    "parent_contract_id": 42,
    "addendum_type": "EXTENSION",
    "gap_days": 15,
    "continuity_status": "GAP",
    "penalty_rate": 0.05,
    "parent_contract": {
      "id": 42,
      "contract_code": "HD-2026-001",
      "contract_name": "Hợp đồng gốc",
      "expiry_date": "2026-12-31",
      "deleted_at": null
    }
  }
}
```

> **Lưu ý:** `deleted_at: null` = HĐ gốc còn hiệu lực. Nếu HĐ gốc đã bị xóa mềm thì `deleted_at` sẽ chứa ISO timestamp và UI hiển thị "(đã xóa)" in nghiêng.

---

## 6. Tự động áp phạt vào kỳ thanh toán

### 6.1 Cơ chế hoạt động

Phạt gián đoạn được xử lý theo hướng **GIẢM doanh thu** (không phải tăng): khách hàng trả ít hơn vì dịch vụ không được cung cấp liên tục trong thời gian gián đoạn.

```
expected_amount = original_amount − penalty_amount
                = original_amount × (1 − penalty_rate)
```

> ⚠️ **Khác với phạt vi phạm HĐ thông thường** — phạt ở đây KHÔNG cộng thêm vào hóa đơn mà là sự điều chỉnh giảm doanh thu phản ánh thực tế dịch vụ bị gián đoạn.

### 6.2 Sinh kỳ thanh toán

Sau khi tạo phụ đồng gia hạn có phạt:

**Nút: "Sinh kỳ thanh toán"** → chọn hình thức (Một lần / Hàng tháng / ...)

Hệ thống sẽ:
1. Sinh các kỳ thanh toán dựa trên `value` và `payment_cycle`
2. **Tự động tính phạt** dựa trên `penalty_rate`
3. Lưu 3 cột audit trên mỗi kỳ:

| Cột | Ý nghĩa |
|---|---|
| `original_amount` | Giá trị gốc trước khi áp phạt |
| `penalty_rate` | Tỷ lệ phạt đã áp dụng tại thời điểm sinh kỳ |
| `penalty_amount` | Số tiền bị trừ |
| `expected_amount` | Giá trị thực tế khách hàng cần thanh toán |

### 6.3 Ví dụ tính toán đúng

```
HĐ gia hạn: HD-2027-001
  penalty_rate = 5% (0.05)
  original_amount (giá gốc) = 100,000,000 đ

Kỳ 1:
  original_amount  = 100,000,000 đ
  penalty_rate     = 5%
  penalty_amount   = 5,000,000 đ     (= 100,000,000 × 0.05, làm tròn xuống đến VND)
  expected_amount  = 95,000,000 đ ⭐  (= 100,000,000 − 5,000,000)
                     ← GIẢM so với gốc, không phải tăng

Kỳ 2 (nếu nhiều kỳ):
  Tương tự, mỗi kỳ đều bị trừ 5%

HĐ CONTINUOUS (gap=1, không phạt):
  original_amount  = 100,000,000 đ
  penalty_rate     = null
  penalty_amount   = null
  expected_amount  = 100,000,000 đ   (giữ nguyên, không thay đổi)
```

### 6.4 Kỳ thanh toán không bị phạt

Các kỳ với status sau **không bị tính phạt** (đảm bảo an toàn kế toán):

- ✅ `PAID` — đã thanh toán (khoá)
- ✅ `PARTIAL` — thanh toán một phần (khoá)
- ✅ `CANCELLED` — hủy bỏ (bỏ qua)

Chỉ các kỳ `PENDING` / `INVOICED` / `OVERDUE` bị tính phạt.

### 6.5 Hiển thị trong view doanh thu (ContractRevenueView)

Khi xem chi tiết kỳ thanh toán của phụ lục có penalty, giao diện hiển thị:

- `original_amount` **gạch ngang** (màu xám) — giá gốc đã bị giảm
- `expected_amount` **in đậm** (màu đỏ nhẹ) — giá thực tế sau phạt
- Nhãn: `-{X}% phạt gián đoạn`

**Ví dụ hiển thị:**

```
Kỳ 1 — Hợp đồng HD-2027-001
  Giá gốc:   ~~100,000,000 đ~~
  Sau phạt:    95,000,000 đ   (−5% phạt gián đoạn 15 ngày)
```

---

## 7. Xem thông tin gia hạn

### 7.1 Trong danh sách HĐ — Badge inline

**Tab: Hợp đồng → Bảng danh sách**

Thông tin gia hạn được hiển thị bằng **badge nhỏ ngay trên cột Mã HĐ** (không tạo cột riêng để bảng gọn hơn):

| Trường hợp | Badge | Màu |
|---|---|---|
| `GAP` + `penalty_rate > 0` | `Trễ {N}n (−{X}%)` | 🔴 Đỏ — doanh thu bị giảm |
| `GAP` + `penalty_rate = null` | `Trễ {N}n (miễn phạt)` | 🟠 Cam — gián đoạn nhưng không mất tiền |
| `EARLY` | `Sớm {|N|}n` | 🟣 Tím nhạt |
| `CONTINUOUS` | `Liên tục` | 🟢 Xanh nhạt |
| Icon `account_tree` | (tooltip: "Phụ lục của {parent_code}") | Hiện với mọi HĐ có parent |

**Ví dụ bảng:**

```
| Mã HĐ                          | Khách | Giá trị | Status  |
|--------------------------------|-------|---------|---------|
| HD-2026-001                    | KH A  | 150M    | RENEWED |
| HD-2027-001 🔴 Trễ 15n (−5%)  | KH A  | 142.5M  | SIGNED  |
| HD-2027-002 🟢 Liên tục        | KH B  | 200M    | SIGNED  |
| HD-2027-003 🟠 Trễ 5n (miễn)  | KH C  | 180M    | SIGNED  |
```

> **Lưu ý:** Cột "Giá trị" của HĐ có penalty hiển thị `expected_amount` sau phạt (142.5M = 150M × 0.95), phản ánh doanh thu thực tế.

### 7.2 Filter "Loại HĐ"

Thanh filter có thêm dropdown:

```
Tất cả | HĐ gốc (STANDALONE) | Phụ lục | Có khoảng trống (GAP)
```

### 7.3 KPI Strip — Chỉ số dòng tiền liên tục

Trên thanh KPI của tab Hợp đồng, 3 chỉ số mới phản ánh sức khỏe dòng tiền:

| KPI | Công thức | Ý nghĩa |
|---|---|---|
| `addendum_count` | `COUNT WHERE parent_contract_id IS NOT NULL` | Tổng số phụ lục |
| `gap_count` | `COUNT WHERE continuity_status = 'GAP'` | Số phụ lục bị gián đoạn → mất doanh thu |
| `continuity_rate` | `CONTINUOUS / (CONTINUOUS + GAP) × 100` | % dòng tiền gia hạn liên tục |

> **Lưu ý công thức `continuity_rate`:** Mẫu số chỉ tính `CONTINUOUS + GAP`, **không tính `EARLY`** (gia hạn sớm được coi là tốt, không ảnh hưởng tiêu cực đến tỷ lệ). STANDALONE không tính vì là HĐ độc lập.

**Hiển thị trên KPI strip:**

```
[Ký kết: 28]          [Sắp hết hạn: 3 ⚠️ 2 gián đoạn]
  sub: 85% liên tục
```

- Badge đỏ nhỏ `gap_count` trên KPI "Sắp hết hạn" nếu > 0
- Sub-text `continuity_rate`%: xanh nếu ≥ 80%, cam nếu < 80% — trên KPI "Ký kết trong kỳ"

### 7.4 Chi tiết HĐ

**Khi mở chi tiết một HĐ phụ lục:**

```
[Thông tin chung]
- Mã: HD-2027-001
- Tên: Phụ lục gia hạn
- Khách hàng: KH A
- Giá trị: 150,000,000 đ

[Thông tin gia hạn]
- HĐ gốc: HD-2026-001 (Hợp đồng cấp phép 2026)
  └─ Hết hạn: 2026-12-31
- Loại phụ lục: EXTENSION
- Hiệu lực từ: 2027-01-15
- Hết hạn: 2027-12-31
- Gap days: 15 ngày ⚠️
- Trạng thái liên tục: GAP
- Tỷ lệ phạt: 5% → doanh thu giảm 5% mỗi kỳ

[Chuỗi gia hạn]
- Cấp 1 (gốc): HD-2026-001 [SIGNED → RENEWED]
  └─ Cấp 2: HD-2027-001 [SIGNED] ← bạn đang xem
    └─ (chưa có phụ lục cấp 3)
```

### 7.5 Timeline chuỗi doanh thu (ContractRevenueView)

Trong view doanh thu (tab "Doanh thu" của tab Hợp đồng), khi xem theo hợp đồng:

- Vẽ **đường nối** giữa HĐ gốc và các phụ lục (chuỗi dòng tiền liên tục)
- Tô màu **đỏ nhạt** đoạn gap giữa HĐ gốc và phụ lục (`continuity_status = GAP`)
- Phụ lục có penalty: hiển thị `original_amount` gạch ngang + `expected_amount` in đậm
- HĐ gốc đã bị xóa mềm: hiển thị "(đã xóa)" in nghiêng màu xám

---

## 8. Quản lý cấu hình gia hạn (Admin)

### 8.1 Truy cập

**Menu: Cài đặt → Tích hợp & Tối ưu → Cấu hình Gia hạn Hợp đồng**

### 8.2 Các tham số

| Tham số | Mặc định | Min-Max | Ý nghĩa |
|---|---|---|---|
| **Kỳ ân hạn (ngày)** | 0 | 0-365 | Số ngày cho phép không phạt (sau CONTINUOUS) |
| **Tỷ lệ phạt/ngày (%)** | 0.3333 | 0-100 | % phạt mỗi ngày gián đoạn |
| **Phạt tối đa (%)** | 15 | 0-100 | Trần phạt tối đa |
| **Độ sâu chuỗi tối đa** | 10 | 1-20 | Số cấp phụ lục tối đa (HD gốc → PL1 → PL2 → ... → PL10) |

### 8.3 Sửa cấu hình

1. Nhập giá trị mới vào từng trường
2. Nút "Lưu cấu hình"
3. Hệ thống **không tự động recalculate** các HĐ cũ
4. Nếu muốn áp dụng cho toàn bộ HĐ có sẵn → Nút "Tính lại hàng loạt"

### 8.4 Tính lại hàng loạt (Recalculate)

Nút: **"Tính lại hàng loạt"**

⚠️ **Chỉ dùng khi thay đổi cấu hình phạt**

```
Quét: Tất cả HĐ có parent_contract_id
Tính lại: gap_days, continuity_status, penalty_rate
Cập nhật: Chỉ HĐ có thay đổi
Audit: Ghi log từng thay đổi
```

Ví dụ:

```
[Trước]
gap_days=15, rate_per_day=0.003333 → penalty=5%

[Sửa cấu hình]
grace_days = 7 ngày (từ 0)

[Sau tính lại]
gap_days=15, grace=7 → 15 > 1+7 → vẫn tính phạt = 5%

[Sửa cấu hình 2]
rate_per_day = 0.001 (giảm phạt)

[Sau tính lại]
gap_days=15, rate_per_day=0.001 → penalty = 15 × 0.001 = 1.5%
```

---

## 9. Những điều cần biết

### 9.1 Chuỗi gia hạn (Addendum Chain)

```
HD-2024 (gốc) ← HD-2025 ← HD-2026 ← HD-2027
 Status       Gap=0      Gap=1       Gap=5
 SIGNED       CONTINUOUS CONTINUOUS  GAP
 ↓            ↓          ↓           ↓
 RENEWED      RENEWED    RENEWED    SIGNED
```

**Lưu ý:**
- HĐ gốc (`HD-2024`) **tự động chuyển → RENEWED** khi có phụ lục gia hạn loại `EXTENSION`
- Phụ lục cấp 2, 3, ... cũng **tự động → RENEWED** khi có phụ lục cấp dưới
- Nếu tạo phụ lục loại `AMENDMENT` hay `LIQUIDATION` → HĐ gốc **không thay đổi status** (do chỉ có EXTENSION mới là "gia hạn")

### 9.2 Xóa HĐ gốc

Nếu xóa HĐ gốc → tất cả phụ lục **tự động reset thành STANDALONE**:

```
Before:
  HD-2024: RENEWED, parent=null
  HD-2025: SIGNED, parent=2024
  HD-2026: SIGNED, parent=2025

Delete HD-2024 ✓

After:
  HD-2024: [xoá, soft delete]
  HD-2025: SIGNED, parent=null, gap_days=null, continuity=STANDALONE ← reset
  HD-2026: SIGNED, parent=null, gap_days=null, continuity=STANDALONE ← reset
```

**HĐ phụ lục không bị xóa theo**, nhưng trở thành HĐ độc lập.

### 9.3 Cập nhật ngày hiệu lực phụ lục

Nếu sửa `effective_date` của phụ lục → hệ thống **tự động tính lại**:

```
PUT /api/v5/contracts/55
{
  "effective_date": "2027-01-05"  ← từ 2027-01-15 (gap=15)
}

Response:
{
  "gap_days": 5,              ← thay đổi từ 15
  "continuity_status": "GAP",
  "penalty_rate": 0.0167      ← giảm từ 0.05
}
```

Đồng thời, các kỳ thanh toán `PENDING/INVOICED/OVERDUE` của HĐ này sẽ được **tự động cập nhật** `expected_amount` theo penalty mới.

### 9.4 Cập nhật ngày hết hạn HĐ gốc

Nếu sửa `expiry_date` của **HĐ gốc** → hệ thống **tự động tính lại toàn bộ chuỗi con**:

```
PUT /api/v5/contracts/42   ← HĐ gốc
{
  "expiry_date": "2026-11-30"  ← từ 2026-12-31 (sớm hơn 1 tháng)
}
```

**Điều xảy ra (chạy ngầm qua `RecomputeChildRenewalMetaJob`):**

```
Trước: HD-2027-001 → effective=2027-01-15, parent_expiry=2026-12-31
  → gap_days = 15, GAP, penalty = 5%

Sau khi đổi parent expiry về 2026-11-30:
  → gap_days = 46, GAP, penalty = 15% (capped tại max)
  → Kỳ thanh toán PENDING/INVOICED/OVERDUE được cập nhật expected_amount
```

> ⚠️ **Lưu ý:** Job chạy bất đồng bộ (queue). Khi API trả về thành công, kỳ thanh toán chưa được cập nhật ngay — cần đợi vài giây hoặc refresh lại trang.

### 9.5 Tối đa 10 cấp phụ lục

Hệ thống bảo vệ khỏi chuỗi quá dài:

```
Cấp 1:  HD-2020 (gốc)
Cấp 2:  HD-2021 (parent=2020)
Cấp 3:  HD-2022 (parent=2021)
...
Cấp 10: HD-2029 (parent=2028)
Cấp 11: ❌ KHÔNG ĐƯỢC phép (vượt giới hạn)

Error: "Chuỗi phụ lục đã đạt giới hạn 10 cấp. Không thể tạo thêm."
```

### 9.6 Không thể tạo vòng lặp

Hệ thống cảnh báo nếu tạo vòng lặp:

```
Tình huống:
- HD-A parent của HD-B
- HD-B parent của HD-C
- Cố gắng: HD-C parent của HD-A ← TẠO VÒNG LẶP

Kết quả: ❌ Error: "Phát hiện vòng lặp. Không thể gán."
```

---

## 10. Quy trình gia hạn thực tế

### Quy trình chuẩn (4 bước)

**Tháng 11/2026:**

1. ✅ **Chuẩn bị** — Đàm phán với khách hàng
   - Khách muốn gia hạn từ 2027-01-15
   - Giá trị tương tự = 150M đ
   - Hiệu lực: 01/01/2027 (lý tưởng, gap=1)

2. ✅ **Tạo phụ lục**
   ```
   POST /api/v5/contracts
   parent_contract_id: 42 (HD-2026-001)
   addendum_type: EXTENSION
   effective_date: 2027-01-01
   expiry_date: 2027-12-31
   value: 150M
   ```
   → Hệ thống tự động tính:
   - gap_days = 1
   - continuity_status = CONTINUOUS
   - penalty_rate = null (không phạt)
   → HD-2026-001 status: SIGNED → **RENEWED** ✅

3. ✅ **Sinh kỳ thanh toán**
   - Nút "Sinh kỳ thanh toán"
   - Chọn: Một lần
   - Kỳ 1:
     - `original_amount` = 150,000,000 đ
     - `penalty_rate` = null
     - `expected_amount` = 150,000,000 đ (không thay đổi)

4. ✅ **Tracking**
   - Danh sách HĐ: hiện HD-2027-001 với badge 🟢 Liên tục
   - KPI strip: `continuity_rate` tăng lên (thêm 1 CONTINUOUS)
   - Chi tiết: xem chuỗi (HD-2026-001 → HD-2027-001)
   - Doanh thu: timeline chain, đường nối xanh (không gap)

### Quy trình gia hạn trễ (có phạt)

**Tháng 01/2027 — khách gia hạn muộn:**

1. ✅ **Tạo phụ lục trễ**
   ```
   effective_date: 2027-01-15  ← muộn 15 ngày
   value: 150M
   ```
   → gap_days = 15, GAP, penalty_rate = 0.05 (5%)
   → Badge 🔴 Trễ 15n (−5%)

2. ✅ **Sinh kỳ thanh toán**
   - Kỳ 1:
     - `original_amount` = 150,000,000 đ
     - `penalty_rate` = 0.05
     - `penalty_amount` = 7,500,000 đ
     - `expected_amount` = **142,500,000 đ** ← GIẢM so với gốc

3. ✅ **Theo dõi trên view doanh thu**
   - Đoạn gap 15 ngày tô đỏ nhạt trên timeline
   - expected hiển thị: ~~150,000,000~~ **142,500,000 đ** (−5%)
   - KPI `gap_count` tăng lên 1

---

## 11. Phụ lục kỹ thuật — Cấu trúc dữ liệu

### 11.1 Trường mới trong `contracts`

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `parent_contract_id` | BIGINT NULL | FK → contracts.id (phụ lục gốc) |
| `addendum_type` | VARCHAR(30) NULL | EXTENSION / AMENDMENT / LIQUIDATION |
| `gap_days` | INT NULL | Số ngày gián đoạn |
| `continuity_status` | VARCHAR(30) NULL | STANDALONE / EARLY / CONTINUOUS / GAP |
| `penalty_rate` | DECIMAL(8,4) NULL | Tỷ lệ phạt (0.05 = 5%) |

### 11.2 Trường mới trong `payment_schedules`

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `original_amount` | DECIMAL(18,2) NULL | Giá trị gốc trước phạt (để audit) |
| `penalty_rate` | DECIMAL(8,4) NULL | Tỷ lệ phạt áp dụng tại thời điểm sinh kỳ |
| `penalty_amount` | DECIMAL(18,2) NULL | Số tiền bị trừ (làm tròn xuống VND) |

> **Tại sao lưu lại trên kỳ thanh toán?** Nếu cấu hình phạt thay đổi sau này, vẫn biết được kỳ thanh toán đó đã áp dụng tỷ lệ nào. `original_amount` cho phép tái tính lại penalty bất cứ lúc nào mà không mất dữ liệu gốc.

### 11.3 TypeScript Interface

```typescript
// Thêm vào interface Contract (frontend/types.ts)
parent_contract_id?: number | string | null;
addendum_type?: 'EXTENSION' | 'AMENDMENT' | 'LIQUIDATION' | null;
gap_days?: number | null;
continuity_status?: 'STANDALONE' | 'EARLY' | 'CONTINUOUS' | 'GAP' | null;
penalty_rate?: number | null;   // 0.05 = 5%
parent_contract?: {
  id: number;
  contract_code: string;
  contract_name: string;
  expiry_date?: string | null;
  deleted_at?: string | null;   // null = còn hiệu lực, ISO string = đã xóa mềm
} | null;

// Thêm vào PaginationMeta.kpis
addendum_count?: number;
gap_count?: number;
continuity_rate?: number;       // 0-100
```

### 11.4 KPI API (GET /api/v5/contracts)

`meta.kpis` trả về thêm:

```json
{
  "kpis": {
    "...existing fields...",
    "addendum_count": 12,
    "gap_count": 3,
    "continuity_rate": 75
  }
}
```

### 11.5 Addendum Chain API

```bash
GET /api/v5/contracts/{id}/addendum-chain
```

**Response:**
```json
{
  "data": [
    {
      "id": 42,
      "contract_code": "HD-2026-001",
      "continuity_status": null,
      "gap_days": null,
      "penalty_rate": null,
      "effective_date": "2026-01-01",
      "expiry_date": "2026-12-31",
      "depth": 0
    },
    {
      "id": 55,
      "contract_code": "HD-2027-001",
      "continuity_status": "GAP",
      "gap_days": 15,
      "penalty_rate": 0.05,
      "effective_date": "2027-01-15",
      "expiry_date": "2027-12-31",
      "depth": 1
    }
  ]
}
```
