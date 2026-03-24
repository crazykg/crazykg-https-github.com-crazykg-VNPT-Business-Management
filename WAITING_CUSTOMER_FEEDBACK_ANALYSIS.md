# Phân Tích Luồng "Đợi Phản Hồi Khách Hàng" (waiting_customer_feedback)
## XML Diagram vs Code Implementation

---

## 📋 Phần 1: XML Workflow Diagram

### Flow trong XML (workflowa.drawio.xml)

```
┌─────────────────────────────────────────────────────────┐
│ PM (Dispatcher) đánh giá lý do chưa thực hiện được:     │
│                                                         │
│ "Do khách hàng chưa cung cấp đủ thông tin?"            │
│                                                         │
│ [Quyết định: Có / Không]                               │
└──────────┬────────────────────────────────────┬─────────┘
           │ Không (PM có thể xử lý)             │ Có (Khách hàng chưa cung cấp info)
           │                                      │
           ▼                                      ▼
    ┌─────────────┐                  ┌────────────────────────────────┐
    │ (Tiếp tục   │                  │ Chờ khách hàng cung cấp thông  │
    │  flow)      │                  │ tin                            │
    └─────────────┘                  │                                │
                                     │ Trạng thái:                    │
                                     │ "Đợi phản hồi từ khách hàng"   │
                                     │                                │
                                     │ Người xem được YC:             │
                                     │ - PM (Dispatcher)              │
                                     │ - Creator (người nhập YC)      │
                                     │ - Performer (người thực hiện)  │
                                     └────────────────────────────────┘
```

**Điểm khởi phát (Entry point):**
- **From:** pending_dispatch
- **Decision:** PM đánh giá: "Khách hàng chưa cung cấp đủ thông tin?"
- **Decision Type:** Binary (Có/Không)
- **Trigger:** "PM chờ KH bổ sung thông tin"

**Người xem được (Visibility):**
- PM (Dispatcher) ✓
- Creator (người nhập YC) ✓
- Performer (người thực hiện) ✓

---

## 💾 Phần 2: Backend Implementation (Code)

### 2.1 Status Definition (Registry)

**File:** `backend/app/Services/V5/Domain/CustomerRequestCaseRegistry.php`

```php
self::status(
    'waiting_customer_feedback',
    'Đợi phản hồi từ khách hàng',
    'customer_request_waiting_customer_feedbacks',
    [
        ...$commonColumns,
        self::column('received_at', 'Ngày tiếp nhận'),
    ],
    [
        self::field('feedback_request_content', 'Nội dung yêu cầu phản hồi', 'textarea'),
        self::field('feedback_requested_at', 'Ngày gửi phản hồi', 'datetime'),
        self::field('customer_due_at', 'Hạn phản hồi', 'datetime'),
        self::field('customer_feedback_at', 'Ngày khách hàng phản hồi', 'datetime'),
        self::field('customer_feedback_content', 'Nội dung khách hàng phản hồi', 'textarea'),
        self::field('notes', 'Ghi chú trạng thái', 'textarea'),
    ]
)
```

**Cấu hình chi tiết:**
- **Status Code:** `waiting_customer_feedback`
- **Label:** "Đợi phản hồi từ khách hàng"
- **Table Name:** `customer_request_waiting_customer_feedbacks`
- **Status Group:** "intake" (cùng với: new_intake, pending_dispatch, dispatched)

### 2.2 Status Transition Rules

**File:** `backend/database/migrations/2026_03_21_100200_seed_v4_status_catalog_and_transitions.php`

```php
// Transition từ pending_dispatch → waiting_customer_feedback
['pending_dispatch', 'waiting_customer_feedback', 'forward', false, 30,
 'PM chờ KH bổ sung thông tin']
```

**Chi tiết Transition:**
| Attribute | Value | Ý nghĩa |
|-----------|-------|---------|
| `from_status_code` | `pending_dispatch` | Từ trạng thái "Chờ PM điều phối" |
| `to_status_code` | `waiting_customer_feedback` | Đến trạng thái "Đợi phản hồi KH" |
| `direction` | `forward` | Chuyển tiến (không backward) |
| `is_default` | `false` | KHÔNG phải luồng mặc định |
| `sort_order` | 30 | Độ ưu tiên hiển thị |
| `notes` | "PM chờ KH bổ sung thông tin" | Mô tả hành động |

