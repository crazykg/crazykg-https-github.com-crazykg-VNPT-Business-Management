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
-- Current Database: `vnpt_business_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `vnpt_business_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `vnpt_business_db`;

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `reference_type` enum('DOCUMENT','CONTRACT','PROJECT','CUSTOMER','OPPORTUNITY') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_id` bigint unsigned NOT NULL,
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `drive_file_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint unsigned DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_attachments_reference` (`reference_type`,`reference_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 33: File đính kèm';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attachments`
--

LOCK TABLES `attachments` WRITE;
/*!40000 ALTER TABLE `attachments` DISABLE KEYS */;
INSERT INTO `attachments` VALUES (2,'DOCUMENT',4,'pricing-doc-test.txt','http://localhost/storage/documents/oqTfdJ8QRpOvjAq2nVDlvGqY7RWjXAfgaatvLyql.txt',NULL,17,'2026-02-25 07:18:02',1,NULL,1);
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
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 35: Lịch sử Audit'
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
INSERT INTO `audit_logs` VALUES (1,'11111111-1111-1111-1111-111111111111','INSERT','internal_users',9001,NULL,'{\"status\": \"ACTIVE\", \"vpn_status\": \"YES\"}','/api/v5/employees','10.10.10.10','Seeder/Test','2026-02-23 14:36:48',4),(2,'22222222-2222-2222-2222-222222222222','UPDATE','internal_users',9002,'{\"vpn_status\": \"NO\"}','{\"vpn_status\": \"YES\"}','/api/v5/employees/9002','10.10.10.21','Seeder/Test','2026-02-23 14:46:48',NULL),(3,'33333333-3333-3333-3333-333333333333','DELETE','projects',3001,'{\"status\": \"PLANNING\"}',NULL,'/api/v5/projects/3001','10.10.10.99','Seeder/Test','2026-02-23 14:56:48',999999),(4,'b8a5323e-1dd1-4b67-9161-b16149e5fe6d','UPDATE','projects',2,'{\"id\": 2, \"status\": \"TRIAL\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-01\", \"updated_at\": \"2026-02-25 10:54:58\", \"updated_by\": null, \"customer_id\": 2, \"project_code\": \"DA002\", \"project_name\": \"Dự án SOC - Petrolimex\", \"opportunity_id\": 2, \"investment_mode\": \"THUE_DICH_VU\", \"expected_end_date\": \"2026-10-01\"}','{\"id\": 2, \"status\": \"ONGOING\", \"created_at\": \"2026-02-23 15:16:35\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-01\", \"updated_at\": \"2026-02-26 11:48:05\", \"updated_by\": 1, \"customer_id\": 2, \"project_code\": \"DA002\", \"project_name\": \"Dự án SOC - Petrolimex\", \"opportunity_id\": 2, \"investment_mode\": \"THUE_DICH_VU\", \"expected_end_date\": \"2026-10-01\"}','http://127.0.0.1:8000/api/v5/projects/2','127.0.0.1','curl/8.7.1','2026-02-26 11:48:05',1),(5,'0093ab5c-59cc-425f-b2fe-48995786de66','UPDATE','support_requests',2428613,'{\"id\": 2428613, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1483020\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001483020\", \"test_note\": \"Auto seed test note #1483020\", \"change_log\": \"Auto seed log #1483020\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001483020\", \"reporter_name\": \"Reporter 0020\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2428613, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"RESOLVED\", \"summary\": \"Seed yêu cầu hỗ trợ #1483020\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001483020\", \"test_note\": \"Auto seed test note #1483020\", \"change_log\": \"Auto seed log #1483020\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:00\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001483020\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0020\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2428613','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:14:00',1),(6,'ee514216-cbee-4aa9-9a44-70c6ff514592','UPDATE','support_requests',2432033,'{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001487640\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"HOTFIXING\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:13\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001487640\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2432033','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:14:13',1),(7,'18427524-f2cc-4617-9ee3-e40152627fac','UPDATE','support_requests',2432033,'{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"HOTFIXING\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:13\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001487640\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"OPEN\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:21\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001487640\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2432033','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:14:21',1),(8,'862f96e4-cfa4-49ae-b4f8-f01f839b1ca5','UPDATE','support_requests',2430513,'{\"id\": 2430513, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1485120\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001485120\", \"test_note\": \"Auto seed test note #1485120\", \"change_log\": \"Auto seed log #1485120\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001485120\", \"reporter_name\": \"Reporter 0120\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2430513, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"RESOLVED\", \"summary\": \"Seed yêu cầu hỗ trợ #1485120\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001485120\", \"test_note\": \"Auto seed test note #1485120\", \"change_log\": \"Auto seed log #1485120\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:27\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001485120\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0120\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2430513','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:14:27',1),(9,'0f290abf-e6c3-43fb-b326-da99691eab6d','UPDATE','support_requests',2429473,'{\"id\": 2429473, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1484280\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001484280\", \"test_note\": \"Auto seed test note #1484280\", \"change_log\": \"Auto seed log #1484280\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001484280\", \"reporter_name\": \"Reporter 0280\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2429473, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"PENDING\", \"summary\": \"Seed yêu cầu hỗ trợ #1484280\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001484280\", \"test_note\": \"Auto seed test note #1484280\", \"change_log\": \"Auto seed log #1484280\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:40\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001484280\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0280\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2429473','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:14:40',1),(10,'c3935080-1526-46bf-83a5-f769921fd42e','UPDATE','support_requests',2431373,'{\"id\": 2431373, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1486380\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001486380\", \"test_note\": \"Auto seed test note #1486380\", \"change_log\": \"Auto seed log #1486380\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001486380\", \"reporter_name\": \"Reporter 0380\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2431373, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1486380\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001486380\", \"test_note\": \"Auto seed test note #1486380\", \"change_log\": \"Auto seed log #1486380\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:04\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-01\", \"ticket_code\": \"SRQ-0001486380\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0380\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2431373','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:15:04',1),(11,'1b55fe5a-73b7-4749-be98-1277d72443a1','UPDATE','support_requests',2432033,'{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"OPEN\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:14:21\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001487640\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2432033, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"OPEN\", \"summary\": \"Seed yêu cầu hỗ trợ #1487640\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001487640\", \"test_note\": \"Auto seed test note #1487640\", \"change_log\": \"Auto seed log #1487640\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:24\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-04-26\", \"ticket_code\": \"SRQ-0001487640\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0140\", \"resolved_date\": \"2026-04-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2432033','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:15:24',1),(12,'c9449b8b-57ac-4476-a451-ce523765f796','UPDATE','support_requests',2450776,'{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001499400\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:39\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2450776','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:15:39',1),(13,'fee2c09d-4c15-412e-881e-f351b834d578','UPDATE','support_requests',2450776,'{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:39\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"DEPLOYED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:49\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2450776','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:15:49',1),(14,'b246c3c5-d402-4009-a3e3-8ff796cd2dea','UPDATE','support_requests',2450776,'{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"DEPLOYED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:15:49\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"HOTFIXING\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:16:08\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2450776','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:16:08',1),(15,'b23116a2-32b7-4d6b-806f-52e250e0c300','UPDATE','support_requests',2448876,'{\"id\": 2448876, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1497300\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001497300\", \"test_note\": \"Auto seed test note #1497300\", \"change_log\": \"Auto seed log #1497300\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001497300\", \"reporter_name\": \"Reporter 0300\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2448876, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"DEPLOYED\", \"summary\": \"Seed yêu cầu hỗ trợ #1497300\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001497300\", \"test_note\": \"Auto seed test note #1497300\", \"change_log\": \"Auto seed log #1497300\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:18:09\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001497300\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0300\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2448876','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:18:09',1),(16,'462805bb-2dd2-45c4-a476-bdacc936021e','UPDATE','support_requests',2450776,'{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"HOTFIXING\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:16:08\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2450776, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"RESOLVED\", \"summary\": \"Seed yêu cầu hỗ trợ #1499400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001499400\", \"test_note\": \"Auto seed test note #1499400\", \"change_log\": \"Auto seed log #1499400\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:19:27\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001499400\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2450776','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:19:27',1),(17,'9d684961-fc51-4f0c-9f70-540e4726e328','UPDATE','support_requests',2315712,'{\"id\": 2315712, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1415400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001415400\", \"test_note\": \"Auto seed test note #1415400\", \"change_log\": \"Auto seed log #1415400\", \"created_at\": \"2026-02-26 13:16:14\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:14\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001415400\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2315712, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"OPEN\", \"summary\": \"Seed yêu cầu hỗ trợ #1415400\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001415400\", \"test_note\": \"Auto seed test note #1415400\", \"change_log\": \"Auto seed log #1415400\", \"created_at\": \"2026-02-26 13:16:14\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:23:06\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001415400\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0400\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2315712','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:23:06',1),(18,'0a3e095a-247a-4c41-9800-65b796e1765f','UPDATE','support_requests',2449536,'{\"id\": 2449536, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1498560\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001498560\", \"test_note\": \"Auto seed test note #1498560\", \"change_log\": \"Auto seed log #1498560\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001498560\", \"reporter_name\": \"Reporter 0060\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2449536, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"OPEN\", \"summary\": \"Seed yêu cầu hỗ trợ #1498560\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001498560\", \"test_note\": \"Auto seed test note #1498560\", \"change_log\": \"Auto seed log #1498560\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:24:32\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001498560\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0060\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2449536','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:24:32',1),(19,'73c38479-300f-433e-a8df-a773a4f40b89','UPDATE','support_requests',2449156,'{\"id\": 2449156, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"CANCELLED\", \"summary\": \"Seed yêu cầu hỗ trợ #1498980\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": null, \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001498980\", \"test_note\": \"Auto seed test note #1498980\", \"change_log\": \"Auto seed log #1498980\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 13:16:17\", \"updated_by\": 1, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SRQ-0001498980\", \"reporter_name\": \"Reporter 0480\", \"resolved_date\": null, \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1}','{\"id\": 2449156, \"notes\": \"Seed benchmark dataset 1.5M rows\", \"status\": \"DEPLOYED\", \"summary\": \"Seed yêu cầu hỗ trợ #1498980\", \"due_date\": \"2026-03-17\", \"priority\": \"URGENT\", \"noti_date\": \"2026-02-26\", \"task_link\": \"https://jira.vnpt.local/browse/SRQ-0001498980\", \"test_note\": \"Auto seed test note #1498980\", \"change_log\": \"Auto seed log #1498980\", \"created_at\": \"2026-02-26 13:16:17\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-26 14:26:25\", \"updated_by\": null, \"assignee_id\": 1, \"customer_id\": 1, \"hotfix_date\": \"2026-02-26\", \"ticket_code\": \"SRQ-0001498980\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": \"ADMIN001\", \"assignee_name\": \"System Admin\", \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": \"Reporter 0480\", \"resolved_date\": \"2026-02-26\", \"requested_date\": \"2026-02-24\", \"project_item_id\": 1, \"service_group_id\": 1, \"assignee_username\": \"admin\", \"service_group_name\": \"HIS L2\"}','http://127.0.0.1:8000/api/v5/support-requests/2449156','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:26:25',1),(20,'b0c0d6cf-b8bd-4319-8ea7-a31dfedebf8c','UPDATE','projects',98,'{\"id\": 98, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-25 17:53:13\", \"updated_by\": null, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 98, \"status\": \"ONGOING\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-26 14:31:30\", \"updated_by\": 1, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8000/api/v5/projects/98','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:31:30',1),(21,'067fcfc1-66d0-4b6f-bd7a-1a89563485cf','UPDATE','projects',98,'{\"id\": 98, \"status\": \"ONGOING\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-26 14:31:30\", \"updated_by\": 1, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 98, \"status\": \"WARRANTY\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-26 14:31:41\", \"updated_by\": 1, \"customer_id\": 16, \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8000/api/v5/projects/98','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:31:41',1),(22,'3c3df400-c3f6-4be0-a89f-b2aeee56171b','UPDATE','projects',97,'{\"id\": 97, \"status\": \"TRIAL\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-25 17:53:13\", \"updated_by\": null, \"customer_id\": 35, \"project_code\": \"DA035\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT P. Thuận An (TYT TT Long Mỹ)\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','{\"id\": 97, \"status\": \"CANCELLED\", \"created_at\": \"2026-02-25 15:21:11\", \"created_by\": null, \"deleted_at\": null, \"start_date\": \"2026-02-25\", \"updated_at\": \"2026-02-26 14:31:46\", \"updated_by\": 1, \"customer_id\": 35, \"project_code\": \"DA035\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT P. Thuận An (TYT TT Long Mỹ)\", \"opportunity_id\": null, \"investment_mode\": \"DAU_TU\", \"expected_end_date\": \"2026-11-25\"}','http://127.0.0.1:8000/api/v5/projects/97','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 14:31:46',1),(23,'ef22d281-00ed-4ad1-a3c8-f8f7688da25d','INSERT','support_requests',2457469,NULL,'{\"id\": 2457469, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE TEST SUPPORT REQUEST\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:40:50\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:40:50\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests','127.0.0.1','Symfony','2026-02-27 01:40:50',1),(24,'dcc9e5e0-b5a2-485b-9f30-35f6b1476a12','UPDATE','support_requests',2457469,'{\"id\": 2457469, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE TEST SUPPORT REQUEST\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:40:50\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:40:50\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}','{\"id\": 2457469, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE TEST SUPPORT REQUEST\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:40:50\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:40:50\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests/2457469','127.0.0.1','Symfony','2026-02-27 01:40:50',1),(25,'eee57e0e-18fd-440f-8e70-3912655108fe','DELETE','support_requests',2457469,'{\"id\": 2457469, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE TEST SUPPORT REQUEST\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:40:50\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:40:50\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}',NULL,'http://localhost/api/v5/support-requests/2457469','127.0.0.1','Symfony','2026-02-27 01:40:50',1),(26,'9ec87239-59f2-4cbd-b92e-2a5e1aa2db66','INSERT','support_requests',2457470,NULL,'{\"id\": 2457470, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests','127.0.0.1','Symfony','2026-02-27 01:59:56',1),(27,'915490ae-9deb-4ba5-83d3-557ba276972a','UPDATE','support_requests',2457470,'{\"id\": 2457470, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}','{\"id\": 2457470, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests/2457470/status','127.0.0.1','Symfony','2026-02-27 01:59:56',1),(28,'5b481ee0-53d4-4e52-b0a1-994e36c2d756','UPDATE','support_requests',2457470,'{\"id\": 2457470, \"notes\": null, \"status\": \"NEW\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}','{\"id\": 2457470, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests/2457470/status','127.0.0.1','Symfony','2026-02-27 01:59:56',1),(29,'a003d6f2-073f-4e9c-9ae7-c3899a9ff4c5','UPDATE','support_requests',2457470,'{\"id\": 2457470, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}','{\"id\": 2457470, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null, \"assignee_username\": null, \"service_group_name\": null}','http://localhost/api/v5/support-requests/2457470/status','127.0.0.1','Symfony','2026-02-27 01:59:56',1),(30,'2bdeb592-8e42-4e27-be89-91dfb37b5331','DELETE','support_requests',2457470,'{\"id\": 2457470, \"notes\": null, \"status\": \"IN_PROGRESS\", \"summary\": \"SMOKE HISTORY GUARD\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"test_note\": null, \"change_log\": null, \"created_at\": \"2026-02-27 01:59:56\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 01:59:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": null, \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"service_group_id\": null}',NULL,'http://localhost/api/v5/support-requests/2457470','127.0.0.1','Symfony','2026-02-27 01:59:56',1),(31,'adb09dfb-6a5c-41f8-92df-66898652a06e','INSERT','support_requests',2457471,NULL,'{\"id\": 2457471, \"notes\": null, \"status\": \"NEW\", \"summary\": \"Cần xử lý\", \"due_date\": \"1999-02-27\", \"priority\": \"MEDIUM\", \"noti_date\": \"2026-02-27\", \"task_link\": null, \"created_at\": \"2026-02-27 03:14:12\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"updated_at\": \"2026-02-27 03:14:12\", \"updated_by\": 1, \"assignee_id\": 5, \"customer_id\": 50, \"hotfix_date\": \"2026-02-27\", \"ticket_code\": null, \"product_code\": \"SOC_MONITOR\", \"product_name\": \"Dịch vụ giám sát SOC\", \"project_code\": \"DA050\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT phường Bình Thạnh\", \"assignee_code\": \"INT9002\", \"assignee_name\": \"Trần Kinh Doanh\", \"customer_code\": \"93104\", \"customer_name\": \"TYT phường Bình Thạnh\", \"receiver_code\": \"INT9003\", \"receiver_name\": \"Lê Hệ Thống\", \"reporter_name\": \"Đầu mối TYT phường Bình Thạnh\", \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"receiver_user_id\": 6, \"service_group_id\": null, \"assignee_username\": \"sales.demo\", \"receiver_username\": \"system.demo\", \"service_group_name\": null, \"reporter_contact_id\": 50, \"reporter_contact_name\": \"Đầu mối TYT phường Bình Thạnh\", \"reporter_contact_email\": \"contact.93104@vnpt.local\", \"reporter_contact_phone\": \"0900000050\"}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15','2026-02-27 03:14:12',1),(32,'d0652fa8-14fa-4423-af19-de2ab1ba4f86','UPDATE','support_requests',2457471,'{\"id\": 2457471, \"notes\": null, \"status\": \"NEW\", \"summary\": \"Cần xử lý\", \"due_date\": \"1999-02-27\", \"priority\": \"MEDIUM\", \"noti_date\": \"2026-02-27\", \"task_link\": null, \"created_at\": \"2026-02-27 03:14:12\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"updated_at\": \"2026-02-27 03:14:12\", \"updated_by\": 1, \"assignee_id\": 5, \"customer_id\": 50, \"hotfix_date\": \"2026-02-27\", \"ticket_code\": null, \"reporter_name\": \"Đầu mối TYT phường Bình Thạnh\", \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"receiver_user_id\": 6, \"service_group_id\": null, \"reporter_contact_id\": 50}','{\"id\": 2457471, \"notes\": null, \"status\": \"NEW\", \"summary\": \"Cần xử lý\", \"due_date\": \"1999-02-27\", \"priority\": \"MEDIUM\", \"noti_date\": \"2026-02-27\", \"task_link\": null, \"created_at\": \"2026-02-27 03:14:12\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"updated_at\": \"2026-02-27 03:14:23\", \"updated_by\": null, \"assignee_id\": 5, \"customer_id\": 50, \"hotfix_date\": \"2026-02-27\", \"ticket_code\": null, \"product_code\": \"SOC_MONITOR\", \"product_name\": \"Dịch vụ giám sát SOC\", \"project_code\": \"DA050\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT phường Bình Thạnh\", \"assignee_code\": \"INT9002\", \"assignee_name\": \"Trần Kinh Doanh\", \"customer_code\": \"93104\", \"customer_name\": \"TYT phường Bình Thạnh\", \"receiver_code\": \"INT9003\", \"receiver_name\": \"Lê Hệ Thống\", \"reporter_name\": \"Đầu mối TYT phường Bình Thạnh\", \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"receiver_user_id\": 6, \"service_group_id\": 4, \"assignee_username\": \"sales.demo\", \"receiver_username\": \"system.demo\", \"service_group_name\": \"DỰ ÁN THUÊ OS\", \"reporter_contact_id\": 50, \"reporter_contact_name\": \"Đầu mối TYT phường Bình Thạnh\", \"reporter_contact_email\": \"contact.93104@vnpt.local\", \"reporter_contact_phone\": \"0900000050\"}','http://127.0.0.1:8000/api/v5/support-requests/2457471','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15','2026-02-27 03:14:23',1),(33,'3a1e4980-ca8a-4773-b9e9-87d6ec9dd7af','UPDATE','support_requests',2457471,'{\"id\": 2457471, \"notes\": null, \"status\": \"NEW\", \"summary\": \"Cần xử lý\", \"due_date\": \"1999-02-27\", \"priority\": \"MEDIUM\", \"noti_date\": \"2026-02-27\", \"task_link\": null, \"created_at\": \"2026-02-27 03:14:12\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"updated_at\": \"2026-02-27 03:14:23\", \"updated_by\": null, \"assignee_id\": 5, \"customer_id\": 50, \"hotfix_date\": \"2026-02-27\", \"ticket_code\": null, \"reporter_name\": \"Đầu mối TYT phường Bình Thạnh\", \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"receiver_user_id\": 6, \"service_group_id\": 4, \"reporter_contact_id\": 50}','{\"id\": 2457471, \"notes\": null, \"tasks\": [], \"status\": \"NEW\", \"summary\": \"Cần xử lý\", \"due_date\": \"2026-02-27\", \"priority\": \"MEDIUM\", \"noti_date\": \"2026-02-27\", \"task_link\": null, \"created_at\": \"2026-02-27 03:14:12\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 96, \"task_count\": 0, \"updated_at\": \"2026-02-27 07:58:50\", \"updated_by\": null, \"assignee_id\": 5, \"customer_id\": 50, \"hotfix_date\": \"2026-02-27\", \"ticket_code\": null, \"product_code\": \"SOC_MONITOR\", \"product_name\": \"Dịch vụ giám sát SOC\", \"project_code\": \"DA050\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TYT phường Bình Thạnh\", \"assignee_code\": \"INT9002\", \"assignee_name\": \"Trần Kinh Doanh\", \"customer_code\": \"93104\", \"customer_name\": \"TYT phường Bình Thạnh\", \"receiver_code\": \"INT9003\", \"receiver_name\": \"Lê Hệ Thống\", \"reporter_name\": \"Đầu mối TYT phường Bình Thạnh\", \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 98, \"receiver_user_id\": 6, \"service_group_id\": 4, \"assignee_username\": \"sales.demo\", \"receiver_username\": \"system.demo\", \"service_group_name\": \"DỰ ÁN THUÊ OS\", \"reporter_contact_id\": 50, \"reporter_contact_name\": \"Đầu mối TYT phường Bình Thạnh\", \"reporter_contact_email\": \"contact.93104@vnpt.local\", \"reporter_contact_phone\": \"0900000050\"}','http://127.0.0.1:8000/api/v5/support-requests/2457471','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 07:58:50',1),(34,'fa6aa913-82f2-4f5c-b8ed-289049b9ff60','INSERT','support_requests',2457472,NULL,'{\"id\": 2457472, \"notes\": \"Thực hiện test\", \"tasks\": [], \"status\": \"IN_PROGRESS\", \"summary\": \"Mô tả\", \"due_date\": \"2026-02-28\", \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": null, \"created_at\": \"2026-02-27 08:04:00\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 2, \"project_id\": 98, \"task_count\": 0, \"updated_at\": \"2026-02-27 08:04:00\", \"updated_by\": 1, \"assignee_id\": 6, \"customer_id\": 16, \"hotfix_date\": null, \"ticket_code\": null, \"product_code\": \"SOC_MONITOR\", \"product_name\": \"Dịch vụ giám sát SOC\", \"project_code\": \"DA016\", \"project_name\": \"Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"assignee_code\": \"INT9003\", \"assignee_name\": \"Lê Hệ Thống\", \"customer_code\": \"93105\", \"customer_name\": \"TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": \"2026-02-28\", \"requested_date\": \"2026-02-27\", \"project_item_id\": 96, \"receiver_user_id\": null, \"service_group_id\": null, \"assignee_username\": \"system.demo\", \"receiver_username\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8000/api/v5/support-requests','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 08:04:00',1),(35,'21d7c17a-08f6-49b0-b76f-39d31b6ddc8f','INSERT','support_requests',2457473,NULL,'{\"id\": 2457473, \"notes\": null, \"tasks\": [{\"id\": 1, \"title\": \"Smoke shared task #1\", \"status\": \"TODO\", \"task_code\": \"SMOKE-SHARED-1772184820\", \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820\", \"created_at\": \"2026-02-27 09:33:40\", \"created_by\": 1, \"request_id\": 2457473, \"sort_order\": 0, \"updated_at\": \"2026-02-27 09:33:40\", \"updated_by\": 1}], \"status\": \"NEW\", \"summary\": \"Smoke shared task #1\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820\", \"created_at\": \"2026-02-27 09:33:40\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"task_count\": 1, \"updated_at\": \"2026-02-27 09:33:40\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SMOKE-SHARED-1772184820\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"receiver_user_id\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8001/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 09:33:40',1),(36,'1ebe6dd8-fe46-4407-bedb-7ecf1f1dfed1','INSERT','support_requests',2457474,NULL,'{\"id\": 2457474, \"notes\": null, \"tasks\": [{\"id\": 2, \"title\": \"Smoke shared task #2\", \"status\": \"TODO\", \"task_code\": \"SMOKE-SHARED-1772184820\", \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820\", \"created_at\": \"2026-02-27 09:33:41\", \"created_by\": 1, \"request_id\": 2457474, \"sort_order\": 0, \"updated_at\": \"2026-02-27 09:33:41\", \"updated_by\": 1}], \"status\": \"NEW\", \"summary\": \"Smoke shared task #2\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820\", \"created_at\": \"2026-02-27 09:33:41\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"task_count\": 1, \"updated_at\": \"2026-02-27 09:33:41\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SMOKE-SHARED-1772184820\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"receiver_user_id\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8001/api/v5/support-requests','127.0.0.1','curl/8.7.1','2026-02-27 09:33:41',1),(37,'cfff9b9c-4e43-4f66-b7f5-08958151d1da','UPDATE','support_requests',2457474,'{\"id\": 2457474, \"notes\": null, \"status\": \"NEW\", \"summary\": \"Smoke shared task #2\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820\", \"created_at\": \"2026-02-27 09:33:41\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"updated_at\": \"2026-02-27 09:33:41\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SMOKE-SHARED-1772184820\", \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"receiver_user_id\": null, \"service_group_id\": null, \"reporter_contact_id\": null}','{\"id\": 2457474, \"notes\": null, \"tasks\": [{\"id\": 3, \"title\": \"Smoke shared task #2 updated\", \"status\": \"IN_PROGRESS\", \"task_code\": \"SMOKE-SHARED-1772184820\", \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820?rev=2\", \"created_at\": \"2026-02-27 09:34:56\", \"created_by\": null, \"request_id\": 2457474, \"sort_order\": 0, \"updated_at\": \"2026-02-27 09:34:56\", \"updated_by\": null}], \"status\": \"NEW\", \"summary\": \"Smoke shared task #2 (updated)\", \"due_date\": null, \"priority\": \"MEDIUM\", \"noti_date\": null, \"task_link\": \"https://jira.local/SMOKE-SHARED-1772184820?rev=2\", \"created_at\": \"2026-02-27 09:33:41\", \"created_by\": 1, \"deleted_at\": null, \"product_id\": 1, \"project_id\": 1, \"task_count\": 1, \"updated_at\": \"2026-02-27 09:34:56\", \"updated_by\": 1, \"assignee_id\": null, \"customer_id\": 1, \"hotfix_date\": null, \"ticket_code\": \"SMOKE-SHARED-1772184820\", \"product_code\": \"VNPT_HIS\", \"product_name\": \"Giải pháp VNPT HIS\", \"project_code\": \"DA001\", \"project_name\": \"Dự án VNPT HIS - Vietcombank\", \"assignee_code\": null, \"assignee_name\": null, \"customer_code\": \"KH001\", \"customer_name\": \"Ngân hàng Vietcombank\", \"receiver_code\": null, \"receiver_name\": null, \"reporter_name\": null, \"resolved_date\": null, \"requested_date\": \"2026-02-27\", \"project_item_id\": 1, \"receiver_user_id\": null, \"service_group_id\": null, \"assignee_username\": null, \"receiver_username\": null, \"service_group_name\": null, \"reporter_contact_id\": null, \"reporter_contact_name\": null, \"reporter_contact_email\": null, \"reporter_contact_phone\": null}','http://127.0.0.1:8001/api/v5/support-requests/2457474','127.0.0.1','curl/8.7.1','2026-02-27 09:34:56',1),(38,'c31affb7-3f2c-4c18-8fe4-7dc92e89bbf8','INSERT','contracts',3,NULL,'{\"id\": 3, \"status\": \"DRAFT\", \"dept_id\": null, \"sign_date\": \"2026-03-01\", \"created_at\": \"2026-03-01 04:44:41\", \"created_by\": 1, \"project_id\": 98, \"updated_at\": \"2026-03-01 04:44:41\", \"updated_by\": 1, \"customer_id\": 16, \"expiry_date\": \"2027-05-31\", \"total_value\": 0, \"contract_code\": \"HĐ001\", \"contract_name\": \"Tên Hợp đồng 001\"}','http://127.0.0.1:8000/api/v5/contracts','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-01 04:44:41',1);
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
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_login_attempts`
--

LOCK TABLES `auth_login_attempts` WRITE;
/*!40000 ALTER TABLE `auth_login_attempts` DISABLE KEYS */;
INSERT INTO `auth_login_attempts` VALUES (1,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-25 19:38:08','2026-02-25 19:38:08'),(2,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-25 19:40:21','2026-02-25 19:40:21'),(3,'admin.demo',4,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-25 19:44:56','2026-02-25 19:44:56'),(4,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-25 20:22:23','2026-02-25 20:22:23'),(5,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-25 23:06:55','2026-02-25 23:06:55'),(6,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 00:18:18','2026-02-26 00:18:18'),(7,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 04:50:28','2026-02-26 04:50:28'),(8,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 05:37:44','2026-02-26 05:37:44'),(9,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 06:15:35','2026-02-26 06:15:35'),(10,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 06:30:12','2026-02-26 06:30:12'),(11,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:11:26','2026-02-26 07:11:26'),(12,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:11:27','2026-02-26 07:11:27'),(13,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:11:28','2026-02-26 07:11:28'),(14,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:11:47','2026-02-26 07:11:47'),(15,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:12:11','2026-02-26 07:12:11'),(16,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:17:39','2026-02-26 07:17:39'),(17,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 07:34:57','2026-02-26 07:34:57'),(18,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','curl/8.7.1','2026-02-26 15:46:50','2026-02-26 15:46:50'),(19,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 15:47:22','2026-02-26 15:47:22'),(20,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 15:52:01','2026-02-26 15:52:01'),(21,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 15:54:28','2026-02-26 15:54:28'),(22,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 15:57:25','2026-02-26 15:57:25'),(23,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15','2026-02-26 16:50:52','2026-02-26 16:50:52'),(24,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15','2026-02-26 16:50:57','2026-02-26 16:50:57'),(25,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15','2026-02-26 16:51:38','2026-02-26 16:51:38'),(26,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-26 16:52:16','2026-02-26 16:52:16'),(27,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15','2026-02-26 16:52:36','2026-02-26 16:52:36'),(28,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 19:03:50','2026-02-26 19:03:50'),(29,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 20:55:21','2026-02-26 20:55:21'),(30,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 20:55:30','2026-02-26 20:55:30'),(31,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 20:55:39','2026-02-26 20:55:39'),(32,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 20:58:10','2026-02-26 20:58:10'),(33,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 20:58:18','2026-02-26 20:58:18'),(34,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 20:59:27','2026-02-26 20:59:27'),(35,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 20:59:31','2026-02-26 20:59:31'),(36,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-27 02:33:40','2026-02-27 02:33:40'),(37,'admin',1,'SUCCESS',NULL,'127.0.0.1','curl/8.7.1','2026-02-27 03:31:10','2026-02-27 03:31:10'),(38,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 03:32:12','2026-02-27 03:32:12'),(39,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 03:32:16','2026-02-27 03:32:16'),(40,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-27 03:32:19','2026-02-27 03:32:19'),(41,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-28 19:37:26','2026-02-28 19:37:26'),(42,'admin',1,'FAILED','INVALID_CREDENTIALS','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-28 22:19:04','2026-02-28 22:19:04'),(43,'admin',1,'SUCCESS',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-28 22:19:08','2026-02-28 22:19:08');
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
INSERT INTO `cache` VALUES ('laravel-cache-50881e51d980a0f2023c04d9bf3009dd','i:2;',1772342404),('laravel-cache-50881e51d980a0f2023c04d9bf3009dd:timer','i:1772342404;',1772342404),('laravel-cache-786ca5d919cd67bf25c8c0d496637bda','i:1;',1772073956),('laravel-cache-786ca5d919cd67bf25c8c0d496637bda:timer','i:1772073956;',1772073956),('laravel-cache-v5:business_domains:list:v1','a:2:{i:0;a:7:{s:2:\"id\";i:1;s:11:\"domain_code\";s:5:\"KD006\";s:11:\"domain_name\";s:11:\"Y tế số\";s:10:\"created_at\";s:19:\"2026-02-23 15:16:35\";s:10:\"created_by\";N;s:10:\"updated_at\";s:19:\"2026-02-23 15:19:41\";s:10:\"updated_by\";N;}i:1;a:7:{s:2:\"id\";i:2;s:11:\"domain_code\";s:5:\"KD003\";s:11:\"domain_name\";s:19:\"An toàn thông tin\";s:10:\"created_at\";s:19:\"2026-02-23 15:16:35\";s:10:\"created_by\";N;s:10:\"updated_at\";s:19:\"2026-02-23 15:19:41\";s:10:\"updated_by\";N;}}',1772344897),('laravel-cache-v5:departments:list:v1','a:4:{i:0;a:10:{s:2:\"id\";i:1;s:9:\"dept_code\";s:5:\"PB001\";s:9:\"dept_name\";s:17:\"Ban Điều hành\";s:9:\"parent_id\";i:4;s:9:\"dept_path\";s:2:\"1/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-23T15:01:47.000000Z\";s:10:\"updated_at\";s:27:\"2026-02-25T20:12:43.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:4;s:9:\"dept_code\";s:6:\"BGĐVT\";s:9:\"dept_name\";s:30:\"Ban giám đốc Viễn Thông\";}s:9:\"is_active\";b:1;}i:1;a:10:{s:2:\"id\";i:2;s:9:\"dept_code\";s:5:\"PB002\";s:9:\"dept_name\";s:17:\"Phòng Kinh doanh\";s:9:\"parent_id\";i:4;s:9:\"dept_path\";s:4:\"1/2/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-23T15:01:47.000000Z\";s:10:\"updated_at\";s:27:\"2026-02-25T20:12:43.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:4;s:9:\"dept_code\";s:6:\"BGĐVT\";s:9:\"dept_name\";s:30:\"Ban giám đốc Viễn Thông\";}s:9:\"is_active\";b:1;}i:2;a:10:{s:2:\"id\";i:3;s:9:\"dept_code\";s:5:\"PB003\";s:9:\"dept_name\";s:19:\"Phòng Kỹ thuật\";s:9:\"parent_id\";i:4;s:9:\"dept_path\";s:4:\"1/3/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-23T15:01:47.000000Z\";s:10:\"updated_at\";s:27:\"2026-02-25T20:12:43.000000Z\";s:6:\"parent\";a:3:{s:2:\"id\";i:4;s:9:\"dept_code\";s:6:\"BGĐVT\";s:9:\"dept_name\";s:30:\"Ban giám đốc Viễn Thông\";}s:9:\"is_active\";b:1;}i:3;a:10:{s:2:\"id\";i:4;s:9:\"dept_code\";s:6:\"BGĐVT\";s:9:\"dept_name\";s:30:\"Ban giám đốc Viễn Thông\";s:9:\"parent_id\";N;s:9:\"dept_path\";s:2:\"4/\";s:6:\"status\";s:6:\"ACTIVE\";s:10:\"created_at\";s:27:\"2026-02-25T13:12:43.000000Z\";s:10:\"updated_at\";s:27:\"2026-02-25T20:12:43.000000Z\";s:6:\"parent\";N;s:9:\"is_active\";b:1;}}',1772346563),('laravel-cache-v5:products:list:v1','a:2:{i:0;a:10:{s:2:\"id\";i:1;s:12:\"product_code\";s:8:\"VNPT_HIS\";s:12:\"product_name\";s:21:\"Giải pháp VNPT HIS\";s:9:\"domain_id\";i:1;s:9:\"vendor_id\";i:1;s:14:\"standard_price\";d:150000000;s:10:\"created_at\";s:19:\"2026-02-23 15:16:35\";s:10:\"created_by\";N;s:10:\"updated_at\";s:19:\"2026-02-23 15:19:41\";s:10:\"updated_by\";N;}i:1;a:10:{s:2:\"id\";i:2;s:12:\"product_code\";s:11:\"SOC_MONITOR\";s:12:\"product_name\";s:26:\"Dịch vụ giám sát SOC\";s:9:\"domain_id\";i:2;s:9:\"vendor_id\";i:2;s:14:\"standard_price\";d:80000000;s:10:\"created_at\";s:19:\"2026-02-23 15:16:35\";s:10:\"created_by\";N;s:10:\"updated_at\";s:19:\"2026-02-23 15:19:41\";s:10:\"updated_by\";N;}}',1772345604),('laravel-cache-v5:support-requests:kpi:25fac39167534e803af0b9c3d831acd8','a:6:{s:14:\"total_requests\";i:1;s:9:\"new_count\";i:1;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:1;}',1772164071),('laravel-cache-v5:support-requests:kpi:265c04137f24caaf5f028b0166a83376','a:6:{s:14:\"total_requests\";i:0;s:9:\"new_count\";i:0;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:0;}',1772165283),('laravel-cache-v5:support-requests:kpi:3044342e093915f3f2f735a32e0c73d9','a:6:{s:14:\"total_requests\";i:0;s:9:\"new_count\";i:0;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:0;}',1772165281),('laravel-cache-v5:support-requests:kpi:394287cb55baa096ad361c825e48f8a3','a:5:{s:14:\"total_requests\";i:20;s:9:\"new_count\";i:3;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:4;s:21:\"approaching_due_count\";i:0;}',1772157708),('laravel-cache-v5:support-requests:kpi:478449d97e596700e70c18b348460ef0','a:4:{s:13:\"status_counts\";a:6:{s:4:\"OPEN\";i:250003;s:9:\"HOTFIXING\";i:250000;s:8:\"RESOLVED\";i:250003;s:8:\"DEPLOYED\";i:250002;s:7:\"PENDING\";i:250001;s:9:\"CANCELLED\";i:249991;}s:11:\"in_progress\";i:750004;s:9:\"completed\";i:500005;s:7:\"overdue\";i:735716;}',1772116919),('laravel-cache-v5:support-requests:kpi:4f951f32171473f78db23eb79d2f2e2e','a:6:{s:14:\"total_requests\";i:4;s:9:\"new_count\";i:3;s:17:\"in_progress_count\";i:1;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:2;s:13:\"overdue_count\";i:0;}',1772188355),('laravel-cache-v5:support-requests:kpi:6c0fe3c796c3049503b78105ab4484b5','a:4:{s:13:\"status_counts\";a:6:{s:4:\"OPEN\";i:32142;s:9:\"HOTFIXING\";i:32139;s:8:\"RESOLVED\";i:32142;s:8:\"DEPLOYED\";i:32141;s:7:\"PENDING\";i:32140;s:9:\"CANCELLED\";i:35701;}s:11:\"in_progress\";i:96421;s:9:\"completed\";i:64283;s:7:\"overdue\";i:82133;}',1772146658),('laravel-cache-v5:support-requests:kpi:71ba893201aaf52f40e780df268184ca','a:4:{s:13:\"status_counts\";a:6:{s:4:\"OPEN\";i:0;s:9:\"HOTFIXING\";i:14284;s:8:\"RESOLVED\";i:0;s:8:\"DEPLOYED\";i:17855;s:7:\"PENDING\";i:0;s:9:\"CANCELLED\";i:17855;}s:11:\"in_progress\";i:14284;s:9:\"completed\";i:17855;s:7:\"overdue\";i:14284;}',1772117280),('laravel-cache-v5:support-requests:kpi:7d74ba0e686360a1e3f6ad461572eb90','a:4:{s:13:\"status_counts\";a:6:{s:4:\"OPEN\";i:250003;s:9:\"HOTFIXING\";i:250000;s:8:\"RESOLVED\";i:250003;s:8:\"DEPLOYED\";i:250002;s:7:\"PENDING\";i:250001;s:9:\"CANCELLED\";i:249991;}s:11:\"in_progress\";i:750004;s:9:\"completed\";i:500005;s:7:\"overdue\";i:735716;}',1772117323),('laravel-cache-v5:support-requests:kpi:82e03ce4f617139293dd9adf02b427d1','a:6:{s:14:\"total_requests\";i:0;s:9:\"new_count\";i:0;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:0;}',1772185305),('laravel-cache-v5:support-requests:kpi:9a2a544d9b165948c843a99060275343','a:4:{s:13:\"status_counts\";a:6:{s:4:\"OPEN\";i:250003;s:9:\"HOTFIXING\";i:0;s:8:\"RESOLVED\";i:0;s:8:\"DEPLOYED\";i:0;s:7:\"PENDING\";i:0;s:9:\"CANCELLED\";i:0;}s:11:\"in_progress\";i:250003;s:9:\"completed\";i:0;s:7:\"overdue\";i:246429;}',1772117328),('laravel-cache-v5:support-requests:kpi:ae40b813f3ec729d8e0c2feb0b1a85e0','a:5:{s:14:\"total_requests\";i:0;s:9:\"new_count\";i:0;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;}',1772159425),('laravel-cache-v5:support-requests:kpi:aebd6095cf920ff6db96ff7b915066db','a:6:{s:14:\"total_requests\";i:1;s:9:\"new_count\";i:1;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:1;}',1772164073),('laravel-cache-v5:support-requests:kpi:cc7f753b5e98aeb2eefbc8d3508a59d3','a:4:{s:13:\"status_counts\";a:6:{s:4:\"OPEN\";i:250003;s:9:\"HOTFIXING\";i:250000;s:8:\"RESOLVED\";i:250003;s:8:\"DEPLOYED\";i:250002;s:7:\"PENDING\";i:250001;s:9:\"CANCELLED\";i:249991;}s:11:\"in_progress\";i:750004;s:9:\"completed\";i:500005;s:7:\"overdue\";i:735716;}',1772117321),('laravel-cache-v5:support-requests:kpi:d43b23cea45cc4b968c795b7438e13af','a:6:{s:14:\"total_requests\";i:1;s:9:\"new_count\";i:1;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:1;}',1772165306),('laravel-cache-v5:support-requests:kpi:e815d58e146bce95198bc386d66c60d3','a:4:{s:13:\"status_counts\";a:8:{s:3:\"NEW\";i:0;s:11:\"IN_PROGRESS\";i:0;s:16:\"WAITING_CUSTOMER\";i:0;s:9:\"COMPLETED\";i:0;s:6:\"PAUSED\";i:0;s:12:\"TRANSFER_DEV\";i:0;s:12:\"TRANSFER_DMS\";i:0;s:17:\"UNABLE_TO_EXECUTE\";i:0;}s:11:\"in_progress\";i:0;s:9:\"completed\";i:0;s:7:\"overdue\";i:0;}',1772156886),('laravel-cache-v5:support-requests:kpi:eaab0bdab87b2c07984aba67169d997c','a:4:{s:13:\"status_counts\";a:6:{s:4:\"OPEN\";i:250003;s:9:\"HOTFIXING\";i:0;s:8:\"RESOLVED\";i:0;s:8:\"DEPLOYED\";i:0;s:7:\"PENDING\";i:0;s:9:\"CANCELLED\";i:0;}s:11:\"in_progress\";i:250003;s:9:\"completed\";i:0;s:7:\"overdue\";i:246429;}',1772146339),('laravel-cache-v5:support-requests:kpi:f0334c4c977a85c874d767302ef0a884','a:6:{s:14:\"total_requests\";i:2;s:9:\"new_count\";i:2;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:0;}',1772184833),('laravel-cache-v5:support-requests:kpi:f69a062e9b2635e6913c4b3ef0fe183f','a:4:{s:13:\"status_counts\";a:8:{s:3:\"NEW\";i:0;s:11:\"IN_PROGRESS\";i:0;s:16:\"WAITING_CUSTOMER\";i:0;s:9:\"COMPLETED\";i:0;s:6:\"PAUSED\";i:0;s:12:\"TRANSFER_DEV\";i:0;s:12:\"TRANSFER_DMS\";i:0;s:17:\"UNABLE_TO_EXECUTE\";i:0;}s:11:\"in_progress\";i:0;s:9:\"completed\";i:0;s:7:\"overdue\";i:0;}',1772156883),('laravel-cache-v5:support-requests:kpi:fb08c174ce33996ebed6e9de39f4610c','a:6:{s:14:\"total_requests\";i:1;s:9:\"new_count\";i:1;s:17:\"in_progress_count\";i:0;s:22:\"waiting_customer_count\";i:0;s:21:\"approaching_due_count\";i:0;s:13:\"overdue_count\";i:1;}',1772165285),('laravel-cache-v5:support-requests:kpi:fc3fbfb6efd932365ff6531c27de5f9c','a:4:{s:13:\"status_counts\";a:6:{s:4:\"OPEN\";i:17855;s:9:\"HOTFIXING\";i:0;s:8:\"RESOLVED\";i:14284;s:8:\"DEPLOYED\";i:0;s:7:\"PENDING\";i:17855;s:9:\"CANCELLED\";i:0;}s:11:\"in_progress\";i:35710;s:9:\"completed\";i:14284;s:7:\"overdue\";i:28568;}',1772117290);
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
  `expiry_date` date DEFAULT NULL,
  `total_value` decimal(18,2) NOT NULL DEFAULT '0.00',
  `status` enum('DRAFT','PENDING','SIGNED','EXPIRED','TERMINATED','LIQUIDATED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'DRAFT',
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
  KEY `idx_contracts_dept_id` (`dept_id`),
  CONSTRAINT `fk_cont_cust_link` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cont_proj_link` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fk_contracts_dept_id` FOREIGN KEY (`dept_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 30: Hợp đồng kinh tế';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contracts`
