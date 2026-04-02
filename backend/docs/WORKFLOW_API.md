# Workflow Management API Documentation

**Version:** 1.0  
**Date:** 2026-03-28  
**Base URL:** `/api/v5`

---

## Overview

API cho việc quản lý luồng công việc (workflow) trong hệ thống VNPT Business Management.

### Features
- Quản lý Workflow Definitions (định nghĩa luồng)
- Quản lý Workflow Transitions (chuyển tiếp trong luồng)
- Hỗ trợ multi-workflow (chỉ 1 workflow active tại một thời điểm)
- Bulk import/export transitions
- Role-based access control

### Permissions Required
- `workflow.manage` - Required for all endpoints

---

## Workflow Definitions API

### 1. List Workflows

**Endpoint:** `GET /api/v5/workflow-definitions`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `process_type` | string | `customer_request` | Loại quy trình |
| `include_inactive` | boolean | `false` | Bao gồm cả inactive workflows |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "code": "LUONG_A",
      "name": "Luồng xử lý A",
      "description": "Luồng xử lý yêu cầu khách hàng mặc định",
      "process_type": "customer_request",
      "is_active": true,
      "is_default": true,
      "version": "1.0",
      "activated_at": "2026-03-28T10:00:00Z",
      "created_at": "2026-03-28T10:00:00Z",
      "updated_at": "2026-03-28T10:00:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "process_type": "customer_request",
    "include_inactive": false
  }
}
```

---

### 2. Get Workflow Detail

**Endpoint:** `GET /api/v5/workflow-definitions/{id}`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Workflow ID |

**Response:**
```json
{
  "data": {
    "id": 1,
    "code": "LUONG_A",
    "name": "Luồng xử lý A",
    "description": "Luồng xử lý yêu cầu khách hàng mặc định",
    "process_type": "customer_request",
    "is_active": true,
    "is_default": true,
    "version": "1.0",
    "config": {
      "notification_enabled": true,
      "sla_enabled": true
    },
    "activated_at": "2026-03-28T10:00:00Z",
    "transitions": [
      {
        "id": 1,
        "from_status_code": "new_intake",
        "to_status_code": "assigned_to_receiver",
        "allowed_roles": ["R"],
        "required_fields": ["notes"],
        "sort_order": 1,
        "is_active": true
      }
    ]
  }
}
```

---

### 3. Get Active Workflow

**Endpoint:** `GET /api/v5/workflow-definitions/active`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `process_type` | string | `customer_request` | Loại quy trình |

**Response:**
```json
{
  "data": {
    "id": 1,
    "code": "LUONG_A",
    "name": "Luồng xử lý A",
    "is_active": true,
    "transitions": [...]
  }
}
```

---

### 4. Create Workflow

**Endpoint:** `POST /api/v5/workflow-definitions`

**Request Body:**
```json
{
  "code": "LUONG_B",
  "name": "Luồng xử lý B",
  "description": "Luồng xử lý thay thế",
  "process_type": "customer_request",
  "is_active": false,
  "is_default": false,
  "version": "1.0",
  "config": {
    "notification_enabled": true
  }
}
```

**Validation Rules:**
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `code` | string | ✅ | max:50, unique |
| `name` | string | ✅ | max:255 |
| `process_type` | string | ✅ | in:customer_request,project_procedure |
| `is_active` | boolean | ❌ | default: false |
| `is_default` | boolean | ❌ | default: false |
| `version` | string | ❌ | max:20, default: 1.0 |
| `config` | array | ❌ | JSON object |

**Response:** `201 Created`
```json
{
  "message": "Workflow created successfully",
  "data": { ... }
}
```

---

### 5. Update Workflow

**Endpoint:** `PUT /api/v5/workflow-definitions/{id}`

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "is_active": true
}
```

**Response:** `200 OK`
```json
{
  "message": "Workflow updated successfully",
  "data": { ... }
}
```

---

### 6. Activate Workflow

**Endpoint:** `POST /api/v5/workflow-definitions/{id}/activate`

**Description:** Activate workflow này và tự động deactivate tất cả workflows khác cùng `process_type`.

**Response:** `200 OK`
```json
{
  "message": "Workflow activated successfully",
  "data": { ... }
}
```

---

### 7. Deactivate Workflow

**Endpoint:** `POST /api/v5/workflow-definitions/{id}/deactivate`

**Response:** `200 OK`
```json
{
  "message": "Workflow deactivated successfully",
  "data": { ... }
}
```

---

### 8. Delete Workflow

**Endpoint:** `DELETE /api/v5/workflow-definitions/{id}`

**Description:** Soft delete workflow và tất cả transitions liên quan.

