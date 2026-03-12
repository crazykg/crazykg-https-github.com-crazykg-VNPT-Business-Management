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
-- Current Database: `vnpt_business_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `vnpt_business_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `vnpt_business_db`;

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
-- Dumping data for table `async_exports`
--

LOCK TABLES `async_exports` WRITE;
/*!40000 ALTER TABLE `async_exports` DISABLE KEYS */;
/*!40000 ALTER TABLE `async_exports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `reference_type` enum('DOCUMENT','CONTRACT','PROJECT','CUSTOMER','OPPORTUNITY','TRANSITION','WORKLOG','CUSTOMER_REQUEST') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bảng cha của file đính kèm',
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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 33: File đính kèm';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attachments`
--

LOCK TABLES `attachments` WRITE;
/*!40000 ALTER TABLE `attachments` DISABLE KEYS */;
INSERT INTO `attachments` VALUES (2,'DOCUMENT',4,'pricing-doc-test.txt','http://localhost/storage/documents/oqTfdJ8QRpOvjAq2nVDlvGqY7RWjXAfgaatvLyql.txt',NULL,17,'2026-02-25 07:18:02',1,NULL,1,NULL,NULL,NULL,NULL,0),(3,'DOCUMENT',5,'smoke-attachment.txt','http://127.0.0.1:8000/api/v5/documents/attachments/temp-download?disk=local&expires=1772626934&name=smoke-attachment.txt&path=documents%2FbEQrFwd4uhVsz47pixBUAdQCv2iIKjpf1jiyaJI4.txt&signature=13e96e40ca42cdf5380cddd34f4c9e93dc59166efdfe7d084a8fd17794e075f6',NULL,25,'2026-03-04 05:10:23',9,NULL,9,'text/plain','local','documents/bEQrFwd4uhVsz47pixBUAdQCv2iIKjpf1jiyaJI4.txt','private',0),(6,'CUSTOMER_REQUEST',11,'rules.pdf','http://127.0.0.1:8002/api/v5/documents/attachments/temp-download?disk=backblaze_b2&expires=1773059409&name=rules.pdf&path=VNPT%2Fdocuments%2F20260309_121503_4gEoCE1N_rules.pdf&signature=1bd37ce212e54e8f7e2076cd7d4b8b64b22e7bbb496dd0a13a8b7131b7a19308',NULL,9093078,'2026-03-09 05:15:15',9,NULL,9,'application/pdf','backblaze_b2','VNPT/documents/20260309_121503_4gEoCE1N_rules.pdf','private',0),(8,'CUSTOMER_REQUEST',10,'mau_khoa.xlsx','/api/v5/attachments/7/download?expires=1773064342&signature=0fc2124c8be1c310a603b2bd87245178f88376ea21ab0c5d2ec68e596af5c132',NULL,9370,'2026-03-09 06:38:13',9,NULL,9,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','backblaze_b2','VNPT/documents/20260309_121548_uRwYv50U_mau-khoa.xlsx','private',0);
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
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,'11111111-1111-1111-1111-111111111111','INSERT','internal_users',9001,NULL,'{\"status\": \"ACTIVE\", \"vpn_status\": \"YES\"}','/api/v5/employees','10.10.10.10','Seeder/Test','2026-02-23 14:36:48',4),(2,'22222222-2222-2222-2222-222222222222','UPDATE','internal_users',9002,'{\"vpn_status\": \"NO\"}','{\"vpn_status\": \"YES\"}','/api/v5/employees/9002','10.10.10.21','Seeder/Test','2026-02-23 14:46:48',NULL),(3,'33333333-3333-3333-3333-333333333333','DELETE','projects',3001,'{\"status\": \"PLANNING\"}',NULL,'/api/v5/projects/3001','10.10.10.99','Seeder/Test','2026-02-23 14:56:48',999999),(4,'b8a5323e-1dd1-4b67-9161-b16149e5fe6d','UPDATE','projects',2,'{\"id\": 2, \"status\": \"TRIAL\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-01\", \"updated_at\": \"2026-02-25 10:54:58\", \"updated_by\": null, \"customer_id\": 2, \"project_code\": \"DA002\", \"project_name\": \"Dự án SOC - Petrolimex\", \"opportunity_id\": 2, \"investment_mode\": \"THUE_DICH_VU\", \"expected_end_date\": \"2026-10-01\"}','{\"id\": 2, \"status\": \"ONGOING\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-01\", \"updated_at\": \"2026-02-26 11:48:05\", \"updated_by\": 1, \"customer_id\": 2, \"project_code\": \"DA002\", \"project_name\": \"Dự án SOC - Petrolimex\", \"opportunity_id\": 2, \"investment_mode\": \"THUE_DICH_VU\", \"expected_end_date\": \"2026-10-01\"}','http://127.0.0.1:8000/api/v5/projects/2','127.0.0.1','curl/8.7.1','2026-02-26 11:48:05',1),(5,'0093ab5c-59cc-425f-b2fe-48995786de66','UPDATE','support_requests',2428613,'{\"id\": 2428613, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1483020\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001483020\", \"test_note\": \"Auto seed test note #1483020\", \"change_log\": \"Auto seed log #1483020\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001483020\", \"reporter_name\": \"Reporter 0020\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2428613, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"RESOLVED\", \"summary\": \"Seed yêu cầu hỗ trợ #1483020\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001483020\", \"test_note\": \"Auto seed test note #1483020\", \"change_log\": \"Auto seed log #1483020\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:00\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001483020\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0020\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2428613','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:14:00',1),(6,'ee514216-cbee-4aa9-9a44-70c6ff514592','UPDATE','support_requests',2432033,'{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001487640\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"HOTFIXING\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:13\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001487640\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2432033','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:14:13',1),(7,'18427524-f2cc-4617-9ee3-e40152627fac','UPDATE','support_requests',2432033,'{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"HOTFIXING\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:13\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001487640\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"OPEN\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:21\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001487640\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2432033','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:14:21',1),(8,'862f96e4-cfa4-49ae-b4f8-f01f839b1ca5','UPDATE','support_requests',2430513,'{\"id\": 2430513, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1485120\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001485120\", \"test_note\": \"Auto seed test note #1485120\", \"change_log\": \"Auto seed log #1485120\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001485120\", \"reporter_name\": \"Reporter 0120\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2430513, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"RESOLVED\", \"summary\": \"Seed yêu cầu hỗ trợ #1485120\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001485120\", \"test_note\": \"Auto seed test note #1485120\", \"change_log\": \"Auto seed log #1485120\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:27\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001485120\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0120\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2430513','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:14:27',1),(9,'0f290abf-e6c3-43fb-b326-da99691eab6d','UPDATE','support_requests',2429473,'{\"id\": 2429473, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1484280\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001484280\", \"test_note\": \"Auto seed test note #1484280\", \"change_log\": \"Auto seed log #1484280\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001484280\", \"reporter_name\": \"Reporter 0280\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2429473, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"PENDING\", \"summary\": \"Seed yêu cầu hỗ trợ #1484280\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001484280\", \"test_note\": \"Auto seed test note #1484280\", \"change_log\": \"Auto seed log #1484280\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:40\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001484280\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0280\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2429473','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:14:40',1),(10,'c3935080-1526-46bf-83a5-f769921fd42e','UPDATE','support_requests',2431373,'{\"id\": 2431373, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1486380\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001486380\", \"test_note\": \"Auto seed test note #1486380\", \"change_log\": \"Auto seed log #1486380\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001486380\", \"reporter_name\": \"Reporter 0380\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2431373, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1486380\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001486380\", \"test_note\": \"Auto seed test note #1486380\", \"change_log\": \"Auto seed log #1486380\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:04\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-01\", \"ticket_code\": \"SRQ-0001486380\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0380\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2431373','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:15:04',1),(11,'1b55fe5a-73b7-4749-be98-1277d72443a1','UPDATE','support_requests',2432033,'{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"OPEN\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:21\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001487640\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"OPEN\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:24\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-04-26\", \"ticket_code\": \"SRQ-0001487640\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": \"2026-04-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2432033','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:15:24',1),(12,'c9449b8b-57ac-4476-a451-ce523765f796','UPDATE','support_requests',2450776,'{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001499400\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:39\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2450776','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:15:39',1),(13,'fee2c09d-4c15-412e-881e-f351b834d578','UPDATE','support_requests',2450776,'{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:39\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"DEPLOYED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:49\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2450776','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:15:49',1),(14,'b246c3c5-d402-4009-a3e3-8ff796cd2dea','UPDATE','support_requests',2450776,'{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"DEPLOYED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:49\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"HOTFIXING\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:16:08\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2450776','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:16:08',1),(15,'b23116a2-32b7-4d6b-806f-52e250e0c300','UPDATE','support_requests',2448876,'{\"id\": 2448876, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1497300\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001497300\", \"test_note\": \"Auto seed test note #1497300\", \"change_log\": \"Auto seed log #1497300\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001497300\", \"reporter_name\": \"Reporter 0300\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2448876, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"DEPLOYED\", \"summary\": \"Seed yêu cầu hỗ trợ #1497300\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001497300\", \"test_note\": \"Auto seed test note #1497300\", \"change_log\": \"Auto seed log #1497300\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:18:09\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001497300\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0300\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2448876','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:18:09',1),(16,'462805bb-2dd2-45c4-a476-bdacc936021e','UPDATE','support_requests',2450776,'{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"HOTFIXING\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:16:08\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"RESOLVED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:19:27\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2450776','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:19:27',1),(17,'9d684961-fc51-4f0c-9f70-540e4726e328','UPDATE','support_requests',2315712,'{\"id\": 2315712, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1415400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001415400\", \"test_note\": \"Auto seed test note #1415400\", \"change_log\": \"Auto seed log #1415400\", \"created_at\": \"2026-02-26 13:16:14\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:14\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001415400\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2315712, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"OPEN\", \"summary\": \"Seed yêu cầu hỗ trợ #1415400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001415400\", \"test_note\": \"Auto seed test note #1415400\", \"change_log\": \"Auto seed log #1415400\", \"created_at\": \"2026-02-26 13:16:14\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:23:06\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001415400\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2315712','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:23:06',1),(18,'0a3e095a-247a-4c41-9800-65b796e1765f','UPDATE','support_requests',2449536,'{\"id\": 2449536, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1498560\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001498560\", \"test_note\": \"Auto seed test note #1498560\", \"change_log\": \"Auto seed log #1498560\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001498560\", \"reporter_name\": \"Reporter 0060\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2449536, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"OPEN\", \"summary\": \"Seed yêu cầu hỗ trợ #1498560\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001498560\", \"test_note\": \"Auto seed test note #1498560\", \"change_log\": \"Auto seed log #1498560\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:24:32\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001498560\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0060\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2449536','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:24:32',1),(19,'73c38479-300f-433e-a8df-a773a4f40b89','UPDATE','support_requests',2449156,'{\"id\": 2449156, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1498980\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001498980\", \"test_note\": \"Auto seed test note #1498980\", \"change_log\": \"Auto seed log #1498980\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001498980\", \"reporter_name\": \"Reporter 0480\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2449156, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"DEPLOYED\", \"summary\": \"Seed yêu cầu hỗ trợ #1498980\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001498980\", \"test_note\": \"Auto seed test note #1498980\", \"change_log\": \"Auto seed log #1498980\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:26:25\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001498980\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0480\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2449156','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:26:25',1),(20,'b0c0d6cf-b8bd-4319-8ea7-a31dfedebf8c','UPDATE','projects',98,'{\"id\": 98, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-25 17:53:13\", \"updated_by\": null, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 98, \"status\": \"ONGOING\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-26 14:31:30\", \"updated_by\": 1, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8000/api/v5/projects/98','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:31:30',1),(21,'067fcfc1-66d0-4b6f-bd7a-1a89563485cf','UPDATE','projects',98,'{\"id\": 98, \"status\": \"ONGOING\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-26 14:31:30\", \"updated_by\": 1, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 98, \"status\": \"WARRANTY\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-26 14:31:41\", \"updated_by\": 1, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8000/api/v5/projects/98','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:31:41',1),(22,'3c3df400-c3f6-4be0-a89f-b2aeee56171b','UPDATE','projects',97,'{\"id\": 97, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-25 17:53:13\", \"updated_by\": null, \"customer_id\": 35, \"project_code\": \"DA035\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT P. Thuận An (TYT TT Long Mỹ)\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 97, \"status\": \"CANCELLED\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-26 14:31:46\", \"updated_by\": 1, \"customer_id\": 35, \"project_code\": \"DA035\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT P. Thuận An (TYT TT Long Mỹ)\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8000/api/v5/projects/97','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:31:46',1),(23,'0facdfc4-1e8c-4c0f-a0f0-bf7e28e98355','UPDATE','customers',6,'{\"id\": 6, \"address\": null, \"tax_code\": \"0127160495\", \"is_active\": 1, \"created_at\": \"2026-02-25 08:03:51\", \"created_by\": null, \"updated_at\": \"2026-02-25 08:03:51\", \"updated_by\": null, \"customer_code\": \"93002\", \"customer_name\": \"Trung tâm Y tế khu vực Vị Thủy\"}','{\"id\": 6, \"address\": \"Số 02 Nguyễn Trãi\", \"tax_code\": \"0127160495\", \"is_active\": 1, \"created_at\": \"2026-02-25 08:03:51\", \"created_by\": null, \"updated_at\": \"2026-02-27 03:27:32\", \"updated_by\": 1, \"customer_code\": \"93002\", \"customer_name\": \"Trung tâm Y tế khu vực Vị Thủy\"}','http://127.0.0.1:8000/api/v5/customers/6','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 03:27:32',1),(24,'4e995a1c-ee3e-487d-9713-ec36af8e886c','UPDATE','projects',1,'{\"id\": 1, \"status\": \"ONGOING\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-01-10\", \"updated_at\": \"2026-02-23 15:19:41\", \"updated_by\": null, \"customer_id\": 1, \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"opportunity_id\": 1, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-12-31\"}','{\"id\": 1, \"status\": \"ONGOING\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-01-10\", \"updated_at\": \"2026-02-27 03:29:04\", \"updated_by\": 1, \"customer_id\": 1, \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"opportunity_id\": 1, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-12-31\"}','http://127.0.0.1:8000/api/v5/projects/1','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 03:29:04',1),(25,'059a798c-63e7-44ae-8e50-68c208b51e74','UPDATE','projects',1,'{\"id\": 1, \"status\": \"ONGOING\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-01-10\", \"updated_at\": \"2026-02-27 03:29:04\", \"updated_by\": 1, \"customer_id\": 1, \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"opportunity_id\": 1, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-12-31\"}','{\"id\": 1, \"status\": \"ONGOING\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-01-10\", \"updated_at\": \"2026-02-27 03:29:04\", \"updated_by\": 1, \"customer_id\": 1, \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"opportunity_id\": 1, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-12-31\"}','http://127.0.0.1:8000/api/v5/projects/1','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 03:29:30',1),(26,'4bbd848e-5072-4e44-894b-30b5962074b4','UPDATE','contracts',2,'{\"id\": 2, \"status\": \"DRAFT\", \"dept_id\": 2, \"sign_date\": \"2026-02-20\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"project_id\": 2, \"updated_at\": \"2026-02-27 11:26:11\", \"updated_by\": null, \"customer_id\": 2, \"expiry_date\": \"2026-12-20\", \"total_value\": \"80000000.00\", \"contract_code\": \"HD002\", \"contract_name\": \"Hợp đồng dịch vụ SOC\", \"effective_date\": null}','{\"id\": 2, \"status\": \"RENEWED\", \"dept_id\": 2, \"sign_date\": \"2026-02-20\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"project_id\": 2, \"updated_at\": \"2026-02-27 06:53:15\", \"updated_by\": 1, \"customer_id\": 2, \"expiry_date\": \"2026-12-20\", \"total_value\": \"80000000.00\", \"contract_code\": \"HD002\", \"contract_name\": \"Hợp đồng dịch vụ SOC\", \"effective_date\": null}','http://127.0.0.1:8000/api/v5/contracts/2','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 06:53:15',1),(27,'15867223-5015-44b8-94f3-c9ff13070861','UPDATE','contracts',2,'{\"id\": 2, \"status\": \"RENEWED\", \"dept_id\": 2, \"sign_date\": \"2026-02-20\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"project_id\": 2, \"updated_at\": \"2026-02-27 14:38:38\", \"updated_by\": 1, \"customer_id\": 2, \"expiry_date\": \"2026-12-20\", \"total_value\": \"80000000.00\", \"contract_code\": \"HD002\", \"contract_name\": \"Hợp đồng dịch vụ SOC\", \"effective_date\": \"2026-02-20\"}','{\"id\": 2, \"status\": \"SIGNED\", \"dept_id\": 2, \"sign_date\": \"2026-02-20\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"project_id\": 2, \"updated_at\": \"2026-02-27 08:18:26\", \"updated_by\": 1, \"customer_id\": 2, \"expiry_date\": \"2026-12-20\", \"total_value\": \"80000000.00\", \"contract_code\": \"HD002\", \"contract_name\": \"Hợp đồng dịch vụ SOC\", \"effective_date\": \"2026-02-20\"}','http://127.0.0.1:8000/api/v5/contracts/2','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 08:18:26',1),(28,'3aa3fade-900d-45c8-aa52-f99e8aa2cacb','UPDATE','contracts',2,'{\"operation\": \"generate_contract_payments\", \"contract_id\": 2}','{\"contract_id\": 2, \"generated_rows\": 1, \"generation_mode\": \"procedure\"}','http://127.0.0.1:8000/api/v5/contracts/2/generate-payments','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 09:46:07',1),(29,'175d8795-eaec-4a19-8e06-4dab5f69534c','UPDATE','contracts',2,'{\"id\": 2, \"status\": \"SIGNED\", \"dept_id\": 2, \"sign_date\": \"2026-02-20\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"project_id\": 2, \"updated_at\": \"2026-02-27 08:18:26\", \"updated_by\": 1, \"customer_id\": 2, \"expiry_date\": \"2026-12-20\", \"total_value\": \"80000000.00\", \"contract_code\": \"HD002\", \"contract_name\": \"Hợp đồng dịch vụ SOC\", \"effective_date\": \"2026-02-20\"}','{\"id\": 2, \"status\": \"SIGNED\", \"dept_id\": 2, \"sign_date\": \"2026-02-20\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"project_id\": 2, \"updated_at\": \"2026-02-27 09:49:40\", \"updated_by\": 1, \"customer_id\": 2, \"expiry_date\": \"2026-12-20\", \"total_value\": \"80000000.00\", \"contract_code\": \"HD002\", \"contract_name\": \"Hợp đồng dịch vụ SOC\", \"effective_date\": \"2026-02-20\"}','http://127.0.0.1:8000/api/v5/contracts/2','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 09:49:40',1),(30,'098416ec-6aaa-4dc2-9161-d3b83c67c088','UPDATE','contracts',1,'{\"id\": 1, \"status\": \"SIGNED\", \"dept_id\": 2, \"sign_date\": \"2026-01-15\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"project_id\": 1, \"updated_at\": \"2026-02-27 14:38:38\", \"updated_by\": null, \"customer_id\": 1, \"expiry_date\": \"2026-12-31\", \"total_value\": \"150000000.00\", \"contract_code\": \"HD001\", \"contract_name\": \"Hợp đồng triển khai VNPT HIS\", \"effective_date\": \"2026-01-15\"}','{\"id\": 1, \"status\": \"DRAFT\", \"dept_id\": 2, \"sign_date\": \"2026-01-15\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"project_id\": 1, \"updated_at\": \"2026-02-27 09:49:51\", \"updated_by\": 1, \"customer_id\": 1, \"expiry_date\": \"2026-12-31\", \"total_value\": \"150000000.00\", \"contract_code\": \"HD001\", \"contract_name\": \"Hợp đồng triển khai VNPT HIS\", \"effective_date\": \"2026-01-15\"}','http://127.0.0.1:8000/api/v5/contracts/1','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 09:49:51',1),(31,'6242124a-d8d8-4d58-96e3-635e598fee50','UPDATE','contracts',2,'{\"operation\": \"generate_contract_payments\", \"contract_id\": 2}','{\"contract_id\": 2, \"generated_rows\": 1, \"generation_mode\": \"procedure\"}','http://127.0.0.1:8000/api/v5/contracts/2/generate-payments','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 10:11:11',1),(32,'b452e49e-35c2-4951-8bc6-9b6ca9eef89b','UPDATE','contracts',2,'{\"operation\": \"generate_contract_payments\", \"contract_id\": 2}','{\"contract_id\": 2, \"generated_rows\": 1, \"generation_mode\": \"procedure\"}','http://127.0.0.1:8000/api/v5/contracts/2/generate-payments','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 10:12:35',1),(33,'6485ea53-e59e-44cd-aa0b-bbe3e996ea96','UPDATE','contracts',2,'{\"operation\": \"generate_contract_payments\", \"contract_id\": 2}','{\"contract_id\": 2, \"generated_rows\": 1, \"generation_mode\": \"procedure\"}','http://127.0.0.1:8000/api/v5/contracts/2/generate-payments','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 10:12:36',1),(34,'0c53080d-bb2b-4566-b1f5-c80939541710','UPDATE','support_requests',2450196,'{\"id\": 2450196, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"UNABLE_TO_EXECUTE\", \"summary\": \"Seed yêu cầu hỗ trợ #1499820\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499820\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 20:04:01\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001499820\", \"reporter_name\": \"Reporter 0320\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"receiver_user_id\": null, \"service_group_id\": 1, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null}','{\"id\": 2450196, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"tasks\": [{\"id\": 1, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-0001499820\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499820\", \"created_at\": \"2026-02-27 13:04:30\", \"created_by\": null, \"request_id\": 2450196, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:04:30\", \"updated_by\": null}], \"status\": \"NEW\", \"summary\": \"Seed yêu cầu hỗ trợ #1499820\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499820\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:04:30\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001499820\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": \"Reporter 0320\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": \"HIS L2\", \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests/2450196','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 13:04:30',1),(35,'53429f3f-09e0-4643-b944-d436aefecab0','INSERT','support_requests',2457469,NULL,'{\"id\": 2457469, \"notes\": null, \"tasks\": [{\"id\": 2, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-A-20260227204749\", \"task_link\": null, \"created_at\": \"2026-02-27 13:47:50\", \"created_by\": 4, \"request_id\": 2457469, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:47:50\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT Ref Source A 20260227204749\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:47:50\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:47:50\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-A-20260227204749\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:47:50',4),(36,'f926cf85-ad98-438a-815b-178f0b4d2310','INSERT','support_requests',2457470,NULL,'{\"id\": 2457470, \"notes\": null, \"tasks\": [{\"id\": 3, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-B-20260227204749\", \"task_link\": null, \"created_at\": \"2026-02-27 13:47:50\", \"created_by\": 4, \"request_id\": 2457470, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:47:50\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT Ref Target B 20260227204749\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:47:50\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:47:50\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-B-20260227204749\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"UAT Ref Source A 20260227204749\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457469, \"reference_ticket_code\": \"SRQ-UAT-A-20260227204749\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:47:50',4),(37,'26931adc-dbcb-455d-986d-d6980ce91951','INSERT','support_requests',2457471,NULL,'{\"id\": 2457471, \"notes\": null, \"tasks\": [{\"id\": 4, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-C-20260227204749\", \"task_link\": null, \"created_at\": \"2026-02-27 13:47:51\", \"created_by\": 4, \"request_id\": 2457471, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:47:51\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT Ref Source C 20260227204749\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:47:51\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:47:51\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-C-20260227204749\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:47:51',4),(38,'7ecf7b7a-98da-4f51-b85a-84f10b72534f','INSERT','support_requests',2457472,NULL,'{\"id\": 2457472, \"notes\": null, \"tasks\": [{\"id\": 5, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-BULK1-20260227204749\", \"task_link\": null, \"created_at\": \"2026-02-27 13:47:52\", \"created_by\": 4, \"request_id\": 2457472, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:47:52\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"Bulk valid 20260227204749\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:47:52\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:47:52\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-BULK1-20260227204749\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"UAT Ref Source A 20260227204749\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457469, \"reference_ticket_code\": \"SRQ-UAT-A-20260227204749\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://localhost/api/v5/support-requests','127.0.0.1','Symfony','2026-02-27 13:47:52',4),(39,'d150c177-2b7d-475f-a4de-68e2751096ea','INSERT','support_requests',2457473,NULL,'{\"id\": 2457473, \"notes\": null, \"tasks\": [{\"id\": 6, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT2-A-20260227204930\", \"task_link\": null, \"created_at\": \"2026-02-27 13:49:30\", \"created_by\": 4, \"request_id\": 2457473, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:49:30\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"A\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:49:30\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:49:30\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT2-A-20260227204930\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:49:30',4),(40,'fd6a6cfa-dbf9-447e-be98-8a07e8a327ac','INSERT','support_requests',2457474,NULL,'{\"id\": 2457474, \"notes\": null, \"tasks\": [{\"id\": 7, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT2-B-20260227204930\", \"task_link\": null, \"created_at\": \"2026-02-27 13:49:30\", \"created_by\": 4, \"request_id\": 2457474, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:49:30\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"B\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:49:30\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:49:30\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT2-B-20260227204930\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"A\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457473, \"reference_ticket_code\": \"SRQ-UAT2-A-20260227204930\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:49:30',4),(41,'2dda1692-85d1-4f45-a9af-0c706006231f','INSERT','support_requests',2457475,NULL,'{\"id\": 2457475, \"notes\": null, \"tasks\": [{\"id\": 8, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT2-C-20260227204930\", \"task_link\": null, \"created_at\": \"2026-02-27 13:49:31\", \"created_by\": 4, \"request_id\": 2457475, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:49:31\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"C\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:49:31\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:49:31\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT2-C-20260227204930\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:49:31',4),(42,'a5650405-199c-4740-8e6d-4770f70023cd','INSERT','support_requests',2457476,NULL,'{\"id\": 2457476, \"notes\": null, \"tasks\": [{\"id\": 9, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-A-20260227205105\", \"task_link\": null, \"created_at\": \"2026-02-27 13:51:05\", \"created_by\": 4, \"request_id\": 2457476, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:51:05\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT Ref Source A 20260227205105\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:51:05\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:51:05\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-A-20260227205105\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:51:05',4),(43,'97d990ff-fdad-43a1-b6cc-7653839d443c','INSERT','support_requests',2457477,NULL,'{\"id\": 2457477, \"notes\": null, \"tasks\": [{\"id\": 10, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-B-20260227205105\", \"task_link\": null, \"created_at\": \"2026-02-27 13:51:05\", \"created_by\": 4, \"request_id\": 2457477, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:51:05\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT Ref Target B 20260227205105\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:51:05\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:51:05\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-B-20260227205105\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"UAT Ref Source A 20260227205105\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457476, \"reference_ticket_code\": \"SRQ-UAT-A-20260227205105\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:51:05',4),(44,'fc19ed5e-7ed9-4ba2-8b90-84c8199ddbc3','INSERT','support_requests',2457478,NULL,'{\"id\": 2457478, \"notes\": null, \"tasks\": [{\"id\": 11, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-C-20260227205105\", \"task_link\": null, \"created_at\": \"2026-02-27 13:51:06\", \"created_by\": 4, \"request_id\": 2457478, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:51:06\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT Ref Source C 20260227205105\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:51:06\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:51:06\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-C-20260227205105\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:51:06',4),(45,'e7145f32-57d4-4d88-a8f6-cac076c328b5','UPDATE','support_requests',2457477,'{\"id\": 2457477, \"notes\": null, \"status\": \"NEW\", \"summary\": \"UAT Ref Target B 20260227205105\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:51:05\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"updated_at\": \"2026-02-27 13:51:05\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-B-20260227205105\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"service_group_id\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457476, \"reference_ticket_code\": \"SRQ-UAT-A-20260227205105\"}','{\"id\": 2457477, \"notes\": null, \"tasks\": [{\"id\": 10, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-B-20260227205105\", \"task_link\": null, \"created_at\": \"2026-02-27 13:51:05\", \"created_by\": 4, \"request_id\": 2457477, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:51:05\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT Ref Target B 20260227205105\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:51:05\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:51:06\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-B-20260227205105\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"UAT Ref Source C 20260227205105\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457478, \"reference_ticket_code\": \"SRQ-UAT-C-20260227205105\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests/2457477','127.0.0.1','curl/8.7.1','2026-02-27 13:51:06',4),(46,'8285d94d-7256-4037-bf8c-8e9833a6e8af','INSERT','support_requests',2457479,NULL,'{\"id\": 2457479, \"notes\": null, \"tasks\": [{\"id\": 12, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-BULK1-20260227205105\", \"task_link\": null, \"created_at\": \"2026-02-27 13:51:07\", \"created_by\": 4, \"request_id\": 2457479, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:51:07\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"Bulk valid 20260227205105\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:51:07\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:51:07\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-BULK1-20260227205105\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"UAT Ref Source A 20260227205105\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457476, \"reference_ticket_code\": \"SRQ-UAT-A-20260227205105\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://localhost/api/v5/support-requests','127.0.0.1','Symfony','2026-02-27 13:51:07',4),(47,'0f0e8654-f0e3-4540-84ca-b67e11591747','INSERT','support_requests',2457480,NULL,'{\"id\": 2457480, \"notes\": null, \"tasks\": [{\"id\": 13, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT3-A-20260227205632\", \"task_link\": null, \"created_at\": \"2026-02-27 13:56:33\", \"created_by\": 4, \"request_id\": 2457480, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:56:33\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"A 20260227205632\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:56:33\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:56:33\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT3-A-20260227205632\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:56:33',4),(48,'da7a6f70-4800-4c79-bd23-3d5abc089eab','INSERT','support_requests',2457481,NULL,'{\"id\": 2457481, \"notes\": null, \"tasks\": [{\"id\": 14, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT3-BULK1-20260227205632\", \"task_link\": null, \"created_at\": \"2026-02-27 13:56:33\", \"created_by\": 4, \"request_id\": 2457481, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:56:33\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"Bulk valid 20260227205632\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:56:33\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:56:33\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT3-BULK1-20260227205632\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"A 20260227205632\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457480, \"reference_ticket_code\": \"SRQ-UAT3-A-20260227205632\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://localhost/api/v5/support-requests','127.0.0.1','Symfony','2026-02-27 13:56:33',4),(49,'215feac8-a6bd-4104-a58d-ca374e99fb3d','INSERT','support_requests',2457482,NULL,'{\"id\": 2457482, \"notes\": null, \"tasks\": [{\"id\": 15, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-A-20260227205735\", \"task_link\": null, \"created_at\": \"2026-02-27 13:57:35\", \"created_by\": 4, \"request_id\": 2457482, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:57:35\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT Ref Source A 20260227205735\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:57:35\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:57:35\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-A-20260227205735\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:57:35',4),(50,'417cb1e9-134e-4345-b01f-43bfa6809d8e','INSERT','support_requests',2457483,NULL,'{\"id\": 2457483, \"notes\": null, \"tasks\": [{\"id\": 16, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-B-20260227205735\", \"task_link\": null, \"created_at\": \"2026-02-27 13:57:35\", \"created_by\": 4, \"request_id\": 2457483, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:57:35\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT Ref Target B 20260227205735\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:57:35\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:57:35\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-B-20260227205735\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"UAT Ref Source A 20260227205735\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457482, \"reference_ticket_code\": \"SRQ-UAT-A-20260227205735\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:57:35',4),(51,'043f75e6-423b-4f55-9770-f426da2eb60a','INSERT','support_requests',2457484,NULL,'{\"id\": 2457484, \"notes\": null, \"tasks\": [{\"id\": 17, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-C-20260227205735\", \"task_link\": null, \"created_at\": \"2026-02-27 13:57:36\", \"created_by\": 4, \"request_id\": 2457484, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:57:36\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT Ref Source C 20260227205735\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:57:36\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:57:36\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-C-20260227205735\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 13:57:36',4),(52,'d5179a23-d851-4e9f-8246-f951622c9698','UPDATE','support_requests',2457483,'{\"id\": 2457483, \"notes\": null, \"status\": \"NEW\", \"summary\": \"UAT Ref Target B 20260227205735\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:57:35\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"updated_at\": \"2026-02-27 13:57:35\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-B-20260227205735\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"service_group_id\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457482, \"reference_ticket_code\": \"SRQ-UAT-A-20260227205735\"}','{\"id\": 2457483, \"notes\": null, \"tasks\": [{\"id\": 16, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-B-20260227205735\", \"task_link\": null, \"created_at\": \"2026-02-27 13:57:35\", \"created_by\": 4, \"request_id\": 2457483, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:57:35\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT Ref Target B 20260227205735\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:57:35\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:57:36\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-B-20260227205735\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"UAT Ref Source C 20260227205735\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457484, \"reference_ticket_code\": \"SRQ-UAT-C-20260227205735\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests/2457483','127.0.0.1','curl/8.7.1','2026-02-27 13:57:36',4),(53,'6a6aa72c-4911-4adb-a351-f2ae69f08538','INSERT','support_requests',2457485,NULL,'{\"id\": 2457485, \"notes\": null, \"tasks\": [{\"id\": 18, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-BULK1-20260227205735\", \"task_link\": null, \"created_at\": \"2026-02-27 13:57:37\", \"created_by\": 4, \"request_id\": 2457485, \"sort_order\": 0, \"updated_at\": \"2026-02-27 13:57:37\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"Bulk valid 20260227205735\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 13:57:37\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 13:57:37\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-BULK1-20260227205735\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"UAT Ref Source A 20260227205735\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457482, \"reference_ticket_code\": \"SRQ-UAT-A-20260227205735\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://localhost/api/v5/support-requests','127.0.0.1','Symfony','2026-02-27 13:57:37',4),(54,'d466510b-20fe-4f3c-9ffb-382fadfb1cd9','INSERT','support_requests',2457486,NULL,'{\"id\": 2457486, \"notes\": null, \"tasks\": [{\"id\": 19, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-UI-A-20260227211007\", \"task_link\": null, \"created_at\": \"2026-02-27 14:10:07\", \"created_by\": 4, \"request_id\": 2457486, \"sort_order\": 0, \"updated_at\": \"2026-02-27 14:10:07\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT UI Ref Source A 20260227211007\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 14:10:07\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 14:10:07\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-UI-A-20260227211007\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 14:10:07',4),(55,'84519ecf-a1cd-4bfd-845c-8a98574ca212','INSERT','support_requests',2457487,NULL,'{\"id\": 2457487, \"notes\": null, \"tasks\": [{\"id\": 20, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-UI-B-20260227211007\", \"task_link\": null, \"created_at\": \"2026-02-27 14:10:07\", \"created_by\": 4, \"request_id\": 2457487, \"sort_order\": 0, \"updated_at\": \"2026-02-27 14:10:07\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT UI Ref Target B 20260227211007\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 14:10:07\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 14:10:07\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-UI-B-20260227211007\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"UAT UI Ref Source A 20260227211007\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457486, \"reference_ticket_code\": \"SRQ-UAT-UI-A-20260227211007\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 14:10:07',4),(56,'8fb03a7b-610d-4b97-8ffe-44d665fc2109','INSERT','support_requests',2457488,NULL,'{\"id\": 2457488, \"notes\": null, \"tasks\": [{\"id\": 21, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-UI-C-20260227211007\", \"task_link\": null, \"created_at\": \"2026-02-27 14:10:08\", \"created_by\": 4, \"request_id\": 2457488, \"sort_order\": 0, \"updated_at\": \"2026-02-27 14:10:08\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT UI Ref Source C 20260227211007\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 14:10:08\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 14:10:08\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-UI-C-20260227211007\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 14:10:08',4),(57,'94caf585-92e3-4422-9d1e-9e6c29293983','UPDATE','support_requests',2457487,'{\"id\": 2457487, \"notes\": null, \"status\": \"NEW\", \"summary\": \"UAT UI Ref Target B 20260227211007\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 14:10:07\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"updated_at\": \"2026-02-27 14:10:07\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-UI-B-20260227211007\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"service_group_id\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457486, \"reference_ticket_code\": \"SRQ-UAT-UI-A-20260227211007\"}','{\"id\": 2457487, \"notes\": null, \"tasks\": [{\"id\": 20, \"title\": null, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-UI-B-20260227211007\", \"task_link\": null, \"created_at\": \"2026-02-27 14:10:07\", \"created_by\": 4, \"request_id\": 2457487, \"sort_order\": 0, \"updated_at\": \"2026-02-27 14:10:07\", \"updated_by\": 4}], \"status\": \"NEW\", \"summary\": \"UAT UI Ref Target B 20260227211007\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 14:10:07\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"task_count\": 1, \"updated_at\": \"2026-02-27 14:10:08\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-UI-B-20260227211007\", \"product_code\": null, \"product_name\": null, \"project_code\": null, \"project_name\": null, \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"reference_status\": \"NEW\", \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": \"UAT UI Ref Source C 20260227211007\", \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": 2457488, \"reference_ticket_code\": \"SRQ-UAT-UI-C-20260227211007\", \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests/2457487','127.0.0.1','curl/8.7.1','2026-02-27 14:10:08',4),(23,'b2b0ab9a-1558-11f1-8c5f-24a3c6f67e95','INSERT','support_requests',2457469,NULL,'{\"id\": 2457469, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE TEST SUPPORT REQUEST\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:40:50\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:40:50\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests','127.0.0.1','Symfony','2026-03-01 17:23:32',1),(24,'b2b0b07c-1558-11f1-8c5f-24a3c6f67e95','UPDATE','support_requests',2457469,'{\"id\": 2457469, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE TEST SUPPORT REQUEST\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:40:50\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:40:50\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}','{\"id\": 2457469, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE TEST SUPPORT REQUEST\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:40:50\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:40:50\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests/2457469','127.0.0.1','Symfony','2026-03-01 17:23:32',1),(25,'b2b0b234-1558-11f1-8c5f-24a3c6f67e95','DELETE','support_requests',2457469,'{\"id\": 2457469, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE TEST SUPPORT REQUEST\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:40:50\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:40:50\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}',NULL,'http://localhost/api/v5/support-requests/2457469','127.0.0.1','Symfony','2026-03-01 17:23:32',1),(26,'b2b0b360-1558-11f1-8c5f-24a3c6f67e95','INSERT','support_requests',2457470,NULL,'{\"id\": 2457470, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests','127.0.0.1','Symfony','2026-03-01 17:23:32',1),(27,'b2b0b4b4-1558-11f1-8c5f-24a3c6f67e95','UPDATE','support_requests',2457470,'{\"id\": 2457470, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}','{\"id\": 2457470, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests/2457470/status','127.0.0.1','Symfony','2026-03-01 17:23:32',1),(28,'b2b0b626-1558-11f1-8c5f-24a3c6f67e95','UPDATE','support_requests',2457470,'{\"id\": 2457470, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}','{\"id\": 2457470, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests/2457470/status','127.0.0.1','Symfony','2026-03-01 17:23:32',1),(29,'b2b0b9b4-1558-11f1-8c5f-24a3c6f67e95','UPDATE','support_requests',2457470,'{\"id\": 2457470, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}','{\"id\": 2457470, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests/2457470/status','127.0.0.1','Symfony','2026-03-01 17:23:32',1),(30,'b2b0bc20-1558-11f1-8c5f-24a3c6f67e95','DELETE','support_requests',2457470,'{\"id\": 2457470, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}',NULL,'http://localhost/api/v5/support-requests/2457470','127.0.0.1','Symfony','2026-03-01 17:23:32',1),(31,'b2b0bcb6-1558-11f1-8c5f-24a3c6f67e95','INSERT','support_requests',2457471,NULL,'{\"id\": 2457471, \"notes\": null, \"status\": \"NEW\", \"summary\": \"Cần xử lý\", \"due_date\": \"1999-02-27\", \"priority\": \"MEDIUM\", \"noti_date\": \"2026-02-27\", \"task_link\": null, \"created_at\": \"2026-02-27 03:14:12\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"updated_at\": \"2026-02-27 03:14:12\", \"updated_by\": 1, \"assignee_id\": 5, \"customer_id\": 50, \"hotfix_date\": \"2026-02-27\", \"ticket_code\": null, \"product_code\": \"SOC_MONITOR\", \"product_name\": \"Dịch vụ giám sát SOC\", \"project_code\": \"DA050\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT phường Bình Thạnh\", \"assignee_code\": \"INT9002\", \"assignee_name\": \"Trần Kinh Doanh\", \"customer_code\": \"93104\", \"customer_name\": \"TYT phường Bình Thạnh\", \"receiver_code\": \"INT9003\", \"receiver_name\": \"Lê Hệ Thống\", \"reporter_name\": \"Đầu mối TYT phường Bình Thạnh\", \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"receiver_user_id\": 6, \"service_group_id\": null, \"assignee_username\": \"sales.demo\", \"receiver_username\": \"system.demo\", \"service_group_name\": null, \"reporter_contact_id\": 50, \"reporter_contact_name\": \"Đầu mối TYT phường Bình Thạnh\", \"reporter_contact_email\": \"contact.93104@vnpt.local\", \"reporter_contact_phone\": \"0900000050\"}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15','2026-03-01 17:23:32',1),(32,'b2b13ac4-1558-11f1-8c5f-24a3c6f67e95','UPDATE','support_requests',2457471,'{\"id\": 2457471, \"notes\": null, \"status\": \"NEW\", \"summary\": \"Cần xử lý\", \"due_date\": \"1999-02-27\", \"priority\": \"MEDIUM\", \"noti_date\": \"2026-02-27\", \"task_link\": null, \"created_at\": \"2026-02-27 03:14:12\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"updated_at\": \"2026-02-27 03:14:12\", \"updated_by\": 1, \"assignee_id\": 5, \"customer_id\": 50, \"hotfix_date\": \"2026-02-27\", \"ticket_code\": null, \"reporter_name\": \"Đầu mối TYT phường Bình Thạnh\", \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"receiver_user_id\": 6, \"service_group_id\": null, \"reporter_contact_id\": 50}','{\"id\": 2457471, \"notes\": null, \"status\": \"NEW\", \"summary\": \"Cần xử lý\", \"due_date\": \"1999-02-27\", \"priority\": \"MEDIUM\", \"noti_date\": \"2026-02-27\", \"task_link\": null, \"created_at\": \"2026-02-27 03:14:12\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"updated_at\": \"2026-02-27 03:14:23\", \"updated_by\": null, \"assignee_id\": 5, \"customer_id\": 50, \"hotfix_date\": \"2026-02-27\", \"ticket_code\": null, \"product_code\": \"SOC_MONITOR\", \"product_name\": \"Dịch vụ giám sát SOC\", \"project_code\": \"DA050\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT phường Bình Thạnh\", \"assignee_code\": \"INT9002\", \"assignee_name\": \"Trần Kinh Doanh\", \"customer_code\": \"93104\", \"customer_name\": \"TYT phường Bình Thạnh\", \"receiver_code\": \"INT9003\", \"receiver_name\": \"Lê Hệ Thống\", \"reporter_name\": \"Đầu mối TYT phường Bình Thạnh\", \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"receiver_user_id\": 6, \"service_group_id\": 4, \"assignee_username\": \"sales.demo\", \"receiver_username\": \"system.demo\", \"service_group_name\": \"DỰ ÁN THUÊ OS\", \"reporter_contact_id\": 50, \"reporter_contact_name\": \"Đầu mối TYT phường Bình Thạnh\", \"reporter_contact_email\": \"contact.93104@vnpt.local\", \"reporter_contact_phone\": \"0900000050\"}','http://127.0.0.1:8000/api/v5/support-requests/2457471','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15','2026-03-01 17:23:32',1),(33,'b2b13c22-1558-11f1-8c5f-24a3c6f67e95','UPDATE','support_requests',2457471,'{\"id\": 2457471, \"notes\": null, \"status\": \"NEW\", \"summary\": \"Cần xử lý\", \"due_date\": \"1999-02-27\", \"priority\": \"MEDIUM\", \"noti_date\": \"2026-02-27\", \"task_link\": null, \"created_at\": \"2026-02-27 03:14:12\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"updated_at\": \"2026-02-27 03:14:23\", \"updated_by\": null, \"assignee_id\": 5, \"customer_id\": 50, \"hotfix_date\": \"2026-02-27\", \"ticket_code\": null, \"reporter_name\": \"Đầu mối TYT phường Bình Thạnh\", \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"receiver_user_id\": 6, \"service_group_id\": 4, \"reporter_contact_id\": 50}','{\"id\": 2457471, \"notes\": null, \"tasks\": [], \"status\": \"NEW\", \"summary\": \"Cần xử lý\", \"due_date\": \"2026-02-27\", \"priority\": \"MEDIUM\", \"noti_date\": \"2026-02-27\", \"task_link\": null, \"created_at\": \"2026-02-27 03:14:12\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"task_count\": 0, \"updated_at\": \"2026-02-27 07:58:50\", \"updated_by\": null, \"assignee_id\": 5, \"customer_id\": 50, \"hotfix_date\": \"2026-02-27\", \"ticket_code\": null, \"product_code\": \"SOC_MONITOR\", \"product_name\": \"Dịch vụ giám sát SOC\", \"project_code\": \"DA050\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT phường Bình Thạnh\", \"assignee_code\": \"INT9002\", \"assignee_name\": \"Trần Kinh Doanh\", \"customer_code\": \"93104\", \"customer_name\": \"TYT phường Bình Thạnh\", \"receiver_code\": \"INT9003\", \"receiver_name\": \"Lê Hệ Thống\", \"reporter_name\": \"Đầu mối TYT phường Bình Thạnh\", \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"receiver_user_id\": 6, \"service_group_id\": 4, \"assignee_username\": \"sales.demo\", \"receiver_username\": \"system.demo\", \"service_group_name\": \"DỰ ÁN THUÊ OS\", \"reporter_contact_id\": 50, \"reporter_contact_name\": \"Đầu mối TYT phường Bình Thạnh\", \"reporter_contact_email\": \"contact.93104@vnpt.local\", \"reporter_contact_phone\": \"0900000050\"}','http://127.0.0.1:8000/api/v5/support-requests/2457471','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 17:23:32',1),(34,'b2b13d1c-1558-11f1-8c5f-24a3c6f67e95','INSERT','support_requests',2457472,NULL,'{\"id\": 2457472, \"notes\": \"Thực hiện test\", \"tasks\": [], \"status\": \"IN_PROGRESS\", \"summary\": \"Mô tả\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 08:04:00\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 98, \"task_count\": 0, \"updated_at\": \"2026-02-27 08:04:00\", \"updated_by\": 1, \"assignee_id\": 6, \"customer_id\": 16, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"SOC_MONITOR\", \"product_name\": \"Dịch vụ giám sát SOC\", \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"assignee_code\": \"INT9003\", \"assignee_name\": \"Lê Hệ Thống\", \"customer_code\": \"93105\", \"customer_name\": \"TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 96, \"receiver_user_id\": null, \"service_group_id\": null, \"assignee_username\": \"system.demo\", \"receiver_username\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 17:23:32',1),(35,'b2b14276-1558-11f1-8c5f-24a3c6f67e95','INSERT','support_requests',2457473,NULL,'{\"id\": 2457473, \"notes\": null, \"tasks\": [{\"id\": 1, \"title\": \"Smoke shared task #1\", \"status\": \"TODO\", \"task_code\": \"SMOKE-SHARED-1772184820\", \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820\", \"created_at\": \"2026-02-27 09:33:40\", \"created_by\": 1, \"request_id\": 2457473, \"sort_order\": 0, \"updated_at\": \"2026-02-27 09:33:40\", \"updated_by\": 1}], \"status\": \"NEW\", \"summary\": \"Smoke shared task #1\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820\", \"created_at\": \"2026-02-27 09:33:40\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"task_count\": 1, \"updated_at\": \"2026-02-27 09:33:40\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SMOKE-SHARED-1772184820\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"receiver_user_id\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8001/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-03-01 17:23:32',1),(36,'b2b1491a-1558-11f1-8c5f-24a3c6f67e95','INSERT','support_requests',2457474,NULL,'{\"id\": 2457474, \"notes\": null, \"tasks\": [{\"id\": 2, \"title\": \"Smoke shared task #2\", \"status\": \"TODO\", \"task_code\": \"SMOKE-SHARED-1772184820\", \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820\", \"created_at\": \"2026-02-27 09:33:41\", \"created_by\": 1, \"request_id\": 2457474, \"sort_order\": 0, \"updated_at\": \"2026-02-27 09:33:41\", \"updated_by\": 1}], \"status\": \"NEW\", \"summary\": \"Smoke shared task #2\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820\", \"created_at\": \"2026-02-27 09:33:41\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"task_count\": 1, \"updated_at\": \"2026-02-27 09:33:41\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SMOKE-SHARED-1772184820\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"receiver_user_id\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8001/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-03-01 17:23:32',1),(37,'b2b14a5a-1558-11f1-8c5f-24a3c6f67e95','UPDATE','support_requests',2457474,'{\"id\": 2457474, \"notes\": null, \"status\": \"NEW\", \"summary\": \"Smoke shared task #2\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820\", \"created_at\": \"2026-02-27 09:33:41\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 09:33:41\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SMOKE-SHARED-1772184820\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"receiver_user_id\": null, \"service_group_id\": null, \"reporter_contact_id\": null}','{\"id\": 2457474, \"notes\": null, \"tasks\": [{\"id\": 3, \"title\": \"Smoke shared task #2 updated\", \"status\": \"IN_PROGRESS\", \"task_code\": \"SMOKE-SHARED-1772184820\", \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820?rev=2\", \"created_at\": \"2026-02-27 09:34:56\", \"created_by\": null, \"request_id\": 2457474, \"sort_order\": 0, \"updated_at\": \"2026-02-27 09:34:56\", \"updated_by\": null}], \"status\": \"NEW\", \"summary\": \"Smoke shared task #2 (updated)\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820?rev=2\", \"created_at\": \"2026-02-27 09:33:41\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"task_count\": 1, \"updated_at\": \"2026-02-27 09:34:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SMOKE-SHARED-1772184820\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"receiver_user_id\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8001/api/v5/support-requests/2457474','127.0.0.1','curl/8.7.1','2026-03-01 17:23:32',1),(38,'b2b14ba4-1558-11f1-8c5f-24a3c6f67e95','INSERT','contracts',3,NULL,'{\"id\": 3, \"status\": \"DRAFT\", \"dept_id\": null, \"sign_date\": \"2026-03-01\", \"created_at\": \"2026-03-01 04:44:41\", \"created_by\": 1, \"project_id\": 98, \"updated_at\": \"2026-03-01 04:44:41\", \"updated_by\": 1, \"customer_id\": 16, \"expiry_date\": \"2027-05-31\", \"total_value\": 0, \"contract_code\": \"HĐ001\", \"contract_name\": \"Tên Hợp đồng 001\"}','http://127.0.0.1:8000/api/v5/contracts','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 17:23:32',1),(58,'ab55621a-fcae-4913-8c9f-e0bdd5548031','UPDATE','support_requests',2457488,'{\"id\": 2457488, \"notes\": null, \"status\": \"NEW\", \"summary\": \"UAT UI Ref Source C 20260227211007\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 14:10:08\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": null, \"project_id\": null, \"updated_at\": \"2026-02-27 14:10:08\", \"updated_by\": 4, \"assignee_id\": null, \"customer_id\": 98, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-UI-C-20260227211007\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": null, \"receiver_user_id\": null, \"service_group_id\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null}','{\"id\": 2457488, \"notes\": null, \"tasks\": [{\"id\": 22, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-UI-C-20260227211007\", \"task_link\": null, \"created_at\": \"2026-03-01 02:50:31\", \"created_by\": null, \"request_id\": 2457488, \"sort_order\": 0, \"updated_at\": \"2026-03-01 02:50:31\", \"updated_by\": null}], \"status\": \"NEW\", \"summary\": \"UAT UI Ref Source C 20260227211007\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 14:10:08\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"task_count\": 1, \"updated_at\": \"2026-03-01 02:50:31\", \"updated_by\": null, \"assignee_id\": null, \"customer_id\": 50, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-UI-C-20260227211007\", \"product_code\": \"SOC_MONITOR\", \"product_name\": \"Dịch vụ giám sát SOC\", \"project_code\": \"DA050\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT phường Bình Thạnh\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93104\", \"customer_name\": \"TYT phường Bình Thạnh\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"can_transfer_dev\": false, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"is_transferred_dev\": false, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null, \"transfer_programming_request_id\": null}','http://127.0.0.1:8000/api/v5/support-requests/2457488','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 02:50:31',1),(59,'8cd9c8c3-4a0b-42c5-bf0f-db83d8412f93','UPDATE','support_requests',2457488,'{\"id\": 2457488, \"notes\": null, \"status\": \"NEW\", \"summary\": \"UAT UI Ref Source C 20260227211007\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 14:10:08\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"updated_at\": \"2026-03-01 02:50:31\", \"updated_by\": null, \"assignee_id\": null, \"customer_id\": 50, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-UI-C-20260227211007\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"receiver_user_id\": null, \"service_group_id\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null}','{\"id\": 2457488, \"notes\": null, \"tasks\": [{\"id\": 23, \"status\": \"TODO\", \"task_code\": \"SRQ-UAT-UI-C-20260227211007\", \"task_link\": null, \"created_at\": \"2026-03-01 02:50:52\", \"created_by\": null, \"request_id\": 2457488, \"sort_order\": 0, \"updated_at\": \"2026-03-01 02:50:52\", \"updated_by\": null}], \"status\": \"NEW\", \"summary\": \"UAT UI Ref Source C 20260227211007\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 14:10:08\", \"created_by\": 4, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"task_count\": 1, \"updated_at\": \"2026-03-01 02:50:52\", \"updated_by\": null, \"assignee_id\": null, \"customer_id\": 50, \"hotfix_date\": null, \"ticket_code\": \"SRQ-UAT-UI-C-20260227211007\", \"product_code\": \"SOC_MONITOR\", \"product_name\": \"Dịch vụ giám sát SOC\", \"project_code\": \"DA050\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT phường Bình Thạnh\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93104\", \"customer_name\": \"TYT phường Bình Thạnh\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"can_transfer_dev\": false, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": 4, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"is_transferred_dev\": false, \"service_group_name\": \"DỰ ÁN THUÊ OS\", \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null, \"transfer_programming_request_id\": null}','http://127.0.0.1:8000/api/v5/support-requests/2457488','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 02:50:52',1),(60,'256922b2-a2f4-4754-8ef4-343a5bd7aa2e','UPDATE','projects',98,'{\"id\": 98, \"status\": \"WARRANTY\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-26 14:31:41\", \"updated_by\": 1, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 98, \"status\": \"WARRANTY\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-02 09:40:50\", \"updated_by\": 9, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8000/api/v5/projects/98','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-02 09:40:50',9),(61,'8ad05473-9f0c-4d5d-b630-4aff2f64fedc','UPDATE','projects',98,'{\"id\": 98, \"status\": \"WARRANTY\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-02 09:40:50\", \"updated_by\": 9, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 98, \"status\": \"WARRANTY\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-02 09:40:50\", \"updated_by\": 9, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8000/api/v5/projects/98','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-02 09:41:37',9),(62,'60f239f2-ea2a-4c82-913f-24ca276ab956','INSERT','support_requests',2457489,NULL,'{\"id\": 2457489, \"notes\": null, \"tasks\": [], \"status\": \"NEW\", \"summary\": \"Nội dung A\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-03-02 09:52:04\", \"created_by\": 9, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 98, \"task_count\": 0, \"updated_at\": \"2026-03-02 09:52:04\", \"updated_by\": 9, \"assignee_id\": 52, \"customer_id\": 16, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS3\", \"product_name\": \"Phần mềm VNPT HIS L3\", \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"assignee_code\": \"VNPT022342\", \"assignee_name\": \"Lý Thị Ngọc Mai\", \"customer_code\": \"93105\", \"customer_name\": \"TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"receiver_code\": \"VNPT022345\", \"receiver_name\": \"Bùi Cẩm Nhi\", \"reporter_name\": \"Đầu mối TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"resolved_date\": null, \"requested_date\": \"2026-03-02\", \"project_item_id\": 131, \"can_transfer_dev\": false, \"receiver_user_id\": 23, \"reference_status\": null, \"service_group_id\": 4, \"assignee_username\": \"mailtn.stg\", \"receiver_username\": \"nhibc.stg\", \"reference_summary\": null, \"is_transferred_dev\": false, \"service_group_name\": \"DỰ ÁN THUÊ OS\", \"reporter_contact_id\": 16, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": \"Đầu mối TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"reporter_contact_email\": \"contact.93105@vnpt.local\", \"reporter_contact_phone\": \"0900000016\", \"transfer_programming_request_id\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-02 09:52:04',9),(63,'0c3677bf-2e19-4900-91d2-dfb54ff5d67a','UPDATE','support_requests',2457489,'{\"id\": 2457489, \"notes\": null, \"status\": \"NEW\", \"summary\": \"Nội dung A\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"created_at\": \"2026-03-02 09:52:04\", \"created_by\": 9, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 98, \"updated_at\": \"2026-03-02 09:52:04\", \"updated_by\": 9, \"assignee_id\": 52, \"customer_id\": 16, \"hotfix_date\": null, \"reporter_name\": \"Đầu mối TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"resolved_date\": null, \"requested_date\": \"2026-03-02\", \"project_item_id\": 131, \"receiver_user_id\": 23, \"service_group_id\": 4, \"reporter_contact_id\": 16, \"reference_request_id\": null, \"reference_ticket_code\": null}','{\"id\": 2457489, \"notes\": null, \"tasks\": [], \"status\": \"DEV_CODE\", \"summary\": \"Nội dung A\", \"due_date\": \"2026-03-14\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-03-02 09:52:04\", \"created_by\": 9, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 98, \"task_count\": 0, \"updated_at\": \"2026-03-02 09:55:01\", \"updated_by\": null, \"assignee_id\": 52, \"customer_id\": 16, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS3\", \"product_name\": \"Phần mềm VNPT HIS L3\", \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"assignee_code\": \"VNPT022342\", \"assignee_name\": \"Lý Thị Ngọc Mai\", \"customer_code\": \"93105\", \"customer_name\": \"TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"receiver_code\": \"VNPT022345\", \"receiver_name\": \"Bùi Cẩm Nhi\", \"reporter_name\": \"Đầu mối TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"resolved_date\": \"2026-03-21\", \"requested_date\": \"2026-03-02\", \"project_item_id\": 131, \"can_transfer_dev\": false, \"receiver_user_id\": 23, \"reference_status\": null, \"service_group_id\": 4, \"assignee_username\": \"mailtn.stg\", \"receiver_username\": \"nhibc.stg\", \"reference_summary\": null, \"is_transferred_dev\": false, \"service_group_name\": \"DỰ ÁN THUÊ OS\", \"reporter_contact_id\": 16, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": \"Đầu mối TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"reporter_contact_email\": \"contact.93105@vnpt.local\", \"reporter_contact_phone\": \"0900000016\", \"transfer_programming_request_id\": null}','http://127.0.0.1:8000/api/v5/support-requests/2457489','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-02 09:55:01',9),(64,'1f5a3980-1ce9-4bc4-afab-ce72a7b6867f','UPDATE','support_requests',2457489,'{\"id\": 2457489, \"notes\": null, \"status\": \"DEV_CODE\", \"summary\": \"Nội dung A\", \"due_date\": \"2026-03-14\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"created_at\": \"2026-03-02 09:52:04\", \"created_by\": 9, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 98, \"updated_at\": \"2026-03-02 09:55:01\", \"updated_by\": null, \"assignee_id\": 52, \"customer_id\": 16, \"hotfix_date\": null, \"reporter_name\": \"Đầu mối TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"resolved_date\": \"2026-03-21\", \"requested_date\": \"2026-03-02\", \"project_item_id\": 131, \"receiver_user_id\": 23, \"service_group_id\": 4, \"reporter_contact_id\": 16, \"reference_request_id\": null, \"reference_ticket_code\": null}','{\"id\": 2457489, \"notes\": null, \"tasks\": [], \"status\": \"DEV\", \"summary\": \"Nội dung A\", \"due_date\": \"2026-03-14\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-03-02 09:52:04\", \"created_by\": 9, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 98, \"task_count\": 0, \"updated_at\": \"2026-03-02 09:55:49\", \"updated_by\": null, \"assignee_id\": 52, \"customer_id\": 16, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS3\", \"product_name\": \"Phần mềm VNPT HIS L3\", \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"assignee_code\": \"VNPT022342\", \"assignee_name\": \"Lý Thị Ngọc Mai\", \"customer_code\": \"93105\", \"customer_name\": \"TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"receiver_code\": \"VNPT022345\", \"receiver_name\": \"Bùi Cẩm Nhi\", \"reporter_name\": \"Đầu mối TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"resolved_date\": \"2026-03-21\", \"requested_date\": \"2026-03-02\", \"project_item_id\": 131, \"can_transfer_dev\": true, \"receiver_user_id\": 23, \"reference_status\": null, \"service_group_id\": 4, \"assignee_username\": \"mailtn.stg\", \"receiver_username\": \"nhibc.stg\", \"reference_summary\": null, \"is_transferred_dev\": false, \"service_group_name\": \"DỰ ÁN THUÊ OS\", \"reporter_contact_id\": 16, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": \"Đầu mối TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"reporter_contact_email\": \"contact.93105@vnpt.local\", \"reporter_contact_phone\": \"0900000016\", \"transfer_programming_request_id\": null}','http://127.0.0.1:8000/api/v5/support-requests/2457489','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-02 09:55:49',9),(65,'40eed7b1-bf20-4ead-b977-c74b843d2983','INSERT','support_requests',2457490,NULL,'{\"id\": 2457490, \"notes\": null, \"tasks\": [{\"id\": 24, \"status\": \"TODO\", \"task_code\": \"IT360\", \"task_link\": \"IT360\", \"created_at\": \"2026-03-02 12:36:07\", \"created_by\": 1, \"request_id\": 2457490, \"sort_order\": 0, \"updated_at\": \"2026-03-02 12:36:07\", \"updated_by\": 1}], \"status\": \"NEW\", \"summary\": \"Hỗ trợ âm kho\", \"due_date\": \"2026-03-04\", \"priority\": \"MEDIUM\", \"noti_date\": \"2026-03-11\", \"task_link\": \"IT360\", \"created_at\": \"2026-03-02 12:36:07\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 3, \"task_count\": 1, \"updated_at\": \"2026-03-02 12:36:07\", \"updated_by\": 1, \"assignee_id\": 52, \"customer_id\": 98, \"hotfix_date\": \"2026-03-10\", \"ticket_code\": \"IT360\", \"product_code\": \"VNPT_HIS3\", \"product_name\": \"Phần mềm VNPT HIS L3\", \"project_code\": \"DA098\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hỏa Tiế渁\", \"request_code\": \"YC260302362457490\", \"assignee_code\": \"VNPT022342\", \"assignee_name\": \"Lý Thị Ngọc Mai\", \"customer_code\": \"93017\", \"customer_name\": \"Trạm Y tế Xã Hỏa Tiế渁\", \"receiver_code\": \"VNPT022345\", \"receiver_name\": \"Bùi Cẩm Nhi\", \"reporter_name\": \"Đầu mối Trạm Y tế Xã Hỏa Tiế渁\", \"resolved_date\": \"2026-03-05\", \"requested_date\": \"2026-03-02\", \"project_item_id\": 95, \"can_transfer_dev\": false, \"receiver_user_id\": 23, \"reference_status\": \"NEW\", \"service_group_id\": 4, \"assignee_username\": \"mailtn.stg\", \"receiver_username\": \"nhibc.stg\", \"reference_summary\": \"Bulk valid 20260227205632\", \"is_transferred_dev\": false, \"service_group_name\": \"DỰ ÁN THUÊ OS\", \"reporter_contact_id\": 98, \"reference_request_id\": 2457481, \"reference_ticket_code\": \"SRQ-UAT3-BULK1-20260227205632\", \"reporter_contact_name\": \"Đầu mối Trạm Y tế Xã Hỏa Tiế渁\", \"reference_request_code\": null, \"reporter_contact_email\": \"contact.93017@vnpt.local\", \"reporter_contact_phone\": \"0900000098\", \"transfer_programming_request_id\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-02 12:36:07',1),(66,'f073dca9-6900-45e5-9f60-96dba5f4ca19','INSERT','support_requests',2457491,NULL,'{\"id\": 2457491, \"notes\": null, \"tasks\": [], \"status\": \"NEW\", \"summary\": \"aaaaaaaaa\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-03-02 12:47:15\", \"created_by\": 9, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"task_count\": 0, \"updated_at\": \"2026-03-02 12:47:15\", \"updated_by\": 9, \"assignee_id\": null, \"customer_id\": 50, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"SOC_MONITOR\", \"product_name\": \"Dịch vụ giám sát SOC\", \"project_code\": \"DA050\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT phường Bình Thạnh\", \"request_code\": \"YC-022457491\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"93104\", \"customer_name\": \"TYT phường Bình Thạnh\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": \"Đầu mối TYT phường Bình Thạnh\", \"resolved_date\": null, \"requested_date\": \"2026-03-02\", \"project_item_id\": 98, \"can_transfer_dev\": false, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": 4, \"assignee_username\": null, \"receiver_username\": null, \"reference_summary\": null, \"is_transferred_dev\": false, \"service_group_name\": \"DỰ ÁN THUÊ OS\", \"reporter_contact_id\": 50, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": \"Đầu mối TYT phường Bình Thạnh\", \"reference_request_code\": null, \"reporter_contact_email\": \"contact.93104@vnpt.local\", \"reporter_contact_phone\": \"0900000050\", \"transfer_programming_request_id\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-02 12:47:15',9),(67,'b21ddaaf-2411-48cd-be3e-eb6fd33a6f1f','INSERT','support_requests',2457493,NULL,'{\"id\": 2457493, \"notes\": null, \"tasks\": [], \"status\": \"NEW\", \"summary\": \"abc\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-03-03 15:27:18\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"task_count\": 0, \"updated_at\": \"2026-03-03 15:27:18\", \"updated_by\": 1, \"assignee_id\": 18, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS3\", \"product_name\": \"Phần mềm VNPT HIS L3\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"request_code\": \"YC03032457493\", \"assignee_code\": \"VNPT022408\", \"assignee_name\": \"Châu Kim Tuấn\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-03-03\", \"project_item_id\": 1, \"can_transfer_dev\": false, \"receiver_user_id\": null, \"reference_status\": null, \"service_group_id\": null, \"assignee_username\": \"tuanck.stg\", \"receiver_username\": null, \"reference_summary\": null, \"is_transferred_dev\": false, \"service_group_name\": null, \"reporter_contact_id\": null, \"reference_request_id\": null, \"reference_ticket_code\": null, \"reporter_contact_name\": null, \"reference_request_code\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null, \"transfer_programming_request_id\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-03 15:27:18',1),(68,'fdf75d78-6560-4d9a-8bef-45ec0c1f7ccd','INSERT','documents',5,NULL,'{\"id\": \"SMOKE_DOC_1772626222\", \"name\": \"Smoke Security Document\", \"status\": \"ACTIVE\", \"typeId\": \"DT001\", \"productId\": null, \"projectId\": null, \"customerId\": \"1\", \"expiryDate\": null, \"productIds\": [], \"attachments\": [{\"id\": \"3\", \"fileUrl\": \"http://127.0.0.1:8000/api/v5/documents/attachments/3/download?expires=1772627123&signature=b33c7de5f9a88855d58b4970706b532253f64d9a20b0633e58c4a7d4ad5bfa6a\", \"fileName\": \"smoke-attachment.txt\", \"fileSize\": 25, \"mimeType\": \"text/plain\", \"createdAt\": \"2026-03-04\", \"driveFileId\": \"\", \"storageDisk\": \"local\", \"storagePath\": \"documents/bEQrFwd4uhVsz47pixBUAdQCv2iIKjpf1jiyaJI4.txt\", \"storageProvider\": \"LOCAL\", \"storageVisibility\": \"private\"}], \"createdDate\": \"2026-03-04\"}','http://127.0.0.1:8000/api/v5/documents','127.0.0.1','curl/8.7.1','2026-03-04 12:10:23',9),(69,'dbf5cd03-c16e-4e77-bb6b-32ff30203011','DELETE','documents',5,'{\"id\": 5, \"status\": \"ACTIVE\", \"created_at\": \"2026-03-04 19:10:23\", \"created_by\": 9, \"deleted_at\": null, \"project_id\": null, \"updated_at\": null, \"updated_by\": 9, \"customer_id\": 1, \"expiry_date\": null, \"document_code\": \"SMOKE_DOC_1772626222\", \"document_name\": \"Smoke Security Document\", \"document_type_id\": 1}',NULL,'http://127.0.0.1:8000/api/v5/documents/SMOKE_DOC_1772626222','127.0.0.1','curl/8.7.1','2026-03-04 12:11:10',9),(70,'a528e585-fed1-48de-b9bd-38bb65559ea6','UPDATE','projects',95,'{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-25 17:53:13\", \"updated_by\": null, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:01:00\", \"updated_by\": 9, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8001/api/v5/projects/95','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 13:01:00',9),(71,'0b72118c-ebdf-4098-b342-3bf4586beb9e','UPDATE','projects',95,'{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:01:00\", \"updated_by\": 9, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:01:00\", \"updated_by\": 9, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8001/api/v5/projects/95','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 13:01:45',9),(72,'104d8d0e-4e61-43e2-98c7-e82cbc440e01','UPDATE','projects',95,'{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:01:00\", \"updated_by\": 9, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:01:00\", \"updated_by\": 9, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8001/api/v5/projects/95','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 13:02:29',9),(73,'3894a275-c43a-4da5-97fd-a2dab1eb8c0a','UPDATE','projects',95,'{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:01:00\", \"updated_by\": 9, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:01:00\", \"updated_by\": 9, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8001/api/v5/projects/95','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 13:29:18',9),(74,'b27783f7-f6a5-4089-a6d9-8d2f00a1fc96','UPDATE','projects',95,'{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:01:00\", \"updated_by\": 9, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:01:00\", \"updated_by\": 9, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8001/api/v5/projects/95','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 13:29:43',9),(75,'d16425f1-e767-44c5-9bc4-9caff8c33e86','UPDATE','projects',95,'{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:01:00\", \"updated_by\": 9, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 95, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:01:00\", \"updated_by\": 9, \"customer_id\": 3, \"project_code\": \"DA003\", \"project_name\": \"Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8001/api/v5/projects/95','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 13:34:56',9),(76,'f6ba8566-a4e7-4677-a37f-a06abc74bffd','UPDATE','projects',98,'{\"id\": 98, \"status\": \"WARRANTY\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-02 09:40:50\", \"updated_by\": 9, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 98, \"status\": \"WARRANTY\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-03-06 13:53:06\", \"updated_by\": 9, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2027-11-25\"}','http://127.0.0.1:8001/api/v5/projects/98','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 13:53:06',9);
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=107 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_login_attempts`
--

LOCK TABLES `auth_login_attempts` WRITE;
/*!40000 ALTER TABLE `auth_login_attempts` DISABLE KEYS */;
INSERT INTO `auth_login_attempts` VALUES (1,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-25 19:38:08','2026-02-25 19:38:08'),(2,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-25 19:40:21','2026-02-25 19:40:21'),(3,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-25 19:44:56','2026-02-25 19:44:56'),(4,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-25 20:22:23','2026-02-25 20:22:23'),(5,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-25 23:06:55','2026-02-25 23:06:55'),(6,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 00:18:18','2026-02-26 00:18:18'),(7,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 04:50:28','2026-02-26 04:50:28'),(8,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 05:37:44','2026-02-26 05:37:44'),(9,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 06:15:35','2026-02-26 06:15:35'),(10,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 06:30:12','2026-02-26 06:30:12'),(11,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:11:26','2026-02-26 07:11:26'),(12,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:11:27','2026-02-26 07:11:27'),(13,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:11:28','2026-02-26 07:11:28'),(14,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:11:47','2026-02-26 07:11:47'),(15,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:12:11','2026-02-26 07:12:11'),(16,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:17:39','2026-02-26 07:17:39'),(17,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:34:57','2026-02-26 07:34:57'),(18,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','curl/8.7.1','2026-02-26 15:46:50','2026-02-26 15:46:50'),(19,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 15:47:22','2026-02-26 15:47:22'),(20,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 15:52:01','2026-02-26 15:52:01'),(21,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 15:54:28','2026-02-26 15:54:28'),(22,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 15:57:25','2026-02-26 15:57:25'),(23,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 20:23:23','2026-02-26 20:23:23'),(24,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 20:23:26','2026-02-26 20:23:26'),(25,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 20:23:32','2026-02-26 20:23:32'),(26,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 20:26:18','2026-02-26 20:26:18'),(27,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 23:50:50','2026-02-26 23:50:50'),(28,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 23:50:55','2026-02-26 23:50:55'),(29,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 23:51:07','2026-02-26 23:51:07'),(30,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 23:51:14','2026-02-26 23:51:14'),(31,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 23:51:20','2026-02-26 23:51:20'),(32,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 03:29:08','2026-02-27 03:29:08'),(33,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 03:54:46','2026-02-27 03:54:46'),(34,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 03:54:54','2026-02-27 03:54:54'),(35,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-27 06:47:49','2026-02-27 06:47:49'),(36,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-27 06:49:30','2026-02-27 06:49:30'),(37,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-27 06:51:05','2026-02-27 06:51:05'),(38,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-27 06:56:32','2026-02-27 06:56:32'),(39,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-27 06:57:35','2026-02-27 06:57:35'),(40,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-27 07:10:07','2026-02-27 07:10:07'),(41,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 19:06:25','2026-02-27 19:06:25'),(42,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 19:06:32','2026-02-27 19:06:32'),(43,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-28 19:35:53','2026-02-28 19:35:53'),(44,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-28 19:35:59','2026-02-28 19:35:59'),(45,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 04:20:18','2026-03-01 04:20:18'),(46,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 04:20:24','2026-03-01 04:20:24'),(47,'truongnn.cto',50,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 07:52:09','2026-03-01 07:52:09'),(48,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 07:52:24','2026-03-01 07:52:24'),(49,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 07:52:29','2026-03-01 07:52:29'),(50,'traopt.hgi',10,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 07:55:17','2026-03-01 07:55:17'),(51,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 15:50:12','2026-03-01 15:50:12'),(52,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 22:16:29','2026-03-01 22:16:29'),(53,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-02 05:07:30','2026-03-02 05:07:30'),(54,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-02 05:07:35','2026-03-02 05:07:35'),(55,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-03 01:59:21','2026-03-03 01:59:21'),(56,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-03 01:59:27','2026-03-03 01:59:27'),(57,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-03 15:48:40','2026-03-03 15:48:40'),(58,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-04 05:17:49','2026-03-04 05:17:49'),(59,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-04 05:17:56','2026-03-04 05:17:56'),(60,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-04 05:18:13','2026-03-04 05:18:13'),(61,'admin.demo',NULL,'FAILED','INVALID_CREDENTIALS','127.0.0.1','curl/8.7.1','2026-03-06 04:35:28','2026-03-06 04:35:28'),(62,'admin.demo',NULL,'FAILED','INVALID_CREDENTIALS','127.0.0.1','curl/8.7.1','2026-03-06 04:35:44','2026-03-06 04:35:44'),(63,'admin.demo',NULL,'FAILED','INVALID_CREDENTIALS','127.0.0.1','curl/8.7.1','2026-03-06 04:38:01','2026-03-06 04:38:01'),(64,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 04:38:28','2026-03-06 04:38:28'),(65,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 04:38:29','2026-03-06 04:38:29'),(66,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 04:38:38','2026-03-06 04:38:38'),(67,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 06:50:29','2026-03-06 06:50:29'),(68,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 06:57:01','2026-03-06 06:57:01'),(69,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-06 16:16:22','2026-03-06 16:16:22'),(70,'x',NULL,'FAILED','INVALID_CREDENTIALS','127.0.0.1','curl/8.7.1','2026-03-07 01:03:25','2026-03-07 01:03:25'),(71,'x',NULL,'FAILED','INVALID_CREDENTIALS','127.0.0.1','curl/8.7.1','2026-03-07 01:04:24','2026-03-07 01:04:24'),(72,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-08 03:19:08','2026-03-08 03:19:08'),(73,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-08 06:21:49','2026-03-08 06:21:49'),(74,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-08 07:56:34','2026-03-08 07:56:34'),(75,'x',NULL,'FAILED','INVALID_CREDENTIALS','127.0.0.1','curl/8.7.1','2026-03-08 18:14:21','2026-03-08 18:14:21'),(76,'x',NULL,'FAILED','INVALID_CREDENTIALS','127.0.0.1','curl/8.7.1','2026-03-08 18:15:58','2026-03-08 18:15:58'),(77,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-08 18:17:44','2026-03-08 18:17:44'),(78,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-08 21:39:19','2026-03-08 21:39:19'),(79,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-09 04:52:56','2026-03-09 04:52:56'),(80,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-09 04:55:09','2026-03-09 04:55:09'),(81,'ropv.hgi',9,'FAILED','INVALID_CREDENTIALS','127.0.0.1','curl/8.7.1','2026-03-10 17:25:52','2026-03-10 17:25:52'),(82,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-03-10 17:27:18','2026-03-10 17:27:18'),(83,'ropv.hgi',9,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 17:36:04','2026-03-10 17:36:04'),(84,'ropv.hgi',9,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 17:36:10','2026-03-10 17:36:10'),(85,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-03-10 17:36:11','2026-03-10 17:36:11'),(86,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-03-10 17:37:44','2026-03-10 17:37:44'),(87,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 19:14:09','2026-03-10 19:14:09'),(88,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 19:14:15','2026-03-10 19:14:15'),(89,'ropv.hgi',9,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 19:14:44','2026-03-10 19:14:44'),(90,'ropv.hgi',9,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 19:14:51','2026-03-10 19:14:51'),(91,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 19:15:02','2026-03-10 19:15:02'),(92,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 19:54:18','2026-03-10 19:54:18'),(93,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/145.0.0.0 Safari/537.36','2026-03-10 20:26:32','2026-03-10 20:26:32'),(94,'ropv.hgi',9,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 23:46:44','2026-03-10 23:46:44'),(95,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 23:46:53','2026-03-10 23:46:53'),(96,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 23:47:12','2026-03-10 23:47:12'),(97,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-10 23:47:19','2026-03-10 23:47:19'),(98,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-11 00:42:49','2026-03-11 00:42:49'),(99,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-11 00:42:54','2026-03-11 00:42:54'),(100,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-11 00:43:00','2026-03-11 00:43:00'),(101,'ropv.hgi',9,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-11 01:19:44','2026-03-11 01:19:44'),(102,'ropv.hgi',9,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-11 01:19:53','2026-03-11 01:19:53'),(103,'ropv.hgi',9,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-11 01:22:12','2026-03-11 01:22:12'),(104,'ropv.hgi',9,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-11 01:22:18','2026-03-11 01:22:18'),(105,'ropv.hgi',9,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-11 01:22:30','2026-03-11 01:22:30'),(106,'ropv.hgi',9,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-11 01:23:35','2026-03-11 01:23:35');
/*!40000 ALTER TABLE `auth_login_attempts` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `business_domains`
--

LOCK TABLES `business_domains` WRITE;
/*!40000 ALTER TABLE `business_domains` DISABLE KEYS */;
INSERT INTO `business_domains` VALUES (3,'YTESO_PM','Phần mềm Y tế số','2026-03-01 23:23:46',NULL,NULL,NULL),(5,'YTESO_PC','Phần cứng Y tế số','2026-03-02 00:16:53',9,'2026-03-01 17:16:53',9),(6,'GD_PM','Phần mềm Giáo dục số','2026-03-02 00:16:53',9,'2026-03-01 17:16:53',9),(7,'GD_PC','Phần cứng Giáo dục số','2026-03-02 00:16:53',9,'2026-03-01 17:16:53',9),(8,'NN_PM','Phần mềm Nông nghệp số','2026-03-02 00:16:54',9,'2026-03-01 17:16:54',9);
/*!40000 ALTER TABLE `business_domains` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
INSERT INTO `cache` VALUES ('laravel-cache-1de4cbfdf0575f792e47f344b6bd9e6e','i:1;',1772626093),('laravel-cache-1de4cbfdf0575f792e47f344b6bd9e6e:timer','i:1772626093;',1772626093),('laravel-cache-50881e51d980a0f2023c04d9bf3009dd','i:3;',1773215029),('laravel-cache-50881e51d980a0f2023c04d9bf3009dd:timer','i:1773215029;',1773215029),('laravel-cache-587900d00d3a75335ebe4582de0470b9','i:2;',1773222654),('laravel-cache-587900d00d3a75335ebe4582de0470b9:timer','i:1773222654;',1773222654),('laravel-cache-5dfc2ea83895463b820f92a2ef7a5373','i:1;',1773224770),('laravel-cache-5dfc2ea83895463b820f92a2ef7a5373:timer','i:1773224770;',1773224770),('laravel-cache-829c3635317983a1fac6771d25b9840f','i:1;',1773217474),('laravel-cache-829c3635317983a1fac6771d25b9840f:timer','i:1773217474;',1773217474),('laravel-cache-919b25e5d56c167862c37fb1676d524d','i:1;',1772626454),('laravel-cache-919b25e5d56c167862c37fb1676d524d:timer','i:1772626454;',1772626454),('laravel-cache-9f7b24816dd025c4f602c6f4b9f4934b','i:1;',1773199650),('laravel-cache-9f7b24816dd025c4f602c6f4b9f4934b:timer','i:1773199650;',1773199650),('laravel-cache-b63d2c28c28003b169e1be3ededc6681','i:1;',1772626694),('laravel-cache-b63d2c28c28003b169e1be3ededc6681:timer','i:1772626694;',1772626694),('laravel-cache-v5:business_domains:list:v1','a:5:{i:0;a:7:{s:2:\"id\";i:3;s:11:\"domain_code\";s:8:\"YTESO_PM\";s:11:\"domain_name\";s:24:\"Phần mềm Y tế số\";s:10:\"created_at\";s:19:\"2026-03-02 06:23:46\";s:10:\"created_by\";N;s:10:\"updated_at\";N;s:10:\"updated_by\";N;}i:1;a:7:{s:2:\"id\";i:5;s:11:\"domain_code\";s:8:\"YTESO_PC\";s:11:\"domain_name\";s:25:\"Phần cứng Y tế số\";s:10:\"created_at\";s:19:\"2026-03-02 07:16:53\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 00:16:53\";s:10:\"updated_by\";i:9;}i:2;a:7:{s:2:\"id\";i:6;s:11:\"domain_code\";s:5:\"GD_PM\";s:11:\"domain_name\";s:29:\"Phần mềm Giáo dục số\";s:10:\"created_at\";s:19:\"2026-03-02 07:16:53\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 00:16:53\";s:10:\"updated_by\";i:9;}i:3;a:7:{s:2:\"id\";i:7;s:11:\"domain_code\";s:5:\"GD_PC\";s:11:\"domain_name\";s:30:\"Phần cứng Giáo dục số\";s:10:\"created_at\";s:19:\"2026-03-02 07:16:53\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 00:16:53\";s:10:\"updated_by\";i:9;}i:4;a:7:{s:2:\"id\";i:8;s:11:\"domain_code\";s:5:\"NN_PM\";s:11:\"domain_name\";s:31:\"Phần mềm Nông nghệp số\";s:10:\"created_at\";s:19:\"2026-03-02 07:16:54\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 00:16:54\";s:10:\"updated_by\";i:9;}}',1772684912),('laravel-cache-v5:departments:list:v1','a:6:{i:0;a:10:{s:2:\"id\";i:1;s:9:\"dept_code\";s:6:\"TTKDGP\";s:9:\"dept_name\";s:34:\"Trung tâm Kinh doanh Giải pháp\";s:9:\"parent_id\";i:4;s:9:\"dept_path\";s:2:\"1/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-23T15:01:47.000000Z\";s:10:\"updated_at\";s:27:\"2026-03-01T13:47:46.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:4;s:9:\"dept_code\";s:6:\"BGĐVT\";s:9:\"dept_name\";s:30:\"Ban giám đốc Viễn Thông\";}s:9:\"is_active\";b:1;}i:1;a:10:{s:2:\"id\";i:2;s:9:\"dept_code\";s:4:\"PGP2\";s:9:\"dept_name\";s:21:\"Phòng giải Pháp 2\";s:9:\"parent_id\";i:1;s:9:\"dept_path\";s:4:\"1/2/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-23T15:01:47.000000Z\";s:10:\"updated_at\";s:27:\"2026-03-01T14:09:55.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:1;s:9:\"dept_code\";s:6:\"TTKDGP\";s:9:\"dept_name\";s:34:\"Trung tâm Kinh doanh Giải pháp\";}s:9:\"is_active\";b:1;}i:2;a:10:{s:2:\"id\";i:3;s:9:\"dept_code\";s:3:\"TTH\";s:9:\"dept_name\";s:17:\"Tổ tổng hợp\";s:9:\"parent_id\";i:1;s:9:\"dept_path\";s:4:\"1/3/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-23T15:01:47.000000Z\";s:10:\"updated_at\";s:27:\"2026-03-01T14:12:58.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:1;s:9:\"dept_code\";s:6:\"TTKDGP\";s:9:\"dept_name\";s:34:\"Trung tâm Kinh doanh Giải pháp\";}s:9:\"is_active\";b:1;}i:3;a:10:{s:2:\"id\";i:4;s:9:\"dept_code\";s:6:\"BGĐVT\";s:9:\"dept_name\";s:30:\"Ban giám đốc Viễn Thông\";s:9:\"parent_id\";N;s:9:\"dept_path\";s:2:\"4/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-25T13:12:43.000000Z\";s:10:\"updated_at\";s:27:\"2026-02-25T20:12:43.000000Z\";s:6:\"parent\";N;s:9:\"is_active\";b:1;}i:4;a:10:{s:2:\"id\";i:5;s:9:\"dept_code\";s:4:\"PGP1\";s:9:\"dept_name\";s:21:\"Phòng Giải pháp 1\";s:9:\"parent_id\";i:1;s:9:\"dept_path\";s:4:\"1/5/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-03-01T14:13:38.000000Z\";s:10:\"updated_at\";s:27:\"2026-03-01T14:13:38.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:1;s:9:\"dept_code\";s:6:\"TTKDGP\";s:9:\"dept_name\";s:34:\"Trung tâm Kinh doanh Giải pháp\";}s:9:\"is_active\";b:1;}i:5;a:10:{s:2:\"id\";i:6;s:9:\"dept_code\";s:3:\"PKT\";s:9:\"dept_name\";s:17:\"Phòng Kế toán\";s:9:\"parent_id\";i:4;s:9:\"dept_path\";s:4:\"4/6/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-03-01T14:13:54.000000Z\";s:10:\"updated_at\";s:27:\"2026-03-01T14:13:54.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:4;s:9:\"dept_code\";s:6:\"BGĐVT\";s:9:\"dept_name\";s:30:\"Ban giám đốc Viễn Thông\";}s:9:\"is_active\";b:1;}}',1773213443),('laravel-cache-v5:products:list:v1','a:9:{i:0;a:13:{s:2:\"id\";i:1;s:12:\"product_code\";s:9:\"VNPT_HIS3\";s:12:\"product_name\";s:24:\"Phần mềm VNPT HIS L3\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:150000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-02-23 15:16:35\";s:10:\"created_by\";N;s:10:\"updated_at\";s:19:\"2026-03-02 00:29:01\";s:10:\"updated_by\";i:9;}i:1;a:13:{s:2:\"id\";i:2;s:12:\"product_code\";s:11:\"SOC_MONITOR\";s:12:\"product_name\";s:26:\"Dịch vụ giám sát SOC\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:2;s:14:\"standard_price\";d:80000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-02-23 15:16:35\";s:10:\"created_by\";N;s:10:\"updated_at\";s:19:\"2026-03-02 06:41:22\";s:10:\"updated_by\";N;}i:2;a:13:{s:2:\"id\";i:3;s:12:\"product_code\";s:8:\"VNPT_LIS\";s:12:\"product_name\";s:21:\"Phần mềm VNPT LIS\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:550000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:04\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:04\";s:10:\"updated_by\";i:9;}i:3;a:13:{s:2:\"id\";i:4;s:12:\"product_code\";s:12:\"VNPT_RISPACS\";s:12:\"product_name\";s:26:\"Phần mềm VNPT RIS-PACS\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:100000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:04\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:04\";s:10:\"updated_by\";i:9;}i:4;a:13:{s:2:\"id\";i:5;s:12:\"product_code\";s:8:\"VNPT_EMR\";s:12:\"product_name\";s:36:\"Phần mềm Bệnh án điện tử\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:100000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"updated_by\";i:9;}i:5;a:13:{s:2:\"id\";i:6;s:12:\"product_code\";s:9:\"VNPT_HMIS\";s:12:\"product_name\";s:17:\"Phần mềm HMIS\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:990000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"updated_by\";i:9;}i:6;a:13:{s:2:\"id\";i:7;s:12:\"product_code\";s:9:\"VNPT_HIS2\";s:12:\"product_name\";s:24:\"Phần mềm VNPT HIS L2\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:100000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"updated_by\";i:9;}i:7;a:13:{s:2:\"id\";i:8;s:12:\"product_code\";s:9:\"VNPT_HIS4\";s:12:\"product_name\";s:25:\"Phần mềm VNPT HIS 4.0\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:100000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"updated_by\";i:9;}i:8;a:13:{s:2:\"id\";i:9;s:12:\"product_code\";s:8:\"VNPT_CKS\";s:12:\"product_name\";s:22:\"Chữ ký số SmartCA\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:100000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"updated_by\";i:9;}}',1773212543),('laravel-cache-v5:support-requests:kpi:02b9041071eb15dd7de84f9b62cb8544','a:6:{s:14:\"total_requests\";i:1;s:9:\"new_count\";i:1;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:0;}',1772445291),('laravel-cache-v5:support-requests:kpi:4a4fab4ad00c00b4f0b6278c628787cd','a:6:{s:14:\"total_requests\";i:189;s:9:\"new_count\";i:51;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:27;s:21:\"approaching_due_count\";i:1;s:13:\"overdue_count\";i:72;}',1772665832),('laravel-cache-v5:support-requests:kpi:519c09371c39cc62935d9975504317b5','a:6:{s:14:\"total_requests\";i:189;s:9:\"new_count\";i:51;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:27;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:73;}',1772697248),('laravel-cache-v5:support-requests:kpi:60ad47e3ef3a2776af54d77c2fece293','a:6:{s:14:\"total_requests\";i:188;s:9:\"new_count\";i:50;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:27;s:21:\"approaching_due_count\";i:3;s:13:\"overdue_count\";i:69;}',1772456450),('laravel-cache-v5:support-requests:kpi:857d17ee8f9765f95cd91cd193a0d246','a:6:{s:14:\"total_requests\";i:188;s:9:\"new_count\";i:50;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:27;s:21:\"approaching_due_count\";i:3;s:13:\"overdue_count\";i:69;}',1772468231),('laravel-cache-v5:support-requests:kpi:a12c4b92c103a2d28107b5d50ed5b40d','a:6:{s:14:\"total_requests\";i:0;s:9:\"new_count\";i:0;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:0;}',1772445273),('laravel-cache-v5:support-requests:kpi:a6e15625b05101b8fd6ea2db235eb44f','a:6:{s:14:\"total_requests\";i:189;s:9:\"new_count\";i:51;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:27;s:21:\"approaching_due_count\";i:4;s:13:\"overdue_count\";i:69;}',1772582330),('laravel-cache-v5:support-requests:kpi:b3d7aea4a35d5b8012da0f9ae0e17ae9','a:6:{s:14:\"total_requests\";i:0;s:9:\"new_count\";i:0;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:0;}',1772445272),('laravel-cache-v5:support-requests:kpi:d69edb9f6b536ebdee9e616e1a92f8f7','a:6:{s:14:\"total_requests\";i:1;s:9:\"new_count\";i:1;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:0;}',1772445274),('vnpt-business-management-cache-50881e51d980a0f2023c04d9bf3009dd','i:2;',1772797167),('vnpt-business-management-cache-50881e51d980a0f2023c04d9bf3009dd:timer','i:1772797167;',1772797167),('vnpt-business-management-cache-587900d00d3a75335ebe4582de0470b9','i:3;',1773063522),('vnpt-business-management-cache-587900d00d3a75335ebe4582de0470b9:timer','i:1773063522;',1773063522),('vnpt-business-management-cache-5d1766bf96953fe725b10137a219f375','i:1;',1773019018),('vnpt-business-management-cache-5d1766bf96953fe725b10137a219f375:timer','i:1773019018;',1773019018),('vnpt-business-management-cache-5dfc2ea83895463b820f92a2ef7a5373','i:1;',1773114013),('vnpt-business-management-cache-5dfc2ea83895463b820f92a2ef7a5373:timer','i:1773114013;',1773114013),('vnpt-business-management-cache-786ca5d919cd67bf25c8c0d496637bda','i:1;',1772797141),('vnpt-business-management-cache-786ca5d919cd67bf25c8c0d496637bda:timer','i:1772797141;',1772797141),('vnpt-business-management-cache-80860cc5bd3601144a095c9beb672c98','i:2;',1773063522),('vnpt-business-management-cache-80860cc5bd3601144a095c9beb672c98:timer','i:1773063522;',1773063522),('vnpt-business-management-cache-829c3635317983a1fac6771d25b9840f','i:1;',1773057369),('vnpt-business-management-cache-829c3635317983a1fac6771d25b9840f:timer','i:1773057369;',1773057369),('vnpt-business-management-cache-v5:business_domains:list:v1','a:5:{i:0;a:7:{s:2:\"id\";i:3;s:11:\"domain_code\";s:8:\"YTESO_PM\";s:11:\"domain_name\";s:24:\"Phần mềm Y tế số\";s:10:\"created_at\";s:19:\"2026-03-02 06:23:46\";s:10:\"created_by\";N;s:10:\"updated_at\";N;s:10:\"updated_by\";N;}i:1;a:7:{s:2:\"id\";i:5;s:11:\"domain_code\";s:8:\"YTESO_PC\";s:11:\"domain_name\";s:25:\"Phần cứng Y tế số\";s:10:\"created_at\";s:19:\"2026-03-02 07:16:53\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 00:16:53\";s:10:\"updated_by\";i:9;}i:2;a:7:{s:2:\"id\";i:6;s:11:\"domain_code\";s:5:\"GD_PM\";s:11:\"domain_name\";s:29:\"Phần mềm Giáo dục số\";s:10:\"created_at\";s:19:\"2026-03-02 07:16:53\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 00:16:53\";s:10:\"updated_by\";i:9;}i:3;a:7:{s:2:\"id\";i:7;s:11:\"domain_code\";s:5:\"GD_PC\";s:11:\"domain_name\";s:30:\"Phần cứng Giáo dục số\";s:10:\"created_at\";s:19:\"2026-03-02 07:16:53\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 00:16:53\";s:10:\"updated_by\";i:9;}i:4;a:7:{s:2:\"id\";i:8;s:11:\"domain_code\";s:5:\"NN_PM\";s:11:\"domain_name\";s:31:\"Phần mềm Nông nghệp số\";s:10:\"created_at\";s:19:\"2026-03-02 07:16:54\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 00:16:54\";s:10:\"updated_by\";i:9;}}',1772892653),('vnpt-business-management-cache-v5:departments:list:v1','a:6:{i:0;a:10:{s:2:\"id\";i:1;s:9:\"dept_code\";s:6:\"TTKDGP\";s:9:\"dept_name\";s:34:\"Trung tâm Kinh doanh Giải pháp\";s:9:\"parent_id\";i:4;s:9:\"dept_path\";s:2:\"1/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-23T15:01:47.000000Z\";s:10:\"updated_at\";s:27:\"2026-03-01T13:47:46.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:4;s:9:\"dept_code\";s:6:\"BGĐVT\";s:9:\"dept_name\";s:30:\"Ban giám đốc Viễn Thông\";}s:9:\"is_active\";b:1;}i:1;a:10:{s:2:\"id\";i:2;s:9:\"dept_code\";s:4:\"PGP2\";s:9:\"dept_name\";s:21:\"Phòng giải Pháp 2\";s:9:\"parent_id\";i:1;s:9:\"dept_path\";s:4:\"1/2/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-23T15:01:47.000000Z\";s:10:\"updated_at\";s:27:\"2026-03-01T14:09:55.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:1;s:9:\"dept_code\";s:6:\"TTKDGP\";s:9:\"dept_name\";s:34:\"Trung tâm Kinh doanh Giải pháp\";}s:9:\"is_active\";b:1;}i:2;a:10:{s:2:\"id\";i:3;s:9:\"dept_code\";s:3:\"TTH\";s:9:\"dept_name\";s:17:\"Tổ tổng hợp\";s:9:\"parent_id\";i:1;s:9:\"dept_path\";s:4:\"1/3/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-23T15:01:47.000000Z\";s:10:\"updated_at\";s:27:\"2026-03-01T14:12:58.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:1;s:9:\"dept_code\";s:6:\"TTKDGP\";s:9:\"dept_name\";s:34:\"Trung tâm Kinh doanh Giải pháp\";}s:9:\"is_active\";b:1;}i:3;a:10:{s:2:\"id\";i:4;s:9:\"dept_code\";s:6:\"BGĐVT\";s:9:\"dept_name\";s:30:\"Ban giám đốc Viễn Thông\";s:9:\"parent_id\";N;s:9:\"dept_path\";s:2:\"4/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-25T13:12:43.000000Z\";s:10:\"updated_at\";s:27:\"2026-02-25T20:12:43.000000Z\";s:6:\"parent\";N;s:9:\"is_active\";b:1;}i:4;a:10:{s:2:\"id\";i:5;s:9:\"dept_code\";s:4:\"PGP1\";s:9:\"dept_name\";s:21:\"Phòng Giải pháp 1\";s:9:\"parent_id\";i:1;s:9:\"dept_path\";s:4:\"1/5/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-03-01T14:13:38.000000Z\";s:10:\"updated_at\";s:27:\"2026-03-01T14:13:38.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:1;s:9:\"dept_code\";s:6:\"TTKDGP\";s:9:\"dept_name\";s:34:\"Trung tâm Kinh doanh Giải pháp\";}s:9:\"is_active\";b:1;}i:5;a:10:{s:2:\"id\";i:6;s:9:\"dept_code\";s:3:\"PKT\";s:9:\"dept_name\";s:17:\"Phòng Kế toán\";s:9:\"parent_id\";i:4;s:9:\"dept_path\";s:4:\"4/6/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-03-01T14:13:54.000000Z\";s:10:\"updated_at\";s:27:\"2026-03-01T14:13:54.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:4;s:9:\"dept_code\";s:6:\"BGĐVT\";s:9:\"dept_name\";s:30:\"Ban giám đốc Viễn Thông\";}s:9:\"is_active\";b:1;}}',1773042864),('vnpt-business-management-cache-v5:products:list:v1','a:9:{i:0;a:13:{s:2:\"id\";i:1;s:12:\"product_code\";s:9:\"VNPT_HIS3\";s:12:\"product_name\";s:24:\"Phần mềm VNPT HIS L3\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:150000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-02-23 15:16:35\";s:10:\"created_by\";N;s:10:\"updated_at\";s:19:\"2026-03-02 00:29:01\";s:10:\"updated_by\";i:9;}i:1;a:13:{s:2:\"id\";i:2;s:12:\"product_code\";s:11:\"SOC_MONITOR\";s:12:\"product_name\";s:26:\"Dịch vụ giám sát SOC\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:2;s:14:\"standard_price\";d:80000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-02-23 15:16:35\";s:10:\"created_by\";N;s:10:\"updated_at\";s:19:\"2026-03-02 06:41:22\";s:10:\"updated_by\";N;}i:2;a:13:{s:2:\"id\";i:3;s:12:\"product_code\";s:8:\"VNPT_LIS\";s:12:\"product_name\";s:21:\"Phần mềm VNPT LIS\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:550000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:04\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:04\";s:10:\"updated_by\";i:9;}i:3;a:13:{s:2:\"id\";i:4;s:12:\"product_code\";s:12:\"VNPT_RISPACS\";s:12:\"product_name\";s:26:\"Phần mềm VNPT RIS-PACS\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:100000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:04\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:04\";s:10:\"updated_by\";i:9;}i:4;a:13:{s:2:\"id\";i:5;s:12:\"product_code\";s:8:\"VNPT_EMR\";s:12:\"product_name\";s:36:\"Phần mềm Bệnh án điện tử\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:100000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"updated_by\";i:9;}i:5;a:13:{s:2:\"id\";i:6;s:12:\"product_code\";s:9:\"VNPT_HMIS\";s:12:\"product_name\";s:17:\"Phần mềm HMIS\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:990000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"updated_by\";i:9;}i:6;a:13:{s:2:\"id\";i:7;s:12:\"product_code\";s:9:\"VNPT_HIS2\";s:12:\"product_name\";s:24:\"Phần mềm VNPT HIS L2\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:100000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"updated_by\";i:9;}i:7;a:13:{s:2:\"id\";i:8;s:12:\"product_code\";s:9:\"VNPT_HIS4\";s:12:\"product_name\";s:25:\"Phần mềm VNPT HIS 4.0\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:100000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"updated_by\";i:9;}i:8;a:13:{s:2:\"id\";i:9;s:12:\"product_code\";s:8:\"VNPT_CKS\";s:12:\"product_name\";s:22:\"Chữ ký số SmartCA\";s:9:\"domain_id\";i:3;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:100000000;s:4:\"unit\";N;s:11:\"description\";N;s:9:\"is_active\";b:1;s:10:\"created_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"created_by\";i:9;s:10:\"updated_at\";s:19:\"2026-03-02 09:13:05\";s:10:\"updated_by\";i:9;}}',1772938329),('vnpt-business-management-cache-v5:support-requests:kpi:0d6c1a75590e4f0c83286279a57b48c0','a:6:{s:14:\"total_requests\";i:189;s:9:\"new_count\";i:51;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:27;s:21:\"approaching_due_count\";i:3;s:13:\"overdue_count\";i:73;}',1772807925),('vnpt-business-management-cache-v5:support-requests:kpi:3529d34b863b43bd77a5667282e92178','a:6:{s:14:\"total_requests\";i:189;s:9:\"new_count\";i:51;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:27;s:21:\"approaching_due_count\";i:3;s:13:\"overdue_count\";i:73;}',1772896194);
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
  `cache_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'VD: perm:123',
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
  `key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
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
-- Dumping data for table `contracts`
--

LOCK TABLES `contracts` WRITE;
/*!40000 ALTER TABLE `contracts` DISABLE KEYS */;
INSERT INTO `contracts` VALUES (1,'HD001','Hợp đồng triển khai VNPT HIS',1,1,'2026-01-15','2026-01-15','2026-12-31',150000000.00,'DRAFT',2,'2026-02-23 08:16:35',NULL,'2026-02-27 02:49:51',1,NULL,NULL,NULL,0),(2,'HD002','Hợp đồng dịch vụ SOC',2,2,'2026-02-20','2026-02-20','2026-12-20',80000000.00,'SIGNED',2,'2026-02-23 08:16:35',NULL,'2026-02-27 02:49:40',1,NULL,NULL,NULL,0),(3,'HĐ001','Tên Hợp đồng 001',98,16,'2026-03-01',NULL,'2027-05-31',0.00,'DRAFT',NULL,'2026-03-01 10:23:32',1,'2026-02-28 21:44:41',1,NULL,NULL,NULL,0);
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
  `full_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_of_birth` date DEFAULT NULL,
  `position_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `position_id` bigint unsigned DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
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
-- Dumping data for table `customer_personnel`
--

