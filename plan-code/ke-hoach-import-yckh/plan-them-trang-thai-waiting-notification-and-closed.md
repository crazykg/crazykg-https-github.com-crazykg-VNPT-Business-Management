# Plan: Thêm trạng thái "Chờ thông báo khách hàng" và "Đóng yêu cầu"

**Date:** 2026-04-08  
**Author:** VNPT Business Management Team  
**Priority:** High  
**Estimated Complexity:** Medium (2-3 days)

---

## 1. MỤC TIÊU

### Hiện tại
```
completed → customer_notified → pending_dispatch (Giao PM/Trả YC cho PM)
```

### Sau khi thay đổi
```
completed → waiting_notification → customer_notified → closed
                      ↓
              pending_dispatch (Giao PM/Trả YC cho PM)
```

**2 trạng thái mới:**
1. **`waiting_notification`** - "Chờ thông báo khách hàng" (giữa `completed` và `customer_notified`)
2. **`closed`** - "Đóng yêu cầu" (sau `customer_notified`)

---

## 2. PHẠM VI THAY ĐỔI

### Backend (Laravel)
- [x] Database migration & seed
- [x] CustomerRequestCaseRegistry.php
- [x] CustomerRequestCaseDomainService.php
- [x] CustomerRequestCaseWriteService.php (nếu cần logic đặc biệt)
- [ ] Model mới (nếu cần detail table)

### Frontend (React)
- [x] types.ts - Thêm status codes
- [x] CustomerRequestCaseRegistry tương đương (nếu có)
- [ ] Status badge color mapping
- [ ] Transition button labels

### Database
- [x] customer_request_status_catalogs - Thêm 2 rows
- [x] customer_request_status_transitions - Update transitions
- [ ] Tạo bảng detail mới (nếu cần)

---

## 3. CHI TIẾT TRIỂN KHAI

### **GIAI ĐOẠN 1: DATABASE MIGRATION**

#### File: `database/sql-patches/2026-04-08_add_waiting_notification_and_closed_states/`

##### 3.1. File: `2026-04-08_01_create_status_tables.sql`