--

LOCK TABLES `contracts` WRITE;
/*!40000 ALTER TABLE `contracts` DISABLE KEYS */;
INSERT INTO `contracts` VALUES (1,'HD001','Hợp đồng triển khai VNPT HIS',1,1,'2026-01-15','2026-12-31',150000000.00,'SIGNED',2,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'HD002','Hợp đồng dịch vụ SOC',2,2,'2026-02-20','2026-12-20',80000000.00,'PENDING',2,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(3,'HĐ001','Tên Hợp đồng 001',98,16,'2026-03-01','2027-05-31',0.00,'DRAFT',NULL,'2026-02-28 21:44:41',1,'2026-02-28 21:44:41',1,NULL);
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
  `position_type` enum('GIAM_DOC','TRUONG_PHONG','DAU_MOI') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cust_pers_owner` (`customer_id`),
  CONSTRAINT `fk_cust_pers_owner` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=130 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 26: Đầu mối liên hệ khách hàng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_personnel`
--

LOCK TABLES `customer_personnel` WRITE;
/*!40000 ALTER TABLE `customer_personnel` DISABLE KEYS */;
INSERT INTO `customer_personnel` VALUES (1,1,'Nguyễn Văn A','GIAM_DOC','0912345678','nguyenvana@vietcombank.com.vn','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,2,'Trần Thị B','TRUONG_PHONG','0987654321','tranthib@petrolimex.com.vn','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(3,3,'Đầu mối Bệnh viện Sản - Nhi Hậu Giang','DAU_MOI','0900000003','contact.93007@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(4,4,'Đầu mối Bệnh viện Tâm thần - Da liễu Hậu Giang','DAU_MOI','0900000004','contact.93008@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(5,5,'Đầu mối Bệnh viện Phổi Hậu Giang','DAU_MOI','0900000005','contact.93100@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(6,6,'Đầu mối Trung tâm Y tế khu vực Vị Thủy','DAU_MOI','0900000006','contact.93002@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(7,7,'Đầu mối Trung tâm Y tế khu vực Long Mỹ','DAU_MOI','0900000007','contact.93003@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(8,8,'Đầu mối Trung tâm Y tế khu vực Phụng Hiệp','DAU_MOI','0900000008','contact.93004@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(9,9,'Đầu mối Phòng khám đa khoa KV Kinh Cùng','DAU_MOI','0900000009','contact.93089@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(10,10,'Đầu mối Phòng khám đa khoa KV Búng Tàu','DAU_MOI','0900000010','contact.93090@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(11,11,'Đầu mối Trung tâm Y tế Thành phố Ngã Bảy','DAU_MOI','0900000011','contact.93108@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(12,12,'Đầu mối Trung tâm Y tế Khu vực Châu Thành','DAU_MOI','0900000012','contact.93005@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(13,13,'Đầu mối Trung tâm Y tế khu vực Châu Thành A','DAU_MOI','0900000013','contact.93006@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(14,14,'Đầu mối Bệnh viện đa khoa khu vực Ngã Bảy','DAU_MOI','0900000014','contact.93016@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(15,15,'Đầu mối Trung tâm Y tế Huyện Long Mỹ','DAU_MOI','0900000015','contact.93078@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(16,16,'Đầu mối TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang','DAU_MOI','0900000016','contact.93105@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(17,17,'Đầu mối Phòng khám đa khoa Thiên Tâm','DAU_MOI','0900000017','contact.93106@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(18,18,'Đầu mối Phòng khám đa khoa CARE MEDIC CẦN THƠ','DAU_MOI','0900000018','contact.93107@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(19,19,'Đầu mối Phòng khám đa khoa thuộc Trung tâm Y tế thành phố Vị Thanh','DAU_MOI','0900000019','contact.93109@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(20,20,'Đầu mối PHÒNG KHÁM ĐA KHOA TÂM AN','DAU_MOI','0900000020','contact.93122@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(21,21,'Đầu mối Phòng khám đa khoa Medic Tây Đô','DAU_MOI','0900000021','contact.93129@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(22,22,'Đầu mối Phòng khám đa khoa Tâm Phúc Cần Thơ','DAU_MOI','0900000022','contact.93130@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(23,23,'Đầu mối TTYT Dự phòng Tỉnh Hậu Giang','DAU_MOI','0900000023','contact.93457@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(24,24,'Đầu mối Trạm y tế xã Vị Thủy','DAU_MOI','0900000024','contact.93048@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(25,25,'Đầu mối Trạm Y tế Xã Vị Trung','DAU_MOI','0900000025','contact.93049@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(26,26,'Đầu mối Trạm Y tế Xã Vị Thủy','DAU_MOI','0900000026','contact.93050@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(27,27,'Đầu mối Trạm Y tế Xã Vị Thắng','DAU_MOI','0900000027','contact.93051@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(28,28,'Đầu mối Trạm y tế xã Vĩnh Thuận Đông','DAU_MOI','0900000028','contact.93052@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(29,29,'Đầu mối Trạm Y tế Xã Vĩnh Trung','DAU_MOI','0900000029','contact.93053@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(30,30,'Đầu mối Trạm y tế xã Vĩnh Tường','DAU_MOI','0900000030','contact.93054@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(31,31,'Đầu mối Trạm Y tế Xã Vị Đông','DAU_MOI','0900000031','contact.93055@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(32,32,'Đầu mối Trạm Y tế Xã Vị Bình','DAU_MOI','0900000032','contact.93057@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(33,33,'Đầu mối Trạm y tế xã Vị Thanh 1','DAU_MOI','0900000033','contact.93080@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(34,34,'Đầu mối Trạm Y tế phường Long Bình','DAU_MOI','0900000034','contact.93019@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(35,35,'Đầu mối TYT P. Thuận An (TYT TT Long Mỹ)','DAU_MOI','0900000035','contact.93058@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(36,36,'Đầu mối Trạm Y tế Xã Long Bình','DAU_MOI','0900000036','contact.93059@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(37,37,'Đầu mối Trạm Y tế Xã Long Trị','DAU_MOI','0900000037','contact.93060@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(38,38,'Đầu mối Trạm Y tế phường Long Phú 1','DAU_MOI','0900000038','contact.93061@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(39,39,'Đầu mối Trạm Y tế Xã Thuận Hưng','DAU_MOI','0900000039','contact.93062@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(40,40,'Đầu mối Trạm Y tế Xã Vĩnh Viễn','DAU_MOI','0900000040','contact.93064@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(41,41,'Đầu mối Trạm Y tế Xã Lương Tâm','DAU_MOI','0900000041','contact.93065@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(42,42,'Đầu mối Trạm Y tế xã Xà Phiên','DAU_MOI','0900000042','contact.93066@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(43,43,'Đầu mối Trạm y tế phường Trà Lồng','DAU_MOI','0900000043','contact.93092@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(44,44,'Đầu mối Trạm Y tế Thị trấn Trà Lồng','DAU_MOI','0900000044','contact.93093@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(45,45,'Đầu mối Trạm Y tế Xã Tân Phú','DAU_MOI','0900000045','contact.93094@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(46,46,'Đầu mối Trạm y tế xã Thuận Hòa','DAU_MOI','0900000046','contact.93095@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(47,47,'Đầu mối Trạm Y tế Xã Vĩnh Viễn A','DAU_MOI','0900000047','contact.93096@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(48,48,'Đầu mối Trạm Y tế phường Long Mỹ','DAU_MOI','0900000048','contact.93097@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(49,49,'Đầu mối Trạm Y tế Xã Lương Nghĩa','DAU_MOI','0900000049','contact.93098@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(50,50,'Đầu mối TYT phường Bình Thạnh','DAU_MOI','0900000050','contact.93104@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(51,51,'Đầu mối Trạm Y tế Thị trấn Cây Dương','DAU_MOI','0900000051','contact.93035@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(52,52,'Đầu mối Trạm Y tế Xã Tân Bình','DAU_MOI','0900000052','contact.93036@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(53,53,'Đầu mối Trạm Y tế Xã Bình Thành','DAU_MOI','0900000053','contact.93037@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(54,54,'Đầu mối Trạm Y tế Xã Thạnh Hòa','DAU_MOI','0900000054','contact.93038@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(55,55,'Đầu mối Trạm Y tế Xã Long Thạnh','DAU_MOI','0900000055','contact.93039@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(56,56,'Đầu mối Trạm Y tế Xã Phụng Hiệp','DAU_MOI','0900000056','contact.93040@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(57,57,'Đầu mối Trạm Y tế Xã Hòa Mỹ','DAU_MOI','0900000057','contact.93041@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(58,58,'Đầu mối Trạm Y tế Xã Hòa An','DAU_MOI','0900000058','contact.93042@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(59,59,'Đầu mối Trạm Y tế Xã Phương Bình','DAU_MOI','0900000059','contact.93043@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(60,60,'Đầu mối Trạm Y tế Xã Hiệp Hưng','DAU_MOI','0900000060','contact.93044@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(61,61,'Đầu mối Trạm Y tế Xã Tân Phước Hưng','DAU_MOI','0900000061','contact.93045@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(62,62,'Đầu mối Trạm Y tế Xã Phương Phú','DAU_MOI','0900000062','contact.93046@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(63,63,'Đầu mối Trạm Y tế Xã Tân Long','DAU_MOI','0900000063','contact.93047@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(64,64,'Đầu mối Trạm Y tế Phường Ngã Bảy','DAU_MOI','0900000064','contact.93067@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(65,65,'Đầu mối Trạm Y tế Xã Đại Thành','DAU_MOI','0900000065','contact.93071@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(66,66,'Đầu mối Trạm Y tế Thị trấn Ngã Sáu','DAU_MOI','0900000066','contact.93026@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(67,67,'Đầu mối Trạm Y tế xã Đông Phước','DAU_MOI','0900000067','contact.93027@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(68,68,'Đầu mối Trạm Y tế Xã Phú An','DAU_MOI','0900000068','contact.93028@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(69,69,'Đầu mối Trạm Y tế Xã Đông Phú','DAU_MOI','0900000069','contact.93029@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(70,70,'Đầu mối Trạm Y tế Xã Phú Hữu','DAU_MOI','0900000070','contact.93030@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(71,71,'Đầu mối Trạm Y tế xã Châu Thành','DAU_MOI','0900000071','contact.93031@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(72,72,'Đầu mối Trạm Y tế Xã Đông Phước','DAU_MOI','0900000072','contact.93032@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(73,73,'Đầu mối Trạm Y tế Xã Đông Phước A','DAU_MOI','0900000073','contact.93033@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(74,74,'Đầu mối Phòng khám đa khoa KV Phú Tân','DAU_MOI','0900000074','contact.93087@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(75,75,'Đầu mối Trạm Y tế Thị trấn Một Ngàn','DAU_MOI','0900000075','contact.93018@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(76,76,'Đầu mối Trạm Y tế Trường Long Tây','DAU_MOI','0900000076','contact.93020@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(77,77,'Đầu mối Trạm Y tế Xã Tân Hòa','DAU_MOI','0900000077','contact.93022@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(78,78,'Đầu mối Trạm Y tế Xã Nhơn Nghĩa A','DAU_MOI','0900000078','contact.93023@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(79,79,'Đầu mối Trạm Y tế Xã Thạnh Xuân','DAU_MOI','0900000079','contact.93024@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(80,80,'Đầu mối Trạm Y tế Xã Tân Phú Thạnh','DAU_MOI','0900000080','contact.93025@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(81,81,'Đầu mối Trạm Y tế Bảy Ngàn','DAU_MOI','0900000081','contact.93073@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(82,82,'Đầu mối Trạm y tế thị trấn Rạch Gòi','DAU_MOI','0900000082','contact.93083@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(83,83,'Đầu mối Trạm y tế thị trấn Cái Tắc','DAU_MOI','0900000083','contact.93084@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(84,84,'Đầu mối Trạm Y tế Xã Trường Long A','DAU_MOI','0900000084','contact.93086@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(85,85,'Đầu mối Trạm Y tế Xã Vĩnh Thuận Đông','DAU_MOI','0900000085','contact.93063@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(86,86,'Đầu mối YTCQ Cty TNHH Lộc Tài II','DAU_MOI','0900000086','contact.93101@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(87,87,'Đầu mối Trạm Y tế Phường Lái Hiếu','DAU_MOI','0900000087','contact.93068@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(88,88,'Đầu mối Trạm Y tế Phường Hiệp Thành','DAU_MOI','0900000088','contact.93069@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(89,89,'Đầu mối Trạm Y tế Xã Hiệp Lợi','DAU_MOI','0900000089','contact.93070@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(90,90,'Đầu mối Trạm Y tế Xã Tân Thành','DAU_MOI','0900000090','contact.93072@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(91,91,'Đầu mối Trạm y tế phường Vị Thanh','DAU_MOI','0900000091','contact.93009@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(92,92,'Đầu mối Trạm Y tế Phường III','DAU_MOI','0900000092','contact.93010@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(93,93,'Đầu mối Trạm Y tế Phường IV','DAU_MOI','0900000093','contact.93011@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(94,94,'Đầu mối Trạm Y tế Phường V','DAU_MOI','0900000094','contact.93012@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(95,95,'Đầu mối Trạm Y tế Phường VII','DAU_MOI','0900000095','contact.93013@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(96,96,'Đầu mối Trạm Y tế Phường Vị Tân','DAU_MOI','0900000096','contact.93014@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(97,97,'Đầu mối Trạm Y tế Xã Hỏa Lựu','DAU_MOI','0900000097','contact.93015@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL),(98,98,'Đầu mối Trạm Y tế Xã Hỏa Tiế渁','DAU_MOI','0900000098','contact.93017@vnpt.local','2026-02-25 10:33:20',NULL,NULL,NULL);
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
  `customer_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tax_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_code` (`customer_code`)
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 25: Khách hàng doanh nghiệp';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'KH001','Ngân hàng Vietcombank','0100112437','198 Trần Quang Khải, Hoàn Kiếm, Hà Nội',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'KH002','Tập đoàn Petrolimex','0100107370','Số 1 Khâm Thiên, Đống Đa, Hà Nội',1,'2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(3,'93007','Bệnh viện Sản - Nhi Hậu Giang','0101234567',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(4,'93008','Bệnh viện Tâm thần - Da liễu Hậu Giang','0109876543',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(5,'93100','Bệnh viện Phổi Hậu Giang','0118518519',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(6,'93002','Trung tâm Y tế khu vực Vị Thủy','0127160495',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(7,'93003','Trung tâm Y tế khu vực Long Mỹ','0135802471',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(8,'93004','Trung tâm Y tế khu vực Phụng Hiệp','0144444447',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(9,'93089','Phòng khám đa khoa KV Kinh Cùng','0153086423',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(10,'93090','Phòng khám đa khoa KV Búng Tàu','0161728399',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(11,'93108','Trung tâm Y tế Thành phố Ngã Bảy','0170370375',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(12,'93005','Trung tâm Y tế Khu vực Châu Thành','0179012351',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(13,'93006','Trung tâm Y tế khu vực Châu Thành A','0187654327',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(14,'93016','Bệnh viện đa khoa khu vực Ngã Bảy','0196296303',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(15,'93078','Trung tâm Y tế Huyện Long Mỹ','0204938279',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(16,'93105','TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang','0213580255',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(17,'93106','Phòng khám đa khoa Thiên Tâm','0222222231',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(18,'93107','Phòng khám đa khoa CARE MEDIC CẦN THƠ','0230864207',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(19,'93109','Phòng khám đa khoa thuộc Trung tâm Y tế thành phố Vị Thanh','0239506183',NULL,1,'2026-02-25 01:03:51',NULL,'2026-02-25 01:03:51',NULL),(20,'93122','PHÒNG KHÁM ĐA KHOA TÂM AN','0248148159',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(21,'93129','Phòng khám đa khoa Medic Tây Đô','0256790135',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(22,'93130','Phòng khám đa khoa Tâm Phúc Cần Thơ','0265432111',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(23,'93457','TTYT Dự phòng Tỉnh Hậu Giang','0274074087',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(24,'93048','Trạm y tế xã Vị Thủy','0282716063',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(25,'93049','Trạm Y tế Xã Vị Trung','0291358039',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(26,'93050','Trạm Y tế Xã Vị Thủy','0300000015',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(27,'93051','Trạm Y tế Xã Vị Thắng','0308641991',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(28,'93052','Trạm y tế xã Vĩnh Thuận Đông','0317283967',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(29,'93053','Trạm Y tế Xã Vĩnh Trung','0325925943',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(30,'93054','Trạm y tế xã Vĩnh Tường','0334567919',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(31,'93055','Trạm Y tế Xã Vị Đông','0343209895',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(32,'93057','Trạm Y tế Xã Vị Bình','0351851871',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(33,'93080','Trạm y tế xã Vị Thanh 1','0360493847',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(34,'93019','Trạm Y tế phường Long Bình','0369135823',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(35,'93058','TYT P. Thuận An (TYT TT Long Mỹ)','0377777799',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(36,'93059','Trạm Y tế Xã Long Bình','0386419775',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(37,'93060','Trạm Y tế Xã Long Trị','0395061751',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(38,'93061','Trạm Y tế phường Long Phú 1','0403703727',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(39,'93062','Trạm Y tế Xã Thuận Hưng','0412345703',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(40,'93064','Trạm Y tế Xã Vĩnh Viễn','0420987679',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(41,'93065','Trạm Y tế Xã Lương Tâm','0429629655',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(42,'93066','Trạm Y tế xã Xà Phiên','0438271631',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(43,'93092','Trạm y tế phường Trà Lồng','0446913607',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(44,'93093','Trạm Y tế Thị trấn Trà Lồng','0455555583',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(45,'93094','Trạm Y tế Xã Tân Phú','0464197559',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(46,'93095','Trạm y tế xã Thuận Hòa','0472839535',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(47,'93096','Trạm Y tế Xã Vĩnh Viễn A','0481481511',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(48,'93097','Trạm Y tế phường Long Mỹ','0490123487',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(49,'93098','Trạm Y tế Xã Lương Nghĩa','0498765463',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(50,'93104','TYT phường Bình Thạnh','0507407439',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(51,'93035','Trạm Y tế Thị trấn Cây Dương','0516049415',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(52,'93036','Trạm Y tế Xã Tân Bình','0524691391',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(53,'93037','Trạm Y tế Xã Bình Thành','0533333367',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(54,'93038','Trạm Y tế Xã Thạnh Hòa','0541975343',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(55,'93039','Trạm Y tế Xã Long Thạnh','0550617319',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(56,'93040','Trạm Y tế Xã Phụng Hiệp','0559259295',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(57,'93041','Trạm Y tế Xã Hòa Mỹ','0567901271',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(58,'93042','Trạm Y tế Xã Hòa An','0576543247',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(59,'93043','Trạm Y tế Xã Phương Bình','0585185223',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(60,'93044','Trạm Y tế Xã Hiệp Hưng','0593827199',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(61,'93045','Trạm Y tế Xã Tân Phước Hưng','0602469175',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(62,'93046','Trạm Y tế Xã Phương Phú','0611111151',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(63,'93047','Trạm Y tế Xã Tân Long','0619753127',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(64,'93067','Trạm Y tế Phường Ngã Bảy','0628395103',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(65,'93071','Trạm Y tế Xã Đại Thành','0637037079',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(66,'93026','Trạm Y tế Thị trấn Ngã Sáu','0645679055',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(67,'93027','Trạm Y tế xã Đông Phước','0654321031',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(68,'93028','Trạm Y tế Xã Phú An','0662963007',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(69,'93029','Trạm Y tế Xã Đông Phú','0671604983',NULL,1,'2026-02-25 01:03:52',NULL,'2026-02-25 01:03:52',NULL),(70,'93030','Trạm Y tế Xã Phú Hữu','0680246959',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(71,'93031','Trạm Y tế xã Châu Thành','0688888935',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(72,'93032','Trạm Y tế Xã Đông Phước','0697530911',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(73,'93033','Trạm Y tế Xã Đông Phước A','0706172887',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(74,'93087','Phòng khám đa khoa KV Phú Tân','0714814863',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(75,'93018','Trạm Y tế Thị trấn Một Ngàn','0723456839',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(76,'93020','Trạm Y tế Trường Long Tây','0732098815',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(77,'93022','Trạm Y tế Xã Tân Hòa','0740740791',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(78,'93023','Trạm Y tế Xã Nhơn Nghĩa A','0749382767',NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(79,'93024','Trạm Y tế Xã Thạnh Xuân',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(80,'93025','Trạm Y tế Xã Tân Phú Thạnh',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(81,'93073','Trạm Y tế Bảy Ngàn',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(82,'93083','Trạm y tế thị trấn Rạch Gòi',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(83,'93084','Trạm y tế thị trấn Cái Tắc',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(84,'93086','Trạm Y tế Xã Trường Long A',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(85,'93063','Trạm Y tế Xã Vĩnh Thuận Đông',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(86,'93101','YTCQ Cty TNHH Lộc Tài II',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(87,'93068','Trạm Y tế Phường Lái Hiếu',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(88,'93069','Trạm Y tế Phường Hiệp Thành',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(89,'93070','Trạm Y tế Xã Hiệp Lợi',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(90,'93072','Trạm Y tế Xã Tân Thành',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(91,'93009','Trạm y tế phường Vị Thanh',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(92,'93010','Trạm Y tế Phường III',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(93,'93011','Trạm Y tế Phường IV',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(94,'93012','Trạm Y tế Phường V',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(95,'93013','Trạm Y tế Phường VII',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(96,'93014','Trạm Y tế Phường Vị Tân',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(97,'93015','Trạm Y tế Xã Hỏa Lựu',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL),(98,'93017','Trạm Y tế Xã Hỏa Tiế渁',NULL,NULL,1,'2026-02-25 01:03:53',NULL,'2026-02-25 01:03:53',NULL);
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `dept_code` (`dept_code`),
  KEY `fk_dept_parent` (`parent_id`),
  CONSTRAINT `fk_dept_parent` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 8: Cơ cấu tổ chức phòng ban';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (1,'9370dd70-10c8-11f1-a6f1-c80ff292045c','PB001','Ban Điều hành',4,'1/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-25 13:12:43',NULL),(2,'93742430-10c8-11f1-a6f1-c80ff292045c','PB002','Phòng Kinh doanh',4,'1/2/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-25 13:12:43',NULL),(3,'9376de78-10c8-11f1-a6f1-c80ff292045c','PB003','Phòng Kỹ thuật',4,'1/3/','ACTIVE','2026-02-23 08:01:47',NULL,'2026-02-25 13:12:43',NULL),(4,'abbbb6be-124b-11f1-a6f1-c80ff292045c','BGĐVT','Ban giám đốc Viễn Thông',NULL,'4/','ACTIVE','2026-02-25 06:12:43',NULL,'2026-02-25 13:12:43',NULL);
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_code` (`document_code`),
  KEY `fk_doc_type` (`document_type_id`),
  KEY `fk_doc_proj` (`project_id`),
  KEY `idx_documents_customer_id` (`customer_id`),
  CONSTRAINT `fk_doc_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_doc_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fk_doc_type` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 32: Hồ sơ / Công văn / Tài liệu';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documents`
--

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
INSERT INTO `documents` VALUES (1,'DOC001','Hợp đồng VNPT HIS - Bản chính',1,1,1,'2026-12-31','ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(2,'DOC002','Biên bản nghiệm thu giai đoạn 1',2,2,2,'2026-09-30','ACTIVE','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL),(4,'PRC_TEST_1772029082','Văn bản giá test',3,NULL,NULL,'2026-02-25','ACTIVE','2026-02-25 14:18:02',1,'2026-02-26 02:33:29',1);
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
  `account_email` varchar(255) DEFAULT NULL,
  `folder_id` varchar(255) DEFAULT NULL,
  `scopes` varchar(500) DEFAULT NULL,
  `impersonate_user` varchar(255) DEFAULT NULL,
  `file_prefix` varchar(100) DEFAULT NULL,
  `service_account_json` longtext,
  `last_tested_at` timestamp NULL DEFAULT NULL,
  `last_test_status` varchar(20) DEFAULT NULL,
  `last_test_message` varchar(500) DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_settings_provider_unique` (`provider`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `integration_settings`
--

LOCK TABLES `integration_settings` WRITE;
/*!40000 ALTER TABLE `integration_settings` DISABLE KEYS */;
INSERT INTO `integration_settings` VALUES (1,'GOOGLE_DRIVE',1,'vnpthishg@gmail.com','1pMzW-NIHjMTigXP9P3mQbWFhcdAQ0tr2','https://www.googleapis.com/auth/drive.file',NULL,'VNPT',NULL,'2026-02-25 16:14:02','FAILED','Thiếu Service Account JSON.',NULL,1,'2026-02-25 15:58:39','2026-02-25 16:14:02');
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `user_code` (`user_code`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_user_dept` (`department_id`),
  KEY `fk_user_pos` (`position_id`),
  CONSTRAINT `fk_internal_users_department_id` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_user_pos` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 14: Thông tin nhân sự & Tài khoản đăng nhập';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `internal_users`
--

LOCK TABLES `internal_users` WRITE;
/*!40000 ALTER TABLE `internal_users` DISABLE KEYS */;
INSERT INTO `internal_users` VALUES (1,'5fa8c238-10c2-11f1-a6f1-c80ff292045c','ADMIN001','admin','$2y$12$9pmLoh/7BJn1s5EbBJb42utYnDf1Hp8NuPJw0QbExkaSPHmtpx6Zq',NULL,'System Admin',NULL,'admin@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',4,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,'2026-02-26 23:52:06',NULL),(2,'5fa8c9ae-10c2-11f1-a6f1-c80ff292045c','DIR001','director','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Giám đốc Demo',NULL,'director@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',4,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,'2026-02-25 13:12:43',NULL),(3,'5fa8ccf6-10c2-11f1-a6f1-c80ff292045c','MAN001','manager','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Trưởng phòng Demo',NULL,'manager@vnpt.vn',NULL,NULL,NULL,NULL,'ACTIVE',4,NULL,NULL,'NO','2026-02-23 14:17:23',NULL,'2026-02-25 13:12:43',NULL),(4,'2a3fbfee-08b5-4e64-9a74-46db187527a4','INT9001','admin.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Nguyễn Quản Trị','System Administrator','admin.demo@vnpt.vn',NULL,'1990-01-15','MALE',NULL,'ACTIVE',3,1,'10.10.10.10','YES','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL),(5,'ca2b4545-e172-4d36-accd-748b88ea2690','INT9002','sales.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Trần Kinh Doanh','Sales Executive','sales.demo@vnpt.vn',NULL,'1994-05-20','FEMALE',NULL,'ACTIVE',2,2,'10.10.10.21','NO','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL),(6,'f3f2ebe0-a803-45fe-bfbd-998510aebe92','INT9003','system.demo','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',NULL,'Lê Hệ Thống','Automation Operator','system.demo@vnpt.vn',NULL,'1988-11-11','OTHER',NULL,'SUSPENDED',3,3,'10.10.10.99','YES','2026-02-23 08:01:47',NULL,'2026-02-23 08:19:41',NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 1: Quản lý vết migration';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_02_21_152322_create_personal_access_tokens_table',1),(5,'2026_02_23_134500_create_v5_enterprise_master_tables',1),(6,'2026_02_23_220000_add_extended_fields_to_employees_table',1),(7,'2026_02_23_220100_create_audit_logs_table',1),(9,'2026_02_25_153000_add_trial_status_to_projects_enum',2),(11,'2026_02_25_171000_refine_project_status_workflow',3),(12,'2026_02_24_180000_drop_legacy_employees_table',4),(13,'2026_02_25_090000_enforce_department_and_employee_constraints',4),(14,'2026_02_25_200000_create_document_product_links_table',4),(15,'2026_02_25_213000_create_integration_settings_table',5),(16,'2026_02_26_090000_create_auth_login_attempts_table',6),(17,'2026_02_26_091000_revoke_non_expiring_personal_access_tokens',6),(18,'2026_02_26_092000_harden_document_and_contract_integrity',6),(19,'2026_02_26_134500_optimize_support_request_indexes',7),(20,'2026_02_26_152000_add_audit_created_by_index',8),(21,'2026_02_27_090000_replace_support_request_statuses',9),(22,'2026_02_27_160000_drop_support_request_legacy_notes_columns',10),(23,'2026_02_27_170000_add_support_request_receiver_and_reporter_contact',11),(24,'2026_02_27_180000_make_support_request_hotfix_noti_nullable',12),(25,'2026_02_27_190000_create_support_request_tasks_table',12),(26,'2026_02_27_200000_normalize_support_request_task_statuses',13),(27,'2026_02_27_210000_allow_duplicate_support_request_ticket_codes',14),(28,'2026_02_28_010000_optimize_support_tasks_and_groups_indexes',15),(29,'2026_02_28_020000_create_support_request_statuses_table',16);
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
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (1,'App\\Models\\InternalUser',1,'vnpt_business_web','51121a7f6abcf0ee54674f7bfa56c094bbb2c230b4943b8df3bfa78d5ff426e4','[\"*\"]',NULL,'2026-02-25 19:33:29','2026-02-24 16:46:12','2026-02-25 19:33:29'),(2,'App\\Models\\InternalUser',5,'vnpt_business_web','eaa1e541e2db8a9ef904100245411bde570695df96ebabfcceb983c54a454d15','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 16:46:27','2026-02-25 19:33:29','2026-02-24 16:46:27','2026-02-25 19:33:29'),(3,'App\\Models\\InternalUser',5,'vnpt_business_web','7968cbc9b83428e82e1db3df41fd1c340663711fdc1e9bac4dac699fa2db2e75','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 16:46:48','2026-02-25 19:33:29','2026-02-24 16:46:48','2026-02-25 19:33:29'),(4,'App\\Models\\InternalUser',5,'vnpt_business_web','1d839e46b1dc73124669bab4725247dca6ef838db18d73e545190e8cc52df5de','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 16:46:59','2026-02-25 19:33:29','2026-02-24 16:46:59','2026-02-25 19:33:29'),(6,'App\\Models\\InternalUser',1,'vnpt_business_web','4be372717886bb889d1ff3f7cb33b02a9c1eedd02ba73981c7602e0094ea9887','[\"*\"]','2026-02-24 17:11:34','2026-02-25 19:33:29','2026-02-24 16:50:05','2026-02-25 19:33:29'),(7,'App\\Models\\InternalUser',1,'vnpt_business_web','3a90cb04f4506ebd426c6ef5802c21a6d7bc0f3d7f4dc4da60530893be98e477','[\"*\"]','2026-02-24 17:04:59','2026-02-25 19:33:29','2026-02-24 17:04:59','2026-02-25 19:33:29'),(8,'App\\Models\\InternalUser',5,'vnpt_business_web','295c86c798cd6e70e6925700c36f9150d509ad9f9aa89f3b5895a28203faf502','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-24 17:04:59','2026-02-25 19:33:29','2026-02-24 17:04:59','2026-02-25 19:33:29'),(9,'App\\Models\\InternalUser',1,'vnpt_business_web','37e5aef51ffd52c43e312482974d552b007eb83a5079f49552853f5886730c80','[\"*\"]','2026-02-24 17:09:01','2026-02-25 19:33:29','2026-02-24 17:09:01','2026-02-25 19:33:29'),(10,'App\\Models\\InternalUser',1,'vnpt_business_web','fe553d6d88f65ad0e55e282d0ec32332304c743f39ab3499851ade59ebfb035a','[\"*\"]','2026-02-25 16:29:38','2026-02-25 19:33:29','2026-02-25 00:55:54','2026-02-25 19:33:29'),(11,'App\\Models\\InternalUser',1,'vnpt_business_web','6f1bef0da90f41e43a564872a8499fd11515089f31a7dbcab91246daed29f9cd','[\"*\"]','2026-02-25 01:27:54','2026-02-25 19:33:29','2026-02-25 01:27:54','2026-02-25 19:33:29'),(12,'App\\Models\\InternalUser',1,'vnpt_business_web','6787f59e890cc0dcacf8ff9a6f8d45f4b4738b9b90bb51f89d5a8e02060556eb','[\"*\"]','2026-02-25 01:35:49','2026-02-25 19:33:29','2026-02-25 01:35:49','2026-02-25 19:33:29'),(13,'App\\Models\\InternalUser',1,'vnpt_business_web','f7cd7b74db60deff08f95229bb4d0df9b4b863cd8a45c72839c89884d32f491e','[\"*\"]','2026-02-25 01:38:56','2026-02-25 19:33:29','2026-02-25 01:38:56','2026-02-25 19:33:29'),(14,'App\\Models\\InternalUser',1,'vnpt_business_web','21f22f762b13c8a08c13f59aeb0f439fcf0e5b492170d0dfdef2b13e83605474','[\"*\"]','2026-02-25 01:39:26','2026-02-25 19:33:29','2026-02-25 01:39:26','2026-02-25 19:33:29'),(15,'App\\Models\\InternalUser',1,'vnpt_business_web','27e0df5019f4eba77bad9a9458bc86c5ee31b76718b0c4ba9935540a099a9f55','[\"*\"]','2026-02-25 01:40:16','2026-02-25 19:33:29','2026-02-25 01:40:16','2026-02-25 19:33:29'),(16,'App\\Models\\InternalUser',1,'vnpt_business_web','1e8f36635445516e1fd176918275981d3d654b21a952b6c2a04fa4f30cca625f','[\"*\"]','2026-02-25 03:54:58','2026-02-25 19:33:29','2026-02-25 03:54:58','2026-02-25 19:33:29'),(17,'App\\Models\\InternalUser',1,'vnpt_business_web','beafef575f75f67d26a30a02898bbdaca9219966ad8efc16730a9f7875df8923','[\"*\"]','2026-02-25 05:33:41','2026-02-25 19:33:29','2026-02-25 04:24:43','2026-02-25 19:33:29'),(18,'App\\Models\\InternalUser',1,'vnpt_business_web','1d629488261890206b9f6c0588b44c7ef9288a653dfb0ce13f09df14debc1d70','[\"*\"]','2026-02-25 07:17:43','2026-02-25 19:33:29','2026-02-25 05:59:16','2026-02-25 19:33:29'),(19,'App\\Models\\InternalUser',4,'vnpt_business_web','658657290f8db4af85833723aca33880fdee15f013a2dfc0e16c9ceefdb028f1','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-25 06:13:25','2026-02-25 19:33:29','2026-02-25 06:13:25','2026-02-25 19:33:29'),(20,'App\\Models\\InternalUser',4,'vnpt_business_web','ee4250a918738d39df64069857839531c06bb43ef3ce9c442ab73a05d58a5487','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-25 06:13:46','2026-02-25 19:33:29','2026-02-25 06:13:46','2026-02-25 19:33:29'),(21,'App\\Models\\InternalUser',1,'vnpt_business_web','4b798a2d9391d044c5313e5eb7e7242bc3381e758ea9e4bada1141a3f60049ec','[\"*\"]',NULL,'2026-02-25 19:33:29','2026-02-25 06:14:36','2026-02-25 19:33:29'),(22,'App\\Models\\InternalUser',1,'vnpt_business_web','3d07c973b1d00d008d87cd535af7a5f98dfcec13be6057744f5c1c66bb789d14','[\"*\"]','2026-02-25 06:14:59','2026-02-25 19:33:29','2026-02-25 06:14:59','2026-02-25 19:33:29'),(23,'App\\Models\\InternalUser',1,'vnpt_business_web','b918291d3b29c5bdc5d65b1a984cef353e5e4d528114d0ba20469e02282f207b','[\"*\"]','2026-02-25 06:17:20','2026-02-25 19:33:29','2026-02-25 06:17:20','2026-02-25 19:33:29'),(24,'App\\Models\\InternalUser',4,'vnpt_business_web','c68e9229710e6d5cebd44ded6c1e50c2d01728bba001be7daaef969618ce8737','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-25 07:17:21','2026-02-25 19:33:29','2026-02-25 07:17:20','2026-02-25 19:33:29'),(25,'App\\Models\\InternalUser',1,'vnpt_business_web','5f66f9aca570fb6b5bb9137e4545dd438b12bea285e631cd3244d37970d71faf','[\"*\"]',NULL,'2026-02-25 19:33:29','2026-02-25 07:17:37','2026-02-25 19:33:29'),(26,'App\\Models\\InternalUser',1,'vnpt_business_web','eafab23eee4b2ed75bfd15ee78286e106a1cd8742c8c57c867dace515127ebec','[\"*\"]','2026-02-25 07:18:02','2026-02-25 19:33:29','2026-02-25 07:18:01','2026-02-25 19:33:29'),(27,'App\\Models\\InternalUser',1,'vnpt_business_web','7ed723c400080468402f3c9869af28976b4cbb129ad2bb14358986a487fd4a5c','[\"*\"]','2026-02-25 07:37:00','2026-02-25 19:33:29','2026-02-25 07:22:55','2026-02-25 19:33:29'),(28,'App\\Models\\InternalUser',1,'vnpt_business_web','454eae86cbdce6bb409c4d2b398ba458f6488852337e57b52d076f106af36ad2','[\"*\"]','2026-02-25 16:29:39','2026-02-25 19:33:29','2026-02-25 16:15:32','2026-02-25 19:33:29'),(29,'App\\Models\\InternalUser',4,'vnpt_business_web','71acfda9efa7df35ee7e580c233d38337e9e00267690a304865fc81ac9d01705','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]',NULL,'2026-02-26 03:38:08','2026-02-25 19:38:08','2026-02-25 19:38:08'),(30,'App\\Models\\InternalUser',4,'vnpt_business_web','fc7b81cc6ed7dc4fff065d00269b26ec9ecddd3b7297425b16305020e7dc7d41','[\"dashboard.view\",\"departments.read\",\"employees.read\",\"user_dept_history.read\",\"businesses.read\",\"vendors.read\",\"products.read\",\"customers.read\",\"customer_personnel.read\",\"opportunities.read\",\"opportunities.write\",\"projects.read\",\"projects.write\",\"contracts.read\",\"contracts.payments\",\"documents.read\",\"reminders.read\",\"support_service_groups.read\",\"support_requests.read\",\"support_requests.write\",\"support_requests.import\",\"support_requests.export\",\"support_requests.status\",\"support_requests.history\"]','2026-02-25 19:41:08','2026-02-26 03:40:21','2026-02-25 19:40:21','2026-02-25 19:41:08'),(32,'App\\Models\\InternalUser',1,'vnpt_business_web','1331b467b1a233a2c11b94207f8170469963cf1c7d72aa77f9e10180e3155746','[\"*\"]','2026-02-25 20:37:59','2026-02-26 04:22:23','2026-02-25 20:22:23','2026-02-25 20:37:59'),(33,'App\\Models\\InternalUser',1,'vnpt_business_web','6da1cb0bfc82423e9f31911fb3054e48fcffad64fd9a87590582f320d3d01121','[\"*\"]','2026-02-25 23:28:48','2026-02-26 07:06:55','2026-02-25 23:06:55','2026-02-25 23:28:48'),(34,'App\\Models\\InternalUser',1,'vnpt_business_web','2fa264ff3e8d9a66e524fcd3b97be1c16c8cd76fd130423c99ccd8b0e7c544a4','[\"*\"]','2026-02-26 04:57:15','2026-02-26 08:18:18','2026-02-26 00:18:18','2026-02-26 04:57:15'),(35,'App\\Models\\InternalUser',1,'vnpt_business_web','687db756a6c06ab2946a442771de3c6af775f69412d284621df8174f6c14e395','[\"*\"]','2026-02-26 05:48:47','2026-02-26 12:50:28','2026-02-26 04:50:28','2026-02-26 05:48:47'),(36,'App\\Models\\InternalUser',1,'vnpt_business_web','3fbc960159420f60ebceecc9d1f1868e5a834d217b35e35563ce511a4d10a11f','[\"*\"]',NULL,'2026-02-26 13:37:44','2026-02-26 05:37:44','2026-02-26 05:37:44'),(37,'App\\Models\\InternalUser',1,'vnpt_business_web','c7a22f1a920eac4548c839ec638923233526e6340c8714bb6f333c4987e72e70','[\"*\"]','2026-02-26 06:39:15','2026-02-26 14:15:35','2026-02-26 06:15:35','2026-02-26 06:39:15'),(38,'App\\Models\\InternalUser',1,'vnpt_business_web','6103513b050ee487f5ec174323bc8b74ad0c7af8dd54aa4331d46406746cee13','[\"*\"]','2026-02-26 07:48:36','2026-02-26 14:30:12','2026-02-26 06:30:12','2026-02-26 07:48:36'),(39,'App\\Models\\InternalUser',1,'vnpt_business_web','3b8cba99404b19170d11103f51abc11d0401a3fdd264bec2811a7b60c263a133','[\"*\"]',NULL,'2026-02-26 15:11:26','2026-02-26 07:11:26','2026-02-26 07:11:26'),(40,'App\\Models\\InternalUser',1,'vnpt_business_web','4ebd70ccadd9e26899b95d4b6f006ada2cdab006c55ea14ab16f3187aa376b44','[\"*\"]',NULL,'2026-02-26 15:11:27','2026-02-26 07:11:27','2026-02-26 07:11:27'),(41,'App\\Models\\InternalUser',1,'vnpt_business_web','f23a89bcad56f0cef154363058f5fca4175f410e3796be2697b629a4ccbae187','[\"*\"]',NULL,'2026-02-26 15:11:28','2026-02-26 07:11:28','2026-02-26 07:11:28'),(42,'App\\Models\\InternalUser',1,'vnpt_business_web','b8105ab6af5d0717fc869d1e62e4e4d61992aea92e3de1563c139275c060ab9c','[\"*\"]',NULL,'2026-02-26 15:11:47','2026-02-26 07:11:47','2026-02-26 07:11:47'),(43,'App\\Models\\InternalUser',1,'vnpt_business_web','04a659d0247f6646d96bf8ad1e5f6d1d49ab514dae53d0cb9142a90c798b9be8','[\"*\"]','2026-02-26 07:13:30','2026-02-26 15:12:11','2026-02-26 07:12:11','2026-02-26 07:13:30'),(44,'App\\Models\\InternalUser',1,'vnpt_business_web','011c0923d1a037d3b9ac90d470708255b40afb927bcea3a4b4634789d2644e1e','[\"*\"]','2026-02-26 07:24:26','2026-02-26 15:17:39','2026-02-26 07:17:39','2026-02-26 07:24:26'),(45,'App\\Models\\InternalUser',1,'vnpt_business_web','57462e47845d07790db80a94c0f0f09f1f5110469bb004e92fcc79006570de9a','[\"*\"]','2026-02-26 07:41:47','2026-02-26 15:34:57','2026-02-26 07:34:57','2026-02-26 07:41:47'),(46,'App\\Models\\InternalUser',1,'vnpt_business_web','b2805773a73df2246f5addb85f7b361ff90476afbd647c0eedfcc5c81e5be18b','[\"*\"]','2026-02-26 15:47:49','2026-02-26 23:47:22','2026-02-26 15:47:22','2026-02-26 15:47:49'),(47,'App\\Models\\InternalUser',1,'vnpt_business_web','11a2e63c46331f7a4bb282e5d1bd4727a73a1659bedce3848e32d18e03967a49','[\"*\"]','2026-02-26 15:52:07','2026-02-26 23:52:01','2026-02-26 15:52:01','2026-02-26 15:52:07'),(48,'App\\Models\\InternalUser',1,'vnpt_business_web','5a46650cc7b98fcd5a5d57968c56e73cf6576d3afd23307e96923e103d968536','[\"*\"]','2026-02-26 15:54:28','2026-02-26 23:54:28','2026-02-26 15:54:28','2026-02-26 15:54:28'),(49,'App\\Models\\InternalUser',1,'vnpt_business_web','86f1f958e0b107b7fc367385c7b9df4403255f7505c09dc38cca6fa073a98375','[\"*\"]','2026-02-26 15:57:26','2026-02-26 23:57:25','2026-02-26 15:57:25','2026-02-26 15:57:26'),(50,'App\\Models\\InternalUser',1,'vnpt_business_web','85843173294306e95667a1023c10cc88e99dc72d22883bdb272c8f2ffec70e2a','[\"*\"]',NULL,'2026-02-27 00:52:16','2026-02-26 16:52:16','2026-02-26 16:52:16'),(51,'App\\Models\\InternalUser',1,'vnpt_business_web','67a0a6b448638cb69036fd5b06a6e9446dab984b39b5d6d52e41abd504db938c','[\"*\"]','2026-02-26 20:51:44','2026-02-27 00:52:36','2026-02-26 16:52:36','2026-02-26 20:51:44'),(52,'App\\Models\\InternalUser',1,'vnpt_business_web','a23eade8b038077fb7dea474ae8689407a64801d7be2249f361df3ac305c4abf','[\"*\"]','2026-02-27 02:42:31','2026-02-27 03:03:50','2026-02-26 19:03:50','2026-02-27 02:42:31'),(53,'App\\Models\\InternalUser',1,'vnpt_business_web','2397fe83036125fb3696f165c282c01c7fc0083d3cb53b3eb5d50ed9d94eb0a6','[\"*\"]','2026-02-26 23:41:43','2026-02-27 04:59:31','2026-02-26 20:59:31','2026-02-26 23:41:43'),(54,'App\\Models\\InternalUser',1,'vnpt_business_web','f716473dddb68dc83c5fc16d4a77914abaab9cd69a7e00b4b43b456f90cbcc1b','[\"*\"]','2026-02-27 02:34:56','2026-02-27 10:33:40','2026-02-27 02:33:40','2026-02-27 02:34:56'),(55,'App\\Models\\InternalUser',1,'vnpt_business_web','1a6c33f074dcc8d7a321cd6654b972e4e583ea5c58972f15ce81fa804bfd37b6','[\"*\"]',NULL,'2026-02-27 11:31:10','2026-02-27 03:31:10','2026-02-27 03:31:10'),(56,'App\\Models\\InternalUser',1,'vnpt_business_web','eae8ca6ce4cccd77dabeedafc24dc4b8b010416cff54ce0710356bba0dcc90ef','[\"*\"]','2026-02-27 03:34:01','2026-02-27 11:32:19','2026-02-27 03:32:19','2026-02-27 03:34:01'),(57,'App\\Models\\InternalUser',1,'vnpt_business_web','341bc56aedea616005a5f2f7106fd77e2bff6582479b82cdb13153a2ce6d88b4','[\"*\"]','2026-02-28 23:17:22','2026-03-01 03:37:26','2026-02-28 19:37:26','2026-02-28 23:17:22'),(58,'App\\Models\\InternalUser',1,'vnpt_business_web','b6fee8cd0128c632250c1a2cf47b76dd2ef7176678d373849b496b44cb98cb8a','[\"*\"]','2026-02-28 23:14:18','2026-03-01 06:19:08','2026-02-28 22:19:08','2026-02-28 23:14:18');
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
) ENGINE=InnoDB AUTO_INCREMENT=130 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 29: Hạng mục chi tiết dự án';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_items`
--

LOCK TABLES `project_items` WRITE;
/*!40000 ALTER TABLE `project_items` DISABLE KEYS */;
INSERT INTO `project_items` VALUES (1,1,1,1.00,150000000.00,'2026-02-24 01:00:00',NULL,'2026-02-24 01:00:00',NULL,NULL),(2,2,2,1.00,80000000.00,'2026-02-24 01:05:00',NULL,'2026-02-24 01:05:00',NULL,NULL),(3,95,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(4,94,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(5,93,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(6,92,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(7,91,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(8,90,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(9,89,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(10,88,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(11,87,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(12,86,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(13,85,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(14,84,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(15,83,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(16,82,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(17,81,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(18,80,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(19,79,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(20,78,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(21,77,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(22,76,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(23,75,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(24,74,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(25,73,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(26,72,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(27,71,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(28,70,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(29,69,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(30,68,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(31,67,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(32,66,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(33,65,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(34,64,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(35,63,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(36,62,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(37,61,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(38,60,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(39,59,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(40,58,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(41,57,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(42,56,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(43,55,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(44,54,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(45,53,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(46,52,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(47,51,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(48,50,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(49,49,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(50,48,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(51,47,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(52,46,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(53,45,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(54,44,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(55,43,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(56,42,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(57,41,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(58,40,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(59,39,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(60,38,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(61,37,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(62,36,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(63,35,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(64,34,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(65,33,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(66,32,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(67,31,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(68,30,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(69,29,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(70,28,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(71,27,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(72,26,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(73,25,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(74,24,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(75,23,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(76,22,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(77,21,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(78,20,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(79,19,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(80,18,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(81,17,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(82,16,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(83,15,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(84,14,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(85,13,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(86,12,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(87,11,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(88,10,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(89,9,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(90,8,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(91,7,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(92,6,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(93,5,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(94,4,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(95,3,1,1.00,150000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(96,98,2,1.00,80000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(97,97,2,1.00,80000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL),(98,96,2,1.00,80000000.00,'2026-02-25 08:21:11',NULL,NULL,NULL,NULL);
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
INSERT INTO `projects` VALUES (1,'DA001','Dự án VNPT HIS - Vietcombank',1,1,'DAU_TU','2026-01-10','2026-12-31','ONGOING','2026-02-23 08:16:35',NULL,'2026-02-23 08:19:41',NULL,NULL),(2,'DA002','Dự án SOC - Petrolimex',2,2,'THUE_DICH_VU','2026-02-01','2026-10-01','ONGOING','2026-02-23 08:16:35',NULL,'2026-02-26 04:48:05',1,NULL),(3,'DA098','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hỏa Tiế渁',98,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(4,'DA097','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hỏa Lựu',97,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(5,'DA096','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường Vị Tân',96,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(6,'DA095','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường VII',95,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(7,'DA094','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường V',94,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(8,'DA093','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường IV',93,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(9,'DA092','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường III',92,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(10,'DA091','Dự án Giải pháp VNPT HIS - Trạm y tế phường Vị Thanh',91,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(11,'DA090','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Thành',90,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(12,'DA089','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hiệp Lợi',89,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(13,'DA088','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường Hiệp Thành',88,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(14,'DA087','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường Lái Hiếu',87,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(15,'DA086','Dự án Giải pháp VNPT HIS - YTCQ Cty TNHH Lộc Tài II',86,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(16,'DA085','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vĩnh Thuận Đông',85,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(17,'DA084','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Trường Long A',84,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(18,'DA083','Dự án Giải pháp VNPT HIS - Trạm y tế thị trấn Cái Tắc',83,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(19,'DA082','Dự án Giải pháp VNPT HIS - Trạm y tế thị trấn Rạch Gòi',82,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(20,'DA081','Dự án Giải pháp VNPT HIS - Trạm Y tế Bảy Ngàn',81,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(21,'DA080','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Phú Thạnh',80,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(22,'DA079','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Thạnh Xuân',79,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(23,'DA078','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Nhơn Nghĩa A',78,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(24,'DA077','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Hòa',77,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(25,'DA076','Dự án Giải pháp VNPT HIS - Trạm Y tế Trường Long Tây',76,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(26,'DA075','Dự án Giải pháp VNPT HIS - Trạm Y tế Thị trấn Một Ngàn',75,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(27,'DA074','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa KV Phú Tân',74,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(28,'DA073','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Đông Phước A',73,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(29,'DA072','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Đông Phước',72,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(30,'DA071','Dự án Giải pháp VNPT HIS - Trạm Y tế xã Châu Thành',71,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(31,'DA070','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Phú Hữu',70,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(32,'DA069','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Đông Phú',69,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(33,'DA068','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Phú An',68,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(34,'DA067','Dự án Giải pháp VNPT HIS - Trạm Y tế xã Đông Phước',67,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(35,'DA066','Dự án Giải pháp VNPT HIS - Trạm Y tế Thị trấn Ngã Sáu',66,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(36,'DA065','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Đại Thành',65,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(37,'DA064','Dự án Giải pháp VNPT HIS - Trạm Y tế Phường Ngã Bảy',64,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(38,'DA063','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Long',63,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(39,'DA062','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Phương Phú',62,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(40,'DA061','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Phước Hưng',61,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(41,'DA060','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hiệp Hưng',60,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(42,'DA059','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Phương Bình',59,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(43,'DA058','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hòa An',58,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(44,'DA057','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Hòa Mỹ',57,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(45,'DA056','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Phụng Hiệp',56,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(46,'DA055','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Long Thạnh',55,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(47,'DA054','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Thạnh Hòa',54,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(48,'DA053','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Bình Thành',53,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(49,'DA052','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Bình',52,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(50,'DA051','Dự án Giải pháp VNPT HIS - Trạm Y tế Thị trấn Cây Dương',51,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(51,'DA049','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Lương Nghĩa',49,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(52,'DA048','Dự án Giải pháp VNPT HIS - Trạm Y tế phường Long Mỹ',48,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(53,'DA047','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vĩnh Viễn A',47,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(54,'DA046','Dự án Giải pháp VNPT HIS - Trạm y tế xã Thuận Hòa',46,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(55,'DA045','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Tân Phú',45,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(56,'DA044','Dự án Giải pháp VNPT HIS - Trạm Y tế Thị trấn Trà Lồng',44,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(57,'DA043','Dự án Giải pháp VNPT HIS - Trạm y tế phường Trà Lồng',43,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(58,'DA042','Dự án Giải pháp VNPT HIS - Trạm Y tế xã Xà Phiên',42,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(59,'DA041','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Lương Tâm',41,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(60,'DA040','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vĩnh Viễn',40,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(61,'DA039','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Thuận Hưng',39,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(62,'DA038','Dự án Giải pháp VNPT HIS - Trạm Y tế phường Long Phú 1',38,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(63,'DA037','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Long Trị',37,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(64,'DA036','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Long Bình',36,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(65,'DA034','Dự án Giải pháp VNPT HIS - Trạm Y tế phường Long Bình',34,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(66,'DA033','Dự án Giải pháp VNPT HIS - Trạm y tế xã Vị Thanh 1',33,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(67,'DA032','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vị Bình',32,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(68,'DA031','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vị Đông',31,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(69,'DA030','Dự án Giải pháp VNPT HIS - Trạm y tế xã Vĩnh Tường',30,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(70,'DA029','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vĩnh Trung',29,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(71,'DA028','Dự án Giải pháp VNPT HIS - Trạm y tế xã Vĩnh Thuận Đông',28,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(72,'DA027','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vị Thắng',27,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(73,'DA026','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vị Thủy',26,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(74,'DA025','Dự án Giải pháp VNPT HIS - Trạm Y tế Xã Vị Trung',25,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(75,'DA024','Dự án Giải pháp VNPT HIS - Trạm y tế xã Vị Thủy',24,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(76,'DA023','Dự án Giải pháp VNPT HIS - TTYT Dự phòng Tỉnh Hậu Giang',23,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(77,'DA022','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa Tâm Phúc Cần Thơ',22,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(78,'DA021','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa Medic Tây Đô',21,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(79,'DA020','Dự án Giải pháp VNPT HIS - PHÒNG KHÁM ĐA KHOA TÂM AN',20,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(80,'DA019','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa thuộc Trung tâm Y tế thành phố Vị Thanh',19,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(81,'DA018','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa CARE MEDIC CẦN THƠ',18,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(82,'DA017','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa Thiên Tâm',17,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(83,'DA015','Dự án Giải pháp VNPT HIS - Trung tâm Y tế Huyện Long Mỹ',15,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(84,'DA014','Dự án Giải pháp VNPT HIS - Bệnh viện đa khoa khu vực Ngã Bảy',14,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(85,'DA013','Dự án Giải pháp VNPT HIS - Trung tâm Y tế khu vực Châu Thành A',13,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(86,'DA012','Dự án Giải pháp VNPT HIS - Trung tâm Y tế Khu vực Châu Thành',12,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(87,'DA011','Dự án Giải pháp VNPT HIS - Trung tâm Y tế Thành phố Ngã Bảy',11,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(88,'DA010','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa KV Búng Tàu',10,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(89,'DA009','Dự án Giải pháp VNPT HIS - Phòng khám đa khoa KV Kinh Cùng',9,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(90,'DA008','Dự án Giải pháp VNPT HIS - Trung tâm Y tế khu vực Phụng Hiệp',8,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(91,'DA007','Dự án Giải pháp VNPT HIS - Trung tâm Y tế khu vực Long Mỹ',7,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(92,'DA006','Dự án Giải pháp VNPT HIS - Trung tâm Y tế khu vực Vị Thủy',6,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(93,'DA005','Dự án Giải pháp VNPT HIS - Bệnh viện Phổi Hậu Giang',5,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(94,'DA004','Dự án Giải pháp VNPT HIS - Bệnh viện Tâm thần - Da liễu Hậu Giang',4,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(95,'DA003','Dự án Giải pháp VNPT HIS - Bệnh viện Sản - Nhi Hậu Giang',3,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(96,'DA050','Dự án Dịch vụ giám sát SOC - TYT phường Bình Thạnh',50,NULL,'DAU_TU','2026-02-25','2026-11-25','TRIAL','2026-02-25 08:21:11',NULL,'2026-02-25 10:53:13',NULL,NULL),(97,'DA035','Dự án Dịch vụ giám sát SOC - TYT P. Thuận An (TYT TT Long Mỹ)',35,NULL,'DAU_TU','2026-02-25','2026-11-25','CANCELLED','2026-02-25 08:21:11',NULL,'2026-02-26 07:31:46',1,NULL),(98,'DA016','Dự án Dịch vụ giám sát SOC - TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang',16,NULL,'DAU_TU','2026-02-25','2026-11-25','WARRANTY','2026-02-25 08:21:11',NULL,'2026-02-26 07:31:41',1,NULL);
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
INSERT INTO `sessions` VALUES ('6ndhXdro6clAWy76525wUm76JkBdN2lgqQobLvk0',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiSzFIdzlBMDduYnB5UTFBY3hxeWpGTW9QanVaNDl0VkI5Y21mZFppSCI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772154492),('8Euxd6LMO4dVeOjtbO9lTqPNKYLgM4UpZMPA5Tcr',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiNXJjZUxHZFJBVDVDWUpWMVBPSnNGR0dheGxHY1FyR0l3bktPWDJZUiI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772149827),('axfEdOBJ9Oznj9qpSTxcLCxEMN47V3REa0wKcWpi',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoicW5FVzl5djFKa0tGZzI2Z0duNlV4dGtINnMzS25scENVb29UWmpsOCI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772085977),('b8nw0GuFzdxtBhzoCJNXa6LR4krqFKcAtD0GDZIN',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoidzcyTW9uWGV3cXJqOUtCVGhMVFZkUVBya3RBVFk0THRvRkxab2RJbiI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772180193),('et2azrSJwCZMuy9UbVnG8T8DrvC6pAS79EZ0S2bj',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoiNGgxSFF5Z0Ixa2lhaW9LVFA0QTFPVUY3YU5odEdnTFg5Vm93SDgxMSI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772178547),('fNfnDlahzLdmqVzsXyH9JlL3TmJtlYyA8Y17MvnO',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoiMTdvenhzMzJ0U21RUDlQOEJiVURTeVM2SzgzbGEwSEp6UHBtSndZSyI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772145964),('h6oULGFL9LKpOOnkwP8Idm7v2Ld9qfGdfjSnjiVQ',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoidDRJQVc1aks3RjlyVWlEQ0FTWG1xOTN4VWNXVXF0UUtDdDlENzFqbyI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMSI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772183667),('HMlVGNmBEENYB5NOEbcRYNqygtc0bup787PQR8GC',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoic3pRSWxHMjFZT2J0c1hISGRrR2hCWTBhWlgxRFhENEVoSXNQak96cyI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772159377),('OoN6Qnx88sCiDL5eyyhZZimXKxkTyLLBKXufHGDK',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoidmhCbHZ1Wm9hRGdEM1hWME9vQkN1Tjk2cjhhNDd0ZnVLRDJhVWd5SyI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772008863),('p1AOkLW61l0yr4GFQaw0SWQNFMshR3eZ78WXa6iu',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoiUFlRRGtGZWRDQ1NiN1BnMDF4OW1vYXZ2T21XSjdrZXhnZFVUT1I1diI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772016988),('qxeqglsTpDbp651GJ3kVHbGx82AF8tsOrify6FG7',NULL,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','YTozOntzOjY6Il90b2tlbiI7czo0MDoiTjFQdXBQdnY5MmxxZUFNa3VlSkozdDVxa3VKb1Q5QlY1ZXYwNWF4USI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772085999),('R2tfjh5PNvzlCiz4CPbY9vfLa8KuuTAHlISMVTHr',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoiYUdMU3dZT3lNVkJsVjZwRTRIbFJkb2JxbEVhU0RMaUZzTVVkSVZxQiI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772008613),('ta8qW3OeykS5Ya54NdlgjOBwh1tV0eE3tbZOMZ7c',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoidUFUNVNZamNGZVJlUUVHaW5FWDc5QWpsQ1ZhdDFPRXRCYzdsOFVhVyI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772177912),('tOK9kWiqf2s1eFk7Bh3hxhVJxQrGrdGi21PhRCYZ',NULL,'127.0.0.1','curl/8.7.1','YTozOntzOjY6Il90b2tlbiI7czo0MDoiTm5ScTBwb0FlbUJZcEQ0TnpLSEU1UlNZaXFXVE1LQnJLbVdETzJKOCI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772016871),('VZnmn74aOFXIhKuFvEXaxlPNhLt9cAjyVT6tbvbf',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoidGVma2JHTHFaM3lvbzVtM2xQMlo4ZWlWczZ3S01uM01NcGJtcGlwVCI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1772146622),('WzETfd6C67RVG4pjTlKC1VhLPK88g66mpZDzGxHh',NULL,'127.0.0.1','curl/8.7.1','YToyOntzOjY6Il90b2tlbiI7czo0MDoiNGNBWUV4a3FtY2JqelowdmZsRmpTdTF6cFFYR05aMkRlSExNR0tTRiI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1771907403);
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
  `old_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NEW',
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned NOT NULL COMMENT 'Người chuyển trạng thái',
  PRIMARY KEY (`id`),
  KEY `fk_shist_request` (`request_id`),
  KEY `fk_shist_cb` (`created_by`),
  KEY `idx_support_hist_created_id` (`created_at`,`id`),
  KEY `idx_support_hist_request_created_id` (`request_id`,`created_at`,`id`),
  CONSTRAINT `fk_shist_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`),
  CONSTRAINT `fk_shist_request` FOREIGN KEY (`request_id`) REFERENCES `support_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 38: Nhật ký thay đổi trạng thái Task';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_request_history`
--

LOCK TABLES `support_request_history` WRITE;
/*!40000 ALTER TABLE `support_request_history` DISABLE KEYS */;
INSERT INTO `support_request_history` VALUES (32,2457469,NULL,'NEW','Tạo yêu cầu hỗ trợ','2026-02-26 18:40:50',1),(33,2457469,'NEW','IN_PROGRESS',NULL,'2026-02-26 18:40:50',1),(34,2457470,NULL,'NEW','Tạo yêu cầu hỗ trợ','2026-02-26 18:59:56',1),(35,2457470,'NEW','IN_PROGRESS','change status','2026-02-26 18:59:56',1),(36,2457471,NULL,'NEW','Tạo yêu cầu hỗ trợ','2026-02-26 20:14:12',1),(37,2457472,NULL,'IN_PROGRESS','Tạo yêu cầu hỗ trợ','2026-02-27 01:04:00',1),(38,2457473,NULL,'NEW','Tạo yêu cầu hỗ trợ','2026-02-27 02:33:40',1),(39,2457474,NULL,'NEW','Tạo yêu cầu hỗ trợ','2026-02-27 02:33:41',1);
/*!40000 ALTER TABLE `support_request_history` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_request_statuses`
--

LOCK TABLES `support_request_statuses` WRITE;
/*!40000 ALTER TABLE `support_request_statuses` DISABLE KEYS */;
INSERT INTO `support_request_statuses` VALUES (1,'NEW','Mới tiếp nhận','Yêu cầu vừa được ghi nhận',0,0,1,10,NULL,NULL,'2026-02-27 03:23:34','2026-02-27 03:23:34'),(2,'IN_PROGRESS','Đang xử lý','Yêu cầu đang được thực hiện',1,0,1,20,NULL,NULL,'2026-02-27 03:23:34','2026-02-27 03:23:34'),(3,'WAITING_CUSTOMER','Chờ phản hồi KH','Đang chờ khách hàng phản hồi',1,0,1,30,NULL,NULL,'2026-02-27 03:23:34','2026-02-27 03:23:34'),(4,'COMPLETED','Hoàn thành','Yêu cầu đã hoàn tất',1,1,1,40,NULL,NULL,'2026-02-27 03:23:34','2026-02-27 03:23:34'),(5,'PAUSED','Tạm dừng','Yêu cầu tạm dừng xử lý',1,0,1,50,NULL,NULL,'2026-02-27 03:23:34','2026-02-27 03:23:34'),(6,'TRANSFER_DEV','Chuyển dev','Yêu cầu chuyển cho đội phát triển',1,0,1,60,NULL,NULL,'2026-02-27 03:23:34','2026-02-27 03:23:34'),(7,'TRANSFER_DMS','Chuyển DMS','Yêu cầu chuyển sang đội DMS',1,0,1,70,NULL,NULL,'2026-02-27 03:23:34','2026-02-27 03:23:34'),(8,'UNABLE_TO_EXECUTE','Không thực hiện được','Không thể thực hiện yêu cầu',1,1,1,80,NULL,NULL,'2026-02-27 03:23:34','2026-02-27 03:23:34');
/*!40000 ALTER TABLE `support_request_statuses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_request_tasks`
--

DROP TABLE IF EXISTS `support_request_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_request_tasks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_id` bigint unsigned NOT NULL COMMENT 'Yêu cầu hỗ trợ cha',
  `title` varchar(255) DEFAULT NULL COMMENT 'Nội dung task con',
  `task_code` varchar(100) DEFAULT NULL COMMENT 'Mã task',
  `task_link` text COMMENT 'Liên kết task',
  `status` varchar(30) NOT NULL DEFAULT 'TODO' COMMENT 'TODO|IN_PROGRESS|DONE|BLOCKED|CANCELLED',
  `sort_order` int unsigned NOT NULL DEFAULT '0' COMMENT 'Thứ tự hiển thị task',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_support_tasks_request` (`request_id`),
  KEY `idx_support_tasks_status` (`status`),
  KEY `idx_support_tasks_request_sort` (`request_id`,`sort_order`),
  KEY `fk_support_tasks_created_by` (`created_by`),
  KEY `fk_support_tasks_updated_by` (`updated_by`),
  KEY `idx_support_tasks_task_code` (`task_code`),
  CONSTRAINT `fk_support_tasks_created_by` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_tasks_request` FOREIGN KEY (`request_id`) REFERENCES `support_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_support_tasks_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_request_tasks`
--

LOCK TABLES `support_request_tasks` WRITE;
/*!40000 ALTER TABLE `support_request_tasks` DISABLE KEYS */;
INSERT INTO `support_request_tasks` VALUES (1,2457473,'Smoke shared task #1','SMOKE-SHARED-1772184820','https://jira.local/SMOKE-SHARED-1772184820','TODO',0,1,1,'2026-02-27 02:33:40','2026-02-27 02:33:40'),(3,2457474,'Smoke shared task #2 updated','SMOKE-SHARED-1772184820','https://jira.local/SMOKE-SHARED-1772184820?rev=2','IN_PROGRESS',0,NULL,NULL,'2026-02-27 02:34:56','2026-02-27 02:34:56');
/*!40000 ALTER TABLE `support_request_tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_requests`
--

DROP TABLE IF EXISTS `support_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ticket_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã Jira (IT360-1234) hoặc Bitbucket PR',
  `summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nội dung yêu cầu / Tên Task',
  `service_group_id` bigint unsigned DEFAULT NULL COMMENT 'Nhóm xử lý (L2, L3, OS...)',
  `project_item_id` bigint unsigned DEFAULT NULL COMMENT 'Hạng mục dự án (project_items)',
  `customer_id` bigint unsigned NOT NULL COMMENT 'Đơn vị yêu cầu (Khách hàng)',
  `project_id` bigint unsigned DEFAULT NULL COMMENT 'Gắn với dự án (HIS, Văn bản 130...)',
  `product_id` bigint unsigned DEFAULT NULL COMMENT 'Gắn với sản phẩm (Phần mềm cụ thể)',
  `reporter_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Người báo yêu cầu',
  `reporter_contact_id` bigint unsigned DEFAULT NULL COMMENT 'Tham chiếu người báo yêu cầu từ customer_personnel',
  `assignee_id` bigint unsigned DEFAULT NULL COMMENT 'Người trực tiếp xử lý (Assignee)',
  `receiver_user_id` bigint unsigned DEFAULT NULL COMMENT 'Người tiếp nhận mặc định theo vai trò A trong RACI dự án',
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'NEW',
  `priority` enum('LOW','MEDIUM','HIGH','URGENT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'MEDIUM',
  `requested_date` date NOT NULL COMMENT 'Ngày nhận yêu cầu',
  `due_date` date DEFAULT NULL COMMENT 'Hạn hoàn thành',
  `resolved_date` date DEFAULT NULL COMMENT 'Ngày xong thực tế',
  `hotfix_date` date DEFAULT NULL,
  `noti_date` date DEFAULT NULL,
  `task_link` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Link Jira / Bitbucket',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
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
  KEY `idx_support_req_deleted_requested_id` (`deleted_at`,`requested_date`,`id`),
  KEY `idx_support_req_requested_id` (`requested_date`,`id`),
  KEY `idx_support_reporter_contact` (`reporter_contact_id`),
  KEY `idx_support_receiver_user` (`receiver_user_id`),
  KEY `idx_support_ticket_code` (`ticket_code`),
  CONSTRAINT `fk_sr_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sr_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_cust` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_support_group` FOREIGN KEY (`service_group_id`) REFERENCES `support_service_groups` (`id`),
  CONSTRAINT `fk_support_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_support_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fk_support_project_item` FOREIGN KEY (`project_item_id`) REFERENCES `project_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_receiver_user` FOREIGN KEY (`receiver_user_id`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_reporter_contact` FOREIGN KEY (`reporter_contact_id`) REFERENCES `customer_personnel` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_user` FOREIGN KEY (`assignee_id`) REFERENCES `internal_users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2457475 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 37: Quản lý Task hỗ trợ chi tiết';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_requests`
--

LOCK TABLES `support_requests` WRITE;
/*!40000 ALTER TABLE `support_requests` DISABLE KEYS */;
INSERT INTO `support_requests` VALUES (2451066,'SRQ-0001499090','Seed yêu cầu hỗ trợ #1499090',1,1,1,1,1,'Reporter 0090',NULL,1,NULL,'TRANSFER_DEV','MEDIUM','2025-04-20','2025-04-25',NULL,'2025-04-22',NULL,'https://jira.vnpt.local/browse/SRQ-0001499090','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451067,'SRQ-0001499089','Seed yêu cầu hỗ trợ #1499089',1,1,1,1,1,'Reporter 0089',NULL,1,NULL,'NEW','LOW','2025-04-19','2025-04-23',NULL,NULL,NULL,'https://jira.vnpt.local/browse/SRQ-0001499089','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451068,'SRQ-0001499088','Seed yêu cầu hỗ trợ #1499088',1,1,1,1,1,'Reporter 0088',NULL,1,NULL,'UNABLE_TO_EXECUTE','URGENT','2025-04-18','2025-04-21',NULL,NULL,NULL,'https://jira.vnpt.local/browse/SRQ-0001499088','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451069,'SRQ-0001499087','Seed yêu cầu hỗ trợ #1499087',1,1,1,1,1,'Reporter 0087',NULL,1,NULL,'WAITING_CUSTOMER','HIGH','2025-04-17','2025-04-19',NULL,NULL,NULL,'https://jira.vnpt.local/browse/SRQ-0001499087','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451070,'SRQ-0001499086','Seed yêu cầu hỗ trợ #1499086',1,1,1,1,1,'Reporter 0086',NULL,1,NULL,'COMPLETED','MEDIUM','2025-04-16','2025-04-17','2025-04-23',NULL,'2025-04-28','https://jira.vnpt.local/browse/SRQ-0001499086','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451071,'SRQ-0001499085','Seed yêu cầu hỗ trợ #1499085',1,1,1,1,1,'Reporter 0085',NULL,1,NULL,'COMPLETED','LOW','2025-04-15','2025-05-06','2025-04-21',NULL,'2025-04-26','https://jira.vnpt.local/browse/SRQ-0001499085','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451072,'SRQ-0001499084','Seed yêu cầu hỗ trợ #1499084',1,1,1,1,1,'Reporter 0084',NULL,1,NULL,'TRANSFER_DEV','URGENT','2025-04-14','2025-05-04',NULL,'2025-04-16',NULL,'https://jira.vnpt.local/browse/SRQ-0001499084','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451073,'SRQ-0001499083','Seed yêu cầu hỗ trợ #1499083',1,1,1,1,1,'Reporter 0083',NULL,1,NULL,'NEW','HIGH','2025-04-13','2025-05-02',NULL,NULL,NULL,'https://jira.vnpt.local/browse/SRQ-0001499083','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451074,'SRQ-0001499082','Seed yêu cầu hỗ trợ #1499082',1,1,1,1,1,'Reporter 0082',NULL,1,NULL,'UNABLE_TO_EXECUTE','MEDIUM','2025-04-12','2025-04-30',NULL,NULL,NULL,'https://jira.vnpt.local/browse/SRQ-0001499082','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451075,'SRQ-0001499081','Seed yêu cầu hỗ trợ #1499081',1,1,1,1,1,'Reporter 0081',NULL,1,NULL,'WAITING_CUSTOMER','LOW','2025-04-11','2025-04-28',NULL,NULL,NULL,'https://jira.vnpt.local/browse/SRQ-0001499081','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451076,'SRQ-0001499100','Seed yêu cầu hỗ trợ #1499100',1,1,1,1,1,'Reporter 0100',NULL,1,NULL,'UNABLE_TO_EXECUTE','URGENT','2025-04-30','2025-05-15',NULL,NULL,NULL,'https://jira.vnpt.local/browse/SRQ-0001499100','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451077,'SRQ-0001499099','Seed yêu cầu hỗ trợ #1499099',1,1,1,1,1,'Reporter 0099',NULL,1,NULL,'WAITING_CUSTOMER','HIGH','2025-04-29','2025-05-13',NULL,NULL,NULL,'https://jira.vnpt.local/browse/SRQ-0001499099','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451078,'SRQ-0001499098','Seed yêu cầu hỗ trợ #1499098',1,1,1,1,1,'Reporter 0098',NULL,1,NULL,'COMPLETED','MEDIUM','2025-04-28','2025-05-11','2025-05-07',NULL,'2025-05-10','https://jira.vnpt.local/browse/SRQ-0001499098','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451079,'SRQ-0001499097','Seed yêu cầu hỗ trợ #1499097',1,1,1,1,1,'Reporter 0097',NULL,1,NULL,'COMPLETED','LOW','2025-04-27','2025-05-09','2025-05-05',NULL,'2025-05-08','https://jira.vnpt.local/browse/SRQ-0001499097','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451080,'SRQ-0001499096','Seed yêu cầu hỗ trợ #1499096',1,1,1,1,1,'Reporter 0096',NULL,1,NULL,'TRANSFER_DEV','URGENT','2025-04-26','2025-05-07',NULL,'2025-04-28',NULL,'https://jira.vnpt.local/browse/SRQ-0001499096','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451081,'SRQ-0001499095','Seed yêu cầu hỗ trợ #1499095',1,1,1,1,1,'Reporter 0095',NULL,1,NULL,'NEW','HIGH','2025-04-25','2025-05-05',NULL,NULL,NULL,'https://jira.vnpt.local/browse/SRQ-0001499095','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451082,'SRQ-0001499094','Seed yêu cầu hỗ trợ #1499094',1,1,1,1,1,'Reporter 0094',NULL,1,NULL,'UNABLE_TO_EXECUTE','MEDIUM','2025-04-24','2025-05-03',NULL,NULL,NULL,'https://jira.vnpt.local/browse/SRQ-0001499094','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451083,'SRQ-0001499093','Seed yêu cầu hỗ trợ #1499093',1,1,1,1,1,'Reporter 0093',NULL,1,NULL,'WAITING_CUSTOMER','LOW','2025-04-23','2025-05-01',NULL,NULL,NULL,'https://jira.vnpt.local/browse/SRQ-0001499093','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451084,'SRQ-0001499092','Seed yêu cầu hỗ trợ #1499092',1,1,1,1,1,'Reporter 0092',NULL,1,NULL,'COMPLETED','URGENT','2025-04-22','2025-04-29','2025-04-25',NULL,'2025-04-28','https://jira.vnpt.local/browse/SRQ-0001499092','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2451085,'SRQ-0001499091','Seed yêu cầu hỗ trợ #1499091',1,1,1,1,1,'Reporter 0091',NULL,1,NULL,'COMPLETED','HIGH','2025-04-21','2025-04-27','2025-04-23',NULL,'2025-04-26','https://jira.vnpt.local/browse/SRQ-0001499091','Seed benchmark dataset 1.5M rows','2026-02-26 06:16:17',1,'2026-02-27 01:36:16',1,NULL),(2457469,NULL,'SMOKE TEST SUPPORT REQUEST',NULL,1,1,1,1,NULL,NULL,NULL,NULL,'IN_PROGRESS','MEDIUM','2026-02-27','2026-02-28','2026-02-28',NULL,NULL,NULL,NULL,'2026-02-26 18:40:50',1,'2026-02-26 18:40:50',1,'2026-02-26 18:40:50'),(2457470,NULL,'SMOKE HISTORY GUARD',NULL,1,1,1,1,NULL,NULL,NULL,NULL,'IN_PROGRESS','MEDIUM','2026-02-27','2026-02-28','2026-02-28',NULL,NULL,NULL,NULL,'2026-02-26 18:59:56',1,'2026-02-26 18:59:56',1,'2026-02-26 18:59:56'),(2457471,NULL,'Cần xử lý',4,98,50,96,2,'Đầu mối TYT phường Bình Thạnh',50,5,6,'NEW','MEDIUM','2026-02-27','2026-02-27',NULL,'2026-02-27','2026-02-27',NULL,NULL,'2026-02-26 20:14:12',1,'2026-02-27 00:58:50',NULL,NULL),(2457472,NULL,'Mô tả',NULL,96,16,98,2,NULL,NULL,6,NULL,'IN_PROGRESS','MEDIUM','2026-02-27','2026-02-28','2026-02-28',NULL,NULL,NULL,'Thực hiện test','2026-02-27 01:04:00',1,'2026-02-27 01:04:00',1,NULL),(2457473,'SMOKE-SHARED-1772184820','Smoke shared task #1',NULL,1,1,1,1,NULL,NULL,NULL,NULL,'NEW','MEDIUM','2026-02-27',NULL,NULL,NULL,NULL,'https://jira.local/SMOKE-SHARED-1772184820',NULL,'2026-02-27 02:33:40',1,'2026-02-27 02:33:40',1,NULL),(2457474,'SMOKE-SHARED-1772184820','Smoke shared task #2 (updated)',NULL,1,1,1,1,NULL,NULL,NULL,NULL,'NEW','MEDIUM','2026-02-27',NULL,NULL,NULL,NULL,'https://jira.local/SMOKE-SHARED-1772184820?rev=2',NULL,'2026-02-27 02:33:41',1,'2026-02-27 02:34:56',1,NULL);
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
  `group_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên nhóm: HIS L2, HIS L3, OS...',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Trạng thái hoạt động (1: Hiển thị, 0: Ẩn khỏi dropdown nhưng giữ lịch sử)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ssg_cb` (`created_by`),
  KEY `fk_ssg_ub` (`updated_by`),
  KEY `idx_support_groups_name` (`group_name`),
  CONSTRAINT `fk_ssg_cb` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ssg_ub` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng 36: Danh mục nhóm hỗ trợ chuyên trách';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_service_groups`
--

LOCK TABLES `support_service_groups` WRITE;
/*!40000 ALTER TABLE `support_service_groups` DISABLE KEYS */;
INSERT INTO `support_service_groups` VALUES (1,'HIS L2','Hỗ trợ hướng dẫn, cấu hình tham số, xử lý dữ liệu đơn giản',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(2,'HIS L3','Đội lập trình fix lỗi logic, hotfix core phần mềm HIS',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(3,'UPCODE VĂN BẢN','Cập nhật tính năng theo các Thông tư, Quyết định mới (VD: CV130)',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(4,'DỰ ÁN THUÊ OS','Đội ngũ Outsource thực hiện các module thuê ngoài',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(5,'HOÀN THIỆN PHẦN MỀM','Yêu cầu nâng cấp, tối ưu chức năng hiện có',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(6,'ĐỘI LIS/EMR','Hỗ trợ chuyên sâu cho hệ thống Xét nghiệm và Bệnh án điện tử',1,'2026-02-24 13:41:34',NULL,NULL,NULL),(13,'HIS L34','His bản 34',1,'2026-02-24 07:41:29',NULL,'2026-02-28 23:14:18',1),(14,'Trung tâm Y tế Vị Thuỷ','Mô tả',1,'2026-02-26 21:31:12',NULL,'2026-02-26 21:31:12',NULL),(15,'HIS 4.0','Bản his',1,'2026-02-27 02:29:47',NULL,'2026-02-27 02:29:47',NULL),(16,'SMOKE-GROUP-1772184820-A','bulk smoke A',1,'2026-02-27 02:33:41',NULL,'2026-02-27 02:33:41',NULL),(17,'SMOKE-GROUP-1772184820-B','bulk smoke B',1,'2026-02-27 02:33:41',NULL,'2026-02-27 02:33:41',NULL);
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
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-01 13:17:23