### 2.3 Database Schema

**File:** `backend/database/migrations/2026_03_16_220000_create_customer_request_case_workflow_tables.php`

```sql
CREATE TABLE customer_request_waiting_customer_feedbacks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    request_case_id BIGINT NOT NULL,
    status_instance_id BIGINT NOT NULL,
    status_code VARCHAR(80) NOT NULL,
    status_table VARCHAR(120) NOT NULL,
    status_row_id BIGINT NULL,

    -- waiting_customer_feedback specific fields
    feedback_request_content LONGTEXT NULL COMMENT 'Nội dung yêu cầu khách hàng phản hồi',
    feedback_requested_at DATETIME NULL COMMENT 'Ngày gửi yêu cầu phản hồi',
    customer_due_at DATETIME NULL COMMENT 'Hạn phản hồi của khách hàng',
    customer_feedback_at DATETIME NULL COMMENT 'Ngày khách hàng phản hồi',
    customer_feedback_content LONGTEXT NULL COMMENT 'Nội dung khách hàng phản hồi',

    notes LONGTEXT NULL,

    -- Audit fields
    created_by BIGINT NULL,
    updated_by BIGINT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    FOREIGN KEY (request_case_id) REFERENCES customer_request_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (status_instance_id) REFERENCES customer_request_status_instances(id) ON DELETE CASCADE,
    INDEX idx_request_case_status (request_case_id, status_code)
);
```

**Các trường dữ liệu chính:**
1. **feedback_request_content** (text) - PM ghi nhận nội dung cần khách hàng phản hồi
2. **feedback_requested_at** (datetime) - Lúc PM gửi yêu cầu phản hồi
3. **customer_due_at** (datetime) - Hạn chót khách hàng phải phản hồi
4. **customer_feedback_at** (datetime) - Lúc khách hàng thực sự phản hồi
5. **customer_feedback_content** (text) - Nội dung phản hồi của khách hàng
6. **notes** (text) - Ghi chú trạng thái

### 2.4 Status Instance Linking

**Liên kết với master table:**

```
customer_request_cases (master)
    ↓
    id = request_case_id
    current_status_code = 'waiting_customer_feedback'
    ↓
customer_request_status_instances (audit trail)
    ↓
    id = status_instance_id
    status_code = 'waiting_customer_feedback'
    ↓
customer_request_waiting_customer_feedbacks (status-specific data)
    ↓
    status_row_id = id (của waiting_customer_feedbacks record)
```

---

## 🎨 Phần 3: Frontend Implementation

### 3.1 Status Color & Display

**File:** `frontend/components/customer-request/presentation.ts`

```typescript
// Status color mapping
STATUS_COLOR_MAP: {
  waiting_customer_feedback: {
    label: 'Đợi phản hồi KH',
    cls: 'bg-yellow-100 text-yellow-700'
  }
}

// List KPI status
LIST_KPI_STATUSES: {
  code: 'waiting_customer_feedback',
  label: 'Đợi phản hồi KH',
  cls: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  activeCls: 'ring-2 ring-yellow-400'
}

// Attention reason (dashboard hints)
ATTENTION_REASON_META: {
  waiting_customer_feedback: {
    label: 'Đợi phản hồi KH',
    cls: 'bg-yellow-100 text-yellow-700'
  }
}
```

### 3.2 Quick Action Hints

**File:** `frontend/components/customer-request/presentation.ts`

```typescript
// For Creator role
if (request.trang_thai === 'waiting_customer_feedback') {
  return roleFilter === 'creator'
    ? {
        label: 'Đánh giá phản hồi KH',
        hint: 'Creator cần review và mở lại flow',
        cls: 'bg-sky-100 text-sky-700',
      }
    : {
        label: 'Chờ phản hồi KH',
        hint: 'Theo dõi phản hồi để tiếp tục xử lý',
        cls: 'bg-amber-100 text-amber-700',
      };
}
```

**Hành động tùy theo role:**

