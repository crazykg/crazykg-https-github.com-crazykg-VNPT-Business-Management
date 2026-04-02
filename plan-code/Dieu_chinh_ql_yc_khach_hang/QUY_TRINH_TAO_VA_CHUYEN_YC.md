# QUY TRÌNH TẠO VÀ CHUYỂN YÊU CẦU KHÁCH HÀNG

**Version:** 1.1
**Ngày cập nhật:** 2026-03-28
**Phạm vi:** Customer Request Management (CRC)
**Trạng thái:** Approved

---

## 📋 MỤC LỤC

0. [Cấu Hình Động Workflow](#cấu-hình-động-workflow)
1. [Tổng quan](#tổng-quan)
2. [Bước 1: Tạo mới yêu cầu](#bước-1-tạo-mới-yêu-cầu-trạng-thái-new_intake)
3. [Bước 2: Chỉnh sửa thông tin](#bước-2-chỉnh-sửa-thông-tin-trạng-thái-new_intake)
4. [Bước 3: Chọn bước tiếp theo để chuyển trạng thái](#bước-3-chọn-bước-tiếp-theo-để-chuyển-trạng-thái)
5. [Bước 4: Hệ thống tự động lấy danh sách người nhận theo RACI](#bước-4-hệ-thống-tự-động-lấy-danh-sách-người-nhận-theo-raci)
6. [Bước 5: Xác nhận và thực hiện chuyển trạng thái](#bước-5-xác-nhận-và-thực-hiện-chuyển-trạng-thái)
7. [Sơ đồ luồng xử lý](#sơ-đồ-luồng-xử-lý)
8. [API Reference](#api-reference)
9. [Component Reference](#component-reference)

---

## CẤU HÌNH ĐỘNG WORKFLOW

### 0.1. Tổng Quan về Multi-Workflow Support

Hệ thống hỗ trợ **cấu hình động nhiều luồng workflow** (multi-workflow) cho Customer Request Management. Xem chi tiết tại [`CAU_HINH_DONG_LUONG_YC.md`](./CAU_HINH_DONG_LUONG_YC.md).

**Tính năng chính:**
- ✅ Định nghĩa nhiều workflow cho cùng một process type
- ✅ Kích hoạt/vô hiệu hóa workflow từ Admin UI
- ✅ Chỉ 1 workflow active tại một thời điểm
- ✅ Import/export ma trận transitions từ Excel

### 0.2. Workflow Definition

| Concept | Mô tả |
|---------|-------|
| **Workflow Definition** | Định nghĩa một luồng xử lý hoàn chỉnh với code, name, version |
| **Workflow Transition** | Quy tắc chuyển tiếp giữa 2 trạng thái trong workflow |
| **Active Workflow** | Workflow đang được áp dụng cho các yêu cầu mới |
| **Process Type** | Loại quy trình: `customer_request`, `project_procedure`, `document_approval` |

### 0.3. Database Schema

#### `workflow_definitions` Table

```sql
CREATE TABLE workflow_definitions (
    id BIGINT PRIMARY KEY,
    code VARCHAR(50) NOT NULL,           -- LUONG_A, LUONG_B
    name VARCHAR(255) NOT NULL,           -- Luồng xử lý A
    process_type VARCHAR(50) NOT NULL,    -- customer_request
    is_active BOOLEAN DEFAULT FALSE,      -- Chỉ 1 active per process_type
    version VARCHAR(20) DEFAULT '1.0',
    config JSON,                          -- Notification, SLA config
    created_by BIGINT,
    activated_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL
);
```

#### `workflow_transitions` Table (Updated)

```sql
ALTER TABLE workflow_transitions 
ADD COLUMN workflow_definition_id BIGINT;
-- FK → workflow_definitions.id
```

### 0.4. Workflow Selection Logic

#### Khi Tạo Yêu Cầu Mới

```typescript
// Get active workflow for process_type
const activeWorkflow = await fetchActiveWorkflow('customer_request');

// Create request with workflow_definition_id
const newRequest = await createRequest({
  ...requestData,
  workflow_definition_id: activeWorkflow.id, // ✅ NEW
  current_status_code: 'new_intake',
});
```

#### Khi Lấy Transitions

```typescript
// Get transitions for active workflow
const transitions = await fetchTransitions({
  workflow_definition_id: activeWorkflow.id, // ✅ NEW
  from_status_code: currentStatusCode,
});
```

### 0.5. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v5/workflow-definitions` | GET | List workflows by process_type |
| `/api/v5/workflow-definitions/{id}` | GET | Get workflow detail with transitions |
| `/api/v5/workflow-definitions` | POST | Create new workflow |
| `/api/v5/workflow-definitions/{id}/activate` | POST | Activate workflow (auto deactivate others) |
| `/api/v5/workflow-definitions/{id}/transitions` | GET | Get transitions for workflow |
| `/api/v5/workflow-definitions/{id}/transitions/bulk-import` | POST | Import transitions from Excel |

### 0.6. Admin UI Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  WORKFLOW MANAGEMENT (Admin Only)                               │
├─────────────────────────────────────────────────────────────────┤
│  [Danh sách workflows]                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Code    │ Name          │ Version │ Active │ Actions     │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ LUONG_A │ Luồng xử lý A │ 1.0     │ ✓      │ [Deactivate]│  │
│  │ LUONG_B │ Luồng xử lý B │ 1.0     │ ○      │ [Activate]  │  │
│  │ DEV_FLOW│ Luồng Dev     │ 2.0     │ ○      │ [Activate]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Tạo Workflow Mới]  [Import từ Excel]  [Export ra Excel]       │
└─────────────────────────────────────────────────────────────────┘
```

### 0.7. Transition Matrix Editor

```
┌─────────────────────────────────────────────────────────────────┐
│  MA TRẬN CHUYỂN TIẾP - LUỒNG A                                  │
├─────────────────────────────────────────────────────────────────┤
│  From Status      │ To Status        │ Roles │ Auto │ Required │
│  ─────────────────┼──────────────────┼───────┼──────┼──────────┤
│  Tiếp nhận        │ Giao R thực hiện │ all   │  ✗   │ performer│
│  Tiếp nhận        │ Giao PM/PM       │ all   │  ✗   │ -        │
│  Giao R thực hiện │ R Đang thực hiện │ R     │  ✗   │ -        │
│  ...              │ ...              │ ...   │ ...  │ ...      │
│                                                                  │
│  [+ Thêm]  [Lưu]  [Import Excel]  [Export Excel]                │
└─────────────────────────────────────────────────────────────────┘
```

### 0.8. Migration from Legacy

#### Step 1: Run Migration

```bash
php artisan migrate
# Creates: workflow_definitions table
# Updates: workflow_transitions (add workflow_definition_id)
```

#### Step 2: Seed Default Workflow

```bash
php artisan db:seed --class=WorkflowDefinitionSeeder
# Creates: LUONG_A workflow with existing transitions
# Sets: is_active = true
```

#### Step 3: Update Existing Requests

```sql
-- Assign active workflow to existing requests
UPDATE customer_request_cases crc
JOIN workflow_definitions wd ON wd.process_type = 'customer_request' 
  AND wd.is_active = TRUE
SET crc.workflow_definition_id = wd.id
WHERE crc.workflow_definition_id IS NULL;
```

### 0.9. Impact on Existing Flow

| Area | Before | After |
|------|--------|-------|
| **Create Request** | No workflow_id | `workflow_definition_id` = active workflow |
| **Get Transitions** | From `workflow_transitions` (global) | From `workflow_transitions` filtered by `workflow_definition_id` |
| **Transition Validation** | Check `from → to` | Check `workflow_id + from → to` |
| **Admin UI** | N/A | Workflow Management Hub |

### 0.10. Best Practices

1. **Always use active workflow** for new requests
2. **Cannot edit** active workflow transitions
3. **Deactivate before editing** workflow details
4. **Backup before switching** workflows (export to Excel)
5. **Test in staging** before activating new workflow in production

---

## TỔNG QUAN

### Mục Đích

Tài liệu này mô tả chi tiết quy trình 5 bước để tạo và chuyển yêu cầu khách hàng trong hệ thống VNPT Business Management, từ khi tiếp nhận ban đầu đến khi giao việc cho người thực hiện.

**Cập nhật phiên bản 1.1:** Bổ sung hỗ trợ multi-workflow với cấu hình động từ Admin UI.

### Phạm Vi Áp Dụng

- **Module:** Customer Request Management (CRC)
- **Đối tượng:** Creator, Dispatcher (PM), Receiver, Performer
- **Trạng thái bắt đầu:** `new_intake` (Mới tiếp nhận)
- **Workflow:** Sử dụng workflow đang active cho process_type `customer_request`

### Nguyên Tắc Thiết Kế

| Nguyên tắc | Mô tả |
|------------|-------|
| ✅ **Không chọn hướng xử lý khi tạo** | `dispatch_route = NULL` khi tạo mới |
| ✅ **Phân công theo RACI** | Load user từ `project_raci_assignments` theo vai trò |
| ✅ **Transition cấu hình backend** | Danh sách bước tiếp theo lấy từ `workflow_transitions` |
| ✅ **Validation theo role** | Kiểm tra `allowed_roles` trước khi cho phép chuyển |
| ✅ **Multi-workflow support** | Chỉ 1 workflow active per process_type |
| ✅ **Workflow-aware transitions** | Filter transitions by `workflow_definition_id` |

---

## BƯỚC 1: TẠO MỚI YÊU CẦU (TRẠNG THÁI: `new_intake`)

### 1.1. Người Dùng Mở Modal Tạo Mới

| Thuộc tính | Giá trị |
|------------|---------|
| **Component** | `CustomerRequestCreateModal.tsx` |
| **Trigger** | Nút "Thêm yêu cầu" trong CustomerRequestManagementHub |
| **Người dùng** | Creator (`received_by_user_id`) |
| **Permission** | Tất cả người dùng có quyền tạo CRC |

### 1.2. Nhập Thông Tin Bắt Buộc

#### Các Trường Thông Tin

| Trường | Database Column | Bắt Buộc | Ghi Chú |
|--------|-----------------|----------|---------|
| Khách hàng | `customer_id` | ✅ | FK → `customers.id` |
| Người liên hệ | `customer_personnel_id` | ✅ | FK → `customer_personnels.id` |
| Nhóm dịch vụ | `support_service_group_id` | ✅ | FK → `support_service_groups.id` |
| Tiêu đề | `title` | ✅ | Max 255 ký tự |
| Mô tả | `description` | ✅ | Text, hỗ trợ Markdown |
| Dự án | `project_id` | ❌ | FK → `project_items.id` |
| Độ ưu tiên | `priority` | ❌ | Default: 3 (1=Cao nhất, 4=Thấp nhất) |
| Đính kèm | `attachments` | ❌ | Multiple files, max 10MB/file |

#### Validation Rules

```typescript
interface CreateRequestPayload {
  customer_id: number;           // required
  customer_personnel_id: number; // required
  support_service_group_id: number; // required
  title: string;                 // required, max 255
  description: string;           // required
  project_id?: number | null;    // optional
  priority?: number;             // optional, default 3, range 1-4
  attachments?: File[];          // optional, max 10 files
}
```

### 1.3. ⚠️ KHÔNG Chọn "Hướng Xử Lý" (dispatch_route)

#### Thay Đổi Thiết Kế

| Trước | Sau |
|-------|-----|
| ❌ Có ô chọn `dispatch_route` trong modal | ✅ **XÓA** ô chọn `dispatch_route` |
| ❌ Người dùng phải chọn hướng xử lý ngay | ✅ `dispatch_route = NULL` khi tạo mới |
| ❌ Trạng thái phụ thuộc vào selection | ✅ Trạng thái mặc định: `new_intake` |

#### Lý Do Thiết Kế

1. **Giảm độ phức tạp:** Người tạo chỉ cần nhập thông tin cơ bản
2. **Tránh sai sót:** Không bắt người tạo quyết định khi thiếu thông tin
3. **Linh hoạt điều phối:** PM/người có thẩm quyền sẽ quyết định sau
4. **Dễ thay đổi:** Có thể điều phối lại mà không cần modify request

### 1.4. Lưu Yêu Cầu Mới

#### API Endpoint

```
POST /api/v5/customer-request-cases
```

#### Backend Handler

| Lớp | File | Method |
|-----|------|--------|
| **Controller** | `CustomerRequestCaseController.php` | `store()` |
| **Domain Service** | `CustomerRequestCaseDomainService.php` | `create()` |
| **Write Service** | `CustomerRequestCaseWriteService.php` | `store()` |

#### Kết Quả Trả Về

```json
{
  "data": {
    "id": 1234,
    "request_code": "CRC-202603-0042",
    "customer_id": 567,
    "customer_personnel_id": 890,
    "support_service_group_id": 12,
    "title": "Yêu cầu hỗ trợ tích hợp API",
    "description": "Mô tả chi tiết yêu cầu...",
    "priority": 3,
    "current_status_code": "new_intake",
    "received_by_user_id": 1,
    "dispatcher_user_id": null,
    "performer_user_id": null,
    "dispatch_route": null,
    "project_id": null,
    "created_at": "2026-03-28T10:30:00+07:00",
    "updated_at": "2026-03-28T10:30:00+07:00"
  }
}
```

#### Auto-Generated Fields

| Field | Format | Mô tả |
|-------|--------|-------|
| `request_code` | `CRC-YYYYMM-NNNN` | Mã yêu cầu tự động, unique |
| `current_status_code` | `new_intake` | Trạng thái mặc định |
| `received_by_user_id` | User ID | ID người tạo (từ auth session) |
| `dispatch_route` | `NULL` | Chưa xác định hướng xử lý |

### 1.5. Visibility Sau Khi Tạo

#### Người Có Thể Xem Yêu Cầu

| Vai trò | Điều kiện | Access Level |
|---------|-----------|--------------|
| ✅ Người tạo | `created_by = user_id` | Full access |
| ✅ Người được giao nhận | `received_by_user_id = user_id` | Full access |
| ✅ Thành viên dự án | `project_raci_assignments` theo `project_id` | Theo RACI role |

#### Query Visibility

```sql
SELECT crc.*
FROM customer_request_cases crc
LEFT JOIN project_raci_assignments pra 
  ON pra.project_item_id = crc.project_id 
  AND pra.user_id = :current_user_id
WHERE crc.created_by = :current_user_id
   OR crc.received_by_user_id = :current_user_id
   OR pra.id IS NOT NULL;
```

---

## BƯỚC 2: CHỈNH SỬA THÔNG TIN (TRẠNG THÁI: `new_intake`)

### 2.1. Người Dùng Có Quyền Chỉnh Sửa

| Vai trò | Field Check | Access |
|---------|-------------|--------|
| ✅ Người tạo | `created_by = user_id` | Full edit |
| ✅ Người được giao nhận | `received_by_user_id = user_id` | Full edit |
| ❌ Người khác | - | Read-only (nếu có permission) |

### 2.2. Các Trường Có Thể Chỉnh Sửa

#### Core Fields

| Trường | Database Column | Editable | Validation |
|--------|-----------------|----------|------------|
| Khách hàng | `customer_id` | ✅ | FK validation |
| Người liên hệ | `customer_personnel_id` | ✅ | FK validation, must belong to customer |
| Nhóm dịch vụ | `support_service_group_id` | ✅ | FK validation |
| Tiêu đề | `title` | ✅ | Required, max 255 |
| Mô tả | `description` | ✅ | Required |
| Dự án | `project_id` | ✅ | FK validation, nullable |
| Độ ưu tiên | `priority` | ✅ | Range 1-4 |

#### Custom Fields Theo Status

Các trường động được cấu hình trong `status_definitions['new_intake'].form_fields`:

```json
{
  "status_code": "new_intake",
  "form_fields": [
    {"field_code": "customer_id", "required": true, "editable": true},
    {"field_code": "customer_personnel_id", "required": true, "editable": true},
    {"field_code": "support_service_group_id", "required": true, "editable": true},
    {"field_code": "title", "required": true, "editable": true},
    {"field_code": "description", "required": true, "editable": true},
    {"field_code": "project_id", "required": false, "editable": true},
    {"field_code": "priority", "required": false, "editable": true}
  ]
}
```

### 2.3. API Cập Nhật

#### Endpoint

```
PUT /api/v5/customer-request-cases/{id}
```

#### Backend Handler

| Lớp | File | Method |
|-----|------|--------|
| **Controller** | `CustomerRequestCaseController.php` | `update()` |
| **Domain Service** | `CustomerRequestCaseDomainService.php` | `update()` |
| **Write Service** | `CustomerRequestCaseWriteService.php` | `update()` |

#### Request Payload

```json
{
  "customer_id": 567,
  "customer_personnel_id": 890,
  "support_service_group_id": 12,
  "title": "Cập nhật tiêu đề yêu cầu",
  "description": "Cập nhật mô tả chi tiết...",
  "project_id": 45,
  "priority": 2
}
```

#### Response

```json
{
  "data": {
    "id": 1234,
    "request_code": "CRC-202603-0042",
    "updated_at": "2026-03-28T11:15:00+07:00",
    "updated_by": 1
  },
  "meta": {
    "audit_logged": true
  }
}
```

#### Audit Logging

Backend tự động ghi audit log khi cập nhật:

```php
$this->auditService->recordAuditEvent(
    entityType: 'customer_request_case',
    entityId: $case->id,
    action: 'update',
    changes: $request->only($fillableFields),
    userId: auth()->id()
);
```

---

## BƯỚC 3: CHỌN BƯỚC TIẾP THEO ĐỂ CHUYỂN TRẠNG THÁI

### 3.1. Người Dùng Mở Modal Chuyển Trạng Thái

| Thuộc tính | Giá trị |
|------------|---------|
| **Component** | `CustomerRequestTransitionModal.tsx` |
| **Trigger** | Nút "Chuyển trạng thái" trong detail view |
| **Context** | CustomerRequestDetailPane |
| **Permission** | Theo `allowed_roles` từ workflow config |

### 3.2. Hệ Thống Xác Định Các Bước Tiếp Theo Hợp Lệ

#### API Lấy Transitions

```
GET /api/v5/customer-request-cases/{id}/transitions
```

#### Backend Handler

| Lớp | File | Method |
|-----|------|--------|
| **Controller** | `CustomerRequestCaseController.php` | `transitions()` |
| **Domain Service** | `CustomerRequestCaseDomainService.php` | `statusTransitions()` |
| **Workflow Service** | `WorkflowTransitionService.php` | `getAvailableTransitions()` |

#### Response Format

```json
{
  "data": [
    {
      "to_status_code": "assigned_to_receiver",
      "to_status_name": "Giao R thực hiện",
      "to_status_name_vi": "Giao R thực hiện",
      "allowed_roles": ["all"],
      "is_auto_transition": false,
      "required_fields": ["performer_user_id", "estimated_hours"]
    },
    {
      "to_status_code": "pending_dispatch",
      "to_status_name": "Giao PM/Trả YC cho PM",
      "to_status_name_vi": "Giao PM/Trả YC cho PM",
      "allowed_roles": ["all"],
      "is_auto_transition": false,
      "required_fields": []
    }
  ],
  "meta": {
    "from_status_code": "new_intake",
    "from_status_name": "Tiếp nhận",
    "total_transitions": 2
  }
}
```

#### Query Backend

```sql
SELECT 
    to_status_code,
    to_status_name_vi,
    allowed_roles,
    is_auto_transition,
    sort_order
FROM workflow_transitions
WHERE from_status_code = 'new_intake'
  AND is_active = TRUE
ORDER BY sort_order;
```

### 3.3. Người Dùng Chọn Trạng Thái Tiếp Theo

#### UI Component

```tsx
// CustomerRequestTransitionModal.tsx
<Select
  label="Bước tiếp theo"
  options={transitions.map(t => ({
    value: t.to_status_code,
    label: t.to_status_name_vi
  }))}
  onChange={(toStatusCode) => {
    setSelectedTransition(toStatusCode);
    loadRequiredFields(toStatusCode);
    loadAllowedUsers(toStatusCode);
  }}
/>
```

#### Ví Dụ Options

| Value | Label | Allowed Roles |
|-------|-------|---------------|
| `assigned_to_receiver` | Giao R thực hiện | `["all"]` |
| `pending_dispatch` | Giao PM/Trả YC cho PM | `["all"]` |

#### Validation

- ✅ Chỉ hiển thị transitions hợp lệ từ status hiện tại
- ✅ Filter theo role của người dùng hiện tại
- ✅ Highlight required fields sau khi chọn

---

## BƯỚC 4: HỆ THỐNG TỰ ĐỘNG LẤY DANH SÁCH NGƯỜI NHẬN THEO RACI

### 4.1. Xác Định "Task Nhận" và "Task Tiếp Theo"

| Biến | Giá trị | Nguồn |
|------|---------|-------|
| `from_task_code` | `current_status_code` | `customer_request_cases.current_status_code` |
| `to_task_code` | `selected_status_code` | User selection từ Bước 3 |

### 4.2. Query workflow_transitions Để Lấy allowed_roles

#### SQL Query

```sql
SELECT allowed_roles 
FROM workflow_transitions
WHERE from_status_code = :from_task_code
  AND to_status_code = :to_task_code
  AND is_active = 1
LIMIT 1;
```

#### Ví Dụ Kết Quả

```json
{
  "allowed_roles": ["R"]
}
```

### 4.3. allowed_roles Có Các Giá Trị

| Giá trị | Ý nghĩa | Filter Logic |
|---------|---------|--------------|
| `["R"]` | Chỉ Receiver | `WHERE raci_role = 'R'` |
| `["A"]` | Chỉ Approver/Dispatcher | `WHERE raci_role = 'A'` |
| `["all"]` | Tất cả thành viên dự án | No filter |
| `["R", "A"]` | Cả R và A | `WHERE raci_role IN ('R', 'A')` |

### 4.4. Lấy Danh Sách User Từ project_raci_assignments

#### API Endpoint

```
GET /api/v5/projects/{project_id}/raci-users?roles={R|A|all}
```

#### Backend Handler

| Lớp | File | Method |
|-----|------|--------|
| **Controller** | `ProjectRaciController.php` | `raciUsers()` |
| **Service** | `ProjectRaciService.php` | `getUsersByRoles()` |

#### Query Logic

```php
public function raciUsers(int $projectId, Request $request): JsonResponse
{
    $roles = $request->get('roles', 'all');
    $roleArray = $roles === 'all' ? ['R', 'A', 'C', 'I'] : explode(',', $roles);

    $query = DB::table('project_raci_assignments')
        ->join('internal_users', 'project_raci_assignments.user_id', '=', 'internal_users.id')
        ->where('project_raci_assignments.project_item_id', $projectId)
        ->whereIn('project_raci_assignments.raci_role', $roleArray);

    $users = $query->select(
        'internal_users.id',
        'internal_users.full_name',
        'internal_users.user_code',
        'internal_users.email',
        'project_raci_assignments.raci_role'
    )->get();

    return response()->json(['data' => $users]);
}
```

#### Response Format

```json
{
  "data": [
    {
      "id": 123,
      "full_name": "Nguyễn Văn A",
      "user_code": "NV001",
      "email": "a@example.com",
      "raci_role": "R"
    },
    {
      "id": 456,
      "full_name": "Trần Thị B",
      "user_code": "TB002",
      "email": "b@example.com",
      "raci_role": "A"
    }
  ],
  "meta": {
    "project_id": 45,
    "roles_filter": ["R"],
    "total": 2
  }
}
```

### 4.5. Hiển Thị Dropdown Chọn Người Nhận

#### UI Component

```tsx
// CustomerRequestTransitionModal.tsx
import { SearchableSelect } from '@/components/ui';

<SearchableSelect
  label="Người thực hiện"
  placeholder="Tìm kiếm theo tên hoặc mã..."
  options={users.map(u => ({
    value: u.id,
    label: `${u.full_name} · ${u.user_code}`,
    description: u.email
  }))}
  value={selectedUserId}
  onChange={(userId) => setSelectedUserId(userId)}
  required={requiredFields.includes('performer_user_id')}
/>
```

#### Label Format

```
{full_name} · {user_code}
```

**Ví dụ:** `Nguyễn Văn A · NV001`

#### Empty State

```tsx
{users.length === 0 && (
  <EmptyState 
    message="Không tìm thấy người dùng phù hợp"
    description="Vui lòng kiểm tra cấu hình RACI của dự án"
  />
)}
```

---

## BƯỚC 5: XÁC NHẬN VÀ THỰC HIỆN CHUYỂN TRẠNG THÁI

### 5.1. Người Dùng Điền Các Trường Bắt Buộc Theo Status Mới

#### Dynamic Form Fields

Các trường được cấu hình trong `status_definitions[to_status_code].form_fields`:

```typescript
interface StatusDefinition {
  status_code: string;
  form_fields: {
    field_code: string;
    required: boolean;
    field_type: 'text' | 'number' | 'select' | 'user' | 'textarea';
    label: string;
    validation?: string;
  }[];
}
```

#### Ví Dụ Required Fields

| to_status_code | Required Fields | Optional Fields |
|----------------|-----------------|-----------------|
| `assigned_to_receiver` | `performer_user_id`, `estimated_hours` | `work_content` |
| `pending_dispatch` | - | `dispatcher_user_id`, `notes` |
| `analysis` | `performer_user_id`, `analysis_notes` | `estimated_hours` |
| `coding` | `performer_user_id`, `technical_specs` | `estimated_hours` |

### 5.2. Người Dùng Xác Nhận Chuyển

#### UI Actions

```tsx
// CustomerRequestTransitionModal.tsx
<Button
  variant="primary"
  onClick={handleTransition}
  disabled={!isFormValid}
  loading={isTransitioning}
>
  Xác nhận chuyển
</Button>

<Button variant="secondary" onClick={onClose}>
  Hủy
</Button>
```

#### Validation Before Submit

```typescript
const validateForm = (): boolean => {
  const errors: string[] = [];
  
  // Check required fields
  requiredFields.forEach(field => {
    if (!formData[field]) {
      errors.push(`Trường ${fieldLabel[field]} là bắt buộc`);
    }
  });
  
  // Check estimated_hours range
  if (formData.estimated_hours && 
      (formData.estimated_hours <= 0 || formData.estimated_hours > 1000)) {
    errors.push('Số giờ ước lượng phải từ 0.5 đến 1000 giờ');
  }
  
  if (errors.length > 0) {
    toast.error(errors.join('\n'));
    return false;
  }
  
  return true;
};
```

### 5.3. API Thực Hiện Transition

#### Endpoint

```
POST /api/v5/customer-request-cases/{id}/transition
```

#### Request Payload

```json
{
  "to_status_code": "assigned_to_receiver",
  "performer_user_id": 123,
  "estimated_hours": 8.0,
  "work_content": "Nội dung công việc chi tiết",
  "notes": "Ghi chú bổ sung"
}
```

#### Backend Handler

| Lớp | File | Method |
|-----|------|--------|
| **Controller** | `CustomerRequestCaseController.php` | `transition()` |
| **Domain Service** | `CustomerRequestCaseDomainService.php` | `transition()` |
| **Execution Service** | `CustomerRequestCaseExecutionService.php` | `executeTransition()` |
| **Workflow Service** | `WorkflowTransitionService.php` | `validateAndExecute()` |

### 5.4. Backend Xử Lý

#### Step-by-Step Processing

```php
public function transition(int $caseId, TransitionRequest $request): JsonResponse
{
    $case = CustomerRequestCase::findOrFail($caseId);
    $user = auth()->user();
    
    // 1. ✅ Validate transition hợp lệ (từ from → to)
    $isValid = $this->workflowService->isValidTransition(
        $case->current_status_code,
        $request->to_status_code
    );
    
    if (!$isValid) {
        return response()->json([
            'error' => 'Transition không hợp lệ'
        ], 422);
    }
    
    // 2. ✅ Validate user có quyền thực hiện transition (theo allowed_roles)
    $canTransition = $this->workflowService->canUserTransition(
        $case->current_status_code,
        $request->to_status_code,
        $user->id,
        $case->project_id
    );
    
    if (!$canTransition) {
        return response()->json([
            'error' => 'Bạn không có quyền thực hiện chuyển này'
        ], 403);
    }
    
    // 3. ✅ Validate required fields
    $validation = $this->workflowService->validateRequiredFields(
        $request->to_status_code,
        $request->all()
    );
    
    if ($validation->fails()) {
        return response()->json([
            'error' => 'Validation failed',
            'messages' => $validation->errors()
        ], 422);
    }
    
    // 4. ✅ Tạo mới status_instance cho to_status_code
    $newStatusInstance = CustomerRequestStatusInstance::create([
        'request_case_id' => $case->id,
        'status_code' => $request->to_status_code,
        'is_current' => true,
        'started_at' => now(),
        'started_by' => $user->id
    ]);
    
    // Mark old status as not current
    CustomerRequestStatusInstance::where('request_case_id', $case->id)
        ->where('id', '!=', $newStatusInstance->id)
        ->update(['is_current' => false]);
    
    // 5. ✅ Cập nhật current_status_code của case
    $case->update([
        'current_status_code' => $request->to_status_code,
        'performer_user_id' => $request->performer_user_id ?? null,
        'dispatcher_user_id' => $request->dispatcher_user_id ?? null,
        'updated_by' => $user->id
    ]);
    
    // Create estimate if provided
    if ($request->estimated_hours) {
        CustomerRequestEstimate::create([
            'request_case_id' => $case->id,
            'estimated_hours' => $request->estimated_hours,
            'created_by' => $user->id
        ]);
    }
    
    // 6. ✅ Ghi audit log
    $this->auditService->recordAuditEvent(
        entityType: 'customer_request_case',
        entityId: $case->id,
        action: 'transition',
        details: [
            'from_status' => $case->current_status_code,
            'to_status' => $request->to_status_code,
            'performer_user_id' => $request->performer_user_id,
            'estimated_hours' => $request->estimated_hours
        ],
        userId: $user->id
    );
    
    // 7. ✅ Trả về kết quả
    return response()->json([
        'data' => [
            'id' => $case->id,
            'request_code' => $case->request_code,
            'current_status_code' => $case->current_status_code,
            'status_instance_id' => $newStatusInstance->id
        ],
        'meta' => [
            'transition_successful' => true,
            'audit_logged' => true
        ]
    ]);
}
```

### 5.5. Kết Quả

#### Response

```json
{
  "data": {
    "id": 1234,
    "request_code": "CRC-202603-0042",
    "current_status_code": "assigned_to_receiver",
    "performer_user_id": 123,
    "status_instance_id": 5678,
    "updated_at": "2026-03-28T14:30:00+07:00"
  },
  "meta": {
    "transition_successful": true,
    "audit_logged": true,
    "notification_sent": true
  }
}
```

#### UI Post-Transition Actions

```typescript
// CustomerRequestTransitionModal.tsx
if (response.success) {
  toast.success('Chuyển trạng thái thành công');
  onClose(); // Close modal
  refreshDetail(); // Refresh CustomerRequestDetailPane
  refetchList(); // Refetch list in hub
}
```

#### Updated State

| Field | Before | After |
|-------|--------|-------|
| `current_status_code` | `new_intake` | `assigned_to_receiver` |
| `performer_user_id` | `NULL` | `123` |
| `status_instance_id` | `5677` | `5678` (new) |
| Transition modal | Open | Closed |
| Detail view | Old data | Refreshed |

---

## SƠ ĐỒ LUỒNG XỬ LÝ

### Luồng Tổng Quát 5 Bước

```
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 1: TẠO MỚI                                                 │
│ Modal: CustomerRequestCreateModal                               │
│ - Nhập customer, service_group, title, description              │
│ - ❌ KHÔNG chọn dispatch_route                                  │
│ - dispatch_route = NULL                                         │
│ - current_status_code = new_intake                              │
│ - received_by_user_id = creator_id                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 2: CHỈNH SỬA (nếu cần)                                     │
│ Modal: CustomerRequestDetailPane                                │
│ - Chỉ creator/received_by_user_id được sửa                      │
│ - Cập nhật các trường thông tin                                 │
│ - PUT /api/v5/customer-request-cases/{id}                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 3: CHỌN BƯỚC TIẾP THEO                                     │
│ Modal: CustomerRequestTransitionModal                           │
│ - GET /customer-request-cases/{id}/transitions                  │
│ - Dropdown: Chọn to_status_code                                 │
│ - Hiển thị: to_status_name_vi                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 4: HỆ THỐNG TỰ ĐỘNG LẤY USER THEO RACI                     │
│ - Query customer_request_status_transitions                     │
│ - Lấy allowed_roles: ["R"] | ["A"] | ["all"]                    │
│ - GET /projects/{id}/raci-users?roles={allowed_roles}           │
│ - Dropdown: Chọn performer_user_id từ danh sách filter          │
│ - Label format: {full_name} · {user_code}                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 5: XÁC NHẬN CHUYỂN                                        │
│ - POST /customer-request-cases/{id}/transition                  │
│ - Validate transition + user permission                         │
│ - Validate required fields                                      │
│ - Tạo status_instance mới                                       │
│ - Cập nhật current_status_code                                  │
│ - Tạo estimate (nếu có)                                         │
│ - Audit log                                                     │
│ - Refresh UI                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Sequence Diagram

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User   │    │ Frontend │    │ Backend  │    │ Workflow │    │ Database │
│         │    │   (FE)   │    │   (BE)   │    │ Service  │    │   (DB)   │
└────┬────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │              │                │                │                │
     │ 1. Open Create Modal          │                │                │
     │─────────────>│                │                │                │
     │              │                │                │                │
     │ 2. Fill Form & Submit         │                │                │
     │─────────────>│                │                │                │
     │              │ 3. POST /cases │                │                │
     │              │───────────────>│                │                │
     │              │                │ 4. Validate    │                │
     │              │                │───────────────>│                │
     │              │                │                │ 5. INSERT case │
     │              │                │                │───────────────>│
     │              │                │                │ 6. Return ID   │
     │              │                │                │<───────────────│
     │              │                │ 7. Return data │                │
     │              │<───────────────│                │                │
     │ 8. Show Success              │                │                │
     │<─────────────│                │                │                │
     │              │                │                │                │
     │ 9. Click "Chuyển trạng thái" │                │                │
     │─────────────>│                │                │                │
     │              │ 10. GET /transitions           │                │
     │              │───────────────>│                │                │
     │              │                │ 11. Query transitions          │
     │              │                │───────────────>│                │
     │              │                │                │ 12. SELECT     │
     │              │                │                │───────────────>│
     │              │                │ 13. Return list│                │
     │              │<───────────────│                │                │
     │ 14. Show dropdown           │                │                │
     │<─────────────│                │                │                │
     │              │                │                │                │
     │ 15. Select status           │                │                │
     │─────────────>│                │                │                │
     │              │ 16. GET /raci-users            │                │
     │              │───────────────>│                │                │
     │              │                │ 17. Query RACI │                │
     │              │                │───────────────>│                │
     │              │                │                │ 18. SELECT     │
     │              │                │                │───────────────>│
     │              │                │ 19. Return users               │
     │              │<───────────────│                │                │
     │ 20. Show user dropdown      │                │                │
     │<─────────────│                │                │                │
     │              │                │                │                │
     │ 21. Fill & Confirm          │                │                │
     │─────────────>│                │                │                │
     │              │ 22. POST /transition           │                │
     │              │───────────────>│                │                │
     │              │                │ 23. Validate   │                │
     │              │                │───────────────>│                │
     │              │                │ 24. INSERT instance            │
     │              │                │                │───────────────>│
     │              │                │ 25. UPDATE case                │
     │              │                │                │───────────────>│
     │              │                │ 26. Audit log  │                │
     │              │                │───────────────>│                │
     │              │ 27. Return OK  │                │                │
     │              │<───────────────│                │                │
     │ 28. Close & Refresh         │                │                │
     │<─────────────│                │                │                │
     │              │                │                │                │
```

---

## API REFERENCE

### Endpoints Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v5/customer-request-cases` | Tạo yêu cầu mới | ✅ |
| PUT | `/api/v5/customer-request-cases/{id}` | Cập nhật yêu cầu | ✅ |
| GET | `/api/v5/customer-request-cases/{id}/transitions` | Lấy transitions khả dụng | ✅ |
| POST | `/api/v5/customer-request-cases/{id}/transition` | Thực hiện chuyển trạng thái | ✅ |
| GET | `/api/v5/projects/{id}/raci-users` | Lấy user theo RACI roles | ✅ |

### Detailed API Specs

#### POST /api/v5/customer-request-cases

**Request:**
```json
{
  "customer_id": 567,
  "customer_personnel_id": 890,
  "support_service_group_id": 12,
  "title": "Yêu cầu hỗ trợ",
  "description": "Mô tả chi tiết...",
  "project_id": 45,
  "priority": 3
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": 1234,
    "request_code": "CRC-202603-0042",
    "current_status_code": "new_intake",
    "received_by_user_id": 1,
    "dispatch_route": null
  }
}
```

#### PUT /api/v5/customer-request-cases/{id}

**Request:**
```json
{
  "customer_id": 567,
  "title": "Cập nhật tiêu đề",
  "priority": 2
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": 1234,
    "updated_at": "2026-03-28T11:15:00+07:00"
  },
  "meta": {
    "audit_logged": true
  }
}
```

#### GET /api/v5/customer-request-cases/{id}/transitions

**Response (200 OK):**
```json
{
  "data": [
    {
      "to_status_code": "assigned_to_receiver",
      "to_status_name_vi": "Giao R thực hiện",
      "allowed_roles": ["all"],
      "required_fields": ["performer_user_id", "estimated_hours"]
    }
  ],
  "meta": {
    "from_status_code": "new_intake"
  }
}
```

#### POST /api/v5/customer-request-cases/{id}/transition

**Request:**
```json
{
  "to_status_code": "assigned_to_receiver",
  "performer_user_id": 123,
  "estimated_hours": 8.0,
  "work_content": "Nội dung công việc"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "current_status_code": "assigned_to_receiver",
    "performer_user_id": 123,
    "status_instance_id": 5678
  },
  "meta": {
    "transition_successful": true,
    "audit_logged": true
  }
}
```

#### GET /api/v5/projects/{id}/raci-users?roles={R|A|all}

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 123,
      "full_name": "Nguyễn Văn A",
      "user_code": "NV001",
      "email": "a@example.com",
      "raci_role": "R"
    }
  ],
  "meta": {
    "project_id": 45,
    "roles_filter": ["R"]
  }
}
```

---

## COMPONENT REFERENCE

### Frontend Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| `CustomerRequestCreateModal` | `frontend/components/customer-request/CustomerRequestCreateModal.tsx` | Modal tạo yêu cầu mới |
| `CustomerRequestDetailPane` | `frontend/components/customer-request/CustomerRequestDetailPane.tsx` | Panel chi tiết yêu cầu |
| `CustomerRequestTransitionModal` | `frontend/components/customer-request/CustomerRequestTransitionModal.tsx` | Modal chuyển trạng thái |
| `CustomerRequestManagementHub` | `frontend/components/customer-request/CustomerRequestManagementHub.tsx` | Hub quản lý chính |
| `CustomerRequestFieldRenderer` | `frontend/components/customer-request/CustomerRequestFieldRenderer.tsx` | Renderer trường động |
| `SearchableSelect` | `frontend/components/ui/SearchableSelect.tsx` | Dropdown tìm kiếm |

### Custom Hooks

| Hook | File Path | Purpose |
|------|-----------|---------|
| `useCustomerRequestCreate` | `frontend/components/customer-request/hooks/useCustomerRequestCreate.ts` | Logic tạo CRC |
| `useCustomerRequestUpdate` | `frontend/components/customer-request/hooks/useCustomerRequestUpdate.ts` | Logic cập nhật CRC |
| `useCustomerRequestTransitions` | `frontend/components/customer-request/hooks/useCustomerRequestTransitions.ts` | Lấy transitions |
| `useProjectRaciUsers` | `frontend/components/customer-request/hooks/useProjectRaciUsers.ts` | Lấy user theo RACI |
| `useCustomerRequestTransition` | `frontend/components/customer-request/hooks/useCustomerRequestTransition.ts` | Thực hiện transition |

### Backend Services

| Service | File Path | Purpose |
|---------|-----------|---------|
| `CustomerRequestCaseDomainService` | `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseDomainService.php` | Orchestrator |
| `CustomerRequestCaseWriteService` | `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php` | Write operations |
| `CustomerRequestCaseExecutionService` | `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseExecutionService.php` | Transition execution |
| `WorkflowTransitionService` | `backend/app/Services/V5/Workflow/WorkflowTransitionService.php` | Workflow validation |
| `ProjectRaciService` | `backend/app/Services/V5/Project/ProjectRaciService.php` | RACI user lookup |

### Backend Controllers

| Controller | File Path | Purpose |
|------------|-----------|---------|
| `CustomerRequestCaseController` | `backend/app/Http/Controllers/Api/V5/CustomerRequestCaseController.php` | CRC CRUD |
| `ProjectRaciController` | `backend/app/Http/Controllers/Api/V5/ProjectRaciController.php` | RACI API |

### Models

| Model | File Path | Table |
|-------|-----------|-------|
| `CustomerRequestCase` | `backend/app/Models/CustomerRequestCase.php` | `customer_request_cases` |
| `CustomerRequestStatusInstance` | `backend/app/Models/CustomerRequestStatusInstance.php` | `customer_request_status_instances` |
| `CustomerRequestEstimate` | `backend/app/Models/CustomerRequestEstimate.php` | `customer_request_estimates` |
| `WorkflowTransition` | `backend/app/Models/WorkflowTransition.php` | `workflow_transitions` |
| `ProjectRaciAssignment` | `backend/app/Models/ProjectRaciAssignment.php` | `project_raci_assignments` |

---

## PHỤ LỤC

### A. Status Code Mapping

| Status Code | Tên Tiếng Việt | Table |
|-------------|----------------|-------|
| `new_intake` | Mới tiếp nhận | `customer_request_cases` |
| `assigned_to_receiver` | Giao R thực hiện | `customer_request_in_progress` |
| `pending_dispatch` | Giao PM/Trả YC cho PM | `customer_request_pending_dispatch` |
| `in_progress` | R Đang thực hiện | `customer_request_in_progress` |
| `not_executed` | Không tiếp nhận | `customer_request_not_executed` |
| `waiting_customer_feedback` | Chờ KH cung cấp thông tin | `customer_request_waiting_customer_feedbacks` |
| `analysis` | Chuyển BA Phân tích | `customer_request_analysis` |
| `analysis_completed` | BA Phân tích hoàn thành | `customer_request_analysis` |
| `analysis_suspended` | BA Phân tích tạm ngưng | `customer_request_analysis` |
| `dms_transfer` | Chuyển DMS | `customer_request_dms_transfer` |
| `coding` | Lập trình | `customer_request_coding` |
| `completed` | Hoàn thành | `customer_request_completed` |
| `customer_notified` | Thông báo khách hàng | `customer_request_customer_notified` |

### B. RACI Role Definitions

| Role | Code | Responsibility |
|------|------|----------------|
| **Responsible** | R | Người thực hiện công việc |
| **Accountable** | A | Người chịu trách nhiệm phê duyệt |
| **Consulted** | C | Người được tham vấn |
| **Informed** | I | Người được thông báo |

### C. Transition Validation Rules

```php
$transitionRules = [
    'to_status_code' => 'required|string|exists:customer_request_status_catalogs,status_code',
    'performer_user_id' => 'required_if:to_status_code,assigned_to_receiver|nullable|exists:internal_users,id',
    'estimated_hours' => 'nullable|numeric|min:0.5|max:1000',
    'work_content' => 'nullable|string|max:5000',
    'notes' => 'nullable|string|max:2000'
];
```

### D. Error Codes

| Code | Message | HTTP Status |
|------|---------|-------------|
| `TRANSITION_INVALID` | Transition không hợp lệ | 422 |
| `TRANSITION_UNAUTHORIZED` | Không có quyền thực hiện | 403 |
| `VALIDATION_FAILED` | Validation failed | 422 |
| `USER_NOT_FOUND` | Người dùng không tồn tại | 404 |
| `CASE_NOT_FOUND` | Yêu cầu không tồn tại | 404 |

---

## LỊCH SỬ CẬP NHẬT

| Version | Ngày | Người cập nhật | Thay đổi |
|---------|------|----------------|----------|
| 1.0 | 2026-03-28 | System | Initial version |

---

**Tài liệu này là một phần của hệ thống VNPT Business Management.**  
**Xem thêm:** `luong_xu_ly_QL_YC_khach_hang.md` để biết chi tiết ma trận chuyển tiếp.
