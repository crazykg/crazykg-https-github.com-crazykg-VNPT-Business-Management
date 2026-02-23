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
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '1d74d918-0ca5-11f1-8bfd-970d7e50157a:1-551';

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `reference_type` enum('DOCUMENT','CONTRACT','PROJECT','CUSTOMER','OPPORTUNITY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_id` bigint unsigned NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_url` text COLLATE utf8mb4_unicode_ci,
  `drive_file_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint unsigned DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 33: File đính kèm';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attachments`
--

/*!40000 ALTER TABLE `attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `attachments` ENABLE KEYS */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `event` enum('INSERT','UPDATE','DELETE','RESTORE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `auditable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auditable_id` bigint unsigned NOT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL COMMENT 'Actor ID (Không nối FK để Partition)',
  PRIMARY KEY (`id`,`created_at`),
  KEY `idx_audit_uuid` (`uuid`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 35: Lịch sử Audit'
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
-- Dumping data for table `audit_logs`
--

/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,'11111111-1111-1111-1111-111111111111','INSERT','internal_users',9001,NULL,'{\"status\": \"ACTIVE\", \"vpn_status\": \"YES\"}','/api/v5/employees','10.10.10.10','Seeder/Test','2026-02-23 14:36:48',4),(2,'22222222-2222-2222-2222-222222222222','UPDATE','internal_users',9002,'{\"vpn_status\": \"NO\"}','{\"vpn_status\": \"YES\"}','/api/v5/employees/9002','10.10.10.21','Seeder/Test','2026-02-23 14:46:48',NULL),(3,'33333333-3333-3333-3333-333333333333','DELETE','projects',3001,'{\"status\": \"PLANNING\"}',NULL,'/api/v5/projects/3001','10.10.10.99','Seeder/Test','2026-02-23 14:56:48',999999);
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;

--
-- Table structure for table `business_domains`
--

DROP TABLE IF EXISTS `business_domains`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `business_domains` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `domain_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `domain_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `domain_code` (`domain_code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 22: Lĩnh vực kinh doanh';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `business_domains`
--

/*!40000 ALTER TABLE `business_domains` DISABLE KEYS */;
INSERT INTO `business_domains` VALUES (1,'KD006','Y tế số','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'KD003','An toàn thông tin','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `business_domains` ENABLE KEYS */;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 2: Lưu trữ cache hệ thống';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;

--
-- Table structure for table `cache_invalidation_queue`
--

DROP TABLE IF EXISTS `cache_invalidation_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_invalidation_queue` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `cache_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'VD: perm:123',
  `queued_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_ciq_unprocessed` (`processed`,`queued_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 7: Hàng đợi làm mới cache phân quyền';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_invalidation_queue`
--

/*!40000 ALTER TABLE `cache_invalidation_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_invalidation_queue` ENABLE KEYS */;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 3: Quản lý khóa tài nguyên';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;

--
-- Table structure for table `contracts`
--

DROP TABLE IF EXISTS `contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contracts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `contract_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contract_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_id` bigint unsigned NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `sign_date` date NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `total_value` decimal(18,2) NOT NULL DEFAULT '0.00',
  `status` enum('DRAFT','PENDING','SIGNED','EXPIRED','TERMINATED','LIQUIDATED') COLLATE utf8mb4_unicode_ci DEFAULT 'DRAFT',
  `dept_id` bigint unsigned DEFAULT NULL COMMENT 'Sở hữu dữ liệu',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `contract_code` (`contract_code`),
  KEY `idx_cont_status_exp` (`status`,`expiry_date`),
  KEY `fk_cont_proj_link` (`project_id`),
  KEY `fk_cont_cust_link` (`customer_id`),
  CONSTRAINT `fk_cont_cust_link` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cont_proj_link` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 30: Hợp đồng kinh tế';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contracts`
--

/*!40000 ALTER TABLE `contracts` DISABLE KEYS */;
INSERT INTO `contracts` VALUES (1,'HD001','Hợp đồng triển khai VNPT HIS',1,1,'2026-01-15','2026-12-31',150000000.00,'SIGNED',2,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'HD002','Hợp đồng dịch vụ SOC',2,2,'2026-02-20','2026-12-20',80000000.00,'PENDING',2,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL);
/*!40000 ALTER TABLE `contracts` ENABLE KEYS */;

--
-- Table structure for table `customer_personnel`
--

DROP TABLE IF EXISTS `customer_personnel`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_personnel` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint unsigned NOT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position_type` enum('GIAM_DOC','TRUONG_PHONG','DAU_MOI') COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cust_pers_owner` (`customer_id`),
  CONSTRAINT `fk_cust_pers_owner` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 26: Đầu mối liên hệ khách hàng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_personnel`
--

/*!40000 ALTER TABLE `customer_personnel` DISABLE KEYS */;
INSERT INTO `customer_personnel` VALUES (1,1,'Nguyễn Văn A','GIAM_DOC','0912345678','nguyenvana@vietcombank.com.vn','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,2,'Trần Thị B','TRUONG_PHONG','0987654321','tranthib@petrolimex.com.vn','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `customer_personnel` ENABLE KEYS */;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tax_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_code` (`customer_code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 25: Khách hàng doanh nghiệp';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'KH001','Ngân hàng Vietcombank','0100112437','198 Trần Quang Khải, Hoàn Kiếm, Hà Nội',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'KH002','Tập đoàn Petrolimex','0100107370','Số 1 Khâm Thiên, Đống Đa, Hà Nội',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `dept_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dept_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `dept_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Định dạng 1/2/5/',
  `status` enum('ACTIVE','INACTIVE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `dept_code` (`dept_code`),
  KEY `fk_dept_parent` (`parent_id`),
  CONSTRAINT `fk_dept_parent` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 8: Cơ cấu tổ chức phòng ban';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (1,'9370dd70-10c8-11f1-a6f1-c80ff292045c','PB001','Ban Điều hành',NULL,'1/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-23 15:19:41',NULL),(2,'93742430-10c8-11f1-a6f1-c80ff292045c','PB002','Phòng Kinh doanh',1,'1/2/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-23 15:19:41',NULL),(3,'9376de78-10c8-11f1-a6f1-c80ff292045c','PB003','Phòng Kỹ thuật',1,'1/3/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-23 15:19:41',NULL);
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;

--
-- Table structure for table `document_types`
--

DROP TABLE IF EXISTS `document_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_types` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `type_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `type_code` (`type_code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 31: Loại tài liệu';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_types`
--

/*!40000 ALTER TABLE `document_types` DISABLE KEYS */;
INSERT INTO `document_types` VALUES (1,'DT001','Hợp đồng kinh tế','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'DT002','Biên bản nghiệm thu','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `document_types` ENABLE KEYS */;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `document_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_type_id` bigint unsigned NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `project_id` bigint unsigned DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `status` enum('ACTIVE','SUSPENDED','EXPIRED') COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_code` (`document_code`),
  KEY `fk_doc_type` (`document_type_id`),
  KEY `fk_doc_proj` (`project_id`),
  CONSTRAINT `fk_doc_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fk_doc_type` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 32: Hồ sơ / Công văn / Tài liệu';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documents`
--

/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
INSERT INTO `documents` VALUES (1,'DOC001','Hợp đồng VNPT HIS - Bản chính',1,1,1,'2026-12-31','ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'DOC002','Biên bản nghiệm thu giai đoạn 1',2,2,2,'2026-09-30','ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `department_id` bigint unsigned DEFAULT NULL,
  `position_id` bigint unsigned DEFAULT NULL,
  `data_scope` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `job_title_raw` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vpn_status` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT 'NO',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employees_username_unique` (`username`),
  UNIQUE KEY `employees_email_unique` (`email`),
  UNIQUE KEY `employees_uuid_unique` (`uuid`),
  KEY `employees_department_id_foreign` (`department_id`),
  CONSTRAINT `employees_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,'c40055aa-9749-48f2-8a9b-aec37eeb4366','admin.demo','Nguyễn Quản Trị','admin.demo@vnpt.vn','ACTIVE',3,1,'ALL',NULL,NULL,'2026-02-23 08:01:47','2026-02-23 08:19:41','System Administrator','1990-01-15','MALE','YES','10.10.10.10'),(2,'d2f0f309-e00b-409e-b211-09f6f17838af','sales.demo','Trần Kinh Doanh','sales.demo@vnpt.vn','ACTIVE',2,2,'DEPT_ONLY',NULL,NULL,'2026-02-23 08:01:47','2026-02-23 08:19:41','Sales Executive','1994-05-20','FEMALE','NO','10.10.10.21'),(3,'1ea2777c-3c6b-4c20-a95d-90e3499049a4','system.demo','Lê Hệ Thống','system.demo@vnpt.vn','SUSPENDED',3,3,'ALL',NULL,NULL,'2026-02-23 08:01:48','2026-02-23 08:19:41','Automation Operator','1988-11-11','OTHER','YES','10.10.10.99');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 5: Các job bị lỗi';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;

--
-- Table structure for table `internal_users`
--

DROP TABLE IF EXISTS `internal_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `internal_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_title_raw` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Chức danh gốc',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL COMMENT 'Ngày sinh',
  `gender` enum('MALE','FEMALE','OTHER') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Giới tính',
  `phone_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','BANNED','SUSPENDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `department_id` bigint unsigned DEFAULT NULL,
  `position_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP máy tính',
  `vpn_status` enum('YES','NO') COLLATE utf8mb4_unicode_ci DEFAULT 'NO' COMMENT 'Trạng thái VPN',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `user_code` (`user_code`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_user_dept` (`department_id`),
  KEY `fk_user_pos` (`position_id`),
  CONSTRAINT `fk_user_dept` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_pos` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 14: Thông tin nhân sự & Tài khoản đăng nhập';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `internal_users`
--

/*!40000 ALTER TABLE `internal_users` DISABLE KEYS */;
INSERT INTO `internal_users` VALUES (1,'5fa8c238-10c2-11f1-a6f1-c80ff292045c','ADMIN001','admin','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'System Admin',NULL,'admin@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',NULL,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,NULL,NULL),(2,'5fa8c9ae-10c2-11f1-a6f1-c80ff292045c','DIR001','director','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Giám đốc Demo',NULL,'director@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',NULL,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,NULL,NULL),(3,'5fa8ccf6-10c2-11f1-a6f1-c80ff292045c','MAN001','manager','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Trưởng phòng Demo',NULL,'manager@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',NULL,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,NULL,NULL),(4,'2a3fbfee-08b5-4e64-9a74-46db187527a4','INT9001','admin.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Nguyễn Quản Trị','System Administrator','admin.demo@vnpt.vn',NULL,'1990-01-15','MALE',NULL,'ACTIVE',3,1,'10.10.10.10','YES','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL),(5,'ca2b4545-e172-4d36-accd-748b88ea2690','INT9002','sales.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Trần Kinh Doanh','Sales Executive','sales.demo@vnpt.vn',NULL,'1994-05-20','FEMALE',NULL,'ACTIVE',2,2,'10.10.10.21','NO','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL),(6,'f3f2ebe0-a803-45fe-bfbd-998510aebe92','INT9003','system.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Lê Hệ Thống','Automation Operator','system.demo@vnpt.vn',NULL,'1988-11-11','OTHER',NULL,'SUSPENDED',3,3,'10.10.10.99','YES','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `internal_users` ENABLE KEYS */;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` tinyint unsigned NOT NULL,
  `reserved_at` int unsigned DEFAULT NULL,
  `available_at` int unsigned NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 4: Hàng đợi công việc';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 1: Quản lý vết migration';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_02_21_152322_create_personal_access_tokens_table',1),(5,'2026_02_23_134500_create_v5_enterprise_master_tables',1),(6,'2026_02_23_220000_add_extended_fields_to_employees_table',1),(7,'2026_02_23_220100_create_audit_logs_table',1);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;

--
-- Table structure for table `opportunities`
--

DROP TABLE IF EXISTS `opportunities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `opportunities` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `opp_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `expected_value` decimal(18,2) NOT NULL DEFAULT '0.00',
  `probability` int DEFAULT '0' COMMENT 'Tỉ lệ thành công %',
  `stage` enum('NEW','LEAD','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NEW',
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
-- Dumping data for table `opportunities`
--

/*!40000 ALTER TABLE `opportunities` DISABLE KEYS */;
INSERT INTO `opportunities` VALUES (1,'Triển khai VNPT HIS cho Vietcombank',1,150000000.00,70,'PROPOSAL',2,5,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'Dịch vụ SOC cho Petrolimex',2,80000000.00,60,'NEGOTIATION',2,5,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL);
/*!40000 ALTER TABLE `opportunities` ENABLE KEYS */;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `perm_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `perm_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `perm_group` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `perm_key` (`perm_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 11: Danh mục quyền nguyên tử';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;

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
-- Dumping data for table `position_default_roles`
--

/*!40000 ALTER TABLE `position_default_roles` DISABLE KEYS */;
/*!40000 ALTER TABLE `position_default_roles` ENABLE KEYS */;

--
-- Table structure for table `positions`
--

DROP TABLE IF EXISTS `positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `positions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `pos_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pos_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
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
-- Dumping data for table `positions`
--

/*!40000 ALTER TABLE `positions` DISABLE KEYS */;
INSERT INTO `positions` VALUES (1,'GD','Giám đốc',5,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(2,'PGD','Phó Giám đốc',4,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(3,'TP','Trưởng phòng',3,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(4,'PP','Phó phòng',2,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(5,'CV','Chuyên viên',1,1,'2026-02-23 14:17:23',NULL,NULL,NULL);
/*!40000 ALTER TABLE `positions` ENABLE KEYS */;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `domain_id` bigint unsigned NOT NULL,
  `vendor_id` bigint unsigned NOT NULL,
  `standard_price` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_code` (`product_code`),
  KEY `fk_prod_domain` (`domain_id`),
  KEY `fk_prod_vendor` (`vendor_id`),
  CONSTRAINT `fk_prod_domain` FOREIGN KEY (`domain_id`) REFERENCES `business_domains` (`id`),
  CONSTRAINT `fk_prod_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 24: Danh mục sản phẩm/dịch vụ';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'VNPT_HIS','Giải pháp VNPT HIS',1,1,150000000.00,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'SOC_MONITOR','Dịch vụ giám sát SOC',2,2,80000000.00,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 29: Hạng mục chi tiết dự án';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_items`
--

/*!40000 ALTER TABLE `project_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_items` ENABLE KEYS */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `project_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `opportunity_id` bigint unsigned DEFAULT NULL,
  `investment_mode` enum('DAU_TU','THUE_DICH_VU') COLLATE utf8mb4_unicode_ci DEFAULT 'DAU_TU',
  `start_date` date NOT NULL,
  `expected_end_date` date DEFAULT NULL,
  `status` enum('PLANNING','ONGOING','COMPLETED','CANCELLED','SUSPENDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLANNING',
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 28: Dự án';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (1,'DA001','Dự án VNPT HIS - Vietcombank',1,1,'DAU_TU','2026-01-10','2026-12-31','ONGOING','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'DA002','Dự án SOC - Petrolimex',2,2,'THUE_DICH_VU','2026-02-01','2026-10-01','PLANNING','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL);
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;

--
-- Table structure for table `raci_assignments`
--

DROP TABLE IF EXISTS `raci_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `raci_assignments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'contract | project | opportunity',
  `entity_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `raci_role` enum('R','A','C','I') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_raci_entity_user` (`entity_type`,`entity_id`,`user_id`),
  KEY `idx_raci_entity` (`entity_type`,`entity_id`),
  KEY `fk_raci_user_global` (`user_id`),
  CONSTRAINT `fk_raci_user_global` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 21: Ma trận RACI tổng thể';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `raci_assignments`
--

/*!40000 ALTER TABLE `raci_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `raci_assignments` ENABLE KEYS */;

--
-- Table structure for table `reminders`
--

DROP TABLE IF EXISTS `reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reminders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `reminder_title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci,
  `project_id` bigint unsigned DEFAULT NULL,
  `contract_id` bigint unsigned DEFAULT NULL,
  `remind_date` datetime NOT NULL,
  `assigned_to` bigint unsigned NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `status` enum('ACTIVE','COMPLETED','CANCELLED') COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
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
-- Dumping data for table `reminders`
--

/*!40000 ALTER TABLE `reminders` DISABLE KEYS */;
INSERT INTO `reminders` VALUES (1,'Gửi báo cáo tuần cho khách hàng','Tổng hợp tiến độ và gửi báo cáo tuần.',NULL,NULL,'2026-02-24 09:00:00',5,0,'ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'Nhắc lịch họp kickoff dự án','Chuẩn bị nội dung họp kickoff với khách hàng.',NULL,NULL,'2026-02-26 14:00:00',5,0,'ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `reminders` ENABLE KEYS */;

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
-- Dumping data for table `role_permission`
--

/*!40000 ALTER TABLE `role_permission` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_permission` ENABLE KEYS */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_role_id` bigint unsigned DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
-- Dumping data for table `roles`
--

/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'ADMIN','Quản trị hệ thống',NULL,1,'Quyền tối cao toàn hệ thống','2026-02-23 14:17:23',NULL,NULL,NULL),(2,'DIRECTOR','Ban Giám đốc',NULL,1,'Theo dõi toàn bộ dự án, hợp đồng','2026-02-23 14:17:23',NULL,NULL,NULL),(3,'MANAGER','Quản lý cấp trung',NULL,1,'Quản lý phòng ban','2026-02-23 14:17:23',NULL,NULL,NULL),(4,'STAFF','Nhân viên',NULL,1,'Quyền cơ bản thao tác nghiệp vụ','2026-02-23 14:17:23',NULL,NULL,NULL);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 6: Phiên làm việc người dùng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;

--
-- Table structure for table `user_delegation_items`
--

DROP TABLE IF EXISTS `user_delegation_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_delegation_items` (
  `delegation_id` bigint unsigned NOT NULL,
  `item_type` enum('ROLE','PERMISSION') COLLATE utf8mb4_unicode_ci NOT NULL,
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
-- Dumping data for table `user_delegation_items`
--

/*!40000 ALTER TABLE `user_delegation_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_delegation_items` ENABLE KEYS */;

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
  `scope` enum('FULL','SPECIFIC_ROLES','SPECIFIC_PERMS') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SPECIFIC_ROLES',
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
-- Dumping data for table `user_delegations`
--

/*!40000 ALTER TABLE `user_delegations` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_delegations` ENABLE KEYS */;

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
  `decision_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
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
-- Dumping data for table `user_dept_history`
--

/*!40000 ALTER TABLE `user_dept_history` DISABLE KEYS */;
INSERT INTO `user_dept_history` VALUES (1,5,1,2,'2026-02-13','QD-2026-001','Điều chuyển phục vụ dự án trọng điểm.','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `user_dept_history` ENABLE KEYS */;

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
  `scope_type` enum('SELF_ONLY','DEPT_ONLY','DEPT_AND_CHILDREN','ALL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DEPT_ONLY',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_uds_user` (`user_id`),
  KEY `fk_uds_dept` (`dept_id`),
  CONSTRAINT `fk_uds_dept` FOREIGN KEY (`dept_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_uds_user` FOREIGN KEY (`user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 17: Phạm vi dữ liệu theo phòng ban';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_dept_scopes`
--

/*!40000 ALTER TABLE `user_dept_scopes` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_dept_scopes` ENABLE KEYS */;

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
  `type` enum('GRANT','DENY') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'GRANT',
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 16: Quyền ngoại lệ cho cá nhân';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_permissions`
--

/*!40000 ALTER TABLE `user_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_permissions` ENABLE KEYS */;

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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 15: Gán vai trò cho người dùng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,1,1,NULL,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(2,2,2,NULL,1,'2026-02-23 14:17:24',NULL,NULL,NULL),(3,3,3,NULL,1,'2026-02-23 14:17:24',NULL,NULL,NULL);
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vendor_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vendor_code` (`vendor_code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 23: Đối tác / Nhà cung cấp';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,'DT006','VNPT IT',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'DT007','FPT IS',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;

--
-- Dumping routines for database 'vnpt_business_db'
--
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-23 22:25:02