| Role | Action | Hint |
|------|--------|------|
| **Creator** | Đánh giá phản hồi KH | Review feedback từ KH & mở lại flow (chuyển sang in_progress) |
| **Dispatcher** | Chờ phản hồi KH | Theo dõi KH phản hồi để tiếp tục |
| **Performer** | Chờ phản hồi KH | Theo dõi KH phản hồi để tiếp tục |

### 3.3 Type Definition

**File:** `frontend/types.ts`

```typescript
export type CRCStatusCode =
  | 'new_intake'
  | 'pending_dispatch'
  | 'dispatched'
  | 'waiting_customer_feedback'  // ← waiting_customer_feedback
  | 'in_progress'
  | 'analysis'
  | 'returned_to_manager'
  | 'coding'
  | 'dms_transfer'
  | 'completed'
  | 'customer_notified'
  | 'not_executed';
```

---

## 🔀 Phần 4: Transition Flow Analysis

### 4.1 Transitions từ/đến waiting_customer_feedback

**File:** `backend/database/migrations/2026_03_21_100200_seed_v4_status_catalog_and_transitions.php`

```php
// Forward transitions FROM pending_dispatch
['pending_dispatch', 'waiting_customer_feedback', 'forward', false, 30, 'PM chờ KH bổ sung thông tin']
```

**Tất cả transitions liên quan đến waiting_customer_feedback:**

| From | To | Direction | Is Default | Description |
|------|----|-----------| -----------|-------------|
| pending_dispatch | waiting_customer_feedback | forward | ❌ NO | PM yêu cầu KH bổ sung info |
| waiting_customer_feedback | ??? | forward | - | ? (Chưa định nghĩa rõ) |

**QUAN TRỌNG:** Hiện tại chỉ có 1 transition vào `waiting_customer_feedback`. Những transition RỜI khỏi status này chưa được định nghĩa rõ ràng!

### 4.2 Possible Exit Transitions (Nên có nhưng chưa implement)

Dựa trên XML workflow, từ "Chờ khách hàng cung cấp thông tin" có thể chuyển sang:

1. **→ in_progress** (khi khách hàng phản hồi)
   - Trigger: Creator review feedback → "Đủ thông tin, bắt đầu xử lý"
   - Dự kiến: `waiting_customer_feedback → in_progress`

2. **→ not_executed** (khi hết hạn mà KH vẫn không phản hồi)
   - Trigger: Timeout / PM quyết định bỏ qua
   - Dự kiến: `waiting_customer_feedback → not_executed`

3. **→ pending_dispatch** (backward - PM muốn thay đổi yêu cầu)
   - Trigger: PM nhận ra cần điều chỉnh lại
   - Dự kiến: `waiting_customer_feedback → pending_dispatch` (backward)

---

## 🔍 Phần 5: Sự Khác Biệt Giữa XML Diagram vs Code Implementation

### 5.1 Bảng So Sánh Chi Tiết

| Khía Cạnh | XML Diagram | Code Implementation | Gap / Khác Biệt |
|-----------|------------|---------------------|-----------------|
| **Entry Point** | PM decision: "KH chưa cung cấp info?" | Transition: pending_dispatch → waiting_customer_feedback | ✓ Match |
| **Entry Condition** | Binary (Có/Không) | Single transition rule (PM chọn) | ✓ Match |
| **Exit Points** | Chưa vẽ rõ | Chưa định nghĩa transition | ⚠️ **GAP: Chưa implement các exit transitions** |
| **Field: feedback_request_content** | "Chờ khách hàng cung cấp thông tin" | ✓ Có trường trong DB | ✓ Match |
| **Field: customer_feedback_at** | "Ngày khách hàng phản hồi" | ✓ Có trường trong DB | ✓ Match |
| **Visibility** | PM, Creator, Performer | ❓ Chưa check rõ trong code | ❓ Need verification |
| **Timeout/SLA** | Chưa đề cập | customer_due_at (field có sẵn) | ⚠️ **GAP: Logic handle due date chưa implement** |
| **Notification** | Chưa đề cập | ❓ Chưa implement | ⚠️ **GAP: Notif to customer chưa rõ** |

### 5.2 Chi Tiết Các Gap (Khoảng Cách)

