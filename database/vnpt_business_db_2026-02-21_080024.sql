-- MySQL dump 10.13  Distrib 9.6.0, for macos26.2 (arm64)
--
-- Host: 127.0.0.1    Database: vnpt_business_db
-- ------------------------------------------------------
-- Server version	9.6.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */
;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */
;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */
;
/*!50503 SET NAMES utf8mb4 */
;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */
;
/*!40103 SET TIME_ZONE='+00:00' */
;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */
;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */
;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */
;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */
;

--
-- GTID state at the beginning of the backup
--

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `attachments` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `reference_type` enum(
        'DOCUMENT',
        'CONTRACT',
        'PROJECT',
        'CUSTOMER',
        'OPPORTUNITY'
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `reference_id` bigint unsigned NOT NULL,
    `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `drive_file_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `file_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    `mime_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `file_size` bigint unsigned DEFAULT '0',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    KEY `idx_ref` (
        `reference_type`,
        `reference_id`
    ),
    KEY `fk_attach_cb` (`created_by`),
    KEY `fk_attach_ub` (`updated_by`),
    CONSTRAINT `fk_attach_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_attach_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `business_domains`
--

DROP TABLE IF EXISTS `business_domains`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `business_domains` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `domain_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã lĩnh vực',
    `domain_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên lĩnh vực',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `domain_code` (`domain_code`),
    KEY `fk_dom_cb` (`created_by`),
    KEY `fk_dom_ub` (`updated_by`),
    CONSTRAINT `fk_dom_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_dom_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Lĩnh vực kinh doanh';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `cache` (
    `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
    `expiration` int NOT NULL,
    PRIMARY KEY (`key`),
    KEY `cache_expiration_index` (`expiration`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `cache_locks` (
    `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `expiration` int NOT NULL,
    PRIMARY KEY (`key`),
    KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `contracts`
--

DROP TABLE IF EXISTS `contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `contracts` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `contract_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    `project_id` bigint unsigned NOT NULL,
    `sign_date` date NOT NULL,
    `expiry_date` date DEFAULT NULL,
    `total_value` decimal(18, 2) NOT NULL DEFAULT '0.00',
    `status` enum(
        'DRAFT',
        'SIGNED',
        'EXPIRED',
        'TERMINATED'
    ) COLLATE utf8mb4_unicode_ci DEFAULT 'SIGNED',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `contract_number` (`contract_number`),
    KEY `fk_contract_proj` (`project_id`),
    KEY `fk_cont_cb` (`created_by`),
    KEY `fk_cont_ub` (`updated_by`),
    CONSTRAINT `fk_cont_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_cont_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_contract_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Hợp đồng kinh tế';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `customer_personnel`
--

DROP TABLE IF EXISTS `customer_personnel`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `customer_personnel` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `customer_id` bigint unsigned NOT NULL,
    `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    `position_type` enum(
        'GIAM_DOC',
        'TRUONG_PHONG',
        'DAU_MOI'
    ) COLLATE utf8mb4_unicode_ci NOT NULL,
    `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    `birthday` date DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    KEY `fk_cust_pers_owner` (`customer_id`),
    KEY `fk_cper_cb` (`created_by`),
    KEY `fk_cper_ub` (`updated_by`),
    CONSTRAINT `fk_cper_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_cper_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_cust_pers_owner` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Đầu mối liên hệ khách hàng';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `customers` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `customer_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `company_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `tax_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `address` text COLLATE utf8mb4_unicode_ci,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `customer_code` (`customer_code`),
    KEY `fk_cust_cb` (`created_by`),
    KEY `fk_cust_ub` (`updated_by`),
    CONSTRAINT `fk_cust_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_cust_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Thông tin khách hàng';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `departments` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID nội bộ',
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()) COMMENT 'UUID dùng cho API',
    `dept_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã phòng ban',
    `dept_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên phòng ban',
    `parent_id` bigint unsigned DEFAULT NULL COMMENT 'ID cấp cha',
    `dept_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Đường dẫn cây đơn vị',
    `status` enum('ACTIVE', 'INACTIVE') COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE' COMMENT 'Trạng thái',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `dept_code` (`dept_code`),
    KEY `idx_dept_status` (`status`),
    KEY `fk_dept_parent` (`parent_id`),
    KEY `fk_dept_cb` (`created_by`),
    KEY `fk_dept_ub` (`updated_by`),
    CONSTRAINT `fk_dept_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_dept_parent` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`),
    CONSTRAINT `fk_dept_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 27 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Cơ cấu tổ chức VNPT';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `document_types`
--

DROP TABLE IF EXISTS `document_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `document_types` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `type_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `type_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `type_code` (`type_code`),
    KEY `fk_dtype_cb` (`created_by`),
    KEY `fk_dtype_ub` (`updated_by`),
    CONSTRAINT `fk_dtype_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_dtype_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Danh mục loại tài liệu';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `documents` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `document_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `document_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `document_type_id` bigint unsigned NOT NULL,
    `customer_id` bigint unsigned NOT NULL,
    `project_id` bigint unsigned DEFAULT NULL,
    `expiry_date` date DEFAULT NULL,
    `status` enum(
        'ACTIVE',
        'SUSPENDED',
        'EXPIRED'
    ) COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `document_code` (`document_code`),
    KEY `idx_doc_project` (`project_id`),
    KEY `fk_doc_type_link` (`document_type_id`),
    KEY `fk_doc_cust_link` (`customer_id`),
    KEY `fk_doc_cb` (`created_by`),
    KEY `fk_doc_ub` (`updated_by`),
    CONSTRAINT `fk_doc_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_doc_cust_link` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
    CONSTRAINT `fk_doc_proj_link` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
    CONSTRAINT `fk_doc_type_link` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`id`),
    CONSTRAINT `fk_doc_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 41 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Quản lý hồ sơ';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `failed_jobs` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `connection` text COLLATE utf8mb4_unicode_ci NOT NULL,
    `queue` text COLLATE utf8mb4_unicode_ci NOT NULL,
    `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
    `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
    `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `internal_users`
