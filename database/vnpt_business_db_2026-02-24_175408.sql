-- MySQL dump 10.13  Distrib 9.6.0, for macos26.2 (arm64)
--
-- Host: localhost    Database: vnpt_business_db
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

LOCK TABLES `attachments` WRITE;
/*!40000 ALTER TABLE `attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `attachments` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,'11111111-1111-1111-1111-111111111111','INSERT','internal_users',9001,NULL,'{\"status\": \"ACTIVE\", \"vpn_status\": \"YES\"}','/api/v5/employees','10.10.10.10','Seeder/Test','2026-02-23 14:36:48',4),(2,'22222222-2222-2222-2222-222222222222','UPDATE','internal_users',9002,'{\"vpn_status\": \"NO\"}','{\"vpn_status\": \"YES\"}','/api/v5/employees/9002','10.10.10.21','Seeder/Test','2026-02-23 14:46:48',NULL),(3,'33333333-3333-3333-3333-333333333333','DELETE','projects',3001,'{\"status\": \"PLANNING\"}',NULL,'/api/v5/projects/3001','10.10.10.99','Seeder/Test','2026-02-23 14:56:48',999999);
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `business_domains` WRITE;
/*!40000 ALTER TABLE `business_domains` DISABLE KEYS */;
INSERT INTO `business_domains` VALUES (1,'KD006','Y tế số','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'KD003','An toàn thông tin','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `business_domains` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `cache_invalidation_queue` WRITE;
/*!40000 ALTER TABLE `cache_invalidation_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_invalidation_queue` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `contracts` WRITE;
/*!40000 ALTER TABLE `contracts` DISABLE KEYS */;
INSERT INTO `contracts` VALUES (1,'HD001','Hợp đồng triển khai VNPT HIS',1,1,'2026-01-15','2026-12-31',150000000.00,'SIGNED',2,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'HD002','Hợp đồng dịch vụ SOC',2,2,'2026-02-20','2026-12-20',80000000.00,'PENDING',2,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL);
/*!40000 ALTER TABLE `contracts` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `customer_personnel` WRITE;
/*!40000 ALTER TABLE `customer_personnel` DISABLE KEYS */;
INSERT INTO `customer_personnel` VALUES (1,1,'Nguyễn Văn A','GIAM_DOC','0912345678','nguyenvana@vietcombank.com.vn','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,2,'Trần Thị B','TRUONG_PHONG','0987654321','tranthib@petrolimex.com.vn','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `customer_personnel` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'KH001','Ngân hàng Vietcombank','0100112437','198 Trần Quang Khải, Hoàn Kiếm, Hà Nội',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'KH002','Tập đoàn Petrolimex','0100107370','Số 1 Khâm Thiên, Đống Đa, Hà Nội',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (1,'9370dd70-10c8-11f1-a6f1-c80ff292045c','PB001','Ban Điều hành',NULL,'1/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-23 15:19:41',NULL),(2,'93742430-10c8-11f1-a6f1-c80ff292045c','PB002','Phòng Kinh doanh',1,'1/2/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-23 15:19:41',NULL),(3,'9376de78-10c8-11f1-a6f1-c80ff292045c','PB003','Phòng Kỹ thuật',1,'1/3/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-23 15:19:41',NULL);
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `document_types` WRITE;
/*!40000 ALTER TABLE `document_types` DISABLE KEYS */;
INSERT INTO `document_types` VALUES (1,'DT001','Hợp đồng kinh tế','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'DT002','Biên bản nghiệm thu','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `document_types` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
INSERT INTO `documents` VALUES (1,'DOC001','Hợp đồng VNPT HIS - Bản chính',1,1,1,'2026-12-31','ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'DOC002','Biên bản nghiệm thu giai đoạn 1',2,2,2,'2026-09-30','ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,'c40055aa-9749-48f2-8a9b-aec37eeb4366','admin.demo','Nguyễn Quản Trị','admin.demo@vnpt.vn','ACTIVE',3,1,'ALL',NULL,NULL,'2026-02-23 08:01:47','2026-02-23 08:19:41','System Administrator','1990-01-15','MALE','YES','10.10.10.10'),(2,'d2f0f309-e00b-409e-b211-09f6f17838af','sales.demo','Trần Kinh Doanh','sales.demo@vnpt.vn','ACTIVE',2,2,'DEPT_ONLY',NULL,NULL,'2026-02-23 08:01:47','2026-02-23 08:19:41','Sales Executive','1994-05-20','FEMALE','NO','10.10.10.21'),(3,'1ea2777c-3c6b-4c20-a95d-90e3499049a4','system.demo','Lê Hệ Thống','system.demo@vnpt.vn','SUSPENDED',3,3,'ALL',NULL,NULL,'2026-02-23 08:01:48','2026-02-23 08:19:41','Automation Operator','1988-11-11','OTHER','YES','10.10.10.99'),(4,'9b93f0b5-472e-4fb6-b69e-7b19072f4a5f','vnpt022327','Nguyễn Văn A','nguyenvana@vnpt.vn','ACTIVE',1,3,NULL,NULL,NULL,'2026-02-23 19:46:02','2026-02-23 19:46:02','Chuyên viên kinh doanh','1995-08-10','MALE','YES',NULL),(5,'059837c8-1b86-49e8-9565-84a77c8c38b8','ctv091020','Trần Thị B','tranthib@vnpt.vn','ACTIVE',2,5,NULL,NULL,NULL,'2026-02-23 19:46:02','2026-02-23 19:46:17','Nhân viên chăm sóc khách hàng','1993-11-22','FEMALE','NO',NULL);
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `internal_users` WRITE;
/*!40000 ALTER TABLE `internal_users` DISABLE KEYS */;
INSERT INTO `internal_users` VALUES (1,'5fa8c238-10c2-11f1-a6f1-c80ff292045c','ADMIN001','admin','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'System Admin',NULL,'admin@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',NULL,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,NULL,NULL),(2,'5fa8c9ae-10c2-11f1-a6f1-c80ff292045c','DIR001','director','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Giám đốc Demo',NULL,'director@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',NULL,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,NULL,NULL),(3,'5fa8ccf6-10c2-11f1-a6f1-c80ff292045c','MAN001','manager','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Trưởng phòng Demo',NULL,'manager@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',NULL,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,NULL,NULL),(4,'2a3fbfee-08b5-4e64-9a74-46db187527a4','INT9001','admin.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Nguyễn Quản Trị','System Administrator','admin.demo@vnpt.vn',NULL,'1990-01-15','MALE',NULL,'ACTIVE',3,1,'10.10.10.10','YES','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL),(5,'ca2b4545-e172-4d36-accd-748b88ea2690','INT9002','sales.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Trần Kinh Doanh','Sales Executive','sales.demo@vnpt.vn',NULL,'1994-05-20','FEMALE',NULL,'ACTIVE',2,2,'10.10.10.21','NO','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL),(6,'f3f2ebe0-a803-45fe-bfbd-998510aebe92','INT9003','system.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Lê Hệ Thống','Automation Operator','system.demo@vnpt.vn',NULL,'1988-11-11','OTHER',NULL,'SUSPENDED',3,3,'10.10.10.99','YES','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `internal_users` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_02_21_152322_create_personal_access_tokens_table',1),(5,'2026_02_23_134500_create_v5_enterprise_master_tables',1),(6,'2026_02_23_220000_add_extended_fields_to_employees_table',1),(7,'2026_02_23_220100_create_audit_logs_table',1);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `opportunities` WRITE;
/*!40000 ALTER TABLE `opportunities` DISABLE KEYS */;
INSERT INTO `opportunities` VALUES (1,'Triển khai VNPT HIS cho Vietcombank',1,150000000.00,70,'PROPOSAL',2,5,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'Dịch vụ SOC cho Petrolimex',2,80000000.00,60,'NEGOTIATION',2,5,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL);
/*!40000 ALTER TABLE `opportunities` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

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
  CONSTRAINT `fk_ps_contract` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ps_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 36: Kế hoạch thanh toán & Dòng tiền dự kiến';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_schedules`
--

LOCK TABLES `payment_schedules` WRITE;
/*!40000 ALTER TABLE `payment_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_schedules` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `position_default_roles` WRITE;
/*!40000 ALTER TABLE `position_default_roles` DISABLE KEYS */;
/*!40000 ALTER TABLE `position_default_roles` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `positions` WRITE;
/*!40000 ALTER TABLE `positions` DISABLE KEYS */;
INSERT INTO `positions` VALUES (1,'GD','Giám đốc',5,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(2,'PGD','Phó Giám đốc',4,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(3,'TP','Trưởng phòng',3,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(4,'PP','Phó phòng',2,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(5,'CV','Chuyên viên',1,1,'2026-02-23 14:17:23',NULL,NULL,NULL);
/*!40000 ALTER TABLE `positions` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'VNPT_HIS','Giải pháp VNPT HIS',1,1,150000000.00,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'SOC_MONITOR','Dịch vụ giám sát SOC',2,2,80000000.00,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 29: Hạng mục chi tiết dự án';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_items`
--

LOCK TABLES `project_items` WRITE;
/*!40000 ALTER TABLE `project_items` DISABLE KEYS */;
INSERT INTO `project_items` VALUES (1,1,1,1.00,150000000.00,'2026-02-24 01:00:00',NULL,'2026-02-24 01:00:00',NULL,NULL),(2,2,2,1.00,80000000.00,'2026-02-24 01:05:00',NULL,'2026-02-24 01:05:00',NULL,NULL);
/*!40000 ALTER TABLE `project_items` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (1,'DA001','Dự án VNPT HIS - Vietcombank',1,1,'DAU_TU','2026-01-10','2026-12-31','ONGOING','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'DA002','Dự án SOC - Petrolimex',2,2,'THUE_DICH_VU','2026-02-01','2026-10-01','PLANNING','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL);
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `raci_assignments` WRITE;
/*!40000 ALTER TABLE `raci_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `raci_assignments` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `reminders` WRITE;
/*!40000 ALTER TABLE `reminders` DISABLE KEYS */;
INSERT INTO `reminders` VALUES (1,'Gửi báo cáo tuần cho khách hàng','Tổng hợp tiến độ và gửi báo cáo tuần.',NULL,NULL,'2026-02-24 09:00:00',5,0,'ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'Nhắc lịch họp kickoff dự án','Chuẩn bị nội dung họp kickoff với khách hàng.',NULL,NULL,'2026-02-26 14:00:00',5,0,'ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `reminders` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `role_permission` WRITE;
/*!40000 ALTER TABLE `role_permission` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_permission` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'ADMIN','Quản trị hệ thống',NULL,1,'Quyền tối cao toàn hệ thống','2026-02-23 14:17:23',NULL,NULL,NULL),(2,'DIRECTOR','Ban Giám đốc',NULL,1,'Theo dõi toàn bộ dự án, hợp đồng','2026-02-23 14:17:23',NULL,NULL,NULL),(3,'MANAGER','Quản lý cấp trung',NULL,1,'Quản lý phòng ban','2026-02-23 14:17:23',NULL,NULL,NULL),(4,'STAFF','Nhân viên',NULL,1,'Quyền cơ bản thao tác nghiệp vụ','2026-02-23 14:17:23',NULL,NULL,NULL);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('WzETfd6C67RVG4pjTlKC1VhLPK88g66mpZDzGxHh',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiNGNBWUV4a3FtY2JqelowdmZsRmpTdTF6cFFYR05aMkRlSExNR0tTRiI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1771907403);
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_request_history`
--

DROP TABLE IF EXISTS `support_request_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_request_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_id` bigint unsigned NOT NULL,
  `old_status` enum('OPEN','HOTFIXING','RESOLVED','DEPLOYED','PENDING','CANCELLED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` enum('OPEN','HOTFIXING','RESOLVED','DEPLOYED','PENDING','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned NOT NULL COMMENT 'Người chuyển trạng thái',
  PRIMARY KEY (`id`),
  KEY `fk_shist_request` (`request_id`),
  KEY `fk_shist_cb` (`created_by`),
  CONSTRAINT `fk_shist_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
  CONSTRAINT `fk_shist_request` FOREIGN KEY (`request_id`) REFERENCES `support_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 38: Nhật ký thay đổi trạng thái Task';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_request_history`
--

LOCK TABLES `support_request_history` WRITE;
/*!40000 ALTER TABLE `support_request_history` DISABLE KEYS */;
INSERT INTO `support_request_history` VALUES (11,2,NULL,'OPEN','Tạo mới yêu cầu hỗ trợ.','2026-02-24 01:30:00',1),(12,3,NULL,'OPEN','Tạo yêu cầu khẩn do lỗi vận hành.','2026-02-24 03:00:00',3),(13,3,'OPEN','HOTFIXING','Chuyển xử lý nóng để khắc phục ngay trong ngày.','2026-02-24 04:10:00',3),(14,4,NULL,'OPEN','Tiếp nhận yêu cầu tối ưu hiệu năng.','2026-02-22 07:20:00',5),(15,4,'OPEN','RESOLVED','Đã xử lý xong và bàn giao QA xác nhận.','2026-02-24 09:30:00',5),(16,5,NULL,'OPEN','Tiếp nhận cấu hình LIS theo quy định mới.','2026-02-21 02:10:00',6),(17,5,'OPEN','RESOLVED','Hoàn thành chỉnh sửa và kiểm thử nội bộ.','2026-02-23 08:40:00',6),(18,5,'RESOLVED','DEPLOYED','Đã triển khai production và thông báo khách hàng.','2026-02-24 02:00:00',6);
/*!40000 ALTER TABLE `support_request_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_requests`
--

DROP TABLE IF EXISTS `support_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ticket_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã Jira (IT360-1234) hoặc Bitbucket PR',
  `summary` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nội dung yêu cầu / Tên Task',
  `service_group_id` bigint unsigned DEFAULT NULL COMMENT 'Nhóm xử lý (L2, L3, OS...)',
  `project_item_id` bigint unsigned DEFAULT NULL COMMENT 'Hạng mục dự án (project_items)',
  `customer_id` bigint unsigned NOT NULL COMMENT 'Đơn vị yêu cầu (Khách hàng)',
  `project_id` bigint unsigned DEFAULT NULL COMMENT 'Gắn với dự án (HIS, Văn bản 130...)',
  `product_id` bigint unsigned DEFAULT NULL COMMENT 'Gắn với sản phẩm (Phần mềm cụ thể)',
  `reporter_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Người báo yêu cầu',
  `assignee_id` bigint unsigned DEFAULT NULL COMMENT 'Người trực tiếp xử lý (Assignee)',
  `status` enum('OPEN','HOTFIXING','RESOLVED','DEPLOYED','PENDING','CANCELLED') COLLATE utf8mb4_unicode_ci DEFAULT 'OPEN',
  `priority` enum('LOW','MEDIUM','HIGH','URGENT') COLLATE utf8mb4_unicode_ci DEFAULT 'MEDIUM',
  `requested_date` date NOT NULL COMMENT 'Ngày nhận yêu cầu',
  `due_date` date DEFAULT NULL COMMENT 'Hạn hoàn thành',
  `resolved_date` date DEFAULT NULL COMMENT 'Ngày xong thực tế',
  `hotfix_date` date DEFAULT NULL COMMENT 'Ngày đẩy Hotfix',
  `noti_date` date DEFAULT NULL COMMENT 'Ngày báo cho khách hàng',
  `task_link` text COLLATE utf8mb4_unicode_ci COMMENT 'Link Jira / Bitbucket',
  `change_log` text COLLATE utf8mb4_unicode_ci COMMENT 'Hướng xử lý / Ghi chú kỹ thuật',
  `test_note` text COLLATE utf8mb4_unicode_ci COMMENT 'Kết quả kiểm thử',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_code` (`ticket_code`),
  KEY `idx_support_status` (`status`),
  KEY `idx_support_dates` (`requested_date`,`due_date`),
  KEY `fk_support_cust` (`customer_id`),
  KEY `fk_support_proj` (`project_id`),
  KEY `fk_support_prod` (`product_id`),
  KEY `fk_support_user` (`assignee_id`),
  KEY `fk_support_group` (`service_group_id`),
  KEY `fk_sr_cb` (`created_by`),
  KEY `fk_sr_ub` (`updated_by`),
  KEY `idx_support_project_item` (`project_item_id`),
  CONSTRAINT `fk_sr_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sr_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_cust` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_support_group` FOREIGN KEY (`service_group_id`) REFERENCES `support_service_groups` (`id`),
  CONSTRAINT `fk_support_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_support_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fk_support_project_item` FOREIGN KEY (`project_item_id`) REFERENCES `project_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_user` FOREIGN KEY (`assignee_id`) REFERENCES `internal_users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 37: Quản lý Task hỗ trợ chi tiết';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_requests`
--

LOCK TABLES `support_requests` WRITE;
/*!40000 ALTER TABLE `support_requests` DISABLE KEYS */;
INSERT INTO `support_requests` VALUES (2,'IT360-1234','Lỗi đồng bộ dữ liệu bệnh án HIS',1,1,1,1,1,'Nguyễn Văn A',1,'OPEN','HIGH','2026-02-24','2026-02-26',NULL,NULL,NULL,'https://jira.example/IT360-1234','Kiểm tra service đồng bộ, chuẩn hóa dữ liệu đầu vào.',NULL,'Theo dõi phản hồi của khách hàng sau khi vá.','2026-02-24 01:30:00',1,'2026-02-24 15:10:42',1,NULL),(3,'IT360-1242','Hotfix lỗi không lưu được đơn thuốc ngoại trú',2,1,1,1,1,'Lê Thị B',3,'HOTFIXING','URGENT','2026-02-24','2026-02-25',NULL,'2026-02-24',NULL,'https://jira.example/IT360-1242','Đã tạo nhánh hotfix và triển khai bản vá tạm.','QA smoke test: pass','Chờ khách hàng xác nhận sau hotfix.','2026-02-24 03:00:00',3,'2026-02-24 15:10:42',3,NULL),(4,'BB-772','Tối ưu tốc độ tải dashboard theo phòng ban',5,2,2,2,2,'Trần Văn C',5,'RESOLVED','MEDIUM','2026-02-22','2026-02-24','2026-02-24',NULL,'2026-02-24','https://bitbucket.example/pr/772','Tinh chỉnh index truy vấn và bổ sung cache.','Đã test hiệu năng: giảm ~35% thời gian phản hồi.','Có thể theo dõi thêm 1 tuần.','2026-02-22 07:20:00',5,'2026-02-24 15:10:42',5,NULL),(5,'LIS-219','Triển khai cấu hình mẫu biểu LIS theo quy định mới',6,2,2,2,2,'Phạm Thị D',6,'DEPLOYED','LOW','2026-02-21','2026-02-23','2026-02-23','2026-02-23','2026-02-24','https://jira.example/LIS-219','Đã cập nhật mẫu biểu và migrate dữ liệu.','UAT pass','Khách hàng đã xác nhận triển khai chính thức.','2026-02-21 02:10:00',6,'2026-02-24 15:10:42',6,NULL);
/*!40000 ALTER TABLE `support_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_service_groups`
--

DROP TABLE IF EXISTS `support_service_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_service_groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên nhóm: HIS L2, HIS L3, OS...',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Trạng thái hoạt động (1: Hiển thị, 0: Ẩn khỏi dropdown nhưng giữ lịch sử)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ssg_cb` (`created_by`),
  KEY `fk_ssg_ub` (`updated_by`),
  CONSTRAINT `fk_ssg_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ssg_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 36: Danh mục nhóm hỗ trợ chuyên trách';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_service_groups`
--

LOCK TABLES `support_service_groups` WRITE;
/*!40000 ALTER TABLE `support_service_groups` DISABLE KEYS */;
INSERT INTO `support_service_groups` VALUES (1,'HIS L2','Hỗ trợ hướng dẫn, cấu hình tham số, xử lý dữ liệu đơn giản',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(2,'HIS L3','Đội lập trình fix lỗi logic, hotfix core phần mềm HIS',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(3,'UPCODE VĂN BẢN','Cập nhật tính năng theo các Thông tư, Quyết định mới (VD: CV130)',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(4,'DỰ ÁN THUÊ OS','Đội ngũ Outsource thực hiện các module thuê ngoài',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(5,'HOÀN THIỆN PHẦN MỀM','Yêu cầu nâng cấp, tối ưu chức năng hiện có',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(6,'ĐỘI LIS/EMR','Hỗ trợ chuyên sâu cho hệ thống Xét nghiệm và Bệnh án điện tử',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(13,'HIS L34','His bản 34',1,'2026-02-24 07:41:29',NULL,'2026-02-24 07:41:29',NULL);
/*!40000 ALTER TABLE `support_service_groups` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `user_delegation_items` WRITE;
/*!40000 ALTER TABLE `user_delegation_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_delegation_items` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `user_delegations` WRITE;
/*!40000 ALTER TABLE `user_delegations` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_delegations` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `user_dept_history` WRITE;
/*!40000 ALTER TABLE `user_dept_history` DISABLE KEYS */;
INSERT INTO `user_dept_history` VALUES (1,5,1,2,'2026-02-13','QD-2026-001','Điều chuyển phục vụ dự án trọng điểm.','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `user_dept_history` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `user_dept_scopes` WRITE;
/*!40000 ALTER TABLE `user_dept_scopes` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_dept_scopes` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `user_permissions` WRITE;
/*!40000 ALTER TABLE `user_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,1,1,NULL,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(2,2,2,NULL,1,'2026-02-23 14:17:24',NULL,NULL,NULL),(3,3,3,NULL,1,'2026-02-23 14:17:24',NULL,NULL,NULL);
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,'DT006','VNPT IT',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'DT007','FPT IS',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'vnpt_business_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-24 22:35:53

-- =====================================================================
-- AUTHORIZATION SEED (RBAC + DATA SCOPE)
-- =====================================================================

INSERT IGNORE INTO `permissions` (`perm_key`, `perm_name`, `perm_group`, `is_active`, `created_at`) VALUES
('system.health.view', 'Xem trạng thái bảng hệ thống', 'SYSTEM', 1, NOW()),
('authz.manage', 'Quản trị phân quyền người dùng', 'SYSTEM', 1, NOW()),
('dashboard.view', 'Xem dashboard tổng quan', 'DASHBOARD', 1, NOW()),
('departments.read', 'Xem phòng ban', 'DEPARTMENTS', 1, NOW()),
('departments.write', 'Thêm/Sửa phòng ban', 'DEPARTMENTS', 1, NOW()),
('departments.delete', 'Xóa phòng ban', 'DEPARTMENTS', 1, NOW()),
('departments.import', 'Nhập phòng ban', 'DEPARTMENTS', 1, NOW()),
('departments.export', 'Xuất phòng ban', 'DEPARTMENTS', 1, NOW()),
('employees.read', 'Xem nhân sự nội bộ', 'EMPLOYEES', 1, NOW()),
('employees.write', 'Thêm/Sửa nhân sự nội bộ', 'EMPLOYEES', 1, NOW()),
('employees.delete', 'Xóa nhân sự nội bộ', 'EMPLOYEES', 1, NOW()),
('employees.import', 'Nhập nhân sự nội bộ', 'EMPLOYEES', 1, NOW()),
('employees.export', 'Xuất nhân sự nội bộ', 'EMPLOYEES', 1, NOW()),
('user_dept_history.read', 'Xem lịch sử luân chuyển', 'EMPLOYEES', 1, NOW()),
('user_dept_history.write', 'Thêm/Sửa lịch sử luân chuyển', 'EMPLOYEES', 1, NOW()),
('user_dept_history.delete', 'Xóa lịch sử luân chuyển', 'EMPLOYEES', 1, NOW()),
('businesses.read', 'Xem lĩnh vực kinh doanh', 'MASTER_DATA', 1, NOW()),
('businesses.write', 'Thêm/Sửa lĩnh vực kinh doanh', 'MASTER_DATA', 1, NOW()),
('businesses.delete', 'Xóa lĩnh vực kinh doanh', 'MASTER_DATA', 1, NOW()),
('businesses.import', 'Nhập lĩnh vực kinh doanh', 'MASTER_DATA', 1, NOW()),
('businesses.export', 'Xuất lĩnh vực kinh doanh', 'MASTER_DATA', 1, NOW()),
('vendors.read', 'Xem nhà cung cấp', 'MASTER_DATA', 1, NOW()),
('vendors.write', 'Thêm/Sửa nhà cung cấp', 'MASTER_DATA', 1, NOW()),
('vendors.delete', 'Xóa nhà cung cấp', 'MASTER_DATA', 1, NOW()),
('vendors.import', 'Nhập nhà cung cấp', 'MASTER_DATA', 1, NOW()),
('vendors.export', 'Xuất nhà cung cấp', 'MASTER_DATA', 1, NOW()),
('products.read', 'Xem sản phẩm', 'MASTER_DATA', 1, NOW()),
('products.write', 'Thêm/Sửa sản phẩm', 'MASTER_DATA', 1, NOW()),
('products.delete', 'Xóa sản phẩm', 'MASTER_DATA', 1, NOW()),
('products.import', 'Nhập sản phẩm', 'MASTER_DATA', 1, NOW()),
('products.export', 'Xuất sản phẩm', 'MASTER_DATA', 1, NOW()),
('customers.read', 'Xem khách hàng', 'CRM', 1, NOW()),
('customers.write', 'Thêm/Sửa khách hàng', 'CRM', 1, NOW()),
('customers.delete', 'Xóa khách hàng', 'CRM', 1, NOW()),
('customers.import', 'Nhập khách hàng', 'CRM', 1, NOW()),
('customers.export', 'Xuất khách hàng', 'CRM', 1, NOW()),
('customer_personnel.read', 'Xem đầu mối liên hệ', 'CRM', 1, NOW()),
('customer_personnel.write', 'Thêm/Sửa đầu mối liên hệ', 'CRM', 1, NOW()),
('customer_personnel.delete', 'Xóa đầu mối liên hệ', 'CRM', 1, NOW()),
('opportunities.read', 'Xem cơ hội kinh doanh', 'CRM', 1, NOW()),
('opportunities.write', 'Thêm/Sửa cơ hội kinh doanh', 'CRM', 1, NOW()),
('opportunities.delete', 'Xóa cơ hội kinh doanh', 'CRM', 1, NOW()),
('opportunities.import', 'Nhập cơ hội kinh doanh', 'CRM', 1, NOW()),
('opportunities.export', 'Xuất cơ hội kinh doanh', 'CRM', 1, NOW()),
('projects.read', 'Xem dự án', 'PROJECT', 1, NOW()),
('projects.write', 'Thêm/Sửa dự án', 'PROJECT', 1, NOW()),
('projects.delete', 'Xóa dự án', 'PROJECT', 1, NOW()),
('projects.import', 'Nhập dự án', 'PROJECT', 1, NOW()),
('projects.export', 'Xuất dự án', 'PROJECT', 1, NOW()),
('contracts.read', 'Xem hợp đồng', 'CONTRACT', 1, NOW()),
('contracts.write', 'Thêm/Sửa hợp đồng', 'CONTRACT', 1, NOW()),
('contracts.delete', 'Xóa hợp đồng', 'CONTRACT', 1, NOW()),
('contracts.import', 'Nhập hợp đồng', 'CONTRACT', 1, NOW()),
('contracts.export', 'Xuất hợp đồng', 'CONTRACT', 1, NOW()),
('contracts.payments', 'Quản lý kỳ thanh toán hợp đồng', 'CONTRACT', 1, NOW()),
('documents.read', 'Xem tài liệu', 'DOCUMENT', 1, NOW()),
('documents.write', 'Thêm/Sửa tài liệu', 'DOCUMENT', 1, NOW()),
('documents.delete', 'Xóa tài liệu', 'DOCUMENT', 1, NOW()),
('reminders.read', 'Xem nhắc việc', 'REMINDER', 1, NOW()),
('reminders.write', 'Thêm/Sửa nhắc việc', 'REMINDER', 1, NOW()),
('reminders.delete', 'Xóa nhắc việc', 'REMINDER', 1, NOW()),
('audit_logs.read', 'Xem nhật ký hệ thống', 'AUDIT', 1, NOW()),
('support_service_groups.read', 'Xem nhóm hỗ trợ', 'SUPPORT', 1, NOW()),
('support_service_groups.write', 'Thêm/Sửa nhóm hỗ trợ', 'SUPPORT', 1, NOW()),
('support_service_groups.delete', 'Xóa nhóm hỗ trợ', 'SUPPORT', 1, NOW()),
('support_requests.read', 'Xem yêu cầu hỗ trợ', 'SUPPORT', 1, NOW()),
('support_requests.write', 'Thêm/Sửa yêu cầu hỗ trợ', 'SUPPORT', 1, NOW()),
('support_requests.delete', 'Xóa yêu cầu hỗ trợ', 'SUPPORT', 1, NOW()),
('support_requests.import', 'Nhập yêu cầu hỗ trợ', 'SUPPORT', 1, NOW()),
('support_requests.export', 'Xuất yêu cầu hỗ trợ', 'SUPPORT', 1, NOW()),
('support_requests.status', 'Đổi trạng thái yêu cầu hỗ trợ', 'SUPPORT', 1, NOW()),
('support_requests.history', 'Xem lịch sử yêu cầu hỗ trợ', 'SUPPORT', 1, NOW());

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`, `created_at`)
SELECT r.id, p.id, NOW()
FROM `roles` r
JOIN `permissions` p
WHERE r.role_code = 'ADMIN';

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`, `created_at`)
SELECT r.id, p.id, NOW()
FROM `roles` r
JOIN `permissions` p ON p.perm_key IN (
    'dashboard.view',
    'departments.read',
    'employees.read',
    'user_dept_history.read',
    'businesses.read',
    'vendors.read',
    'products.read',
    'customers.read',
    'customer_personnel.read',
    'opportunities.read',
    'projects.read',
    'contracts.read',
    'contracts.payments',
    'documents.read',
    'reminders.read',
    'audit_logs.read',
    'support_service_groups.read',
    'support_requests.read',
    'support_requests.history',
    'support_requests.status',
    'support_requests.export'
)
WHERE r.role_code = 'DIRECTOR';

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`, `created_at`)
SELECT r.id, p.id, NOW()
FROM `roles` r
JOIN `permissions` p ON p.perm_key IN (
    'dashboard.view',
    'departments.read',
    'employees.read',
    'user_dept_history.read',
    'businesses.read',
    'vendors.read',
    'products.read',
    'customers.read',
    'customer_personnel.read',
    'opportunities.read',
    'opportunities.write',
    'projects.read',
    'projects.write',
    'contracts.read',
    'contracts.payments',
    'documents.read',
    'reminders.read',
    'support_service_groups.read',
    'support_requests.read',
    'support_requests.write',
    'support_requests.status',
    'support_requests.history',
    'support_requests.import',
    'support_requests.export'
)
WHERE r.role_code = 'MANAGER';

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`, `created_at`)
SELECT r.id, p.id, NOW()
FROM `roles` r
JOIN `permissions` p ON p.perm_key IN (
    'dashboard.view',
    'departments.read',
    'employees.read',
    'customers.read',
    'projects.read',
    'products.read',
    'support_service_groups.read',
    'support_requests.read',
    'support_requests.write',
    'support_requests.status',
    'support_requests.history'
)
WHERE r.role_code = 'STAFF';

INSERT INTO `user_roles` (`user_id`, `role_id`, `is_active`, `created_at`)
SELECT u.id, r.id, 1, NOW()
FROM `internal_users` u
JOIN `roles` r ON r.role_code = 'ADMIN'
WHERE u.username = 'admin.demo'
  AND NOT EXISTS (
      SELECT 1 FROM `user_roles` ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

INSERT INTO `user_roles` (`user_id`, `role_id`, `is_active`, `created_at`)
SELECT u.id, r.id, 1, NOW()
FROM `internal_users` u
JOIN `roles` r ON r.role_code = 'MANAGER'
WHERE u.username = 'sales.demo'
  AND NOT EXISTS (
      SELECT 1 FROM `user_roles` ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

INSERT INTO `user_roles` (`user_id`, `role_id`, `is_active`, `created_at`)
SELECT u.id, r.id, 1, NOW()
FROM `internal_users` u
JOIN `roles` r ON r.role_code = 'STAFF'
WHERE u.username = 'system.demo'
  AND NOT EXISTS (
      SELECT 1 FROM `user_roles` ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

INSERT INTO `user_dept_scopes` (`user_id`, `dept_id`, `scope_type`, `created_at`)
SELECT u.id,
       COALESCE(u.department_id, (SELECT d.id FROM `departments` d ORDER BY d.id LIMIT 1)),
       'ALL',
       NOW()
FROM `internal_users` u
WHERE u.username IN ('admin', 'admin.demo', 'director')
  AND COALESCE(u.department_id, (SELECT d.id FROM `departments` d ORDER BY d.id LIMIT 1)) IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM `user_dept_scopes` uds
      WHERE uds.user_id = u.id AND uds.scope_type = 'ALL'
  );

INSERT INTO `user_dept_scopes` (`user_id`, `dept_id`, `scope_type`, `created_at`)
SELECT u.id,
       COALESCE(u.department_id, (SELECT d.id FROM `departments` d ORDER BY d.id LIMIT 1)),
       'DEPT_AND_CHILDREN',
       NOW()
FROM `internal_users` u
WHERE u.username IN ('manager', 'sales.demo')
  AND COALESCE(u.department_id, (SELECT d.id FROM `departments` d ORDER BY d.id LIMIT 1)) IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM `user_dept_scopes` uds
      WHERE uds.user_id = u.id AND uds.scope_type = 'DEPT_AND_CHILDREN'
  );

INSERT INTO `user_dept_scopes` (`user_id`, `dept_id`, `scope_type`, `created_at`)
SELECT u.id,
       COALESCE(u.department_id, (SELECT d.id FROM `departments` d ORDER BY d.id LIMIT 1)),
       'SELF_ONLY',
       NOW()
FROM `internal_users` u
WHERE u.username = 'system.demo'
  AND COALESCE(u.department_id, (SELECT d.id FROM `departments` d ORDER BY d.id LIMIT 1)) IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM `user_dept_scopes` uds
      WHERE uds.user_id = u.id AND uds.scope_type = 'SELF_ONLY'
  );


-- =====================================================================
-- MYSQL SYNC BACKUP SNAPSHOT: 2026-02-25 07:16:35 +0700
-- Source: vnpt_business_db@127.0.0.1:3306
-- =====================================================================

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

LOCK TABLES `attachments` WRITE;
/*!40000 ALTER TABLE `attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `attachments` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,'11111111-1111-1111-1111-111111111111','INSERT','internal_users',9001,NULL,'{\"status\": \"ACTIVE\", \"vpn_status\": \"YES\"}','/api/v5/employees','10.10.10.10','Seeder/Test','2026-02-23 14:36:48',4),(2,'22222222-2222-2222-2222-222222222222','UPDATE','internal_users',9002,'{\"vpn_status\": \"NO\"}','{\"vpn_status\": \"YES\"}','/api/v5/employees/9002','10.10.10.21','Seeder/Test','2026-02-23 14:46:48',NULL),(3,'33333333-3333-3333-3333-333333333333','DELETE','projects',3001,'{\"status\": \"PLANNING\"}',NULL,'/api/v5/projects/3001','10.10.10.99','Seeder/Test','2026-02-23 14:56:48',999999);
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `business_domains` WRITE;
/*!40000 ALTER TABLE `business_domains` DISABLE KEYS */;
INSERT INTO `business_domains` VALUES (1,'KD006','Y tế số','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'KD003','An toàn thông tin','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `business_domains` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `cache_invalidation_queue` WRITE;
/*!40000 ALTER TABLE `cache_invalidation_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_invalidation_queue` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `contracts` WRITE;
/*!40000 ALTER TABLE `contracts` DISABLE KEYS */;
INSERT INTO `contracts` VALUES (1,'HD001','Hợp đồng triển khai VNPT HIS',1,1,'2026-01-15','2026-12-31',150000000.00,'SIGNED',2,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'HD002','Hợp đồng dịch vụ SOC',2,2,'2026-02-20','2026-12-20',80000000.00,'PENDING',2,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL);
/*!40000 ALTER TABLE `contracts` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `customer_personnel` WRITE;
/*!40000 ALTER TABLE `customer_personnel` DISABLE KEYS */;
INSERT INTO `customer_personnel` VALUES (1,1,'Nguyễn Văn A','GIAM_DOC','0912345678','nguyenvana@vietcombank.com.vn','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,2,'Trần Thị B','TRUONG_PHONG','0987654321','tranthib@petrolimex.com.vn','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `customer_personnel` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'KH001','Ngân hàng Vietcombank','0100112437','198 Trần Quang Khải, Hoàn Kiếm, Hà Nội',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'KH002','Tập đoàn Petrolimex','0100107370','Số 1 Khâm Thiên, Đống Đa, Hà Nội',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (1,'9370dd70-10c8-11f1-a6f1-c80ff292045c','PB001','Ban Điều hành',NULL,'1/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-23 15:19:41',NULL),(2,'93742430-10c8-11f1-a6f1-c80ff292045c','PB002','Phòng Kinh doanh',1,'1/2/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-23 15:19:41',NULL),(3,'9376de78-10c8-11f1-a6f1-c80ff292045c','PB003','Phòng Kỹ thuật',1,'1/3/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-23 15:19:41',NULL);
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `document_types` WRITE;
/*!40000 ALTER TABLE `document_types` DISABLE KEYS */;
INSERT INTO `document_types` VALUES (1,'DT001','Hợp đồng kinh tế','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'DT002','Biên bản nghiệm thu','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `document_types` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
INSERT INTO `documents` VALUES (1,'DOC001','Hợp đồng VNPT HIS - Bản chính',1,1,1,'2026-12-31','ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'DOC002','Biên bản nghiệm thu giai đoạn 1',2,2,2,'2026-09-30','ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,'c40055aa-9749-48f2-8a9b-aec37eeb4366','admin.demo','Nguyễn Quản Trị','admin.demo@vnpt.vn','ACTIVE',3,1,'ALL',NULL,NULL,'2026-02-23 08:01:47','2026-02-23 08:19:41','System Administrator','1990-01-15','MALE','YES','10.10.10.10'),(2,'d2f0f309-e00b-409e-b211-09f6f17838af','sales.demo','Trần Kinh Doanh','sales.demo@vnpt.vn','ACTIVE',2,2,'DEPT_ONLY',NULL,NULL,'2026-02-23 08:01:47','2026-02-23 08:19:41','Sales Executive','1994-05-20','FEMALE','NO','10.10.10.21'),(3,'1ea2777c-3c6b-4c20-a95d-90e3499049a4','system.demo','Lê Hệ Thống','system.demo@vnpt.vn','SUSPENDED',3,3,'ALL',NULL,NULL,'2026-02-23 08:01:48','2026-02-23 08:19:41','Automation Operator','1988-11-11','OTHER','YES','10.10.10.99'),(4,'9b93f0b5-472e-4fb6-b69e-7b19072f4a5f','vnpt022327','Nguyễn Văn A','nguyenvana@vnpt.vn','ACTIVE',1,3,NULL,NULL,NULL,'2026-02-23 19:46:02','2026-02-23 19:46:02','Chuyên viên kinh doanh','1995-08-10','MALE','YES',NULL),(5,'059837c8-1b86-49e8-9565-84a77c8c38b8','ctv091020','Trần Thị B','tranthib@vnpt.vn','ACTIVE',2,5,NULL,NULL,NULL,'2026-02-23 19:46:02','2026-02-23 19:46:17','Nhân viên chăm sóc khách hàng','1993-11-22','FEMALE','NO',NULL);
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `internal_users` WRITE;
/*!40000 ALTER TABLE `internal_users` DISABLE KEYS */;
INSERT INTO `internal_users` VALUES (1,'5fa8c238-10c2-11f1-a6f1-c80ff292045c','ADMIN001','admin','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'System Admin',NULL,'admin@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',NULL,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,NULL,NULL),(2,'5fa8c9ae-10c2-11f1-a6f1-c80ff292045c','DIR001','director','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Giám đốc Demo',NULL,'director@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',NULL,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,NULL,NULL),(3,'5fa8ccf6-10c2-11f1-a6f1-c80ff292045c','MAN001','manager','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Trưởng phòng Demo',NULL,'manager@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',NULL,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,NULL,NULL),(4,'2a3fbfee-08b5-4e64-9a74-46db187527a4','INT9001','admin.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Nguyễn Quản Trị','System Administrator','admin.demo@vnpt.vn',NULL,'1990-01-15','MALE',NULL,'ACTIVE',3,1,'10.10.10.10','YES','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL),(5,'ca2b4545-e172-4d36-accd-748b88ea2690','INT9002','sales.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Trần Kinh Doanh','Sales Executive','sales.demo@vnpt.vn',NULL,'1994-05-20','FEMALE',NULL,'ACTIVE',2,2,'10.10.10.21','NO','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL),(6,'f3f2ebe0-a803-45fe-bfbd-998510aebe92','INT9003','system.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Lê Hệ Thống','Automation Operator','system.demo@vnpt.vn',NULL,'1988-11-11','OTHER',NULL,'SUSPENDED',3,3,'10.10.10.99','YES','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `internal_users` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_02_21_152322_create_personal_access_tokens_table',1),(5,'2026_02_23_134500_create_v5_enterprise_master_tables',1),(6,'2026_02_23_220000_add_extended_fields_to_employees_table',1),(7,'2026_02_23_220100_create_audit_logs_table',1);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `opportunities` WRITE;
/*!40000 ALTER TABLE `opportunities` DISABLE KEYS */;
INSERT INTO `opportunities` VALUES (1,'Triển khai VNPT HIS cho Vietcombank',1,150000000.00,70,'PROPOSAL',2,5,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'Dịch vụ SOC cho Petrolimex',2,80000000.00,60,'NEGOTIATION',2,5,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL);
/*!40000 ALTER TABLE `opportunities` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

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
  CONSTRAINT `fk_ps_contract` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ps_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 36: Kế hoạch thanh toán & Dòng tiền dự kiến';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_schedules`
--

LOCK TABLES `payment_schedules` WRITE;
/*!40000 ALTER TABLE `payment_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_schedules` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=144 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 11: Danh mục quyền nguyên tử';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'system.health.view','Xem trạng thái bảng hệ thống','SYSTEM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,'dashboard.view','Xem dashboard tổng quan','DASHBOARD',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,'departments.read','Xem phòng ban','DEPARTMENTS',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,'departments.write','Thêm/Sửa phòng ban','DEPARTMENTS',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(5,'departments.delete','Xóa phòng ban','DEPARTMENTS',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(6,'departments.import','Nhập phòng ban','DEPARTMENTS',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(7,'departments.export','Xuất phòng ban','DEPARTMENTS',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(8,'employees.read','Xem nhân sự nội bộ','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(9,'employees.write','Thêm/Sửa nhân sự nội bộ','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(10,'employees.delete','Xóa nhân sự nội bộ','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(11,'employees.import','Nhập nhân sự nội bộ','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(12,'employees.export','Xuất nhân sự nội bộ','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(13,'user_dept_history.read','Xem lịch sử luân chuyển','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(14,'user_dept_history.write','Thêm/Sửa lịch sử luân chuyển','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(15,'user_dept_history.delete','Xóa lịch sử luân chuyển','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(16,'businesses.read','Xem lĩnh vực kinh doanh','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(17,'businesses.write','Thêm/Sửa lĩnh vực kinh doanh','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(18,'businesses.delete','Xóa lĩnh vực kinh doanh','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(19,'businesses.import','Nhập lĩnh vực kinh doanh','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(20,'businesses.export','Xuất lĩnh vực kinh doanh','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(21,'vendors.read','Xem nhà cung cấp','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(22,'vendors.write','Thêm/Sửa nhà cung cấp','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(23,'vendors.delete','Xóa nhà cung cấp','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(24,'vendors.import','Nhập nhà cung cấp','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(25,'vendors.export','Xuất nhà cung cấp','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(26,'products.read','Xem sản phẩm','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(27,'products.write','Thêm/Sửa sản phẩm','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(28,'products.delete','Xóa sản phẩm','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(29,'products.import','Nhập sản phẩm','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(30,'products.export','Xuất sản phẩm','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(31,'customers.read','Xem khách hàng','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(32,'customers.write','Thêm/Sửa khách hàng','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(33,'customers.delete','Xóa khách hàng','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(34,'customers.import','Nhập khách hàng','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(35,'customers.export','Xuất khách hàng','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(36,'customer_personnel.read','Xem đầu mối liên hệ','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(37,'customer_personnel.write','Thêm/Sửa đầu mối liên hệ','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(38,'customer_personnel.delete','Xóa đầu mối liên hệ','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(39,'opportunities.read','Xem cơ hội kinh doanh','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(40,'opportunities.write','Thêm/Sửa cơ hội kinh doanh','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(41,'opportunities.delete','Xóa cơ hội kinh doanh','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(42,'opportunities.import','Nhập cơ hội kinh doanh','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(43,'opportunities.export','Xuất cơ hội kinh doanh','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(44,'projects.read','Xem dự án','PROJECT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(45,'projects.write','Thêm/Sửa dự án','PROJECT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(46,'projects.delete','Xóa dự án','PROJECT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(47,'projects.import','Nhập dự án','PROJECT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(48,'projects.export','Xuất dự án','PROJECT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(49,'contracts.read','Xem hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(50,'contracts.write','Thêm/Sửa hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(51,'contracts.delete','Xóa hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(52,'contracts.import','Nhập hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(53,'contracts.export','Xuất hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(54,'contracts.payments','Quản lý kỳ thanh toán hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(55,'documents.read','Xem tài liệu','DOCUMENT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(56,'documents.write','Thêm/Sửa tài liệu','DOCUMENT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(57,'documents.delete','Xóa tài liệu','DOCUMENT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(58,'reminders.read','Xem nhắc việc','REMINDER',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(59,'reminders.write','Thêm/Sửa nhắc việc','REMINDER',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(60,'reminders.delete','Xóa nhắc việc','REMINDER',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(61,'audit_logs.read','Xem nhật ký hệ thống','AUDIT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(62,'support_service_groups.read','Xem nhóm hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(63,'support_service_groups.write','Thêm/Sửa nhóm hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(64,'support_service_groups.delete','Xóa nhóm hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(65,'support_requests.read','Xem yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(66,'support_requests.write','Thêm/Sửa yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(67,'support_requests.delete','Xóa yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(68,'support_requests.import','Nhập yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(69,'support_requests.export','Xuất yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(70,'support_requests.status','Đổi trạng thái yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(71,'support_requests.history','Xem lịch sử yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(72,'authz.manage','Quản trị phân quyền người dùng','SYSTEM',1,'2026-02-24 23:57:13',NULL,NULL,NULL);
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (1,'App\\Models\\InternalUser',1,'vnpt_business_web','51121a7f6abcf0ee54674f7bfa56c094bbb2c230b4943b8df3bfa78d5ff426e4','[\"*\"]',NULL,NULL,'2026-02-24 16:46:12','2026-02-24 16:46:12'),(2,'App\\Models\\InternalUser',5,'vnpt_business_web','eaa1e541e2db8a9ef904100245411bde570695df96ebabfcceb983c54a454d15','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 16:46:27',NULL,'2026-02-24 16:46:27','2026-02-24 16:46:27'),(3,'App\\Models\\InternalUser',5,'vnpt_business_web','7968cbc9b83428e82e1db3df41fd1c340663711fdc1e9bac4dac699fa2db2e75','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 16:46:48',NULL,'2026-02-24 16:46:48','2026-02-24 16:46:48'),(4,'App\\Models\\InternalUser',5,'vnpt_business_web','1d839e46b1dc73124669bab4725247dca6ef838db18d73e545190e8cc52df5de','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 16:46:59',NULL,'2026-02-24 16:46:59','2026-02-24 16:46:59'),(6,'App\\Models\\InternalUser',1,'vnpt_business_web','4be372717886bb889d1ff3f7cb33b02a9c1eedd02ba73981c7602e0094ea9887','[\"*\"]','2026-02-24 17:11:34',NULL,'2026-02-24 16:50:05','2026-02-24 17:11:34'),(7,'App\\Models\\InternalUser',1,'vnpt_business_web','3a90cb04f4506ebd426c6ef5802c21a6d7bc0f3d7f4dc4da60530893be98e477','[\"*\"]','2026-02-24 17:04:59',NULL,'2026-02-24 17:04:59','2026-02-24 17:04:59'),(8,'App\\Models\\InternalUser',5,'vnpt_business_web','295c86c798cd6e70e6925700c36f9150d509ad9f9aa89f3b5895a28203faf502','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 17:04:59',NULL,'2026-02-24 17:04:59','2026-02-24 17:04:59'),(9,'App\\Models\\InternalUser',1,'vnpt_business_web','37e5aef51ffd52c43e312482974d552b007eb83a5079f49552853f5886730c80','[\"*\"]','2026-02-24 17:09:01',NULL,'2026-02-24 17:09:01','2026-02-24 17:09:01');
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `position_default_roles` WRITE;
/*!40000 ALTER TABLE `position_default_roles` DISABLE KEYS */;
/*!40000 ALTER TABLE `position_default_roles` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `positions` WRITE;
/*!40000 ALTER TABLE `positions` DISABLE KEYS */;
INSERT INTO `positions` VALUES (1,'GD','Giám đốc',5,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(2,'PGD','Phó Giám đốc',4,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(3,'TP','Trưởng phòng',3,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(4,'PP','Phó phòng',2,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(5,'CV','Chuyên viên',1,1,'2026-02-23 14:17:23',NULL,NULL,NULL);
/*!40000 ALTER TABLE `positions` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'VNPT_HIS','Giải pháp VNPT HIS',1,1,150000000.00,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'SOC_MONITOR','Dịch vụ giám sát SOC',2,2,80000000.00,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 29: Hạng mục chi tiết dự án';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_items`
--

LOCK TABLES `project_items` WRITE;
/*!40000 ALTER TABLE `project_items` DISABLE KEYS */;
INSERT INTO `project_items` VALUES (1,1,1,1.00,150000000.00,'2026-02-24 01:00:00',NULL,'2026-02-24 01:00:00',NULL,NULL),(2,2,2,1.00,80000000.00,'2026-02-24 01:05:00',NULL,'2026-02-24 01:05:00',NULL,NULL);
/*!40000 ALTER TABLE `project_items` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (1,'DA001','Dự án VNPT HIS - Vietcombank',1,1,'DAU_TU','2026-01-10','2026-12-31','ONGOING','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'DA002','Dự án SOC - Petrolimex',2,2,'THUE_DICH_VU','2026-02-01','2026-10-01','PLANNING','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL);
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `raci_assignments` WRITE;
/*!40000 ALTER TABLE `raci_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `raci_assignments` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `reminders` WRITE;
/*!40000 ALTER TABLE `reminders` DISABLE KEYS */;
INSERT INTO `reminders` VALUES (1,'Gửi báo cáo tuần cho khách hàng','Tổng hợp tiến độ và gửi báo cáo tuần.',NULL,NULL,'2026-02-24 09:00:00',5,0,'ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'Nhắc lịch họp kickoff dự án','Chuẩn bị nội dung họp kickoff với khách hàng.',NULL,NULL,'2026-02-26 14:00:00',5,0,'ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `reminders` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `role_permission` WRITE;
/*!40000 ALTER TABLE `role_permission` DISABLE KEYS */;
INSERT INTO `role_permission` VALUES (1,1,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,2,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,3,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,4,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,5,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,6,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,7,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,8,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,9,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,10,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,11,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,12,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,13,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,14,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,15,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,16,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,17,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,18,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,19,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,20,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,21,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,22,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,23,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,24,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,25,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,26,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,27,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,28,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,29,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,30,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,31,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,32,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,33,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,34,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,35,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,36,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,37,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,38,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,39,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,40,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,41,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,42,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,43,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,44,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,45,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,46,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,47,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,48,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,49,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,50,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,51,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,52,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,53,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,54,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,55,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,56,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,57,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,58,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,59,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,60,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,61,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,62,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,63,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,64,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,65,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,66,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,67,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,68,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,69,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,70,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,71,'2026-02-24 23:39:23',NULL,NULL,NULL),(1,72,'2026-02-24 23:57:13',NULL,NULL,NULL),(2,2,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,3,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,8,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,13,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,16,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,21,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,26,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,31,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,36,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,39,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,44,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,49,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,54,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,55,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,58,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,61,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,62,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,65,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,69,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,70,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,71,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,2,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,3,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,8,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,13,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,16,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,21,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,26,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,31,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,36,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,39,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,40,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,44,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,45,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,49,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,54,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,55,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,58,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,62,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,65,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,66,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,68,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,69,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,70,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,71,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,2,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,3,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,8,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,26,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,31,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,44,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,62,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,65,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,66,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,70,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,71,'2026-02-24 23:39:23',NULL,NULL,NULL);
/*!40000 ALTER TABLE `role_permission` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'ADMIN','Quản trị hệ thống',NULL,1,'Quyền tối cao toàn hệ thống','2026-02-23 14:17:23',NULL,NULL,NULL),(2,'DIRECTOR','Ban Giám đốc',NULL,1,'Theo dõi toàn bộ dự án, hợp đồng','2026-02-23 14:17:23',NULL,NULL,NULL),(3,'MANAGER','Quản lý cấp trung',NULL,1,'Quản lý phòng ban','2026-02-23 14:17:23',NULL,NULL,NULL),(4,'STAFF','Nhân viên',NULL,1,'Quyền cơ bản thao tác nghiệp vụ','2026-02-23 14:17:23',NULL,NULL,NULL);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('WzETfd6C67RVG4pjTlKC1VhLPK88g66mpZDzGxHh',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiNGNBWUV4a3FtY2JqelowdmZsRmpTdTF6cFFYR05aMkRlSExNR0tTRiI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1771907403);
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_request_history`
--

DROP TABLE IF EXISTS `support_request_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_request_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_id` bigint unsigned NOT NULL,
  `old_status` enum('OPEN','HOTFIXING','RESOLVED','DEPLOYED','PENDING','CANCELLED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` enum('OPEN','HOTFIXING','RESOLVED','DEPLOYED','PENDING','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned NOT NULL COMMENT 'Người chuyển trạng thái',
  PRIMARY KEY (`id`),
  KEY `fk_shist_request` (`request_id`),
  KEY `fk_shist_cb` (`created_by`),
  CONSTRAINT `fk_shist_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
  CONSTRAINT `fk_shist_request` FOREIGN KEY (`request_id`) REFERENCES `support_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 38: Nhật ký thay đổi trạng thái Task';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_request_history`
--

LOCK TABLES `support_request_history` WRITE;
/*!40000 ALTER TABLE `support_request_history` DISABLE KEYS */;
INSERT INTO `support_request_history` VALUES (11,2,NULL,'OPEN','Tạo mới yêu cầu hỗ trợ.','2026-02-24 01:30:00',1),(12,3,NULL,'OPEN','Tạo yêu cầu khẩn do lỗi vận hành.','2026-02-24 03:00:00',3),(13,3,'OPEN','HOTFIXING','Chuyển xử lý nóng để khắc phục ngay trong ngày.','2026-02-24 04:10:00',3),(14,4,NULL,'OPEN','Tiếp nhận yêu cầu tối ưu hiệu năng.','2026-02-22 07:20:00',5),(15,4,'OPEN','RESOLVED','Đã xử lý xong và bàn giao QA xác nhận.','2026-02-24 09:30:00',5),(16,5,NULL,'OPEN','Tiếp nhận cấu hình LIS theo quy định mới.','2026-02-21 02:10:00',6),(17,5,'OPEN','RESOLVED','Hoàn thành chỉnh sửa và kiểm thử nội bộ.','2026-02-23 08:40:00',6),(18,5,'RESOLVED','DEPLOYED','Đã triển khai production và thông báo khách hàng.','2026-02-24 02:00:00',6);
/*!40000 ALTER TABLE `support_request_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_requests`
--

DROP TABLE IF EXISTS `support_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ticket_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã Jira (IT360-1234) hoặc Bitbucket PR',
  `summary` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nội dung yêu cầu / Tên Task',
  `service_group_id` bigint unsigned DEFAULT NULL COMMENT 'Nhóm xử lý (L2, L3, OS...)',
  `project_item_id` bigint unsigned DEFAULT NULL COMMENT 'Hạng mục dự án (project_items)',
  `customer_id` bigint unsigned NOT NULL COMMENT 'Đơn vị yêu cầu (Khách hàng)',
  `project_id` bigint unsigned DEFAULT NULL COMMENT 'Gắn với dự án (HIS, Văn bản 130...)',
  `product_id` bigint unsigned DEFAULT NULL COMMENT 'Gắn với sản phẩm (Phần mềm cụ thể)',
  `reporter_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Người báo yêu cầu',
  `assignee_id` bigint unsigned DEFAULT NULL COMMENT 'Người trực tiếp xử lý (Assignee)',
  `status` enum('OPEN','HOTFIXING','RESOLVED','DEPLOYED','PENDING','CANCELLED') COLLATE utf8mb4_unicode_ci DEFAULT 'OPEN',
  `priority` enum('LOW','MEDIUM','HIGH','URGENT') COLLATE utf8mb4_unicode_ci DEFAULT 'MEDIUM',
  `requested_date` date NOT NULL COMMENT 'Ngày nhận yêu cầu',
  `due_date` date DEFAULT NULL COMMENT 'Hạn hoàn thành',
  `resolved_date` date DEFAULT NULL COMMENT 'Ngày xong thực tế',
  `hotfix_date` date DEFAULT NULL COMMENT 'Ngày đẩy Hotfix',
  `noti_date` date DEFAULT NULL COMMENT 'Ngày báo cho khách hàng',
  `task_link` text COLLATE utf8mb4_unicode_ci COMMENT 'Link Jira / Bitbucket',
  `change_log` text COLLATE utf8mb4_unicode_ci COMMENT 'Hướng xử lý / Ghi chú kỹ thuật',
  `test_note` text COLLATE utf8mb4_unicode_ci COMMENT 'Kết quả kiểm thử',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_code` (`ticket_code`),
  KEY `idx_support_status` (`status`),
  KEY `idx_support_dates` (`requested_date`,`due_date`),
  KEY `fk_support_cust` (`customer_id`),
  KEY `fk_support_proj` (`project_id`),
  KEY `fk_support_prod` (`product_id`),
  KEY `fk_support_user` (`assignee_id`),
  KEY `fk_support_group` (`service_group_id`),
  KEY `fk_sr_cb` (`created_by`),
  KEY `fk_sr_ub` (`updated_by`),
  KEY `idx_support_project_item` (`project_item_id`),
  CONSTRAINT `fk_sr_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sr_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_cust` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_support_group` FOREIGN KEY (`service_group_id`) REFERENCES `support_service_groups` (`id`),
  CONSTRAINT `fk_support_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_support_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fk_support_project_item` FOREIGN KEY (`project_item_id`) REFERENCES `project_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_user` FOREIGN KEY (`assignee_id`) REFERENCES `internal_users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 37: Quản lý Task hỗ trợ chi tiết';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_requests`
--

LOCK TABLES `support_requests` WRITE;
/*!40000 ALTER TABLE `support_requests` DISABLE KEYS */;
INSERT INTO `support_requests` VALUES (2,'IT360-1234','Lỗi đồng bộ dữ liệu bệnh án HIS',1,1,1,1,1,'Nguyễn Văn A',1,'OPEN','HIGH','2026-02-24','2026-02-26',NULL,NULL,NULL,'https://jira.example/IT360-1234','Kiểm tra service đồng bộ, chuẩn hóa dữ liệu đầu vào.',NULL,'Theo dõi phản hồi của khách hàng sau khi vá.','2026-02-24 01:30:00',1,'2026-02-24 15:10:42',1,NULL),(3,'IT360-1242','Hotfix lỗi không lưu được đơn thuốc ngoại trú',2,1,1,1,1,'Lê Thị B',3,'HOTFIXING','URGENT','2026-02-24','2026-02-25',NULL,'2026-02-24',NULL,'https://jira.example/IT360-1242','Đã tạo nhánh hotfix và triển khai bản vá tạm.','QA smoke test: pass','Chờ khách hàng xác nhận sau hotfix.','2026-02-24 03:00:00',3,'2026-02-24 15:10:42',3,NULL),(4,'BB-772','Tối ưu tốc độ tải dashboard theo phòng ban',5,2,2,2,2,'Trần Văn C',5,'RESOLVED','MEDIUM','2026-02-22','2026-02-24','2026-02-24',NULL,'2026-02-24','https://bitbucket.example/pr/772','Tinh chỉnh index truy vấn và bổ sung cache.','Đã test hiệu năng: giảm ~35% thời gian phản hồi.','Có thể theo dõi thêm 1 tuần.','2026-02-22 07:20:00',5,'2026-02-24 15:10:42',5,NULL),(5,'LIS-219','Triển khai cấu hình mẫu biểu LIS theo quy định mới',6,2,2,2,2,'Phạm Thị D',6,'DEPLOYED','LOW','2026-02-21','2026-02-23','2026-02-23','2026-02-23','2026-02-24','https://jira.example/LIS-219','Đã cập nhật mẫu biểu và migrate dữ liệu.','UAT pass','Khách hàng đã xác nhận triển khai chính thức.','2026-02-21 02:10:00',6,'2026-02-24 15:10:42',6,NULL);
/*!40000 ALTER TABLE `support_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_service_groups`
--

DROP TABLE IF EXISTS `support_service_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_service_groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên nhóm: HIS L2, HIS L3, OS...',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Trạng thái hoạt động (1: Hiển thị, 0: Ẩn khỏi dropdown nhưng giữ lịch sử)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ssg_cb` (`created_by`),
  KEY `fk_ssg_ub` (`updated_by`),
  CONSTRAINT `fk_ssg_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ssg_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 36: Danh mục nhóm hỗ trợ chuyên trách';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_service_groups`
--

LOCK TABLES `support_service_groups` WRITE;
/*!40000 ALTER TABLE `support_service_groups` DISABLE KEYS */;
INSERT INTO `support_service_groups` VALUES (1,'HIS L2','Hỗ trợ hướng dẫn, cấu hình tham số, xử lý dữ liệu đơn giản',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(2,'HIS L3','Đội lập trình fix lỗi logic, hotfix core phần mềm HIS',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(3,'UPCODE VĂN BẢN','Cập nhật tính năng theo các Thông tư, Quyết định mới (VD: CV130)',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(4,'DỰ ÁN THUÊ OS','Đội ngũ Outsource thực hiện các module thuê ngoài',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(5,'HOÀN THIỆN PHẦN MỀM','Yêu cầu nâng cấp, tối ưu chức năng hiện có',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(6,'ĐỘI LIS/EMR','Hỗ trợ chuyên sâu cho hệ thống Xét nghiệm và Bệnh án điện tử',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(13,'HIS L34','His bản 34',1,'2026-02-24 07:41:29',NULL,'2026-02-24 07:41:29',NULL);
/*!40000 ALTER TABLE `support_service_groups` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `user_delegation_items` WRITE;
/*!40000 ALTER TABLE `user_delegation_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_delegation_items` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `user_delegations` WRITE;
/*!40000 ALTER TABLE `user_delegations` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_delegations` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `user_dept_history` WRITE;
/*!40000 ALTER TABLE `user_dept_history` DISABLE KEYS */;
INSERT INTO `user_dept_history` VALUES (1,5,1,2,'2026-02-13','QD-2026-001','Điều chuyển phục vụ dự án trọng điểm.','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `user_dept_history` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 17: Phạm vi dữ liệu theo phòng ban';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_dept_scopes`
--

LOCK TABLES `user_dept_scopes` WRITE;
/*!40000 ALTER TABLE `user_dept_scopes` DISABLE KEYS */;
INSERT INTO `user_dept_scopes` VALUES (1,1,1,'ALL','2026-02-24 23:39:23',NULL,NULL,NULL),(2,4,3,'ALL','2026-02-24 23:39:23',NULL,NULL,NULL),(3,2,1,'ALL','2026-02-24 23:39:23',NULL,NULL,NULL),(4,3,1,'DEPT_AND_CHILDREN','2026-02-24 23:39:23',NULL,NULL,NULL),(5,5,2,'DEPT_AND_CHILDREN','2026-02-24 23:39:23',NULL,NULL,NULL),(8,6,3,'SELF_ONLY','2026-02-24 17:09:01',1,NULL,NULL);
/*!40000 ALTER TABLE `user_dept_scopes` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `user_permissions` WRITE;
/*!40000 ALTER TABLE `user_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 15: Gán vai trò cho người dùng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,1,1,NULL,1,'2026-02-23 14:17:23',NULL,NULL,NULL),(2,2,2,NULL,1,'2026-02-23 14:17:24',NULL,NULL,NULL),(3,3,3,NULL,1,'2026-02-23 14:17:24',NULL,NULL,NULL),(5,5,3,NULL,1,'2026-02-24 23:39:23',NULL,NULL,NULL),(7,6,4,NULL,1,'2026-02-24 17:09:01',1,NULL,NULL),(8,4,3,NULL,1,'2026-02-24 17:11:26',1,NULL,NULL);
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,'DT006','VNPT IT',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'DT007','FPT IS',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL);
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'vnpt_business_db'
--

--
-- Dumping routines for database 'vnpt_business_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-25  7:16:36