#### **GAP #1: Missing Exit Transitions**
- **XML nói:** "Chờ phản hồi → tiếp tục flow / hủy"
- **Code hiện tại:** Chỉ có transition vào, không có transition ra
- **Cần implement:**
  ```php
  // waiting_customer_feedback → in_progress (when customer feedback is received)
  ['waiting_customer_feedback', 'in_progress', 'forward', true, 50, 'Khách hàng phản hồi, bắt đầu xử lý']

  // waiting_customer_feedback → not_executed (when timeout/no response)
  ['waiting_customer_feedback', 'not_executed', 'forward', false, 60, 'Hết hạn phản hồi']

  // waiting_customer_feedback → pending_dispatch (backward - PM adjust)
  ['waiting_customer_feedback', 'pending_dispatch', 'backward', false, 40, 'PM điều chỉnh yêu cầu']
  ```

#### **GAP #2: No SLA/Timeout Logic**
- **XML nói:** Có hạn phản hồi (implicit)
- **Code hiện tại:** Trường `customer_due_at` tồn tại nhưng không có logic check timeout
- **Cần implement:**
  - Status transition trigger khi `customer_due_at` expire
  - Notification reminder trước deadline
  - Alert if customer hasn't responded after due date

#### **GAP #3: No Customer Notification Logic**
- **XML nói:** "Chờ khách hàng cung cấp thông tin" (implies customer should be notified)
- **Code hiện tại:** Chưa có endpoint/service để notify customer
- **Cần implement:**
  - API to send request to customer
  - Email/SMS notification template
  - Track notification status

#### **GAP #4: No Feedback Validation/Verification**
- **XML nói:** KH phản hồi (implicit: phản hồi có giá trị)
- **Code hiện tại:** Trường `customer_feedback_content` tồn tại nhưng không validate
- **Cần implement:**
  - Validation rules for customer feedback (min length, required fields)
  - Creator review/approval workflow
  - Feedback rejection option (ask for more info)

---

## 📊 Phần 6: Workflow Diagram Mô Phỏng (Proposed)

### 6.1 Current State Diagram (Hiện Tại)

```
┌──────────────────────────────────────┐
│ pending_dispatch                     │
│ (PM đánh giá + xác định hành động)  │
└──────────────────┬───────────────────┘
                   │
         ┌─────────┴─────────┬──────────────┬──────────┐
         │                   │              │          │
         ▼                   ▼              ▼          ▼
    dispatched      not_executed      analysis    in_progress
   (assign R)       (reject)          (analyze)   (handle)
         │
    ┌────┴────────────────────────────────────────────────┐
    │  **MISSING: waiting_customer_feedback**            │
    │  (No entry transition defined in code!)            │
    │  ❌ DEAD END                                        │
    └──────────────────────────────────────────────────────┘

Reality: waiting_customer_feedback exists but is UNREACHABLE!
```

### 6.2 Proposed Complete Flow (Nên Có)

```
                    ┌─────────────────────────────────────────┐
                    │      new_intake                         │
                    │  (Mới tiếp nhận yêu cầu)               │
                    └──────────────┬──────────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │   pending_dispatch          │
                    │ (PM điều phối/quyết định)   │
                    └──┬──────┬──────┬─────────┬──┘
                       │      │      │         │
        ┌──────────────┐│      │      │    ┌────────────────────────┐
        │              ││      │      │    │                        │
        ▼              ▼▼      ▼      ▼    ▼                        ▼
   not_executed  dispatched analysis in_progress          waiting_customer_feedback
   (PM từ chối)  (assign R) (analyze)  (PM handle)  ◄──────(PM: KH chưa cung cấp info)
                    │                        │              │
                    │                        │              │  ┌──────────────────────┐
                    │                        │              │  │ PM gửi yêu cầu       │
                    │                        │              │  │ feedback_request_at  │
                    │                        │              │  │ customer_due_at      │
                    │                        │              │  └──────────────────────┘
                    │                        │              │
                    │                        │              │  ┌──────────────────────┐
                    │                        │              │  │ Chờ KH phản hồi      │
                    │                        │              │  │ (email/SMS notify)   │
                    │                        │              │  │ (timeout monitoring) │
                    │                        │              │  └──────────────────────┘
                    │                        │              │
                    │                    ┌───┴──────────────┴─────┐
                    │                    │                       │
                    │                    ▼ (KH phản hồi)  ▼ (hết hạn / không phản hồi)
                    │              in_progress         not_executed
                    │              (Creator review)     (Timeout)
                    │                    │                   │
                    └────┬───────────────┘                   │
                         │                                   │
                         ▼                                   ▼
                    coding/dms_transfer              [Hết flow]
                         │
                         ▼
                    completed
                         │
                    ┌────┴────┐
                    ▼         ▼
            customer_notified completed (final)
```