LOCK TABLES `customer_personnel` WRITE;
/*!40000 ALTER TABLE `customer_personnel` DISABLE KEYS */;
INSERT INTO `customer_personnel` VALUES (1,1,'Nguyễn Văn A','1990-02-10','DAU_MOI',3,'0912345678','nguyenvana@vietcombank.com.vn','ACTIVE','2026-03-01 10:23:32',NULL,'2026-03-02 07:09:31',NULL,NULL),(2,2,'Trần Thị B',NULL,'DAU_MOI',3,'0987654321','tranthib@petrolimex.com.vn','ACTIVE','2026-03-01 10:23:32',NULL,'2026-03-02 07:09:31',NULL,NULL),(3,3,'Hồ Sơn Tùng','1988-10-20','DAU_MOI',3,'0900000003','contact.93007@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(4,4,'Nguyễn Minh Tuấn','1999-12-12','DAU_MOI',3,'0900000004','tuanmn.93008@gmail.com','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(5,5,'Đầu mối Bệnh viện Phổi Hậu Giang',NULL,'DAU_MOI',3,'0900000005','contact.93100@vnpt.local','ACTIVE','2026-03-01 10:23:32',NULL,'2026-03-02 07:09:31',NULL,NULL),(6,6,'Đầu mối Trung tâm Y tế khu vực Vị Thủy','1997-09-07','DAU_MOI',3,'0900000006','dunv@gmail.com','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(7,7,'Đầu mối Trung tâm Y tế khu vực Long Mỹ',NULL,'DAU_MOI',3,'0900000007','contact.93003@vnpt.local','ACTIVE','2026-03-01 10:23:32',NULL,'2026-03-02 07:09:31',NULL,NULL),(8,8,'Đầu mối Trung tâm Y tế khu vực Phụng Hiệp',NULL,'DAU_MOI',3,'0900000008','contact.93004@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(9,9,'Đầu mối Phòng khám đa khoa KV Kinh Cùng',NULL,'DAU_MOI',3,'0900000009','contact.93089@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(10,10,'Đầu mối Phòng khám đa khoa KV Búng Tàu',NULL,'DAU_MOI',3,'0900000010','contact.93090@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(11,11,'Đầu mối Trung tâm Y tế Thành phố Ngã Bảy',NULL,'DAU_MOI',3,'0900000011','contact.93108@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(12,12,'Đầu mối Trung tâm Y tế Khu vực Châu Thành',NULL,'DAU_MOI',3,'0900000012','contact.93005@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(13,13,'Đầu mối Trung tâm Y tế khu vực Châu Thành A',NULL,'DAU_MOI',3,'0900000013','contact.93006@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(14,14,'Đầu mối Bệnh viện đa khoa khu vực Ngã Bảy',NULL,'DAU_MOI',3,'0900000014','contact.93016@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(15,15,'Đầu mối Trung tâm Y tế Huyện Long Mỹ',NULL,'DAU_MOI',3,'0900000015','contact.93078@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(16,16,'Đầu mối TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang',NULL,'DAU_MOI',3,'0900000016','contact.93105@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(17,17,'Đầu mối Phòng khám đa khoa Thiên Tâm',NULL,'DAU_MOI',3,'0900000017','contact.93106@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(18,18,'Đầu mối Phòng khám đa khoa CARE MEDIC CẦN THƠ',NULL,'DAU_MOI',3,'0900000018','contact.93107@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(19,19,'Đầu mối Phòng khám đa khoa thuộc Trung tâm Y tế thành phố Vị Thanh',NULL,'DAU_MOI',3,'0900000019','contact.93109@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(20,20,'Đầu mối PHÒNG KHÁM ĐA KHOA TÂM AN',NULL,'DAU_MOI',3,'0900000020','contact.93122@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(21,21,'Đầu mối Phòng khám đa khoa Medic Tây Đô',NULL,'DAU_MOI',3,'0900000021','contact.93129@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(22,22,'Đầu mối Phòng khám đa khoa Tâm Phúc Cần Thơ',NULL,'DAU_MOI',3,'0900000022','contact.93130@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(23,23,'Đầu mối TTYT Dự phòng Tỉnh Hậu Giang',NULL,'DAU_MOI',3,'0900000023','contact.93457@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(24,24,'Đầu mối Trạm y tế xã Vị Thủy',NULL,'DAU_MOI',3,'0900000024','contact.93048@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(25,25,'Đầu mối Trạm Y tế Xã Vị Trung',NULL,'DAU_MOI',3,'0900000025','contact.93049@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(26,26,'Đầu mối Trạm Y tế Xã Vị Thủy',NULL,'DAU_MOI',3,'0900000026','contact.93050@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(27,27,'Đầu mối Trạm Y tế Xã Vị Thắng',NULL,'DAU_MOI',3,'0900000027','contact.93051@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(28,28,'Đầu mối Trạm y tế xã Vĩnh Thuận Đông',NULL,'DAU_MOI',3,'0900000028','contact.93052@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(29,29,'Đầu mối Trạm Y tế Xã Vĩnh Trung',NULL,'DAU_MOI',3,'0900000029','contact.93053@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(30,30,'Đầu mối Trạm y tế xã Vĩnh Tường',NULL,'DAU_MOI',3,'0900000030','contact.93054@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(31,31,'Đầu mối Trạm Y tế Xã Vị Đông',NULL,'DAU_MOI',3,'0900000031','contact.93055@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(32,32,'Đầu mối Trạm Y tế Xã Vị Bình',NULL,'DAU_MOI',3,'0900000032','contact.93057@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(33,33,'Đầu mối Trạm y tế xã Vị Thanh 1',NULL,'DAU_MOI',3,'0900000033','contact.93080@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(34,34,'Đầu mối Trạm Y tế phường Long Bình',NULL,'DAU_MOI',3,'0900000034','contact.93019@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(35,35,'Đầu mối TYT P. Thuận An (TYT TT Long Mỹ)',NULL,'DAU_MOI',3,'0900000035','contact.93058@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(36,36,'Đầu mối Trạm Y tế Xã Long Bình',NULL,'DAU_MOI',3,'0900000036','contact.93059@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(37,37,'Đầu mối Trạm Y tế Xã Long Trị',NULL,'DAU_MOI',3,'0900000037','contact.93060@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(38,38,'Đầu mối Trạm Y tế phường Long Phú 1',NULL,'DAU_MOI',3,'0900000038','contact.93061@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(39,39,'Đầu mối Trạm Y tế Xã Thuận Hưng',NULL,'DAU_MOI',3,'0900000039','contact.93062@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(40,40,'Đầu mối Trạm Y tế Xã Vĩnh Viễn',NULL,'DAU_MOI',3,'0900000040','contact.93064@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(41,41,'Đầu mối Trạm Y tế Xã Lương Tâm',NULL,'DAU_MOI',3,'0900000041','contact.93065@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(42,42,'Đầu mối Trạm Y tế xã Xà Phiên',NULL,'DAU_MOI',3,'0900000042','contact.93066@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(43,43,'Đầu mối Trạm y tế phường Trà Lồng',NULL,'DAU_MOI',3,'0900000043','contact.93092@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(44,44,'Đầu mối Trạm Y tế Thị trấn Trà Lồng',NULL,'DAU_MOI',3,'0900000044','contact.93093@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(45,45,'Đầu mối Trạm Y tế Xã Tân Phú',NULL,'DAU_MOI',3,'0900000045','contact.93094@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(46,46,'Đầu mối Trạm y tế xã Thuận Hòa',NULL,'DAU_MOI',3,'0900000046','contact.93095@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(47,47,'Đầu mối Trạm Y tế Xã Vĩnh Viễn A',NULL,'DAU_MOI',3,'0900000047','contact.93096@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(48,48,'Đầu mối Trạm Y tế phường Long Mỹ',NULL,'DAU_MOI',3,'0900000048','contact.93097@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(49,49,'Đầu mối Trạm Y tế Xã Lương Nghĩa',NULL,'DAU_MOI',3,'0900000049','contact.93098@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(50,50,'Đầu mối TYT phường Bình Thạnh',NULL,'DAU_MOI',3,'0900000050','contact.93104@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(51,51,'Đầu mối Trạm Y tế Thị trấn Cây Dương',NULL,'DAU_MOI',3,'0900000051','contact.93035@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(52,52,'Đầu mối Trạm Y tế Xã Tân Bình',NULL,'DAU_MOI',3,'0900000052','contact.93036@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(53,53,'Đầu mối Trạm Y tế Xã Bình Thành',NULL,'DAU_MOI',3,'0900000053','contact.93037@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(54,54,'Đầu mối Trạm Y tế Xã Thạnh Hòa',NULL,'DAU_MOI',3,'0900000054','contact.93038@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(55,55,'Đầu mối Trạm Y tế Xã Long Thạnh',NULL,'DAU_MOI',3,'0900000055','contact.93039@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(56,56,'Đầu mối Trạm Y tế Xã Phụng Hiệp',NULL,'DAU_MOI',3,'0900000056','contact.93040@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(57,57,'Đầu mối Trạm Y tế Xã Hòa Mỹ',NULL,'DAU_MOI',3,'0900000057','contact.93041@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(58,58,'Đầu mối Trạm Y tế Xã Hòa An',NULL,'DAU_MOI',3,'0900000058','contact.93042@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(59,59,'Đầu mối Trạm Y tế Xã Phương Bình',NULL,'DAU_MOI',3,'0900000059','contact.93043@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(60,60,'Đầu mối Trạm Y tế Xã Hiệp Hưng',NULL,'DAU_MOI',3,'0900000060','contact.93044@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(61,61,'Đầu mối Trạm Y tế Xã Tân Phước Hưng',NULL,'DAU_MOI',3,'0900000061','contact.93045@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(62,62,'Đầu mối Trạm Y tế Xã Phương Phú',NULL,'DAU_MOI',3,'0900000062','contact.93046@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(63,63,'Đầu mối Trạm Y tế Xã Tân Long',NULL,'DAU_MOI',3,'0900000063','contact.93047@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(64,64,'Đầu mối Trạm Y tế Phường Ngã Bảy',NULL,'DAU_MOI',3,'0900000064','contact.93067@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(65,65,'Đầu mối Trạm Y tế Xã Đại Thành',NULL,'DAU_MOI',3,'0900000065','contact.93071@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(66,66,'Đầu mối Trạm Y tế Thị trấn Ngã Sáu',NULL,'DAU_MOI',3,'0900000066','contact.93026@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(67,67,'Đầu mối Trạm Y tế xã Đông Phước',NULL,'DAU_MOI',3,'0900000067','contact.93027@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(68,68,'Đầu mối Trạm Y tế Xã Phú An',NULL,'DAU_MOI',3,'0900000068','contact.93028@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(69,69,'Đầu mối Trạm Y tế Xã Đông Phú',NULL,'DAU_MOI',3,'0900000069','contact.93029@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(70,70,'Đầu mối Trạm Y tế Xã Phú Hữu',NULL,'DAU_MOI',3,'0900000070','contact.93030@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(71,71,'Đầu mối Trạm Y tế xã Châu Thành',NULL,'DAU_MOI',3,'0900000071','contact.93031@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(72,72,'Đầu mối Trạm Y tế Xã Đông Phước',NULL,'DAU_MOI',3,'0900000072','contact.93032@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(73,73,'Đầu mối Trạm Y tế Xã Đông Phước A',NULL,'DAU_MOI',3,'0900000073','contact.93033@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(74,74,'Đầu mối Phòng khám đa khoa KV Phú Tân',NULL,'DAU_MOI',3,'0900000074','contact.93087@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(75,75,'Đầu mối Trạm Y tế Thị trấn Một Ngàn',NULL,'DAU_MOI',3,'0900000075','contact.93018@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(76,76,'Đầu mối Trạm Y tế Trường Long Tây',NULL,'DAU_MOI',3,'0900000076','contact.93020@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(77,77,'Đầu mối Trạm Y tế Xã Tân Hòa',NULL,'DAU_MOI',3,'0900000077','contact.93022@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(78,78,'Đầu mối Trạm Y tế Xã Nhơn Nghĩa A',NULL,'DAU_MOI',3,'0900000078','contact.93023@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(79,79,'Đầu mối Trạm Y tế Xã Thạnh Xuân',NULL,'DAU_MOI',3,'0900000079','contact.93024@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(80,80,'Đầu mối Trạm Y tế Xã Tân Phú Thạnh',NULL,'DAU_MOI',3,'0900000080','contact.93025@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(81,81,'Đầu mối Trạm Y tế Bảy Ngàn',NULL,'DAU_MOI',3,'0900000081','contact.93073@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(82,82,'Đầu mối Trạm y tế thị trấn Rạch Gòi',NULL,'DAU_MOI',3,'0900000082','contact.93083@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(83,83,'Đầu mối Trạm y tế thị trấn Cái Tắc',NULL,'DAU_MOI',3,'0900000083','contact.93084@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(84,84,'Đầu mối Trạm Y tế Xã Trường Long A',NULL,'DAU_MOI',3,'0900000084','contact.93086@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(85,85,'Đầu mối Trạm Y tế Xã Vĩnh Thuận Đông',NULL,'DAU_MOI',3,'0900000085','contact.93063@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(86,86,'Đầu mối YTCQ Cty TNHH Lộc Tài II',NULL,'DAU_MOI',3,'0900000086','contact.93101@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(87,87,'Đầu mối Trạm Y tế Phường Lái Hiếu',NULL,'DAU_MOI',3,'0900000087','contact.93068@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(88,88,'Đầu mối Trạm Y tế Phường Hiệp Thành',NULL,'DAU_MOI',3,'0900000088','contact.93069@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(89,89,'Đầu mối Trạm Y tế Xã Hiệp Lợi',NULL,'DAU_MOI',3,'0900000089','contact.93070@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(90,90,'Đầu mối Trạm Y tế Xã Tân Thành',NULL,'DAU_MOI',3,'0900000090','contact.93072@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(91,91,'Đầu mối Trạm y tế phường Vị Thanh',NULL,'DAU_MOI',3,'0900000091','contact.93009@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(92,92,'Đầu mối Trạm Y tế Phường III',NULL,'DAU_MOI',3,'0900000092','contact.93010@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(93,93,'Đầu mối Trạm Y tế Phường IV',NULL,'DAU_MOI',3,'0900000093','contact.93011@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(94,94,'Đầu mối Trạm Y tế Phường V',NULL,'DAU_MOI',3,'0900000094','contact.93012@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(95,95,'Đầu mối Trạm Y tế Phường VII',NULL,'DAU_MOI',3,'0900000095','contact.93013@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(96,96,'Đầu mối Trạm Y tế Phường Vị Tân',NULL,'DAU_MOI',3,'0900000096','contact.93014@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(97,97,'Đầu mối Trạm Y tế Xã Hỏa Lựu',NULL,'DAU_MOI',3,'0900000097','contact.93015@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(98,98,'Đầu mối Trạm Y tế Xã Hỏa Tiế渁',NULL,'DAU_MOI',3,'0900000098','contact.93017@vnpt.local','ACTIVE','2026-02-25 10:33:20',NULL,'2026-03-02 07:09:31',NULL,NULL),(130,1,'Smoke Personnel SEC',NULL,'DAU_MOI',3,'0900009999',NULL,'ACTIVE','2026-03-04 05:11:46',NULL,'2026-03-04 05:12:02',NULL,'2026-03-04 05:12:02');
/*!40000 ALTER TABLE `customer_personnel` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `customer_requests`
--

LOCK TABLES `customer_requests` WRITE;
/*!40000 ALTER TABLE `customer_requests` DISABLE KEYS */;
INSERT INTO `customer_requests` VALUES (3,'2c623bae-2fec-4fa3-9bb3-1d2736d8b4b3','YC03033',1,'SMOKE HUB CREATE 20260303_235453 UPDATED',1,'Smoke User',1,1,1,1,1,1,1,'MOI_TIEP_NHAN',NULL,'MEDIUM','2026-03-03',3,'SMK-235453',NULL,'{\"smoke\": true}','Smoke test update','2026-03-03 16:54:53',1,'2026-03-03 16:54:53',1,'2026-03-03 16:54:53'),(4,'e92f8ac3-0f0d-4666-9d4e-dca4213e46a0','YC03034',1,'N/A',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MOI_TIEP_NHAN',NULL,'MEDIUM','2026-03-03',4,NULL,NULL,'[]','Smoke import row','2026-03-03 16:54:53',1,'2026-03-03 16:54:53',1,'2026-03-03 16:54:53'),(5,'26d7f2f7-faf0-422d-bd38-2a8b072640ff','YC03045',1,'aaaaaaaaa',35,'Đầu mối TYT P. Thuận An (TYT TT Long Mỹ)',35,6,97,97,2,18,NULL,'MOI_TIEP_NHAN',NULL,'URGENT','2026-03-04',5,NULL,NULL,NULL,NULL,'2026-03-04 07:39:30',9,'2026-03-04 14:39:30',9,NULL),(6,'6b4de585-fc2c-49bb-9d89-01acfcedaeed','YC03046',13,'bbbbbbbbbbbbbbbbbbbbb',50,'Đầu mối TYT phường Bình Thạnh',50,NULL,98,96,2,18,NULL,'LAP_TRINH','TAM_NGUNG','MEDIUM','2026-03-04',12,NULL,NULL,'{\"progress\": 15, \"pause_date\": \"05/03/2026\", \"pause_reason\": \"Tạm ngưng do bệnh cá nhân 1\"}',NULL,'2026-03-04 07:40:41',9,'2026-03-05 03:16:14',9,NULL),(7,'63d065f0-fe8b-45ef-98b6-e6400e1293aa','YC03047',12,'aaaaaaaaaaaaaaacccccccccccccccc',35,'Đầu mối TYT P. Thuận An (TYT TT Long Mỹ)',35,4,97,97,2,18,NULL,'LAP_TRINH','UPCODE','HIGH','2026-03-04',11,NULL,NULL,'{\"upcode_date\": \"2026-03-05\", \"upcode_status\": \"SUCCESS\", \"completion_date\": \"2026-03-04\"}',NULL,'2026-03-04 07:43:54',9,'2026-03-05 03:11:38',9,NULL),(8,'2b41d8b3-5533-43a8-9124-a8610f6d1871','YC03058',3,'Lỗi LIS',16,'Đầu mối TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang',16,6,131,98,1,23,51,'DANG_XU_LY',NULL,'MEDIUM','2026-03-05',15,'YC03032457493',2457493,NULL,NULL,'2026-03-05 00:52:17',9,'2026-03-05 07:57:16',9,NULL),(10,'4346bf2f-6cc5-42c2-ad5c-933799cd7d4c','YC030810',1,'Lỗi rồi -upfile',3,'Hồ Sơn Tùng',3,4,140,95,3,9,NULL,'MOI_TIEP_NHAN',NULL,'MEDIUM','2026-03-08',21,NULL,NULL,NULL,NULL,'2026-03-08 03:06:27',9,'2026-03-09 13:38:13',9,NULL),(11,'3b5dbbc2-2ecb-4cc5-8989-1a89c40a7464','YC030811',1,'Lỗi hệ thống',3,NULL,NULL,4,140,95,3,9,NULL,'MOI_TIEP_NHAN',NULL,'MEDIUM','2026-03-08',19,NULL,NULL,NULL,NULL,'2026-03-08 05:15:07',9,'2026-03-09 12:15:15',9,NULL);
/*!40000 ALTER TABLE `customer_requests` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'KH001','Ngân hàng Vietcombank','0100112437','198 Trần Quang Khải, Hoàn Kiếm, Hà Nội',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'KH002','Tập đoàn Petrolimex','0100107370','Số 1 Khâm Thiên, Đống Đa, Hà Nội',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(3,'93007','Bệnh viện Sản - Nhi Hậu Giang','0101234567',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(4,'93008','Bệnh viện Tâm thần - Da liễu Hậu Giang','0109876543',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(5,'93100','Bệnh viện Phổi Hậu Giang','0118518519',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(6,'93002','Trung tâm Y tế khu vực Vị Thủy','0127160495','Số 02 Nguyễn Trãi',1,'2026-02-25 01:03:51',NULL,'2026-02-26 20:27:32',1,NULL),(7,'93003','Trung tâm Y tế khu vực Long Mỹ','0135802471',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(8,'93004','Trung tâm Y tế khu vực Phụng Hiệp','0144444447',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(9,'93089','Phòng khám đa khoa KV Kinh Cùng','0153086423',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(10,'93090','Phòng khám đa khoa KV Búng Tàu','0161728399',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(11,'93108','Trung tâm Y tế Thành phố Ngã Bảy','0170370375',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(12,'93005','Trung tâm Y tế Khu vực Châu Thành','0179012351',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(13,'93006','Trung tâm Y tế khu vực Châu Thành A','0187654327',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(14,'93016','Bệnh viện đa khoa khu vực Ngã Bảy','0196296303',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(15,'93078','Trung tâm Y tế Huyện Long Mỹ','0204938279',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(16,'93105','TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang','0213580255',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(17,'93106','Phòng khám đa khoa Thiên Tâm','0222222231',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(18,'93107','Phòng khám đa khoa CARE MEDIC CẦN THƠ','0230864207',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(19,'93109','Phòng khám đa khoa thuộc Trung tâm Y tế thành phố Vị Thanh','0239506183',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL,NULL),(20,'93122','PHÒNG KHÁM ĐA KHOA TÂM AN','0248148159',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(21,'93129','Phòng khám đa khoa Medic Tây Đô','0256790135',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(22,'93130','Phòng khám đa khoa Tâm Phúc Cần Thơ','0265432111',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(23,'93457','TTYT Dự phòng Tỉnh Hậu Giang','0274074087',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(24,'93048','Trạm y tế xã Vị Thủy','0282716063',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(25,'93049','Trạm Y tế Xã Vị Trung','0291358039',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(26,'93050','Trạm Y tế Xã Vị Thủy','0300000015',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(27,'93051','Trạm Y tế Xã Vị Thắng','0308641991',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(28,'93052','Trạm y tế xã Vĩnh Thuận Đông','0317283967',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(29,'93053','Trạm Y tế Xã Vĩnh Trung','0325925943',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(30,'93054','Trạm y tế xã Vĩnh Tường','0334567919',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(31,'93055','Trạm Y tế Xã Vị Đông','0343209895',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(32,'93057','Trạm Y tế Xã Vị Bình','0351851871',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(33,'93080','Trạm y tế xã Vị Thanh 1','0360493847',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(34,'93019','Trạm Y tế phường Long Bình','0369135823',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(35,'93058','TYT P. Thuận An (TYT TT Long Mỹ)','0377777799',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(36,'93059','Trạm Y tế Xã Long Bình','0386419775',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(37,'93060','Trạm Y tế Xã Long Trị','0395061751',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(38,'93061','Trạm Y tế phường Long Phú 1','0403703727',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(39,'93062','Trạm Y tế Xã Thuận Hưng','0412345703',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(40,'93064','Trạm Y tế Xã Vĩnh Viễn','0420987679',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(41,'93065','Trạm Y tế Xã Lương Tâm','0429629655',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(42,'93066','Trạm Y tế xã Xà Phiên','0438271631',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(43,'93092','Trạm y tế phường Trà Lồng','0446913607',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(44,'93093','Trạm Y tế Thị trấn Trà Lồng','0455555583',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(45,'93094','Trạm Y tế Xã Tân Phú','0464197559',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(46,'93095','Trạm y tế xã Thuận Hòa','0472839535',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(47,'93096','Trạm Y tế Xã Vĩnh Viễn A','0481481511',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(48,'93097','Trạm Y tế phường Long Mỹ','0490123487',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(49,'93098','Trạm Y tế Xã Lương Nghĩa','0498765463',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(50,'93104','TYT phường Bình Thạnh','0507407439',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(51,'93035','Trạm Y tế Thị trấn Cây Dương','0516049415',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(52,'93036','Trạm Y tế Xã Tân Bình','0524691391',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(53,'93037','Trạm Y tế Xã Bình Thành','0533333367',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(54,'93038','Trạm Y tế Xã Thạnh Hòa','0541975343',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(55,'93039','Trạm Y tế Xã Long Thạnh','0550617319',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(56,'93040','Trạm Y tế Xã Phụng Hiệp','0559259295',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(57,'93041','Trạm Y tế Xã Hòa Mỹ','0567901271',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(58,'93042','Trạm Y tế Xã Hòa An','0576543247',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(59,'93043','Trạm Y tế Xã Phương Bình','0585185223',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(60,'93044','Trạm Y tế Xã Hiệp Hưng','0593827199',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(61,'93045','Trạm Y tế Xã Tân Phước Hưng','0602469175',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(62,'93046','Trạm Y tế Xã Phương Phú','0611111151',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(63,'93047','Trạm Y tế Xã Tân Long','0619753127',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(64,'93067','Trạm Y tế Phường Ngã Bảy','0628395103',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(65,'93071','Trạm Y tế Xã Đại Thành','0637037079',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(66,'93026','Trạm Y tế Thị trấn Ngã Sáu','0645679055',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(67,'93027','Trạm Y tế xã Đông Phước','0654321031',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(68,'93028','Trạm Y tế Xã Phú An','0662963007',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(69,'93029','Trạm Y tế Xã Đông Phú','0671604983',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL,NULL),(70,'93030','Trạm Y tế Xã Phú Hữu','0680246959',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(71,'93031','Trạm Y tế xã Châu Thành','0688888935',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(72,'93032','Trạm Y tế Xã Đông Phước','0697530911',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(73,'93033','Trạm Y tế Xã Đông Phước A','0706172887',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(74,'93087','Phòng khám đa khoa KV Phú Tân','0714814863',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(75,'93018','Trạm Y tế Thị trấn Một Ngàn','0723456839',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(76,'93020','Trạm Y tế Trường Long Tây','0732098815',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(77,'93022','Trạm Y tế Xã Tân Hòa','0740740791',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(78,'93023','Trạm Y tế Xã Nhơn Nghĩa A','0749382767',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(79,'93024','Trạm Y tế Xã Thạnh Xuân',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(80,'93025','Trạm Y tế Xã Tân Phú Thạnh',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(81,'93073','Trạm Y tế Bảy Ngàn',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(82,'93083','Trạm y tế thị trấn Rạch Gòi',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(83,'93084','Trạm y tế thị trấn Cái Tắc',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(84,'93086','Trạm Y tế Xã Trường Long A',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(85,'93063','Trạm Y tế Xã Vĩnh Thuận Đông',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(86,'93101','YTCQ Cty TNHH Lộc Tài II',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(87,'93068','Trạm Y tế Phường Lái Hiếu',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(88,'93069','Trạm Y tế Phường Hiệp Thành',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(89,'93070','Trạm Y tế Xã Hiệp Lợi',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(90,'93072','Trạm Y tế Xã Tân Thành',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(91,'93009','Trạm y tế phường Vị Thanh',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(92,'93010','Trạm Y tế Phường III',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(93,'93011','Trạm Y tế Phường IV',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(94,'93012','Trạm Y tế Phường V',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(95,'93013','Trạm Y tế Phường VII',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(96,'93014','Trạm Y tế Phường Vị Tân',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(97,'93015','Trạm Y tế Xã Hỏa Lựu',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL),(98,'93017','Trạm Y tế Xã Hỏa Tiế渁',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL,NULL);
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
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (1,'9370dd70-10c8-11f1-a6f1-c80ff292045c','TTKDGP','Trung tâm Kinh doanh Giải pháp',4,'1/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-03-01 06:47:46',NULL,NULL),(2,'93742430-10c8-11f1-a6f1-c80ff292045c','PGP2','Phòng giải Pháp 2',1,'1/2/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-03-01 07:09:55',NULL,NULL),(3,'9376de78-10c8-11f1-a6f1-c80ff292045c','TTH','Tổ tổng hợp',1,'1/3/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-03-01 07:12:58',NULL,NULL),(4,'abbbb6be-124b-11f1-a6f1-c80ff292045c','BGĐVT','Ban giám đốc Viễn Thông',NULL,'4/','ACTIVE','2026-02-25 06:12:43',NULL,'2026-02-25 13:12:43',NULL,NULL),(5,'d7cf53ac-1578-11f1-8c5f-24a3c6f67e95','PGP1','Phòng Giải pháp 1',1,'1/5/','ACTIVE','2026-03-01 07:13:38',NULL,'2026-03-01 07:13:38',NULL,NULL),(6,'e161e722-1578-11f1-8c5f-24a3c6f67e95','PKT','Phòng Kế toán',4,'4/6/','ACTIVE','2026-03-01 07:13:54',NULL,'2026-03-01 07:13:54',NULL,NULL);
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `document_product_links`
--

LOCK TABLES `document_product_links` WRITE;
/*!40000 ALTER TABLE `document_product_links` DISABLE KEYS */;
INSERT INTO `document_product_links` VALUES (4,1,1,NULL,'2026-02-25 13:17:00'),(5,2,2,NULL,'2026-02-25 13:17:00'),(7,4,1,1,'2026-02-25 07:18:02');
/*!40000 ALTER TABLE `document_product_links` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `document_types`
--

LOCK TABLES `document_types` WRITE;
/*!40000 ALTER TABLE `document_types` DISABLE KEYS */;
INSERT INTO `document_types` VALUES (1,'DT001','Hợp đồng kinh tế','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'DT002','Biên bản nghiệm thu','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(3,'DT_PRICING','Văn bản giá sản phẩm','2026-02-25 07:18:02',NULL,NULL,NULL);
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
-- Dumping data for table `documents`
--

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
INSERT INTO `documents` VALUES (1,'DOC001','Hợp đồng VNPT HIS - Bản chính',1,1,1,'2026-12-31','ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'DOC002','Biên bản nghiệm thu giai đoạn 1',2,2,2,'2026-09-30','ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(4,'PRC_TEST_1772029082','Văn bản giá test',3,NULL,NULL,'2026-02-25','ACTIVE','2026-02-25 14:18:02',1,'2026-02-26 02:33:29',1,NULL),(5,'SMOKE_DOC_1772626222','Smoke Security Document',1,1,NULL,NULL,'ACTIVE','2026-03-04 12:10:23',9,'2026-03-04 05:11:10',9,'2026-03-04 05:11:10');
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `integration_settings`
--

LOCK TABLES `integration_settings` WRITE;
/*!40000 ALTER TABLE `integration_settings` DISABLE KEYS */;
INSERT INTO `integration_settings` VALUES (1,'GOOGLE_DRIVE',1,30,30,'vnptcto-qlcv@vnpt-business-488523.iam.gserviceaccount.com',NULL,'0ACo8mc678CdLUk9PVA',NULL,NULL,NULL,NULL,'https://www.googleapis.com/auth/drive.file',NULL,'VNPT','eyJpdiI6Ijkza3VmekZXTUNrZDJSN2RIYlJ4RHc9PSIsInZhbHVlIjoia2tRRHFHdEo1NHRjdEx0dFRWQjNtNWt6Qk5MOXR2VWs3b3ZUNkdLTHRBTXF1Mk04c1lLQS8rVXduS044TUZITDlpZ1FsT2NJcWRzVjduVWlJYUhPekhQcHdpQi9sOWhSZ3lYQjhWVnNPa3A0aGIxcTJTNFAxMzNhNGNJNVV1WFpRRFhnNjhvcDJQVTcxQVBNOFBkM2NkMVZIaEZzSDVHc3g2b2RUbnhqVlJrOTR1VTN1S1RVL1hrL2owazhISE4vczFBVVl2ZFo5ZTZuM1gwOXYrVGY1d2FrdG1Ed1BSNC84VGdmMGVtNUxLdFZqY1JDU2svdjZrSHR5My9MS0hGeTExc0R2M0RLQVBhQm5oQzJnTXFqMUF5ckVKSnpmTXRSTFZrMUxGZlZvOE84TGdleHRka0JLQ0F4b2FQU2V5bi9kNHZHMGJ3Wkx5TE9SbGxBRml2NWtsY2Q4ZlcrdVhmVGV6SVRXd2NOU3NjZlRxNlVHaE9WeklIczZFYjhFN1dIRDF1T2kzVkJ2SkhyR2FvOSszdEJvMURLUGx0SGFjejVmdUg2M1oxRlluM2NhU1psM3pGNEExRExObEZOODkwVFdwdzVnUGpoekpYMHcyc1ZISGlGY29sNzA4ME5oQzBvajVxZTE4aVFEbjJjcFZ5RmdhZHJuemROeWVENzJua3g1WkdPamlPVk1HbjVCU3dZbStiZ0VIRC8rdFQwZlB5OEdyMWFYUzc0TUljRmIwQyt6Vk1EME1Wam92QzFjcVMrWkVuRjkrRXBWU3MxVERWdE91c3QzaUs5cTVCRG9qTDlpVDdSbCtyL1JCNDk0VnRuWXV6elBZekJUV3czQ2JDZGxWY1pLT1Vub0c5bGZNTkVpN2hnUzlXVXFjT0pYekwxckFmbE52MTJZY2Rrcy9Qb0JwaDRuQ0Rwa0l2S1hCRk9IcWVWSjJLNi9KZmVzdmZoNVRNdG0yY3kveXlCS3UxY2trRjBBcm0xSS9oZ3J5WXY5Sll2WENMT1psWThUMlZzcSsvWWV6ZDlxZm43TWRrWTFvTXJnRjN1cGduMmcxSFF6eFZKS1pvZFVUVDRLblVIM0RlQXExOFd5bE1TcnBpdk9xRFNUcnJpaFpoa0FMNFEyQkVyL1lqY0RmWXJMWlJrMjlSVXFGTGdybEw4SHYvL2dEZFA1OHJGSTY2ZEw0bGpkKzcreUxrVUg3MmRtOXdyUWxsT1lUaDhrL3M1M1d0cUNvNUkyOTkvME1BUGNEV0lrWGMxcGdaTG5ERXBnUVpOUHdEalhYMy8xei9SaWJIN1h3S2FDVDhuLzRPNU9KRWdRenN5bWJ3UEVBRWFkNnF4cFRRVFBFdzhFZzQ5Ti8yT0xTMm93M2xHZFo0TVB5VTdiVTRuOXp2OXNLZ0oxOG1qZ0pWR3o3bzdTTy9BV1ZGeDY2OThzSkdGZXR6MHl6eEVta3I4WWl4WkRYOFRqYUJNOGUwY0ZlQ0ZiQ0FML08rR09kTWs5TzYvblZWZUEvbDRJbGIzQUR4cU1yQXQxYmNCckhQNkRYZXVEUi8yWGhTaDZEWFRCQnZzWGwwbEV1WUtPOUdJaDVwTVJFOU9tNUsrVW9YMkVENnFWVjBxZnlubG1PZnJMNGhVNXBMWmx0bmgyN0c1R1hRRmZNOWg4Ukh2M2JNME9ubTFqZyt4bkk2ZkM5UzlYaU5Iei9BOTkrbWFaakZDVlRKNHNQbk5CZkFxRXF6bTNObk81ZVk0UXIvbytmejhWYkp1UW9pSk03Y0RMMmZWNnlWNy9zTkhicjRmMnJmdmpSc0crQ2VFdldjaEFGaG5xK0ZYamVweUl5TENHK2dNMUtRMlFkRU9DVjU5Mmh0THkwNUVOTmluMEZCN2xBbDNEZWdHclhiQVRGdzFZQUFPSTIvNXZIQjBSeDhEOHFuKzRWWTNGa0xMYnROeEVTWDl2dmxaL2pac25hQjVLZkV6R0p4RTg2eUZOVmhQb3FyaU9oYWVxZXhQSW5ET3dxbDZQWDVsWjVXTStsNytFY2sxeGpjZDhnNTA0UlRXRWFZNmJBYkhqdHAyNitMRzgxb28xUVZIbE1xWFJTNDVnckFwZTJKeUtCdnh0cTN1WWRjQjZUeEt1bUFocDd4M2sxUllxano5TkxjbzNKMmU2V0Q4TDExaDVFMll3T3dhbnl4ekM2ZlpwdXRLN3NNbU1xU2JkR3FzQVJkVFB2cTVJcnVxM3UwUjFOdlJNYklOOEpKTjdEa2Q2K1djcm11WFFTRWFBaWV5RWR5SFNyYkdrbm8reExmNUd6alRvY0RzVDZMOVlJWG1PNytNd3dXWEllMXFETytKdjVEQzJxYkFveFcyZnhXWU85QkVxWUNBVXRCVHJHOUxKd3FBdG9tRWRzOHJDbkFoQ2NXd0JQY0UwK3FkN0pzeUdTM25LRTNDdFhJM0tXSmJ6bDk4ZnhVRlFabTFEcXZMNVpCbXV4d3JPb2gvek9UTWlWNHJnQ2hoalJzNEkyVEpZUllXQVpJL2NzZnJPRVVhNlhtK2lzcEROWWVsVC9QUThQcytodjU3Z0MyYUE3cHpITTFLdDZBLzNPNklpZmlVQ1Z4bjFaa09HS3FkTEVaV3dyN2liTWxEYXVObDBpSWVod0hPeFFQQnZLb1NzV0ZWcWovU2ZEVFE3UERYUXN3emdGSVUvQkpYTE9mWGtaRlNyUWJHVG5Ic3BncHc2dDI2MWRYL2s5d3NJb2JQY1pQalZlMEVSU0gwTWlFakJyZWcvTDd3QjNjaksrMWg2eEtOclBZeEdiSWgvaitOYmFYZ2doSGZ1aFJaZHRVa0JDMUIzM3dTSWZPL1h3MkY3bTFXU2d5a29NcEppNVpFWGN1VXpzWEtKZVhlTFk2dXhqZC9IRHBoZXpJcXM1dm4wWmpZK0syYkc3VXJwZDcwbGVJcDliV3ppVGdUcmtsUEpEcWFVZjVSMnJpSmthSTlObTBRaGFidFFYYzltZFBLQkpWNU9XbWFtTVlBK3AxTnpRSmRhZkozclZXajExTThTMzM5b2Q0U3RDUXRHNjBBOUNnajV0NUdORDkvejczOUUyN1h1VmNQL21HWm5UYnQ3aGFjMVIzUi9KTE8xdjVGbkFCbWZnRHlHNVZRRUhzY2QyM3FOVFMyc3p0bk1yZUJ3SWkrZDgrYWgwYzQvUXZBRnZQQ3pMZGZIMGZyNnVucVRqMGNHMjhYMFg0UTlpQS8yZm5RQWNqT05CSWxpUDlFdWxxNFAvSFJuYXFWaFlmTG8rWVBiWHpxTDFHK1VLQ3kzWDBWR1BZN0ZLUDd5blFuaFVpR3B4V2ZOaEZrUUhid045c2lDR0NiOXpTY1dBeDhOQk9VVXJlanpMQjdydWRnRW9FdmJpa3VmUVBnK2trbWpkcFRqN2FBeDBNQ2JYOG4zOUkvMXMyQ0U1NUV5UnFLalJOUUViZkVzRFdxUk50clRGaHlmdklHM1NtcGtYMURIc1QzbkRTV2Rhd1gvR2lxYXB2SktxZjVGOUxoK0RkUTd5R001NGluKzEydkZiK3BpUDlXNkx3NFphaUJ2ZjdLdlB6Z2sybTRaTlBmSEF1ZEI0OHc1ZnA5WWtELzBWcDRSY0ZBRWJlZEo2dHJmQlF3R21XcVVNL08yNzMreXJKdXZGMXQwZE5sYjY4QTcvenpuMDkrbWJrNXJuanVvcGhQYmZsd25jQkdvcngvTCtjcnJFWWdGNjU4dVAyNnMrSDBKWFgzOEZad0podXEyUGRCUTYwcEg3eWlPcTMxd3UzTUcvZm5ETFBOS2JhZWFRa2RVdjRFdUxRTFNWRUMyUmJnWUVocHdoM0xkVGptbWxsMGFBaFVEZ1Z2RUJVdGJDU2tHTzNET3VXY25UNEpBTVZXK2Q5SHE3RUE5Z3VHRmlLdEcrNWEyeXpnMHdHRCt3ZWk5Tlk5THN4a2I1VnY1VGxscllqSElySzBwTWxzTFJDbjZzb2NLU3Q1RVJKNkMxN0VBOVRrRlMxZy9PYWdUVkU5bUFYcnBibC8wMmkrOVh1TkpYOFdRNDA0Tm1qR2dRU0FuKzk5MVBsdUxoOWpDanZ6YUFRUWd3bFY4aldDb2J0REpOaUJSQmY4V3N1RlZqM1RVTXYzallBVnpmMFFhVE4yVlFvWU5GND0iLCJtYWMiOiI0ZmMxZWY2ZDNmZDcxZTUwNmEyZTJiZTc2ZTM5ZDU5MWRhNDY5NGMwYWI4NTY0YWUxOWZjMmJkOGUzYjJiMGQ3IiwidGFnIjoiIn0=',NULL,'2026-03-08 07:13:22','FAILED','Google Drive không tìm thấy thư mục đích. Hãy kiểm tra lại Folder ID và quyền chia sẻ cho Service Account.',NULL,9,'2026-02-25 15:58:39','2026-03-08 07:13:22'),(2,'CONTRACT_ALERT',1,30,30,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-27 00:25:47','2026-02-27 00:25:47'),(3,'CONTRACT_PAYMENT_ALERT',1,NULL,30,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-27 01:09:34','2026-02-27 01:09:34'),(4,'BACKBLAZE_B2',1,NULL,NULL,NULL,'00438a9b40088580000000005',NULL,'upload-storage-app','93f8ca298bf4d00098c80518','us-west-004','https://s3.us-west-004.backblazeb2.com',NULL,NULL,'VNPT',NULL,'eyJpdiI6IlF1aFF4aS9xNkFvL2ZLVi8yeVVmUFE9PSIsInZhbHVlIjoid0tPZlVZV0FSTVpIUmZicGN5SE5QdVB3MGxlU0laTXV4UkJYSCtPR3FPND0iLCJtYWMiOiJiM2FlZWQ3NWU5ZTJlMzJkODJjMDMwMzQ3OWIwNzMxNzQ0NmIxMDVmYzI2ZDgyNTFjMGM3ZGNkZWFlNDk2NDNhIiwidGFnIjoiIn0=',NULL,NULL,'Cấu hình đã thay đổi. Vui lòng kiểm tra kết nối lại.',NULL,9,'2026-03-08 21:28:17','2026-03-11 02:26:02');
/*!40000 ALTER TABLE `integration_settings` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `internal_users`
--

LOCK TABLES `internal_users` WRITE;
/*!40000 ALTER TABLE `internal_users` DISABLE KEYS */;
INSERT INTO `internal_users` VALUES (1,'5fa8c238-10c2-11f1-a6f1-c80ff292045c','ADMIN001','admin','$2y$12$bL4oXvqPEemRgPC.MBzE8.haF8TAV0UCHAGt0efZwgrbf8/bzAYwW',NULL,'System Admin',NULL,'admin@vnpt.vn',NULL,NULL,NULL,NULL,'INACTIVE',4,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,'2026-03-04 04:54:27',NULL,1,NULL,'2026-03-04 04:54:27'),(7,'619bab6d-d37f-4059-8b10-4fc7adfe767c','VNPT022327','thihq.stg','$2y$12$HliWx5aPfDXAvpio15qyV.mHBbWnPdLTIu8.F7L1EMrofAhOe7ova',NULL,'Hứa Quốc Thi','Phó GĐ phòng Giải pháp','thihq.stg@vnpt.vn',NULL,'1982-11-10','MALE',NULL,'ACTIVE',2,4,'Wifi','NO','2026-03-01 07:44:10',NULL,'2026-03-01 14:50:20',NULL,0,NULL,NULL),(8,'a7b9e45a-d636-439f-b033-745a4d803b54','VNPT022635','minhln.hgi','$2y$12$/4VtnwCQs.j3t/6yI3VYPunn94TatbT/AGAhwBMMx91ii1UjcS2Uu',NULL,'Lê Nhựt Minh','Phó GĐ phòng Giải pháp','minhln.hgi@vnpt.vn',NULL,'1991-06-15','MALE',NULL,'ACTIVE',2,4,NULL,'NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:21',NULL,0,NULL,NULL),(9,'dbdbdd05-d50c-4ec6-84cd-82af25d38fc5','VNPT022600','ropv.hgi','$2y$12$L9yOB2cpE0zNz4LGl.JVCOgjrd8wG53XmJrZJGASwVLxQ/hc36r8a',NULL,'Phan Văn Rở','GĐ phòng Giải pháp','ropv.hgi@vnpt.vn',NULL,'1990-12-29','MALE',NULL,'ACTIVE',2,3,'10.92.22.99','NO','2026-03-01 07:44:11',NULL,'2026-03-10 17:25:53',NULL,0,'2026-03-10 17:25:53',NULL),(10,'5ae7bf97-8424-4656-a486-9085755bb5e6','VNPT022612','traopt.hgi','$2y$12$3vAx5tL5cr71OqLW9JS1Vu9/Bm/awr0PHozUNDRw5Lt81Rg5xf51K',NULL,'Phạm Thanh Trào','Kỹ sư lập trình','traopt.hgi@vnpt.vn',NULL,'1998-04-19','MALE',NULL,'ACTIVE',2,5,'10.92.22.32','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:21',NULL,0,NULL,NULL),(11,'3f6d95e2-588d-453c-b995-1e778b5bc8be','VNPT022609','vupqh.hgi','$2y$12$gPVBym6JiC0r3CMGp4JpKOR0vwJO.rEkgIAcZbq1bkpuY8n8iJt0S',NULL,'Phan Quang Huy Vũ','Kỹ sư lập trình','vupqh.hgi@vnpt.vn',NULL,'1999-01-12','MALE',NULL,'ACTIVE',2,5,'10.99.22.39','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:22',NULL,0,NULL,NULL),(12,'270c22d2-3dc0-4a14-b13d-d1f831754c76','VNPT022608','triph.hgi','$2y$12$SFrtGoBaP3ZkOZezCO09DOEAa1ci3txYLW0yjHJ2U1CHZ/M2SwzXe',NULL,'Phạm Hữu Trí','Kỹ sư lập trình','triph.hgi@vnpt.vn',NULL,'2000-01-18','MALE',NULL,'ACTIVE',2,5,'10.92.22.34','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:22',NULL,0,NULL,NULL),(13,'97ea5c08-b27b-4c06-b730-0563e1d93faf','VNPT022606','kinhng.hgi','$2y$12$a/oeWjj1qTpC/w16PxSQj.gSpbTX0bAPUEXNkAOjwXVC4RugvzzHG',NULL,'Nguyễn Gia Kính','Kỹ sư lập trình','kinhng.hgi@vnpt.vn',NULL,'2001-04-01','MALE',NULL,'ACTIVE',2,5,'10.92.22.35','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:22',NULL,0,NULL,NULL),(14,'53b6f865-9314-4378-8f77-eed2d07072f0','VNPT022605','hvkhoi.hgi','$2y$12$tG9PaAgmmKU.T..WiJAFSepuxf55dRVdIPNU3iaz.4x095shx.zgG',NULL,'Huỳnh Văn Khôi','Kỹ sư lập trình','hvkhoi.hgi@vnpt.vn',NULL,'2000-10-01','MALE',NULL,'ACTIVE',2,5,'10.92.22.84','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:23',NULL,0,NULL,NULL),(15,'9040fbf5-f0af-465b-b6d3-9dc5848855eb','VNPT022602','quynhtm.hgi','$2y$12$9RHmGgyhMWpT4BPLIbJtiuz6m6sLl1CsWKr2zYT/0nfU/bxG408Z.',NULL,'Trần Mạnh Quỳnh','Kỹ sư lập trình','quynhtm.hgi@vnpt.vn',NULL,'1999-09-17','MALE',NULL,'ACTIVE',2,5,'10.92.22.40','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:23',NULL,0,NULL,NULL),(16,'527766ca-1ebd-4bcb-8457-0938c8bc90c4','VNPT022601','dangth.hgi','$2y$12$MWKPPeF.HiyKtb0EV/Vake60.mUmzVwxiWQDbEIU8sDXjhFjeA8fq',NULL,'Tống Hải Đăng','Kỹ sư lập trình','dangth.hgi@vnpt.vn',NULL,'1993-04-26','MALE',NULL,'ACTIVE',2,5,'10.92.22.31','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:23',NULL,0,NULL,NULL),(17,'e3de6f11-476d-4a3b-b83c-afc280d4ae14','VNPT022468','ngahq.stg','$2y$12$wpHZdFHPu1X0eBXFaC6FZeY9eXdCg.zJsXmjiL79KLogYLMrlKTde',NULL,'Huỳnh Quỳnh Nga','Chuyên viên Tư vấn Giải pháp','ngahq.stg@vnpt.vn',NULL,'1977-03-25','FEMALE',NULL,'ACTIVE',2,5,NULL,'NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:24',NULL,0,NULL,NULL),(18,'1151dc9f-dc7e-4355-9607-5704238caadf','VNPT022408','tuanck.stg','$2y$12$lm6fABj3hsD8mMtH2Dk7quQLxSk4YEwnO1uA4d9cWiCaIiGrR4Zwq',NULL,'Châu Kim Tuấn','Nhân viên Hỗ trợ Kỹ thuật Dịch vụ','tuanck.stg@vnpt.vn',NULL,'1992-04-16','MALE',NULL,'ACTIVE',2,5,NULL,'NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:24',NULL,0,NULL,NULL),(19,'3ffccdec-30ee-48c7-ba4f-e77b4b00c57b','VNPT022391','hieuth.stg','$2y$12$JWmNVtChCVcIZCBbiKKGieo.iBAuUoPGqfMObB/jlKXWMEb72Dpli',NULL,'Thạch Hoàng Hiếu','Kỹ sư lập trình','hieuth.stg@vnpt.vn',NULL,'1993-12-15','MALE',NULL,'ACTIVE',2,5,'10.97.13.231','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:24',NULL,0,NULL,NULL),(20,'dd4600c9-c084-476e-87b1-cbf2b7f7f9f0','VNPT022348','quyennt.stg','$2y$12$pTOyXEhnNpvXjtYKINukWezVZ.rcM52TY.WTwNcTClzrpSCef/SEC',NULL,'Nguyễn Tú Quyên','Chuyên viên Tư vấn Giải pháp','quyennt.stg@vnpt.vn',NULL,'1993-01-01','FEMALE',NULL,'ACTIVE',2,5,'10.97.13.134','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:25',NULL,0,NULL,NULL),(21,'edad8b27-6d40-4600-b55f-4994fb6f71f1','VNPT022347','tamlt.stg','$2y$12$1X5NlfDf2o/.YR83V6Agw.RoAsUCfLul30VzxH0.lM6oFhXWUL.8e',NULL,'Lương Thiện Tâm','Kỹ sư lập trình','tamlt.stg@vnpt.vn',NULL,'1992-02-24','MALE',NULL,'ACTIVE',2,5,'10.97.13.179','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:25',NULL,0,NULL,NULL),(22,'ac86f299-4829-42f6-bf17-a0b13e406f34','VNPT022346','hiepvv.stg','$2y$12$6Zdp4eb8eClIF7LFy43XpO.bNHomZBJNZw1Mo9crUAdPRZqY2hECq',NULL,'Võ Văn Hiệp','Kỹ sư quản trị cơ sở dữ liệu','hiepvv.stg@vnpt.vn',NULL,'1993-04-30','MALE',NULL,'ACTIVE',2,5,'Wifi','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:25',NULL,0,NULL,NULL),(23,'0714da9f-70c1-4b9b-8a04-109db13f893e','VNPT022345','nhibc.stg','$2y$12$J3VEmYkh.wla3j5iyVLqpuqFXIb2FVUoDZQDgWHG9JJxz9HLN0dpC',NULL,'Bùi Cẩm Nhi','Kỹ sư Lập trình','nhibc.stg@vnpt.vn',NULL,'1993-09-11','FEMALE',NULL,'ACTIVE',2,5,NULL,'NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:26',NULL,0,NULL,NULL),(24,'0177ed17-8edf-40a1-bb78-754a3e411911','VNPT022343','cantd.stg','$2y$12$HPR3ERA2e.4jIwQnlgQqcOO91zjFzxkr16KBz0kc3VoiSOcvZdwAi',NULL,'Thái Đình Cẩn','Kỹ sư lập trình','cantd.stg@vnpt.vn',NULL,'1995-10-15','MALE',NULL,'ACTIVE',2,5,'10.97.13.128','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:26',NULL,0,NULL,NULL),(25,'e17bbb71-5354-4095-a45e-6c8ad78e2c62','VNPT022341','hoatc.stg','$2y$12$HMJjV84gyCXPXPtGHtHsG.yRqKAo.M3kZc/Ih5CNnshmS4WTHbkVe',NULL,'Trần Chí Hòa','Kỹ sư lập trình','hoatc.stg@vnpt.vn',NULL,'2002-01-01','MALE',NULL,'ACTIVE',2,5,'10.92.22.59','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:26',NULL,0,NULL,NULL),(26,'e7accd3d-d1ea-42c3-be85-c1b969737d0e','VNPT022333','dongnh.stg','$2y$12$kb2tKCiZe9HxkfL7Vo4FjeT41MaDW5wCqN/FjTt0tw3YgOsOaNlR.',NULL,'Nguyễn Hoàng Đông','Kỹ sư lập trình','dongnh.stg@vnpt.vn',NULL,'1993-07-19','MALE',NULL,'ACTIVE',2,5,'10.92.22.50','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:27',NULL,0,NULL,NULL),(27,'4d9c2813-5171-4fb0-bea0-088ef50a52a5','VNPT022329','hoanhdm.stg','$2y$12$avCjV8LcbN8S2G77psV9M.spcI1c9ysET1w1rf4kFkbUidrsu6VGS',NULL,'Đinh Minh Hoành','Kỹ sư lập trình','hoanhdm.stg@vnpt.vn',NULL,'1993-04-22','MALE',NULL,'ACTIVE',2,5,'10.97.13.235','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:27',NULL,0,NULL,NULL),(28,'2c47ab70-087b-4c40-9c5f-33672769e1e7','VNPT022328','minhnc.stg','$2y$12$WMR5iP4efjgTPWoHLEjBted0COdjP7qt9iMuXK7WvD9f2HT.Dt89G',NULL,'Nguyễn Công Minh','Kỹ sư lập trình','minhnc.stg@vnpt.vn',NULL,'1993-09-27','MALE',NULL,'ACTIVE',2,5,'10.92.22.46','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:27',NULL,0,NULL,NULL),(29,'ab5fa3aa-0216-4d6d-9363-52f5363bbdfb','VNPT022233','tienptt.cto','$2y$12$ki.j5g9GdK/ErbXzoP6/L.1H.4.m83NW7fDkNasrR8xsxobPqPHqa',NULL,'Phan Thị Thủy Tiên','Kỹ sư lập trình','tienptt.cto@vnpt.vn',NULL,'1997-04-10','FEMALE',NULL,'ACTIVE',2,5,'10.92.22.168','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:28',NULL,0,NULL,NULL),(30,'58ce257a-7be4-4944-ab35-336a55bc29d1','VNPT022232','thaohq.cto','$2y$12$PeA28nWzX3ACgabebjUSK.81UnIzVXCVWgQxXlPfVvAebVcjvf7oS',NULL,'Hồ Quốc Thảo','Kỹ sư lập trình','thaohq.cto@vnpt.vn',NULL,'1996-10-21','MALE',NULL,'ACTIVE',2,5,'10.92.22.18','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:28',NULL,0,NULL,NULL),(31,'9165ab6b-936a-4cf9-b20f-92eaea80d34a','VNPT022216','nunn.cto','$2y$12$FkAo7fbnv14C/39dKpG.J.Lpnj.zseTkcEwu/OcxCeNlQPAyVbtEK',NULL,'Nguyễn Ngọc Nữ','Chuyên viên Tư vấn Giải pháp','nunn.cto@vnpt.vn',NULL,'1994-03-12','FEMALE',NULL,'ACTIVE',2,5,'10.92.22.53','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:28',NULL,0,NULL,NULL),(32,'9b26b469-b753-4c2a-b733-b4e89d74346a','VNPT022209','thinhpp.cto','$2y$12$ReMYXbyq4z/Df3VdlxoxsOL1bz8W.MHhYxo.lHmXAgJQuNU1ubZCG',NULL,'Phan Phú Thịnh','Kỹ sư lập trình','thinhpp.cto@vnpt.vn',NULL,'2001-04-23','MALE',NULL,'ACTIVE',2,5,'10.92.22.78','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:29',NULL,0,NULL,NULL),(33,'6b849286-8dd1-4770-b724-c7ead1e25e0b','VNPT022206','phatpnt.cto','$2y$12$gxSTaJi7vwCKUvvEDZTB4.s93KlflSDedqxh7bq6VnYZ367DaeDLO',NULL,'Phan Nguyễn Trọng Phát','Kỹ sư lập trình','phatpnt.cto@vnpt.vn',NULL,'1999-08-08','MALE',NULL,'ACTIVE',2,5,'10.92.22.14','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:29',NULL,0,NULL,NULL),(34,'d9c922b2-3f48-452d-95dc-f713ecd0c57c','VNPT022204','khanhtt.cto','$2y$12$L5VVNlLLYKBCMkjezsYsaO.7H8av./9KhPQnRdyVGj5msscnXPRly',NULL,'Trần Tuấn Khanh','Kỹ sư lập trình','khanhtt.cto@vnpt.vn',NULL,'1997-06-06','MALE',NULL,'ACTIVE',2,5,'10.92.22.10','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:29',NULL,0,NULL,NULL),(35,'4eb6df2c-91d4-4a9b-8175-3b96089a8315','VNPT022203','tronghv.cto','$2y$12$7UsQm3T3uzLy8Zm65bVIo.DvV85RWUrsfcT47Be..JYDymUnrLD.a',NULL,'Hồ Văn Trọng','Kỹ sư lập trình','tronghv.cto@vnpt.vn',NULL,'1998-06-13','MALE',NULL,'ACTIVE',2,5,'10.92.22.63','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:30',NULL,0,NULL,NULL),(36,'7350eea0-4626-4871-99e7-b06758d17521','CTV091020','ducldt.cto','$2y$12$G8S48CczGYELvvkifebCtOb41B4ot8eNHbFS8sfJOISjhvCcWc5pO',NULL,'Lê Đào Thiên Đức','Nhân viên Hỗ trợ Kỹ thuật Dịch vụ','ducldt.cto@vnpt.vn',NULL,'2001-03-26','MALE',NULL,'ACTIVE',2,5,'10.92.22.62','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:30',NULL,0,NULL,NULL),(37,'ba4caf20-6b8c-4e7c-9ab0-168d3c70cb9b','CTV088035','quoctm.stg','$2y$12$fDr/Zw997TB0c57dzW2TLur4f1tKNpfjyem4mq2cUJeOwiyIi49e.',NULL,'Trịnh Minh Quốc','Nhân viên Hỗ trợ Kỹ thuật Dịch vụ','quoctm.stg@vnpt.vn',NULL,'2001-06-23','MALE',NULL,'ACTIVE',2,5,'10.97.13.67','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:31',NULL,0,NULL,NULL),(38,'af95c475-493f-4ce4-b289-7f23d9142ef6','CTV088032','vanlta.stg','$2y$12$nwepc6QXV/3yU5eJFphAEOAjxKJ/6D2CNKgrvR/xsoUp0EjmqScyC',NULL,'Lê Trà Ánh Vân','Nhân viên Hỗ trợ Kỹ thuật Dịch vụ','vanlta.stg@vnpt.vn',NULL,'2001-10-31','FEMALE',NULL,'ACTIVE',2,5,'10.97.13.101','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:31',NULL,0,NULL,NULL),(39,'cd776994-84ce-4b00-a6f8-368f47a66fbd','CTV087612','dangnh.hgi','$2y$12$y.2QiuCbnzOPwFWk0JttW.7qMwqkj5v7OTlv/0Kr1XBoV5b4dsL5i',NULL,'Nguyễn Hải Đăng','Kỹ sư lập trình','dangnh.hgi@vnpt.vn',NULL,'2001-05-17','MALE',NULL,'ACTIVE',2,5,'10.92.22.37','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:31',NULL,0,NULL,NULL),(40,'996095fb-339c-489e-8d6c-c4efc72bdf44','CTV087413','bangdh.hgi','$2y$12$cIpll1/v1ulPXax0b5TvVeWirC56kTlc0xqUeTJ3d/ptsxZRnsoPO',NULL,'Dương Hãi Băng','Kỹ sư lập trình','bangdh.hgi@vnpt.vn',NULL,'2002-08-06','MALE',NULL,'ACTIVE',2,5,'10.92.22.33','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:32',NULL,0,NULL,NULL),(41,'97bff328-2cd4-4bc3-b50a-56c7171e5f43','CTV086403','ngocnu.stg','$2y$12$IyMwKOekIOvUsF1icAVxTemoGIENg838XwfKZGgkb/xxRA7px4gcG',NULL,'Vỏ Thị Ngọc Nữ','Kỹ sư lập trình','ngocnu.stg@vnpt.vn',NULL,'2000-01-19','FEMALE',NULL,'ACTIVE',2,5,NULL,'NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:32',NULL,0,NULL,NULL),(42,'cddfb237-e5e8-48a3-a293-69cff353f750','CTV086013','huytcq.cto','$2y$12$K7LsbEgcYU5UL/fZ0PuZbuFory6UpIUVOW7VlKu3yz1QN7zB0Cckm',NULL,'Trương Công Quốc Huy','Kỹ sư quản trị cơ sở dữ liệu','huytcq.cto@vnpt.vn',NULL,'1998-11-03','MALE',NULL,'ACTIVE',2,5,'10.92.22.42','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:32',NULL,0,NULL,NULL),(43,'2cff229d-5366-4162-acb7-af3e808adc8c','CTV085761','lapnv.hgi','$2y$12$Nns0YM18XTBHCEPYdOYEIOdEEkD66T1Y19gWErJv2QM5OqD.WvfeC',NULL,'Nguyễn Vĩnh Lạp','Kỹ sư lập trình','lapnv.hgi@vnpt.vn',NULL,'2000-02-01','MALE',NULL,'ACTIVE',2,5,'10.92.22.38','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:33',NULL,0,NULL,NULL),(44,'de26c0c2-c72c-4fa3-a21b-28b275f0b455','CTV083161','thuanph.hgi','$2y$12$SDzJ0g43tPg7tES2/EqwDOuShq3awVuGfUwaZA5ZYh5njqkgvz1Y.',NULL,'Phan Hữu Thuận','Kỹ sư lập trình','thuanph.hgi@vnpt.vn',NULL,'1999-01-19','MALE',NULL,'ACTIVE',2,5,'10.92.22.41','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:33',NULL,0,NULL,NULL),(45,'deb03cfa-93fc-499e-a490-53bfb163f972','CTV080346','kietvh.cto','$2y$12$gF5pll7Jh1WYkgcu.TeIfuFLvsbGd0Vm2NDL98GK2kQbEaJVhbmmW',NULL,'Võ Hoàng Kiệt','Chuyên viên Tư vấn Giải pháp','kietvh.cto@vnpt.vn',NULL,'2000-05-29','MALE',NULL,'ACTIVE',2,5,'10.92.22.52','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:33',NULL,0,NULL,NULL),(46,'9c796fa9-36c5-4bf1-9edf-6ce2ffef6fdc','CTV079744','nhudt.cto','$2y$12$Pf34I.xLD3FCptM.oQBx4.Yyg9hbFQ9Z6T16u02aDQTD90rM/tpw.',NULL,'Dương Tố Như','Nhân viên Hỗ trợ Kỹ thuật Dịch vụ','nhudt.cto@vnpt.vn',NULL,'2000-11-06','FEMALE',NULL,'ACTIVE',2,5,'Wifi','NO','2026-03-01 07:44:11',NULL,'2026-03-01 14:50:34',NULL,0,NULL,NULL),(47,'2d97bb12-9702-42d1-b214-7db88e6ab01f','CTV062802','tranthanhduy.cto','$2y$12$nkVyKd7.A7WfHnQh1GDcLuAwtU2rCH2q6tTaiiizAOHePNoIimbdC',NULL,'Trần Thanh Duy','Chuyên viên Tư vấn Giải pháp','tranthanhduy.cto@vnpt.vn',NULL,'1998-09-15','MALE',NULL,'ACTIVE',2,5,'10.92.22.174','NO','2026-03-01 07:44:12',NULL,'2026-03-01 14:50:34',NULL,0,NULL,NULL),(48,'695874e4-776e-4c25-b56d-96a858e3786b','CTV056887','hoangst.stg','$2y$12$FE7N4ZGL5QNtPYbJh267CeHLcUab62knJc.Ao9SuT.BckWCyYB.vm',NULL,'Sơn Thanh Hoàng','Kỹ sư lập trình','hoangst.stg@vnpt.vn',NULL,'1996-08-11','MALE',NULL,'ACTIVE',2,5,'Wifi','NO','2026-03-01 07:44:12',NULL,'2026-03-01 14:50:34',NULL,0,NULL,NULL),(49,'d102d6a5-8651-460d-b1a0-406fc65094a1','CTV050527','luanth.cto','$2y$12$oPN.N2yLQxOtpZGJkEJeaO6Ook/FJzc08JClm2h7mI1ZH89EraOei',NULL,'Trần Hoàng Luận','Chuyên viên Tư vấn Giải pháp','luanth.cto@vnpt.vn',NULL,'1997-10-20','MALE',NULL,'ACTIVE',2,5,'Wifi','YES','2026-03-01 07:44:12',NULL,'2026-03-02 02:34:46',NULL,0,NULL,NULL),(50,'f9df387b-db9e-484d-b84e-fd478777f2ab','CTV050523','truongnn.cto','$2y$12$HpA1J8yktF0HmoZeHe0ZyuQysTE0K9XBiWhUQrRo0gadSeT8NUQ7m',NULL,'Nguyễn Nhựt Trường','Chuyên viên Tư vấn Giải pháp','truongnn.cto@vnpt.vn',NULL,'1996-12-28','MALE',NULL,'ACTIVE',2,5,'10.92.22.87','NO','2026-03-01 07:44:12',NULL,'2026-03-01 14:50:35',NULL,0,NULL,NULL),(51,'0e31dc9f-1616-4a82-8adb-ec56e25eee7d','VNPT022202','nhatv.cto','$2y$12$UylyfUfZqWAOotx.HNpgz.b7uQbyF0c/P8hKJknUvUqFTXjzNVqKe',NULL,'Trần Văn Nhã','Nhân viên Hỗ trợ Kỹ thuật Dịch vụ','nhatv.cto@vnpt.vn',NULL,'1995-05-19','MALE',NULL,'ACTIVE',2,5,'10.97.17.111','NO','2026-03-01 07:44:12',NULL,'2026-03-01 14:50:35',NULL,0,NULL,NULL),(52,'e82b34ac-ed3b-40fb-95c2-e8c8749f13fc','VNPT022342','mailtn.stg','$2y$12$iqZyFExCXwgdTv8Ag/q2z.UXBz9EGJ6uzqE6MwZLB9iDGcfd75equ',NULL,'Lý Thị Ngọc Mai','Nhân viên Hỗ trợ Kỹ thuật Dịch vụ','mailtn.stg@vnpt.vn',NULL,'1992-05-03','FEMALE',NULL,'ACTIVE',2,5,'10.97.13.111','NO','2026-03-01 07:44:12',NULL,'2026-03-01 14:50:36',NULL,0,NULL,NULL);
/*!40000 ALTER TABLE `internal_users` ENABLE KEYS */;
UNLOCK TABLES;

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
  `migration` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 1: Quản lý vết migration';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_02_21_152322_create_personal_access_tokens_table',1),(5,'2026_02_23_134500_create_v5_enterprise_master_tables',1),(6,'2026_02_23_220000_add_extended_fields_to_employees_table',1),(7,'2026_02_23_220100_create_audit_logs_table',1),(9,'2026_02_25_153000_add_trial_status_to_projects_enum',2),(11,'2026_02_25_171000_refine_project_status_workflow',3),(12,'2026_02_24_180000_drop_legacy_employees_table',4),(13,'2026_02_25_090000_enforce_department_and_employee_constraints',4),(14,'2026_02_25_200000_create_document_product_links_table',4),(15,'2026_02_25_213000_create_integration_settings_table',5),(16,'2026_02_26_090000_create_auth_login_attempts_table',6),(17,'2026_02_26_091000_revoke_non_expiring_personal_access_tokens',6),(18,'2026_02_26_092000_harden_document_and_contract_integrity',6),(19,'2026_02_26_134500_optimize_support_request_indexes',7),(20,'2026_02_26_152000_add_audit_created_by_index',8),(21,'2026_02_27_103000_add_date_of_birth_to_customer_personnel_table',9),(22,'2026_02_27_180000_add_effective_date_and_normalize_contract_statuses',10),(23,'2026_02_27_193000_add_contract_expiry_warning_days_to_integration_settings',11),(24,'2026_02_27_194000_add_contract_date_check_constraints',12),(25,'2026_02_27_200000_add_contract_payment_warning_days_to_integration_settings',13),(26,'2026_02_27_210500_create_generate_contract_payments_procedure',14),(27,'2026_02_27_090000_replace_support_request_statuses',15),(28,'2026_02_27_160000_drop_support_request_legacy_notes_columns',15),(29,'2026_02_27_170000_add_support_request_receiver_and_reporter_contact',15),(30,'2026_02_27_180000_make_support_request_hotfix_noti_nullable',15),(31,'2026_02_27_190000_create_support_request_tasks_table',15),(32,'2026_02_27_200000_normalize_support_request_task_statuses',15),(33,'2026_02_27_210000_allow_duplicate_support_request_ticket_codes',15),(34,'2026_02_28_010000_optimize_support_tasks_and_groups_indexes',15),(35,'2026_02_28_020000_create_support_request_statuses_table',15),(36,'2026_02_28_030000_add_reference_fields_to_support_requests',15),(37,'2026_03_01_110000_harden_support_master_management',16),(38,'2026_02_28_220000_normalize_programming_request_source_type_and_priority',17),(39,'2026_02_28_233000_enforce_programming_request_req_code_format',17),(40,'2026_02_28_235500_drop_support_request_legacy_task_fields',17),(41,'2026_03_01_000100_add_is_transfer_dev_to_support_request_statuses',17),(42,'2026_03_01_010000_add_performance_indexes_for_request_lists',17),(43,'2026_03_01_130000_add_group_code_to_support_service_groups',17),(44,'2026_03_01_140000_add_description_and_is_active_to_products_table',18),(45,'2026_03_01_183000_add_phase2_support_request_filter_indexes',19),(46,'2026_03_01_191000_add_programming_worklog_indexes',20),(47,'2026_03_01_020000_update_generate_contract_payments_procedure_and_indexes',21),(48,'2026_03_01_030000_add_contract_term_columns_and_refresh_generate_payments_procedure',21),(49,'2026_03_02_110000_create_opportunity_stages_table',22),(50,'2026_03_02_101000_update_raci_assignment_unique_index_for_multi_roles',23),(51,'2026_03_02_150000_add_request_code_to_support_requests',24),(52,'2026_03_02_200000_create_support_contact_positions_and_link_customer_personnel',25),(53,'2026_03_02_210000_add_indexes_to_personal_access_tokens',26),(54,'2026_03_02_223000_create_async_exports_table',27),(55,'2026_03_03_160000_status_driven_sla_configs',28),(56,'2026_03_03_161000_relax_programming_request_req_code_constraint',28),(57,'2026_03_03_220000_customer_request_workflow_core',29),(58,'2026_03_04_090000_customer_requests_support_parity',30),(59,'2026_03_04_110000_normalize_customer_workflow_static_field_aliases',31),(60,'2026_03_04_120000_harden_internal_user_password_policy',32),(61,'2026_03_04_120100_rotate_default_internal_user_passwords',32),(62,'2026_03_04_180000_add_private_storage_metadata_to_attachments',33),(63,'2026_03_04_180100_add_soft_deletes_to_priority_master_tables',33),(64,'2026_03_03_090000_add_status_to_customer_personnel_table',34),(65,'2026_03_03_103000_change_customer_personnel_position_type_to_varchar',34),(66,'2026_03_04_130000_harden_customer_request_exchange_feedback_fields',34),(67,'2026_03_05_170000_dedupe_customer_request_ref_tasks',34),(68,'2026_03_07_090000_link_support_service_groups_to_customers',34),(69,'2026_03_08_010000_drop_support_and_programming_request_modules',35),(70,'2026_03_08_093000_update_customer_request_analysis_fields',36),(71,'2026_03_08_110000_add_processing_hours_field_to_customer_request_workflow',37),(72,'2026_03_08_120000_make_waiting_customer_feedback_exchange_fields_required',38),(73,'2026_03_08_123000_rename_waiting_customer_feedback_exchange_date_label',39),(74,'2026_03_08_133000_backfill_customer_request_reference_task_sources',40),(75,'2026_03_08_170000_add_customer_request_to_attachment_reference_type',41),(76,'2026_03_09_103000_add_backblaze_b2_fields_to_integration_settings',42),(77,'2026_03_09_194500_add_bucket_id_to_backblaze_b2_integration_settings',43);
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
-- Dumping data for table `opportunities`
--

LOCK TABLES `opportunities` WRITE;
/*!40000 ALTER TABLE `opportunities` DISABLE KEYS */;
INSERT INTO `opportunities` VALUES (1,'Triển khai VNPT HIS cho Vietcombank',1,150000000.00,70,'PROPOSAL',2,1,'2026-02-23 08:16:35',NULL,'2026-03-01 14:16:56',NULL,NULL),(2,'Dịch vụ SOC cho Petrolimex',2,80000000.00,60,'NEGOTIATION',2,1,'2026-02-23 08:16:35',NULL,'2026-03-01 14:16:56',NULL,NULL);
/*!40000 ALTER TABLE `opportunities` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `opportunity_stages`
--

LOCK TABLES `opportunity_stages` WRITE;
/*!40000 ALTER TABLE `opportunity_stages` DISABLE KEYS */;
INSERT INTO `opportunity_stages` VALUES (1,'NEW','Mới',NULL,0,1,10,NULL,NULL,'2026-03-01 21:29:22','2026-03-01 21:29:22'),(2,'PROPOSAL','Đề xuất',NULL,0,1,20,NULL,NULL,'2026-03-01 21:29:22','2026-03-01 21:29:22'),(3,'NEGOTIATION','Đàm phán',NULL,0,1,30,NULL,NULL,'2026-03-01 21:29:22','2026-03-01 21:29:22'),(4,'WON','Thắng',NULL,1,1,40,NULL,NULL,'2026-03-01 21:29:22','2026-03-01 21:29:22'),(5,'LOST','Thất bại',NULL,1,1,50,NULL,NULL,'2026-03-01 21:29:22','2026-03-01 21:29:22');
/*!40000 ALTER TABLE `opportunity_stages` ENABLE KEYS */;
UNLOCK TABLES;

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
  KEY `idx_ps_contract_expected_status` (`contract_id`,`expected_date`,`status`),
  KEY `idx_ps_contract_expected` (`contract_id`,`expected_date`),
  CONSTRAINT `fk_ps_contract` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ps_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 36: Kế hoạch thanh toán & Dòng tiền dự kiến';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_schedules`
--

LOCK TABLES `payment_schedules` WRITE;
/*!40000 ALTER TABLE `payment_schedules` DISABLE KEYS */;
INSERT INTO `payment_schedules` VALUES (1,1,1,'Thanh toán một lần',1,'2026-01-15',150000000.00,NULL,0.00,'PENDING',NULL,'2026-02-27 09:31:15','2026-02-27 09:31:15'),(5,2,2,'Thanh toán một lần',1,'2026-02-20',80000000.00,NULL,0.00,'PENDING',NULL,'2026-02-27 10:12:36','2026-02-27 10:12:36');
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
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'system.health.view','Xem trạng thái bảng hệ thống','SYSTEM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(2,'dashboard.view','Xem dashboard tổng quan','DASHBOARD',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(3,'departments.read','Xem phòng ban','DEPARTMENTS',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(4,'departments.write','Thêm/Sửa phòng ban','DEPARTMENTS',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(5,'departments.delete','Xóa phòng ban','DEPARTMENTS',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(6,'departments.import','Nhập phòng ban','DEPARTMENTS',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(7,'departments.export','Xuất phòng ban','DEPARTMENTS',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(8,'employees.read','Xem nhân sự nội bộ','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(9,'employees.write','Thêm/Sửa nhân sự nội bộ','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(10,'employees.delete','Xóa nhân sự nội bộ','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(11,'employees.import','Nhập nhân sự nội bộ','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(12,'employees.export','Xuất nhân sự nội bộ','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(13,'user_dept_history.read','Xem lịch sử luân chuyển','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(14,'user_dept_history.write','Thêm/Sửa lịch sử luân chuyển','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(15,'user_dept_history.delete','Xóa lịch sử luân chuyển','EMPLOYEES',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(16,'businesses.read','Xem lĩnh vực kinh doanh','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(17,'businesses.write','Thêm/Sửa lĩnh vực kinh doanh','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(18,'businesses.delete','Xóa lĩnh vực kinh doanh','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(19,'businesses.import','Nhập lĩnh vực kinh doanh','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(20,'businesses.export','Xuất lĩnh vực kinh doanh','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(21,'vendors.read','Xem nhà cung cấp','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(22,'vendors.write','Thêm/Sửa nhà cung cấp','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(23,'vendors.delete','Xóa nhà cung cấp','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(24,'vendors.import','Nhập nhà cung cấp','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(25,'vendors.export','Xuất nhà cung cấp','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(26,'products.read','Xem sản phẩm','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(27,'products.write','Thêm/Sửa sản phẩm','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(28,'products.delete','Xóa sản phẩm','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(29,'products.import','Nhập sản phẩm','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(30,'products.export','Xuất sản phẩm','MASTER_DATA',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(31,'customers.read','Xem khách hàng','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(32,'customers.write','Thêm/Sửa khách hàng','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(33,'customers.delete','Xóa khách hàng','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(34,'customers.import','Nhập khách hàng','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(35,'customers.export','Xuất khách hàng','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(36,'customer_personnel.read','Xem đầu mối liên hệ','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(37,'customer_personnel.write','Thêm/Sửa đầu mối liên hệ','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(38,'customer_personnel.delete','Xóa đầu mối liên hệ','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(39,'opportunities.read','Xem cơ hội kinh doanh','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(40,'opportunities.write','Thêm/Sửa cơ hội kinh doanh','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(41,'opportunities.delete','Xóa cơ hội kinh doanh','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(42,'opportunities.import','Nhập cơ hội kinh doanh','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(43,'opportunities.export','Xuất cơ hội kinh doanh','CRM',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(44,'projects.read','Xem dự án','PROJECT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(45,'projects.write','Thêm/Sửa dự án','PROJECT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(46,'projects.delete','Xóa dự án','PROJECT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(47,'projects.import','Nhập dự án','PROJECT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(48,'projects.export','Xuất dự án','PROJECT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(49,'contracts.read','Xem hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(50,'contracts.write','Thêm/Sửa hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(51,'contracts.delete','Xóa hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(52,'contracts.import','Nhập hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(53,'contracts.export','Xuất hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(54,'contracts.payments','Quản lý kỳ thanh toán hợp đồng','CONTRACT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(55,'documents.read','Xem tài liệu','DOCUMENT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(56,'documents.write','Thêm/Sửa tài liệu','DOCUMENT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(57,'documents.delete','Xóa tài liệu','DOCUMENT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(58,'reminders.read','Xem nhắc việc','REMINDER',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(59,'reminders.write','Thêm/Sửa nhắc việc','REMINDER',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(60,'reminders.delete','Xóa nhắc việc','REMINDER',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(61,'audit_logs.read','Xem nhật ký hệ thống','AUDIT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(62,'support_service_groups.read','Xem nhóm hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(63,'support_service_groups.write','Thêm/Sửa nhóm hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(64,'support_service_groups.delete','Xóa nhóm hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(65,'support_requests.read','Xem yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(66,'support_requests.write','Thêm/Sửa yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(67,'support_requests.delete','Xóa yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(68,'support_requests.import','Nhập yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(69,'support_requests.export','Xuất yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(70,'support_requests.status','Đổi trạng thái yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(71,'support_requests.history','Xem lịch sử yêu cầu hỗ trợ','SUPPORT',1,'2026-02-24 23:39:23',NULL,NULL,NULL),(72,'authz.manage','Quản trị phân quyền người dùng','SYSTEM',1,'2026-02-24 23:57:13',NULL,NULL,NULL),(144,'support_contact_positions.read','Xem danh mục chức vụ liên hệ','Hỗ trợ',1,'2026-03-02 07:09:31',NULL,'2026-03-02 07:09:31',NULL),(145,'support_contact_positions.write','Thêm/Sửa danh mục chức vụ liên hệ','Hỗ trợ',1,'2026-03-02 07:09:31',NULL,'2026-03-02 07:09:31',NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=215 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (1,'App\\Models\\InternalUser',1,'vnpt_business_web','51121a7f6abcf0ee54674f7bfa56c094bbb2c230b4943b8df3bfa78d5ff426e4','[\"*\"]',NULL,'2026-02-25 19:33:29','2026-02-24 16:46:12','2026-02-25 19:33:29'),(2,'App\\Models\\InternalUser',5,'vnpt_business_web','eaa1e541e2db8a9ef904100245411bde570695df96ebabfcceb983c54a454d15','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 16:46:27','2026-02-25 19:33:29','2026-02-24 16:46:27','2026-02-25 19:33:29'),(3,'App\\Models\\InternalUser',5,'vnpt_business_web','7968cbc9b83428e82e1db3df41fd1c340663711fdc1e9bac4dac699fa2db2e75','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 16:46:48','2026-02-25 19:33:29','2026-02-24 16:46:48','2026-02-25 19:33:29'),(4,'App\\Models\\InternalUser',5,'vnpt_business_web','1d839e46b1dc73124669bab4725247dca6ef838db18d73e545190e8cc52df5de','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 16:46:59','2026-02-25 19:33:29','2026-02-24 16:46:59','2026-02-25 19:33:29'),(6,'App\\Models\\InternalUser',1,'vnpt_business_web','4be372717886bb889d1ff3f7cb33b02a9c1eedd02ba73981c7602e0094ea9887','[\"*\"]','2026-02-24 17:11:34','2026-02-25 19:33:29','2026-02-24 16:50:05','2026-02-25 19:33:29'),(7,'App\\Models\\InternalUser',1,'vnpt_business_web','3a90cb04f4506ebd426c6ef5802c21a6d7bc0f3d7f4dc4da60530893be98e477','[\"*\"]','2026-02-24 17:04:59','2026-02-25 19:33:29','2026-02-24 17:04:59','2026-02-25 19:33:29'),(8,'App\\Models\\InternalUser',5,'vnpt_business_web','295c86c798cd6e70e6925700c36f9150d509ad9f9aa89f3b5895a28203faf502','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 17:04:59','2026-02-25 19:33:29','2026-02-24 17:04:59','2026-02-25 19:33:29'),(9,'App\\Models\\InternalUser',1,'vnpt_business_web','37e5aef51ffd52c43e312482974d552b007eb83a5079f49552853f5886730c80','[\"*\"]','2026-02-24 17:09:01','2026-02-25 19:33:29','2026-02-24 17:09:01','2026-02-25 19:33:29'),(10,'App\\Models\\InternalUser',1,'vnpt_business_web','fe553d6d88f65ad0e55e282d0ec32332304c743f39ab3499851ade59ebfb035a','[\"*\"]','2026-02-25 16:29:38','2026-02-25 19:33:29','2026-02-25 00:55:54','2026-02-25 19:33:29'),(11,'App\\Models\\InternalUser',1,'vnpt_business_web','6f1bef0da90f41e43a564872a8499fd11515089f31a7dbcab91246daed29f9cd','[\"*\"]','2026-02-25 01:27:54','2026-02-25 19:33:29','2026-02-25 01:27:54','2026-02-25 19:33:29'),(12,'App\\Models\\InternalUser',1,'vnpt_business_web','6787f59e890cc0dcacf8ff9a6f8d45f4b4738b9b90bb51f89d5a8e02060556eb','[\"*\"]','2026-02-25 01:35:49','2026-02-25 19:33:29','2026-02-25 01:35:49','2026-02-25 19:33:29'),(13,'App\\Models\\InternalUser',1,'vnpt_business_web','f7cd7b74db60deff08f95229bb4d0df9b4b863cd8a45c72839c89884d32f491e','[\"*\"]','2026-02-25 01:38:56','2026-02-25 19:33:29','2026-02-25 01:38:56','2026-02-25 19:33:29'),(14,'App\\Models\\InternalUser',1,'vnpt_business_web','21f22f762b13c8a08c13f59aeb0f439fcf0e5b492170d0dfdef2b13e83605474','[\"*\"]','2026-02-25 01:39:26','2026-02-25 19:33:29','2026-02-25 01:39:26','2026-02-25 19:33:29'),(15,'App\\Models\\InternalUser',1,'vnpt_business_web','27e0df5019f4eba77bad9a9458bc86c5ee31b76718b0c4ba9935540a099a9f55','[\"*\"]','2026-02-25 01:40:16','2026-02-25 19:33:29','2026-02-25 01:40:16','2026-02-25 19:33:29'),(16,'App\\Models\\InternalUser',1,'vnpt_business_web','1e8f36635445516e1fd176918275981d3d654b21a952b6c2a04fa4f30cca625f','[\"*\"]','2026-02-25 03:54:58','2026-02-25 19:33:29','2026-02-25 03:54:58','2026-02-25 19:33:29'),(17,'App\\Models\\InternalUser',1,'vnpt_business_web','beafef575f75f67d26a30a02898bbdaca9219966ad8efc16730a9f7875df8923','[\"*\"]','2026-02-25 05:33:41','2026-02-25 19:33:29','2026-02-25 04:24:43','2026-02-25 19:33:29'),(18,'App\\Models\\InternalUser',1,'vnpt_business_web','1d629488261890206b9f6c0588b44c7ef9288a653dfb0ce13f09df14debc1d70','[\"*\"]','2026-02-25 07:17:43','2026-02-25 19:33:29','2026-02-25 05:59:16','2026-02-25 19:33:29'),(19,'App\\Models\\InternalUser',4,'vnpt_business_web','658657290f8db4af85833723aca33880fdee15f013a2dfc0e16c9ceefdb028f1','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-25 06:13:25','2026-02-25 19:33:29','2026-02-25 06:13:25','2026-02-25 19:33:29'),(20,'App\\Models\\InternalUser',4,'vnpt_business_web','ee4250a918738d39df64069857839531c06bb43ef3ce9c442ab73a05d58a5487','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-25 06:13:46','2026-02-25 19:33:29','2026-02-25 06:13:46','2026-02-25 19:33:29'),(21,'App\\Models\\InternalUser',1,'vnpt_business_web','4b798a2d9391d044c5313e5eb7e7242bc3381e758ea9e4bada1141a3f60049ec','[\"*\"]',NULL,'2026-02-25 19:33:29','2026-02-25 06:14:36','2026-02-25 19:33:29'),(22,'App\\Models\\InternalUser',1,'vnpt_business_web','3d07c973b1d00d008d87cd535af7a5f98dfcec13be6057744f5c1c66bb789d14','[\"*\"]','2026-02-25 06:14:59','2026-02-25 19:33:29','2026-02-25 06:14:59','2026-02-25 19:33:29'),(23,'App\\Models\\InternalUser',1,'vnpt_business_web','b918291d3b29c5bdc5d65b1a984cef353e5e4d528114d0ba20469e02282f207b','[\"*\"]','2026-02-25 06:17:20','2026-02-25 19:33:29','2026-02-25 06:17:20','2026-02-25 19:33:29'),(24,'App\\Models\\InternalUser',4,'vnpt_business_web','c68e9229710e6d5cebd44ded6c1e50c2d01728bba001be7daaef969618ce8737','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-25 07:17:21','2026-02-25 19:33:29','2026-02-25 07:17:20','2026-02-25 19:33:29'),(25,'App\\Models\\InternalUser',1,'vnpt_business_web','5f66f9aca570fb6b5bb9137e4545dd438b12bea285e631cd3244d37970d71faf','[\"*\"]',NULL,'2026-02-25 19:33:29','2026-02-25 07:17:37','2026-02-25 19:33:29'),(26,'App\\Models\\InternalUser',1,'vnpt_business_web','eafab23eee4b2ed75bfd15ee78286e106a1cd8742c8c57c867dace515127ebec','[\"*\"]','2026-02-25 07:18:02','2026-02-25 19:33:29','2026-02-25 07:18:01','2026-02-25 19:33:29'),(27,'App\\Models\\InternalUser',1,'vnpt_business_web','7ed723c400080468402f3c9869af28976b4cbb129ad2bb14358986a487fd4a5c','[\"*\"]','2026-02-25 07:37:00','2026-02-25 19:33:29','2026-02-25 07:22:55','2026-02-25 19:33:29'),(28,'App\\Models\\InternalUser',1,'vnpt_business_web','454eae86cbdce6bb409c4d2b398ba458f6488852337e57b52d076f106af36ad2','[\"*\"]','2026-02-25 16:29:39','2026-02-25 19:33:29','2026-02-25 16:15:32','2026-02-25 19:33:29'),(29,'App\\Models\\InternalUser',4,'vnpt_business_web','71acfda9efa7df35ee7e580c233d38337e9e00267690a304865fc81ac9d01705','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]',NULL,'2026-02-26 03:38:08','2026-02-25 19:38:08','2026-02-25 19:38:08'),(30,'App\\Models\\InternalUser',4,'vnpt_business_web','fc7b81cc6ed7dc4fff065d00269b26ec9ecddd3b7297425b16305020e7dc7d41','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-25 19:41:08','2026-02-26 03:40:21','2026-02-25 19:40:21','2026-02-25 19:41:08'),(32,'App\\Models\\InternalUser',1,'vnpt_business_web','1331b467b1a233a2c11b94207f8170469963cf1c7d72aa77f9e10180e3155746','[\"*\"]','2026-02-25 20:37:59','2026-02-26 04:22:23','2026-02-25 20:22:23','2026-02-25 20:37:59'),(33,'App\\Models\\InternalUser',1,'vnpt_business_web','6da1cb0bfc82423e9f31911fb3054e48fcffad64fd9a87590582f320d3d01121','[\"*\"]','2026-02-25 23:28:48','2026-02-26 07:06:55','2026-02-25 23:06:55','2026-02-25 23:28:48'),(34,'App\\Models\\InternalUser',1,'vnpt_business_web','2fa264ff3e8d9a66e524fcd3b97be1c16c8cd76fd130423c99ccd8b0e7c544a4','[\"*\"]','2026-02-26 04:57:15','2026-02-26 08:18:18','2026-02-26 00:18:18','2026-02-26 04:57:15'),(35,'App\\Models\\InternalUser',1,'vnpt_business_web','687db756a6c06ab2946a442771de3c6af775f69412d284621df8174f6c14e395','[\"*\"]','2026-02-26 05:48:47','2026-02-26 12:50:28','2026-02-26 04:50:28','2026-02-26 05:48:47'),(36,'App\\Models\\InternalUser',1,'vnpt_business_web','3fbc960159420f60ebceecc9d1f1868e5a834d217b35e35563ce511a4d10a11f','[\"*\"]',NULL,'2026-02-26 13:37:44','2026-02-26 05:37:44','2026-02-26 05:37:44'),(37,'App\\Models\\InternalUser',1,'vnpt_business_web','c7a22f1a920eac4548c839ec638923233526e6340c8714bb6f333c4987e72e70','[\"*\"]','2026-02-26 06:39:15','2026-02-26 14:15:35','2026-02-26 06:15:35','2026-02-26 06:39:15'),(38,'App\\Models\\InternalUser',1,'vnpt_business_web','6103513b050ee487f5ec174323bc8b74ad0c7af8dd54aa4331d46406746cee13','[\"*\"]','2026-02-26 07:48:36','2026-02-26 14:30:12','2026-02-26 06:30:12','2026-02-26 07:48:36'),(39,'App\\Models\\InternalUser',1,'vnpt_business_web','3b8cba99404b19170d11103f51abc11d0401a3fdd264bec2811a7b60c263a133','[\"*\"]',NULL,'2026-02-26 15:11:26','2026-02-26 07:11:26','2026-02-26 07:11:26'),(40,'App\\Models\\InternalUser',1,'vnpt_business_web','4ebd70ccadd9e26899b95d4b6f006ada2cdab006c55ea14ab16f3187aa376b44','[\"*\"]',NULL,'2026-02-26 15:11:27','2026-02-26 07:11:27','2026-02-26 07:11:27'),(41,'App\\Models\\InternalUser',1,'vnpt_business_web','f23a89bcad56f0cef154363058f5fca4175f410e3796be2697b629a4ccbae187','[\"*\"]',NULL,'2026-02-26 15:11:28','2026-02-26 07:11:28','2026-02-26 07:11:28'),(42,'App\\Models\\InternalUser',1,'vnpt_business_web','b8105ab6af5d0717fc869d1e62e4e4d61992aea92e3de1563c139275c060ab9c','[\"*\"]',NULL,'2026-02-26 15:11:47','2026-02-26 07:11:47','2026-02-26 07:11:47'),(43,'App\\Models\\InternalUser',1,'vnpt_business_web','04a659d0247f6646d96bf8ad1e5f6d1d49ab514dae53d0cb9142a90c798b9be8','[\"*\"]','2026-02-26 07:13:30','2026-02-26 15:12:11','2026-02-26 07:12:11','2026-02-26 07:13:30'),(44,'App\\Models\\InternalUser',1,'vnpt_business_web','011c0923d1a037d3b9ac90d470708255b40afb927bcea3a4b4634789d2644e1e','[\"*\"]','2026-02-26 07:24:26','2026-02-26 15:17:39','2026-02-26 07:17:39','2026-02-26 07:24:26'),(45,'App\\Models\\InternalUser',1,'vnpt_business_web','57462e47845d07790db80a94c0f0f09f1f5110469bb004e92fcc79006570de9a','[\"*\"]','2026-02-26 07:41:47','2026-02-26 15:34:57','2026-02-26 07:34:57','2026-02-26 07:41:47'),(46,'App\\Models\\InternalUser',1,'vnpt_business_web','b2805773a73df2246f5addb85f7b361ff90476afbd647c0eedfcc5c81e5be18b','[\"*\"]','2026-02-26 15:47:49','2026-02-26 23:47:22','2026-02-26 15:47:22','2026-02-26 15:47:49'),(47,'App\\Models\\InternalUser',1,'vnpt_business_web','11a2e63c46331f7a4bb282e5d1bd4727a73a1659bedce3848e32d18e03967a49','[\"*\"]','2026-02-26 15:52:07','2026-02-26 23:52:01','2026-02-26 15:52:01','2026-02-26 15:52:07'),(48,'App\\Models\\InternalUser',1,'vnpt_business_web','5a46650cc7b98fcd5a5d57968c56e73cf6576d3afd23307e96923e103d968536','[\"*\"]','2026-02-26 15:54:28','2026-02-26 23:54:28','2026-02-26 15:54:28','2026-02-26 15:54:28'),(49,'App\\Models\\InternalUser',1,'vnpt_business_web','86f1f958e0b107b7fc367385c7b9df4403255f7505c09dc38cca6fa073a98375','[\"*\"]','2026-02-26 23:49:31','2026-02-26 23:57:25','2026-02-26 15:57:25','2026-02-26 23:49:31'),(50,'App\\Models\\InternalUser',1,'vnpt_business_web','ea61da1f552395d1fdd8d68903292525ba8ee6b7f759395039343d48c6e78da1','[\"*\"]','2026-02-26 20:34:39','2026-02-27 04:26:18','2026-02-26 20:26:18','2026-02-26 20:34:39'),(51,'App\\Models\\InternalUser',1,'vnpt_business_web','2b7e1319d56c421500fc4bb32f00a0967f3185f33cc981ac7f4b115d80735434','[\"*\"]','2026-02-27 07:51:19','2026-02-27 07:51:20','2026-02-26 23:51:20','2026-02-27 07:51:19'),(52,'App\\Models\\InternalUser',1,'vnpt_business_web','7174c00c2e4c0e8ada705e3170098eb11baa071e792fd6ec34d168980cdef1f4','[\"*\"]','2026-02-27 11:14:22','2026-02-27 11:29:08','2026-02-27 03:29:08','2026-02-27 11:14:22'),(53,'App\\Models\\InternalUser',1,'vnpt_business_web','170ef2f91495cfb102fe4ae6626f092e9557985dd9a8c2a899151a6afb41b293','[\"*\"]','2026-02-27 07:51:29','2026-02-27 11:54:54','2026-02-27 03:54:54','2026-02-27 07:51:29'),(54,'App\\Models\\InternalUser',4,'vnpt_business_web','9cee078f423739df09a2da4b7485a66e7c5630a6b0d7367e4bb11369fad55f70','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-27 06:47:54','2026-02-27 14:47:49','2026-02-27 06:47:49','2026-02-27 06:47:54'),(55,'App\\Models\\InternalUser',4,'vnpt_business_web','139704958fd3873918fe572ee7b1e0796728a67fcab55ba93e5b93e0ac845ee6','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-27 06:49:32','2026-02-27 14:49:30','2026-02-27 06:49:30','2026-02-27 06:49:32'),(56,'App\\Models\\InternalUser',4,'vnpt_business_web','50aca1613f0585055f2f9c2fb08eb61366e8776249ca7c0024f443f635745c81','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-27 06:51:08','2026-02-27 14:51:05','2026-02-27 06:51:05','2026-02-27 06:51:08'),(57,'App\\Models\\InternalUser',4,'vnpt_business_web','c52299d8b8922fb1f93b38c87d558f9b7ee916aeec53e6408e5ce41a74377f44','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-27 06:56:33','2026-02-27 14:56:32','2026-02-27 06:56:32','2026-02-27 06:56:33'),(58,'App\\Models\\InternalUser',4,'vnpt_business_web','5066ae9cd20409805459fc8a1f06fcc18b193f22eed597262a498206f67365e1','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-27 06:57:38','2026-02-27 14:57:35','2026-02-27 06:57:35','2026-02-27 06:57:38'),(59,'App\\Models\\InternalUser',4,'vnpt_business_web','dd77e83a55929bc8b15343794a40db047ffa8c2d79a06e8a00f52e67cad3d9d6','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-27 07:10:09','2026-02-27 15:10:07','2026-02-27 07:10:07','2026-02-27 07:10:09'),(60,'App\\Models\\InternalUser',1,'vnpt_business_web','7715e126a9a048ead2c891322bac479e4c3270d884d3bd9461c04cb16b4ea3ba','[\"*\"]','2026-02-27 19:28:58','2026-02-28 03:06:32','2026-02-27 19:06:32','2026-02-27 19:28:58'),(61,'App\\Models\\InternalUser',1,'vnpt_business_web','26e5747515bb9c39486f2a57b28075791555dc7358df84de8356ea8c57331a7f','[\"*\"]','2026-03-01 02:40:09','2026-03-01 03:35:59','2026-02-28 19:35:59','2026-03-01 02:40:09'),(65,'App\\Models\\InternalUser',10,'vnpt_business_web','670a669dad8880f70666219281b605ef6781f2a4ec83083a46038fdc2c4b8359','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"products.read\",\"customers.read\",\"projects.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.status\",\"support_requests.history\",\"user_dept_history.read\"]','2026-03-01 07:55:48','2026-03-01 15:55:17','2026-03-01 07:55:17','2026-03-01 07:55:48'),(68,'App\\Models\\InternalUser',1,'vnpt_business_web','13f2b773f79407d124425823f82e0c3f40bc5e53a364b801580fa25d45dab552','[\"*\"]','2026-03-02 12:53:18','2026-03-02 13:07:35','2026-03-02 05:07:35','2026-03-02 12:53:18'),(69,'App\\Models\\InternalUser',1,'vnpt_business_web','bfb42046d3c305a1802e9f5c34082ada4b5897cd5e3d1d2d4b665d8fb451a050','[\"*\"]','2026-03-03 09:11:52','2026-03-03 09:59:27','2026-03-03 01:59:27','2026-03-03 09:11:52'),(70,'App\\Models\\InternalUser',1,'vnpt_business_web','4353e0f1c9b5ee3e9fe6e9ec0978d1713c24297813ba4f013072658f39ec367b','[\"*\"]','2026-03-03 19:06:47','2026-03-03 23:48:40','2026-03-03 15:48:40','2026-03-03 19:06:47'),(72,'App\\Models\\InternalUser',7,'vnpt_business_access','b4b7e5fdeb36d2e813aec2340cfc456d809710c3ffdf5592946902c591cd7bc9','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\",\"audit_logs.read\",\"api.access\"]',NULL,'2026-03-04 06:05:56','2026-03-04 05:05:56','2026-03-04 05:05:56'),(73,'App\\Models\\InternalUser',7,'vnpt_business_refresh','1644db1368316f190cb9fb482d34fe5713329857aacb2021b8a0f798eee8ed9a','[\"auth.refresh\"]',NULL,'2026-03-11 05:05:56','2026-03-04 05:05:56','2026-03-04 05:05:56'),(213,'App\\Models\\InternalUser',9,'vnpt_business_access','2c7d75f7588c3bf8aa071efa7f9532cf9bcc214f7afbe1a9374316d34d72c8d3','[\"*\"]','2026-03-11 03:26:38','2026-03-11 04:25:10','2026-03-11 03:25:10','2026-03-11 03:26:38'),(214,'App\\Models\\InternalUser',9,'vnpt_business_refresh','25950c164ef324c84313b8faf2791208c743cc46a3caf5957165e3e014976ad8','[\"auth.refresh\"]',NULL,'2026-03-18 03:25:10','2026-03-11 03:25:10','2026-03-11 03:25:10');
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
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'VNPT_HIS3','Phần mềm VNPT HIS L3',3,1,150000000.00,'2026-02-23 08:16:35',NULL,'2026-03-01 17:29:01',9,NULL,1,NULL),(2,'SOC_MONITOR','Dịch vụ giám sát SOC',3,2,80000000.00,'2026-02-23 08:16:35',NULL,'2026-03-01 23:41:22',NULL,NULL,1,NULL),(3,'VNPT_LIS','Phần mềm VNPT LIS',3,1,550000.00,'2026-03-02 02:13:04',9,'2026-03-02 02:13:04',9,NULL,1,NULL),(4,'VNPT_RISPACS','Phần mềm VNPT RIS-PACS',3,1,100000000.00,'2026-03-02 02:13:04',9,'2026-03-02 02:13:04',9,NULL,1,NULL),(5,'VNPT_EMR','Phần mềm Bệnh án điện tử',3,1,100000000.00,'2026-03-02 02:13:05',9,'2026-03-02 02:13:05',9,NULL,1,NULL),(6,'VNPT_HMIS','Phần mềm HMIS',3,1,990000.00,'2026-03-02 02:13:05',9,'2026-03-02 02:13:05',9,NULL,1,NULL),(7,'VNPT_HIS2','Phần mềm VNPT HIS L2',3,1,100000000.00,'2026-03-02 02:13:05',9,'2026-03-02 02:13:05',9,NULL,1,NULL),(8,'VNPT_HIS4','Phần mềm VNPT HIS 4.0',3,1,100000000.00,'2026-03-02 02:13:05',9,'2026-03-02 02:13:05',9,NULL,1,NULL),(9,'VNPT_CKS','Chữ ký số SmartCA',3,1,100000000.00,'2026-03-02 02:13:05',9,'2026-03-02 02:13:05',9,NULL,1,NULL),(10,'SMOKE_SEC_1772626123','Smoke Security Product',3,1,100000.00,'2026-03-04 05:08:43',9,'2026-03-04 05:09:10',9,'smoke test',1,'2026-03-04 05:09:10');
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
) ENGINE=InnoDB AUTO_INCREMENT=142 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 29: Hạng mục chi tiết dự án';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_items`
--

LOCK TABLES `project_items` WRITE;
/*!40000 ALTER TABLE `project_items` DISABLE KEYS */;
INSERT INTO `project_items` VALUES (1,1,1,1.00,150000000.00,'2026-02-24 01:00:00',NULL,'2026-02-24 01:00:00',NULL,NULL),(2,2,2,1.00,80000000.00,'2026-02-24 01:05:00',NULL,'2026-02-24 01:05:00',NULL,NULL),(4,94,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(5,93,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(6,92,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(7,91,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(8,90,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(9,89,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(10,88,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(11,87,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(12,86,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(13,85,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(14,84,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(15,83,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(16,82,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(17,81,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(18,80,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(19,79,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(20,78,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(21,77,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(22,76,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(23,75,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(24,74,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(25,73,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(26,72,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(27,71,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(28,70,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(29,69,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(30,68,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(31,67,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(32,66,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(33,65,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(34,64,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(35,63,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(36,62,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(37,61,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(38,60,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(39,59,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(40,58,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(41,57,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(42,56,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(43,55,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(44,54,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(45,53,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(46,52,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(47,51,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(48,50,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(49,49,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(50,48,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(51,47,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(52,46,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(53,45,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(54,44,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(55,43,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(56,42,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(57,41,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(58,40,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(59,39,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(60,38,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(61,37,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(62,36,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(63,35,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(64,34,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(65,33,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(66,32,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(67,31,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(68,30,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(69,29,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(70,28,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(71,27,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(72,26,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(73,25,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(74,24,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(75,23,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(76,22,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(77,21,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(78,20,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(79,19,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(80,18,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(81,17,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(82,16,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(83,15,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(84,14,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(85,13,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(86,12,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(87,11,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(88,10,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(89,9,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(90,8,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(91,7,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(92,6,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(93,5,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(94,4,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(95,3,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(97,97,2,1.00,80000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(98,96,2,1.00,80000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(139,95,1,1.00,1500000.00,'2026-03-06 06:34:56',9,'2026-03-06 06:34:56',9,NULL),(140,95,3,10.00,550000.00,'2026-03-06 06:34:56',9,'2026-03-06 06:34:56',9,NULL),(141,98,1,1.00,150000000.00,'2026-03-06 06:53:06',9,'2026-03-06 06:53:06',9,NULL);
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
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (1,'DA001','Dự án VNPT HIS - Vietcombank',1,1,'DAU_TU','2026-01-10','2026-12-31','ONGOING','2026-02-23 08:16:35',NULL,'2026-02-26 20:29:04',1,NULL),(2,'DA002','Dự án SOC - Petrolimex',2,2,'THUE_DICH_VU','2026-02-01','2026-10-01','ONGOING','2026-02-23 08:16:35',NULL,'2026-02-26 04:48:05',1,NULL),(3,'DA098','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hỏa Tiế渁',98,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(4,'DA097','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hỏa Lựu',97,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(5,'DA096','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường Vị Tân',96,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(6,'DA095','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường VII',95,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(7,'DA094','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường V',94,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(8,'DA093','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường IV',93,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(9,'DA092','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường III',92,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(10,'DA091','Dự án Giải pháp VNPT HIS - Trạm y tế phường Vị Thanh',91,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(11,'DA090','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Thành',90,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(12,'DA089','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hiệp Lợi',89,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(13,'DA088','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường Hiệp Thành',88,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(14,'DA087','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường Lái Hiếu',87,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(15,'DA086','Dự án Giải pháp VNPT HIS - YTCQ Cty TNHH Lộc Tài II',86,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(16,'DA085','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vĩnh Thuận Đông',85,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(17,'DA084','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Trường Long A',84,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(18,'DA083','Dự án Giải pháp VNPT HIS - Trạm y tế thị trấn Cái Tắc',83,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(19,'DA082','Dự án Giải pháp VNPT HIS - Trạm y tế thị trấn Rạch Gòi',82,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(20,'DA081','Dự án Giải pháp VNPT HIS - Trạm Y tế Bảy Ngàn',81,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(21,'DA080','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Phú Thạnh',80,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(22,'DA079','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Thạnh Xuân',79,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(23,'DA078','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Nhơn Nghĩa A',78,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(24,'DA077','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Hòa',77,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(25,'DA076','Dự án Giải pháp VNPT HIS - Trạm Y tế Trường Long Tây',76,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(26,'DA075','Dự án Giải pháp VNPT HIS - Trạm Y tế Thị trấn Một Ngàn',75,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(27,'DA074','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa KV Phú Tân',74,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(28,'DA073','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Đông Phước A',73,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(29,'DA072','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Đông Phước',72,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(30,'DA071','Dự án Giải pháp VNPT HIS - Trạm Y tế xã Châu Thành',71,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(31,'DA070','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Phú Hữu',70,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(32,'DA069','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Đông Phú',69,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(33,'DA068','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Phú An',68,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(34,'DA067','Dự án Giải pháp VNPT HIS - Trạm Y tế xã Đông Phước',67,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(35,'DA066','Dự án Giải pháp VNPT HIS - Trạm Y tế Thị trấn Ngã Sáu',66,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(36,'DA065','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Đại Thành',65,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(37,'DA064','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường Ngã Bảy',64,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(38,'DA063','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Long',63,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(39,'DA062','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Phương Phú',62,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(40,'DA061','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Phước Hưng',61,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(41,'DA060','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hiệp Hưng',60,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(42,'DA059','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Phương Bình',59,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(43,'DA058','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hòa An',58,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(44,'DA057','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hòa Mỹ',57,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(45,'DA056','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Phụng Hiệp',56,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(46,'DA055','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Long Thạnh',55,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(47,'DA054','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Thạnh Hòa',54,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(48,'DA053','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Bình Thành',53,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(49,'DA052','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Bình',52,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(50,'DA051','Dự án Giải pháp VNPT HIS - Trạm Y tế Thị trấn Cây Dương',51,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(51,'DA049','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Lương Nghĩa',49,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(52,'DA048','Dự án Giải pháp VNPT HIS - Trạm Y tế phường Long Mỹ',48,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(53,'DA047','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vĩnh Viễn A',47,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(54,'DA046','Dự án Giải pháp VNPT HIS - Trạm y tế xã Thuận Hòa',46,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(55,'DA045','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Phú',45,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(56,'DA044','Dự án Giải pháp VNPT HIS - Trạm Y tế Thị trấn Trà Lồng',44,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(57,'DA043','Dự án Giải pháp VNPT HIS - Trạm y tế phường Trà Lồng',43,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(58,'DA042','Dự án Giải pháp VNPT HIS - Trạm Y tế xã Xà Phiên',42,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(59,'DA041','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Lương Tâm',41,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(60,'DA040','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vĩnh Viễn',40,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(61,'DA039','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Thuận Hưng',39,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(62,'DA038','Dự án Giải pháp VNPT HIS - Trạm Y tế phường Long Phú 1',38,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(63,'DA037','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Long Trị',37,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(64,'DA036','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Long Bình',36,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(65,'DA034','Dự án Giải pháp VNPT HIS - Trạm Y tế phường Long Bình',34,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(66,'DA033','Dự án Giải pháp VNPT HIS - Trạm y tế xã Vị Thanh 1',33,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(67,'DA032','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vị Bình',32,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(68,'DA031','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vị Đông',31,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(69,'DA030','Dự án Giải pháp VNPT HIS - Trạm y tế xã Vĩnh Tường',30,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(70,'DA029','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vĩnh Trung',29,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(71,'DA028','Dự án Giải pháp VNPT HIS - Trạm y tế xã Vĩnh Thuận Đông',28,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(72,'DA027','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vị Thắng',27,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(73,'DA026','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vị Thủy',26,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(74,'DA025','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vị Trung',25,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(75,'DA024','Dự án Giải pháp VNPT HIS - Trạm y tế xã Vị Thủy',24,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(76,'DA023','Dự án Giải pháp VNPT HIS - TTYT Dự phòng Tỉnh Hậu Giang',23,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(77,'DA022','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa Tâm Phúc Cần Thơ',22,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(78,'DA021','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa Medic Tây Đô',21,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(79,'DA020','Dự án Giải pháp VNPT HIS - PHÒNG KHÁM ĐA KHOA TÂM AN',20,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(80,'DA019','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa thuộc Trung tâm Y tế thành phố Vị Thanh',19,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(81,'DA018','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa CARE MEDIC CẦN THƠ',18,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(82,'DA017','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa Thiên Tâm',17,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(83,'DA015','Dự án Giải pháp VNPT HIS - Trung tâm Y tế Huyện Long Mỹ',15,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(84,'DA014','Dự án Giải pháp VNPT HIS - Bệnh viện đa khoa khu vực Ngã Bảy',14,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(85,'DA013','Dự án Giải pháp VNPT HIS - Trung tâm Y tế khu vực Châu Thành A',13,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(86,'DA012','Dự án Giải pháp VNPT HIS - Trung tâm Y tế Khu vực Châu Thành',12,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(87,'DA011','Dự án Giải pháp VNPT HIS - Trung tâm Y tế Thành phố Ngã Bảy',11,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(88,'DA010','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa KV Búng Tàu',10,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(89,'DA009','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa KV Kinh Cùng',9,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(90,'DA008','Dự án Giải pháp VNPT HIS - Trung tâm Y tế khu vực Phụng Hiệp',8,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(91,'DA007','Dự án Giải pháp VNPT HIS - Trung tâm Y tế khu vực Long Mỹ',7,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(92,'DA006','Dự án Giải pháp VNPT HIS - Trung tâm Y tế khu vực Vị Thủy',6,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(93,'DA005','Dự án Giải pháp VNPT HIS - Bệnh viện Phổi Hậu Giang',5,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(94,'DA004','Dự án Giải pháp VNPT HIS - Bệnh viện Tâm thần - Da liễu Hậu Giang',4,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(95,'DA003','Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang',3,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-03-06 06:01:00',9,NULL),(96,'DA050','Dự án Dịch vụ giám sát SOC - TYT phường Bình Thạnh',50,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(97,'DA035','Dự án Dịch vụ giám sát SOC - TYT P. Thuận An (TYT TT Long Mỹ)',35,NULL,'DAU_TU','2026-02-25','2026-11-25','CANCELLED','2026-02-25 08:21:11',NULL,'2026-02-26 07:31:46',1,NULL),(98,'DA016','Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang',16,NULL,'DAU_TU','2026-02-25','2027-11-25','WARRANTY','2026-02-25 08:21:11',NULL,'2026-03-06 06:53:06',9,NULL);
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
-- Dumping data for table `raci_assignments`
--

LOCK TABLES `raci_assignments` WRITE;
/*!40000 ALTER TABLE `raci_assignments` DISABLE KEYS */;
INSERT INTO `raci_assignments` VALUES (5,'project',95,9,'A','2026-03-06 06:34:56',9,'2026-03-06 06:34:56',9),(6,'project',95,9,'R','2026-03-06 06:34:56',9,'2026-03-06 06:34:56',9),(7,'project',95,16,'R','2026-03-06 06:34:56',9,'2026-03-06 06:34:56',9),(8,'project',95,10,'R','2026-03-06 06:34:56',9,'2026-03-06 06:34:56',9);
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
-- Dumping data for table `reminders`
--

LOCK TABLES `reminders` WRITE;
/*!40000 ALTER TABLE `reminders` DISABLE KEYS */;
INSERT INTO `reminders` VALUES (1,'Gửi báo cáo tuần cho khách hàng','Tổng hợp tiến độ và gửi báo cáo tuần.',NULL,NULL,'2026-02-24 09:00:00',1,0,'ACTIVE','2026-02-23 08:16:35',NULL,'2026-03-01 14:16:56',NULL),(2,'Nhắc lịch họp kickoff dự án','Chuẩn bị nội dung họp kickoff với khách hàng.',NULL,NULL,'2026-02-26 14:00:00',1,0,'ACTIVE','2026-02-23 08:16:35',NULL,'2026-03-01 14:16:56',NULL);
/*!40000 ALTER TABLE `reminders` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `request_raci`
--

LOCK TABLES `request_raci` WRITE;
/*!40000 ALTER TABLE `request_raci` DISABLE KEYS */;
/*!40000 ALTER TABLE `request_raci` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `request_raci_assignments`
--

LOCK TABLES `request_raci_assignments` WRITE;
/*!40000 ALTER TABLE `request_raci_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `request_raci_assignments` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `request_ref_tasks`
--

LOCK TABLES `request_ref_tasks` WRITE;
/*!40000 ALTER TABLE `request_ref_tasks` DISABLE KEYS */;
INSERT INTO `request_ref_tasks` VALUES (1,'TRANSITION',2,'YC03033','REFERENCE','SMK-TASK-1',NULL,NULL,NULL,'TODO',0,'2026-03-03 16:54:53',1,'2026-03-08 01:44:35',1,NULL),(2,'TRANSITION',3,'YC03033','REFERENCE','SMK-TASK-2','https://example.com/task/2',NULL,NULL,'IN_PROGRESS',0,'2026-03-03 16:54:53',1,'2026-03-08 01:44:35',1,NULL),(3,'TRANSITION',13,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:52:18',9,'2026-03-08 01:44:35',9,NULL),(4,'TRANSITION',13,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',1,'2026-03-05 00:52:18',9,'2026-03-08 01:44:35',9,NULL),(5,'TRANSITION',13,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:52:18',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(6,'TRANSITION',13,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',1,'2026-03-05 00:52:18',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(7,'TRANSITION',13,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:52:18',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(8,'TRANSITION',13,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',1,'2026-03-05 00:52:18',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(9,'TRANSITION',13,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:52:18',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(10,'TRANSITION',13,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',1,'2026-03-05 00:52:18',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(11,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,NULL),(12,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',1,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,NULL),(13,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',2,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,NULL),(14,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',3,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,NULL),(15,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',4,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,NULL),(16,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',5,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,NULL),(17,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',6,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,NULL),(18,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',7,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,NULL),(19,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(20,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',1,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(21,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',2,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(22,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',3,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(23,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',4,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(24,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',5,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(25,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',6,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(26,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',7,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(27,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(28,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',1,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(29,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',2,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(30,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',3,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(31,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',4,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(32,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',5,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(33,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',6,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(34,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',7,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(35,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(36,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',1,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(37,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',2,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(38,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',3,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(39,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',4,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(40,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',5,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(41,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',6,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(42,'TRANSITION',14,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',7,'2026-03-05 00:55:59',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(43,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(44,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',1,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(45,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',2,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(46,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',3,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(47,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',4,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(48,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',5,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(49,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',6,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(50,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',7,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(51,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',8,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(52,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',9,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(53,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',10,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(54,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',11,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(55,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',12,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(56,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',13,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(57,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',14,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(58,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',15,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(59,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',16,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(60,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',17,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(61,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',18,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(62,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',19,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(63,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',20,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(64,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',21,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(65,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',22,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(66,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',23,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(67,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',24,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(68,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',25,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(69,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',26,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(70,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',27,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(71,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',28,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(72,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',29,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(73,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',30,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(74,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',31,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(75,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',32,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(76,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',33,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(77,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',34,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(78,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',35,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(79,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',36,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(80,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',37,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(81,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',38,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(82,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',39,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,NULL),(83,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(84,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',1,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(85,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',2,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(86,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',3,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(87,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',4,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(88,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',5,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(89,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',6,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(90,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',7,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(91,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',8,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(92,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',9,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(93,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',10,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(94,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',11,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(95,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',12,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(96,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',13,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(97,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',14,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(98,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',15,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(99,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',16,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(100,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',17,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(101,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',18,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(102,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',19,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(103,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',20,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(104,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',21,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(105,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',22,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(106,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',23,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(107,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',24,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(108,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',25,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(109,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',26,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(110,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',27,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(111,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',28,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(112,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',29,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(113,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',30,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(114,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',31,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(115,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',32,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(116,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',33,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(117,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',34,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(118,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',35,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(119,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',36,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(120,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',37,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(121,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',38,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(122,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',39,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(123,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(124,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',1,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(125,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',2,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(126,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',3,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(127,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',4,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(128,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',5,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(129,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',6,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(130,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',7,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(131,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',8,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(132,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',9,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(133,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',10,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(134,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',11,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(135,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',12,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(136,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',13,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(137,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',14,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(138,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',15,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(139,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',16,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(140,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',17,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(141,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',18,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(142,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',19,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(143,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',20,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(144,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',21,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(145,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',22,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(146,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',23,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(147,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',24,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(148,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',25,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(149,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',26,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(150,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',27,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(151,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',28,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(152,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',29,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(153,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',30,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(154,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',31,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(155,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',32,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(156,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',33,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(157,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',34,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(158,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',35,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(159,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',36,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(160,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',37,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(161,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',38,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(162,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',39,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(163,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',0,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(164,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',1,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(165,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',2,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(166,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',3,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(167,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',4,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(168,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',5,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(169,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',6,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(170,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',7,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(171,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',8,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(172,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',9,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(173,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',10,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(174,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',11,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(175,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',12,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(176,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',13,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(177,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',14,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(178,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',15,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(179,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',16,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(180,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',17,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(181,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',18,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(182,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',19,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(183,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',20,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(184,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',21,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(185,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',22,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(186,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT',NULL,NULL,'TODO',23,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(187,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',24,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(188,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',25,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(189,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',26,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(190,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',27,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(191,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',28,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(192,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',29,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(193,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',30,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(194,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',31,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(195,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',32,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(196,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',33,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(197,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',34,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(198,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',35,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(199,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',36,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(200,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',37,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(201,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',38,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57'),(202,'TRANSITION',15,'YC03058','REFERENCE','It3601','Link IT01',NULL,NULL,'IN_PROGRESS',39,'2026-03-05 00:57:16',9,'2026-03-08 01:44:35',9,'2026-03-07 04:31:57');
/*!40000 ALTER TABLE `request_ref_tasks` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử chuyển trạng thái + Dynamic form (YCHT+YCLT gộp). 1 row = 1 lần submit GD1-GD18.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `request_transitions`
--

LOCK TABLES `request_transitions` WRITE;
/*!40000 ALTER TABLE `request_transitions` DISABLE KEYS */;
INSERT INTO `request_transitions` VALUES (2,'2afb8237-d496-4641-84d6-51baedf1c3ef','YC03033','SMOKE HUB CREATE 20260303_235453',NULL,1,1,1,NULL,'MOI_TIEP_NHAN',NULL,1,NULL,'{\"smoke\": true}',NULL,NULL,'Smoke test create',NULL,'2026-03-03 16:54:53',1,'2026-03-03 16:54:53',1,NULL,NULL,0),(3,'2efe8726-5a51-4ec4-a30a-89f2c966e7d0','YC03033','SMOKE HUB CREATE 20260303_235453 UPDATED',NULL,1,1,1,'MOI_TIEP_NHAN','MOI_TIEP_NHAN',NULL,1,NULL,'[]',NULL,NULL,'Smoke test update',NULL,'2026-03-03 16:54:53',1,'2026-03-03 16:54:53',1,NULL,NULL,0),(4,'c3ba7f00-69cc-40f3-8f37-d9484046e31c','YC03034','N/A',NULL,NULL,NULL,NULL,NULL,'MOI_TIEP_NHAN',NULL,NULL,NULL,'[]',NULL,NULL,'Smoke import row',NULL,'2026-03-03 16:54:53',1,'2026-03-03 16:54:53',1,NULL,NULL,0),(5,'1cf3a3c0-88a0-464f-bfea-545101abb92e','YC03045','aaaaaaaaa',NULL,35,97,97,NULL,'MOI_TIEP_NHAN',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2026-03-04 07:39:30',9,'2026-03-04 07:39:30',9,NULL,NULL,0),(6,'32ff9337-a815-44d5-b284-366a9e217b78','YC03046','bbbbbbbbbbbbbbbbbbbbb',NULL,50,96,98,NULL,'LAP_TRINH','DANG_THUC_HIEN',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2026-03-04 07:40:41',9,'2026-03-04 07:40:41',9,NULL,NULL,0),(7,'e19b9c71-bd76-4b7f-a236-109cc38df437','YC03047','aaaaaaaaaaaaaaacccccccccccccccc',NULL,35,97,97,NULL,'LAP_TRINH','HOAN_THANH',NULL,NULL,'{\"completion_date\": \"2026-03-04\"}',NULL,NULL,NULL,NULL,'2026-03-04 07:43:54',9,'2026-03-04 07:43:54',9,NULL,NULL,0),(8,'2c21b9ab-8c20-46b6-8d99-4accd4171877','YC03046','bbbbbbbbbbbbbbbbbbbbb',NULL,50,96,98,'LAP_TRINH','LAP_TRINH','HOAN_THANH',NULL,NULL,'{\"completion_date\": \"2026-03-04\", \"field_ngihoanthanh\": \"50\"}',NULL,NULL,NULL,NULL,'2026-03-04 16:47:35',9,'2026-03-04 16:47:35',9,NULL,NULL,0),(9,'3cc8decf-8702-4a94-a75e-cd4a0af94cdc','YC03046','bbbbbbbbbbbbbbbbbbbbb',NULL,50,96,98,'LAP_TRINH','LAP_TRINH','TAM_NGUNG',NULL,NULL,'{\"pause_date\": \"05/03/2026\", \"pause_reason\": \"Tạm ngưng do bệnh cá nhân\"}',NULL,NULL,NULL,NULL,'2026-03-04 18:53:55',9,'2026-03-04 18:53:55',9,NULL,NULL,0),(10,'2f0c8bf1-e227-4298-9aeb-2ed3e17bdcc5','YC03046','bbbbbbbbbbbbbbbbbbbbb',NULL,50,96,98,'LAP_TRINH','LAP_TRINH','TAM_NGUNG',NULL,NULL,'{\"progress\": 10, \"pause_date\": \"05/03/2026\", \"pause_reason\": \"Tạm ngưng do bệnh cá nhân 1\"}',NULL,NULL,NULL,NULL,'2026-03-04 19:44:17',9,'2026-03-04 19:44:17',9,NULL,NULL,0),(11,'e8796292-bc0a-4837-b200-0771a637d10f','YC03047','aaaaaaaaaaaaaaacccccccccccccccc',NULL,35,97,97,'LAP_TRINH','LAP_TRINH','UPCODE',NULL,NULL,'{\"upcode_date\": \"2026-03-05\", \"upcode_status\": \"SUCCESS\", \"completion_date\": \"2026-03-04\"}',NULL,NULL,NULL,NULL,'2026-03-04 20:11:38',9,'2026-03-04 20:11:38',9,NULL,NULL,0),(12,'755b69eb-d702-4b47-961f-978cc4578d00','YC03046','bbbbbbbbbbbbbbbbbbbbb',NULL,50,96,98,'LAP_TRINH','LAP_TRINH','TAM_NGUNG',NULL,NULL,'{\"progress\": 15, \"pause_date\": \"05/03/2026\", \"pause_reason\": \"Tạm ngưng do bệnh cá nhân 1\"}',NULL,NULL,NULL,NULL,'2026-03-04 20:16:14',9,'2026-03-04 20:16:14',9,NULL,NULL,0),(13,'e3119d86-9071-46e7-8d1f-92f07c2edf00','YC03058','Lỗi LIS',NULL,16,98,131,NULL,'MOI_TIEP_NHAN',NULL,52,NULL,'[]',NULL,NULL,NULL,NULL,'2026-03-05 00:52:17',9,'2026-03-05 00:52:17',9,NULL,NULL,0),(14,'a6f442e0-21a2-46a9-beb7-e578a5a34852','YC03058','Lỗi LIS',NULL,16,98,131,'MOI_TIEP_NHAN','MOI_TIEP_NHAN',NULL,51,NULL,'[]',NULL,NULL,NULL,NULL,'2026-03-05 00:55:59',9,'2026-03-05 00:55:59',9,NULL,NULL,0),(15,'02e96819-7d59-4264-a3b9-7dcc0e817329','YC03058','Lỗi LIS',NULL,16,98,131,'MOI_TIEP_NHAN','DANG_XU_LY',NULL,51,NULL,'[]',NULL,NULL,NULL,NULL,'2026-03-05 00:57:16',9,'2026-03-05 00:57:16',9,NULL,NULL,0),(17,'9d4c9582-97ac-4db7-b62a-fd9c6f1ea7f2','YC030810','Lỗi rồi',NULL,3,95,140,NULL,'MOI_TIEP_NHAN',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2026-03-08 03:06:27',9,'2026-03-08 03:06:27',9,NULL,NULL,0),(18,'43e6d0f3-e01b-467d-8d7b-bde0f143b933','YC030811','Lỗi hệ thống',NULL,3,95,140,NULL,'MOI_TIEP_NHAN',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2026-03-08 05:15:07',9,'2026-03-08 05:15:07',9,NULL,NULL,0),(19,'9c2dfcdc-2d0d-4464-a2be-f1ff1a829ff0','YC030811','Lỗi hệ thống',NULL,3,95,140,'MOI_TIEP_NHAN','MOI_TIEP_NHAN',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2026-03-09 05:15:15',9,'2026-03-09 05:15:15',9,NULL,NULL,0),(20,'9fa780ae-af02-4e34-b26f-c9a1b7d68789','YC030810','Lỗi rồi -upfile',NULL,3,95,140,'MOI_TIEP_NHAN','MOI_TIEP_NHAN',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2026-03-09 05:15:55',9,'2026-03-09 05:15:55',9,NULL,NULL,0),(21,'ce084665-a285-4476-a517-65f9104d032d','YC030810','Lỗi rồi -upfile',NULL,3,95,140,'MOI_TIEP_NHAN','MOI_TIEP_NHAN',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2026-03-09 06:38:13',9,'2026-03-09 06:38:13',9,NULL,NULL,0);
/*!40000 ALTER TABLE `request_transitions` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `request_worklogs`
--

LOCK TABLES `request_worklogs` WRITE;
/*!40000 ALTER TABLE `request_worklogs` DISABLE KEYS */;
/*!40000 ALTER TABLE `request_worklogs` ENABLE KEYS */;
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
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('1GsBAoHzaNhfd4yDYURlVVRGLUSn7CtD6hs7EwGE',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiNTlteGs1cHB4c0swdUlJa1BsWGM5cXV0MTVySEdkc3JGOWpZUnJ1eSI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772931254),('5DQGKxVbkc8fWi7m3cJoE3Y1T9oHgyPxv7EM00Sj',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiZElqRUlMS0U2eXNTS0gzYUJDOGZFZGdDV29IVXVWMVg4b0VYWDRkTiI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772931209),('82flhBrKvobD9tVqr5PUt9Lx9Giymdx9BmYoXqBa',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoiNW5DelRuS1RKQUdRRGVrUmVXaVJjNjVDSnR4V3hMSFh1ZmFnV3JDaSI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMSI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772928444),('Bq4PNTAE3bqj4oDaolKi3KmYoKaunDtIZfICVECU',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoicGQwRE9yd1p1T3BCVmVxUXFXZjkyUnBmcDRNTHpVNHpnUEpZS1BSQiI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMiI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1773047108),('CNAkWCrvumyVPxEvw4xOwLaBi9tIJ92paleIfnAt',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoiT0RzQUlnNnA0WDZPU2hVV2IwOUxMaTM5alI5dzk3ZmJwb3pnYTQ3OCI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMSI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772928549),('eeCX6nUfjdAAaJi8YWIW42fZi9f1vkFJEMbmFGo8',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','YTozOntzOjY6Il90b2tlbiI7czo0MDoibklEcHZxREw0dUlGWWR3RXlHdER2Um16MnY0N0ZMMXU0WUNrN0hNQyI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMiI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1773031152),('eJXfmG65Dy475QVKbZXPiwcg5h6KHHV79GsJYnPI',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiM1pDSHVKS2JTNnY3bmhYOEhMYW9VcU0zd2R2V0Uxd2VDbUJOZWVyYyI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1773049570),('g6hVxIR9We58gV6i3ngMK8tx5oyIsRbtD31TyVLw',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiZU9ENnd0SU9YYXJ4bzk3WVRIbUNWVEU4RjBGcnRaa2xCUnFjVld5aSI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1773053254),('gbWDBGzWmSBZQO2IyulTDq9lT4wCnWR3LpFnTyWq',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiZXRwb251OEJzMEpjU3FJV1paY1BsMDNVaDF1WXNIelNlMGFySWNxYyI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1773197680),('InXUdAjRDF3bEjpfNudZ89LEvfvcT0nvk1UkVWEh',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiVVV5a2dlcEJoVGhDT0NsZ1NocGpYNE9pbUlreTBuYzhtV3I0U3Y1ZiI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1773042988),('NMXw6hXWZCdoY5ykoqc5GN3Ku7TCqZVT7g8VdWLm',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','YTozOntzOjY6Il90b2tlbiI7czo0MDoiN2p0RU1TSlV0M3RPdlZEaFljazFDekZObGNpTnNkRmU5M200TXh4YiI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMiI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772944443),('ouPkTJce78DLKrvU4vos5W3s2Bh6AezCdBIcUuD9',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiSlVPMnh5eHR5TXhpNlRsM1A2Wk1KT2k5QURWT0NHa3dsMndQdGltViI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1773014100),('rcNkvjBHSfNQG9hUMGSPp6ipNTljU6dWub41aKHN',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiTFJPa0VVT1d2S1J1b3JtNllKN3Z6VjRicTZ0SnZqUzk5aEJCY0VjUCI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772931017),('t5VbwdrBNwHsk4qyYC0DnGp3emZxrCqmRlRmwG3s',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiYU5aYlZyMDk1OExNdGxuTDBCaW5CTDAzVk90RTJSSnVpbDVEcmhSaiI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1773188222),('xO5w7I8RrTZJL8IMNZjvOZJu74U46feOn7QDMhmy',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiZzhGeFBFUDNYWUJBYWh1OHBFSWswclgzOVNHeDk4UjNLSWJOZmo1aSI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1773027481),('ZNkfo7w1Ezj0AftAs8RnC26pxc8tKL9EdRszcHAC',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiUUM5V29zVGdvZkNTWFNsYjk4Qm90a3hoZjZoTEtkNjIzQ0JFM0lzUiI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1773030553);
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `sla_configs`
--

LOCK TABLES `sla_configs` WRITE;
/*!40000 ALTER TABLE `sla_configs` DISABLE KEYS */;
INSERT INTO `sla_configs` VALUES (1,'IN_PROGRESS',NULL,NULL,'URGENT',2.00,NULL,1.00,2.00,1,0,'2026-03-03 03:56:50','2026-03-03 09:58:32',NULL,NULL),(2,'IN_PROGRESS',NULL,NULL,'HIGH',4.00,NULL,2.00,4.00,1,0,'2026-03-03 03:56:50','2026-03-03 09:58:32',NULL,NULL),(3,'IN_PROGRESS',NULL,NULL,'MEDIUM',8.00,NULL,4.00,8.00,1,0,'2026-03-03 03:56:50','2026-03-03 09:58:32',NULL,NULL),(4,'IN_PROGRESS',NULL,NULL,'LOW',24.00,NULL,8.00,24.00,1,0,'2026-03-03 03:56:50','2026-03-03 09:58:32',NULL,NULL);
/*!40000 ALTER TABLE `sla_configs` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `support_contact_positions`
--

LOCK TABLES `support_contact_positions` WRITE;
/*!40000 ALTER TABLE `support_contact_positions` DISABLE KEYS */;
INSERT INTO `support_contact_positions` VALUES (1,'GIAM_DOC','Giám đốc',NULL,1,NULL,NULL,'2026-03-02 07:09:30','2026-03-02 07:09:30'),(2,'TRUONG_PHONG','Trưởng phòng',NULL,1,NULL,NULL,'2026-03-02 07:09:30','2026-03-02 07:09:30'),(3,'DAU_MOI','Đầu mối',NULL,1,NULL,NULL,'2026-03-02 07:09:31','2026-03-02 07:09:31');
/*!40000 ALTER TABLE `support_contact_positions` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `support_request_statuses`
--

LOCK TABLES `support_request_statuses` WRITE;
/*!40000 ALTER TABLE `support_request_statuses` DISABLE KEYS */;
INSERT INTO `support_request_statuses` VALUES (1,'NEW','Mới tiếp nhận','Yêu cầu vừa được ghi nhận',0,0,0,1,10,NULL,NULL,'2026-02-27 06:04:03','2026-02-27 06:04:03'),(2,'IN_PROGRESS','Đang xử lý','Yêu cầu đang được thực hiện',1,0,0,1,20,NULL,NULL,'2026-02-27 06:04:03','2026-02-27 06:04:03'),(3,'WAITING_CUSTOMER','Chờ phản hồi KH','Đang chờ khách hàng phản hồi',1,0,0,1,30,NULL,NULL,'2026-02-27 06:04:03','2026-02-27 06:04:03'),(4,'COMPLETED','Hoàn thành','Yêu cầu đã hoàn tất',1,1,0,1,40,NULL,NULL,'2026-02-27 06:04:03','2026-02-27 06:04:03'),(5,'PAUSED','Tạm dừng','Yêu cầu tạm dừng xử lý',1,0,0,1,50,NULL,NULL,'2026-02-27 06:04:03','2026-02-27 06:04:03'),(6,'TRANSFER_DEV','Chuyển Dev','Yêu cầu chuyển cho đội phát triển',1,0,1,1,60,NULL,NULL,'2026-02-27 06:04:03','2026-02-28 22:14:03'),(7,'TRANSFER_DMS','Chuyển DMS','Yêu cầu chuyển sang đội DMS',1,0,0,1,70,NULL,NULL,'2026-02-27 06:04:03','2026-02-27 06:04:03'),(8,'UNABLE_TO_EXECUTE','Không thực hiện được','Không thể thực hiện yêu cầu',1,1,0,1,80,NULL,NULL,'2026-02-27 06:04:03','2026-02-27 06:04:03'),(9,'WAITTING_NHAP','NHAP_CHO',NULL,1,0,0,1,0,NULL,NULL,'2026-02-27 07:15:05','2026-02-27 07:15:05'),(10,'NHAP_BATBUOC','Bắt buộc nhập Hạn',NULL,1,0,0,1,0,NULL,NULL,'2026-02-27 07:15:45','2026-02-27 07:15:45'),(11,'DEV_CODE','Chuyển Dev code',NULL,1,0,0,1,0,NULL,NULL,'2026-02-27 19:07:35','2026-02-27 19:07:35'),(12,'DEV','TEST-DEV',NULL,1,0,1,1,0,NULL,NULL,'2026-03-02 02:55:24','2026-03-02 02:55:24'),(13,'PHAN_TICH','Phân tích',NULL,1,0,0,1,0,NULL,NULL,'2026-03-02 03:09:43','2026-03-02 03:09:43');
/*!40000 ALTER TABLE `support_request_statuses` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `support_service_groups`
--

LOCK TABLES `support_service_groups` WRITE;
/*!40000 ALTER TABLE `support_service_groups` DISABLE KEYS */;
INSERT INTO `support_service_groups` VALUES (1,'HIS L2','HIS_L2',NULL,'Hỗ trợ hướng dẫn, cấu hình tham số, xử lý dữ liệu đơn giản',1,'2026-02-24 13:41:34',NULL,'2026-03-01 05:14:03',NULL),(2,'HIS L3','HIS_L3',NULL,'Đội lập trình fix lỗi logic, hotfix core phần mềm HIS',1,'2026-02-24 13:41:34',NULL,'2026-03-01 05:14:03',NULL),(3,'UPCODE VĂN BẢN','UPCODE_VAN_BAN',NULL,'Cập nhật tính năng theo các Thông tư, Quyết định mới (VD: CV130)',1,'2026-02-24 13:41:34',NULL,'2026-03-01 05:14:03',NULL),(4,'EMR-Bệnh viện Sản Nhi','EMR_BENH_VIEN_SAN_NHI',3,'EMR-Bệnh viện Sản Nhi',1,'2026-02-24 13:41:34',NULL,'2026-03-07 05:01:40',9),(5,'HOÀN THIỆN PHẦN MỀM','HOAN_THIEN_PHAN_MEM',NULL,'Yêu cầu nâng cấp, tối ưu chức năng hiện có',1,'2026-02-24 13:41:34',NULL,'2026-03-01 05:14:03',NULL),(6,'Hiss Bệnh Viện Sản Nhi','DOI_LIS_EMR',3,'Hỗ trợ chuyên sâu cho hệ thống Xét nghiệm và Bệnh án điện tử',1,'2026-02-24 13:41:34',NULL,'2026-03-07 05:02:58',9),(13,'HIS L34','HIS_L34',NULL,'His bản 34',1,'2026-02-24 07:41:29',NULL,'2026-03-01 05:14:03',NULL),(14,'Trung tâm Y tế Vị Thuỷ','TRUNG_TAM_Y_TE_VI_THUY',NULL,'Mô tả',1,'2026-02-26 21:31:12',NULL,'2026-02-26 21:31:12',NULL),(15,'HISs Viện phí SẢN NHI','HISS_VIEN_PHI_SAN_NHI',3,'Bản his',1,'2026-02-27 02:29:47',NULL,'2026-03-07 05:03:42',9),(16,'SMOKE-GROUP-1772184820-A','SMOKE_GROUP_1772184820_A',NULL,'bulk smoke A',1,'2026-02-27 02:33:41',NULL,'2026-02-27 02:33:41',NULL),(17,'SMOKE-GROUP-1772184820-B','SMOKE_GROUP_1772184820_B',NULL,'bulk smoke B',1,'2026-02-27 02:33:41',NULL,'2026-02-27 02:33:41',NULL);
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
-- Dumping data for table `user_dept_history`
--

LOCK TABLES `user_dept_history` WRITE;
/*!40000 ALTER TABLE `user_dept_history` DISABLE KEYS */;
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
-- Dumping data for table `user_dept_scopes`
--

LOCK TABLES `user_dept_scopes` WRITE;
/*!40000 ALTER TABLE `user_dept_scopes` DISABLE KEYS */;
INSERT INTO `user_dept_scopes` VALUES (12,1,1,'ALL','2026-03-01 15:49:42',1,NULL,NULL),(13,1,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(14,7,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(15,8,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(16,9,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(17,10,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(18,11,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(19,12,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(20,13,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(21,14,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(22,15,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(23,16,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(24,17,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(25,18,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(26,19,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(27,20,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(28,21,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(29,22,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(30,23,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(31,24,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(32,25,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(33,26,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(34,27,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(35,28,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(36,29,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(37,30,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(38,31,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(39,32,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(40,33,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(41,34,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(42,35,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(43,36,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(44,37,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(45,38,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(46,39,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(47,40,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(48,41,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(49,42,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(50,43,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(51,44,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(52,45,2,'DEPT_ONLY','2026-03-01 15:49:42',1,NULL,NULL),(53,46,2,'DEPT_ONLY','2026-03-01 15:49:43',1,NULL,NULL),(54,47,2,'DEPT_ONLY','2026-03-01 15:49:43',1,NULL,NULL),(55,48,2,'DEPT_ONLY','2026-03-01 15:49:43',1,NULL,NULL),(56,49,2,'DEPT_ONLY','2026-03-01 15:49:43',1,NULL,NULL),(57,50,2,'DEPT_ONLY','2026-03-01 15:49:43',1,NULL,NULL),(58,51,2,'DEPT_ONLY','2026-03-01 15:49:43',1,NULL,NULL),(59,52,2,'DEPT_ONLY','2026-03-01 15:49:43',1,NULL,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 16: Quyền ngoại lệ cho cá nhân';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_permissions`
--

LOCK TABLES `user_permissions` WRITE;
/*!40000 ALTER TABLE `user_permissions` DISABLE KEYS */;
INSERT INTO `user_permissions` VALUES (3,7,61,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-01 15:48:33',1,NULL,NULL),(4,8,61,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-01 15:48:33',1,NULL,NULL),(13,16,1,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-10 19:56:42',9,NULL,NULL),(14,16,13,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-10 19:56:42',9,NULL,NULL),(15,16,49,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-10 19:56:42',9,NULL,NULL),(16,16,50,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-10 19:56:42',9,NULL,NULL),(17,16,51,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-10 19:56:42',9,NULL,NULL),(18,16,52,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-10 19:56:42',9,NULL,NULL),(19,16,54,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-10 19:56:42',9,NULL,NULL),(20,16,61,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-10 19:56:42',9,NULL,NULL),(21,16,65,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-10 19:56:42',9,NULL,NULL),(22,16,66,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-10 19:56:42',9,NULL,NULL),(23,16,67,'GRANT','Phân quyền cập nhật từ giao diện',NULL,'2026-03-10 19:56:42',9,NULL,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 15: Gán vai trò cho người dùng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (10,1,1,NULL,1,'2026-03-01 08:10:52',1,NULL,NULL),(11,1,4,NULL,1,'2026-03-01 08:10:52',1,NULL,NULL),(13,11,4,NULL,1,'2026-03-01 08:10:52',1,NULL,NULL),(14,12,4,NULL,1,'2026-03-01 08:10:52',1,NULL,NULL),(15,13,4,NULL,1,'2026-03-01 08:10:52',1,NULL,NULL),(16,14,4,NULL,1,'2026-03-01 08:10:52',1,NULL,NULL),(17,15,4,NULL,1,'2026-03-01 08:10:52',1,NULL,NULL),(19,17,4,NULL,1,'2026-03-01 08:10:52',1,NULL,NULL),(20,18,4,NULL,1,'2026-03-01 08:10:52',1,NULL,NULL),(21,19,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(22,20,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(23,21,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(24,22,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(25,23,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(26,24,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(27,25,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(28,26,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(29,27,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(30,28,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(31,29,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(32,30,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(33,31,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(34,32,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(35,33,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(36,34,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(37,35,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(38,36,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(39,37,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(40,38,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(41,39,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(42,40,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(43,41,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(44,42,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(45,43,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(46,44,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(47,45,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(48,46,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(49,47,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(50,48,4,NULL,1,'2026-03-01 08:10:53',1,NULL,NULL),(51,49,4,NULL,1,'2026-03-01 08:10:54',1,NULL,NULL),(52,50,4,NULL,1,'2026-03-01 08:10:54',1,NULL,NULL),(53,51,4,NULL,1,'2026-03-01 08:10:54',1,NULL,NULL),(54,52,4,NULL,1,'2026-03-01 08:10:54',1,NULL,NULL),(55,9,1,NULL,1,'2026-03-01 08:11:08',1,NULL,NULL),(56,9,2,NULL,1,'2026-03-01 08:11:08',1,NULL,NULL),(57,9,3,NULL,1,'2026-03-01 08:11:08',1,NULL,NULL),(58,9,4,NULL,1,'2026-03-01 08:11:08',1,NULL,NULL),(60,7,3,NULL,1,'2026-03-01 15:49:28',1,NULL,NULL),(61,8,3,NULL,1,'2026-03-01 15:49:28',1,NULL,NULL),(64,16,1,NULL,1,'2026-03-10 19:55:18',9,NULL,NULL),(65,16,4,NULL,1,'2026-03-10 19:55:18',9,NULL,NULL),(66,10,1,NULL,1,'2026-03-10 20:00:27',9,NULL,NULL),(67,10,4,NULL,1,'2026-03-10 20:00:27',9,NULL,NULL);
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
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,'DMS','Trung tâm DMS',1,'2026-02-23 08:16:35',NULL,'2026-03-01 16:38:12',NULL,NULL),(2,'NNS','Trung tâm Nông nghiệp số',1,'2026-02-23 08:16:35',NULL,'2026-03-01 16:38:28',NULL,NULL),(3,'GDS','Trung tâm Giáo dục số',1,'2026-03-01 16:38:49',NULL,'2026-03-01 16:38:49',NULL,NULL);
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `workflow_form_field_configs`
--

LOCK TABLES `workflow_form_field_configs` WRITE;
/*!40000 ALTER TABLE `workflow_form_field_configs` DISABLE KEYS */;
INSERT INTO `workflow_form_field_configs` VALUES (1,1,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(2,1,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(3,1,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(4,1,'field_ngiyeucu','Người yêu cầu','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(5,1,'field_nhomhtr','Nhóm hỗ trợ','text',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(6,1,'field_ngitipnhn','Người tiếp nhận','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(7,1,'field_ngaytipnhan','Ngày tiếp nhân','text',0,70,'K',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(8,1,'field_ngixly','Người xử lý','text',0,80,'L',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(9,1,'field_mataskthamchiu','Mã task tham chiếu','text',0,90,'M',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(10,1,'notes','Ghi chú','textarea',0,100,'N',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(11,2,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(12,2,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(13,2,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(14,2,'field_ngiyeucu','Người yêu cầu','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(15,2,'field_nhomhtr','Nhóm hỗ trợ','text',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(16,2,'field_ngitipnhn','Người tiếp nhận','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(17,2,'field_ngaytipnhan','Ngày tiếp nhân','text',0,70,'K',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(18,2,'field_ngixly','Người xử lý','text',0,80,'L',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(19,2,'exchange_date','Ngày trao đổi với khách hàng','date',1,90,'M',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-08 01:16:16',NULL),(20,2,'exchange_content','Nội dung trao đổi','textarea',1,100,'N',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 21:04:13',NULL),(21,2,'customer_feedback_date','Ngày khách hàng phản hồi','date',0,110,'O',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 04:31:57',NULL),(22,2,'customer_feedback_content','Nội dung khách hàng phản hồi','textarea',0,120,'P',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 04:31:57',NULL),(23,2,'field_mataskthamchiu','Mã task tham chiếu','text',0,130,'Q',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(24,2,'notes','Ghi chú','textarea',0,140,'R',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(25,3,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(26,3,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(27,3,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(28,3,'field_ngiyeucu','Người yêu cầu','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(29,3,'field_nhomhtr','Nhóm hỗ trợ','text',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(30,3,'field_ngitipnhn','Người tiếp nhận','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(31,3,'field_ngaytipnhan','Ngày tiếp nhân','text',0,70,'K',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(32,3,'field_ngixly','Người xử lý','text',0,80,'L',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(33,3,'exchange_date','Ngày trao đổi lại với khách hàng','date',0,90,'M',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 04:31:57',NULL),(34,3,'exchange_content','Nội dung trao đổi','textarea',0,100,'N',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 04:31:57',NULL),(35,3,'customer_feedback_date','Ngày khách hàng phản hồi','date',0,110,'O',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 04:31:57',NULL),(36,3,'customer_feedback_content','Nội dung khách hàng phản hồi','textarea',0,120,'P',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 04:31:57',NULL),(37,3,'field_worklogxly','Worklog xử lý','text',0,130,'Q',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(38,3,'field_ngayxly','Ngày xử lý','text',0,140,'R',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(39,4,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(40,4,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(41,4,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(42,4,'field_ngiyeucu','Người yêu cầu','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(43,4,'field_nhomhtr','Nhóm hỗ trợ','text',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(44,4,'field_ngitipnhn','Người tiếp nhận','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(45,4,'field_ngaytipnhan','Ngày tiếp nhân','text',0,70,'K',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(46,4,'field_ngixly','Người xử lý','text',0,80,'L',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(47,4,'field_nguyennhankhngthchin','Nguyên nhân không thực hiện','text',0,90,'M',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(48,4,'field_ngayxly','Ngày xử lý','text',0,100,'N',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(49,5,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(50,5,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(51,5,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(52,5,'field_ngiyeucu','Người yêu cầu','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(53,5,'field_nhomhtr','Nhóm hỗ trợ','text',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(54,5,'field_ngitipnhn','Người tiếp nhận','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(55,5,'field_ngaytipnhan','Ngày tiếp nhân','text',0,70,'K',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(56,5,'field_ngixly','Người xử lý','text',0,80,'L',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(57,5,'exchange_date','Ngày trao đổi lại với khách hàng','date',0,90,'M',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 04:31:57',NULL),(58,5,'exchange_content','Nội dung trao đổi','textarea',0,100,'N',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 04:31:57',NULL),(59,5,'customer_feedback_date','Ngày khách hàng phản hồi','date',0,110,'O',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 04:31:57',NULL),(60,5,'customer_feedback_content','Nội dung khách hàng phản hồi','textarea',0,120,'P',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 04:31:57',NULL),(61,5,'field_ngayhoanathanhthct','Ngày hoàn thành thực tế','text',0,130,'Q',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(62,5,'task_code','Mã task','task_ref',0,140,'R',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(63,6,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(64,6,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(65,6,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(66,6,'field_ngiyeucu','Người yêu cầu','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(67,6,'field_nhomhtr','Nhóm hỗ trợ','text',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(68,6,'field_ngitipnhn','Người tiếp nhận','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(69,6,'field_ngaytipnhan','Ngày tiếp nhân','text',0,70,'K',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(70,6,'field_ngixly','Người xử lý','text',0,80,'L',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(71,6,'field_ngaybaoakhanghang','Ngày báo kháng hàng','text',0,90,'M',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(72,6,'field_ngibaokhaahhang','Người báo khách hàng','text',0,100,'N',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(73,7,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(74,7,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(75,7,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(76,7,'field_ngiyeucu','Người yêu cầu','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(77,7,'field_nhomhtr','Nhóm hỗ trợ','text',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(78,7,'field_ngitipnhn','Người tiếp nhận','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(79,7,'field_ngaytipnhan','Ngày tiếp nhân','text',0,70,'K',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(80,7,'field_ngixly','Người xử lý','text',0,80,'L',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(81,7,'field_ngaychuyntr','Ngày chuyển trả','text',0,90,'M',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(82,7,'field_nidungchuyntr','Nội dung chuyển trả','text',0,100,'N',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(83,8,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(84,8,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(85,8,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(86,8,'field_nidungphantichdinhkem','Nội dung phân tích đính kèm','text',0,40,'H',NULL,0,'2026-03-03 09:39:36',NULL,'2026-03-07 19:29:02',NULL),(87,8,'field_ngithchin','Người thực hiện','text',0,50,'I',NULL,0,'2026-03-03 09:39:36',NULL,'2026-03-07 19:29:02',NULL),(88,8,'analysis_completion_date','Ngày hoàn thành','date',0,100,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 19:29:02',NULL),(89,10,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(90,10,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(91,10,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(92,10,'field_tind','Tiến độ','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(93,10,'field_tngay','Từ ngày','text',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(94,10,'field_dnngay','Đến ngày','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(95,10,'field_ngaygiahn','Ngày gia hạn','text',0,70,'K',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(96,10,'field_ngithchin','Người thực hiện','text',0,80,'L',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(97,10,'worklog','Worklog','worklog',0,90,'M',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(98,10,'field_mataskthamchiu','Mã task tham chiếu','text',0,100,'N',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(99,10,'notes','Ghi chú','textarea',0,110,'O',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(100,11,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(101,11,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(102,11,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(103,11,'field_ngihoanthanh','Người hoàn thành','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(104,12,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(105,12,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(106,12,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(107,12,'field_tind','Tiến độ','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(108,12,'upcode_date','Ngày upcode','date',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(109,12,'field_ngiupcode','Người upcode','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(110,12,'field_trngthaiupcode','Trạng thái upcode','text',0,70,'K',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(111,12,'worklog','Worklog','worklog',0,80,'L',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(112,13,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(113,13,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(114,13,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(115,13,'field_ngaytmngng','Ngày tạm ngưng','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(116,13,'field_ngitmngng','Người tạm ngưng','text',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(117,13,'field_nidungtmngng','Nội dung tạm ngưng','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(118,15,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(119,15,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(120,15,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(121,15,'field_ngiyeucu','Người yêu cầu','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(122,15,'field_nhomhtr','Nhóm hỗ trợ','text',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(123,15,'field_ngitipnhn','Người tiếp nhận','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(124,15,'field_ngaytipnhan','Ngày tiếp nhân','text',0,70,'K',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(125,15,'field_ngixly','Người xử lý','text',0,80,'L',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(126,15,'field_ngaytraodilividms','Ngày trao đổi lại với DMS','text',0,90,'M',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(127,15,'exchange_content','Nội dung trao đổi','textarea',0,100,'N',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-07 04:31:57',NULL),(128,15,'field_ngaydmsphnhi','Ngày DMS phản hồi','text',0,110,'O',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(129,15,'field_nidungdmsphnhi','Nội dung DMS phản hồi','text',0,120,'P',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(130,15,'field_mataskthamchiu','Mã task tham chiếu','text',0,130,'Q',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(131,15,'notes','Ghi chú','textarea',0,140,'R',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(132,16,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(133,16,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(134,16,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(135,16,'task_list','List task','task_list',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(136,17,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(137,17,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(138,17,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(139,17,'task_list','List task','task_list',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(140,17,'field_ngaytmngng','Ngày tạm ngưng','text',0,50,'I',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(141,17,'field_ngitmngng','Người tạm ngưng','text',0,60,'J',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(142,17,'field_nidungtmngng','Nội dung tạm ngưng','text',0,70,'K',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(143,18,'field_idyeucu','ID yêu cầu','text',0,10,'E',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(144,18,'field_nidung','Nội dung','text',0,20,'F',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(145,18,'field_dnv','Đơn vị','text',0,30,'G',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(146,18,'field_ngihoanthanh','Người hoàn thành','text',0,40,'H',NULL,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(147,8,'analysis_progress','Tiến độ phân tích','number',1,80,NULL,NULL,1,'2026-03-07 19:29:02',NULL,'2026-03-07 19:29:02',NULL),(148,8,'analysis_hours_estimated','Số giờ dự kiến thực hiện','number',1,90,NULL,NULL,1,'2026-03-07 19:29:02',NULL,'2026-03-07 19:29:02',NULL),(149,3,'processing_hours_estimated','Số giờ dự kiến xử lý','number',1,145,NULL,NULL,1,'2026-03-07 20:44:58',NULL,'2026-03-07 20:44:58',NULL);
/*!40000 ALTER TABLE `workflow_form_field_configs` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `workflow_status_catalogs`
--

LOCK TABLES `workflow_status_catalogs` WRITE;
/*!40000 ALTER TABLE `workflow_status_catalogs` DISABLE KEYS */;
INSERT INTO `workflow_status_catalogs` VALUES (1,1,'MOI_TIEP_NHAN','Mới tiếp nhận',NULL,'MOI_TIEP_NHAN',NULL,'GD1','support.moi_tiep_nhan',1,20,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(2,1,'DOI_PHAN_HOI_KH','Đợi phản hồi từ khách hàng',NULL,'DOI_PHAN_HOI_KH',NULL,'GD2','support.doi_phan_hoi_kh',1,30,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(3,1,'DANG_XU_LY','Đang xử lý',NULL,'DANG_XU_LY',NULL,'GD3','support.dang_xu_ly',1,40,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(4,1,'KHONG_THUC_HIEN','Không thực hiện',NULL,'KHONG_THUC_HIEN',NULL,'GD4','support.khong_thuc_hien',1,50,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(5,1,'HOAN_THANH','Hoàn thành',NULL,'HOAN_THANH',NULL,'GD5','support.hoan_thanh',1,60,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(6,1,'BAO_KHACH_HANG','Báo khách hàng',NULL,'BAO_KHACH_HANG',NULL,'GD6','support.bao_khach_hang',1,70,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(7,1,'CHUYEN_TRA_QL','Chuyển trả người quản lý',NULL,'CHUYEN_TRA_QL',NULL,'GD7','support.chuyen_tra_ql',1,80,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(8,1,'PHAN_TICH','Phân tích',NULL,'PHAN_TICH',NULL,'GD8','programming.phan_tich',1,90,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(9,2,'LAP_TRINH_GROUP','Lập trình',8,'LAP_TRINH',NULL,'GD9','programming.lap_trinh',0,100,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(10,3,'LAP_TRINH_DANG_THUC_HIEN','Đang thực hiện',9,'LAP_TRINH','DANG_THUC_HIEN','GD10','programming.lap_trinh.dang_thuc_hien',1,110,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(11,3,'LAP_TRINH_HOAN_THANH','Hoàn thành',9,'LAP_TRINH','HOAN_THANH','GD11','programming.lap_trinh.hoan_thanh',1,120,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(12,3,'LAP_TRINH_UPCODE','Upcode',9,'LAP_TRINH','UPCODE','GD12','programming.lap_trinh.upcode',1,130,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(13,3,'LAP_TRINH_TAM_NGUNG','Tạm ngưng',9,'LAP_TRINH','TAM_NGUNG','GD13','programming.lap_trinh.tam_ngung',1,140,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(14,2,'CHUYEN_DMS_GROUP','Chuyển DMS',8,'CHUYEN_DMS',NULL,'GD14','programming.chuyen_dms',0,150,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(15,3,'CHUYEN_DMS_TRAO_DOI','Trao đổi',14,'CHUYEN_DMS','TRAO_DOI','GD15','programming.chuyen_dms.trao_doi',1,160,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(16,3,'CHUYEN_DMS_TAO_TASK','Tạo task',14,'CHUYEN_DMS','TAO_TASK','GD16','programming.chuyen_dms.tao_task',1,170,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(17,3,'CHUYEN_DMS_TAM_NGUNG','Tạm ngưng',14,'CHUYEN_DMS','TAM_NGUNG','GD17','programming.chuyen_dms.tam_ngung',1,180,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(18,3,'CHUYEN_DMS_HOAN_THANH','Hoàn thành',14,'CHUYEN_DMS','HOAN_THANH','GD18','programming.chuyen_dms.hoan_thanh',1,190,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL);
/*!40000 ALTER TABLE `workflow_status_catalogs` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `worklog_activity_types`
--

LOCK TABLES `worklog_activity_types` WRITE;
/*!40000 ALTER TABLE `worklog_activity_types` DISABLE KEYS */;
INSERT INTO `worklog_activity_types` VALUES (1,'CODING','Viết / review code','Lập trình, code review, refactor',1,'CODE',10,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(2,'TESTING','Kiểm thử & QA','Test case, unit test, UAT, kiểm thử hồi quy',1,'CODE',20,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(3,'DEPLOYMENT','Deploy / Upcode','Deploy lên môi trường, cấu hình server, upcode',1,'UPCODE',30,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(4,'SUPPORT','Hỗ trợ trực tiếp','Xử lý yêu cầu hỗ trợ, hướng dẫn người dùng',1,'SUPPORT_HANDLE',40,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(5,'RESEARCH','Nghiên cứu & Phân tích','Phân tích yêu cầu, nghiên cứu giải pháp kỹ thuật',1,'ANALYZE',50,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(6,'DOCUMENTATION','Viết tài liệu','Tài liệu kỹ thuật, hướng dẫn sử dụng, đặc tả',1,NULL,60,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(7,'MEETING','Họp & trao đổi','Họp nội bộ, trao đổi với khách hàng',0,NULL,70,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL),(8,'OTHER','Khác',NULL,1,NULL,99,1,'2026-03-03 09:39:36',NULL,'2026-03-03 09:39:36',NULL);
/*!40000 ALTER TABLE `worklog_activity_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'vnpt_business_db'
--

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

-- Dump completed on 2026-03-12 18:15:15