```sql
-- ============================================================================
-- TẠO BẢNG CHI TIẾT CHO 2 TRẠNG THÁI MỚI
-- ============================================================================

-- 1. Bảng waiting_notification (Chờ thông báo khách hàng)
CREATE TABLE `customer_request_waiting_notification` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `request_case_id` BIGINT UNSIGNED NOT NULL,
  `notified_by_user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người phụ trách thông báo',
  `notification_channel` VARCHAR(100) DEFAULT NULL COMMENT 'Kênh: email, phone, sms',
  `notification_content` TEXT COMMENT 'Nội dung dự kiến thông báo',
  `planned_notification_at` DATETIME DEFAULT NULL COMMENT 'Dự kiến ngày thông báo',
  `actual_notification_at` DATETIME DEFAULT NULL COMMENT 'Ngày thông báo thực tế',
  `customer_feedback` TEXT COMMENT 'Phản hồi khách hàng (nếu có)',
  `notes` TEXT COMMENT 'Ghi chú',
  `created_by` BIGINT UNSIGNED DEFAULT NULL,
  `updated_by` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_waiting_notification_case` (`request_case_id`),
  INDEX `idx_waiting_notification_handler` (`notified_by_user_id`),
  
  CONSTRAINT `fk_waiting_notification_case` 
    FOREIGN KEY (`request_case_id`) REFERENCES `customer_request_cases`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_waiting_notification_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_waiting_notification_updated_by` 
    FOREIGN KEY (`updated_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Chi tiết trạng thái chờ thông báo khách hàng';

-- 2. Bảng closed (Đóng yêu cầu)
CREATE TABLE `customer_request_closed` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `request_case_id` BIGINT UNSIGNED NOT NULL,
  `closed_by_user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người đóng yêu cầu',
  `closed_at` DATETIME DEFAULT NULL COMMENT 'Ngày đóng',
  `closure_reason` VARCHAR(100) DEFAULT NULL COMMENT 'Lý do đóng: completed, cancelled, duplicate',
  `closure_notes` TEXT COMMENT 'Ghi chú khi đóng',
  `customer_satisfaction` VARCHAR(50) DEFAULT NULL COMMENT 'Mức độ hài lòng: very_satisfied, satisfied, neutral, dissatisfied',
  `created_by` BIGINT UNSIGNED DEFAULT NULL,
  `updated_by` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_closed_case` (`request_case_id`),
  INDEX `idx_closed_handler` (`closed_by_user_id`),
  
  CONSTRAINT `fk_closed_case` 
    FOREIGN KEY (`request_case_id`) REFERENCES `customer_request_cases`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_closed_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_closed_updated_by` 
    FOREIGN KEY (`updated_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Chi tiết trạng thái đóng yêu cầu';
```

##### 3.2. File: `2026-04-08_02_seed_status_catalogs.sql`

```sql
-- ============================================================================
-- SEED 2 TRẠNG THÁI MỚI VÀO CATALOG
-- ============================================================================

INSERT INTO `customer_request_status_catalogs` (
  `workflow_definition_id`,
  `status_code`,
  `status_name_vi`,
  `group_code`,
  `group_label`,
  `table_name`,
  `handler_field`,
  `list_columns_json`,
  `form_fields_json`,
  `ui_meta_json`,
  `storage_mode`,
  `sort_order`,
  `is_active`,
  `created_at`,
  `updated_at`
) VALUES
-- Chờ thông báo khách hàng
(
  1,
  'waiting_notification',
  'Chờ thông báo khách hàng',
  'closure',
  'Kết thúc',
  'customer_request_waiting_notification',
  'notified_by_user_id',
  JSON_ARRAY(
    JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
    JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
    JSON_OBJECT('key', 'notified_by_user_id', 'label', 'Người phụ trách'),
    JSON_OBJECT('key', 'notification_channel', 'label', 'Kênh thông báo'),
    JSON_OBJECT('key', 'planned_notification_at', 'label', 'Dự kiến thông báo')
  ),
  JSON_ARRAY(
    JSON_OBJECT('name', 'notified_by_user_id', 'label', 'Người phụ trách thông báo', 'type', 'user_select', 'required', TRUE),
    JSON_OBJECT('name', 'notification_channel', 'label', 'Kênh thông báo', 'type', 'select', 'required', FALSE),
    JSON_OBJECT('name', 'notification_content', 'label', 'Nội dung thông báo', 'type', 'textarea', 'required', FALSE),
    JSON_OBJECT('name', 'planned_notification_at', 'label', 'Dự kiến ngày thông báo', 'type', 'datetime', 'required', FALSE),
    JSON_OBJECT('name', 'notes', 'label', 'Ghi chú', 'type', 'textarea', 'required', FALSE)
  ),
  JSON_OBJECT(
    'owner_mode', 'dispatcher',
    'bucket_code', 'pending_notification',
    'color_token', 'yellow',
    'primary_action', JSON_OBJECT('kind', 'transition', 'label', 'Thông báo khách hàng')
  ),
  'detail',
  55,
  1,
  NOW(),
  NOW()
),
-- Đóng yêu cầu
(
  1,
  'closed',
  'Đóng yêu cầu',
  'closure',
  'Kết thúc',
  'customer_request_closed',
  'closed_by_user_id',
  JSON_ARRAY(
    JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
    JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
    JSON_OBJECT('key', 'closed_by_user_id', 'label', 'Người đóng'),
    JSON_OBJECT('key', 'closed_at', 'label', 'Ngày đóng'),
    JSON_OBJECT('key', 'customer_satisfaction', 'label', 'Mức độ hài lòng')
  ),
  JSON_ARRAY(
    JSON_OBJECT('name', 'closed_by_user_id', 'label', 'Người đóng yêu cầu', 'type', 'user_select', 'required', TRUE),
    JSON_OBJECT('name', 'closed_at', 'label', 'Ngày đóng', 'type', 'datetime', 'required', TRUE),
    JSON_OBJECT('name', 'closure_reason', 'label', 'Lý do đóng', 'type', 'select', 'required', TRUE),
    JSON_OBJECT('name', 'closure_notes', 'label', 'Ghi chú đóng', 'type', 'textarea', 'required', FALSE),
    JSON_OBJECT('name', 'customer_satisfaction', 'label', 'Mức độ hài lòng', 'type', 'select', 'required', FALSE)
  ),
  JSON_OBJECT(
    'terminal', TRUE,
    'owner_mode', 'dispatcher',
    'bucket_code', 'closed',
    'color_token', 'gray'
  ),
  'detail',
  65,
  1,
  NOW(),
  NOW()
);
```

##### 3.3. File: `2026-04-08_03_update_transitions.sql`

```sql
-- ============================================================================
-- CẬP NHẬT TRANSITIONS
-- ============================================================================

-- 1. Xóa transition cũ: completed → customer_notified
DELETE FROM `customer_request_status_transitions`
WHERE `workflow_definition_id` = 1
  AND `from_status_code` = 'completed'
  AND `to_status_code` = 'customer_notified';

-- 2. Xóa transition cũ: customer_notified → pending_dispatch
DELETE FROM `customer_request_status_transitions`
WHERE `workflow_definition_id` = 1
  AND `from_status_code` = 'customer_notified'
  AND `to_status_code` = 'pending_dispatch';

-- 3. Thêm transitions mới
INSERT INTO `customer_request_status_transitions` (
  `workflow_definition_id`,
  `from_status_code`,
  `to_status_code`,
  `process_name_vi`,
  `allowed_roles`,
  `transition_config`,
  `direction`,
  `is_default`,
  `is_active`,
  `sort_order`,
  `notes`,
  `created_at`,
  `updated_at`
) VALUES
-- Từ completed → waiting_notification (PRIMARY)
(1, 'completed', 'waiting_notification', 'Chờ thông báo khách hàng', '["all"]', NULL, 'forward', 1, 1, 30, 
 'Chuyển sang trạng thái chờ thông báo khách hàng', NOW(), NOW()),

-- Từ completed → pending_dispatch (vẫn giữ để quay lại PM nếu cần)
(1, 'completed', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', NULL, 'forward', 0, 1, 35, 
 'Quay lại người quản lý', NOW(), NOW()),

-- Từ waiting_notification → customer_notified (PRIMARY)
(1, 'waiting_notification', 'customer_notified', 'Thông báo khách hàng', '["all"]', NULL, 'forward', 1, 1, 10, 
 'Đã thông báo khách hàng thành công', NOW(), NOW()),

-- Từ waiting_notification → pending_dispatch (QUAY LẠI PM)
(1, 'waiting_notification', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', NULL, 'forward', 0, 1, 20, 
 'Quay lại người quản lý', NOW(), NOW()),

-- Từ customer_notified → closed (PRIMARY - MỚI)
(1, 'customer_notified', 'closed', 'Đóng yêu cầu', '["all"]', NULL, 'forward', 1, 1, 10, 
 'Đóng yêu cầu sau khi thông báo khách hàng', NOW(), NOW()),

-- Từ customer_notified → pending_dispatch (GIỮ LẠI)
(1, 'customer_notified', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', NULL, 'forward', 0, 1, 20, 
 'Quay lại người quản lý', NOW(), NOW()),

-- Từ closed → pending_dispatch (MỞ LẠI YÊU CẦU - nếu cần)
(1, 'closed', 'pending_dispatch', 'Mở lại yêu cầu', '["all"]', NULL, 'forward', 0, 1, 10, 
 'Mở lại yêu cầu đã đóng', NOW(), NOW());
```

---

### **GIAI ĐOẠN 2: BACKEND (LARAVEL)**

#### 3.4. File: `backend/app/Services/V5/Domain/CustomerRequestCaseRegistry.php`

Thêm vào method `definitions()`:

```php
// Chờ thông báo khách hàng
self::status(
    'waiting_notification',
    'Chờ thông báo khách hàng',
    'customer_request_waiting_notification',
    [
        ['key' => 'request_code', 'label' => 'ID yêu cầu'],
        ['key' => 'summary', 'label' => 'Nội dung'],
        ['key' => 'notified_by_user_id', 'label' => 'Người phụ trách'],
        ['key' => 'notification_channel', 'label' => 'Kênh thông báo'],
        ['key' => 'planned_notification_at', 'label' => 'Dự kiến thông báo'],
    ],
    [
        ['name' => 'notified_by_user_id', 'label' => 'Người phụ trách thông báo', 'type' => 'user_select', 'required' => true],
        ['name' => 'notification_channel', 'label' => 'Kênh thông báo', 'type' => 'select', 'required' => false],
        ['name' => 'notification_content', 'label' => 'Nội dung thông báo', 'type' => 'textarea', 'required' => false],
        ['name' => 'planned_notification_at', 'label' => 'Dự kiến ngày thông báo', 'type' => 'datetime', 'required' => false],
        ['name' => 'notes', 'label' => 'Ghi chú', 'type' => 'textarea', 'required' => false],
    ]
),

// Đóng yêu cầu
self::status(
    'closed',
    'Đóng yêu cầu',
    'customer_request_closed',
    [
        ['key' => 'request_code', 'label' => 'ID yêu cầu'],
        ['key' => 'summary', 'label' => 'Nội dung'],
        ['key' => 'closed_by_user_id', 'label' => 'Người đóng'],
        ['key' => 'closed_at', 'label' => 'Ngày đóng'],
        ['key' => 'customer_satisfaction', 'label' => 'Mức độ hài lòng'],
    ],
    [
        ['name' => 'closed_by_user_id', 'label' => 'Người đóng yêu cầu', 'type' => 'user_select', 'required' => true],
        ['name' => 'closed_at', 'label' => 'Ngày đóng', 'type' => 'datetime', 'required' => true],
        ['name' => 'closure_reason', 'label' => 'Lý do đóng', 'type' => 'select', 'required' => true],
        ['name' => 'closure_notes', 'label' => 'Ghi chú đóng', 'type' => 'textarea', 'required' => false],
        ['name' => 'customer_satisfaction', 'label' => 'Mức độ hài lòng', 'type' => 'select', 'required' => false],
    ]
),
```

Cập nhật `statusGroups()`:

```php
public static function statusGroups(): array
{
    return [
        'intake' => ['new_intake', 'assigned_to_receiver', 'pending_dispatch'],
        'processing' => ['in_progress', 'coding', 'dms_transfer', 'receiver_in_progress', 'waiting_customer_feedback'],
        'analysis' => ['analysis', 'analysis_completed', 'analysis_suspended', 'returned_to_manager'],
        'closure' => ['completed', 'waiting_notification', 'customer_notified', 'closed', 'not_executed'],
    ];
}
```

Cập nhật `workflowaAllowedTargets()` (hard-coded fallback):

```php
public static function workflowaAllowedTargets(): array
{
    return [
        // ... existing entries ...
        
        'completed' => [
            'waiting_notification',  // NEW: Primary
            'pending_dispatch',      // Keep: fallback
        ],
        
        'waiting_notification' => [  // NEW
            'customer_notified',     // Primary
            'pending_dispatch',      // Back to PM
        ],
        
        'customer_notified' => [
            'closed',                // NEW: Primary
            'pending_dispatch',      // Keep: fallback
        ],
        
        'closed' => [               // NEW: reopen
            'pending_dispatch',
        ],
    ];
}
```

#### 3.5. File: `backend/app/Services/V5/Domain/CustomerRequestCaseDomainService.php`

Cập nhật `$statusGroups` property:

```php
protected array $statusGroups = [
    'intake' => ['new_intake', 'assigned_to_receiver', 'pending_dispatch'],
    'processing' => ['in_progress', 'coding', 'dms_transfer', 'receiver_in_progress', 'waiting_customer_feedback'],
    'analysis' => ['analysis', 'analysis_completed', 'analysis_suspended', 'returned_to_manager'],
    'closure' => ['completed', 'waiting_notification', 'customer_notified', 'closed', 'not_executed'],
];
```

#### 3.6. Tạo Model mới

##### File: `backend/app/Models/CustomerRequestWaitingNotification.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestWaitingNotification extends Model
{
    protected $table = 'customer_request_waiting_notification';
    
    protected $fillable = [
        'request_case_id',
        'notified_by_user_id',
        'notification_channel',
        'notification_content',
        'planned_notification_at',
        'actual_notification_at',
        'customer_feedback',
        'notes',
        'created_by',
        'updated_by',
    ];
    
    protected $casts = [
        'planned_notification_at' => 'datetime',
        'actual_notification_at' => 'datetime',
    ];
    
    public function requestCase(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestCase::class, 'request_case_id');
    }
    
    public function notifiedBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'notified_by_user_id');
    }
}
```

##### File: `backend/app/Models/CustomerRequestClosed.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestClosed extends Model
{
    protected $table = 'customer_request_closed';
    
    protected $fillable = [
        'request_case_id',
        'closed_by_user_id',
        'closed_at',
        'closure_reason',
        'closure_notes',
        'customer_satisfaction',
        'created_by',
        'updated_by',
    ];
    
    protected $casts = [
        'closed_at' => 'datetime',
    ];
    
    public function requestCase(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestCase::class, 'request_case_id');
    }
    
    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'closed_by_user_id');
    }
}
```

#### 3.7. Cập nhật `CaseWriteUtilities::resolveStatusEnteredAt()`

Thêm case cho 2 trạng thái mới nếu cần logic đặc biệt:

```php
protected static function resolveStatusEnteredAt(array $data, string $statusCode): ?string
{
    return match ($statusCode) {
        // ... existing cases ...
        'waiting_notification' => $data['planned_notification_at'] ?? null,
        'closed' => $data['closed_at'] ?? now()->toDateTimeString(),
        default => null,
    };
}
```

---

### **GIAI ĐOẠN 3: FRONTEND (REACT)**

#### 3.8. File: `frontend/types.ts`

```typescript
// Thêm vào CRCStatusCode union type
export type CRCStatusCode =
  // ... existing codes ...
  | 'waiting_notification'
  | 'closed';

