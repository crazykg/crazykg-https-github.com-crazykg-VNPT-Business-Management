-- MySQL dump 10.13  Distrib 9.6.0, for macos26.2 (arm64)
--
-- Host: 127.0.0.1    Database: vnpt_business_db
-- ------------------------------------------------------
-- Server version	9.6.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `async_exports`
--

DROP TABLE IF EXISTS `async_exports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `async_exports` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL,
  `module` varchar(80) NOT NULL,
  `format` varchar(20) NOT NULL DEFAULT 'csv',
  `status` varchar(30) NOT NULL DEFAULT 'QUEUED',
  `filters_json` longtext,
  `file_path` varchar(500) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `requested_by` bigint unsigned NOT NULL,
  `error_message` text,
  `started_at` timestamp NULL DEFAULT NULL,
  `finished_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `async_exports_uuid_unique` (`uuid`),
  KEY `idx_async_exports_requested_status_created` (`requested_by`,`status`,`created_at`),
  KEY `idx_async_exports_status_expires` (`status`,`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `reference_type` enum('DOCUMENT','CONTRACT','PROJECT','CUSTOMER','OPPORTUNITY','TRANSITION','WORKLOG','CUSTOMER_REQUEST') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bảng cha của file đính kèm',
  `reference_id` bigint unsigned NOT NULL,
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `drive_file_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint unsigned DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `mime_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storage_disk` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storage_path` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storage_visibility` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_attachments_reference` (`reference_type`,`reference_id`),
  KEY `idx_attach_primary` (`reference_type`,`reference_id`,`is_primary`),
  KEY `idx_attach_storage_lookup` (`storage_disk`,`storage_path`(191))
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 33: File đính kèm';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `event` enum('INSERT','UPDATE','DELETE','RESTORE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `auditable_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `auditable_id` bigint unsigned NOT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL COMMENT 'Actor ID (Không nối FK để Partition)',
  PRIMARY KEY (`id`,`created_at`),
  KEY `idx_audit_uuid` (`uuid`),
  KEY `idx_audit_created_by` (`created_by`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 35: Lịch sử Audit'
/*!50100 PARTITION BY RANGE (month(`created_at`))
(PARTITION p_jan VALUES LESS THAN (2) ENGINE = InnoDB,
 PARTITION p_feb VALUES LESS THAN (3) ENGINE = InnoDB,
 PARTITION p_mar VALUES LESS THAN (4) ENGINE = InnoDB,
 PARTITION p_apr VALUES LESS THAN (5) ENGINE = InnoDB,
 PARTITION p_may VALUES LESS THAN (6) ENGINE = InnoDB,
 PARTITION p_jun VALUES LESS THAN (7) ENGINE = InnoDB,
 PARTITION p_jul VALUES LESS THAN (8) ENGINE = InnoDB,
 PARTITION p_aug VALUES LESS THAN (9) ENGINE = InnoDB,
 PARTITION p_sep VALUES LESS THAN (10) ENGINE = InnoDB,
 PARTITION p_oct VALUES LESS THAN (11) ENGINE = InnoDB,
 PARTITION p_nov VALUES LESS THAN (12) ENGINE = InnoDB,
 PARTITION p_dec VALUES LESS THAN (13) ENGINE = InnoDB) */;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_login_attempts`
--

DROP TABLE IF EXISTS `auth_login_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_login_attempts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `internal_user_id` bigint unsigned DEFAULT NULL,
  `status` enum('SUCCESS','FAILED') NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_auth_login_username_created` (`username`,`created_at`),
  KEY `idx_auth_login_ip_created` (`ip_address`,`created_at`),
  KEY `idx_auth_login_user_created` (`internal_user_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `business_domains`
--

DROP TABLE IF EXISTS `business_domains`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `business_domains` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `domain_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `domain_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `domain_code` (`domain_code`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 22: Lĩnh vực kinh doanh';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache` (
  `key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 2: Lưu trữ cache hệ thống';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cache_invalidation_queue`
--

DROP TABLE IF EXISTS `cache_invalidation_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_invalidation_queue` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `cache_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'VD: perm:123',
  `queued_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_ciq_unprocessed` (`processed`,`queued_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 7: Hàng đợi làm mới cache phân quyền';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 3: Quản lý khóa tài nguyên';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contracts`
--

DROP TABLE IF EXISTS `contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contracts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `contract_code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contract_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_id` bigint unsigned NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `sign_date` date NOT NULL,
  `effective_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `total_value` decimal(18,2) NOT NULL DEFAULT '0.00',
  `status` enum('DRAFT','SIGNED','RENEWED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'DRAFT',
  `dept_id` bigint unsigned DEFAULT NULL COMMENT 'Sở hữu dữ liệu',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `term_unit` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `term_value` decimal(10,2) DEFAULT NULL,
  `expiry_date_manual_override` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `contract_code` (`contract_code`),
  KEY `idx_cont_status_exp` (`status`,`expiry_date`),
  KEY `fk_cont_proj_link` (`project_id`),
  KEY `fk_cont_cust_link` (`customer_id`),
  KEY `idx_contracts_dept_id` (`dept_id`),
  CONSTRAINT `fk_cont_cust_link` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cont_proj_link` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fk_contracts_dept_id` FOREIGN KEY (`dept_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_contract_effective_not_before_sign` CHECK (((`sign_date` is null) or (`effective_date` is null) or (`effective_date` >= `sign_date`))),
  CONSTRAINT `chk_contract_expiry_not_before_sign` CHECK (((`sign_date` is null) or (`expiry_date` is null) or (`expiry_date` >= `sign_date`))),
  CONSTRAINT `chk_contract_required_dates_non_draft` CHECK (((upper(coalesce(`status`,_utf8mb4'DRAFT')) in (_utf8mb4'DRAFT',_utf8mb4'PENDING')) or ((`effective_date` is not null) and (`expiry_date` is not null))))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 30: Hợp đồng kinh tế';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_personnel`
--

DROP TABLE IF EXISTS `customer_personnel`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_personnel` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint unsigned NOT NULL,
  `full_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_of_birth` date DEFAULT NULL,
  `position_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `position_id` bigint unsigned DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cust_pers_owner` (`customer_id`),
  KEY `idx_customer_personnel_position_id` (`position_id`),
  KEY `idx_customer_personnel_deleted_at` (`deleted_at`),
  KEY `idx_customer_personnel_status` (`status`),
  CONSTRAINT `fk_cust_pers_owner` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_customer_personnel_position` FOREIGN KEY (`position_id`) REFERENCES `support_contact_positions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=131 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 26: Đầu mối liên hệ khách hàng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_requests`
--

DROP TABLE IF EXISTS `customer_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL,
  `request_code` varchar(80) NOT NULL,
  `status_catalog_id` bigint unsigned DEFAULT NULL,
  `summary` varchar(500) NOT NULL,
  `customer_id` bigint unsigned DEFAULT NULL,
  `requester_name` varchar(120) DEFAULT NULL,
  `reporter_contact_id` bigint unsigned DEFAULT NULL,
  `service_group_id` bigint unsigned DEFAULT NULL,
  `project_item_id` bigint unsigned DEFAULT NULL,
  `project_id` bigint unsigned DEFAULT NULL,
  `product_id` bigint unsigned DEFAULT NULL,
  `receiver_user_id` bigint unsigned DEFAULT NULL,
  `assignee_id` bigint unsigned DEFAULT NULL,
  `status` varchar(50) NOT NULL,
  `sub_status` varchar(50) DEFAULT NULL,
  `priority` enum('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
  `requested_date` date DEFAULT NULL,
  `latest_transition_id` bigint unsigned DEFAULT NULL,
  `reference_ticket_code` varchar(100) DEFAULT NULL,
  `reference_request_id` bigint unsigned DEFAULT NULL,
  `transition_metadata` json DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_requests_uuid_unique` (`uuid`),
  UNIQUE KEY `customer_requests_request_code_unique` (`request_code`),
  KEY `idx_cr_status_flow` (`status`,`sub_status`,`priority`),
  KEY `idx_cr_customer_group` (`customer_id`,`service_group_id`),
  KEY `idx_cr_assignee` (`assignee_id`,`deleted_at`),
  KEY `idx_cr_requested_date` (`requested_date`,`deleted_at`),
  KEY `idx_cr_status_catalog` (`status_catalog_id`),
  KEY `idx_cr_project_item_deleted` (`project_item_id`,`deleted_at`),
  KEY `idx_cr_reporter_contact_deleted` (`reporter_contact_id`,`deleted_at`),
  KEY `idx_cr_reference_ticket_code` (`reference_ticket_code`),
  KEY `idx_cr_reference_request_id` (`reference_request_id`),
  CONSTRAINT `chk_cr_exchange_feedback_date_order` CHECK ((((coalesce(nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.exchange_date')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaytraodoilaivoikhachhang')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaytraodilivikhachhang')),_utf8mb4'')) is null) or regexp_like(coalesce(nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.exchange_date')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaytraodoilaivoikhachhang')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaytraodilivikhachhang')),_utf8mb4'')),_utf8mb4'^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) and ((coalesce(nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.customer_feedback_date')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaykhachhangphanhoi')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaykhacahangphnhi')),_utf8mb4'')) is null) or regexp_like(coalesce(nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.customer_feedback_date')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaykhachhangphanhoi')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaykhacahangphnhi')),_utf8mb4'')),_utf8mb4'^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) and ((coalesce(nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.exchange_date')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaytraodoilaivoikhachhang')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaytraodilivikhachhang')),_utf8mb4'')) is null) or (coalesce(nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.customer_feedback_date')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaykhachhangphanhoi')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaykhacahangphnhi')),_utf8mb4'')) is null) or (coalesce(nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.exchange_date')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaytraodoilaivoikhachhang')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaytraodilivikhachhang')),_utf8mb4'')) <= coalesce(nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.customer_feedback_date')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaykhachhangphanhoi')),_utf8mb4''),nullif(json_unquote(json_extract(`transition_metadata`,_utf8mb4'$.field_ngaykhacahangphnhi')),_utf8mb4''))))))
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tax_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_code` (`customer_code`),
  KEY `idx_customers_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 25: Khách hàng doanh nghiệp';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `dept_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `dept_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `dept_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Định dạng 1/2/5/',
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `dept_code` (`dept_code`),
  KEY `fk_dept_parent` (`parent_id`),
  KEY `idx_departments_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_dept_parent` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 8: Cơ cấu tổ chức phòng ban';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `document_product_links`
