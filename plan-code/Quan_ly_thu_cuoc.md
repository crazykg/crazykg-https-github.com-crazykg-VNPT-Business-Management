# Plan: Module "Thu Cước" — Quản lý Dòng tiền & Công nợ Dịch vụ

> **Ngày lập:** 2026-03-23
> **Trạng thái:** ✅ APPROVED — Đã qua 5 vòng review (Codex + Claude Code peer debate)
> **Yêu cầu:** UI/UX giữ nguyên pattern hiện tại, logic tốt, hiệu năng cao

---

## MỤC LỤC

1. [Bối cảnh & Mục tiêu](#1-bối-cảnh--mục-tiêu)
2. [Phân tích hiện trạng](#2-phân-tích-hiện-trạng)
3. [Kiến trúc tổng quan](#3-kiến-trúc-tổng-quan)
4. [Database Design](#4-database-design)
5. [Backend Architecture](#5-backend-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [API Endpoints](#7-api-endpoints)
8. [Sub-view: Dashboard Thu Cước](#8-sub-view-dashboard-thu-cước)
9. [Sub-view: Danh sách Hóa đơn](#9-sub-view-danh-sách-hóa-đơn)
10. [Sub-view: Quản lý Phiếu thu](#10-sub-view-quản-lý-phiếu-thu)
11. [Sub-view: Báo cáo Công nợ](#11-sub-view-báo-cáo-công-nợ)
12. [Phân quyền](#12-phân-quyền)
13. [Hiệu năng](#13-hiệu-năng)
14. [Files tạo mới & sửa](#14-files-tạo-mới--sửa)
15. [Phased Rollout](#15-phased-rollout)
16. [Test Plan](#16-test-plan)

---

## 1. Bối cảnh & Mục tiêu

### Bối cảnh

Hệ thống hiện đã có:
- **Hợp đồng** (`contracts`): CRUD, status workflow (DRAFT → SIGNED → RENEWED), payment_cycle
- **Hạng mục hợp đồng** (`contract_items`): product_id, quantity, unit_price, VAT
- **Kỳ thanh toán** (`payment_schedules`): sinh tự động (EVEN/MILESTONE), status tracking (PENDING → INVOICED → PARTIAL → PAID → OVERDUE → CANCELLED), xác nhận thu tiền + attachment
- **Phân tích doanh thu** (`ContractRevenueAnalyticsService`): KPIs, biểu đồ, drill-down

**Thiếu gì:**
- ❌ Không có hóa đơn (invoice) chính thức → chỉ có payment_schedule, không track được số hóa đơn, ngày xuất, series
- ❌ Không có phiếu thu (receipt) → payment confirmation chỉ là toggle status + note, không có document chính thức
- ❌ Không có báo cáo công nợ theo tuổi nợ (aging report) → chỉ có overdue_details dạng đơn giản
- ❌ Không có quy trình nhắc nợ (dunning) → không tự động gửi reminder theo cấp độ
- ❌ Không có tab riêng cho bộ phận thu cước → phân tích doanh thu nằm trong tab Hợp đồng, người thu cước phải vào nhiều nơi

### Mục tiêu

Tạo menu **"Thu Cước"** (tab id: `fee_collection`) trong sidebar, đóng vai trò **trung tâm điều phối thu tiền**, bao gồm:

1. **Dashboard Thu Cước** — tổng quan KPI thu tiền, cảnh báo quá hạn, doanh thu dự kiến
2. **Danh sách Hóa đơn** — tạo, quản lý, theo dõi hóa đơn phát hành cho khách hàng
3. **Quản lý Phiếu thu** — ghi nhận thanh toán thực tế, đối soát với hóa đơn/kỳ thanh toán
4. **Báo cáo Công nợ** — aging report, khách hàng nợ đọng, xu hướng thu, dự báo dòng tiền

### Nguyên tắc thiết kế

| Nguyên tắc | Chi tiết |
|---|---|
| **UI/UX giữ nguyên** | Dùng pattern hiện có: KPI cards, filter bar, sortable table, modal CRUD, PaymentScheduleTab style |
| **Tái sử dụng tối đa** | Kế thừa `payment_schedules` data, không duplicate. Invoice = wrapper quanh schedules |
| **Logic tốt** | Tách service layer rõ ràng, domain-driven, không fat controller |
| **Hiệu năng cao** | Server-side pagination, indexed queries, lazy-load sub-views, debounced search |

---

## 2. Phân tích hiện trạng

### Data Flow hiện tại

```
Contract (SIGNED)
  → contract_items (N products × quantity × unit_price)
  → payment_schedules (N đợt, auto-generated)
      → status: PENDING → INVOICED → PARTIAL → PAID
      → actual_paid_amount, actual_paid_date, confirmed_by
  → ContractRevenueAnalyticsService (tính toán KPIs, by_period, by_cycle, by_contract)
```

### Điểm kết nối với module Thu Cước

| Entity hiện có | Vai trò trong Thu Cước |
|---|---|
| `contracts` | Nguồn gốc sinh hóa đơn — mỗi hợp đồng ĐÃ KÝ → sinh được hóa đơn |
| `contract_items` | Chi tiết hạng mục trên hóa đơn |
| `payment_schedules` | Kỳ thanh toán — quan hệ **1:1 với invoice** (mỗi schedule tối đa 1 invoice, mỗi invoice_item link tối đa 1 schedule) |
| `customers` | Bên mua (debtor) — đối tượng công nợ |
| `ContractRevenueAnalyticsService` | Tái sử dụng query patterns + KPI calculation logic |

---

## 3. Kiến trúc tổng quan

### Tab "Thu Cước" trong Sidebar

```
Sidebar.tsx menuGroups → thêm group mới:
{
  id: 'fin',
  label: 'Tài chính & Thu cước',
  icon: 'account_balance',
  items: [
    { id: 'fee_collection', icon: 'receipt_long', label: 'Thu cước' }
  ]
}
```

**Vị trí:** Sau group `legal` (Pháp lý & Lưu trữ), trước group `util` (Tiện ích).

### Sub-views trong tab Thu Cước

```
?tab=fee_collection
├── Shared header: tiêu đề "Thu cước & Công nợ" + period selector + sub-view toggle
├── [SUB-VIEW: DASHBOARD] ← default
│   ├── 7 KPI cards: 4 period-flow (phát hành kỳ, đã thu kỳ, tỷ lệ thu, TB ngày thu) + 3 balance (tổng nợ, nợ quá hạn, số HĐ quá hạn)
│   ├── Biểu đồ: Doanh thu kỳ vọng vs Thực thu theo tháng (reuse RevenueBarChart)
│   ├── Biểu đồ: Doanh thu lũy kế (reuse RevenueCumulativeChart)
│   ├── Widget: Top 5 KH nợ nhiều nhất
│   └── Widget: Kỳ thanh toán quá hạn cần xử lý
├── [SUB-VIEW: INVOICES]
│   ├── Filter bar: search + status + customer + period
│   ├── Bảng hóa đơn: mã, KH, ngày, giá trị, trạng thái, hành động
│   └── Pagination server-side
├── [SUB-VIEW: RECEIPTS]
│   ├── Filter bar: search + invoice + customer + period
│   ├── Bảng phiếu thu: mã, KH, hóa đơn, ngày thu, số tiền, phương thức
│   └── Pagination server-side
├── [SUB-VIEW: DEBT_REPORT]
    ├── Aging report: 5 buckets (hiện tại, 1-30 ngày, 31-60, 61-90, >90)
    ├── Bảng: Công nợ theo khách hàng (expandable → drill-down hóa đơn)
    ├── Biểu đồ: Xu hướng công nợ 6 tháng
    └── Export Excel
```

---

## 4. Database Design

### 4.1. Bảng `invoices` (MỚI)

```sql
CREATE TABLE invoices (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_code    VARCHAR(50) NOT NULL COMMENT 'Mã hóa đơn: INV-YYYYMM-NNNN',
  invoice_series  VARCHAR(20) NULL COMMENT 'Ký hiệu hóa đơn (series)',

  -- Liên kết
  contract_id     BIGINT UNSIGNED NOT NULL,
  customer_id     BIGINT UNSIGNED NOT NULL,
  project_id      BIGINT UNSIGNED NULL,

  -- Ngày tháng
  invoice_date    DATE NOT NULL COMMENT 'Ngày xuất hóa đơn',
  due_date        DATE NOT NULL COMMENT 'Hạn thanh toán',
  period_from     DATE NULL COMMENT 'Kỳ cước từ ngày',
  period_to       DATE NULL COMMENT 'Kỳ cước đến ngày',

  -- Giá trị
  subtotal        DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng trước thuế',
  vat_rate        DECIMAL(5,2)  NULL DEFAULT 10.00 COMMENT 'Thuế suất %',
  vat_amount      DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Tiền thuế',
  total_amount    DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng sau thuế',
  paid_amount     DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Đã thu (cập nhật từ receipts)',
  outstanding     DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED COMMENT 'Còn nợ',

  -- Trạng thái
  status          VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
                  COMMENT 'DRAFT | ISSUED | PARTIAL | PAID | CANCELLED | VOID',

  -- Metadata
  notes           TEXT NULL,
  data_scope      VARCHAR(50) NULL,
  created_by      BIGINT UNSIGNED NULL,
  updated_by      BIGINT UNSIGNED NULL,
  created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL DEFAULT NULL,

  -- Indexes
  UNIQUE KEY uq_invoice_code (invoice_code, deleted_at),
  INDEX idx_inv_contract (contract_id),
  INDEX idx_inv_customer (customer_id),
  INDEX idx_inv_status (status),
  INDEX idx_inv_due_date (due_date),
  INDEX idx_inv_date_status (invoice_date, status),
  INDEX idx_inv_outstanding (outstanding),

  -- Foreign keys
  CONSTRAINT fk_inv_contract FOREIGN KEY (contract_id) REFERENCES contracts(id),
  CONSTRAINT fk_inv_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Hóa đơn thu cước';
```

**Quyết định thiết kế:**
- `outstanding` là cột GENERATED STORED → luôn chính xác, không cần recalculate
- `invoice_code` format `INV-YYYYMM-NNNN` (auto-generated, tương tự `CRC-YYYYMM-NNNN`)
- SoftDeletes — theo pattern codebase
- `data_scope` — cho row-level security

### 4.2. Bảng `invoice_items` (MỚI)

```sql
CREATE TABLE invoice_items (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id      BIGINT UNSIGNED NOT NULL,
  product_id      BIGINT UNSIGNED NULL,

  -- Nội dung
  description     VARCHAR(500) NOT NULL COMMENT 'Mô tả dịch vụ/sản phẩm',
  unit            VARCHAR(50) NULL COMMENT 'Đơn vị tính',
  quantity        DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  unit_price      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  vat_rate        DECIMAL(5,2)  NULL DEFAULT 10.00,

  -- Tính toán
  line_total      DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  vat_amount      DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price * COALESCE(vat_rate, 0) / 100) STORED,

  -- Liên kết kỳ thanh toán (optional)
  payment_schedule_id BIGINT UNSIGNED NULL COMMENT 'Map 1:1 với payment_schedule nếu có',

  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_ii_invoice (invoice_id),
  CONSTRAINT fk_ii_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Hạng mục hóa đơn';
```

**Quyết định:**
- Không SoftDeletes — sync = hard-delete + re-insert (pattern giống `contract_items`)
- `line_total` và `vat_amount` là GENERATED STORED → consistency tuyệt đối
- `payment_schedule_id` nullable — cho phép hóa đơn tự do (không nhất thiết gắn payment schedule)

### 4.3. Bảng `receipts` (MỚI)

```sql
CREATE TABLE receipts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receipt_code    VARCHAR(50) NOT NULL COMMENT 'Mã phiếu thu: RCP-YYYYMM-NNNN',

  -- Liên kết
  invoice_id      BIGINT UNSIGNED NULL COMMENT 'NULL nếu thu trước khi có hóa đơn',
  contract_id     BIGINT UNSIGNED NOT NULL,
  customer_id     BIGINT UNSIGNED NOT NULL,

  -- Chi tiết thanh toán
  receipt_date    DATE NOT NULL COMMENT 'Ngày thu',
  amount          DECIMAL(15,2) NOT NULL COMMENT 'Số tiền thu',
  payment_method  VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER'
                  COMMENT 'CASH | BANK_TRANSFER | ONLINE | OFFSET | OTHER',

  -- Thông tin ngân hàng (optional)
  bank_name       VARCHAR(200) NULL,
  bank_account    VARCHAR(50) NULL,
  transaction_ref VARCHAR(100) NULL COMMENT 'Mã giao dịch ngân hàng',

  -- Trạng thái
  status          VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED'
                  COMMENT 'CONFIRMED | PENDING_CONFIRM | REJECTED',
                  -- NOTE: No REVERSED status. Reversal uses is_reversed/is_reversal_offset flags.

  -- Reversal tracking
  is_reversed         TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if this receipt has a reversal offset entry',
  is_reversal_offset  TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if this is a negative offset entry (amount < 0)',
  original_receipt_id BIGINT UNSIGNED NULL COMMENT 'FK to original receipt being reversed',

  -- Metadata
  notes           TEXT NULL,
  confirmed_by    BIGINT UNSIGNED NULL,
  confirmed_at    TIMESTAMP NULL,
  data_scope      VARCHAR(50) NULL,
  created_by      BIGINT UNSIGNED NULL,
  updated_by      BIGINT UNSIGNED NULL,
  created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL DEFAULT NULL,

  -- Indexes
  UNIQUE KEY uq_receipt_code (receipt_code, deleted_at),
  INDEX idx_rcp_invoice (invoice_id),
  INDEX idx_rcp_contract (contract_id),
  INDEX idx_rcp_customer (customer_id),
  INDEX idx_rcp_date (receipt_date),
  INDEX idx_rcp_status (status),

  CONSTRAINT fk_rcp_invoice  FOREIGN KEY (invoice_id)  REFERENCES invoices(id),
  CONSTRAINT fk_rcp_contract FOREIGN KEY (contract_id) REFERENCES contracts(id),
  CONSTRAINT fk_rcp_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Phiếu thu tiền';
```

**Quyết định:**
- `invoice_id` nullable → hỗ trợ thu trước hóa đơn (advance payment)
- `payment_method` enum → mở rộng được
- Trigger/service: khi tạo receipt → update `invoices.paid_amount`
- SoftDeletes — cần audit trail

### 4.4. Bảng `dunning_logs` (MỚI)

```sql
CREATE TABLE dunning_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id      BIGINT UNSIGNED NOT NULL,
  customer_id     BIGINT UNSIGNED NOT NULL,

  dunning_level   TINYINT NOT NULL DEFAULT 1 COMMENT '1=nhắc lần 1, 2=nhắc lần 2, 3=cảnh báo',
  sent_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_via        VARCHAR(30) NOT NULL DEFAULT 'SYSTEM' COMMENT 'SYSTEM | EMAIL | MANUAL',
  message         TEXT NULL COMMENT 'Nội dung nhắc',
  response_note   TEXT NULL COMMENT 'Ghi chú phản hồi từ KH',

  created_by      BIGINT UNSIGNED NULL,
  created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_dl_invoice (invoice_id),
  INDEX idx_dl_customer (customer_id),
  INDEX idx_dl_level (dunning_level),
  CONSTRAINT fk_dl_invoice  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_dl_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Lịch sử nhắc nợ';
```

### 4.5. Thêm cột vào `payment_schedules` (ALTER)

```sql
ALTER TABLE payment_schedules
  ADD COLUMN invoice_id BIGINT UNSIGNED NULL AFTER contract_id
  COMMENT 'Liên kết với hóa đơn đã phát hành';

ALTER TABLE payment_schedules
  ADD INDEX idx_ps_invoice (invoice_id);
```

**Lý do:** Quan hệ **1:1** — mỗi payment_schedule liên kết tối đa 1 invoice. Khi `bulkGenerate()` tạo hóa đơn, gán `invoice_id` vào schedule. Invoice_item cũng link ngược qua `payment_schedule_id` để đối soát 2 chiều.

---

## 5. Backend Architecture

### 5.1. Models (4 mới)

| Model | Table | SoftDeletes | Audit |
|---|---|---|---|
| `Invoice` | `invoices` | ✅ | ✅ |
| `InvoiceItem` | `invoice_items` | ❌ | ✅ (audit as part of parent Invoice mutation — record item sync in invoice audit event's `after` snapshot) |
| `Receipt` | `receipts` | ✅ | ✅ |
| `DunningLog` | `dunning_logs` | ❌ | ✅ (audit INSERT on dunning creation) |

**Audit coverage — ALL mutation paths:**
- Invoice: store, update, destroy, bulkGenerate, status transitions (DRAFT→ISSUED, →CANCELLED, →VOID)
- InvoiceItem: sync recorded in parent invoice audit event (before/after snapshots include items)
- Receipt: store, update, destroy, reverse
- DunningLog: store (INSERT audit)
- Reconciliation side-effects: when reconcileInvoice() updates invoice.paid_amount/status → recorded as UPDATE audit on invoices table

### 5.2. Service Layer

```
app/Services/V5/
├── FeeCollection/                          ← MỚI: domain Thu Cước
│   ├── InvoiceDomainService.php            ← CRUD hóa đơn, sinh mã, sync items
│   ├── ReceiptDomainService.php            ← CRUD phiếu thu, reconciliation
│   ├── FeeCollectionDashboardService.php   ← KPI, dashboard analytics
│   └── DebtAgingReportService.php          ← Aging report, debt trends
├── Domain/
│   └── ContractDomainService.php           ← KHÔNG SỬA (chỉ tham chiếu)
└── Contract/
    └── ContractRevenueAnalyticsService.php ← KHÔNG SỬA (tái sử dụng queries)
```

### 5.3. Controller

**Bắt buộc tuân thủ V5 conventions:**
- Controller extends `V5BaseController` (NOT generic Controller)
- Constructor inject `V5DomainSupportService` + `V5AccessAuditService`
- Mỗi method: thin delegation to DomainService → return JSON response
- Schema guards: luôn dùng `$this->support->hasColumn()` / `hasTable()` trước khi truy cập cột optional
- Read scope: mọi list/show query phải qua `applyReadScope()` (department-based + creator fallback)
- Migration: dùng Laravel Blueprint (NOT raw SQL), giống pattern migration hiện có

```php
// app/Http/Controllers/Api/V5/FeeCollectionController.php (MỚI)

class FeeCollectionController extends V5BaseController
{
    // Invoices
    public function invoiceIndex(Request $request)     // GET  /api/v5/invoices
    public function invoiceStore(Request $request)      // POST /api/v5/invoices
    public function invoiceShow(Request $request, $id)  // GET  /api/v5/invoices/{id}
    public function invoiceUpdate(Request $request, $id)// PUT  /api/v5/invoices/{id}
    public function invoiceDestroy(Request $request, $id)//DELETE /api/v5/invoices/{id}
    public function invoiceBulkGenerate(Request $request)// POST /api/v5/invoices/bulk-generate

    // Receipts
    public function receiptIndex(Request $request)      // GET  /api/v5/receipts
    public function receiptStore(Request $request)       // POST /api/v5/receipts
    public function receiptShow(Request $request, $id)   // GET  /api/v5/receipts/{id}
    public function receiptUpdate(Request $request, $id) // PUT  /api/v5/receipts/{id}
    public function receiptDestroy(Request $request, $id)// DELETE /api/v5/receipts/{id}

    // Dashboard & Reports
    public function dashboard(Request $request)          // GET  /api/v5/fee-collection/dashboard
    public function debtAgingReport(Request $request)    // GET  /api/v5/fee-collection/debt-aging
    public function debtByCustomer(Request $request)     // GET  /api/v5/fee-collection/debt-by-customer
    public function debtTrend(Request $request)          // GET  /api/v5/fee-collection/debt-trend

    // Dunning
    public function dunningLogIndex(Request $request)    // GET  /api/v5/invoices/{id}/dunning-logs
    public function dunningLogStore(Request $request, $id)// POST /api/v5/invoices/{id}/dunning-logs
}
```

### 5.4. InvoiceDomainService — Chi tiết logic

```php
class InvoiceDomainService
{
    // Dependencies (constructor injection)
    private V5DomainSupportService $support;
    private V5AccessAuditService $accessAudit;

    /**
     * index() — Danh sách hóa đơn + KPIs
     *
     * Filters: q (search), status, customer_id, contract_id,
     *          invoice_date_from, invoice_date_to, due_date_from, due_date_to
     * Sort: invoice_code, invoice_date, due_date, total_amount, outstanding, status
     * KPIs: total_invoices, total_amount, total_paid, total_outstanding,
     *       overdue_count, overdue_amount, avg_days_to_pay
     */
    public function index(Request $request): array

    /**
     * store() — Tạo hóa đơn mới
     *
     * Input: contract_id, customer_id, invoice_date, due_date,
     *        period_from, period_to, vat_rate, notes,
     *        items: [{product_id?, description, unit, quantity, unit_price, vat_rate, payment_schedule_id?}]
     *
     * Logic:
     * 1. Validate contract exists & SIGNED
     * 2. Generate invoice_code: INV-{YYYYMM}-{NNNN}
     * 3. Calculate subtotal, vat_amount, total_amount from items
     * 4. Insert invoice + invoice_items (transactional)
     * 5. If items have payment_schedule_id → update schedule status to INVOICED
     * 6. Audit log
     */
    public function store(Request $request): Invoice

    /**
     * bulkGenerate() — Sinh hóa đơn hàng loạt từ payment_schedules
     *
     * Input: contract_ids[] (optional, default all SIGNED),
     *        period_from, period_to
     *
     * Logic (1 invoice per schedule — tuân thủ 1:1 cardinality):
     * 1. Query payment_schedules where status=PENDING, expected_date in [from, to], invoice_id IS NULL
     * 2. For each schedule:
     *    a. Create 1 invoice (invoice_date = today, due_date = schedule.expected_date)
     *    b. Create invoice_items from contract_items (proportional to schedule amount vs total contract value)
     *    c. Set invoice_item.payment_schedule_id = schedule.id
     *    d. Set schedule.invoice_id = new invoice.id
     *    e. Update schedule status to INVOICED
     * 3. Return created count + list
     *
     * NOTE: Mỗi schedule → đúng 1 invoice. KHÔNG gộp nhiều schedules vào 1 invoice.
     * Nếu contract có 3 pending schedules trong kỳ → tạo 3 invoices riêng biệt.
     */
    public function bulkGenerate(Request $request): array

    /**
     * generateInvoiceCode() — Sinh mã hóa đơn tự động
     *
     * Pattern: INV-YYYYMM-NNNN (giống CRC code generation)
     * Thread-safe: sử dụng SELECT FOR UPDATE + DB::transaction:
     *   DB::transaction(function() {
     *     DB::select("SELECT id FROM invoices WHERE invoice_code LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE", [$prefix.'%']);
     *     // then MAX + 1
     *   });
     * Nếu UNIQUE constraint fail (race condition fallback) → retry tối đa 3 lần
     * Test: concurrent insert test required (see §16)
     */
    private function generateInvoiceCode(): string
}
```

### 5.5. ReceiptDomainService — Chi tiết logic

```php
class ReceiptDomainService
{
    // Dependencies (constructor injection)
    private V5DomainSupportService $support;
    private V5AccessAuditService $accessAudit;

    /**
     * store() — Tạo phiếu thu
     *
     * Logic:
     * 1. Validate invoice exists (if invoice_id provided)
     * 2. Generate receipt_code: RCP-{YYYYMM}-{NNNN} (same FOR UPDATE pattern as invoice)
     * 3. Insert receipt
     * 4. Call reconcileInvoice() to update paid_amount + status
     * 5. Audit log (INSERT, receipts)
     */
    public function store(Request $request): Receipt

    /**
     * update() — Cập nhật phiếu thu
     *
     * Logic:
     * 1. Validate receipt exists, status ∈ {PENDING_CONFIRM, CONFIRMED}
     * 2. Update receipt fields (amount, invoice_id, payment_method, etc.)
     * 3. Call reconcileInvoice() on OLD invoice_id (if changed) → recalc from SUM
     * 4. Call reconcileInvoice() on NEW invoice_id → recalc from SUM
     * 5. Audit log (UPDATE, receipts, before → after)
     *
     * NOTE: NO manual rollback/apply. reconcileInvoice() is idempotent
     * and always recalculates from SUM(receipts). This is the ONLY way
     * to update invoice.paid_amount.
     */
    public function update(Request $request, int $id): Receipt

    /**
     * destroy() — Xóa phiếu thu (soft delete)
     *
     * Logic:
     * 1. Validate receipt exists
     * 2. Soft-delete receipt (sets deleted_at)
     * 3. Call reconcileInvoice() on receipt.invoice_id → recalc from SUM
     *    (deleted receipt excluded from SUM by WHERE deleted_at IS NULL)
     * 4. Audit log (DELETE, receipts)
     *
     * NOTE: NO manual rollback. reconcileInvoice() handles it automatically.
     */
    public function destroy(Request $request, int $id): void

    /**
     * reverse() — Đảo phiếu thu (tạo bản ghi âm offset)
     *
     * Pattern: Keep original receipt CONFIRMED, add negative CONFIRMED offset.
     * reconcileInvoice() sums both → net zero.
     *
     * Logic:
     * 1. Validate receipt exists, status = CONFIRMED
     * 2. Mark original receipt.is_reversed = true (flag only, status stays CONFIRMED)
     * 3. Create new receipt with:
     *    - negative amount (-receipt.amount)
     *    - status = CONFIRMED
     *    - same invoice_id
     *    - notes = "Đảo phiếu {receipt_code}"
     *    - original_receipt_id = receipt.id
     *    - is_reversal_offset = true  ← DB column, NOT a status
     * 4. Call reconcileInvoice():
     *    SUM = original positive CONFIRMED + new negative CONFIRMED = net zero
     *    → invoice.paid_amount correctly reflects cancellation
     * 5. Audit log (UPDATE original + INSERT reversal)
     *
     * WHY this works:
     * - Both receipts stay CONFIRMED → both included in SUM
     * - (+100) + (-100) = 0 → paid_amount correctly reset
     * - is_reversed/is_reversal flags are display-only for UI
     * - No status exclusion logic needed
     */
    public function reverse(Request $request, int $id): Receipt

    /**
     * reconcileInvoice() — Cập nhật paid_amount + status của invoice
     *
     * Source of truth: SUM(amount) FROM receipts WHERE invoice_id = ? AND status = 'CONFIRMED' AND deleted_at IS NULL
     * Luôn recalculate từ tổng receipts (không increment/decrement) → idempotent, safe
     *
     * Status logic (reconcileInvoice chỉ set các status sau):
     *   paid_amount >= total_amount → PAID
     *   paid_amount > 0 AND paid_amount < total_amount → PARTIAL
     *   paid_amount = 0 → ISSUED (giữ nguyên)
     *
     * NOTE: KHÔNG set status = OVERDUE ở đây.
     * OVERDUE là computed status (query-time only, xem §5.8).
     * reconcileInvoice() KHÔNG BAO GIỜ persist OVERDUE.
     *
     * Cascade: if invoice linked payment_schedule → update schedule actual_paid_amount, status
     */
    private function reconcileInvoice(int $invoiceId): void

    /**
     * Advance payment handling:
     * - Receipt with invoice_id = NULL → ghi nhận là advance (tạm ứng)
     * - Khi tạo invoice → user chọn apply advance receipt → update receipt.invoice_id
     * - reconcileInvoice() sẽ include advance receipt trong tổng
     */
}
```

### 5.6. FeeCollectionDashboardService — KPI Logic

```php
class FeeCollectionDashboardService
{
    /**
     * dashboard() — KPI tổng quan
     *
     * Input: period_from, period_to (required)
     *
     * KPIs split into 2 groups:
     *
     * === Period-Flow KPIs (scoped to selected period) ===
     * 1. period_invoiced — Tổng tiền hóa đơn phát hành trong kỳ
     * 2. period_collected — Tổng phiếu thu confirmed trong kỳ
     * 3. period_collection_rate — (period_collected / period_invoiced) * 100
     * 4. avg_days_to_collect — Trung bình (receipt_date - invoice_date) cho receipts trong kỳ
     *
     * === Balance KPIs (point-in-time, as of today) ===
     * 5. total_outstanding — SUM(outstanding) FROM invoices WHERE status NOT IN (PAID,CANCELLED,VOID,DRAFT) AND outstanding > 0
     * 6. total_overdue — SUM(outstanding) FROM invoices WHERE due_date < CURDATE() AND outstanding > 0 AND status NOT IN (PAID,CANCELLED,VOID,DRAFT)
     * 7. overdue_count — COUNT of overdue invoices
     *
     * NOTE: `outstanding` comes from open invoice balances (GENERATED STORED column),
     * NOT from period_invoiced - period_collected (which can be misleading if receipts settle older invoices).
     *
     * Charts:
     * - by_month: [{month, invoiced, collected, outstanding_eom}]
     *   where outstanding_eom = point-in-time outstanding at end of each month
     * - cumulative: [{month, cumulative_invoiced, cumulative_collected}]
     *
     * Widgets:
     * - top_debtors: Top 5 KH có outstanding cao nhất (balance-based)
     * - urgent_overdue: Kỳ quá hạn > 30 ngày cần xử lý
     */
    public function dashboard(Request $request): array
}
```

### 5.7. DebtAgingReportService — Aging Logic

```php
class DebtAgingReportService
{
    /**
     * agingReport() — Báo cáo tuổi nợ
     *
     * Buckets: current (chưa đến hạn), 1-30, 31-60, 61-90, >90 ngày
     *
     * Query:
     * SELECT
     *   c.id as customer_id, c.customer_name,
     *   SUM(CASE WHEN i.due_date >= CURDATE() THEN i.outstanding ELSE 0 END) as current_bucket,
     *   SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN 1 AND 30 THEN i.outstanding ELSE 0 END) as bucket_1_30,
     *   SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN 31 AND 60 THEN i.outstanding ELSE 0 END) as bucket_31_60,
     *   SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN 61 AND 90 THEN i.outstanding ELSE 0 END) as bucket_61_90,
     *   SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) > 90 THEN i.outstanding ELSE 0 END) as bucket_over_90,
     *   SUM(i.outstanding) as total_outstanding
     * FROM invoices i
     * JOIN customers c ON c.id = i.customer_id
     * WHERE i.status NOT IN ('PAID','CANCELLED','VOID','DRAFT')
     *   AND i.outstanding > 0
     *   AND i.deleted_at IS NULL
     * GROUP BY c.id, c.customer_name
     * ORDER BY total_outstanding DESC
     *
     * Performance: Sử dụng GENERATED COLUMN `outstanding` (STORED) → index-friendly
     */
    public function agingReport(Request $request): array

    /**
     * debtTrend() — Xu hướng công nợ 6 tháng
     *
     * Method: Point-in-time calculation using invoice-level balances.
     * Receipts subtraction CONSTRAINED to receipts linked to eligible invoices.
     *
     * Logic for each month M (last 6 calendar months):
     *
     * outstanding_eom(M) =
     *   SUM(i.total_amount  WHERE i.invoice_date <= LAST_DAY(M)
     *                         AND i.status NOT IN (CANCELLED, VOID, DRAFT)
     *                         AND i.deleted_at IS NULL)
     *   -
     *   SUM(r.amount        WHERE r.invoice_id IS NOT NULL
     *                         AND r.invoice_id IN (eligible invoice ids above)
     *                         AND r.receipt_date <= LAST_DAY(M)
     *                         AND r.status = 'CONFIRMED'
     *                         AND r.deleted_at IS NULL)
     *   -- Include BOTH positive and negative (reversal offset) confirmed receipts.
     *   -- Net math: +X + (-X) = 0 after reversal. This is correct.
     *   -- No is_reversal_offset filter here.
     *
     * Month cutoff: LAST_DAY(DATE_FORMAT(month_start, '%Y-%m-01'))
     * Performance: index on (invoice_date, status, deleted_at), (receipt_date, invoice_id, status, deleted_at)
     * Test: verify outstanding_eom decreases after receipt added, increases after receipt reversed
     */
    public function debtTrend(Request $request): array
}
```

### 5.8. Overdue Status Refresh — Chiến lược duy nhất

**Quyết định:** Dùng **query-time evaluation** (KHÔNG batch job) — đây là chiến lược duy nhất, tất cả endpoints phải sử dụng.

**Lý do chọn query-time:**
- Invoice `outstanding` là GENERATED STORED column → luôn chính xác
- Overdue = `due_date < CURDATE() AND outstanding > 0 AND status NOT IN (PAID, CANCELLED, VOID, DRAFT)`
- KHÔNG cần batch job để toggle status → tránh drift giữa actual status và computed status
- Mọi endpoint (list, dashboard, aging report, widgets) dùng cùng 1 WHERE clause

**Implementation:**
```php
// InvoiceDomainService — shared scope, dùng ở MỌI nơi query overdue
public static function overdueScope(Builder $query): Builder
{
    return $query->where('due_date', '<', now()->toDateString())
                 ->where('outstanding', '>', 0)
                 ->whereNotIn('status', ['PAID', 'CANCELLED', 'VOID', 'DRAFT']);
}
```

**Rollout:** Phase 1 — tạo scope method ngay khi implement InvoiceDomainService.

**Display status logic (frontend):**
- Backend injects computed field `is_overdue: boolean` trong mọi serialization response
  ```php
  'is_overdue' => $invoice->due_date < now() && $invoice->outstanding > 0
                  && !in_array($invoice->status, ['PAID', 'CANCELLED', 'VOID', 'DRAFT']),
  ```
- Frontend: nếu `is_overdue = true` → badge hiển thị `QUÁ HẠN` (đỏ), kèm tooltip ngày quá hạn
- Filter: backend hỗ trợ `?filter_overdue=true` dùng cùng overdueScope()
- Status column trong DB KHÔNG BAO GIỜ = 'OVERDUE' — chỉ có DRAFT, ISSUED, PARTIAL, PAID, CANCELLED, VOID

**Lý do KHÔNG dùng scheduled job:**
- Job chỉ chạy 1 lần/ngày → trong ngày có thể sai
- Phải sync status giữa query-time display và persisted status → phức tạp
- Query-time evaluation + GENERATED column = zero-drift, zero-maintenance

---

### 6.1. Cấu trúc files

```
frontend/components/
├── FeeCollectionHub.tsx          ← MỚI: hub component chính (pattern giống ContractList sub-views)
├── fee-collection/               ← MỚI: sub-components
│   ├── FeeCollectionDashboard.tsx     ← KPI cards + charts
│   ├── InvoiceList.tsx                ← Danh sách hóa đơn + filter + pagination
│   ├── InvoiceModal.tsx               ← Modal tạo/sửa hóa đơn
│   ├── InvoiceBulkGenerateModal.tsx   ← Modal sinh hóa đơn hàng loạt
│   ├── ReceiptList.tsx                ← Danh sách phiếu thu
│   ├── ReceiptModal.tsx               ← Modal tạo/sửa phiếu thu
│   ├── DebtAgingReport.tsx            ← Aging report table + chart
│   ├── DebtByCustomerTable.tsx        ← Công nợ theo KH (expandable)
│   └── DebtTrendChart.tsx             ← SVG line chart xu hướng
│
├── contract-revenue/              ← HIỆN CÓ: TÁI SỬ DỤNG
│   ├── RevenueBarChart.tsx        ← Reuse cho Dashboard Thu Cước
│   └── RevenueCumulativeChart.tsx ← Reuse cho Dashboard Thu Cước
```

### 6.2. Types (thêm vào types.ts)

```typescript
// ── Invoice ─────────────────────────────────────────
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'VOID';
// NOTE: OVERDUE is NOT a persisted status — it's computed via `is_overdue: boolean` field

export interface Invoice {
  id: string | number;
  invoice_code: string;
  invoice_series?: string | null;
  contract_id: string | number;
  customer_id: string | number;
  project_id?: string | number | null;
  invoice_date: string;
  due_date: string;
  period_from?: string | null;
  period_to?: string | null;
  subtotal: number;
  vat_rate?: number | null;
  vat_amount: number;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  status: InvoiceStatus;
  is_overdue: boolean;            // computed: due_date < today && outstanding > 0 && status not terminal
  notes?: string | null;
  items?: InvoiceItem[];
  dunning_logs?: DunningLog[];
  contract_code?: string;
  customer_name?: string;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
}

export interface InvoiceItem {
  id?: string | number;
  invoice_id?: string | number;
  product_id?: string | number | null;
  description: string;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  vat_rate?: number | null;
  line_total?: number;
  vat_amount?: number;
  payment_schedule_id?: string | number | null;
  sort_order?: number;
}

// ── Receipt ─────────────────────────────────────────
export type ReceiptStatus = 'CONFIRMED' | 'PENDING_CONFIRM' | 'REJECTED';
// NOTE: No REVERSED status. Reversal keeps original CONFIRMED + adds negative CONFIRMED offset.
// Use is_reversed/is_reversal boolean flags for display.
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'ONLINE' | 'OFFSET' | 'OTHER';

export interface Receipt {
  id: string | number;
  receipt_code: string;
  invoice_id?: string | number | null;
  contract_id: string | number;
  customer_id: string | number;
  receipt_date: string;
  amount: number;
  payment_method: PaymentMethod;
  bank_name?: string | null;
  bank_account?: string | null;
  transaction_ref?: string | null;
  status: ReceiptStatus;
  notes?: string | null;
  confirmed_by?: string | number | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  is_reversed?: boolean;            // true if this original receipt has been offset by a reversal entry
  is_reversal_offset?: boolean;     // true if this is the negative offsetting entry (amount < 0)
  original_receipt_id?: string | number | null;  // for reversal offsets only
  invoice_code?: string;
  contract_code?: string;
  customer_name?: string;
  created_at?: string;
  created_by?: string | number | null;
}

// ── Dunning ─────────────────────────────────────────
export interface DunningLog {
  id: string | number;
  invoice_id: string | number;
  customer_id: string | number;
  dunning_level: number;
  sent_at: string;
  sent_via: string;
  message?: string | null;
  response_note?: string | null;
}

// ── Fee Collection Dashboard ────────────────────────
export interface FeeCollectionKpis {
  // Period-Flow KPIs
  period_invoiced: number;
  period_collected: number;
  period_collection_rate: number;
  avg_days_to_collect: number;
  // Balance KPIs (point-in-time)
  total_outstanding: number;
  total_overdue: number;
  overdue_count: number;
}

export interface FeeCollectionByMonth {
  month_key: string;
  month_label: string;
  invoiced: number;
  collected: number;
  outstanding_eom: number;      // end-of-month outstanding balance
  cumulative_invoiced: number;
  cumulative_collected: number;
}

export interface TopDebtor {
  customer_id: number;
  customer_name: string;
  total_outstanding: number;
  overdue_amount: number;
  invoice_count: number;
  oldest_overdue_days: number;
}

export interface FeeCollectionDashboard {
  kpis: FeeCollectionKpis;
  by_month: FeeCollectionByMonth[];
  cumulative: FeeCollectionByMonth[];
  top_debtors: TopDebtor[];
  urgent_overdue: OverdueDetail[];
}

// ── Debt Aging Report ───────────────────────────────
export interface DebtAgingRow {
  customer_id: number;
  customer_name: string;
  current_bucket: number;     // Chưa đến hạn
  bucket_1_30: number;        // Quá hạn 1-30 ngày
  bucket_31_60: number;       // Quá hạn 31-60 ngày
  bucket_61_90: number;       // Quá hạn 61-90 ngày
  bucket_over_90: number;     // Quá hạn >90 ngày
  total_outstanding: number;
  invoices?: Invoice[];       // Drill-down
}

export interface DebtAgingReport {
  rows: DebtAgingRow[];
  totals: {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    over_90: number;
    total: number;
  };
}

export interface DebtTrendPoint {
  month_key: string;
  month_label: string;
  total_outstanding: number;
  total_overdue: number;
}
```

### 6.3. API Functions (thêm vào v5Api.ts)

```typescript
// ── Invoices ────────────────────────────────────────
export async function fetchInvoices(params: Record<string, string>): Promise<PaginatedResponse<Invoice>>
export async function fetchInvoiceDetail(id: number | string): Promise<Invoice>
export async function createInvoice(data: Partial<Invoice> & { items: InvoiceItem[] }): Promise<Invoice>
export async function updateInvoice(id: number | string, data: Partial<Invoice> & { items?: InvoiceItem[] }): Promise<Invoice>
export async function deleteInvoice(id: number | string): Promise<void>
export async function bulkGenerateInvoices(data: { contract_ids?: number[], period_from: string, period_to: string }): Promise<{ created_count: number, invoices: Invoice[] }>

// ── Receipts ────────────────────────────────────────
export async function fetchReceipts(params: Record<string, string>): Promise<PaginatedResponse<Receipt>>
export async function fetchReceiptDetail(id: number | string): Promise<Receipt>
export async function createReceipt(data: Partial<Receipt>): Promise<Receipt>
export async function updateReceipt(id: number | string, data: Partial<Receipt>): Promise<Receipt>
export async function deleteReceipt(id: number | string): Promise<void>

// ── Dashboard & Reports ─────────────────────────────
export async function fetchFeeCollectionDashboard(params: { period_from: string, period_to: string }): Promise<FeeCollectionDashboard>
export async function fetchDebtAgingReport(params?: { customer_id?: number }): Promise<DebtAgingReport>
export async function fetchDebtByCustomer(params: { page?: number, per_page?: number, q?: string }): Promise<PaginatedResponse<DebtAgingRow>>
export async function fetchDebtTrend(params: { months?: number }): Promise<DebtTrendPoint[]>

// ── Dunning ─────────────────────────────────────────
export async function fetchDunningLogs(invoiceId: number | string): Promise<DunningLog[]>
export async function createDunningLog(invoiceId: number | string, data: Partial<DunningLog>): Promise<DunningLog>
```

### 6.4. FeeCollectionHub.tsx — Component chính

```
Pattern: Giống ContractList.tsx với sub-view toggle

Props (từ App.tsx):
  - contracts: Contract[]
  - customers: Customer[]
  - currentUser: AuthUser
  - canAdd, canEdit, canDelete: boolean

Internal state:
  - activeView: 'DASHBOARD' | 'INVOICES' | 'RECEIPTS' | 'DEBT_REPORT'
  - periodFrom, periodTo: string (date range)

Sub-view rendering:
  - DASHBOARD → <FeeCollectionDashboard />
  - INVOICES → <InvoiceList /> + <InvoiceModal />
  - RECEIPTS → <ReceiptList /> + <ReceiptModal />
  - DEBT_REPORT → <DebtAgingReport /> + <DebtTrendChart />
```

### 6.5. URL State Sync

Prefix params với `fc_` (fee_collection):

```
?tab=fee_collection&fc_view=INVOICES&fc_q=VNPT&fc_overdue=true&fc_page=2
?tab=fee_collection&fc_view=DASHBOARD&fc_period_from=2026-01-01&fc_period_to=2026-03-31
?tab=fee_collection&fc_view=DEBT_REPORT
```

---

## 7. API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/v5/invoices` | `fee_collection.read` | Danh sách hóa đơn (paginated + KPIs) |
| POST | `/api/v5/invoices` | `fee_collection.write` | Tạo hóa đơn |
| GET | `/api/v5/invoices/{id}` | `fee_collection.read` | Chi tiết hóa đơn + items |
| PUT | `/api/v5/invoices/{id}` | `fee_collection.write` | Cập nhật hóa đơn |
| DELETE | `/api/v5/invoices/{id}` | `fee_collection.delete` | Xóa hóa đơn (soft) |
| POST | `/api/v5/invoices/bulk-generate` | `fee_collection.write` | Sinh HĐ hàng loạt từ payment_schedules |
| GET | `/api/v5/invoices/{id}/dunning-logs` | `fee_collection.read` | Lịch sử nhắc nợ |
| POST | `/api/v5/invoices/{id}/dunning-logs` | `fee_collection.write` | Thêm nhắc nợ |
| GET | `/api/v5/receipts` | `fee_collection.read` | Danh sách phiếu thu (paginated) |
| POST | `/api/v5/receipts` | `fee_collection.write` | Tạo phiếu thu |
| GET | `/api/v5/receipts/{id}` | `fee_collection.read` | Chi tiết phiếu thu |
| PUT | `/api/v5/receipts/{id}` | `fee_collection.write` | Cập nhật phiếu thu |
| DELETE | `/api/v5/receipts/{id}` | `fee_collection.delete` | Xóa phiếu thu (soft) |
| POST | `/api/v5/receipts/{id}/reverse` | `fee_collection.write` | Đảo phiếu thu (tạo bản ghi âm) |
| GET | `/api/v5/fee-collection/dashboard` | `fee_collection.read` | Dashboard KPIs + charts |
| GET | `/api/v5/fee-collection/debt-aging` | `fee_collection.read` | Aging report |
| GET | `/api/v5/fee-collection/debt-by-customer` | `fee_collection.read` | Công nợ theo KH |
| GET | `/api/v5/fee-collection/debt-trend` | `fee_collection.read` | Xu hướng công nợ |

---

## 8. Sub-view: Dashboard Thu Cước

### 8.1. KPI Cards (7 thẻ, 2 hàng: 4 period-flow + 3 balance)

**Hàng 1 — Period-Flow KPIs (scoped to selected period):**

| # | Label | Icon | Value | Trend |
|---|---|---|---|---|
| 1 | Phát hành kỳ | `monetization_on` | `period_invoiced` (VND) | vs. kỳ trước |
| 2 | Đã thu kỳ | `paid` | `period_collected` (VND) | vs. kỳ trước |
| 3 | Tỷ lệ thu | `percent` | `period_collection_rate` (%) | vs. kỳ trước |
| 4 | TB ngày thu | `schedule` | `avg_days_to_collect` (ngày) | vs. kỳ trước |

**Hàng 2 — Balance KPIs (point-in-time, as of today):**

| # | Label | Icon | Value | Highlight |
|---|---|---|---|---|
| 5 | Tổng nợ hiện tại | `account_balance_wallet` | `total_outstanding` (VND) | ↑ = xấu (đỏ) |
| 6 | Nợ quá hạn | `warning` | `total_overdue` (VND) | count kèm theo |
| 7 | Số HĐ quá hạn | `receipt_long` | `overdue_count` | badge đỏ |

**Style:** Giống KPI cards trong ContractList (bg-white, shadow-sm, rounded-lg, p-4).

### 8.2. Charts

**Biểu đồ 1 — Phát hành vs Thực thu** (SVG grouped bar chart):
- Reuse `<RevenueBarChart>` từ `contract-revenue/`
- Data: `by_month[].invoiced` vs `by_month[].collected`
- Thêm bar thứ 3: outstanding_eom (màu đỏ nhạt)

**Biểu đồ 2 — Lũy kế** (SVG line chart):
- Reuse `<RevenueCumulativeChart>` từ `contract-revenue/`
- 2 lines: cumulative_invoiced, cumulative_collected

### 8.3. Widgets

**Top 5 KH nợ nhiều nhất:**
- Bảng nhỏ: STT, Tên KH, Tổng nợ, Nợ quá hạn, Ngày quá hạn lâu nhất
- Click vào KH → filter INVOICES sub-view theo customer_id

**Kỳ quá hạn cần xử lý:**
- Reuse pattern từ `overdue_details` trong ContractRevenueAnalytics
- Hiện 5 kỳ quá hạn lâu nhất, nút "Xem tất cả" → chuyển INVOICES sub-view filter fc_overdue=true

---

## 9. Sub-view: Danh sách Hóa đơn

### 9.1. Filter Bar

| Filter | Type | Default |
|---|---|---|
| Tìm kiếm | Input text (debounced 250ms) | Rỗng |
| Trạng thái | Select: Tất cả, DRAFT, ISSUED, PARTIAL, PAID, CANCELLED, VOID | Tất cả |
| Quá hạn | Toggle: Chỉ xem quá hạn (`filter_overdue=true`) | Tắt |
| Khách hàng | SearchableSelect | Tất cả |
| Kỳ hóa đơn | Date range (from - to) | Tháng hiện tại |

### 9.2. Bảng

| Cột | Sort | Width |
|---|---|---|
| Mã HĐ | ✅ | 140px |
| Khách hàng | ✅ | flex |
| Hợp đồng | ✅ | 140px |
| Ngày HĐ | ✅ | 110px |
| Hạn TT | ✅ | 110px |
| Tổng tiền | ✅ | 130px (right-align) |
| Đã thu | - | 130px (right-align) |
| Còn nợ | ✅ | 130px (right-align, đỏ nếu > 0) |
| Trạng thái | ✅ | 110px (badge) |
| Thao tác | - | 80px |

**Status badge colors:**
- DRAFT → gray
- ISSUED → blue
- PARTIAL → yellow
- PAID → green
- is_overdue=true → red badge "QUÁ HẠN"
- CANCELLED → gray strikethrough
- VOID → gray strikethrough

### 9.3. Actions

| Action | Permission | Condition |
|---|---|---|
| Sửa | `fee_collection.write` | status ∈ {DRAFT, ISSUED} |
| Xóa | `fee_collection.delete` | status = DRAFT |
| Phát hành | `fee_collection.write` | status = DRAFT → ISSUED |
| Tạo phiếu thu | `fee_collection.write` | status ∈ {ISSUED, PARTIAL} hoặc is_overdue=true |
| Nhắc nợ | `fee_collection.write` | status ∈ {ISSUED, PARTIAL} hoặc is_overdue=true |
| Hủy | `fee_collection.write` | status ∉ {PAID, VOID} |
| In/Export | `fee_collection.read` | Luôn |

### 9.4. Nút hành động header

- **"+ Tạo hóa đơn"** → mở InvoiceModal (mode: create)
- **"Sinh HĐ hàng loạt"** → mở InvoiceBulkGenerateModal
- **"Xuất Excel"** → export danh sách đang filter

---

## 10. Sub-view: Quản lý Phiếu thu

### 10.1. Filter Bar

| Filter | Type |
|---|---|
| Tìm kiếm | Input text (debounced 250ms) |
| Hóa đơn | SearchableSelect (invoice_code) |
| Khách hàng | SearchableSelect |
| Phương thức | Select: Tất cả, Tiền mặt, Chuyển khoản, Online, Bù trừ |
| Ngày thu | Date range (from - to) |

### 10.2. Bảng

| Cột | Sort |
|---|---|
| Mã phiếu thu | ✅ |
| Khách hàng | ✅ |
| Hóa đơn | - |
| Hợp đồng | - |
| Ngày thu | ✅ |
| Số tiền | ✅ (right-align) |
| Phương thức | - |
| Trạng thái | ✅ |
| Người xác nhận | - |
| Thao tác | - |

---

## 11. Sub-view: Báo cáo Công nợ

### 11.1. Aging Report Table

```
┌─────────────┬──────────┬─────────┬──────────┬──────────┬──────────┬──────────┐
│ Khách hàng  │ Hiện tại │ 1-30 ng │ 31-60 ng │ 61-90 ng │ > 90 ng  │ Tổng nợ  │
├─────────────┼──────────┼─────────┼──────────┼──────────┼──────────┼──────────┤
│ VNPT Corp   │ 50M      │ 30M     │ 10M      │ 0        │ 5M       │ 95M      │
│  └ INV-001  │          │ 30M     │          │          │          │ 30M      │
│  └ INV-002  │ 50M      │         │          │          │          │ 50M      │
│  └ INV-003  │          │         │ 10M      │          │ 5M       │ 15M      │
├─────────────┼──────────┼─────────┼──────────┼──────────┼──────────┼──────────┤
│ Tổng cộng   │ xxx      │ xxx     │ xxx      │ xxx      │ xxx      │ xxx      │
└─────────────┴──────────┴─────────┴──────────┴──────────┴──────────┴──────────┘
```

- Expandable rows: click KH → hiện danh sách hóa đơn chi tiết
- Color coding: bucket càng xa → màu càng đỏ
- Footer: tổng cộng từng bucket

### 11.2. Debt Trend Chart

- SVG line chart 6 tháng gần nhất
- 2 lines: total_outstanding (xanh), total_overdue (đỏ)
- Tooltip hiện giá trị khi hover

### 11.3. Export

- Export Excel: aging report + debt by customer
- Định dạng tiền tệ VND, ngày DD/MM/YYYY

---

## 12. Phân quyền

### 12.1. Permissions mới

```php
// Thêm vào seeder hoặc config permissions
'fee_collection.read'   => 'Xem thu cước',
'fee_collection.write'  => 'Tạo/sửa hóa đơn & phiếu thu',
'fee_collection.delete' => 'Xóa hóa đơn & phiếu thu',
```

### 12.2. Frontend tab visibility

```typescript
// utils/authorization.ts — canAccessTab()
case 'fee_collection':
  return hasPermission(user, 'fee_collection.read');
```

### 12.3. Data scope

Áp dụng `applyReadScope()` pattern từ ContractDomainService:
- User thấy hóa đơn/phiếu thu thuộc phòng ban mình hoặc do mình tạo
- Manager thấy toàn bộ phòng ban quản lý
- Admin thấy tất cả

---

## 13. Hiệu năng

### 13.1. Database Indexing Strategy

| Table | Key indexes | Purpose |
|---|---|---|
| `invoices` | `(status)`, `(due_date)`, `(customer_id)`, `(invoice_date, status)`, `(outstanding)` | Filter, sort, aging report |
| `invoice_items` | `(invoice_id)` | Join khi load detail |
| `receipts` | `(invoice_id)`, `(customer_id)`, `(receipt_date)`, `(status)` | Filter, reconciliation |
| `dunning_logs` | `(invoice_id)`, `(customer_id)` | History lookup |

### 13.2. Generated Columns (STORED)

- `invoices.outstanding` = `total_amount - paid_amount` → GENERATED STORED, indexable
- `invoice_items.line_total` = `quantity * unit_price` → GENERATED STORED
- `invoice_items.vat_amount` = `line_total * vat_rate / 100` → GENERATED STORED

**Lợi ích:** Không cần recalculate ở application layer, query trực tiếp WHERE outstanding > 0.

### 13.3. Query Optimization

- **Aging report:** Single query với CASE WHEN + GROUP BY → O(n) scan, n = số HĐ outstanding
- **Dashboard KPIs:** Aggregate queries, không load toàn bộ rows
- **List endpoints:** Server-side pagination (25/page default), indexed sort columns
- **Debounced search:** 250ms (frontend), giống pattern hiện tại

### 13.4. Caching Strategy

```php
// Cache key pattern (giống v5:{resource}:list:v1)
Cache::remember('v5:invoices:kpis:' . $cacheKey, 900, fn() => $this->buildKpis(...));
// Invalidate on write
Cache::forget('v5:invoices:kpis:*'); // Wildcard or tagged cache
```

### 13.5. Frontend Performance

- **Lazy render sub-views:** Chỉ mount component khi sub-view active
- **GET deduplication:** `v5Api.ts` đã có `inFlightGetRequests` → tự deduplicate
- **AbortController:** Huỷ request cũ khi filter thay đổi nhanh
- **Memoized formatters:** `useMemo` cho currency formatting, date display

---

## 14. Files tạo mới & sửa

### Files MỚI (17 files)

| # | File | Mô tả |
|---|---|---|
| 1 | `backend/database/migrations/2026_03_24_000001_create_invoices_table.php` | Migration bảng invoices |
| 2 | `backend/database/migrations/2026_03_24_000002_create_invoice_items_table.php` | Migration bảng invoice_items |
| 3 | `backend/database/migrations/2026_03_24_000003_create_receipts_table.php` | Migration bảng receipts |
| 4 | `backend/database/migrations/2026_03_24_000004_create_dunning_logs_table.php` | Migration bảng dunning_logs |
| 5 | `backend/database/migrations/2026_03_24_000005_add_invoice_id_to_payment_schedules.php` | Thêm cột invoice_id |
| 6 | `backend/app/Models/Invoice.php` | Model Invoice |
| 7 | `backend/app/Models/InvoiceItem.php` | Model InvoiceItem |
| 8 | `backend/app/Models/Receipt.php` | Model Receipt |
| 9 | `backend/app/Models/DunningLog.php` | Model DunningLog |
| 10 | `backend/app/Http/Controllers/Api/V5/FeeCollectionController.php` | Controller |
| 11 | `backend/app/Services/V5/FeeCollection/InvoiceDomainService.php` | Service hóa đơn |
| 12 | `backend/app/Services/V5/FeeCollection/ReceiptDomainService.php` | Service phiếu thu |
| 13 | `backend/app/Services/V5/FeeCollection/FeeCollectionDashboardService.php` | Service dashboard |
| 14 | `backend/app/Services/V5/FeeCollection/DebtAgingReportService.php` | Service aging report |
| 15 | `frontend/components/FeeCollectionHub.tsx` | Hub component chính |
| 16 | `frontend/components/fee-collection/FeeCollectionDashboard.tsx` | Dashboard sub-view |
| 17 | `frontend/components/fee-collection/InvoiceList.tsx` | Danh sách hóa đơn |
| 18 | `frontend/components/fee-collection/InvoiceModal.tsx` | Modal tạo/sửa HĐ |
| 19 | `frontend/components/fee-collection/InvoiceBulkGenerateModal.tsx` | Modal sinh HĐ loạt |
| 20 | `frontend/components/fee-collection/ReceiptList.tsx` | Danh sách phiếu thu |
| 21 | `frontend/components/fee-collection/ReceiptModal.tsx` | Modal tạo/sửa phiếu thu |
| 22 | `frontend/components/fee-collection/DebtAgingReport.tsx` | Aging report |
| 23 | `frontend/components/fee-collection/DebtByCustomerTable.tsx` | Công nợ theo KH |
| 24 | `frontend/components/fee-collection/DebtTrendChart.tsx` | Chart xu hướng |

### Files SỬA (6 files)

| # | File | Thay đổi |
|---|---|---|
| 1 | `frontend/components/Sidebar.tsx` | Thêm group `fin` với item `fee_collection` |
| 2 | `frontend/types.ts` | Thêm interfaces Invoice, Receipt, DunningLog, dashboard types |
| 3 | `frontend/services/v5Api.ts` | Thêm API functions cho invoices, receipts, dashboard, reports |
| 4 | `frontend/utils/authorization.ts` | Thêm `fee_collection` vào `canAccessTab()` |
| 5 | `frontend/App.tsx` | Thêm state + handlers + render FeeCollectionHub trong tab switch |
| 6 | `backend/routes/api.php` | Thêm routes cho /invoices, /receipts, /fee-collection/* |

### Files KHÔNG SỬA

| File | Lý do |
|---|---|
| `ContractDomainService.php` | Không can thiệp logic hợp đồng hiện tại |
| `ContractRevenueAnalyticsService.php` | Không sửa, chỉ tham khảo query patterns |
| `PaymentScheduleTab.tsx` | Giữ nguyên, tab HĐ vẫn hoạt động độc lập |
| `ContractList.tsx` | Giữ nguyên sub-view Revenue trong tab HĐ |

---

## 15. Phased Rollout

### Phase 1 (Tuần 1-2): Foundation + Invoice CRUD

**Mục tiêu:** Có thể tạo, xem, sửa, xóa hóa đơn.

| Task | Files |
|---|---|
| 5 migrations | `2026_03_24_000001` → `000005` |
| 4 models | Invoice, InvoiceItem, Receipt, DunningLog |
| InvoiceDomainService (index, store, show, update, destroy) | `FeeCollection/InvoiceDomainService.php` |
| FeeCollectionController (invoice methods) | `FeeCollectionController.php` |
| Routes cho invoices | `api.php` |
| Frontend types | `types.ts` |
| API functions cho invoices | `v5Api.ts` |
| Sidebar + tab + authorization | `Sidebar.tsx`, `authorization.ts`, `App.tsx` |
| InvoiceList + InvoiceModal | `fee-collection/InvoiceList.tsx`, `InvoiceModal.tsx` |
| FeeCollectionHub (shell + INVOICES view) | `FeeCollectionHub.tsx` |

**Deliverable:** Tab "Thu cước" xuất hiện, vào được INVOICES sub-view, CRUD hoạt động.

### Phase 2 (Tuần 3-4): Receipts + Invoice→Receipt Flow

**Mục tiêu:** Ghi nhận thanh toán, auto-update invoice status.

| Task | Files |
|---|---|
| ReceiptDomainService (full CRUD + reconciliation) | `ReceiptDomainService.php` |
| FeeCollectionController (receipt methods) | `FeeCollectionController.php` |
| Receipt routes | `api.php` |
| API functions cho receipts | `v5Api.ts` |
| ReceiptList + ReceiptModal | `ReceiptList.tsx`, `ReceiptModal.tsx` |
| FeeCollectionHub (RECEIPTS view) | `FeeCollectionHub.tsx` |
| Invoice status auto-update logic | `ReceiptDomainService.php` |
| Bulk generate invoices | `InvoiceBulkGenerateModal.tsx`, `InvoiceDomainService.php` |

**Deliverable:** Tạo phiếu thu → invoice tự động cập nhật paid_amount + status.

### Phase 3 (Tuần 5-6): Dashboard + Debt Reports

**Mục tiêu:** Dashboard KPI, aging report, debt trend.

| Task | Files |
|---|---|
| FeeCollectionDashboardService | `FeeCollectionDashboardService.php` |
| DebtAgingReportService | `DebtAgingReportService.php` |
| Dashboard routes | `api.php` |
| API functions cho dashboard + reports | `v5Api.ts` |
| FeeCollectionDashboard | `FeeCollectionDashboard.tsx` |
| DebtAgingReport | `DebtAgingReport.tsx` |
| DebtByCustomerTable | `DebtByCustomerTable.tsx` |
| DebtTrendChart | `DebtTrendChart.tsx` |

**Deliverable:** Dashboard hoạt động, aging report chính xác, export Excel.

### Phase 4 (Tuần 7-8): Dunning + Polish

**Mục tiêu:** Nhắc nợ, tối ưu hiệu năng, test coverage.

| Task | Files |
|---|---|
| Dunning log CRUD | Controller, routes |
| Dunning UI trong InvoiceModal | `InvoiceModal.tsx` |
| Caching cho dashboard KPIs | `FeeCollectionDashboardService.php` |
| Feature tests | `tests/Feature/FeeCollectionTest.php` |
| E2E tests | `e2e/fee-collection.smoke.spec.ts` |
| Performance tuning (index, query optimize) | Migrations, services |

**Deliverable:** Module hoàn chỉnh, test coverage > 80%, performance đạt yêu cầu.

---

## 16. Test Plan

### 16.1. Backend Feature Tests

```php
// tests/Feature/FeeCollectionInvoiceCrudTest.php
class FeeCollectionInvoiceCrudTest extends TestCase
{
    use RefreshDatabase, InteractsWithCustomerRequestCaseFixtures;

    // Invoice CRUD
    public function test_can_list_invoices_with_pagination()
    public function test_can_create_invoice_with_items()
    public function test_invoice_code_auto_generated()
    public function test_cannot_create_invoice_for_draft_contract()
    public function test_can_update_draft_invoice()
    public function test_cannot_update_paid_invoice()
    public function test_can_delete_draft_invoice()
    public function test_cannot_delete_issued_invoice()

    // Bulk generate
    public function test_bulk_generate_creates_invoices_from_pending_schedules()
    public function test_bulk_generate_updates_schedule_status_to_invoiced()
    public function test_bulk_generate_skips_already_invoiced_schedules()

    // Receipt flow — full lifecycle (ISSUE-2 fix)
    public function test_receipt_updates_invoice_paid_amount()
    public function test_receipt_sets_invoice_to_partial_when_partial_payment()
    public function test_receipt_sets_invoice_to_paid_when_full_payment()
    public function test_receipt_update_recalculates_invoice_paid_amount()
    public function test_receipt_delete_rollbacks_invoice_paid_amount()
    public function test_receipt_reverse_creates_negative_entry()
    public function test_receipt_reverse_rollbacks_invoice_status()
    public function test_advance_receipt_without_invoice()
    public function test_assign_advance_receipt_to_invoice()

    // Invoice code generation — concurrency (ISSUE-3 fix)
    public function test_concurrent_invoice_creation_no_duplicate_codes()

    // Reconciliation cascade
    public function test_receipt_cascades_to_payment_schedule()
    public function test_receipt_delete_cascades_rollback_to_schedule()

    // Audit coverage (ISSUE-7 fix)
    public function test_invoice_store_creates_audit_log()
    public function test_receipt_store_creates_audit_log()
    public function test_dunning_store_creates_audit_log()
    public function test_bulk_generate_creates_audit_logs()
    public function test_reconciliation_side_effect_creates_audit_log()

    // Aging report — 5 buckets (ISSUE-4 fix)
    public function test_aging_report_5_buckets_correct()
    public function test_aging_report_excludes_paid_invoices()
    public function test_aging_report_bucket_boundaries_exact()

    // Dashboard — split KPIs (ISSUE-5 fix)
    public function test_dashboard_period_flow_kpis_scoped_to_period()
    public function test_dashboard_balance_kpis_point_in_time()
    public function test_dashboard_outstanding_from_invoice_balances_not_period_diff()
    public function test_dashboard_collection_rate_percentage()

    // Authorization
    public function test_user_without_permission_cannot_access()
    public function test_data_scope_filters_by_department()
}
```

### 16.2. Frontend E2E Tests

```typescript
// e2e/fee-collection.smoke.spec.ts
test('Tab Thu Cước hiện trong sidebar khi có quyền');
test('Dashboard hiển thị KPI cards');
test('Invoice list loads with pagination');
test('Create invoice modal works');
test('Receipt creation updates invoice status');
test('Aging report displays correct buckets');
test('Export Excel works');
```

### 16.3. Unit Tests

```typescript
// __tests__/feeCollectionHelpers.test.ts
test('Invoice status badge renders correctly');
test('Currency formatting for VND');
test('Aging bucket calculation');
test('Invoice code validation');
```

---

## Appendix A: Relationship Diagram

```
                    ┌──────────────┐
                    │  customers   │
                    └──────┬───────┘
                           │ 1:N
                    ┌──────┴───────┐
                    │  contracts   │
                    └──────┬───────┘
                           │ 1:N
              ┌────────────┼────────────┐
              │            │            │
    ┌─────────┴──────┐  ┌─┴──────────┐ │
    │payment_schedules│  │contract_items│ │
    └─────────┬──────┘  └────────────┘ │
              │ N:1                     │ 1:N
              │         ┌──────────────┘
              │         │
         ┌────┴─────────┴──┐
         │    invoices      │
         └────────┬─────────┘
                  │ 1:N        1:N
           ┌──────┼──────────────┐
           │      │              │
    ┌──────┴───┐ ┌┴────────────┐ ┌┴───────────┐
    │invoice_  │ │  receipts   │ │dunning_logs│
    │  items   │ └─────────────┘ └────────────┘
    └──────────┘
```

## Appendix B: Invoice Status Workflow

```
Persisted statuses: DRAFT | ISSUED | PARTIAL | PAID | CANCELLED | VOID
Computed display:   is_overdue=true (badge "QUÁ HẠN", NOT a persisted status)

DRAFT ──→ ISSUED ──→ PARTIAL ──→ PAID
  │
  └───→ CANCELLED (manual)

ISSUED/PARTIAL ──→ VOID (manual, chỉ admin)

Transitions (all via reconcileInvoice() after receipt mutation):
  - ISSUED → PARTIAL: receipt tạo, 0 < paid_amount < total_amount
  - ISSUED → PAID: receipt tạo, paid_amount >= total_amount
  - PARTIAL → PAID: receipt tạo, paid_amount >= total_amount
  - PAID → PARTIAL: receipt deleted/reversed, paid_amount < total_amount

Display logic (computed, NOT stored):
  - is_overdue = due_date < today AND outstanding > 0 AND status ∈ {ISSUED, PARTIAL}
  - Overdue badge shown on top of persisted status (e.g. "ISSUED / QUÁ HẠN")
```

## Appendix C: Invoice Code Generation

```php
// Pattern: INV-YYYYMM-NNNN
// Thread-safe: SELECT FOR UPDATE + retry on UNIQUE violation
private function generateInvoiceCode(): string
{
    $prefix = 'INV-' . now()->format('Ym') . '-';

    return DB::transaction(function () use ($prefix) {
        // Lock last row with this prefix to prevent concurrent reads
        $maxRow = Invoice::withTrashed()
            ->where('invoice_code', 'like', $prefix . '%')
            ->orderByDesc('invoice_code')
            ->lockForUpdate()
            ->first(['invoice_code']);

        if ($maxRow) {
            $seq = (int) substr($maxRow->invoice_code, -4) + 1;
        } else {
            $seq = 1;
        }

        return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
    });
}

// Caller wraps in retry loop (max 3 attempts) for UNIQUE constraint fallback:
// retry(3, fn() => $this->generateAndInsert(...), 100);
```
