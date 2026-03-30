-- 2026-03-28_06_add_workflow_management_permissions.sql
-- Thêm permission workflow.manage cho Workflow Management module
-- Date: 2026-03-28
-- Author: VNPT Business Management Team

-- ============================================================================
-- MỤC ĐÍCH: Thêm permission quản lý luồng công việc
-- ============================================================================
-- Permission: workflow.manage - Quản lý workflow definitions & transitions
-- Tự động gán cho role ADMIN
-- ============================================================================

-- Kiểm tra permission có tồn tại chưa
SET @perm_exists = (SELECT COUNT(*) FROM permissions WHERE perm_key = 'workflow.manage');

-- Thêm permission nếu chưa tồn tại
SET @sql = IF(@perm_exists = 0,
    'INSERT INTO permissions (perm_key, perm_name, perm_group, is_active, created_at, updated_at)
     VALUES (''workflow.manage'', ''Quản lý luồng công việc'', ''workflow'', 1, NOW(), NOW())',
    'SELECT ''Permission workflow.manage already exists'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- GÁN PERMISSION CHO ROLE ADMIN
-- ============================================================================

-- Lấy permission_id vừa tạo
SET @perm_id = (SELECT id FROM permissions WHERE perm_key = 'workflow.manage' LIMIT 1);

-- Lấy admin role_id
SET @admin_role_id = (SELECT id FROM roles WHERE role_code = 'ADMIN' LIMIT 1);

-- Kiểm tra mapping có tồn tại chưa
SET @mapping_exists = (
    SELECT COUNT(*) FROM role_permission
    WHERE role_id = @admin_role_id AND permission_id = @perm_id
);

-- Thêm mapping nếu chưa tồn tại
SET @sql = IF(@mapping_exists = 0 AND @perm_id IS NOT NULL AND @admin_role_id IS NOT NULL,
    'INSERT INTO role_permission (role_id, permission_id, created_at, updated_at)
     VALUES (?, ?, NOW(), NOW())',
    'SELECT ''Role-permission mapping already exists or missing data'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt USING @admin_role_id, @perm_id;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- VERIFY
-- ============================================================================

SELECT
    p.id AS permission_id,
    p.perm_key,
    p.perm_name,
    p.perm_group,
    r.id AS role_id,
    r.role_code,
    r.role_name
FROM permissions p
JOIN role_permission rp ON p.id = rp.permission_id
JOIN roles r ON rp.role_id = r.id
WHERE p.perm_key = 'workflow.manage';