--

DROP TABLE IF EXISTS `internal_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `internal_users` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `user_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã nhân viên',
    `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Họ tên',
    `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `phone_number` int unsigned NOT NULL,
    `dept_id` bigint unsigned NOT NULL,
    `job_title_raw` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Chức danh',
    `status` enum(
        'ACTIVE',
        'INACTIVE',
        'SUSPENDED'
    ) COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    `date_of_birth` date DEFAULT NULL COMMENT 'Ngày sinh',
    `gender` enum('MALE', 'FEMALE', 'OTHER') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Giới tính',
    `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP máy tính',
    ` vpn_status` enum('YES', 'NO') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Trạng thái VPN (Có/Chưa có)',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `user_code` (`user_code`),
    UNIQUE KEY `email` (`email`),
    KEY `idx_user_dept` (`dept_id`),
    KEY `fk_user_cb` (`created_by`),
    KEY `fk_user_ub` (`updated_by`),
    CONSTRAINT `fk_user_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_user_dept` FOREIGN KEY (`dept_id`) REFERENCES `departments` (`id`),
    CONSTRAINT `fk_user_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Danh sách nhân sự nội bộ';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `job_batches` (
    `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `total_jobs` int NOT NULL,
    `pending_jobs` int NOT NULL,
    `failed_jobs` int NOT NULL,
    `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
    `options` mediumtext COLLATE utf8mb4_unicode_ci,
    `cancelled_at` int DEFAULT NULL,
    `created_at` int NOT NULL,
    `finished_at` int DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `jobs` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
    `attempts` tinyint unsigned NOT NULL,
    `reserved_at` int unsigned DEFAULT NULL,
    `available_at` int unsigned NOT NULL,
    `created_at` int unsigned NOT NULL,
    PRIMARY KEY (`id`),
    KEY `jobs_queue_index` (`queue`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `migrations` (
    `id` int unsigned NOT NULL AUTO_INCREMENT,
    `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `batch` int NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 5 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `opportunities`
--

DROP TABLE IF EXISTS `opportunities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `opportunities` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `opp_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `customer_id` bigint unsigned NOT NULL,
    `expected_value` decimal(18, 2) DEFAULT '0.00',
    `probability` int DEFAULT '0',
    `stage` enum(
        'LEAD',
        'QUALIFIED',
        'PROPOSAL',
        'NEGOTIATION',
        'CLOSED_WON',
        'CLOSED_LOST'
    ) COLLATE utf8mb4_unicode_ci DEFAULT 'LEAD',
    `owner_id` bigint unsigned NOT NULL COMMENT 'Sales phụ trách',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    KEY `fk_opp_cust` (`customer_id`),
    KEY `fk_opp_owner` (`owner_id`),
    KEY `fk_opp_cb` (`created_by`),
    KEY `fk_opp_ub` (`updated_by`),
    CONSTRAINT `fk_opp_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_opp_cust` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
    CONSTRAINT `fk_opp_owner` FOREIGN KEY (`owner_id`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_opp_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Quản lý Pipeline';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `password_reset_tokens` (
    `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `created_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`email`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `personal_access_tokens` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `tokenable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `tokenable_id` bigint unsigned NOT NULL,
    `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
    `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
    `abilities` text COLLATE utf8mb4_unicode_ci,
    `last_used_at` timestamp NULL DEFAULT NULL,
    `expires_at` timestamp NULL DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
    KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (
        `tokenable_type`,
        `tokenable_id`
    ),
    KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `products` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `product_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `product_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `domain_id` bigint unsigned NOT NULL,
    `vendor_id` bigint unsigned NOT NULL,
    `standard_price` decimal(15, 2) DEFAULT '0.00',
    `unit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Cái/Gói',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `product_code` (`product_code`),
    KEY `fk_prod_domain` (`domain_id`),
    KEY `fk_prod_vendor` (`vendor_id`),
    KEY `fk_prod_cb` (`created_by`),
    KEY `fk_prod_ub` (`updated_by`),
    CONSTRAINT `fk_prod_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_prod_domain` FOREIGN KEY (`domain_id`) REFERENCES `business_domains` (`id`),
    CONSTRAINT `fk_prod_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_prod_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Danh mục sản phẩm dịch vụ';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `project_items`
--

DROP TABLE IF EXISTS `project_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `project_items` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `project_id` bigint unsigned NOT NULL,
    `product_id` bigint unsigned NOT NULL,
    `quantity` decimal(12, 2) DEFAULT '1.00',
    `unit_price` decimal(15, 2) NOT NULL DEFAULT '0.00',
    `discount_percent` decimal(5, 2) DEFAULT '0.00',
    `discount_amount` decimal(15, 2) DEFAULT '0.00',
    `line_total` decimal(18, 2) GENERATED ALWAYS AS (
        (
            (`quantity` * `unit_price`) - `discount_amount`
        )
    ) STORED,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    KEY `fk_item_proj_link` (`project_id`),
    KEY `fk_item_prod_link` (`product_id`),
    KEY `fk_pitem_cb` (`created_by`),
    KEY `fk_pitem_ub` (`updated_by`),
    CONSTRAINT `fk_item_prod_link` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
    CONSTRAINT `fk_item_proj_link` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_pitem_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_pitem_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Chi tiết hạng mục dự án';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `project_raci`
--

DROP TABLE IF EXISTS `project_raci`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `project_raci` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `project_id` bigint unsigned NOT NULL,
    `user_id` bigint unsigned NOT NULL,
    `role_type` enum('A', 'R', 'C', 'I') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `uq_project_user_role` (
        `project_id`,
        `user_id`,
        `role_type`
    ),
    KEY `fk_raci_user` (`user_id`),
    KEY `fk_raci_cb` (`created_by`),
    KEY `fk_raci_ub` (`updated_by`),
    CONSTRAINT `fk_raci_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_raci_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_raci_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_raci_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `projects` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `project_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `customer_id` bigint unsigned NOT NULL,
    `opportunity_id` bigint unsigned DEFAULT NULL,
    `project_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `investment_mode` enum('DAU_TU', 'THUE_DICH_VU') COLLATE utf8mb4_unicode_ci DEFAULT 'DAU_TU',
    `start_date` date NOT NULL,
    `expected_end_date` date DEFAULT NULL,
    `actual_end_date` date DEFAULT NULL,
    `status` enum(
        'ACTIVE',
        'COMPLETED',
        'SUSPENDED',
        'TERMINATED'
    ) COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `project_code` (`project_code`),
    KEY `idx_proj_cust_status` (`customer_id`, `status`),
    KEY `fk_proj_opp` (`opportunity_id`),
    KEY `fk_proj_cb` (`created_by`),
    KEY `fk_proj_ub` (`updated_by`),
    CONSTRAINT `fk_proj_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_proj_cust_link` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
    CONSTRAINT `fk_proj_opp` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`),
    CONSTRAINT `fk_proj_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Thông tin dự án';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `reminders`
--

DROP TABLE IF EXISTS `reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `reminders` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `reminder_title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `content` text COLLATE utf8mb4_unicode_ci,
    `project_id` bigint unsigned DEFAULT NULL,
    `contract_id` bigint unsigned DEFAULT NULL,
    `document_id` bigint unsigned DEFAULT NULL,
    `remind_date` datetime NOT NULL,
    `assigned_to_user_id` bigint unsigned NOT NULL,
    `is_read` tinyint(1) DEFAULT '0',
    `status` enum(
        'ACTIVE',
        'COMPLETED',
        'CANCELLED'
    ) COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    KEY `idx_remind_date_user` (
        `remind_date`,
        `assigned_to_user_id`
    ),
    KEY `fk_remind_user` (`assigned_to_user_id`),
    KEY `fk_remind_proj` (`project_id`),
    KEY `fk_remind_contract` (`contract_id`),
    KEY `fk_remind_doc` (`document_id`),
    KEY `fk_rem_cb` (`created_by`),
    KEY `fk_rem_ub` (`updated_by`),
    CONSTRAINT `fk_rem_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_rem_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_remind_contract` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`id`),
    CONSTRAINT `fk_remind_doc` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`),
    CONSTRAINT `fk_remind_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
    CONSTRAINT `fk_remind_user` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 41 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Hệ thống nhắc việc';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `sessions` (
    `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `user_id` bigint unsigned DEFAULT NULL,
    `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `user_agent` text COLLATE utf8mb4_unicode_ci,
    `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
    `last_activity` int NOT NULL,
    PRIMARY KEY (`id`),
    KEY `sessions_user_id_index` (`user_id`),
    KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `user_dept_history`
--

DROP TABLE IF EXISTS `user_dept_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `user_dept_history` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `history_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã vết điều động',
    `user_id` bigint unsigned NOT NULL,
    `from_dept_id` bigint unsigned DEFAULT NULL,
    `to_dept_id` bigint unsigned NOT NULL,
    `transfer_date` date NOT NULL,
    `decision_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Số quyết định',
    `reason` text COLLATE utf8mb4_unicode_ci COMMENT 'Lý do',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `history_code` (`history_code`),
    KEY `fk_hist_user` (`user_id`),
    KEY `fk_hist_from` (`from_dept_id`),
    KEY `fk_hist_to` (`to_dept_id`),
    KEY `fk_hist_cb` (`created_by`),
    KEY `fk_hist_ub` (`updated_by`),
    CONSTRAINT `fk_hist_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_hist_from` FOREIGN KEY (`from_dept_id`) REFERENCES `departments` (`id`),
    CONSTRAINT `fk_hist_to` FOREIGN KEY (`to_dept_id`) REFERENCES `departments` (`id`),
    CONSTRAINT `fk_hist_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_hist_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Lịch sử điều động phòng ban';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `users` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `email_verified_at` timestamp NULL DEFAULT NULL,
    `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `users_email_unique` (`email`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `vendors` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT(uuid()),
    `vendor_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã đối tác',
    `vendor_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên đối tác',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` bigint unsigned DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` bigint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uuid` (`uuid`),
    UNIQUE KEY `vendor_code` (`vendor_code`),
    KEY `fk_vend_cb` (`created_by`),
    KEY `fk_vend_ub` (`updated_by`),
    CONSTRAINT `fk_vend_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
    CONSTRAINT `fk_vend_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Đối tác/Nhà cung cấp';
/*!40101 SET character_set_client = @saved_cs_client */
;

--
-- Dumping routines for database 'vnpt_business_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */
;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */
;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */
;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */
;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */
;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */
;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */
;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */
;

-- Dump completed on 2026-02-21  8:00:29