--

DROP TABLE IF EXISTS `document_product_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_product_links` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `document_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_document_product_links_pair` (`document_id`,`product_id`),
  KEY `idx_document_product_links_product` (`product_id`),
  CONSTRAINT `document_product_links_document_id_foreign` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `document_product_links_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `document_types`
--

DROP TABLE IF EXISTS `document_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_types` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `type_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `type_code` (`type_code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 31: Loại tài liệu';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `document_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_type_id` bigint unsigned NOT NULL,
  `customer_id` bigint unsigned DEFAULT NULL,
  `project_id` bigint unsigned DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `status` enum('ACTIVE','SUSPENDED','EXPIRED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_code` (`document_code`),
  KEY `fk_doc_type` (`document_type_id`),
  KEY `fk_doc_proj` (`project_id`),
  KEY `idx_documents_customer_id` (`customer_id`),
  KEY `idx_documents_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_doc_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_doc_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fk_doc_type` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 32: Hồ sơ / Công văn / Tài liệu';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 5: Các job bị lỗi';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `integration_settings`
--

DROP TABLE IF EXISTS `integration_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `integration_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `provider` varchar(100) NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `contract_expiry_warning_days` smallint unsigned DEFAULT NULL,
  `contract_payment_warning_days` smallint unsigned DEFAULT NULL,
  `account_email` varchar(255) DEFAULT NULL,
  `access_key_id` varchar(255) DEFAULT NULL,
  `folder_id` varchar(255) DEFAULT NULL,
  `bucket_name` varchar(255) DEFAULT NULL,
  `bucket_id` varchar(255) DEFAULT NULL,
  `region` varchar(100) DEFAULT NULL,
  `endpoint` varchar(255) DEFAULT NULL,
  `scopes` varchar(500) DEFAULT NULL,
  `impersonate_user` varchar(255) DEFAULT NULL,
  `file_prefix` varchar(100) DEFAULT NULL,
  `service_account_json` longtext,
  `secret_access_key` longtext,
  `last_tested_at` timestamp NULL DEFAULT NULL,
  `last_test_status` varchar(20) DEFAULT NULL,
  `last_test_message` varchar(500) DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_settings_provider_unique` (`provider`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `internal_users`
--

DROP TABLE IF EXISTS `internal_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `internal_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_title_raw` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Chức danh gốc',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL COMMENT 'Ngày sinh',
  `gender` enum('MALE','FEMALE','OTHER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Giới tính',
  `phone_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','BANNED','SUSPENDED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `department_id` bigint unsigned NOT NULL,
  `position_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP máy tính',
  `vpn_status` enum('YES','NO') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'NO' COMMENT 'Trạng thái VPN',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `must_change_password` tinyint NOT NULL DEFAULT '0',
  `password_changed_at` timestamp NULL DEFAULT NULL,
  `password_reset_required_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `user_code` (`user_code`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_user_dept` (`department_id`),
  KEY `fk_user_pos` (`position_id`),
  KEY `idx_internal_users_pwd_change_status` (`must_change_password`,`status`),
  CONSTRAINT `fk_internal_users_department_id` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_user_pos` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 14: Thông tin nhân sự & Tài khoản đăng nhập';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` tinyint unsigned NOT NULL,
  `reserved_at` int unsigned DEFAULT NULL,
  `available_at` int unsigned NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 4: Hàng đợi công việc';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 1: Quản lý vết migration';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `opportunities`
--

DROP TABLE IF EXISTS `opportunities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `opportunities` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `opp_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `expected_value` decimal(18,2) NOT NULL DEFAULT '0.00',
  `probability` int DEFAULT '0' COMMENT 'Tỉ lệ thành công %',
  `stage` enum('NEW','LEAD','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NEW',
  `dept_id` bigint unsigned DEFAULT NULL COMMENT 'Phòng ban phụ trách',
  `owner_id` bigint unsigned NOT NULL COMMENT 'Sales phụ trách',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Soft Delete',
  PRIMARY KEY (`id`),
  KEY `idx_opp_cust_stage` (`customer_id`,`stage`),
  KEY `fk_opp_owner` (`owner_id`),
  CONSTRAINT `fk_opp_cust` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_opp_owner` FOREIGN KEY (`owner_id`) REFERENCES `internal_users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 27: Cơ hội kinh doanh (Pipeline)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `opportunity_stages`
--

DROP TABLE IF EXISTS `opportunity_stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `opportunity_stages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `stage_code` varchar(50) NOT NULL,
  `stage_name` varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_terminal` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_opportunity_stages_stage_code` (`stage_code`),
  KEY `idx_opportunity_stages_active_sort` (`is_active`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_schedules`
--

DROP TABLE IF EXISTS `payment_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_schedules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `contract_id` bigint unsigned NOT NULL,
  `project_id` bigint unsigned NOT NULL,
  `milestone_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên kỳ (VD: Thanh toán đợt 1, Tháng 1/2026, Quý 1/2026)',
  `cycle_number` int DEFAULT '1' COMMENT 'Số thứ tự kỳ thanh toán (1, 2, 3...)',
  `expected_date` date NOT NULL COMMENT 'Ngày dự kiến phải thu',
  `expected_amount` decimal(18,2) NOT NULL DEFAULT '0.00' COMMENT 'Số tiền dự kiến thu',
  `actual_paid_date` date DEFAULT NULL COMMENT 'Ngày khách hàng thực trả',
  `actual_paid_amount` decimal(18,2) NOT NULL DEFAULT '0.00' COMMENT 'Số tiền thực tế đã thu',
  `status` enum('PENDING','INVOICED','PARTIAL','PAID','OVERDUE','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'PENDING' COMMENT 'Trạng thái thu tiền',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ps_expected` (`expected_date`,`status`),
  KEY `idx_ps_actual` (`actual_paid_date`),
  KEY `fk_ps_contract` (`contract_id`),
  KEY `fk_ps_project` (`project_id`),
  KEY `idx_ps_contract_expected_status` (`contract_id`,`expected_date`,`status`),
  KEY `idx_ps_contract_expected` (`contract_id`,`expected_date`),
  CONSTRAINT `fk_ps_contract` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ps_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 36: Kế hoạch thanh toán & Dòng tiền dự kiến';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `perm_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `perm_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `perm_group` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `perm_key` (`perm_key`)
) ENGINE=InnoDB AUTO_INCREMENT=146 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 11: Danh mục quyền nguyên tử';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint unsigned NOT NULL,
  `name` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `abilities` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`),
  KEY `idx_personal_access_tokens_last_used_at` (`last_used_at`)
) ENGINE=InnoDB AUTO_INCREMENT=203 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `position_default_roles`
--

DROP TABLE IF EXISTS `position_default_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `position_default_roles` (
  `position_id` bigint unsigned NOT NULL,
  `role_id` bigint unsigned NOT NULL,
  `is_mandatory` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`position_id`,`role_id`),
  KEY `fk_pdr_role` (`role_id`),
  CONSTRAINT `fk_pdr_pos` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pdr_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 13: Vai trò mặc định theo chức danh';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `positions`
--

DROP TABLE IF EXISTS `positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `positions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `pos_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pos_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pos_level` int NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pos_code` (`pos_code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 9: Chức danh nhân sự';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `domain_id` bigint unsigned NOT NULL,
  `vendor_id` bigint unsigned NOT NULL,
  `standard_price` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_code` (`product_code`),
  KEY `fk_prod_domain` (`domain_id`),
  KEY `fk_prod_vendor` (`vendor_id`),
  KEY `idx_products_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_prod_domain` FOREIGN KEY (`domain_id`) REFERENCES `business_domains` (`id`),
  CONSTRAINT `fk_prod_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 24: Danh mục sản phẩm/dịch vụ';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_items`
--

DROP TABLE IF EXISTS `project_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `project_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `quantity` decimal(12,2) DEFAULT '1.00',
  `unit_price` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_item_proj` (`project_id`),
  KEY `fk_item_prod` (`product_id`),
  CONSTRAINT `fk_item_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_item_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=142 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 29: Hạng mục chi tiết dự án';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `project_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `opportunity_id` bigint unsigned DEFAULT NULL,
  `investment_mode` enum('DAU_TU','THUE_DICH_VU') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'DAU_TU',
  `start_date` date NOT NULL,
  `expected_end_date` date DEFAULT NULL,
  `status` enum('TRIAL','ONGOING','WARRANTY','COMPLETED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TRIAL',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Soft Delete',
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_code` (`project_code`),
  KEY `fk_proj_cust_link` (`customer_id`),
  KEY `fk_proj_opp` (`opportunity_id`),
  CONSTRAINT `fk_proj_cust_link` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_proj_opp` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=132 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 28: Dự án';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `raci_assignments`
--

DROP TABLE IF EXISTS `raci_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `raci_assignments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'contract | project | opportunity',
  `entity_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `raci_role` enum('R','A','C','I') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_raci_entity_user_role` (`entity_type`,`entity_id`,`user_id`,`raci_role`),
  KEY `idx_raci_entity` (`entity_type`,`entity_id`),
  KEY `fk_raci_user_global` (`user_id`),
  CONSTRAINT `fk_raci_user_global` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 21: Ma trận RACI tổng thể';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reminders`
--

DROP TABLE IF EXISTS `reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reminders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `reminder_title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `project_id` bigint unsigned DEFAULT NULL,
  `contract_id` bigint unsigned DEFAULT NULL,
  `remind_date` datetime NOT NULL,
  `assigned_to` bigint unsigned NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `status` enum('ACTIVE','COMPLETED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_remind_user` (`assigned_to`),
  CONSTRAINT `fk_remind_user` FOREIGN KEY (`assigned_to`) REFERENCES `internal_users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 34: Hệ thống nhắc việc';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `request_raci`
--

DROP TABLE IF EXISTS `request_raci`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `request_raci` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã yêu cầu. JOIN support_requests.request_code hoặc programming_requests.req_code.',
  `user_id` bigint unsigned NOT NULL COMMENT 'FK internal_users.id — Người được gán vai trò.',
  `raci_role` enum('R','A','C','I') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'R=Xử lý chính, A=Phê duyệt, C=Tư vấn, I=Watcher. Notification: A+I nhận auto, C nhận khi tag.',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned NOT NULL COMMENT 'FK internal_users.id — Người gán vai trò (có thể = user_id khi tự Watch).',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_request_raci` (`request_code`,`user_id`,`raci_role`),
  KEY `fk_req_raci_user` (`user_id`),
  CONSTRAINT `fk_req_raci_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ma trận RACI + Watcher. 1 row = 1 vai trò của 1 user trên 1 request. Hard delete khi bỏ.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `request_raci_assignments`
--

DROP TABLE IF EXISTS `request_raci_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `request_raci_assignments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_code` varchar(50) NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `raci_role` enum('R','A','C','I') NOT NULL,
  `last_notified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_req_raci_active` (`request_code`,`user_id`,`raci_role`),
  KEY `idx_raci_notify` (`request_code`,`raci_role`,`deleted_at`),
  KEY `idx_raci_user_role` (`user_id`,`raci_role`,`deleted_at`),
  KEY `idx_raci_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `request_ref_tasks`
--

DROP TABLE IF EXISTS `request_ref_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `request_ref_tasks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `source_type` enum('TRANSITION','WORKLOG') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TRANSITION → request_transitions.id | WORKLOG → request_worklogs.id',
  `source_id` bigint unsigned NOT NULL COMMENT 'ID bảng cha. Validate tồn tại ở backend trước INSERT.',
  `request_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Copy từ bảng cha. Query: WHERE task_code=? → biết request_code ngay.',
  `task_source` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IT360' COMMENT 'Hệ thống nguồn. Frontend dùng để render icon + base URL. Giá trị: IT360|JIRA|DMS|GITLAB|OTHER',
  `task_code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã task trên hệ thống nguồn. VD: IT-360, DMS-T001, SRQ-0001499820',
  `task_link` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'URL trực tiếp đến task. Frontend: <a href={task_link}>{task_code}</a>',
  `drive_file_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Google Drive File ID nếu task có tài liệu đính kèm.',
  `task_note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mô tả mối liên hệ. VD: "Ticket gốc phát sinh yêu cầu", "Task deploy lên staging"',
  `task_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Trạng thái task bên ngoài. VD: OPEN, IN_PROGRESS, DONE. Dùng cho sync 2 chiều nếu có.',
  `sort_order` smallint unsigned NOT NULL DEFAULT '0' COMMENT 'Thứ tự hiển thị. GD16 task list hiện theo sort_order ASC.',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned NOT NULL COMMENT 'FK internal_users.id',
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_reftask_source_sort` (`source_type`,`source_id`,`sort_order`,`deleted_at`),
  KEY `idx_reftask_task_code` (`task_code`,`task_source`,`request_code`),
  KEY `idx_reftask_request_code` (`request_code`,`source_type`,`deleted_at`),
  KEY `idx_reftask_source_system` (`task_source`,`task_code`),
  KEY `idx_reftask_drive_file` (`drive_file_id`),
  KEY `idx_reftask_updated_by` (`updated_by`)
) ENGINE=InnoDB AUTO_INCREMENT=203 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Task tham chiếu IT360/Jira/DMS. Polymorphic N:1 với transitions/worklogs.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `request_transitions`
--

DROP TABLE IF EXISTS `request_transitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `request_transitions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `request_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã yêu cầu chính (VD: SUP-2450776, REQDEV202501). Prefix xác định loại yêu cầu.',
  `request_summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Snapshot tiêu đề yêu cầu tại thời điểm tạo transition. Copy từ support_requests.summary hoặc programming_requests.req_name khi INSERT. KHÔNG sync khi bảng cha sửa summary — coi như snapshot.',
  `parent_request_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã yêu cầu cha (cây phân cấp). NULL = root request. Dùng cho tree view.',
  `customer_id` bigint unsigned DEFAULT NULL COMMENT 'FK customers.id — copy từ bảng cha',
  `project_id` bigint unsigned DEFAULT NULL COMMENT 'FK projects.id — copy từ bảng cha',
  `project_item_id` bigint unsigned DEFAULT NULL COMMENT 'FK project_items.id — copy từ bảng cha',
  `from_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Trạng thái trước. NULL nếu transition đầu tiên.',
  `to_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Trạng thái đích. VD: DANG_XU_LY, LAP_TRINH, HOAN_THANH',
  `sub_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Trạng thái con. NULL cho Support GD1-GD7 và GD8. Có giá trị cho GD10-GD18.',
  `new_assignee_id` bigint unsigned DEFAULT NULL COMMENT 'FK internal_users.id — Người được giao. Auto-INSERT request_raci role=R cho user này.',
  `hours_estimated` decimal(6,2) DEFAULT NULL COMMENT 'Giờ dự kiến. Frontend hiển thị progress bar: actual/estimated.',
  `transition_metadata` json DEFAULT NULL COMMENT 'Dynamic form payload. Schema khác nhau theo (to_status, sub_status). Validate bằng JSON Schema trước INSERT.',
  `doc_link` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'URL file chính đính kèm (Google Drive share link). 1 file duy nhất — N files dùng bảng attachments.',
  `drive_file_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Google Drive File ID — dùng Google Drive API để download/preview.',
  `transition_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chú công khai — hiển thị trên timeline, portal KH.',
  `internal_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chú nội bộ — CHỈ hiển thị cho internal_users. Ẩn hoàn toàn với KH.',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned NOT NULL COMMENT 'FK internal_users.id — Người submit form chuyển trạng thái',
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL COMMENT 'FK internal_users.id — Người chỉnh sửa cuối (admin/lead)',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Soft delete. NULL=active. WHERE deleted_at IS NULL cho mọi query.',
  `sla_due_time` datetime DEFAULT NULL COMMENT 'Hạn chót SLA. Backend tính: NOW() + sla_configs.resolution_hours. Frontend: countdown timer.',
  `is_sla_breached` tinyint(1) DEFAULT '0' COMMENT '0=Đúng hạn, 1=Vi phạm. Scheduled Job set=1 khi NOW()>sla_due_time. Frontend: badge đỏ/xanh.',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  KEY `idx_trans_lookup` (`request_code`,`created_at`),
  KEY `idx_trans_context` (`customer_id`,`project_id`,`created_at`),
  KEY `idx_trans_stats` (`request_code`,`to_status`,`created_at`),
  KEY `idx_trans_del_status` (`deleted_at`,`to_status`,`created_at`),
  KEY `idx_trans_assignee` (`new_assignee_id`,`deleted_at`),
  KEY `idx_trans_updated_by` (`updated_by`),
  KEY `idx_trans_parent_code` (`parent_request_code`,`created_at`),
  KEY `idx_trans_drive_file` (`drive_file_id`),
  KEY `idx_trans_sla` (`is_sla_breached`,`to_status`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử chuyển trạng thái + Dynamic form (YCHT+YCLT gộp). 1 row = 1 lần submit GD1-GD18.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `request_worklogs`
--

DROP TABLE IF EXISTS `request_worklogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `request_worklogs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `request_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã yêu cầu. JOIN support_requests.request_code hoặc programming_requests.req_code.',
  `request_summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Snapshot tiêu đề. Copy 1 lần khi INSERT, không sync sau.',
  `parent_request_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã yêu cầu cha. Dùng cho aggregate worklog theo cây.',
  `phase` enum('SUPPORT_HANDLE','ANALYZE','CODE','UPCODE','OTHER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OTHER' COMMENT 'Giai đoạn. Map: GD3→SUPPORT_HANDLE, GD8→ANALYZE, GD10→CODE, GD12→UPCODE.',
  `customer_id` bigint unsigned DEFAULT NULL COMMENT 'FK customers.id',
  `project_id` bigint unsigned DEFAULT NULL COMMENT 'FK projects.id',
  `project_item_id` bigint unsigned DEFAULT NULL COMMENT 'FK project_items.id',
  `report_date` date NOT NULL COMMENT 'Ngày LÀM VIỆC thực tế (≠ ngày nhập). Frontend default = today, cho phép chọn ngày cũ.',
  `hours_estimated` decimal(6,2) DEFAULT NULL COMMENT 'Giờ dự kiến baseline. Set lần đầu. Frontend: progress bar actual vs estimated.',
  `hours_spent` decimal(6,2) NOT NULL DEFAULT '0.00' COMMENT 'Số giờ thực tế trong ngày. SUM(hours_spent) = tổng giờ toàn request.',
  `progress_percent` tinyint unsigned DEFAULT NULL COMMENT 'Tiến độ tổng 0-100%. Frontend: progress bar. NULL = không cập nhật lần này.',
  `doc_link` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `drive_file_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `worklog_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mô tả công việc đã làm. Bắt buộc nhập. VD: "Fix bug login SSO, test 3 trường hợp."',
  `internal_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Nhận xét nội bộ (lead/admin). Ẩn với KH.',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned NOT NULL COMMENT 'FK internal_users.id — Nhân sự báo cáo',
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `activity_type` enum('CODING','MEETING','TESTING','DEPLOYMENT','SUPPORT','RESEARCH','TRAVEL') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CODING' COMMENT 'Loại hình công việc. Frontend: dropdown 7 options.',
  `is_billable` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=Tính phí KH, 0=Nội bộ/Bảo hành. Frontend: checkbox default checked.',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  KEY `idx_wl_lookup` (`request_code`,`report_date`),
  KEY `idx_wl_phase` (`request_code`,`phase`,`report_date`),
  KEY `idx_wl_user_date` (`created_by`,`report_date`),
  KEY `idx_wl_deleted` (`deleted_at`,`report_date`),
  KEY `idx_wl_stats_context` (`customer_id`,`project_id`,`report_date`),
  KEY `idx_wl_stats_task` (`request_code`,`report_date`),
  KEY `idx_wl_parent_code` (`parent_request_code`,`report_date`),
  KEY `idx_wl_drive_file` (`drive_file_id`),
  KEY `idx_wl_finance` (`is_billable`,`report_date`),
  CONSTRAINT `chk_wl_estimated_positive` CHECK (((`hours_estimated` is null) or (`hours_estimated` > 0))),
  CONSTRAINT `chk_wl_hours_non_negative` CHECK ((`hours_spent` >= 0)),
  CONSTRAINT `chk_wl_progress_range` CHECK (((`progress_percent` is null) or (`progress_percent` between 0 and 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Báo cáo tiến độ hàng ngày. 1 row = 1 lần log. GD3/GD10/GD12.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_permission`
--

DROP TABLE IF EXISTS `role_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permission` (
  `role_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `fk_rp_perm` (`permission_id`),
  CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 12: Gán quyền cho vai trò';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_role_id` bigint unsigned DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_code` (`role_code`),
  KEY `fk_role_parent` (`parent_role_id`),
  CONSTRAINT `fk_role_parent` FOREIGN KEY (`parent_role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 10: Nhóm quyền (Vai trò)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 6: Phiên làm việc người dùng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sla_configs`
--

DROP TABLE IF EXISTS `sla_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sla_configs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sub_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_group_id` bigint unsigned DEFAULT NULL COMMENT 'FK support_service_groups.id — NULL=áp dụng chung. Config cụ thể override config chung.',
  `priority` enum('LOW','MEDIUM','HIGH','URGENT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Map với support_requests.priority. URGENT=khẩn cấp.',
  `sla_hours` decimal(6,2) DEFAULT NULL,
  `request_type_prefix` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `response_hours` decimal(5,2) NOT NULL DEFAULT '4.00' COMMENT 'SLA Response: max giờ phải phản hồi ban đầu.',
  `resolution_hours` decimal(5,2) NOT NULL DEFAULT '24.00' COMMENT 'SLA Resolution: max giờ phải xử lý xong. Dùng tính sla_due_time.',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` smallint unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sla_group_priority` (`service_group_id`,`priority`),
  KEY `idx_sla_status_lookup` (`status`,`sub_status`,`priority`,`is_active`),
  KEY `idx_sla_prefix_fallback` (`request_type_prefix`,`priority`,`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cấu hình SLA. Lookup: WHERE priority=? AND (service_group_id=? OR service_group_id IS NULL) ORDER BY service_group_id IS NULL ASC LIMIT 1.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `support_contact_positions`
--

DROP TABLE IF EXISTS `support_contact_positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_contact_positions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `position_code` varchar(50) NOT NULL,
  `position_name` varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_support_contact_positions_code` (`position_code`),
  UNIQUE KEY `uq_support_contact_positions_name` (`position_name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `support_request_statuses`
--

DROP TABLE IF EXISTS `support_request_statuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_request_statuses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `status_code` varchar(50) NOT NULL,
  `status_name` varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `requires_completion_dates` tinyint(1) NOT NULL DEFAULT '1',
  `is_terminal` tinyint(1) NOT NULL DEFAULT '0',
  `is_transfer_dev` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int unsigned NOT NULL DEFAULT '0',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_support_request_statuses_code` (`status_code`),
  KEY `idx_support_request_statuses_active_sort` (`is_active`,`sort_order`),
  KEY `fk_support_request_statuses_created_by` (`created_by`),
  KEY `fk_support_request_statuses_updated_by` (`updated_by`),
  CONSTRAINT `fk_support_request_statuses_created_by` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_request_statuses_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `support_service_groups`
--

DROP TABLE IF EXISTS `support_service_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_service_groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên nhóm: HIS L2, HIS L3, OS...',
  `group_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã nhóm chuẩn hóa UPPER_SNAKE_CASE',
  `customer_id` bigint unsigned DEFAULT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Trạng thái hoạt động (1: Hiển thị, 0: Ẩn khỏi dropdown nhưng giữ lịch sử)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_support_service_groups_customer_group_code` (`customer_id`,`group_code`),
  UNIQUE KEY `uq_support_service_groups_customer_group_name` (`customer_id`,`group_name`),
  KEY `fk_ssg_cb` (`created_by`),
  KEY `fk_ssg_ub` (`updated_by`),
  KEY `idx_support_groups_active_name` (`is_active`,`group_name`),
  KEY `idx_support_service_groups_customer_id` (`customer_id`),
  CONSTRAINT `fk_ssg_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ssg_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_service_groups_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 36: Danh mục nhóm hỗ trợ chuyên trách';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_delegation_items`
--

DROP TABLE IF EXISTS `user_delegation_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_delegation_items` (
  `delegation_id` bigint unsigned NOT NULL,
  `item_type` enum('ROLE','PERMISSION') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`delegation_id`,`item_type`,`item_id`),
  CONSTRAINT `fk_deli_del` FOREIGN KEY (`delegation_id`) REFERENCES `user_delegations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 20: Chi tiết Role/Perm được ủy quyền';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_delegations`
--

DROP TABLE IF EXISTS `user_delegations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_delegations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `delegator_id` bigint unsigned NOT NULL,
  `delegatee_id` bigint unsigned NOT NULL,
  `scope` enum('FULL','SPECIFIC_ROLES','SPECIFIC_PERMS') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SPECIFIC_ROLES',
  `inherit_data_scope` tinyint(1) NOT NULL DEFAULT '0',
  `starts_at` timestamp NOT NULL,
  `expires_at` timestamp NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_del_delegator` (`delegator_id`),
  KEY `fk_del_delegatee` (`delegatee_id`),
  CONSTRAINT `fk_del_delegatee` FOREIGN KEY (`delegatee_id`) REFERENCES `internal_users` (`id`),
  CONSTRAINT `fk_del_delegator` FOREIGN KEY (`delegator_id`) REFERENCES `internal_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 19: Ủy quyền tạm thời';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_dept_history`
--

DROP TABLE IF EXISTS `user_dept_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_dept_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `from_dept_id` bigint unsigned DEFAULT NULL,
  `to_dept_id` bigint unsigned NOT NULL,
  `transfer_date` date NOT NULL,
  `decision_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_hist_user` (`user_id`),
  CONSTRAINT `fk_hist_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 18: Lịch sử điều động nhân sự';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_dept_scopes`
--

DROP TABLE IF EXISTS `user_dept_scopes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_dept_scopes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `dept_id` bigint unsigned NOT NULL,
  `scope_type` enum('SELF_ONLY','DEPT_ONLY','DEPT_AND_CHILDREN','ALL') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DEPT_ONLY',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_uds_user` (`user_id`),
  KEY `fk_uds_dept` (`dept_id`),
  CONSTRAINT `fk_uds_dept` FOREIGN KEY (`dept_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_uds_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 17: Phạm vi dữ liệu theo phòng ban';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_permissions`
--

DROP TABLE IF EXISTS `user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  `type` enum('GRANT','DENY') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'GRANT',
  `reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_up_user` (`user_id`),
  KEY `fk_up_perm` (`permission_id`),
  CONSTRAINT `fk_up_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 16: Quyền ngoại lệ cho cá nhân';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `role_id` bigint unsigned NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ur_user` (`user_id`),
  KEY `fk_ur_role` (`role_id`),
  CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 15: Gán vai trò cho người dùng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vendor_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vendor_code` (`vendor_code`),
  KEY `idx_vendors_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 23: Đối tác / Nhà cung cấp';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workflow_form_field_configs`
--

DROP TABLE IF EXISTS `workflow_form_field_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_form_field_configs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `status_catalog_id` bigint unsigned NOT NULL,
  `field_key` varchar(120) NOT NULL,
  `field_label` varchar(190) NOT NULL,
  `field_type` varchar(50) NOT NULL DEFAULT 'text',
  `required` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` smallint unsigned NOT NULL DEFAULT '0',
  `excel_column` varchar(5) DEFAULT NULL,
  `options_json` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wffc_status_field` (`status_catalog_id`,`field_key`),
  KEY `idx_wffc_status_sort` (`status_catalog_id`,`sort_order`),
  KEY `idx_wffc_active_type` (`is_active`,`field_type`)
) ENGINE=InnoDB AUTO_INCREMENT=150 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workflow_status_catalogs`
--

DROP TABLE IF EXISTS `workflow_status_catalogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_status_catalogs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `level` tinyint unsigned NOT NULL,
  `status_code` varchar(80) NOT NULL,
  `status_name` varchar(150) NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `canonical_status` varchar(50) DEFAULT NULL,
  `canonical_sub_status` varchar(50) DEFAULT NULL,
  `flow_step` varchar(20) DEFAULT NULL,
  `form_key` varchar(120) DEFAULT NULL,
  `is_leaf` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` smallint unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wsc_level_code_parent` (`level`,`status_code`,`parent_id`),
  KEY `idx_wsc_parent` (`parent_id`,`level`,`sort_order`),
  KEY `idx_wsc_canonical` (`canonical_status`,`canonical_sub_status`),
  KEY `idx_wsc_active_sort` (`is_active`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `worklog_activity_types`
--

DROP TABLE IF EXISTS `worklog_activity_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `worklog_activity_types` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(30) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `default_is_billable` tinyint(1) NOT NULL DEFAULT '1',
  `phase_hint` varchar(50) DEFAULT NULL,
  `sort_order` smallint unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `worklog_activity_types_code_unique` (`code`),
  KEY `idx_activity_active_sort` (`is_active`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'vnpt_business_db'
--
/*!50003 DROP PROCEDURE IF EXISTS `seed_support_requests_bulk` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `seed_support_requests_bulk`(IN p_total INT, IN p_chunk INT)
BEGIN
  DECLARE v_offset INT DEFAULT 0;
  DECLARE v_item_count INT DEFAULT 0;
  DECLARE v_group_count INT DEFAULT 0;
  DECLARE v_user_count INT DEFAULT 0;
  DECLARE v_customer_count INT DEFAULT 0;
  DECLARE v_fallback_customer_id BIGINT UNSIGNED DEFAULT NULL;

  SELECT COUNT(*) INTO v_customer_count FROM customers;
  IF v_customer_count = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Không có dữ liệu customers để seed support_requests';
  END IF;

  SELECT id INTO v_fallback_customer_id FROM customers ORDER BY id LIMIT 1;

  DROP TEMPORARY TABLE IF EXISTS tmp_seed_numbers;
  CREATE TEMPORARY TABLE tmp_seed_numbers (
    n INT NOT NULL PRIMARY KEY
  ) ENGINE=MEMORY;

  INSERT INTO tmp_seed_numbers (n)
  SELECT d0.d + d1.d * 10 + d2.d * 100 + d3.d * 1000
  FROM (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d0
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d1
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d2
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d3;

  DROP TEMPORARY TABLE IF EXISTS tmp_seed_project_items;
  CREATE TEMPORARY TABLE tmp_seed_project_items (
    rn INT NOT NULL PRIMARY KEY,
    project_item_id BIGINT UNSIGNED NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    product_id BIGINT UNSIGNED NULL
  ) ENGINE=MEMORY;

  SET @rownum := -1;
  INSERT INTO tmp_seed_project_items (rn, project_item_id, customer_id, project_id, product_id)
  SELECT
    @rownum := @rownum + 1 AS rn,
    pi.id,
    COALESCE(p.customer_id, v_fallback_customer_id) AS customer_id,
    pi.project_id,
    pi.product_id
  FROM project_items pi
  LEFT JOIN projects p ON p.id = pi.project_id
  ORDER BY pi.id;

  INSERT INTO tmp_seed_project_items (rn, project_item_id, customer_id, project_id, product_id)
  SELECT 0, NULL, v_fallback_customer_id, NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM tmp_seed_project_items);

  DROP TEMPORARY TABLE IF EXISTS tmp_seed_groups;
  CREATE TEMPORARY TABLE tmp_seed_groups (
    rn INT NOT NULL PRIMARY KEY,
    service_group_id BIGINT UNSIGNED NULL
  ) ENGINE=MEMORY;

  SET @rownum := -1;
  INSERT INTO tmp_seed_groups (rn, service_group_id)
  SELECT @rownum := @rownum + 1 AS rn, id
  FROM support_service_groups
  WHERE is_active = 1
  ORDER BY id;

  INSERT INTO tmp_seed_groups (rn, service_group_id)
  SELECT 0, NULL
  WHERE NOT EXISTS (SELECT 1 FROM tmp_seed_groups);

  DROP TEMPORARY TABLE IF EXISTS tmp_seed_users;
  CREATE TEMPORARY TABLE tmp_seed_users (
    rn INT NOT NULL PRIMARY KEY,
    assignee_id BIGINT UNSIGNED NULL
  ) ENGINE=MEMORY;

  SET @rownum := -1;
  INSERT INTO tmp_seed_users (rn, assignee_id)
  SELECT @rownum := @rownum + 1 AS rn, id
  FROM internal_users
  ORDER BY id;

  INSERT INTO tmp_seed_users (rn, assignee_id)
  SELECT 0, NULL
  WHERE NOT EXISTS (SELECT 1 FROM tmp_seed_users);

  SELECT COUNT(*) INTO v_item_count FROM tmp_seed_project_items;
  SELECT COUNT(*) INTO v_group_count FROM tmp_seed_groups;
  SELECT COUNT(*) INTO v_user_count FROM tmp_seed_users;

  DELETE FROM support_request_history;
  DELETE FROM support_requests;

  WHILE v_offset < p_total DO
    INSERT INTO support_requests (
      ticket_code,
      summary,
      service_group_id,
      project_item_id,
      customer_id,
      project_id,
      product_id,
      reporter_name,
      assignee_id,
      status,
      priority,
      requested_date,
      due_date,
      resolved_date,
      hotfix_date,
      noti_date,
      task_link,
      change_log,
      test_note,
      notes,
      created_at,
      created_by,
      updated_at,
      updated_by,
      deleted_at
    )
    SELECT
      b.ticket_code,
      b.summary,
      g.service_group_id,
      pi.project_item_id,
      pi.customer_id,
      pi.project_id,
      pi.product_id,
      b.reporter_name,
      u.assignee_id,
      b.status,
      b.priority,
      b.requested_date,
      DATE_ADD(b.requested_date, INTERVAL (MOD(b.seq, 21) + 1) DAY) AS due_date,
      CASE
        WHEN b.status IN ('RESOLVED', 'DEPLOYED') THEN DATE_ADD(b.requested_date, INTERVAL (MOD(b.seq, 10) + 2) DAY)
        ELSE NULL
      END AS resolved_date,
      CASE
        WHEN b.status = 'HOTFIXING' THEN DATE_ADD(b.requested_date, INTERVAL (MOD(b.seq, 3) + 1) DAY)
        ELSE NULL
      END AS hotfix_date,
      CASE
        WHEN b.status IN ('RESOLVED', 'DEPLOYED') THEN DATE_ADD(b.requested_date, INTERVAL (MOD(b.seq, 12) + 3) DAY)
        ELSE NULL
      END AS noti_date,
      CONCAT('https://jira.vnpt.local/browse/', b.ticket_code) AS task_link,
      CONCAT('Auto seed log #', b.seq + 1) AS change_log,
      CONCAT('Auto seed test note #', b.seq + 1) AS test_note,
      'Seed benchmark dataset 1.5M rows' AS notes,
      NOW(),
      u.assignee_id,
      NOW(),
      u.assignee_id,
      NULL
    FROM (
      SELECT
        v_offset + n.n AS seq,
        CONCAT('SRQ-', LPAD(v_offset + n.n + 1, 10, '0')) AS ticket_code,
        CONCAT('Seed yêu cầu hỗ trợ #', v_offset + n.n + 1) AS summary,
        CONCAT('Reporter ', LPAD(MOD(v_offset + n.n, 500) + 1, 4, '0')) AS reporter_name,
        CASE MOD(v_offset + n.n, 6)
          WHEN 0 THEN 'OPEN'
          WHEN 1 THEN 'HOTFIXING'
          WHEN 2 THEN 'RESOLVED'
          WHEN 3 THEN 'DEPLOYED'
          WHEN 4 THEN 'PENDING'
          ELSE 'CANCELLED'
        END AS status,
        CASE MOD(v_offset + n.n, 4)
          WHEN 0 THEN 'LOW'
          WHEN 1 THEN 'MEDIUM'
          WHEN 2 THEN 'HIGH'
          ELSE 'URGENT'
        END AS priority,
        DATE_ADD('2025-01-01', INTERVAL MOD(v_offset + n.n, 420) DAY) AS requested_date,
        MOD(v_offset + n.n, v_item_count) AS item_rn,
        MOD(v_offset + n.n, v_group_count) AS group_rn,
        MOD(v_offset + n.n, v_user_count) AS user_rn
      FROM tmp_seed_numbers n
      WHERE v_offset + n.n < p_total
    ) b
    JOIN tmp_seed_project_items pi ON pi.rn = b.item_rn
    LEFT JOIN tmp_seed_groups g ON g.rn = b.group_rn
    LEFT JOIN tmp_seed_users u ON u.rn = b.user_rn;

    SET v_offset = v_offset + p_chunk;
  END WHILE;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_generate_contract_payments` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_generate_contract_payments`(
                IN p_contract_id BIGINT UNSIGNED,
                IN p_preserve_paid TINYINT(1),
                IN p_allocation_mode VARCHAR(32),
                IN p_advance_percentage DECIMAL(5,2)
            )
BEGIN
                DECLARE v_cycle VARCHAR(32) DEFAULT 'ONCE';
                DECLARE v_project_id BIGINT UNSIGNED DEFAULT NULL;
                DECLARE v_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_start_date DATE DEFAULT NULL;
                DECLARE v_end_date DATE DEFAULT NULL;
                DECLARE v_term_unit VARCHAR(10) DEFAULT NULL;
                DECLARE v_term_value DECIMAL(10,2) DEFAULT NULL;
                DECLARE v_term_months INT DEFAULT 0;
                DECLARE v_term_days INT DEFAULT 0;
                DECLARE v_interval_months INT DEFAULT NULL;
                DECLARE v_cycle_count INT DEFAULT 1;
                DECLARE v_cycle_index INT DEFAULT 1;
                DECLARE v_current_date DATE DEFAULT NULL;
                DECLARE v_base_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_expected_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_milestone_name VARCHAR(255) DEFAULT 'Thanh toán một lần';
                DECLARE v_allocation_mode VARCHAR(32) DEFAULT 'EVEN';
                DECLARE v_advance_percentage DECIMAL(5,2) DEFAULT 0;
                DECLARE v_first_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_remaining_amount DECIMAL(18,2) DEFAULT 0;
                DECLARE v_remaining_cycles INT DEFAULT 0;
                DECLARE v_remaining_base DECIMAL(18,2) DEFAULT 0;
                DECLARE v_preserved_count INT DEFAULT 0;
                DECLARE v_preserve_offset INT DEFAULT 0;

                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    ROLLBACK;
                    RESIGNAL;
                END;

                START TRANSACTION;

                SELECT
                    'ONCE',
                    `project_id`,
                    COALESCE(`total_value`, 0),
                    COALESCE(`effective_date`, `sign_date`, DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
                    `expiry_date`,
                    NULLIF(UPPER(`term_unit`), ''),
                    `term_value`
                INTO
                    v_cycle,
                    v_project_id,
                    v_amount,
                    v_start_date,
                    v_end_date,
                    v_term_unit,
                    v_term_value
                FROM `contracts`
                WHERE `id` = p_contract_id
                LIMIT 1;

                IF v_cycle IS NULL OR TRIM(v_cycle) = '' THEN
                    SET v_cycle = 'ONCE';
                END IF;

                SET v_cycle = UPPER(v_cycle);
                SET v_allocation_mode = UPPER(COALESCE(NULLIF(TRIM(p_allocation_mode), ''), 'EVEN'));
                IF v_allocation_mode NOT IN ('EVEN', 'ADVANCE_PERCENT') THEN
                    SET v_allocation_mode = 'EVEN';
                END IF;

                SET v_advance_percentage = LEAST(100, GREATEST(0, COALESCE(p_advance_percentage, 0)));

                IF v_start_date IS NULL THEN
                    SET v_start_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY);
                END IF;

                IF v_end_date IS NULL AND v_term_unit IS NOT NULL AND v_term_value IS NOT NULL AND v_term_value > 0 THEN
                    SET v_term_unit = UPPER(v_term_unit);

                    IF v_term_unit = 'DAY' THEN
                        IF FLOOR(v_term_value) <> v_term_value THEN
                            SIGNAL SQLSTATE '45000'
                                SET MESSAGE_TEXT = 'Contract term day value must be integer.';
                        END IF;

                        SET v_end_date = DATE_ADD(v_start_date, INTERVAL CAST(v_term_value AS SIGNED) - 1 DAY);
                    ELSEIF v_term_unit = 'MONTH' THEN
                        SET v_term_months = FLOOR(v_term_value);
                        SET v_term_days = ROUND((v_term_value - v_term_months) * 30);

                        IF v_term_months = 0 AND v_term_days = 0 THEN
                            SET v_term_days = 1;
                        END IF;

                        SET v_end_date = DATE_ADD(
                            DATE_ADD(v_start_date, INTERVAL v_term_months MONTH),
                            INTERVAL v_term_days - 1 DAY
                        );
                    END IF;
                END IF;

                IF v_end_date IS NOT NULL AND v_end_date < v_start_date THEN
                    SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'Contract expiry date must be greater than or equal to start date.';
                END IF;

                IF v_amount IS NULL OR v_amount <= 0 THEN
                    SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'Contract value must be greater than zero for payment generation.';
                END IF;

                IF v_cycle = 'MONTHLY' THEN
                    SET v_interval_months = 1;
                ELSEIF v_cycle = 'QUARTERLY' THEN
                    SET v_interval_months = 3;
                ELSEIF v_cycle = 'HALF_YEARLY' THEN
                    SET v_interval_months = 6;
                ELSEIF v_cycle = 'YEARLY' THEN
                    SET v_interval_months = 12;
                ELSE
                    SET v_interval_months = NULL;
                END IF;

                IF v_interval_months IS NOT NULL AND v_end_date IS NOT NULL AND v_end_date >= v_start_date THEN
                    SET v_cycle_count = TIMESTAMPDIFF(MONTH, v_start_date, v_end_date) DIV v_interval_months + 1;
                ELSE
                    SET v_cycle_count = 1;
                END IF;

                IF v_cycle_count < 1 THEN
                    SET v_cycle_count = 1;
                END IF;

                IF COALESCE(p_preserve_paid, 0) = 1 THEN
                    SELECT COUNT(*)
                    INTO v_preserved_count
                    FROM `payment_schedules`
                    WHERE `contract_id` = p_contract_id
                      AND `status` IN ('PAID', 'PARTIAL');
                ELSE
                    SET v_preserved_count = 0;
                END IF;

                SET v_preserve_offset = LEAST(v_preserved_count, v_cycle_count);

                IF v_allocation_mode = 'ADVANCE_PERCENT' AND v_cycle_count > 1 THEN
                    SET v_first_amount = ROUND((v_amount * v_advance_percentage) / 100, 2);
                    SET v_remaining_amount = GREATEST(0, ROUND(v_amount - v_first_amount, 2));
                    SET v_remaining_cycles = GREATEST(v_cycle_count - 1, 0);
                    SET v_remaining_base = IF(v_remaining_cycles > 0, ROUND(v_remaining_amount / v_remaining_cycles, 2), 0);
                ELSE
                    SET v_base_amount = ROUND(v_amount / v_cycle_count, 2);
                END IF;

                IF COALESCE(p_preserve_paid, 0) = 1 THEN
                    DELETE FROM `payment_schedules`
                    WHERE `contract_id` = p_contract_id
                      AND `status` NOT IN ('PAID', 'PARTIAL');
                ELSE
                    DELETE FROM `payment_schedules`
                    WHERE `contract_id` = p_contract_id;
                END IF;

                SET v_cycle_index = 1;

                payment_loop: WHILE v_cycle_index <= v_cycle_count DO
                    IF v_interval_months IS NULL THEN
                        SET v_current_date = v_start_date;
                    ELSE
                        SET v_current_date = DATE_ADD(v_start_date, INTERVAL (v_cycle_index - 1) * v_interval_months MONTH);
                    END IF;

                    IF v_interval_months IS NOT NULL AND v_end_date IS NOT NULL AND v_current_date > v_end_date THEN
                        LEAVE payment_loop;
                    END IF;

                    IF v_cycle_index <= v_preserve_offset THEN
                        SET v_cycle_index = v_cycle_index + 1;
                        ITERATE payment_loop;
                    END IF;

                    IF v_cycle = 'ONCE' THEN
                        SET v_milestone_name = 'Thanh toán một lần';
                    ELSE
                        SET v_milestone_name = CONCAT('Thanh toán kỳ ', v_cycle_index);
                    END IF;

                    IF v_allocation_mode = 'ADVANCE_PERCENT' AND v_cycle_count > 1 THEN
                        IF v_cycle_index = 1 THEN
                            SET v_expected_amount = v_first_amount;
                        ELSEIF v_cycle_index = v_cycle_count THEN
                            SET v_expected_amount = GREATEST(0, ROUND(v_remaining_amount - (v_remaining_base * GREATEST(v_remaining_cycles - 1, 0)), 2));
                        ELSE
                            SET v_expected_amount = v_remaining_base;
                        END IF;
                    ELSE
                        IF v_cycle_index = v_cycle_count THEN
                            SET v_expected_amount = GREATEST(0, ROUND(v_amount - (v_base_amount * GREATEST(v_cycle_count - 1, 0)), 2));
                        ELSE
                            SET v_expected_amount = v_base_amount;
                        END IF;
                    END IF;

                    INSERT INTO `payment_schedules` (`contract_id`, `project_id`, `milestone_name`, `cycle_number`, `expected_date`, `expected_amount`, `actual_paid_date`, `actual_paid_amount`, `status`, `notes`, `created_at`, `updated_at`)
                    VALUES (p_contract_id, v_project_id, v_milestone_name, v_cycle_index, v_current_date, v_expected_amount, NULL, 0, 'PENDING', NULL, NOW(), NOW());

                    SET v_cycle_index = v_cycle_index + 1;
                END WHILE;

                COMMIT;
            END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-11  9:26:03