### 6.3 Detailed State Machine Diagram

```
digraph CRCWorkflow {
    rankdir=LR;

    // States
    new_intake [shape=box, style=filled, fillcolor=lightblue, label="New Intake\n(Mới tiếp nhận)"];
    pending [shape=box, style=filled, fillcolor=lightblue, label="Pending Dispatch\n(Chờ PM)"];
    waiting [shape=box, style=filled, fillcolor=lightyellow, label="Waiting Customer\nFeedback\n(Đợi KH phản hồi)"];
    dispatched [shape=box, style=filled, fillcolor=lightcyan, label="Dispatched\n(Đã giao R)"];
    analysis [shape=box, style=filled, fillcolor=lightpink, label="Analysis\n(Phân tích)"];
    in_progress [shape=box, style=filled, fillcolor=lightgreen, label="In Progress\n(Đang xử lý)"];
    not_executed [shape=box, style=filled, fillcolor=lightgray, label="Not Executed\n(Không thực hiện)"];
    completed [shape=box, style=filled, fillcolor=lightgreen, label="Completed\n(Hoàn thành)"];

    // Transitions
    new_intake -> pending [label="Submit"];
    pending -> dispatched [label="Assign"];
    pending -> not_executed [label="Reject"];
    pending -> waiting [label="Request Info\n(PM: KH chưa cung cấp)"];
    pending -> in_progress [label="PM Handle"];
    pending -> analysis [label="Analyze"];

    // WAITING STATE TRANSITIONS
    waiting -> in_progress [label="Customer Feedback\n(Creator Review)", color=blue];
    waiting -> not_executed [label="Timeout\n(No Response)", color=red];
    waiting -> pending [label="Adjust Request\n(Backward)", style=dashed];

    dispatched -> in_progress [label="Start Work"];
    dispatched -> pending [label="Return"];

    analysis -> in_progress [label="Ready"];

    in_progress -> completed [label="Finish"];
    not_executed -> [label="END"];
    completed -> [label="END"];
}
```

### 6.4 Complete Lifecycle Timeline

```
Timeline: Request Journey Through waiting_customer_feedback

T0: PM tạo transition pending_dispatch → waiting_customer_feedback
    ├─ Reason: "Khách hàng chưa cung cấp đủ thông tin"
    ├─ Action: PM fills in:
    │  ├─ feedback_request_content: "Vui lòng cung cấp X, Y, Z"
    │  ├─ feedback_requested_at: NOW
    │  ├─ customer_due_at: NOW + 3 days
    │  └─ notes: "Chờ phản hồi từ khách hàng"
    │
    └─ System creates:
       ├─ customer_request_waiting_customer_feedbacks row
       ├─ customer_request_status_instances record
       └─ Triggers: Customer notification (EMAIL/SMS)

T1: System sends customer notification
    ├─ Email subject: "Yêu cầu bổ sung thông tin cho YC-202603-0001"
    ├─ Content: Includes feedback_request_content
    ├─ Due date: customer_due_at displayed
    └─ Call-to-action: "Vui lòng phản hồi tại: [link]"

T2-T3: Monitoring phase (Duration: NOW to customer_due_at)
    ├─ Dashboard shows: "Đợi phản hồi KH" with countdown
    ├─ SLA Logic: Calculate days remaining
    ├─ Reminders (at -2 days, -1 day): Send reminder notifications
    └─ System track: Time spent waiting

T4a: SCENARIO A - Customer responds before due date
    ├─ Customer submits: customer_feedback_content (via portal/email/form)
    ├─ System updates: customer_feedback_at = NOW
    ├─ Notification to PM/Creator: "KH đã phản hồi"
    ├─ Creator review: Validate customer feedback
    ├─ Creator decision:
    │  ├─ "Good" → Transition to in_progress
    │  │   └─ Action: PM assigns performer
    │  └─ "Incomplete" → Request more info (repeat T1)
    │
    └─ Result: in_progress (work can finally start)

T4b: SCENARIO B - No response after due date
    ├─ System detects: NOW > customer_due_at && customer_feedback_at IS NULL
    ├─ Auto-transition trigger: waiting_customer_feedback → not_executed
    ├─ Reason: "Khách hàng không phản hồi trong thời hạn"
    ├─ Notification: "YC không được thực hiện do vượt thời hạn"
    └─ Result: Request is CLOSED (not_executed)

T4c: SCENARIO C - PM changes mind (backward)
    ├─ PM decision: Cancel waiting, go back to pending_dispatch
    ├─ Reason: "Adjusted scope, not necessary to wait"
    ├─ Transition: waiting_customer_feedback → pending_dispatch (backward)
    └─ Result: Return to PM decision point

Final State: Either in_progress, not_executed, or pending_dispatch
```

