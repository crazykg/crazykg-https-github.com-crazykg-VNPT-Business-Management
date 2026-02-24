-- ===================================================================================
-- DATABASE: vnpt_business_db (Bản Full - Đã Fix Lỗi)
-- Cập nhật: Fix lỗi EOF Audit_logs, Cập nhật cấu trúc Internal_Users, Chuẩn hóa FK
-- Time: 23/02/2026 21:18
-- ===================================================================================

SET FOREIGN_KEY_CHECKS = 0;

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

SET time_zone = "+07:00";

-- Tạo Database nếu chưa có
CREATE DATABASE IF NOT EXISTS `vnpt_business_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `vnpt_business_db`;

-- ===================================================================================
-- PHẦN 1: LARAVEL CORE & SYSTEM
-- ===================================================================================

CREATE TABLE IF NOT EXISTS `migrations` (
    `id` int unsigned NOT NULL AUTO_INCREMENT,
    `migration` varchar(255) NOT NULL,
    `batch` int NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 1: Quản lý vết migration';

CREATE TABLE IF NOT EXISTS `cache` (
    `key` varchar(255) NOT NULL,
    `value` mediumtext NOT NULL,
    `expiration` int NOT NULL,
    PRIMARY KEY (`key`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 2: Lưu trữ cache hệ thống';

CREATE TABLE IF NOT EXISTS `cache_locks` (
    `key` varchar(255) NOT NULL,
    `owner` varchar(255) NOT NULL,
    `expiration` int NOT NULL,
    PRIMARY KEY (`key`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 3: Quản lý khóa tài nguyên';

CREATE TABLE IF NOT EXISTS `jobs` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `queue` varchar(255) NOT NULL,
    `payload` longtext NOT NULL,
    `attempts` tinyint unsigned NOT NULL,
    `reserved_at` int unsigned DEFAULT NULL,
    `available_at` int unsigned NOT NULL,
    `created_at` int unsigned NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 4: Hàng đợi công việc';

CREATE TABLE IF NOT EXISTS `failed_jobs` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` varchar(255) UNIQUE NOT NULL,
    `connection` text NOT NULL,
    `queue` text NOT NULL,
    `payload` longtext NOT NULL,
    `exception` longtext NOT NULL,
    `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 5: Các job bị lỗi';

CREATE TABLE IF NOT EXISTS `sessions` (
    `id` varchar(255) NOT NULL,
    `user_id` bigint unsigned DEFAULT NULL,
    `ip_address` varchar(45) DEFAULT NULL,
    `user_agent` text,
    `payload` longtext NOT NULL,
    `last_activity` int NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 6: Phiên làm việc người dùng';

CREATE TABLE IF NOT EXISTS `cache_invalidation_queue` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `cache_key` varchar(100) NOT NULL COMMENT 'VD: perm:123',
    `queued_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `processed` tinyint(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_ciq_unprocessed` (`processed`, `queued_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 7: Hàng đợi làm mới cache phân quyền';

-- ===================================================================================
-- PHẦN 2: RBAC - CƠ CẤU TỔ CHỨC & PHÂN QUYỀN
-- ===================================================================================

CREATE TABLE IF NOT EXISTS `departments` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) UNIQUE NOT NULL DEFAULT(UUID()),
    `dept_code` varchar(50) UNIQUE NOT NULL,
    `dept_name` varchar(150) NOT NULL,
    `parent_id` bigint unsigned NULL,
    `dept_path` varchar(255) NOT NULL COMMENT 'Định dạng 1/2/5/',
    `status` enum('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_dept_parent` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 8: Cơ cấu tổ chức phòng ban';

CREATE TABLE IF NOT EXISTS `positions` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `pos_code` varchar(50) UNIQUE NOT NULL,
    `pos_name` varchar(100) NOT NULL,
    `pos_level` int NOT NULL DEFAULT 1,
    `is_active` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 9: Chức danh nhân sự';

CREATE TABLE IF NOT EXISTS `roles` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `role_code` varchar(50) UNIQUE NOT NULL,
    `role_name` varchar(100) NOT NULL,
    `parent_role_id` bigint unsigned NULL,
    `is_system` tinyint(1) NOT NULL DEFAULT 0,
    `description` varchar(255) NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_role_parent` FOREIGN KEY (`parent_role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 10: Nhóm quyền (Vai trò)';

CREATE TABLE IF NOT EXISTS `permissions` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `perm_key` varchar(100) UNIQUE NOT NULL,
    `perm_name` varchar(150) NOT NULL,
    `perm_group` varchar(50) NOT NULL,
    `is_active` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 11: Danh mục quyền nguyên tử';

CREATE TABLE IF NOT EXISTS `role_permission` (
    `role_id` bigint unsigned NOT NULL,
    `permission_id` bigint unsigned NOT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`role_id`, `permission_id`),
    CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 12: Gán quyền cho vai trò';

CREATE TABLE IF NOT EXISTS `position_default_roles` (
    `position_id` bigint unsigned NOT NULL,
    `role_id` bigint unsigned NOT NULL,
    `is_mandatory` tinyint(1) NOT NULL DEFAULT 0,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`position_id`, `role_id`),
    CONSTRAINT `fk_pdr_pos` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_pdr_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 13: Vai trò mặc định theo chức danh';

CREATE TABLE IF NOT EXISTS `internal_users` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) UNIQUE NOT NULL DEFAULT(UUID()),
    `user_code` varchar(50) UNIQUE NOT NULL,
    `username` varchar(50) UNIQUE NOT NULL,
    `password` varchar(255) NOT NULL,
    `remember_token` varchar(100) DEFAULT NULL,
    `full_name` varchar(100) NOT NULL,
    `job_title_raw` varchar(255) DEFAULT NULL COMMENT 'Chức danh gốc',
    `email` varchar(100) UNIQUE NOT NULL,
    `email_verified_at` timestamp NULL DEFAULT NULL,
    `date_of_birth` date DEFAULT NULL COMMENT 'Ngày sinh',
    `gender` enum('MALE', 'FEMALE', 'OTHER') DEFAULT NULL COMMENT 'Giới tính',
    `phone_number` varchar(20) DEFAULT NULL,
    `status` enum(
        'ACTIVE',
        'INACTIVE',
        'BANNED',
        'SUSPENDED'
    ) NOT NULL DEFAULT 'ACTIVE',
    `department_id` bigint unsigned NULL,
    `position_id` bigint unsigned NULL,
    `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP máy tính',
    `vpn_status` enum('YES', 'NO') DEFAULT 'NO' COMMENT 'Trạng thái VPN',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_user_dept` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_user_pos` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 14: Thông tin nhân sự & Tài khoản đăng nhập';

CREATE TABLE IF NOT EXISTS `user_roles` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `user_id` bigint unsigned NOT NULL,
    `role_id` bigint unsigned NOT NULL,
    `expires_at` timestamp NULL,
    `is_active` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 15: Gán vai trò cho người dùng';

CREATE TABLE IF NOT EXISTS `user_permissions` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `user_id` bigint unsigned NOT NULL,
    `permission_id` bigint unsigned NOT NULL,
    `type` enum('GRANT', 'DENY') NOT NULL DEFAULT 'GRANT',
    `reason` varchar(500) NOT NULL,
    `expires_at` timestamp NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_up_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 16: Quyền ngoại lệ cho cá nhân';

CREATE TABLE IF NOT EXISTS `user_dept_scopes` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `user_id` bigint unsigned NOT NULL,
    `dept_id` bigint unsigned NOT NULL,
    `scope_type` enum(
        'SELF_ONLY',
        'DEPT_ONLY',
        'DEPT_AND_CHILDREN',
        'ALL'
    ) NOT NULL DEFAULT 'DEPT_ONLY',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_uds_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_uds_dept` FOREIGN KEY (`dept_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 17: Phạm vi dữ liệu theo phòng ban';

CREATE TABLE IF NOT EXISTS `user_dept_history` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `user_id` bigint unsigned NOT NULL,
    `from_dept_id` bigint unsigned NULL,
    `to_dept_id` bigint unsigned NOT NULL,
    `transfer_date` date NOT NULL,
    `decision_number` varchar(100) DEFAULT NULL,
    `reason` text,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_hist_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 18: Lịch sử điều động nhân sự';

CREATE TABLE IF NOT EXISTS `user_delegations` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `delegator_id` bigint unsigned NOT NULL,
    `delegatee_id` bigint unsigned NOT NULL,
    `scope` enum(
        'FULL',
        'SPECIFIC_ROLES',
        'SPECIFIC_PERMS'
    ) NOT NULL DEFAULT 'SPECIFIC_ROLES',
    `inherit_data_scope` tinyint(1) NOT NULL DEFAULT 0,
    `starts_at` timestamp NOT NULL,
    `expires_at` timestamp NOT NULL,
    `is_active` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_del_delegator` FOREIGN KEY (`delegator_id`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_del_delegatee` FOREIGN KEY (`delegatee_id`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 19: Ủy quyền tạm thời';

CREATE TABLE IF NOT EXISTS `user_delegation_items` (
    `delegation_id` bigint unsigned NOT NULL,
    `item_type` enum('ROLE', 'PERMISSION') NOT NULL,
    `item_id` bigint unsigned NOT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (
        `delegation_id`,
        `item_type`,
        `item_id`
    ),
    CONSTRAINT `fk_deli_del` FOREIGN KEY (`delegation_id`) REFERENCES `user_delegations` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 20: Chi tiết Role/Perm được ủy quyền';

CREATE TABLE IF NOT EXISTS `raci_assignments` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `entity_type` varchar(50) NOT NULL COMMENT 'contract | project | opportunity',
    `entity_id` bigint unsigned NOT NULL,
    `user_id` bigint unsigned NOT NULL,
    `raci_role` enum('R', 'A', 'C', 'I') NOT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_raci_entity_user` (
        `entity_type`,
        `entity_id`,
        `user_id`
    ),
    INDEX `idx_raci_entity` (`entity_type`, `entity_id`),
    CONSTRAINT `fk_raci_user_global` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 21: Ma trận RACI tổng thể';

-- ===================================================================================
-- PHẦN 3: BUSINESS CORE - QUẢN LÝ DỰ ÁN, KHÁCH HÀNG, HỢP ĐỒNG
-- ===================================================================================

CREATE TABLE IF NOT EXISTS `business_domains` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `domain_code` varchar(50) UNIQUE NOT NULL,
    `domain_name` varchar(100) NOT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 22: Lĩnh vực kinh doanh';

CREATE TABLE IF NOT EXISTS `vendors` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `vendor_code` varchar(50) UNIQUE NOT NULL,
    `vendor_name` varchar(150) NOT NULL,
    `is_active` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 23: Đối tác / Nhà cung cấp';

CREATE TABLE IF NOT EXISTS `products` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `product_code` varchar(50) UNIQUE NOT NULL,
    `product_name` varchar(255) NOT NULL,
    `domain_id` bigint unsigned NOT NULL,
    `vendor_id` bigint unsigned NOT NULL,
    `standard_price` decimal(15, 2) DEFAULT 0,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_prod_domain` FOREIGN KEY (`domain_id`) REFERENCES `business_domains` (`id`),
    CONSTRAINT `fk_prod_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 24: Danh mục sản phẩm/dịch vụ';

CREATE TABLE IF NOT EXISTS `customers` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `customer_code` varchar(50) UNIQUE NOT NULL,
    `customer_name` varchar(255) NOT NULL,
    `tax_code` varchar(20) DEFAULT NULL,
    `address` varchar(255) DEFAULT NULL,
    `is_active` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 25: Khách hàng doanh nghiệp';

CREATE TABLE IF NOT EXISTS `customer_personnel` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `customer_id` bigint unsigned NOT NULL,
    `full_name` varchar(100) NOT NULL,
    `position_type` enum(
        'GIAM_DOC',
        'TRUONG_PHONG',
        'DAU_MOI'
    ) NOT NULL,
    `phone` varchar(20) DEFAULT NULL,
    `email` varchar(100) DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_cust_pers_owner` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 26: Đầu mối liên hệ khách hàng';

CREATE TABLE IF NOT EXISTS `opportunities` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `opp_name` varchar(255) NOT NULL,
    `customer_id` bigint unsigned NOT NULL,
    `expected_value` decimal(18, 2) NOT NULL DEFAULT 0,
    `probability` int DEFAULT 0 COMMENT 'Tỉ lệ thành công %',
    `stage` enum(
        'NEW',
        'LEAD',
        'QUALIFIED',
        'PROPOSAL',
        'NEGOTIATION',
        'WON',
        'LOST'
    ) NOT NULL DEFAULT 'NEW',
    `dept_id` bigint unsigned NULL COMMENT 'Phòng ban phụ trách',
    `owner_id` bigint unsigned NOT NULL COMMENT 'Sales phụ trách',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Soft Delete',
    PRIMARY KEY (`id`),
    INDEX `idx_opp_cust_stage` (`customer_id`, `stage`),
    CONSTRAINT `fk_opp_cust` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_opp_owner` FOREIGN KEY (`owner_id`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 27: Cơ hội kinh doanh (Pipeline)';

CREATE TABLE IF NOT EXISTS `projects` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `project_code` varchar(50) UNIQUE NOT NULL,
    `project_name` varchar(255) NOT NULL,
    `customer_id` bigint unsigned NOT NULL,
    `opportunity_id` bigint unsigned NULL,
    `investment_mode` enum('DAU_TU', 'THUE_DICH_VU') DEFAULT 'DAU_TU',
    `start_date` date NOT NULL,
    `expected_end_date` date DEFAULT NULL,
    `status` enum(
        'PLANNING',
        'ONGOING',
        'COMPLETED',
        'CANCELLED',
        'SUSPENDED'
    ) NOT NULL DEFAULT 'PLANNING',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Soft Delete',
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_proj_cust_link` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_proj_opp` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 28: Dự án';

CREATE TABLE IF NOT EXISTS `project_items` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `project_id` bigint unsigned NOT NULL,
    `product_id` bigint unsigned NOT NULL,
    `quantity` decimal(12, 2) DEFAULT 1,
    `unit_price` decimal(15, 2) DEFAULT 0,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    `deleted_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_item_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_item_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 29: Hạng mục chi tiết dự án';

CREATE TABLE IF NOT EXISTS `contracts` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `contract_code` varchar(100) UNIQUE NOT NULL,
    `contract_name` varchar(255) NOT NULL,
    `project_id` bigint unsigned NOT NULL,
    `customer_id` bigint unsigned NOT NULL,
    `sign_date` date NOT NULL,
    `expiry_date` date DEFAULT NULL,
    `total_value` decimal(18, 2) NOT NULL DEFAULT 0,
    `status` enum(
        'DRAFT',
        'PENDING',
        'SIGNED',
        'EXPIRED',
        'TERMINATED',
        'LIQUIDATED'
    ) DEFAULT 'DRAFT',
    `dept_id` bigint unsigned NULL COMMENT 'Sở hữu dữ liệu',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    `deleted_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_cont_status_exp` (`status`, `expiry_date`),
    CONSTRAINT `fk_cont_proj_link` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
    CONSTRAINT `fk_cont_cust_link` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 30: Hợp đồng kinh tế';

CREATE TABLE IF NOT EXISTS `document_types` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `type_code` varchar(50) UNIQUE NOT NULL,
    `type_name` varchar(100) NOT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 31: Loại tài liệu';

CREATE TABLE IF NOT EXISTS `documents` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `document_code` varchar(50) UNIQUE NOT NULL,
    `document_name` varchar(255) NOT NULL,
    `document_type_id` bigint unsigned NOT NULL,
    `customer_id` bigint unsigned NOT NULL,
    `project_id` bigint unsigned DEFAULT NULL,
    `expiry_date` date DEFAULT NULL,
    `status` enum(
        'ACTIVE',
        'SUSPENDED',
        'EXPIRED'
    ) DEFAULT 'ACTIVE',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_doc_type` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`id`),
    CONSTRAINT `fk_doc_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 32: Hồ sơ / Công văn / Tài liệu';

CREATE TABLE IF NOT EXISTS `attachments` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `reference_type` enum(
        'DOCUMENT',
        'CONTRACT',
        'PROJECT',
        'CUSTOMER',
        'OPPORTUNITY'
    ) NOT NULL,
    `reference_id` bigint unsigned NOT NULL,
    `file_name` varchar(255) NOT NULL,
    `file_url` text,
    `drive_file_id` varchar(100) DEFAULT NULL,
    `file_size` bigint unsigned DEFAULT 0,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 33: File đính kèm';

CREATE TABLE IF NOT EXISTS `reminders` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `reminder_title` varchar(255) NOT NULL,
    `content` text,
    `project_id` bigint unsigned DEFAULT NULL,
    `contract_id` bigint unsigned DEFAULT NULL,
    `remind_date` datetime NOT NULL,
    `assigned_to` bigint unsigned NOT NULL,
    `is_read` tinyint(1) DEFAULT 0,
    `status` enum(
        'ACTIVE',
        'COMPLETED',
        'CANCELLED'
    ) DEFAULT 'ACTIVE',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_remind_user` FOREIGN KEY (`assigned_to`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 34: Hệ thống nhắc việc';

-- ===================================================================================
-- PHẦN 4: AUDIT LOGS (ĐÃ FIX LỖI)
-- Chú ý: Cột created_at ĐÃ NẰM TRONG PRIMARY KEY để Partition hoạt động đúng.
-- ===================================================================================

CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) NOT NULL DEFAULT(UUID()),
    `event` enum(
        'INSERT',
        'UPDATE',
        'DELETE',
        'RESTORE'
    ) NOT NULL,
    `auditable_type` varchar(255) NOT NULL,
    `auditable_id` bigint unsigned NOT NULL,
    `old_values` json DEFAULT NULL,
    `new_values` json DEFAULT NULL,
    `url` varchar(255) DEFAULT NULL,
    `ip_address` varchar(45) DEFAULT NULL,
    `user_agent` varchar(255) DEFAULT NULL,
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL COMMENT 'Actor ID (Không nối FK để Partition)',
    PRIMARY KEY (`id`, `created_at`),
    INDEX `idx_audit_uuid` (`uuid`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bảng 35: Lịch sử Audit'
PARTITION BY
    RANGE (MONTH(created_at)) (
        PARTITION p_jan
        VALUES
            LESS THAN (2),
            PARTITION p_feb
        VALUES
            LESS THAN (3),
            PARTITION p_mar
        VALUES
            LESS THAN (4),
            PARTITION p_apr
        VALUES
            LESS THAN (5),
            PARTITION p_may
        VALUES
            LESS THAN (6),
            PARTITION p_jun
        VALUES
            LESS THAN (7),
            PARTITION p_jul
        VALUES
            LESS THAN (8),
            PARTITION p_aug
        VALUES
            LESS THAN (9),
            PARTITION p_sep
        VALUES
            LESS THAN (10),
            PARTITION p_oct
        VALUES
            LESS THAN (11),
            PARTITION p_nov
        VALUES
            LESS THAN (12),
            PARTITION p_dec
        VALUES
            LESS THAN (13)
    );

-- BỔ SUNG MODULE QUẢN LÝ DÒNG TIỀN & DOANH THU (CASH FLOW)
-- =====================================================================

-- 1. Bổ sung trường "Chu kỳ thanh toán" vào bảng hợp đồng
-- Hỗ trợ phân loại: 1 lần (ONCE), Hàng tháng (MONTHLY), Hàng quý (QUARTERLY), 6 tháng (HALF_YEARLY)
ALTER TABLE `contracts`
ADD COLUMN `payment_cycle` ENUM(
    'ONCE',
    'MONTHLY',
    'QUARTERLY',
    'HALF_YEARLY',
    'YEARLY'
) DEFAULT 'ONCE' COMMENT 'Chu kỳ thanh toán' AFTER `total_value`;

-- 2. Tạo bảng Quản lý Kỳ thanh toán (Dòng tiền dự kiến & Thực thu)

SET FOREIGN_KEY_CHECKS = 0;

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

-- Đảm bảo sử dụng đúng database
USE `vnpt_business_db`;

-- 1. Bổ sung trường "Chu kỳ thanh toán" vào bảng hợp đồng
-- Sử dụng câu lệnh an toàn (chỉ thêm nếu chưa tồn tại trường này)

-- 2. Tạo bảng Quản lý Kỳ thanh toán (Dòng tiền dự kiến & Thực thu)


CREATE TABLE IF NOT EXISTS `payment_schedules` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `contract_id` bigint unsigned NOT NULL,
    -- project_id để NULL mặc định vì sẽ được Trigger tự động điền từ contract_id
    `project_id` bigint unsigned DEFAULT NULL,
    
    `milestone_name` varchar(255) NOT NULL COMMENT 'Tên kỳ (VD: Thanh toán đợt 1, Tháng 1/2026)',
    `cycle_number` int DEFAULT 1 COMMENT 'Số thứ tự kỳ (1, 2, 3...)',

-- Dòng tiền dự kiến (Dùng để Forecast)
`expected_date` date NOT NULL COMMENT 'Ngày dự kiến phải thu',
`expected_amount` decimal(18, 2) NOT NULL DEFAULT 0 COMMENT 'Số tiền dự kiến thu',

-- Dòng tiền thực tế (Dùng để chốt Doanh thu thực)
`actual_paid_date` date DEFAULT NULL COMMENT 'Ngày khách hàng thực trả',
`actual_paid_amount` decimal(18, 2) NOT NULL DEFAULT 0 COMMENT 'Số tiền thực tế đã thu',
`status` enum(
    'PENDING',
    'INVOICED',
    'PARTIAL',
    'PAID',
    'OVERDUE',
    'CANCELLED'
) DEFAULT 'PENDING' COMMENT 'Trạng thái thu tiền',
`notes` text,
`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`id`),

-- Index tối ưu báo cáo Doanh thu & Dòng tiền theo thời gian


INDEX `idx_ps_forecast` (`expected_date`, `status`),
    INDEX `idx_ps_actual` (`actual_paid_date`),
    INDEX `idx_ps_project` (`project_id`),
    
    CONSTRAINT `fk_ps_contract` FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ps_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 36: Kế hoạch thanh toán & Dòng tiền';
-- ===================================================================================
-- PHẦN 5: SEED DATA CƠ BẢN (KHỞI TẠO HỆ THỐNG)
-- ===================================================================================

-- 1. Insert Danh mục chức danh
INSERT IGNORE INTO
    `positions` (
        `pos_code`,
        `pos_name`,
        `pos_level`
    )
VALUES ('GD', 'Giám đốc', 5),
    ('PGD', 'Phó Giám đốc', 4),
    ('TP', 'Trưởng phòng', 3),
    ('PP', 'Phó phòng', 2),
    ('CV', 'Chuyên viên', 1);

-- 2. Insert Danh mục vai trò
INSERT IGNORE INTO
    `roles` (
        `role_code`,
        `role_name`,
        `is_system`,
        `description`
    )
VALUES (
        'ADMIN',
        'Quản trị hệ thống',
        1,
        'Quyền tối cao toàn hệ thống'
    ),
    (
        'DIRECTOR',
        'Ban Giám đốc',
        1,
        'Theo dõi toàn bộ dự án, hợp đồng'
    ),
    (
        'MANAGER',
        'Quản lý cấp trung',
        1,
        'Quản lý phòng ban'
    ),
    (
        'STAFF',
        'Nhân viên',
        1,
        'Quyền cơ bản thao tác nghiệp vụ'
    );

-- 3. Insert User mặc định (Mật khẩu: password)
INSERT IGNORE INTO
    `internal_users` (
        `user_code`,
        `username`,
        `password`,
        `full_name`,
        `email`,
        `status`
    )
VALUES (
        'ADMIN001',
        'admin',
        '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'System Admin',
        'admin@vnpt.vn',
        'ACTIVE'
    ),
    (
        'DIR001',
        'director',
        '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'Giám đốc Demo',
        'director@vnpt.vn',
        'ACTIVE'
    ),
    (
        'MAN001',
        'manager',
        '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'Trưởng phòng Demo',
        'manager@vnpt.vn',
        'ACTIVE'
    );

-- 4. Gán Role cho User mặc định
INSERT IGNORE INTO
    `user_roles` (
        `user_id`,
        `role_id`,
        `is_active`
    )
SELECT u.id, r.id, 1
FROM `internal_users` u, `roles` r
WHERE
    u.username = 'admin'
    AND r.role_code = 'ADMIN';

INSERT IGNORE INTO
    `user_roles` (
        `user_id`,
        `role_id`,
        `is_active`
    )
SELECT u.id, r.id, 1
FROM `internal_users` u, `roles` r
WHERE
    u.username = 'director'
    AND r.role_code = 'DIRECTOR';

INSERT IGNORE INTO
    `user_roles` (
        `user_id`,
        `role_id`,
        `is_active`
    )
SELECT u.id, r.id, 1
FROM `internal_users` u, `roles` r
WHERE
    u.username = 'manager'
    AND r.role_code = 'MANAGER';

-- ===================================================================================
-- BẬT LẠI CHECK KHÓA NGOẠI SAU KHI INSERT XONG
-- ===================================================================================

-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

SET FOREIGN_KEY_CHECKS = 1;