**Response:** `200 OK`
```json
{
  "message": "Workflow deleted successfully"
}
```

---

### 9. Get Workflow Statistics

**Endpoint:** `GET /api/v5/workflow-definitions/statistics`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `process_type` | string | `customer_request` | Loại quy trình |

**Response:**
```json
{
  "data": {
    "total_workflows": 3,
    "active_workflows": 1,
    "inactive_workflows": 2,
    "default_workflows": 1,
    "total_transitions": 46,
    "process_type": "customer_request"
  }
}
```

---

### 10. Get Workflow by Code

**Endpoint:** `GET /api/v5/workflow-definitions/code/{code}`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Workflow code (e.g., LUONG_A) |

**Response:**
```json
{
  "data": {
    "id": 1,
    "code": "LUONG_A",
    "name": "Luồng xử lý A",
    ...
  }
}
```

---

## Workflow Transitions API

### 1. List Transitions

**Endpoint:** `GET /api/v5/workflow-definitions/{workflowId}/transitions`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `workflowId` | integer | Workflow Definition ID |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `active_only` | boolean | `true` | Chỉ lấy active transitions |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "workflow_definition_id": 1,
      "from_status_code": "new_intake",
      "to_status_code": "assigned_to_receiver",
      "from_status_name": "Tiếp nhận",
      "to_status_name": "Giao R thực hiện",
      "allowed_roles": ["R"],
      "required_fields": ["notes"],
      "transition_config": {},
      "sort_order": 1,
      "is_active": true,
      "workflow": {
        "code": "LUONG_A",
        "name": "Luồng xử lý A"
      }
    }
  ],
  "meta": {
    "workflow_definition_id": 1,
    "total": 46,
    "active_only": true
  }
}
```

---

### 2. Get Transitions from Status

**Endpoint:** `GET /api/v5/workflow-definitions/{workflowId}/transitions/from/{fromStatusCode}`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `workflowId` | integer | Workflow Definition ID |
| `fromStatusCode` | string | From status code (e.g., new_intake) |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `active_only` | boolean | `true` | Chỉ lấy active transitions |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "from_status_code": "new_intake",
      "to_status_code": "assigned_to_receiver",
      "allowed_roles": ["R"],
      "sort_order": 1
    },
    {
      "id": 2,
      "from_status_code": "new_intake",
      "to_status_code": "pending_dispatch",
      "allowed_roles": ["all"],
      "sort_order": 2
    }
  ],
  "meta": {
    "workflow_definition_id": 1,
    "from_status_code": "new_intake",
    "total": 2,
    "active_only": true
  }
}
```

---

### 3. Check Transition

