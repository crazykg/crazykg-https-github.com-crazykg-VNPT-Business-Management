# Postman Samples — Access Control (roles / permissions / scopes)
**Ngày:** 2026-03-01  
**Base URL:** `http://127.0.0.1:8000`  
**Auth:** session/cookie đăng nhập hợp lệ

## 0) Chuẩn bị nhanh (thay bằng ID thực tế)
1. `{{user_id}}`: id user cần test (ví dụ `2`).
2. `{{role_id_1}}`, `{{role_id_2}}`: id role hợp lệ.
3. `{{perm_id_1}}`, `{{perm_id_2}}`: id permission hợp lệ.
4. `{{dept_id_1}}`, `{{dept_id_2}}`: id phòng ban hợp lệ.

---

## 1) Update Roles

### 1.1 Valid payload
**PUT** `{{base_url}}/api/v5/user-access/{{user_id}}/roles`

```json
{
  "role_ids": [{{role_id_1}}, {{role_id_2}}]
}
```

**Expected:** `200 OK`, response có `data.roles` cập nhật đúng.

### 1.2 Duplicate payload
**PUT** `{{base_url}}/api/v5/user-access/{{user_id}}/roles`

```json
{
  "role_ids": [{{role_id_1}}, {{role_id_1}}, {{role_id_2}}]
}
```

**Expected:** `422`, có:

```json
{
  "message": "role_ids bị trùng.",
  "errors": {
    "duplicate_role_ids": [{{role_id_1}}]
  }
}
```

---

## 2) Update Permission Overrides

### 2.1 Valid payload
**PUT** `{{base_url}}/api/v5/user-access/{{user_id}}/permissions`

```json
{
  "overrides": [
    {
      "permission_id": {{perm_id_1}},
      "type": "GRANT",
      "reason": "Cho phép xử lý nghiệp vụ"
    },
    {
      "permission_id": {{perm_id_2}},
      "type": "DENY",
      "reason": "Chặn xóa dữ liệu"
    }
  ]
}
```

**Expected:** `200 OK`, response có `data.permissions` cập nhật đúng.

### 2.2 Duplicate payload
**PUT** `{{base_url}}/api/v5/user-access/{{user_id}}/permissions`

```json
{
  "overrides": [
    {
      "permission_id": {{perm_id_1}},
      "type": "GRANT",
      "reason": "Lần 1"
    },
    {
      "permission_id": {{perm_id_1}},
      "type": "DENY",
      "reason": "Lần 2 trùng id"
    }
  ]
}
```

**Expected:** `422`, có:

```json
{
  "message": "overrides bị trùng permission_id.",
  "errors": {
    "duplicate_permission_ids": [{{perm_id_1}}]
  }
}
```

---

## 3) Update Department Scopes

### 3.1 Valid payload
**PUT** `{{base_url}}/api/v5/user-access/{{user_id}}/dept-scopes`

```json
{
  "scopes": [
    {
      "dept_id": {{dept_id_1}},
      "scope_type": "DEPT_ONLY"
    },
    {
      "dept_id": {{dept_id_2}},
      "scope_type": "DEPT_AND_CHILDREN"
    }
  ]
}
```

**Expected:** `200 OK`, response có `data.dept_scopes` cập nhật đúng.

### 3.2 Duplicate payload (same dept + same scope_type)
**PUT** `{{base_url}}/api/v5/user-access/{{user_id}}/dept-scopes`

```json
{
  "scopes": [
    {
      "dept_id": {{dept_id_1}},
      "scope_type": "DEPT_ONLY"
    },
    {
      "dept_id": {{dept_id_1}},
      "scope_type": "DEPT_ONLY"
    }
  ]
}
```

**Expected:** `422`, có:

```json
{
  "message": "scopes bị trùng (dept_id + scope_type).",
  "errors": {
    "duplicate_scopes": ["{{dept_id_1}}|DEPT_ONLY"]
  }
}
```

---

## 4) Gợi ý test nhanh bằng cURL

```bash
curl -X PUT "{{base_url}}/api/v5/user-access/{{user_id}}/roles" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -b "laravel_session={{session_cookie}}" \
  --data '{"role_ids":[1,2]}'
```