---

## 🎯 Phần 7: Data Flow & API Endpoints

### 7.1 Current API Endpoints

```
GET /api/v5/customer-request-cases
├─ Filter by status_code = 'waiting_customer_feedback'
├─ Returns: List of waiting cases
└─ Used by: Dashboard, List views

GET /api/v5/customer-request-cases/{id}
├─ Returns: Full detail including waiting_customer_feedback data
│   ├─ feedback_request_content
│   ├─ feedback_requested_at
│   ├─ customer_due_at
│   ├─ customer_feedback_at
│   └─ customer_feedback_content
└─ Used by: Detail view

PUT /api/v5/customer-request-cases/{id}/transition
├─ Transition from pending_dispatch → waiting_customer_feedback
├─ Required fields:
│   ├─ to_status_code: 'waiting_customer_feedback'
│   ├─ feedback_request_content: string
│   ├─ feedback_requested_at: datetime
│   ├─ customer_due_at: datetime
│   └─ notes: string
└─ Used by: PM to set waiting state
```

### 7.2 Missing API Endpoints

```
❌ PUT /api/v5/customer-request-cases/{id}/submit-feedback
   ├─ Purpose: Customer submits feedback
   ├─ Required fields:
   │  ├─ customer_feedback_content: string
   │  └─ customer_feedback_at: datetime
   └─ Result: Trigger transition (waiting → in_progress or ask for more info)

❌ POST /api/v5/customer-request-cases/{id}/send-feedback-reminder
   ├─ Purpose: Send reminder to customer
   ├─ Triggered by: Cron job or manual PM action
   └─ Result: Email/SMS notification

❌ POST /api/v5/customer-request-cases/{id}/auto-resolve-timeout
   ├─ Purpose: Auto-transition if timeout
   ├─ Trigger: Cron job (daily check)
   └─ Transition: waiting_customer_feedback → not_executed

❌ GET /api/v5/customer-request-cases?filter=waiting_by_due
   ├─ Purpose: Show overdue waiting cases
   ├─ Returns: Cases where customer_due_at < NOW and customer_feedback_at IS NULL
   └─ Used by: Alerts/dashboard
```

---

## 📋 Phần 8: Summary - Key Differences

### What's in XML but NOT in Code:

| Feature | XML Says | Code Implementation | Status |
|---------|----------|---------------------|--------|
| **Entry Transition** | PM decision to wait for KH | ✓ waiting_customer_feedback transition exists | ✓ DONE |
| **Exit Transitions** | (Implied) Can move to in_progress or not_executed | ❌ NOT defined in migrations | ⚠️ TODO |
| **Customer Notification** | "Chờ khách hàng phản hồi" | ❌ No notification logic | ⚠️ TODO |
| **Timeout Handling** | (Implied by state) | ❌ No auto-transition logic | ⚠️ TODO |
| **Reminder System** | (Implied by workflow) | ❌ No reminder scheduled | ⚠️ TODO |
| **SLA Tracking** | (Implicit) | ✓ Field customer_due_at exists, no logic | ⚠️ PARTIAL |
| **Feedback Validation** | Customer feedback accepted | ❌ No validation rules | ⚠️ TODO |
| **Multi-attempts** | KH can be asked multiple times | ❌ No iteration logic | ⚠️ TODO |