// Thêm vào status label map
export const CRC_STATUS_LABELS: Record<CRCStatusCode, string> = {
  // ... existing labels ...
  waiting_notification: 'Chờ thông báo khách hàng',
  closed: 'Đóng yêu cầu',
};

// Thêm vào color mapping
export const CRC_STATUS_COLORS: Record<CRCStatusCode, string> = {
  // ... existing colors ...
  waiting_notification: 'yellow',
  closed: 'gray',
};
```

#### 3.9. File: `frontend/components/customer-request/StatusBadge.tsx` (hoặc tương đương)

Thêm mapping cho 2 states mới:

```typescript
const STATUS_COLOR_MAP: Record<string, string> = {
  // ... existing ...
  waiting_notification: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  closed: 'bg-gray-100 text-gray-600 border-gray-300 line-through',
};
```

#### 3.10. Frontend Form Components

Tạo 2 form components mới (nếu dùng dynamic forms từ `form_fields_json` thì có thể không cần):

##### File: `frontend/components/customer-request/WaitingNotificationForm.tsx`

Form fields:
- notified_by_user_id (UserSelect dropdown)
- notification_channel (Select: email, phone, sms)
- notification_content (Textarea)
- planned_notification_at (DateTime picker)
- notes (Textarea)

##### File: `frontend/components/customer-request/ClosedForm.tsx`

Form fields:
- closed_by_user_id (UserSelect dropdown)
- closed_at (DateTime picker)
- closure_reason (Select: completed, cancelled, duplicate)
- closure_notes (Textarea)
- customer_satisfaction (Select: very_satisfied, satisfied, neutral, dissatisfied)

---

### **GIAI ĐOẠN 4: BACKLOG & EDGE CASES**

#### 4.1. Migration cho data hiện tại

**Quan trọng:** Các requests đang ở trạng thái `completed` sẽ không tự động có row trong `customer_request_waiting_notification`.

**Giải pháp:**
- Không cần migration - chỉ cần update `current_status_code` khi user thực hiện transition
- Nếu muốn auto-migrate các requests đã `completed` từ lâu:

```sql
-- Tùy chọn: Tự động chuyển completed cũ sang waiting_notification
UPDATE customer_request_cases
SET current_status_code = 'waiting_notification',
    updated_at = NOW()