**Endpoint:** `GET /api/v5/workflow-definitions/{workflowId}/transitions/check`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from_status_code` | string | ✅ | From status code |
| `to_status_code` | string | ✅ | To status code |
| `role` | string | ❌ | User role to check (R, A, C, I) |

**Response:**
```json
{
  "data": {
    "is_allowed": true,
    "allowed_roles": ["R"],
    "can_execute": true,
    "from_status_code": "new_intake",
    "to_status_code": "assigned_to_receiver"
  }
}
```

---

### 4. Create Transition

**Endpoint:** `POST /api/v5/workflow-definitions/{workflowId}/transitions`

**Request Body:**
```json
{
  "from_status_code": "new_intake",
  "to_status_code": "assigned_to_receiver",
  "allowed_roles": ["R"],
  "required_fields": ["notes", "performer"],
  "transition_config": {
    "notification_enabled": true
  },
  "sort_order": 1,
  "is_active": true
}
```

**Validation Rules:**
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `from_status_code` | string | ✅ | max:80 |
| `to_status_code` | string | ✅ | max:80 |
| `allowed_roles` | array | ✅ | Items: in:all,R,A,C,I |
| `required_fields` | array | ❌ | Items: string |
| `transition_config` | array | ❌ | JSON object |
| `sort_order` | integer | ❌ | min:0, default: 0 |
| `is_active` | boolean | ❌ | default: true |

**Response:** `201 Created`
```json
{
  "message": "Transition created successfully",
  "data": { ... }
}
```

**Error:** `422 Unprocessable Entity`
```json
{
  "message": "Transition already exists for this from_status → to_status combination"
}
```

---

### 5. Update Transition

**Endpoint:** `PUT /api/v5/workflow-transitions/{id}`

**Request Body:**
```json
{
  "allowed_roles": ["A"],
  "sort_order": 2,
  "required_fields": ["notes"]
}
```

**Response:** `200 OK`
```json
{
  "message": "Transition updated successfully",
  "data": { ... }
}
```

---

### 6. Delete Transition

**Endpoint:** `DELETE /api/v5/workflow-transitions/{id}`

**Response:** `200 OK`
```json
{
  "message": "Transition deleted successfully"
}
```

---

### 7. Bulk Create Transitions

**Endpoint:** `POST /api/v5/workflow-definitions/{workflowId}/transitions/bulk`

**Request Body:**
```json
{
  "transitions": [
    {
      "from_status_code": "new_intake",
      "to_status_code": "assigned_to_receiver",
      "allowed_roles": ["R"],
      "sort_order": 1
    },
    {
      "from_status_code": "new_intake",
      "to_status_code": "pending_dispatch",
      "allowed_roles": ["all"],
      "sort_order": 2
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "message": "Transitions created successfully",
  "data": [...],
  "meta": {
    "total": 2
  }
}
```

---

### 8. Import Transitions from Excel Data

**Endpoint:** `POST /api/v5/workflow-definitions/{workflowId}/transitions/import`

**Request Body:**
```json
{
  "transitions": [
    {
      "from_status_code": "new_intake",
      "to_status_code": "assigned_to_receiver",
      "allowed_roles": ["R"],
      "sort_order": 1
    }
  ],
  "skip_duplicates": true,
  "update_existing": false
}
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip_duplicates` | boolean | `false` | Skip nếu transition đã tồn tại |
| `update_existing` | boolean | `false` | Update nếu transition đã tồn tại |

**Response:** `200 OK`
```json
{
  "message": "Import completed",
  "data": {
    "success": 45,
    "skipped": 1,
    "updated": 0,
    "errors": []
  }
}
```

---

### 9. Get Transition Statistics

**Endpoint:** `GET /api/v5/workflow-definitions/{workflowId}/transitions/statistics`

**Response:**
```json
{
  "data": {
    "total_transitions": 46,
    "active_transitions": 46,
    "inactive_transitions": 0,
    "allowed_roles_all": 20,
    "allowed_roles_R": 15,
    "allowed_roles_A": 11,
    "unique_from_statuses": 12,
    "unique_to_statuses": 12,
    "from_status_codes": ["new_intake", "pending_dispatch", ...],
    "to_status_codes": ["assigned_to_receiver", "pending_dispatch", ...]
  }
}
```

---

### 10. Get Single Transition

**Endpoint:** `GET /api/v5/workflow-transitions/{id}`

**Response:**
```json
{
  "data": {
    "id": 1,
    "workflow_definition_id": 1,
    "from_status_code": "new_intake",
    "to_status_code": "assigned_to_receiver",
    ...
  }
}
```

---

## Error Responses

### 404 Not Found
```json
{
  "message": "Workflow not found"
}
```

### 422 Unprocessable Entity
```json
{
  "message": "Validation failed: The code has already been taken."
}
```

### 403 Forbidden
```json
{
  "message": "Unauthorized. Missing permission: workflow.manage"
}
```

---

## Status Codes Reference

| Code | Description |
|------|-------------|
| 200 | Success (GET, PUT, POST actions) |
| 201 | Created (POST create) |
| 400 | Bad Request |
| 403 | Forbidden (missing permission) |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Server Error |

---

## Sample Workflow: LUONG_A

### Transitions (46 total)

| # | From | To | Allowed Roles |
|---|------|-----|---------------|
| 1 | new_intake | assigned_to_receiver | ["R"] |
| 2 | new_intake | pending_dispatch | ["all"] |
| 3 | assigned_to_receiver | receiver_in_progress | ["R"] |
| 4 | assigned_to_receiver | pending_dispatch | ["R"] |
| 5 | pending_dispatch | not_executed | ["A"] |
| 6 | pending_dispatch | waiting_customer_feedback | ["A"] |
| 7 | pending_dispatch | assigned_to_receiver | ["A"] |
| 8 | pending_dispatch | analysis | ["A"] |
| 9 | pending_dispatch | dms_transfer | ["A"] |
| 10 | pending_dispatch | coding | ["A"] |
| 11 | pending_dispatch | completed | ["A"] |
| ... | ... | ... | ... |

---

## Testing

### Run Tests
```bash
cd backend
php artisan test --filter=WorkflowDefinitionApiTest
php artisan test --filter=WorkflowTransitionApiTest
```

### Test with cURL
```bash
# List workflows
curl -X GET "http://localhost:8002/api/v5/workflow-definitions" \
  -H "Authorization: Bearer {token}"

# Create workflow
curl -X POST "http://localhost:8002/api/v5/workflow-definitions" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"code":"LUONG_TEST","name":"Test Workflow","process_type":"customer_request"}'
```

---

**Last Updated:** 2026-03-28  
**Maintained By:** Backend Team