### What's in Code but NOT visually clear in XML:

| Feature | Code Has | XML Shows | Status |
|---------|----------|-----------|--------|
| **feedback_request_content field** | ✓ textarea | Not explicitly shown | ℹ️ Implicit |
| **feedback_requested_at field** | ✓ datetime | Not shown | ℹ️ Implicit |
| **customer_feedback_content field** | ✓ textarea | Not shown | ℹ️ Implicit |
| **Status Instance Linking** | ✓ Full audit trail | Not mentioned | ℹ️ Hidden |
| **Role-based Visibility** | ✓ PM, Creator, Performer | ✓ Shown in diagram | ✓ Match |

---

## 🚀 Phần 9: Implementation Roadmap

### Priority 1 (Critical - Must Have)
```
1. Add exit transitions from waiting_customer_feedback:
   - waiting_customer_feedback → in_progress (default, when feedback received)
   - waiting_customer_feedback → not_executed (timeout)
   - waiting_customer_feedback → pending_dispatch (backward, PM adjust)

2. Implement customer feedback submission API:
   - PUT /api/v5/customer-request-cases/{id}/submit-feedback
   - Validate feedback content
   - Update customer_feedback_at & customer_feedback_content

3. Implement timeout auto-transition:
   - Cron job: daily check for expired waiting_customer_feedback
   - Auto-transition to not_executed if customer_due_at < NOW
   - Send notification to PM/Creator
```

### Priority 2 (High - Should Have)
```
4. Implement customer notification system:
   - Email template for feedback request
   - Send via queue job (GenerateAsyncExportJob pattern)
   - Track notification status

5. Implement reminder system:
   - Remind customer 2 days before due date
   - Remind again 1 day before
   - Escalate to PM if still no response

6. Frontend components:
   - WaitingCustomerFeedbackPanel component
   - Customer feedback submission form
   - Timeline view of feedback history
```

### Priority 3 (Medium - Nice to Have)
```
7. Add SLA metrics:
   - Time spent waiting for feedback
   - % cases that timeout vs respond
   - Average response time from customer

8. Add feedback validation rules:
   - Min/max length
   - Required fields check
   - Spam/content validation

9. Add multi-round feedback:
   - Allow requesting additional info
   - Track feedback iteration count
   - Show previous feedback history
```

---

## 📝 Phần 10: Detailed Comparison Table