WHERE current_status_code = 'completed'
  AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY);  -- Chỉ những cái hoàn thành > 7 ngày
```

#### 4.2. Permissions

Cần thêm permissions mới (nếu cần):

```sql
INSERT INTO permissions (name, group, description) VALUES
('customer_request.notify_customer', 'customer_request', 'Thông báo khách hàng'),
('customer_request.close_request', 'customer_request', 'Đóng yêu cầu'),
('customer_request.reopen_request', 'customer_request', 'Mở lại yêu cầu đã đóng');
```

#### 4.3. Audit Logging

Đảm bảo các transitions mới được audit đầy đủ:

```php
// Trong CustomerRequestCaseWriteService::transition()
$this->auditService->recordAuditEvent([
    'type' => 'status_transition',
    'from_status' => $fromStatusCode,
    'to_status' => $toStatusCode,
    'case_id' => $case->id,
    'user_id' => auth()->id(),
]);
```

#### 4.4. SLA Impact

Cần xem xét: `closed` có nên tính vào SLA không?

**Đề xuất:** 
- `closed` là terminal state → không tính SLA
- `waiting_notification` vẫn tính SLA (vì chưa đóng chính thức)

Cập nhật trong SLA calculation:

```php
public function isCaseSlaApplicable(CustomerRequestCase $case): bool
{
    $terminalStates = ['closed', 'not_executed'];
    return !in_array($case->current_status_code, $terminalStates);
}
```

---

## 4. TESTING PLAN

### 4.1. Unit Tests (Backend)

```php
// tests/Feature/CustomerRequestWaitingNotificationWorkflowTest.php
test('can transition from completed to waiting_notification', function () {
    // Create case in completed status
    // Transition to waiting_notification
    // Assert status updated
    // Assert waiting_notification row created
});

