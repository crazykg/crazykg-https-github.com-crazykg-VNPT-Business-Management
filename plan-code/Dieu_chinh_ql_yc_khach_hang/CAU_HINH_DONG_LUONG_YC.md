# Cấu Hình Động Luồng Yêu Cầu Khách Hàng

**Version:** 1.0
**Ngày tạo:** 2026-03-28
**Phạm vi:** Multi-Workflow Configuration System
**Trạng thái:** Draft

---

## 📋 MỤC LỤC

1. [Tổng quan](#1-tổng-quan)
2. [Database Schema](#2-database-schema)
3. [Model & Relationships](#3-model--relationships)
4. [Service Layer](#4-service-layer)
5. [API Endpoints](#5-api-endpoints)
6. [Frontend Components](#6-frontend-components)
7. [Logic Đảm Bảo Chỉ 1 Workflow Active](#7-logic-đảm-bảo-chỉ-1-workflow-active)
8. [Migration Strategy](#8-migration-strategy)
9. [Permission & Authorization](#9-permission--authorization)
10. [Audit Logging](#10-audit-logging)
11. [Phụ Lục](#phụ-lục)

---

## 1. TỔNG QUAN

### 1.1. Mục Đích

Hệ thống hiện tại chỉ hỗ trợ **một luồng workflow cố định** cho Customer Request Management. Tài liệu này đề xuất kiến trúc **cấu hình động đa luồng** (multi-workflow) cho phép:

- ✅ **Định nghĩa nhiều workflow** cho cùng một loại quy trình (process type)
- ✅ **Kích hoạt/vô hiệu hóa** workflow từ Admin UI
- ✅ **Chỉ 1 workflow active** tại một thời điểm để đảm bảo tính nhất quán
- ✅ **Chuyển đổi mượt mà** giữa các phiên bản workflow
- ✅ **Áp dụng cho nhiều loại quy trình**: Customer Request, Project Procedure, Document Approval

### 1.2. Use Cases

| Use Case | Mô tả | Priority |
|----------|-------|----------|
| **UC-01**: Admin tạo workflow mới | Admin định nghĩa workflow mới với các transitions | High |
| **UC-02**: Admin kích hoạt workflow | Admin active 1 workflow, hệ thống tự động deactivate các workflow khác | High |
| **UC-03**: Admin chỉnh sửa workflow | Cập nhật thông tin workflow (chỉ khi inactive) | Medium |
| **UC-04**: Admin xóa workflow | Soft delete workflow (chỉ khi inactive) | Low |
| **UC-05**: Import transitions từ Excel | Bulk import ma trận transitions từ file Excel | High |
| **UC-06**: Xem danh sách workflows | List tất cả workflows theo process type | Medium |
| **UC-07**: Xem chi tiết workflow | Xem thông tin chi tiết + ma trận transitions | Medium |
| **UC-08**: Export workflow ra Excel | Export cấu hình workflow để backup/share | Low |

### 1.3. Phạm Vi Áp Dụng

| Module | Process Type | Support |
|--------|--------------|---------|
| **Customer Request Management** | `customer_request` | ✅ Phase 1 |
| **Project Procedure** | `project_procedure` | ✅ Phase 2 |
| **Document Approval** | `document_approval` | ✅ Phase 2 |
| **Contract Workflow** | `contract` | 🔜 Phase 3 |
| **Revenue Approval** | `revenue_approval` | 🔜 Phase 3 |

### 1.4. Nguyên Tắc Thiết Kế

| Nguyên tắc | Mô tả |
|------------|-------|
| **Single Active Workflow** | Chỉ 1 workflow active cho mỗi process type tại một thời điểm |
| **Immutable Active Workflow** | Không cho phép chỉnh sửa workflow đang active |
| **Version Control** | Mỗi workflow có version để tracking |
| **Backward Compatible** | Workflow mới không phá vỡ dữ liệu cũ |
| **Audit Trail** | Ghi log đầy đủ các thay đổi workflow |

### 1.5. Rủi Ro & Mitigation

| Rủi ro | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **Mất dữ liệu transitions** | High | Low | Backup trước khi activate workflow mới |
| **Transition không hợp lệ** | Medium | Medium | Validation chặt chẽ khi import |
| **Performance degradation** | Medium | Low | Index đúng các columns query nhiều |
| **User confusion khi switch workflow** | Low | Medium | Hiển thị warning rõ ràng khi activate |

---

## 2. DATABASE SCHEMA

### 2.1. Bảng `workflow_definitions`

Bảng master lưu trữ định nghĩa các luồng workflow.

#### DDL Script

```sql
CREATE TABLE workflow_definitions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'ID workflow',
    
    -- Identification
    code VARCHAR(50) NOT NULL COMMENT 'Mã workflow: LUONG_A, LUONG_B, DEV_FLOW',
    name VARCHAR(255) NOT NULL COMMENT 'Tên hiển thị: Luồng xử lý A',
    description TEXT COMMENT 'Mô tả chi tiết',
    
    -- Classification
    process_type VARCHAR(50) NOT NULL DEFAULT 'customer_request' COMMENT 'Loại quy trình',
    workflow_group VARCHAR(100) DEFAULT 'default' COMMENT 'Nhóm workflow',
    
    -- Status & Versioning
    is_active BOOLEAN DEFAULT FALSE COMMENT 'Đang được sử dụng (chỉ 1 active per process_type)',
    is_default BOOLEAN DEFAULT FALSE COMMENT 'Là workflow mặc định',
    version VARCHAR(20) DEFAULT '1.0' COMMENT 'Phiên bản: 1.0, 1.1, 2.0',
    
    -- Configuration
    config JSON COMMENT 'Cấu hình bổ sung: notification rules, SLA config',
    metadata JSON COMMENT 'Metadata: created_from, import_source',
    
    -- Audit
    created_by BIGINT UNSIGNED COMMENT 'Người tạo (FK → internal_users)',
    updated_by BIGINT UNSIGNED COMMENT 'Người cập nhật',
    activated_by BIGINT UNSIGNED COMMENT 'Người kích hoạt',
    deactivated_by BIGINT UNSIGNED COMMENT 'Người vô hiệu hóa',
    activated_at TIMESTAMP NULL COMMENT 'Thời điểm kích hoạt',
    deactivated_at TIMESTAMP NULL COMMENT 'Thời điểm vô hiệu hóa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL COMMENT 'Soft delete',
    
    -- Constraints
    UNIQUE KEY unique_code_process (code, process_type, deleted_at),
    INDEX idx_process_active (process_type, is_active, deleted_at),
    INDEX idx_workflow_group (workflow_group, is_active),
    INDEX idx_version (version),
    
    -- Foreign Keys
    FOREIGN KEY (created_by) REFERENCES internal_users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES internal_users(id) ON DELETE SET NULL,
    FOREIGN KEY (activated_by) REFERENCES internal_users(id) ON DELETE SET NULL,
    FOREIGN KEY (deactivated_by) REFERENCES internal_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
  COMMENT='Định nghĩa luồng workflow';
```

#### Mô Tả Columns

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGINT | PK | AUTO | Primary key |
| `code` | VARCHAR(50) | ✅ | - | Mã định danh duy nhất (uppercase, no space) |
| `name` | VARCHAR(255) | ✅ | - | Tên hiển thị tiếng Việt |
| `description` | TEXT | ❌ | NULL | Mô tả chi tiết |
| `process_type` | VARCHAR(50) | ✅ | `customer_request` | Loại quy trình |
| `workflow_group` | VARCHAR(100) | ❌ | `default` | Nhóm workflow (cho future use) |
| `is_active` | BOOLEAN | ❌ | `FALSE` | Chỉ 1 workflow active per process_type |
| `is_default` | BOOLEAN | ❌ | `FALSE` | Workflow mặc định khi tạo mới |
| `version` | VARCHAR(20) | ❌ | `1.0` | Version string |
| `config` | JSON | ❌ | NULL | Cấu hình bổ sung (xem Section 2.1.3) |
| `metadata` | JSON | ❌ | NULL | Metadata tracking |
| `created_by` | BIGINT | ❌ | NULL | FK to internal_users |
| `activated_at` | TIMESTAMP | ❌ | NULL | Thời điểm activate |
| `deleted_at` | TIMESTAMP | ❌ | NULL | Soft delete timestamp |

#### Config JSON Structure

```json
{
  "notification_rules": {
    "on_transition": true,
    "on_completion": true,
    "notify_performer": true,
    "notify_creator": false
  },
  "sla_config": {
    "enabled": true,
    "default_sla_hours": 48,
    "escalation_threshold_hours": 72
  },
  "ui_config": {
    "color_scheme": "blue",
    "icon": "workflow",
    "display_order": 1
  },
  "validation_rules": {
    "require_performer": true,
    "require_estimated_hours": true,
    "allow_self_assignment": false
  }
}
```

### 2.2. Bảng `workflow_transitions` (Cập nhật)

Bảng lưu trữ ma trận chuyển tiếp giữa các trạng thái trong workflow.

#### DDL Script (Cập nhật)

```sql
-- Thêm column workflow_definition_id
ALTER TABLE workflow_transitions 
ADD COLUMN workflow_definition_id BIGINT UNSIGNED COMMENT 'FK → workflow_definitions.id'
AFTER workflow_group;

-- Thêm index
ALTER TABLE workflow_transitions
ADD INDEX idx_workflow_definition (workflow_definition_id, is_active);

-- Thêm foreign key
ALTER TABLE workflow_transitions
ADD CONSTRAINT fk_workflow_transitions_definition
FOREIGN KEY (workflow_definition_id) 
REFERENCES workflow_definitions(id) 
ON DELETE CASCADE;

-- Cập nhật comment
ALTER TABLE workflow_transitions 
COMMENT = 'Ma trận chuyển tiếp workflow (multi-workflow support)';
```

#### Cấu Trúc Đầy Đủ

```sql
CREATE TABLE workflow_transitions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    
    -- Scope
    workflow_definition_id BIGINT UNSIGNED COMMENT 'FK → workflow_definitions',
    process_type VARCHAR(50) NOT NULL DEFAULT 'customer_request',
    workflow_group VARCHAR(100) NOT NULL DEFAULT 'default',
    
    -- Transition Info
    from_status_code VARCHAR(80) NOT NULL COMMENT 'Mã trạng thái nguồn',
    from_status_name_vi VARCHAR(255) COMMENT 'Tên trạng thái nguồn',
    to_status_code VARCHAR(80) NOT NULL COMMENT 'Mã trạng thái đích',
    to_status_name_vi VARCHAR(255) COMMENT 'Tên trạng thái đích',
    
    -- Authorization
    allowed_roles JSON COMMENT '["R", "A", "all"]',
    required_permissions JSON COMMENT '["crc.transition.analysis"]',
    is_auto_transition BOOLEAN DEFAULT FALSE,
    
    -- Validation
    required_fields JSON COMMENT '["performer_user_id", "estimated_hours"]',
    validation_rules JSON COMMENT 'Custom validation config',
    
    -- Display
    sort_order SMALLINT UNSIGNED DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Config
    transition_config JSON COMMENT 'Notification, SLA, automation rules',
    description TEXT,
    
    -- Audit
    created_by BIGINT UNSIGNED,
    updated_by BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_from_status (from_status_code, is_active),
    INDEX idx_to_status (to_status_code, is_active),
    INDEX idx_process_type (process_type, workflow_group, is_active),
    INDEX idx_workflow_definition (workflow_definition_id, is_active),
    
    -- Foreign Keys
    FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES internal_users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES internal_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Transition Config JSON Structure

```json
{
  "notifications": {
    "send_email": true,
    "send_push": true,
    "recipients": ["performer", "creator", "dispatcher"]
  },
  "automation": {
    "auto_assign": false,
    "auto_start_timer": true,
    "create_task": false
  },
  "sla": {
    "sla_hours": 24,
    "escalate_after_hours": 48,
    "business_hours_only": true
  },
  "ui": {
    "button_color": "primary",
    "button_icon": "arrow-right",
    "confirmation_required": true,
    "confirmation_message": "Bạn có chắc muốn chuyển trạng thái?"
  }
}
```

### 2.3. ERD Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    workflow_definitions                          │
├─────────────────────────────────────────────────────────────────┤
│ PK  id               BIGINT                                     │
│     code             VARCHAR(50)  UNIQUE                        │
│     name             VARCHAR(255)                                │
│     process_type     VARCHAR(50)                                 │
│     is_active        BOOLEAN                                     │
│     version          VARCHAR(20)                                 │
│     config           JSON                                        │
│     created_by       BIGINT (FK → internal_users)               │
│     activated_at     TIMESTAMP                                   │
│     deleted_at       TIMESTAMP                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1
                              │
                              │
                              │ N
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   workflow_transitions                           │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                    BIGINT                                │
│     workflow_definition_id BIGINT (FK → workflow_definitions)   │
│     from_status_code      VARCHAR(80)                           │
│     to_status_code        VARCHAR(80)                           │
│     allowed_roles         JSON                                  │
│     required_fields       JSON                                  │
│     transition_config     JSON                                  │
│     is_active             BOOLEAN                               │
│     sort_order            SMALLINT                              │
│     created_by            BIGINT (FK → internal_users)         │
│     deleted_at            TIMESTAMP                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ N
                              │
                              │
                              │ 1
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              customer_request_cases                              │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                    BIGINT                                │
│     request_code          VARCHAR(50)                           │
│     current_status_code   VARCHAR(80)                           │
│     workflow_definition_id BIGINT (FK → workflow_definitions)   │
│     performer_user_id     BIGINT                                │
│     created_by            BIGINT                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   internal_users                                 │
├─────────────────────────────────────────────────────────────────┤
│ PK  id               BIGINT                                     │
│     full_name        VARCHAR(255)                                │
│     email            VARCHAR(255)                                │
│     user_code        VARCHAR(50)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4. Indexes & Performance

#### Recommended Indexes

```sql
-- Composite index for active workflow lookup
CREATE INDEX idx_process_active_lookup 
ON workflow_definitions(process_type, is_active, deleted_at);

-- Composite index for transitions query
CREATE INDEX idx_transitions_lookup 
ON workflow_transitions(workflow_definition_id, from_status_code, is_active);

-- Covering index for workflow list
CREATE INDEX idx_workflow_list 
ON workflow_definitions(process_type, created_at DESC, is_active DESC)
WHERE deleted_at IS NULL;
```

#### Query Performance Targets

| Query Type | Target | Current |
|------------|--------|---------|
| Get active workflow | < 5ms | - |
| Get transitions for status | < 10ms | - |
| List workflows by process | < 20ms | - |
| Activate workflow (transaction) | < 50ms | - |

---

## 3. MODEL & RELATIONSHIPS

### 3.1. WorkflowDefinition.php

**File Path:** `backend/app/Models/WorkflowDefinition.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\{
    Model,
    SoftDeletes,
    Relations\HasMany,
    Relations\BelongsTo,
    Relations\Scope,
    Factories\HasFactory
};
use Illuminate\Database\Eloquent\Builder;

/**
 * Class WorkflowDefinition
 * 
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property string $process_type
 * @property string $workflow_group
 * @property bool $is_active
 * @property bool $is_default
 * @property string $version
 * @property array|null $config
 * @property array|null $metadata
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property int|null $activated_by
 * @property int|null $deactivated_by
 * @property \Carbon\Carbon|null $activated_at
 * @property \Carbon\Carbon|null $deactivated_at
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 * @property \Carbon\Carbon|null $deleted_at
 */
class WorkflowDefinition extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'workflow_definitions';

    protected $fillable = [
        'code',
        'name',
        'description',
        'process_type',
        'workflow_group',
        'is_active',
        'is_default',
        'version',
        'config',
        'metadata',
        'created_by',
        'updated_by',
        'activated_by',
        'deactivated_by',
        'activated_at',
        'deactivated_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'config' => 'array',
        'metadata' => 'array',
        'activated_at' => 'datetime',
        'deactivated_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get all transitions for this workflow
     */
    public function transitions(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class, 'workflow_definition_id');
    }

    /**
     * Get active transitions only
     */
    public function activeTransitions(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class, 'workflow_definition_id')
            ->where('is_active', true);
    }

    /**
     * Get creator user
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }

    /**
     * Get updater user
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'updated_by');
    }

    /**
     * Get activator user
     */
    public function activator(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'activated_by');
    }

    /**
     * Scope: Get active workflows only
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)
            ->whereNull('deleted_at');
    }

    /**
     * Scope: Get default workflow
     */
    public function scopeDefault(Builder $query): Builder
    {
        return $query->where('is_default', true);
    }

    /**
     * Scope: Filter by process type
     */
    public function scopeProcessType(Builder $query, string $processType): Builder
    {
        return $query->where('process_type', $processType);
    }

    /**
     * Scope: Get workflows without deleted
     */
    public function scopeActiveWorkflow(Builder $query): Builder
    {
        return $query->whereNull('deleted_at');
    }

    /**
     * Check if workflow can be edited
     */
    public function canEdit(): bool
    {
        return !$this->is_active;
    }

    /**
     * Check if workflow can be deleted
     */
    public function canDelete(): bool
    {
        return !$this->is_active && $this->transitions()->count() === 0;
    }

    /**
     * Get notification config
     */
    public function getNotificationConfig(): array
    {
        return $this->config['notification_rules'] ?? [
            'on_transition' => true,
            'on_completion' => true,
            'notify_performer' => true,
            'notify_creator' => false,
        ];
    }

    /**
     * Get SLA config
     */
    public function getSlaConfig(): array
    {
        return $this->config['sla_config'] ?? [
            'enabled' => false,
            'default_sla_hours' => 48,
            'escalation_threshold_hours' => 72,
        ];
    }
}
```

### 3.2. WorkflowTransition.php

**File Path:** `backend/app/Models/WorkflowTransition.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\{
    Model,
    SoftDeletes,
    Relations\BelongsTo,
    Factories\HasFactory
};

/**
 * Class WorkflowTransition
 * 
 * @property int $id
 * @property int|null $workflow_definition_id
 * @property string $process_type
 * @property string $workflow_group
 * @property string $from_status_code
 * @property string|null $from_status_name_vi
 * @property string $to_status_code
 * @property string|null $to_status_name_vi
 * @property array|null $allowed_roles
 * @property array|null $required_permissions
 * @property bool $is_auto_transition
 * @property array|null $required_fields
 * @property array|null $validation_rules
 * @property int $sort_order
 * @property bool $is_active
 * @property bool $is_default
 * @property array|null $transition_config
 * @property string|null $description
 * @property int|null $created_by
 * @property int|null $updated_by
 */
class WorkflowTransition extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'workflow_transitions';

    protected $fillable = [
        'workflow_definition_id',
        'process_type',
        'workflow_group',
        'from_status_code',
        'from_status_name_vi',
        'to_status_code',
        'to_status_name_vi',
        'allowed_roles',
        'required_permissions',
        'is_auto_transition',
        'required_fields',
        'validation_rules',
        'sort_order',
        'is_active',
        'is_default',
        'transition_config',
        'description',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'workflow_definition_id' => 'integer',
        'is_auto_transition' => 'boolean',
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'sort_order' => 'integer',
        'allowed_roles' => 'array',
        'required_permissions' => 'array',
        'required_fields' => 'array',
        'validation_rules' => 'array',
        'transition_config' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get parent workflow
     */
    public function workflow(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }

    /**
     * Get creator user
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }

    /**
     * Check if user role can execute this transition
     */
    public function canExecute(string $userRole): bool
    {
        $allowedRoles = $this->allowed_roles ?? [];
        
        if (in_array('all', $allowedRoles)) {
            return true;
        }
        
        return in_array($userRole, $allowedRoles);
    }

    /**
     * Check if transition is automatic
     */
    public function isAutoTransition(): bool
    {
        return $this->is_auto_transition === true;
    }

    /**
     * Get required fields for this transition
     */
    public function getRequiredFields(): array
    {
        return $this->required_fields ?? [];
    }

    /**
     * Get transition config
     */
    public function getTransitionConfig(): array
    {
        return $this->transition_config ?? [];
    }

    /**
     * Get notification config for this transition
     */
    public function getNotificationConfig(): array
    {
        return $this->transition_config['notifications'] ?? [
            'send_email' => true,
            'send_push' => true,
            'recipients' => ['performer', 'creator'],
        ];
    }

    /**
     * Get SLA config for this transition
     */
    public function getSlaConfig(): array
    {
        return $this->transition_config['sla'] ?? [
            'sla_hours' => 24,
            'escalate_after_hours' => 48,
            'business_hours_only' => true,
        ];
    }

    /**
     * Scope: Get transitions for workflow
     */
    public function scopeForWorkflow($query, int $workflowId)
    {
        return $query->where('workflow_definition_id', $workflowId);
    }

    /**
     * Scope: Get transitions from status
     */
    public function scopeFromStatus($query, string $statusCode)
    {
        return $query->where('from_status_code', $statusCode);
    }

    /**
     * Scope: Get active transitions only
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)->whereNull('deleted_at');
    }
}
```

---

## 4. SERVICE LAYER

### 4.1. WorkflowDefinitionService.php

**File Path:** `backend/app/Services/V5/Workflow/WorkflowDefinitionService.php`

```php
<?php

namespace App\Services\V5\Workflow;

use App\Models\WorkflowDefinition;
use App\Models\WorkflowTransition;
use App\Services\V5\Support\AuditService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

class WorkflowDefinitionService
{
    public function __construct(
        protected AuditService $auditService
    ) {}

    /**
     * List workflows by process type
     * 
     * @param string $processType
     * @param array $filters
     * @return LengthAwarePaginator
     */
    public function listWorkflows(
        string $processType,
        array $filters = []
    ): LengthAwarePaginator {
        $query = WorkflowDefinition::query()
            ->processType($processType)
            ->activeWorkflow()
            ->with(['creator', 'activator']);

        // Apply filters
        if (isset($filters['is_active'])) {
            $query->where('is_active', $filters['is_active']);
        }

        if (isset($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhere('code', 'LIKE', "%{$search}%")
                  ->orWhere('description', 'LIKE', "%{$search}%");
            });
        }

        if (isset($filters['workflow_group'])) {
            $query->where('workflow_group', $filters['workflow_group']);
        }

        return $query->orderBy('created_at', 'desc')->paginate(15);
    }

    /**
     * Get active workflow for process type
     * 
     * @param string $processType
     * @return WorkflowDefinition|null
     */
    public function getActiveWorkflow(string $processType): ?WorkflowDefinition
    {
        return WorkflowDefinition::query()
            ->processType($processType)
            ->active()
            ->first();
    }

    /**
     * Get default workflow for process type
     * 
     * @param string $processType
     * @return WorkflowDefinition|null
     */
    public function getDefaultWorkflow(string $processType): ?WorkflowDefinition
    {
        return WorkflowDefinition::query()
            ->processType($processType)
            ->default()
            ->activeWorkflow()
            ->first();
    }

    /**
     * Get workflow detail with transitions
     * 
     * @param int $id
     * @return WorkflowDefinition|null
     */
    public function getWorkflowDetail(int $id): ?WorkflowDefinition
    {
        return WorkflowDefinition::with([
            'transitions' => function ($query) {
                $query->orderBy('sort_order')->orderBy('to_status_name_vi');
            },
            'creator',
            'activator'
        ])->find($id);
    }

    /**
     * Create new workflow
     * 
     * @param array $data
     * @return WorkflowDefinition
     */
    public function createWorkflow(array $data): WorkflowDefinition
    {
        return DB::transaction(function () use ($data) {
            $workflow = WorkflowDefinition::create([
                'code' => strtoupper($data['code']),
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'process_type' => $data['process_type'] ?? 'customer_request',
                'workflow_group' => $data['workflow_group'] ?? 'default',
                'version' => $data['version'] ?? '1.0',
                'is_active' => false,
                'is_default' => false,
                'config' => $data['config'] ?? null,
                'metadata' => $data['metadata'] ?? null,
                'created_by' => auth()->id(),
            ]);

            $this->auditService->recordAuditEvent(
                entityType: 'workflow_definition',
                entityId: $workflow->id,
                action: 'create',
                details: $workflow->only($workflow->getFillable()),
                userId: auth()->id()
            );

            return $workflow;
        });
    }

    /**
     * Update workflow
     * 
     * @param int $id
     * @param array $data
     * @return WorkflowDefinition
     * @throws \Exception
     */
    public function updateWorkflow(int $id, array $data): WorkflowDefinition
    {
        return DB::transaction(function () use ($id, $data) {
            $workflow = WorkflowDefinition::findOrFail($id);

            // Cannot update active workflow
            if ($workflow->is_active) {
                throw new \Exception('Không thể cập nhật workflow đang active');
            }

            $changes = [];

            // Updatable fields
            $updatableFields = ['name', 'description', 'version', 'config', 'workflow_group'];
            foreach ($updatableFields as $field) {
                if (isset($data[$field]) && $workflow->$field !== $data[$field]) {
                    $changes[$field] = [
                        'old' => $workflow->$field,
                        'new' => $data[$field]
                    ];
                    $workflow->$field = $data[$field];
                }
            }

            $workflow->updated_by = auth()->id();
            $workflow->save();

            $this->auditService->recordAuditEvent(
                entityType: 'workflow_definition',
                entityId: $workflow->id,
                action: 'update',
                details: $changes,
                userId: auth()->id()
            );

            return $workflow->fresh();
        });
    }

    /**
     * Activate workflow (auto deactivate others)
     * 
     * @param int $workflowId
     * @return WorkflowDefinition
     */
    public function activateWorkflow(int $workflowId): WorkflowDefinition
    {
        return DB::transaction(function () use ($workflowId) {
            $workflow = WorkflowDefinition::findOrFail($workflowId);

            // Deactivate all other workflows for same process type
            WorkflowDefinition::where('process_type', $workflow->process_type)
                ->where('id', '!=', $workflowId)
                ->whereNull('deleted_at')
                ->update([
                    'is_active' => false,
                    'deactivated_by' => auth()->id(),
                    'deactivated_at' => now(),
                ]);

            // Activate selected workflow
            $workflow->update([
                'is_active' => true,
                'activated_by' => auth()->id(),
                'activated_at' => now(),
                'updated_by' => auth()->id(),
            ]);

            $this->auditService->recordAuditEvent(
                entityType: 'workflow_definition',
                entityId: $workflow->id,
                action: 'activate',
                details: [
                    'process_type' => $workflow->process_type,
                    'deactivated_count' => WorkflowDefinition::where('process_type', $workflow->process_type)
                        ->where('is_active', false)
                        ->where('deactivated_at', '>=', now()->subMinute())
                        ->count()
                ],
                userId: auth()->id()
            );

            return $workflow->fresh();
        });
    }

    /**
     * Deactivate workflow
     * 
     * @param int $workflowId
     * @return WorkflowDefinition
     */
    public function deactivateWorkflow(int $workflowId): WorkflowDefinition
    {
        return DB::transaction(function () use ($workflowId) {
            $workflow = WorkflowDefinition::findOrFail($workflowId);

            // Cannot deactivate if it's the only active workflow
            $activeCount = WorkflowDefinition::where('process_type', $workflow->process_type)
                ->active()
                ->count();

            if ($activeCount <= 1 && $workflow->is_active) {
                throw new \Exception('Phải có ít nhất 1 workflow active');
            }

            $workflow->update([
                'is_active' => false,
                'deactivated_by' => auth()->id(),
                'deactivated_at' => now(),
                'updated_by' => auth()->id(),
            ]);

            $this->auditService->recordAuditEvent(
                entityType: 'workflow_definition',
                entityId: $workflow->id,
                action: 'deactivate',
                details: ['previous_status' => 'active'],
                userId: auth()->id()
            );

            return $workflow->fresh();
        });
    }

    /**
     * Delete workflow (soft delete)
     * 
     * @param int $workflowId
     * @return bool
     * @throws \Exception
     */
    public function deleteWorkflow(int $workflowId): bool
    {
        return DB::transaction(function () use ($workflowId) {
            $workflow = WorkflowDefinition::findOrFail($workflowId);

            // Cannot delete active workflow
            if ($workflow->is_active) {
                throw new \Exception('Không thể xóa workflow đang active');
            }

            // Cannot delete if has transitions
            if ($workflow->transitions()->count() > 0) {
                throw new \Exception('Phải xóa hết transitions trước khi xóa workflow');
            }

            $workflow->delete();

            $this->auditService->recordAuditEvent(
                entityType: 'workflow_definition',
                entityId: $workflow->id,
                action: 'delete',
                details: ['name' => $workflow->name, 'code' => $workflow->code],
                userId: auth()->id()
            );

            return true;
        });
    }

    /**
     * Clone workflow
     * 
     * @param int $workflowId
     * @param string $newCode
     * @param string $newName
     * @return WorkflowDefinition
     */
    public function cloneWorkflow(
        int $workflowId,
        string $newCode,
        string $newName
    ): WorkflowDefinition {
        return DB::transaction(function () use ($workflowId, $newCode, $newName) {
            $source = WorkflowDefinition::with('transitions')->findOrFail($workflowId);

            // Create new workflow
            $newWorkflow = WorkflowDefinition::create([
                'code' => strtoupper($newCode),
                'name' => $newName,
                'description' => $source->description,
                'process_type' => $source->process_type,
                'workflow_group' => $source->workflow_group,
                'version' => $source->version . '-copy',
                'is_active' => false,
                'is_default' => false,
                'config' => $source->config,
                'metadata' => array_merge(
                    $source->metadata ?? [],
                    ['cloned_from' => $workflowId]
                ),
                'created_by' => auth()->id(),
            ]);

            // Clone transitions
            foreach ($source->transitions as $transition) {
                WorkflowTransition::create([
                    'workflow_definition_id' => $newWorkflow->id,
                    'process_type' => $source->process_type,
                    'workflow_group' => $source->workflow_group,
                    'from_status_code' => $transition->from_status_code,
                    'from_status_name_vi' => $transition->from_status_name_vi,
                    'to_status_code' => $transition->to_status_code,
                    'to_status_name_vi' => $transition->to_status_name_vi,
                    'allowed_roles' => $transition->allowed_roles,
                    'required_permissions' => $transition->required_permissions,
                    'is_auto_transition' => $transition->is_auto_transition,
                    'required_fields' => $transition->required_fields,
                    'validation_rules' => $transition->validation_rules,
                    'sort_order' => $transition->sort_order,
                    'is_active' => $transition->is_active,
                    'transition_config' => $transition->transition_config,
                    'description' => $transition->description,
                    'created_by' => auth()->id(),
                ]);
            }

            $this->auditService->recordAuditEvent(
                entityType: 'workflow_definition',
                entityId: $newWorkflow->id,
                action: 'clone',
                details: ['cloned_from' => $workflowId],
                userId: auth()->id()
            );

            return $newWorkflow;
        });
    }
}
```

### 4.2. WorkflowTransitionService.php

**File Path:** `backend/app/Services/V5/Workflow/WorkflowTransitionService.php`

```php
<?php

namespace App\Services\V5\Workflow;

use App\Models\WorkflowTransition;
use App\Models\WorkflowDefinition;
use App\Services\V5\Support\AuditService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

class WorkflowTransitionService
{
    public function __construct(
        protected AuditService $auditService
    ) {}

    /**
     * Get transitions for workflow and from status
     * 
     * @param int $workflowId
     * @param string|null $fromStatusCode
     * @return Collection
     */
    public function getTransitionsForWorkflow(
        int $workflowId,
        ?string $fromStatusCode = null
    ): Collection {
        $query = WorkflowTransition::query()
            ->forWorkflow($workflowId)
            ->active()
            ->orderBy('sort_order')
            ->orderBy('to_status_name_vi');

        if ($fromStatusCode) {
            $query->fromStatus($fromStatusCode);
        }

        return $query->get();
    }

    /**
     * Add transition to workflow
     * 
     * @param int $workflowId
     * @param array $data
     * @return WorkflowTransition
     */
    public function addTransition(int $workflowId, array $data): WorkflowTransition
    {
        return DB::transaction(function () use ($workflowId, $data) {
            $workflow = WorkflowDefinition::findOrFail($workflowId);

            // Cannot add transitions to active workflow
            if ($workflow->is_active) {
                throw new \Exception('Không thể thêm transition vào workflow đang active');
            }

            $transition = WorkflowTransition::create([
                'workflow_definition_id' => $workflowId,
                'process_type' => $workflow->process_type,
                'workflow_group' => $workflow->workflow_group,
                'from_status_code' => $data['from_status_code'],
                'from_status_name_vi' => $data['from_status_name_vi'] ?? null,
                'to_status_code' => $data['to_status_code'],
                'to_status_name_vi' => $data['to_status_name_vi'] ?? null,
                'allowed_roles' => $data['allowed_roles'] ?? ['all'],
                'required_permissions' => $data['required_permissions'] ?? null,
                'is_auto_transition' => $data['is_auto_transition'] ?? false,
                'required_fields' => $data['required_fields'] ?? [],
                'validation_rules' => $data['validation_rules'] ?? null,
                'sort_order' => $data['sort_order'] ?? 0,
                'is_active' => $data['is_active'] ?? true,
                'transition_config' => $data['transition_config'] ?? null,
                'description' => $data['description'] ?? null,
                'created_by' => auth()->id(),
            ]);

            $this->auditService->recordAuditEvent(
                entityType: 'workflow_transition',
                entityId: $transition->id,
                action: 'create',
                details: $transition->only($transition->getFillable()),
                userId: auth()->id()
            );

            return $transition;
        });
    }

    /**
     * Update transition
     * 
     * @param int $transitionId
     * @param array $data
     * @return WorkflowTransition
     */
    public function updateTransition(int $transitionId, array $data): WorkflowTransition
    {
        return DB::transaction(function () use ($transitionId, $data) {
            $transition = WorkflowTransition::findOrFail($transitionId);
            $workflow = $transition->workflow;

            // Cannot update transitions of active workflow
            if ($workflow->is_active) {
                throw new \Exception('Không thể cập nhật transition của workflow đang active');
            }

            $changes = [];
            $updatableFields = [
                'from_status_name_vi',
                'to_status_name_vi',
                'allowed_roles',
                'required_permissions',
                'is_auto_transition',
                'required_fields',
                'validation_rules',
                'sort_order',
                'is_active',
                'transition_config',
                'description',
            ];

            foreach ($updatableFields as $field) {
                if (isset($data[$field]) && $transition->$field !== $data[$field]) {
                    $changes[$field] = [
                        'old' => $transition->$field,
                        'new' => $data[$field]
                    ];
                    $transition->$field = $data[$field];
                }
            }

            $transition->updated_by = auth()->id();
            $transition->save();

            $this->auditService->recordAuditEvent(
                entityType: 'workflow_transition',
                entityId: $transition->id,
                action: 'update',
                details: $changes,
                userId: auth()->id()
            );

            return $transition->fresh();
        });
    }

    /**
     * Remove transition
     * 
     * @param int $transitionId
     * @return bool
     */
    public function removeTransition(int $transitionId): bool
    {
        return DB::transaction(function () use ($transitionId) {
            $transition = WorkflowTransition::findOrFail($transitionId);
            $workflow = $transition->workflow;

            // Cannot remove transitions from active workflow
            if ($workflow->is_active) {
                throw new \Exception('Không thể xóa transition của workflow đang active');
            }

            $transition->delete();

            $this->auditService->recordAuditEvent(
                entityType: 'workflow_transition',
                entityId: $transition->id,
                action: 'delete',
                details: [
                    'from_status' => $transition->from_status_code,
                    'to_status' => $transition->to_status_code
                ],
                userId: auth()->id()
            );

            return true;
        });
    }

    /**
     * Bulk import transitions from Excel data
     * 
     * @param int $workflowId
     * @param array $excelData
     * @return array
     */
    public function bulkImportFromExcel(int $workflowId, array $excelData): array
    {
        return DB::transaction(function () use ($workflowId, $excelData) {
            $workflow = WorkflowDefinition::findOrFail($workflowId);

            if ($workflow->is_active) {
                throw new \Exception('Không thể import transitions vào workflow đang active');
            }

            $stats = [
                'total' => count($excelData),
                'created' => 0,
                'updated' => 0,
                'failed' => 0,
                'errors' => [],
            ];

            foreach ($excelData as $index => $row) {
                try {
                    // Validate row data
                    $validated = $this->validateTransitionRow($row, $index);

                    // Check if transition exists
                    $existing = WorkflowTransition::where('workflow_definition_id', $workflowId)
                        ->where('from_status_code', $validated['from_status_code'])
                        ->where('to_status_code', $validated['to_status_code'])
                        ->first();

                    if ($existing) {
                        // Update existing
                        $this->updateTransition($existing->id, $validated);
                        $stats['updated']++;
                    } else {
                        // Create new
                        $this->addTransition($workflowId, $validated);
                        $stats['created']++;
                    }
                } catch (\Exception $e) {
                    $stats['failed']++;
                    $stats['errors'][] = [
                        'row' => $index + 2, // Excel row number (header + 1)
                        'error' => $e->getMessage(),
                    ];
                }
            }

            $this->auditService->recordAuditEvent(
                entityType: 'workflow_definition',
                entityId: $workflowId,
                action: 'bulk_import_transitions',
                details: $stats,
                userId: auth()->id()
            );

            return $stats;
        });
    }

    /**
     * Validate transition row from Excel
     * 
     * @param array $row
     * @param int $index
     * @return array
     * @throws \Exception
     */
    protected function validateTransitionRow(array $row, int $index): array
    {
        $required = ['from_status_code', 'to_status_code', 'allowed_roles'];
        
        foreach ($required as $field) {
            if (empty($row[$field])) {
                throw new \Exception(
                    "Dòng " . ($index + 2) . ": Thiếu trường bắt buộc '{$field}'"
                );
            }
        }

        // Parse allowed_roles from JSON string if needed
        if (is_string($row['allowed_roles'])) {
            $parsed = json_decode($row['allowed_roles'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $row['allowed_roles'] = $parsed;
            } else {
                $row['allowed_roles'] = [$row['allowed_roles']];
            }
        }

        return [
            'from_status_code' => $row['from_status_code'],
            'from_status_name_vi' => $row['from_status_name_vi'] ?? null,
            'to_status_code' => $row['to_status_code'],
            'to_status_name_vi' => $row['to_status_name_vi'] ?? null,
            'allowed_roles' => $row['allowed_roles'],
            'is_auto_transition' => filter_var(
                $row['is_auto_transition'] ?? false,
                FILTER_VALIDATE_BOOLEAN
            ),
            'required_fields' => $this->parseJsonField($row['required_fields'] ?? null),
            'sort_order' => (int) ($row['sort_order'] ?? 0),
            'is_active' => filter_var(
                $row['is_active'] ?? true,
                FILTER_VALIDATE_BOOLEAN
            ),
            'transition_config' => $this->parseJsonField($row['transition_config'] ?? null),
            'description' => $row['description'] ?? null,
        ];
    }

    /**
     * Parse JSON field
     * 
     * @param string|null $value
     * @return array|null
     */
    protected function parseJsonField(?string $value): ?array
    {
        if (!$value) {
            return null;
        }

        $parsed = json_decode($value, true);
        return json_last_error() === JSON_ERROR_NONE ? $parsed : null;
    }

    /**
     * Validate if transition is allowed
     * 
     * @param string $fromStatusCode
     * @param string $toStatusCode
     * @param int $workflowId
     * @return bool
     */
    public function isValidTransition(
        string $fromStatusCode,
        string $toStatusCode,
        int $workflowId
    ): bool {
        return WorkflowTransition::where('workflow_definition_id', $workflowId)
            ->where('from_status_code', $fromStatusCode)
            ->where('to_status_code', $toStatusCode)
            ->where('is_active', true)
            ->exists();
    }

    /**
     * Check if user can execute transition
     * 
     * @param string $fromStatusCode
     * @param string $toStatusCode
     * @param int $workflowId
     * @param int $userId
     * @param int|null $projectId
     * @return bool
     */
    public function canUserTransition(
        string $fromStatusCode,
        string $toStatusCode,
        int $workflowId,
        int $userId,
        ?int $projectId = null
    ): bool {
        $transition = WorkflowTransition::where('workflow_definition_id', $workflowId)
            ->where('from_status_code', $fromStatusCode)
            ->where('to_status_code', $toStatusCode)
            ->where('is_active', true)
            ->first();

        if (!$transition) {
            return false;
        }

        // Get user's RACI role for the project
        // This would need integration with ProjectRaciService
        $userRole = $this->getUserRaciRole($userId, $projectId);

        return $transition->canExecute($userRole);
    }

    /**
     * Get user's RACI role for project
     * 
     * @param int $userId
     * @param int|null $projectId
     * @return string
     */
    protected function getUserRaciRole(int $userId, ?int $projectId): string
    {
        if (!$projectId) {
            return 'all';
        }

        // Query project_raci_assignments
        $assignment = DB::table('project_raci_assignments')
            ->where('project_item_id', $projectId)
            ->where('user_id', $userId)
            ->first();

        return $assignment ? $assignment->raci_role : 'all';
    }
}
```

---

## 5. API ENDPOINTS

### 5.1. Workflow Definitions API

#### GET /api/v5/workflow-definitions

**Mô tả:** List tất cả workflows theo process type

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `process_type` | string | ✅ | - | `customer_request`, `project_procedure` |
| `page` | int | ❌ | 1 | Page number |
| `per_page` | int | ❌ | 15 | Items per page |
| `is_active` | boolean | ❌ | - | Filter by active status |
| `search` | string | ❌ | - | Search in name, code, description |
| `workflow_group` | string | ❌ | - | Filter by workflow group |

**Request Example:**
```http
GET /api/v5/workflow-definitions?process_type=customer_request&is_active=true
Authorization: Bearer {token}
```

**Response Example:**
```json
{
  "data": [
    {
      "id": 1,
      "code": "LUONG_A",
      "name": "Luồng xử lý A",
      "description": "Luồng xử lý tiêu chuẩn",
      "process_type": "customer_request",
      "workflow_group": "default",
      "is_active": true,
      "is_default": false,
      "version": "1.0",
      "config": {
        "notification_rules": {
          "on_transition": true,
          "on_completion": true
        }
      },
      "created_by": 1,
      "creator": {
        "id": 1,
        "full_name": "Admin User"
      },
      "activated_at": "2026-03-28T10:00:00+07:00",
      "created_at": "2026-03-28T09:00:00+07:00",
      "updated_at": "2026-03-28T10:00:00+07:00"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 15,
    "total": 1,
    "total_pages": 1,
    "active_workflow_id": 1
  }
}
```

---

#### GET /api/v5/workflow-definitions/{id}

**Mô tả:** Get chi tiết workflow với transitions

**Request Example:**
```http
GET /api/v5/workflow-definitions/1
Authorization: Bearer {token}
```

**Response Example:**
```json
{
  "data": {
    "id": 1,
    "code": "LUONG_A",
    "name": "Luồng xử lý A",
    "description": "Luồng xử lý tiêu chuẩn",
    "process_type": "customer_request",
    "is_active": true,
    "version": "1.0",
    "config": {...},
    "transitions": [
      {
        "id": 1,
        "from_status_code": "new_intake",
        "from_status_name_vi": "Tiếp nhận",
        "to_status_code": "assigned_to_receiver",
        "to_status_name_vi": "Giao R thực hiện",
        "allowed_roles": ["all"],
        "is_auto_transition": false,
        "required_fields": ["performer_user_id"],
        "sort_order": 10,
        "transition_config": {
          "notifications": {
            "send_email": true
          }
        }
      }
    ],
    "creator": {...},
    "activator": {...},
    "created_at": "2026-03-28T09:00:00+07:00"
  }
}
```

---

#### POST /api/v5/workflow-definitions

**Mô tả:** Tạo workflow mới

**Request Body:**
```json
{
  "code": "LUONG_B",
  "name": "Luồng xử lý B",
  "description": "Luồng xử lý rút gọn",
  "process_type": "customer_request",
  "workflow_group": "default",
  "version": "1.0",
  "config": {
    "notification_rules": {
      "on_transition": true,
      "notify_performer": true
    },
    "sla_config": {
      "enabled": true,
      "default_sla_hours": 24
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "id": 2,
    "code": "LUONG_B",
    "name": "Luồng xử lý B",
    "created_at": "2026-03-28T11:00:00+07:00"
  },
  "meta": {
    "message": "Tạo workflow thành công"
  }
}
```

---

#### PUT /api/v5/workflow-definitions/{id}

**Mô tả:** Cập nhật workflow (chỉ khi inactive)

**Request Body:**
```json
{
  "name": "Luồng xử lý A (Cập nhật)",
  "description": "Mô tả cập nhật",
  "version": "1.1",
  "config": {
    "notification_rules": {
      "on_transition": false
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "name": "Luồng xử lý A (Cập nhật)",
    "version": "1.1",
    "updated_at": "2026-03-28T12:00:00+07:00"
  }
}
```

---

#### DELETE /api/v5/workflow-definitions/{id}

**Mô tả:** Soft delete workflow (chỉ khi inactive)

**Response:**
```json
{
  "meta": {
    "message": "Xóa workflow thành công"
  }
}
```

---

#### POST /api/v5/workflow-definitions/{id}/activate

**Mô tả:** Kích hoạt workflow (auto deactivate others)

**Request Example:**
```http
POST /api/v5/workflow-definitions/2/activate
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": {
    "id": 2,
    "code": "LUONG_B",
    "is_active": true,
    "activated_at": "2026-03-28T14:00:00+07:00"
  },
  "meta": {
    "message": "Kích hoạt workflow thành công",
    "deactivated_workflows": [
      {
        "id": 1,
        "code": "LUONG_A",
        "deactivated_at": "2026-03-28T14:00:00+07:00"
      }
    ]
  }
}
```

---

#### POST /api/v5/workflow-definitions/{id}/deactivate

**Mô tả:** Vô hiệu hóa workflow

**Response:**
```json
{
  "data": {
    "id": 1,
    "is_active": false,
    "deactivated_at": "2026-03-28T15:00:00+07:00"
  }
}
```

---

### 5.2. Workflow Transitions API

#### GET /api/v5/workflow-definitions/{id}/transitions

**Mô tả:** Lấy danh sách transitions của workflow

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `from_status` | string | Filter by from_status_code |
| `is_active` | boolean | Filter by active status |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "from_status_code": "new_intake",
      "from_status_name_vi": "Tiếp nhận",
      "to_status_code": "assigned_to_receiver",
      "to_status_name_vi": "Giao R thực hiện",
      "allowed_roles": ["all"],
      "required_fields": ["performer_user_id"],
      "sort_order": 10,
      "is_active": true
    }
  ],
  "meta": {
    "workflow_id": 1,
    "workflow_name": "Luồng xử lý A",
    "total": 25
  }
}
```

---

#### POST /api/v5/workflow-definitions/{id}/transitions

**Mô tả:** Thêm transition mới

**Request Body:**
```json
{
  "from_status_code": "new_intake",
  "from_status_name_vi": "Tiếp nhận",
  "to_status_code": "assigned_to_receiver",
  "to_status_name_vi": "Giao R thực hiện",
  "allowed_roles": ["all"],
  "required_fields": ["performer_user_id", "estimated_hours"],
  "is_auto_transition": false,
  "sort_order": 10,
  "transition_config": {
    "notifications": {
      "send_email": true,
      "recipients": ["performer"]
    }
  }
}
```

---

#### PUT /api/v5/workflow-transitions/{id}

**Mô tả:** Cập nhật transition

**Request Body:**
```json
{
  "to_status_name_vi": "Giao R thực hiện (Cập nhật)",
  "allowed_roles": ["R", "A"],
  "required_fields": ["performer_user_id"],
  "sort_order": 15
}
```

---

#### DELETE /api/v5/workflow-transitions/{id}

**Mô tả:** Xóa transition

---

#### POST /api/v5/workflow-definitions/{id}/transitions/bulk-import

**Mô tả:** Bulk import transitions từ Excel data

**Request Body:**
```json
{
  "data": [
    {
      "from_status_code": "new_intake",
      "from_status_name_vi": "Tiếp nhận",
      "to_status_code": "assigned_to_receiver",
      "to_status_name_vi": "Giao R thực hiện",
      "allowed_roles": "[\"all\"]",
      "is_auto_transition": "false",
      "required_fields": "[\"performer_user_id\"]",
      "sort_order": "10",
      "is_active": "true"
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "total": 25,
    "created": 20,
    "updated": 5,
    "failed": 0,
    "errors": []
  },
  "meta": {
    "message": "Import thành công 25 transitions"
  }
}
```

---

## 6. FRONTEND COMPONENTS

### 6.1. WorkflowManagementHub.tsx

**File Path:** `frontend/src/modules/workflow/components/WorkflowManagementHub.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileSpreadsheet, Download } from 'lucide-react';
import { useWorkflowStore } from '../stores/workflowStore';
import WorkflowListView from './WorkflowListView';
import WorkflowDetailView from './WorkflowDetailView';
import WorkflowDefinitionModal from './WorkflowDefinitionModal';
import WorkflowTransitionMatrix from './WorkflowTransitionMatrix';
import { toast } from '@/hooks/useToast';

interface WorkflowManagementHubProps {
  processType: string;
}

export const WorkflowManagementHub: React.FC<WorkflowManagementHubProps> = ({
  processType,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'list';
  
  const { workflows, activeWorkflow, fetchWorkflows, fetchActiveWorkflow } = 
    useWorkflowStore();

  useEffect(() => {
    fetchWorkflows(processType);
    fetchActiveWorkflow(processType);
  }, [processType]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Cấu hình Luồng Xử lý
          </h1>
          <p className="text-muted-foreground">
            Quản lý định nghĩa và chuyển tiếp workflow cho {processType}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport()}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => handleCreate()}>
            <Plus className="w-4 h-4 mr-2" />
            Tạo Workflow
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="list">Danh sách</TabsTrigger>
          <TabsTrigger value="detail">Chi tiết</TabsTrigger>
          <TabsTrigger value="matrix">Ma trận chuyển tiếp</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {activeTab === 'list' && (
            <WorkflowListView 
              processType={processType}
              onCreate={handleCreate}
              onActivate={handleActivate}
              onEdit={handleEdit}
            />
          )}
          
          {activeTab === 'detail' && (
            <WorkflowDetailView processType={processType} />
          )}
          
          {activeTab === 'matrix' && (
            <WorkflowTransitionMatrix 
              workflowId={activeWorkflow?.id}
              processType={processType}
            />
          )}
        </div>
      </Tabs>

      {/* Create/Edit Modal */}
      <WorkflowDefinitionModal />
    </div>
  );

  function handleCreate() {
    useWorkflowStore.getState().openModal('create');
  }

  function handleEdit(workflowId: number) {
    useWorkflowStore.getState().openModal('edit', workflowId);
  }

  async function handleActivate(workflowId: number) {
    const confirmed = window.confirm(
      '⚠️ Khi kích hoạt workflow này, workflow hiện tại sẽ bị vô hiệu hóa.\n\n' +
      'Bạn có chắc muốn tiếp tục?'
    );
    
    if (!confirmed) return;

    try {
      await useWorkflowStore.getState().activateWorkflow(workflowId);
      toast.success('Kích hoạt workflow thành công');
      fetchActiveWorkflow(processType);
    } catch (error) {
      toast.error('Kích hoạt workflow thất bại');
    }
  }

  function handleExport() {
    // Export workflow config to Excel
    toast.info('Đang export workflow...');
  }
};
```

---

### 6.2. WorkflowDefinitionModal.tsx

**File Path:** `frontend/src/modules/workflow/components/WorkflowDefinitionModal.tsx`

```tsx
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useWorkflowStore } from '../stores/workflowStore';
import { toast } from '@/hooks/useToast';

interface WorkflowFormData {
  code: string;
  name: string;
  description: string;
  workflow_group: string;
  version: string;
  is_default: boolean;
  config: {
    notification_rules: {
      on_transition: boolean;
      on_completion: boolean;
      notify_performer: boolean;
      notify_creator: boolean;
    };
    sla_config: {
      enabled: boolean;
      default_sla_hours: number;
      escalation_threshold_hours: number;
    };
  };
}

export const WorkflowDefinitionModal: React.FC = () => {
  const { 
    modalOpen, 
    modalMode, 
    selectedWorkflow, 
    closeModal, 
    createWorkflow, 
    updateWorkflow 
  } = useWorkflowStore();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorkflowFormData>();

  useEffect(() => {
    if (modalMode === 'edit' && selectedWorkflow) {
      reset({
        code: selectedWorkflow.code,
        name: selectedWorkflow.name,
        description: selectedWorkflow.description || '',
        workflow_group: selectedWorkflow.workflow_group || 'default',
        version: selectedWorkflow.version || '1.0',
        is_default: selectedWorkflow.is_default || false,
        config: selectedWorkflow.config || {
          notification_rules: {
            on_transition: true,
            on_completion: true,
            notify_performer: true,
            notify_creator: false,
          },
          sla_config: {
            enabled: false,
            default_sla_hours: 48,
            escalation_threshold_hours: 72,
          },
        },
      });
    } else if (modalMode === 'create') {
      reset({
        code: '',
        name: '',
        description: '',
        workflow_group: 'default',
        version: '1.0',
        is_default: false,
        config: {
          notification_rules: {
            on_transition: true,
            on_completion: true,
            notify_performer: true,
            notify_creator: false,
          },
          sla_config: {
            enabled: false,
            default_sla_hours: 48,
            escalation_threshold_hours: 72,
          },
        },
      });
    }
  }, [modalMode, selectedWorkflow, modalOpen]);

  const onSubmit = async (data: WorkflowFormData) => {
    try {
      if (modalMode === 'create') {
        await createWorkflow(data);
        toast.success('Tạo workflow thành công');
      } else {
        await updateWorkflow(selectedWorkflow!.id, data);
        toast.success('Cập nhật workflow thành công');
      }
      closeModal();
    } catch (error) {
      toast.error(
        modalMode === 'create' 
          ? 'Tạo workflow thất bại' 
          : 'Cập nhật workflow thất bại'
      );
    }
  };

  const isEditOfActive = modalMode === 'edit' && selectedWorkflow?.is_active;

  return (
    <Dialog open={modalOpen} onOpenChange={closeModal}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {modalMode === 'create' ? 'Tạo Workflow Mới' : 'Chỉnh Sửa Workflow'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Thông Tin Cơ Bản</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Mã Workflow *</Label>
                <Input
                  id="code"
                  {...register('code', {
                    required: 'Mã workflow là bắt buộc',
                    pattern: {
                      value: /^[A-Z0-9_]+$/,
                      message: 'Chỉ dùng chữ HOA, số và gạch dưới',
                    },
                  })}
                  placeholder="LUONG_A"
                  disabled={isEditOfActive}
                />
                {errors.code && (
                  <p className="text-sm text-red-500">{errors.code.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="name">Tên Hiển Thị *</Label>
                <Input
                  id="name"
                  {...register('name', {
                    required: 'Tên hiển thị là bắt buộc',
                  })}
                  placeholder="Luồng xử lý A"
                  disabled={isEditOfActive}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Mô Tả</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Mô tả chi tiết workflow..."
                rows={3}
                disabled={isEditOfActive}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="workflow_group">Nhóm Workflow</Label>
                <Input
                  id="workflow_group"
                  {...register('workflow_group')}
                  placeholder="default"
                  disabled={isEditOfActive}
                />
              </div>

              <div>
                <Label htmlFor="version">Phiên Bản</Label>
                <Input
                  id="version"
                  {...register('version')}
                  placeholder="1.0"
                  disabled={isEditOfActive}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_default"
                {...register('is_default')}
                disabled={isEditOfActive}
              />
              <Label htmlFor="is_default">Là workflow mặc định</Label>
            </div>
          </div>

          {/* Notification Config */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Cấu Hình Thông Báo</h3>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="on_transition"
                  {...register('config.notification_rules.on_transition')}
                  disabled={isEditOfActive}
                />
                <Label htmlFor="on_transition">Gửi thông báo khi chuyển trạng thái</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="on_completion"
                  {...register('config.notification_rules.on_completion')}
                  disabled={isEditOfActive}
                />
                <Label htmlFor="on_completion">Gửi thông báo khi hoàn thành</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="notify_performer"
                  {...register('config.notification_rules.notify_performer')}
                  disabled={isEditOfActive}
                />
                <Label htmlFor="notify_performer">Thông báo cho người thực hiện</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="notify_creator"
                  {...register('config.notification_rules.notify_creator')}
                  disabled={isEditOfActive}
                />
                <Label htmlFor="notify_creator">Thông báo cho người tạo</Label>
              </div>
            </div>
          </div>

          {/* SLA Config */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Cấu Hình SLA</h3>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="sla_enabled"
                {...register('config.sla_config.enabled')}
                disabled={isEditOfActive}
              />
              <Label htmlFor="sla_enabled">Bật SLA tracking</Label>
            </div>

            {true && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="default_sla_hours">SLA Mặc Định (giờ)</Label>
                  <Input
                    id="default_sla_hours"
                    type="number"
                    {...register('config.sla_config.default_sla_hours', {
                      min: 1,
                      max: 1000,
                    })}
                    disabled={isEditOfActive}
                  />
                </div>

                <div>
                  <Label htmlFor="escalation_threshold_hours">Escalation Threshold (giờ)</Label>
                  <Input
                    id="escalation_threshold_hours"
                    type="number"
                    {...register('config.sla_config.escalation_threshold_hours', {
                      min: 1,
                      max: 2000,
                    })}
                    disabled={isEditOfActive}
                  />
                </div>
              </div>
            )}
          </div>

          {isEditOfActive && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Chú ý:</strong> Không thể chỉnh sửa workflow đang active.
                Vui lòng deactivate workflow trước khi chỉnh sửa.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting || isEditOfActive}>
              {isSubmitting ? 'Đang xử lý...' : modalMode === 'create' ? 'Tạo' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
```

---

### 6.3. WorkflowTransitionMatrix.tsx

**File Path:** `frontend/src/modules/workflow/components/WorkflowTransitionMatrix.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Upload, Download, Save } from 'lucide-react';
import { toast } from '@/hooks/useToast';
import { useWorkflowStore } from '../stores/workflowStore';

interface WorkflowTransitionMatrixProps {
  workflowId?: number;
  processType: string;
}

interface TransitionRow {
  id?: number;
  from_status_code: string;
  from_status_name_vi: string;
  to_status_code: string;
  to_status_name_vi: string;
  allowed_roles: string[];
  is_auto_transition: boolean;
  required_fields: string[];
  sort_order: number;
  is_active: boolean;
  transition_config?: any;
}

export const WorkflowTransitionMatrix: React.FC<WorkflowTransitionMatrixProps> = ({
  workflowId,
  processType,
}) => {
  const [transitions, setTransitions] = useState<TransitionRow[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const { fetchWorkflowDetail, addTransition, updateTransition, removeTransition, bulkImportTransitions } = 
    useWorkflowStore();

  useEffect(() => {
    if (workflowId) {
      loadTransitions(workflowId);
    }
  }, [workflowId]);

  const loadTransitions = async (id: number) => {
    const data = await fetchWorkflowDetail(id);
    setTransitions(data.transitions || []);
  };

  const handleAddRow = () => {
    const newRow: TransitionRow = {
      from_status_code: '',
      from_status_name_vi: '',
      to_status_code: '',
      to_status_name_vi: '',
      allowed_roles: ['all'],
      is_auto_transition: false,
      required_fields: [],
      sort_order: transitions.length * 10,
      is_active: true,
    };
    setTransitions([...transitions, newRow]);
    setIsEditing(true);
  };

  const handleUpdateRow = (index: number, field: keyof TransitionRow, value: any) => {
    const updated = [...transitions];
    updated[index] = { ...updated[index], [field]: value };
    setTransitions(updated);
  };

  const handleDeleteRow = async (index: number) => {
    const row = transitions[index];
    if (row.id) {
      await removeTransition(row.id);
      toast.success('Xóa transition thành công');
    }
    const updated = transitions.filter((_, i) => i !== index);
    setTransitions(updated);
  };

  const handleSave = async () => {
    if (!workflowId) return;

    try {
      for (const row of transitions) {
        if (row.id) {
          await updateTransition(row.id, row);
        } else {
          await addTransition(workflowId, row);
        }
      }
      toast.success('Lưu transitions thành công');
      setIsEditing(false);
      loadTransitions(workflowId);
    } catch (error) {
      toast.error('Lưu transitions thất bại');
    }
  };

  const handleImportExcel = async () => {
    // Implement Excel import
    toast.info('Đang import từ Excel...');
  };

  const handleExportExcel = () => {
    // Implement Excel export
    toast.info('Đang export ra Excel...');
  };

  const canEdit = workflowId && !isEditing;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Ma Trận Chuyển Tiếp</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={!workflowId}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={handleImportExcel} disabled={!workflowId}>
            <Upload className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
          {canEdit ? (
            <Button onClick={handleAddRow}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm Transition
            </Button>
          ) : isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Hủy
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Lưu
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Từ Trạng Thái</TableHead>
              <TableHead>Đến Trạng Thái</TableHead>
              <TableHead>Vai Trò</TableHead>
              <TableHead>Tự Động</TableHead>
              <TableHead>Required Fields</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Hành Động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transitions.map((row, index) => (
              <TableRow key={row.id || index}>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={row.from_status_code}
                      onChange={(e) => 
                        handleUpdateRow(index, 'from_status_code', e.target.value)
                      }
                      placeholder="new_intake"
                    />
                  ) : (
                    <div>
                      <div className="font-medium">{row.from_status_code}</div>
                      <div className="text-sm text-muted-foreground">
                        {row.from_status_name_vi}
                      </div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={row.to_status_code}
                      onChange={(e) => 
                        handleUpdateRow(index, 'to_status_code', e.target.value)
                      }
                      placeholder="assigned_to_receiver"
                    />
                  ) : (
                    <div>
                      <div className="font-medium">{row.to_status_code}</div>
                      <div className="text-sm text-muted-foreground">
                        {row.to_status_name_vi}
                      </div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Select
                      value={row.allowed_roles.join(',')}
                      onValueChange={(value) =>
                        handleUpdateRow(
                          index,
                          'allowed_roles',
                          value.split(',').filter(Boolean)
                        )
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        <SelectItem value="R">Receiver (R)</SelectItem>
                        <SelectItem value="A">Approver (A)</SelectItem>
                        <SelectItem value="R,A">R và A</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-1">
                      {row.allowed_roles.map((role) => (
                        <span
                          key={role}
                          className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Switch
                      checked={row.is_auto_transition}
                      onCheckedChange={(checked) =>
                        handleUpdateRow(index, 'is_auto_transition', checked)
                      }
                    />
                  ) : row.is_auto_transition ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={row.required_fields.join(', ')}
                      onChange={(e) =>
                        handleUpdateRow(
                          index,
                          'required_fields',
                          e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        )
                      }
                      placeholder="performer_user_id, estimated_hours"
                    />
                  ) : (
                    <div className="text-sm">
                      {row.required_fields.join(', ')}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={row.sort_order}
                      onChange={(e) =>
                        handleUpdateRow(index, 'sort_order', parseInt(e.target.value))
                      }
                      className="w-20"
                    />
                  ) : (
                    row.sort_order
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Switch
                      checked={row.is_active}
                      onCheckedChange={(checked) =>
                        handleUpdateRow(index, 'is_active', checked)
                      }
                    />
                  ) : row.is_active ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-gray-400">○</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRow(index)}
                    disabled={!isEditing}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {transitions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Chưa có transitions nào. Click "Thêm Transition" để bắt đầu.
        </div>
      )}
    </Card>
  );
};
```

---

## 7. LOGIC ĐẢM BẢO CHỈ 1 WORKFLOW ACTIVE

### 7.1. Backend Service Implementation

**File Path:** `backend/app/Services/V5/Workflow/WorkflowDefinitionService.php`

```php
/**
 * Activate workflow (auto deactivate others)
 * 
 * @param int $workflowId
 * @return WorkflowDefinition
 * @throws \Exception
 */
public function activateWorkflow(int $workflowId): WorkflowDefinition
{
    return DB::transaction(function () use ($workflowId) {
        $workflow = WorkflowDefinition::findOrFail($workflowId);

        // Step 1: Check if workflow is already active
        if ($workflow->is_active) {
            throw new \Exception('Workflow này đã được kích hoạt');
        }

        // Step 2: Deactivate all other workflows for same process type
        $deactivatedCount = WorkflowDefinition::where('process_type', $workflow->process_type)
            ->where('id', '!=', $workflowId)
            ->whereNull('deleted_at')
            ->update([
                'is_active' => false,
                'deactivated_by' => auth()->id(),
                'deactivated_at' => now(),
                'updated_by' => auth()->id(),
                'updated_at' => now(),
            ]);

        // Step 3: Activate selected workflow
        $workflow->update([
            'is_active' => true,
            'activated_by' => auth()->id(),
            'activated_at' => now(),
            'updated_by' => auth()->id(),
            'updated_at' => now(),
        ]);

        // Step 4: Log audit event
        $this->auditService->recordAuditEvent(
            entityType: 'workflow_definition',
            entityId: $workflow->id,
            action: 'activate',
            details: [
                'process_type' => $workflow->process_type,
                'code' => $workflow->code,
                'name' => $workflow->name,
                'deactivated_count' => $deactivatedCount,
                'deactivated_workflows' => WorkflowDefinition::where('process_type', $workflow->process_type)
                    ->where('is_active', false)
                    ->where('deactivated_at', '>=', now()->subMinute())
                    ->get(['id', 'code', 'name'])
                    ->toArray(),
            ],
            userId: auth()->id()
        );

        return $workflow->fresh();
    });
}
```

### 7.2. Database Constraint (Optional Enhancement)

```sql
-- Partial unique index to ensure only 1 active workflow per process_type
CREATE UNIQUE INDEX idx_unique_active_workflow 
ON workflow_definitions(process_type) 
WHERE is_active = TRUE AND deleted_at IS NULL;
```

### 7.3. Frontend Validation

**File Path:** `frontend/src/modules/workflow/components/WorkflowListView.tsx`

```tsx
const handleActivate = async (workflowId: number) => {
  const workflow = workflows.find(w => w.id === workflowId);
  
  if (!workflow) return;

  // Show confirmation dialog
  const confirmed = window.confirm(
    `⚠️ CẢNH BÁO CHUYỂN ĐỔI WORKFLOW\n\n` +
    `Bạn đang kích hoạt: ${workflow.name} (${workflow.code})\n\n` +
    `❌ Workflow hiện tại sẽ bị VÔ HIỆU HÓA\n\n` +
    `Các yêu cầu đang xử lý sẽ vẫn giữ nguyên workflow cũ.\n` +
    `Chỉ yêu cầu MỚI tạo sẽ áp dụng workflow mới.\n\n` +
    `Bạn có chắc muốn tiếp tục?`
  );

  if (!confirmed) return;

  try {
    await activateWorkflow(workflowId);
    toast.success(
      `Đã kích hoạt workflow ${workflow.name}. ` +
      `Workflow cũ đã bị vô hiệu hóa.`
    );
    fetchActiveWorkflow(processType);
  } catch (error: any) {
    toast.error(error.message || 'Kích hoạt workflow thất bại');
  }
};
```

### 7.4. Warning UI Component

```tsx
// ActiveWorkflowWarning.tsx
export const ActiveWorkflowWarning: React.FC<{
  activeWorkflow: Workflow;
  newWorkflow: Workflow;
}> = ({ activeWorkflow, newWorkflow }) => {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Chuyển Đổi Workflow
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Workflow hiện tại: <strong>{activeWorkflow.name}</strong> sẽ bị vô hiệu hóa
              </li>
              <li>
                Workflow mới: <strong>{newWorkflow.name}</strong> sẽ được kích hoạt
              </li>
              <li>
                Các yêu cầu đang xử lý vẫn giữ nguyên workflow cũ
              </li>
              <li>
                Yêu cầu mới tạo sẽ áp dụng workflow mới
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 8. MIGRATION STRATEGY

### 8.1. Migration Script

**File Path:** `backend/database/migrations/2026_03_28_000001_create_workflow_definitions_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: Create workflow_definitions table
        Schema::create('workflow_definitions', function (Blueprint $table) {
            $table->id();
            
            // Identification
            $table->string('code', 50);
            $table->string('name', 255);
            $table->text('description')->nullable();
            
            // Classification
            $table->string('process_type', 50)->default('customer_request');
            $table->string('workflow_group', 100)->default('default');
            
            // Status & Versioning
            $table->boolean('is_active')->default(false);
            $table->boolean('is_default')->default(false);
            $table->string('version', 20)->default('1.0');
            
            // Configuration
            $table->json('config')->nullable();
            $table->json('metadata')->nullable();
            
            // Audit
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('activated_by')->nullable();
            $table->unsignedBigInteger('deactivated_by')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('deactivated_at')->nullable();
            $table->timestamps();
            $table->timestamp('deleted_at')->nullable();
            
            // Indexes
            $table->unique(['code', 'process_type', 'deleted_at'], 'unique_code_process');
            $table->index(['process_type', 'is_active', 'deleted_at'], 'idx_process_active');
            $table->index(['workflow_group', 'is_active'], 'idx_workflow_group');
            $table->index('version', 'idx_version');
            
            // Foreign Keys
            $table->foreign('created_by')->references('id')->on('internal_users')->onDelete('set null');
            $table->foreign('updated_by')->references('id')->on('internal_users')->onDelete('set null');
            $table->foreign('activated_by')->references('id')->on('internal_users')->onDelete('set null');
            $table->foreign('deactivated_by')->references('id')->on('internal_users')->onDelete('set null');
        });

        // Step 2: Add workflow_definition_id to workflow_transitions
        Schema::table('workflow_transitions', function (Blueprint $table) {
            $table->unsignedBigInteger('workflow_definition_id')
                ->nullable()
                ->after('workflow_group')
                ->comment('FK → workflow_definitions.id');
            
            $table->index(['workflow_definition_id', 'is_active'], 'idx_workflow_definition');
            
            $table->foreign('workflow_definition_id')
                ->references('id')
                ->on('workflow_definitions')
                ->onDelete('cascade');
        });

        // Step 3: Add workflow_definition_id to customer_request_cases (optional)
        Schema::table('customer_request_cases', function (Blueprint $table) {
            $table->unsignedBigInteger('workflow_definition_id')
                ->nullable()
                ->after('current_status_code')
                ->comment('FK → workflow_definitions.id (workflow tại thời điểm tạo)');
            
            $table->index('workflow_definition_id', 'idx_case_workflow');
            
            $table->foreign('workflow_definition_id')
                ->references('id')
                ->on('workflow_definitions')
                ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('customer_request_cases', function (Blueprint $table) {
            $table->dropForeign(['workflow_definition_id']);
            $table->dropIndex('idx_case_workflow');
            $table->dropColumn('workflow_definition_id');
        });

        Schema::table('workflow_transitions', function (Blueprint $table) {
            $table->dropForeign(['workflow_definition_id']);
            $table->dropIndex('idx_workflow_definition');
            $table->dropColumn('workflow_definition_id');
        });

        Schema::dropIfExists('workflow_definitions');
    }
};
```

### 8.2. Data Seeding

**File Path:** `backend/database/seeders/WorkflowDefinitionSeeder.php`

```php
<?php

namespace Database\Seeders;

use App\Models\WorkflowDefinition;
use App\Models\WorkflowTransition;
use Illuminate\Database\Seeder;

class WorkflowDefinitionSeeder extends Seeder
{
    public function run(): void
    {
        // Create default workflow "LUONG_A"
        $workflowA = WorkflowDefinition::create([
            'code' => 'LUONG_A',
            'name' => 'Luồng xử lý A',
            'description' => 'Luồng xử lý tiêu chuẩn cho Customer Request',
            'process_type' => 'customer_request',
            'workflow_group' => 'default',
            'version' => '1.0',
            'is_active' => true,
            'is_default' => true,
            'config' => [
                'notification_rules' => [
                    'on_transition' => true,
                    'on_completion' => true,
                    'notify_performer' => true,
                    'notify_creator' => false,
                ],
                'sla_config' => [
                    'enabled' => false,
                    'default_sla_hours' => 48,
                    'escalation_threshold_hours' => 72,
                ],
            ],
            'metadata' => [
                'created_from' => 'seeder',
                'import_source' => 'existing_transitions',
            ],
            'created_by' => 1, // Admin
            'activated_by' => 1,
            'activated_at' => now(),
        ]);

        // Seed transitions from existing data
        $this->seedTransitions($workflowA);
    }

    protected function seedTransitions(WorkflowDefinition $workflow): void
    {
        $transitions = [
            // Từ new_intake
            [
                'from_status_code' => 'new_intake',
                'from_status_name_vi' => 'Tiếp nhận',
                'to_status_code' => 'assigned_to_receiver',
                'to_status_name_vi' => 'Giao R thực hiện',
                'allowed_roles' => ['all'],
                'required_fields' => ['performer_user_id'],
                'sort_order' => 10,
            ],
            [
                'from_status_code' => 'new_intake',
                'from_status_name_vi' => 'Tiếp nhận',
                'to_status_code' => 'pending_dispatch',
                'to_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'allowed_roles' => ['all'],
                'required_fields' => [],
                'sort_order' => 20,
            ],
            // Từ assigned_to_receiver
            [
                'from_status_code' => 'assigned_to_receiver',
                'from_status_name_vi' => 'Giao R thực hiện',
                'to_status_code' => 'receiver_in_progress',
                'to_status_name_vi' => 'R Đang thực hiện',
                'allowed_roles' => ['R'],
                'required_fields' => [],
                'sort_order' => 30,
            ],
            // Add more transitions...
        ];

        foreach ($transitions as $transition) {
            WorkflowTransition::create(array_merge($transition, [
                'workflow_definition_id' => $workflow->id,
                'process_type' => $workflow->process_type,
                'workflow_group' => $workflow->workflow_group,
                'is_auto_transition' => false,
                'is_active' => true,
                'created_by' => 1,
            ]));
        }
    }
}
```

### 8.3. Migration Command

```bash
# Run migration
php artisan migrate

# Seed default data
php artisan db:seed --class=WorkflowDefinitionSeeder

# Verify
php artisan tinker
>>> App\Models\WorkflowDefinition::count()
>>> App\Models\WorkflowTransition::where('workflow_definition_id', 1)->count()
```

---

## 9. PERMISSION & AUTHORIZATION

### 9.1. Permission Definitions

**File Path:** `backend/database/seeders/PermissionSeeder.php`

```php
$permissions = [
    // Workflow Management
    'workflow.view' => 'Xem danh sách workflow',
    'workflow.create' => 'Tạo workflow mới',
    'workflow.update' => 'Chỉnh sửa workflow',
    'workflow.delete' => 'Xóa workflow',
    'workflow.activate' => 'Kích hoạt workflow',
    'workflow.deactivate' => 'Vô hiệu hóa workflow',
    'workflow.transition.manage' => 'Quản lý transitions',
    'workflow.transition.import' => 'Import transitions từ Excel',
    'workflow.transition.export' => 'Export transitions ra Excel',
];
```

### 9.2. Role Requirements

| Action | Required Permission | Role |
|--------|---------------------|------|
| View workflows | `workflow.view` | All authenticated users |
| Create workflow | `workflow.create` | Admin, Manager |
| Edit workflow | `workflow.update` | Admin, Manager |
| Activate workflow | `workflow.activate` | Admin only |
| Deactivate workflow | `workflow.deactivate` | Admin only |
| Delete workflow | `workflow.delete` | Admin only |
| Manage transitions | `workflow.transition.manage` | Admin, Manager |
| Import transitions | `workflow.transition.import` | Admin only |

### 9.3. Middleware Implementation

**File Path:** `backend/app/Http/Middleware/EnsureWorkflowPermission.php`

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureWorkflowPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        if (!$user->hasPermission($permission)) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => 'Bạn không có quyền thực hiện hành động này'
            ], 403);
        }

        return $next($request);
    }
}
```

### 9.4. Route Protection

**File Path:** `backend/routes/api.php`

```php
// Workflow Definitions Routes
Route::middleware(['auth:sanctum', 'ensure.permission:workflow.view'])
    ->get('/workflow-definitions', [WorkflowDefinitionController::class, 'index']);

Route::middleware(['auth:sanctum', 'ensure.permission:workflow.view'])
    ->get('/workflow-definitions/{id}', [WorkflowDefinitionController::class, 'show']);

Route::middleware(['auth:sanctum', 'ensure.permission:workflow.create'])
    ->post('/workflow-definitions', [WorkflowDefinitionController::class, 'store']);

Route::middleware(['auth:sanctum', 'ensure.permission:workflow.update'])
    ->put('/workflow-definitions/{id}', [WorkflowDefinitionController::class, 'update']);

Route::middleware(['auth:sanctum', 'ensure.permission:workflow.activate'])
    ->post('/workflow-definitions/{id}/activate', [WorkflowDefinitionController::class, 'activate']);

Route::middleware(['auth:sanctum', 'ensure.permission:workflow.deactivate'])
    ->post('/workflow-definitions/{id}/deactivate', [WorkflowDefinitionController::class, 'deactivate']);

Route::middleware(['auth:sanctum', 'ensure.permission:workflow.delete'])
    ->delete('/workflow-definitions/{id}', [WorkflowDefinitionController::class, 'destroy']);

// Workflow Transitions Routes
Route::middleware(['auth:sanctum', 'ensure.permission:workflow.view'])
    ->get('/workflow-definitions/{id}/transitions', [WorkflowTransitionController::class, 'index']);

Route::middleware(['auth:sanctum', 'ensure.permission:workflow.transition.manage'])
    ->post('/workflow-definitions/{id}/transitions', [WorkflowTransitionController::class, 'store']);

Route::middleware(['auth:sanctum', 'ensure.permission:workflow.transition.manage'])
    ->put('/workflow-transitions/{id}', [WorkflowTransitionController::class, 'update']);

Route::middleware(['auth:sanctum', 'ensure.permission:workflow.transition.manage'])
    ->delete('/workflow-transitions/{id}', [WorkflowTransitionController::class, 'destroy']);

Route::middleware(['auth:sanctum', 'ensure.permission:workflow.transition.import'])
    ->post('/workflow-definitions/{id}/transitions/bulk-import', [WorkflowTransitionController::class, 'bulkImport']);
```

---

## 10. AUDIT LOGGING

### 10.1. Audit Event Types

| Event Type | Entity | Action | Details |
|------------|--------|--------|---------|
| `workflow_definition.create` | workflow_definition | create | code, name, process_type |
| `workflow_definition.update` | workflow_definition | update | changed_fields |
| `workflow_definition.activate` | workflow_definition | activate | deactivated_workflows |
| `workflow_definition.deactivate` | workflow_definition | deactivate | reason |
| `workflow_definition.delete` | workflow_definition | delete | code, name |
| `workflow_transition.create` | workflow_transition | create | from_status, to_status |
| `workflow_transition.update` | workflow_transition | update | changed_fields |
| `workflow_transition.delete` | workflow_transition | delete | from_status, to_status |
| `workflow_transition.bulk_import` | workflow_definition | bulk_import_transitions | stats |

### 10.2. Audit Service Integration

**File Path:** `backend/app/Services/V5/Support/AuditService.php`

```php
/**
 * Record audit event for workflow changes
 */
public function recordWorkflowAuditEvent(
    string $entityType,
    int $entityId,
    string $action,
    array $details,
    ?int $userId = null
): void {
    $this->recordAuditEvent(
        entityType: $entityType,
        entityId: $entityId,
        action: $action,
        details: $this->sanitizeDetails($details),
        userId: $userId ?? auth()->id(),
        ipAddress: request()->ip(),
        userAgent: request()->userAgent()
    );
}

/**
 * Sanitize sensitive details
 */
protected function sanitizeDetails(array $details): array
{
    // Remove sensitive fields if any
    $sensitiveFields = ['password', 'token', 'secret'];
    
    foreach ($sensitiveFields as $field) {
        if (isset($details[$field])) {
            $details[$field] = '[REDACTED]';
        }
    }
    
    return $details;
}
```

### 10.3. Audit Log Query Examples

```sql
-- Get all workflow activation events
SELECT 
    ae.entity_id,
    ae.action,
    ae.details,
    u.full_name as performed_by,
    ae.created_at
FROM audit_events ae
JOIN internal_users u ON ae.user_id = u.id
WHERE ae.entity_type = 'workflow_definition'
  AND ae.action = 'activate'
ORDER BY ae.created_at DESC;

-- Get transition changes for specific workflow
SELECT 
    ae.entity_id,
    ae.action,
    ae.details,
    ae.created_at
FROM audit_events ae
WHERE ae.entity_type = 'workflow_transition'
  AND JSON_EXTRACT(ae.details, '$.workflow_definition_id') = 1
ORDER BY ae.created_at DESC;
```

---

## PHỤ LỤC

### Phụ Lục A: Sample Excel Format for Bulk Import

| from_status_code | from_status_name_vi | to_status_code | to_status_name_vi | allowed_roles | is_auto_transition | required_fields | sort_order | is_active | transition_config |
|------------------|---------------------|----------------|-------------------|---------------|-------------------|-----------------|------------|-----------|-------------------|
| new_intake | Tiếp nhận | assigned_to_receiver | Giao R thực hiện | ["all"] | false | ["performer_user_id"] | 10 | true | {"notifications":{"send_email":true}} |
| new_intake | Tiếp nhận | pending_dispatch | Giao PM/Trả YC cho PM | ["all"] | false | [] | 20 | true | null |
| assigned_to_receiver | Giao R thực hiện | receiver_in_progress | R Đang thực hiện | ["R"] | false | [] | 30 | true | null |

**Notes:**
- `allowed_roles`: JSON array string
- `required_fields`: JSON array string
- `transition_config`: JSON object string (optional)
- `is_auto_transition`: boolean (true/false)
- `is_active`: boolean (true/false)

---

### Phụ Lục B: API Request/Response Samples

#### Sample: Activate Workflow

**Request:**
```http
POST /api/v5/workflow-definitions/2/activate
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOi...
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "data": {
    "id": 2,
    "code": "LUONG_B",
    "name": "Luồng xử lý B",
    "is_active": true,
    "activated_at": "2026-03-28T14:30:00+07:00",
    "activated_by": 1
  },
  "meta": {
    "message": "Kích hoạt workflow thành công",
    "deactivated_workflows": [
      {
        "id": 1,
        "code": "LUONG_A",
        "name": "Luồng xử lý A",
        "deactivated_at": "2026-03-28T14:30:00+07:00"
      }
    ],
    "audit_logged": true
  }
}
```

---

### Phụ Lục C: Error Codes

| Code | Message | HTTP Status |
|------|---------|-------------|
| `WORKFLOW_NOT_FOUND` | Không tìm thấy workflow | 404 |
| `WORKFLOW_ALREADY_ACTIVE` | Workflow đã được kích hoạt | 400 |
| `WORKFLOW_IS_ACTIVE` | Không thể thực hiện trên workflow đang active | 400 |
| `WORKFLOW_HAS_TRANSITIONS` | Phải xóa hết transitions trước | 400 |
| `TRANSITION_NOT_FOUND` | Không tìm thấy transition | 404 |
| `INVALID_TRANSITION` | Transition không hợp lệ | 422 |
| `PERMISSION_DENIED` | Bạn không có quyền thực hiện | 403 |
| `VALIDATION_FAILED` | Validation failed | 422 |
| `MUST_HAVE_ACTIVE_WORKFLOW` | Phải có ít nhất 1 workflow active | 400 |

---

### Phụ Lục D: File Paths Reference

| Component | File Path |
|-----------|-----------|
| **Models** | |
| WorkflowDefinition | `backend/app/Models/WorkflowDefinition.php` |
| WorkflowTransition | `backend/app/Models/WorkflowTransition.php` |
| **Services** | |
| WorkflowDefinitionService | `backend/app/Services/V5/Workflow/WorkflowDefinitionService.php` |
| WorkflowTransitionService | `backend/app/Services/V5/Workflow/WorkflowTransitionService.php` |
| **Controllers** | |
| WorkflowDefinitionController | `backend/app/Http/Controllers/V5/WorkflowDefinitionController.php` |
| WorkflowTransitionController | `backend/app/Http/Controllers/V5/WorkflowTransitionController.php` |
| **Frontend Components** | |
| WorkflowManagementHub | `frontend/src/modules/workflow/components/WorkflowManagementHub.tsx` |
| WorkflowDefinitionModal | `frontend/src/modules/workflow/components/WorkflowDefinitionModal.tsx` |
| WorkflowTransitionMatrix | `frontend/src/modules/workflow/components/WorkflowTransitionMatrix.tsx` |
| **Store** | |
| workflowStore | `frontend/src/modules/workflow/stores/workflowStore.ts` |
| **Migrations** | |
| Create workflow_definitions | `backend/database/migrations/2026_03_28_000001_create_workflow_definitions_table.php` |
| **Seeders** | |
| WorkflowDefinitionSeeder | `backend/database/seeders/WorkflowDefinitionSeeder.php` |

---

## TÀI LIỆU THAM KHẢO

1. `plan-code/Dieu_chinh_ql_yc_khach_hang/luong_xu_ly_QL_YC_khach_hang.md` - Luồng xử lý QL yêu cầu khách hàng
2. `plan-code/Dieu_chinh_ql_yc_khach_hang/QUY_TRINH_TAO_VA_CHUYEN_YC.md` - Quy trình tạo và chuyển yêu cầu
3. `QWEN.md` - Project overview và conventions
4. `CLAUDE.md` - Architecture documentation

---

**END OF DOCUMENT**