### Complete Comparison: XML vs Implementation

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        XML Workflow vs Code Implementation                              │
├─────────────────────────────────────────┬─────────────────────────────────────────────┤
│ XML Diagram (Business Process)           │ Code Implementation (Technical)              │
├─────────────────────────────────────────┼─────────────────────────────────────────────┤
│ 1. ENTRY POINT                          │ 1. ENTRY POINT                              │
│    PM decides: "KH chưa có info?"       │    Transition rule (sort_order: 30):         │
│    → YES → Wait for feedback            │    pending_dispatch → waiting_customer_...   │
│                                         │    isDefault: false                         │
│    ✓ MATCH                              │    ✓ MATCH                                  │
├─────────────────────────────────────────┼─────────────────────────────────────────────┤
│ 2. STATE NAME                           │ 2. STATE NAME                               │
│    "Chờ khách hàng cung cấp thông tin" │    status_code: 'waiting_customer_feedback'  │
│    status_name_vi: "Đợi phản hồi từ KH" │    label: "Đợi phản hồi từ khách hàng"      │
│    ✓ MATCH                              │    ✓ MATCH                                  │
├─────────────────────────────────────────┼─────────────────────────────────────────────┤
│ 3. PEOPLE INVOLVED                      │ 3. PEOPLE INVOLVED                          │
│    PM, Creator, Performer see           │    visibility checks in code:                │
│    ✓ MENTIONED in diagram               │    ❓ Need to verify in authorization.ts    │
│    PARTIAL MATCH                        │    PARTIAL MATCH                            │
├─────────────────────────────────────────┼─────────────────────────────────────────────┤
│ 4. WHAT HAPPENS IN THIS STATE           │ 4. WHAT HAPPENS IN THIS STATE               │
│    - Send feedback request to KH        │    - feedback_request_content field          │
│    - KH provides info                   │    - feedback_requested_at field             │
│    - Track deadline                     │    - customer_due_at field                   │
│    - KH responds with data              │    - customer_feedback_at field              │
│                                         │    - customer_feedback_content field         │
│    ✓ Fields exist                       │    ✓ Fields exist in schema                 │
│    ❌ No logic to enforce them          │    ⚠️ PARTIAL: Fields exist, logic missing  │
├─────────────────────────────────────────┼─────────────────────────────────────────────┤
│ 5. EXIT ROUTES                          │ 5. EXIT ROUTES                              │
│    a) KH phản hồi → Tiếp tục xử lý     │    a) waiting → in_progress                 │
│       ✓ Mentioned implicitly            │       ❌ NOT defined                         │
│                                         │                                              │
│    b) Hết hạn → Không thực hiện        │    b) waiting → not_executed (timeout)      │
│       ✓ Mentioned implicitly            │       ❌ NOT defined                         │
│                                         │                                              │
│    c) PM điều chỉnh → Quay lại pending │    c) waiting → pending (backward)          │
│       ✓ Mentioned implicitly            │       ❌ NOT defined                         │
│    ⚠️ MAJOR GAP: Exit routes undefined  │       ⚠️ MAJOR GAP: Transitions missing     │
├─────────────────────────────────────────┼─────────────────────────────────────────────┤
│ 6. COMMUNICATION                        │ 6. COMMUNICATION                            │
│    - Notify KH to provide info          │    - ❌ No email/SMS service                │
│    - Remind about deadline              │    - ❌ No reminder service                 │
│    - Confirm receipt                    │    - ❌ No receipt confirmation             │
│    ❌ Workflow doesn't detail this      │    ❌ NOT IMPLEMENTED                       │
├─────────────────────────────────────────┼─────────────────────────────────────────────┤
│ 7. TIMEOUT HANDLING                     │ 7. TIMEOUT HANDLING                         │
│    Implied: If deadline passes,         │    customer_due_at field exists             │
│    request is abandoned                 │    ❌ No logic to check/enforce timeout     │
│    ⚠️ Vague in XML                      │    ⚠️ NOT IMPLEMENTED                       │
├─────────────────────────────────────────┼─────────────────────────────────────────────┤
│ 8. FEEDBACK VALIDATION                  │ 8. FEEDBACK VALIDATION                      │
│    Implied: Info must be sufficient     │    ❌ No validation rules                   │
│    ⚠️ Not detailed in diagram           │    ❌ NOT IMPLEMENTED                       │
├─────────────────────────────────────────┼─────────────────────────────────────────────┤
│ OVERALL ASSESSMENT                      │ OVERALL ASSESSMENT                          │
│ Business process is clear & logical     │ Schema is prepared but logic is 40% done   │
│ But details are vague/incomplete        │ Missing 60% of actual workflow logic        │
│ STATUS: ✓ Good for visualization       │ STATUS: ⚠️ Incomplete implementation        │
└─────────────────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 🎬 Conclusion

### Summary of Findings:

**✓ What's Working:**
1. Status definition is complete & correct
2. Database schema has all necessary fields
3. Frontend has color & label mapping
4. Basic transition rule exists (pending_dispatch → waiting_customer_feedback)

**❌ What's Missing:**
1. **Exit transitions** - No way to leave waiting state!
2. **Customer notification** - No email/SMS service integration
3. **Timeout logic** - No automatic handling of expired deadlines
4. **Feedback submission API** - Customer can't submit feedback through system
5. **Reminder system** - No reminders to customer about deadline
6. **SLA monitoring** - Time tracking exists but no alerting

**⚠️ Implementation Status:**
- **XML Diagram:** ~80% complete (business process clear)
- **Database Schema:** ~100% complete (all fields present)
- **Backend Services:** ~30% complete (transitions & notifications missing)
- **Frontend UI:** ~60% complete (display ready, submission missing)
- **Overall:** **~50% Complete** - Core structure ready, critical business logic missing

**Recommended Next Steps:**
1. Priority 1: Add exit transitions + feedback submission API
2. Priority 2: Implement notification & reminder system
3. Priority 3: Add timeout auto-transition
4. Priority 4: Build frontend feedback submission UI