test('can transition from waiting_notification to customer_notified', function () {
    // ...
});

test('can transition from customer_notified to closed', function () {
    // ...
});

test('can reopen closed request', function () {
    // Transition closed → pending_dispatch
    // Assert case reopened
});
```

### 4.2. E2E Tests (Frontend)

```typescript
// frontend/__tests__/waiting-notification-workflow.spec.ts
test('Complete flow: completed → waiting → notified → closed', async ({ page }) => {
  // Navigate to completed request
  // Click "Chờ thông báo khách hàng"
  // Fill notification form
  // Verify status changed
  // Click "Thông báo khách hàng"
  // Fill notification details
  // Click "Đóng yêu cầu"
  // Fill closure form
  // Verify closed status
});
```

### 4.3. Manual Test Cases

| TC | Scenario | Expected |
|----|----------|----------|
| 1 | Completed → Chờ thông báo khách hàng | Status = waiting_notification, row created |
| 2 | Chờ thông báo khách hàng → Thông báo khách hàng | Status = customer_notified, notification saved |
| 3 | Thông báo khách hàng → Đóng yêu cầu | Status = closed, closure info saved |
| 4 | Chờ thông báo khách hàng → Giao PM | Status = pending_dispatch, quay lại PM |
| 5 | Đóng yêu cầu → Mở lại | Status = pending_dispatch, case reopened |
| 6 | Validate required fields | Form shows error if missing |
| 7 | Permission check | Only allowed roles can transition |
| 8 | Audit log | All transitions logged |

---

## 5. ROLLBACK PLAN

Nếu có vấn đề:

```sql
-- 1. Xóa 2 status khỏi catalog
DELETE FROM customer_request_status_catalogs 
WHERE status_code IN ('waiting_notification', 'closed');

-- 2. Xóa transitions mới
DELETE FROM customer_request_status_transitions 
WHERE from_status_code IN ('completed', 'waiting_notification', 'customer_notified', 'closed')
  AND workflow_definition_id = 1;

-- 3. Restore transition cũ: completed → customer_notified
INSERT INTO customer_request_status_transitions (...) VALUES (...);

-- 4. Xóa bảng detail (nếu không có data)
DROP TABLE IF EXISTS customer_request_waiting_notification;
DROP TABLE IF EXISTS customer_request_closed;

-- 5. Rollback code: git revert <commit-hash>
```

---

## 6. DEPLOYMENT CHECKLIST

- [ ] Backup database
- [ ] Chạy migration: `2026-04-08_01_create_status_tables.sql`
- [ ] Chạy seed: `2026-04-08_02_seed_status_catalogs.sql`
- [ ] Chạy seed: `2026-04-08_03_update_transitions.sql`
- [ ] Deploy backend code
- [ ] Deploy frontend code
- [ ] Test flow: completed → waiting → notified → closed
- [ ] Test rollback: waiting → pending_dispatch
- [ ] Test reopen: closed → pending_dispatch
- [ ] Verify audit logs
- [ ] Check SLA calculations
- [ ] Update documentation

---

## 7. WORKFLOW SƠ ĐỒ

### **Hiện tại**
```
[completed] ──────────────────────────────────────────┐
     ↓                                                 │
[customer_notified] ──→ [pending_dispatch] ←──────────┘
```

### **Sau khi thay đổi**
```
[completed]
     ↓
[waiting_notification] ───────────────────┐
     ↓                                     ↓
[customer_notified]               [pending_dispatch]
     ↓                                     ↑
[closed] ──────────────────────────────────┘
```

**Chi tiết transitions từ mỗi state:**

```
completed (Hoàn thành)
  ├─→ waiting_notification (Chờ thông báo khách hàng) [DEFAULT]
  └─→ pending_dispatch (Giao PM/Trả YC cho PM)

waiting_notification (Chờ thông báo khách hàng)
  ├─→ customer_notified (Thông báo khách hàng) [DEFAULT]
  └─→ pending_dispatch (Giao PM/Trả YC cho PM)

customer_notified (Thông báo khách hàng)
  ├─→ closed (Đóng yêu cầu) [DEFAULT]
  └─→ pending_dispatch (Giao PM/Trả YC cho PM)

closed (Đóng yêu cầu) [TERMINAL]
  └─→ pending_dispatch (Mở lại yêu cầu)
```

---

## 8. FILES CẦN THAY ĐỔI

### Backend (6 files)
1. `database/sql-patches/2026-04-08_add_waiting_notification_and_closed_states/2026-04-08_01_create_status_tables.sql` ✨ NEW
2. `database/sql-patches/2026-04-08_add_waiting_notification_and_closed_states/2026-04-08_02_seed_status_catalogs.sql` ✨ NEW
3. `database/sql-patches/2026-04-08_add_waiting_notification_and_closed_states/2026-04-08_03_update_transitions.sql` ✨ NEW
4. `backend/app/Services/V5/Domain/CustomerRequestCaseRegistry.php` ✏️ MODIFY
5. `backend/app/Services/V5/Domain/CustomerRequestCaseDomainService.php` ✏️ MODIFY
6. `backend/app/Models/CustomerRequestWaitingNotification.php` ✨ NEW
7. `backend/app/Models/CustomerRequestClosed.php` ✨ NEW

### Frontend (3 files)
1. `frontend/types.ts` ✏️ MODIFY
2. `frontend/components/customer-request/StatusBadge.tsx` ✏️ MODIFY
3. `frontend/components/customer-request/WaitingNotificationForm.tsx` ✨ NEW (optional)
4. `frontend/components/customer-request/ClosedForm.tsx` ✨ NEW (optional)

### Tests (2 files)
1. `backend/tests/Feature/CustomerRequestWaitingNotificationWorkflowTest.php` ✨ NEW
2. `frontend/__tests__/waiting-notification-workflow.spec.ts` ✨ NEW

---

## 9. TIMELINE DỰ KIẾN

| Phase | Tasks | Estimated |
|-------|-------|-----------|
| **Day 1** | Database migration + Backend models + Registry | 4-6 hours |
| **Day 2** | Frontend types + Status badge + Forms | 4-6 hours |
| **Day 3** | Testing + Bug fixes + Documentation | 4-6 hours |

**Total:** ~12-18 hours (2-3 working days)

---

## 10. RISK ASSESSMENT

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data migration cho requests đang ở `completed` | Medium | Không cần migrate, chỉ apply cho requests mới |
| Frontend form rendering nếu dùng dynamic forms | Low | Test kỹ với form_fields_json |
| SLA calculation sai | High | Update SLA logic để exclude `closed` |
| Permissions chưa đủ | Medium | Review role-based access trước khi deploy |
| Breaking existing reports | Low | Reports filter theo status_code, sẽ tự exclude states mới |

**Risk Level:** 🟡 MEDIUM

---

## 11. SUCCESS CRITERIA

- [x] Có thể transition: completed → waiting_notification → customer_notified → closed
- [x] Có thể quay lại: waiting_notification → pending_dispatch
- [x] Có thể reopen: closed → pending_dispatch
- [x] Form fields hiển thị đúng khi chuyển trạng thái
- [x] Audit logs ghi nhận đầy đủ
- [x] SLA không tính cho `closed` status
- [x] Status badge hiển thị đúng màu (yellow cho waiting, gray cho closed)
- [x] Tất cả tests pass

---

## 12. GHI CHÚ BỔ SUNG

1. **Color choice:**
   - `waiting_notification`: **yellow** (amber nhạt) - cảnh báo chờ xử lý
   - `closed`: **gray** - terminal state, không active nữa

2. **Closure reasons:**
   - `completed` - Hoàn thành bình thường
   - `cancelled` - Hủy bỏ
   - `duplicate` - Trùng lặp với request khác

3. **Customer satisfaction levels:**
   - `very_satisfied` - Rất hài lòng
   - `satisfied` - Hài lòng
   - `neutral` - Bình thường
   - `dissatisfied` - Không hài lòng

4. **Notification channels:**
   - `email` - Email
   - `phone` - Điện thoại
   - `sms` - SMS
   - `portal` - Cổng thông tin

---

**APPROVED BY:** ________________  
**DATE:** ________________
