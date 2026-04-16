SET NAMES utf8mb4;

/* 1) analysis_completed */
CREATE TABLE IF NOT EXISTS `customer_request_analysis_completed` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_case_id` bigint unsigned DEFAULT NULL,
  `status_instance_id` bigint unsigned DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `extended_at` datetime DEFAULT NULL,
  `progress_percent` int DEFAULT NULL,
  `from_user_id` bigint unsigned DEFAULT NULL,
  `to_user_id` bigint unsigned DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_crc_analysis_completed_case` (`request_case_id`),
  KEY `idx_crc_analysis_completed_instance` (`status_instance_id`),
  KEY `idx_crc_analysis_completed_from_user` (`from_user_id`),
  KEY `idx_crc_analysis_completed_to_user` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 2) analysis_suspended */
CREATE TABLE IF NOT EXISTS `customer_request_analysis_suspended` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_case_id` bigint unsigned DEFAULT NULL,
  `status_instance_id` bigint unsigned DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `extended_at` datetime DEFAULT NULL,
  `progress_percent` int DEFAULT NULL,
  `from_user_id` bigint unsigned DEFAULT NULL,
  `to_user_id` bigint unsigned DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_crc_analysis_suspended_case` (`request_case_id`),
  KEY `idx_crc_analysis_suspended_instance` (`status_instance_id`),
  KEY `idx_crc_analysis_suspended_from_user` (`from_user_id`),
  KEY `idx_crc_analysis_suspended_to_user` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 3) coding_in_progress */
CREATE TABLE IF NOT EXISTS `customer_request_coding_in_progress` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_case_id` bigint unsigned DEFAULT NULL,
  `status_instance_id` bigint unsigned DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `extended_at` datetime DEFAULT NULL,
  `progress_percent` int DEFAULT NULL,
  `from_user_id` bigint unsigned DEFAULT NULL,
  `to_user_id` bigint unsigned DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_crc_coding_in_progress_case` (`request_case_id`),
  KEY `idx_crc_coding_in_progress_instance` (`status_instance_id`),
  KEY `idx_crc_coding_in_progress_from_user` (`from_user_id`),
  KEY `idx_crc_coding_in_progress_to_user` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 4) coding_suspended */
CREATE TABLE IF NOT EXISTS `customer_request_coding_suspended` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_case_id` bigint unsigned DEFAULT NULL,
  `status_instance_id` bigint unsigned DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `extended_at` datetime DEFAULT NULL,
  `progress_percent` int DEFAULT NULL,
  `from_user_id` bigint unsigned DEFAULT NULL,
  `to_user_id` bigint unsigned DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_crc_coding_suspended_case` (`request_case_id`),
  KEY `idx_crc_coding_suspended_instance` (`status_instance_id`),
  KEY `idx_crc_coding_suspended_from_user` (`from_user_id`),
  KEY `idx_crc_coding_suspended_to_user` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 5) dms_in_progress */
CREATE TABLE IF NOT EXISTS `customer_request_dms_in_progress` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_case_id` bigint unsigned DEFAULT NULL,
  `status_instance_id` bigint unsigned DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `extended_at` datetime DEFAULT NULL,
  `progress_percent` int DEFAULT NULL,
  `from_user_id` bigint unsigned DEFAULT NULL,
  `to_user_id` bigint unsigned DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_crc_dms_in_progress_case` (`request_case_id`),
  KEY `idx_crc_dms_in_progress_instance` (`status_instance_id`),
  KEY `idx_crc_dms_in_progress_from_user` (`from_user_id`),
  KEY `idx_crc_dms_in_progress_to_user` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 6) dms_suspended */
CREATE TABLE IF NOT EXISTS `customer_request_dms_suspended` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_case_id` bigint unsigned DEFAULT NULL,
  `status_instance_id` bigint unsigned DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `extended_at` datetime DEFAULT NULL,
  `progress_percent` int DEFAULT NULL,
  `from_user_id` bigint unsigned DEFAULT NULL,
  `to_user_id` bigint unsigned DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_crc_dms_suspended_case` (`request_case_id`),
  KEY `idx_crc_dms_suspended_instance` (`status_instance_id`),
  KEY `idx_crc_dms_suspended_from_user` (`from_user_id`),
  KEY `idx_crc_dms_suspended_to_user` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 7) dms_task_created */
CREATE TABLE IF NOT EXISTS `customer_request_dms_task_created` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_case_id` bigint unsigned DEFAULT NULL,
  `status_instance_id` bigint unsigned DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `extended_at` datetime DEFAULT NULL,
  `progress_percent` int DEFAULT NULL,
  `from_user_id` bigint unsigned DEFAULT NULL,
  `to_user_id` bigint unsigned DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_crc_dms_task_created_case` (`request_case_id`),
  KEY `idx_crc_dms_task_created_instance` (`status_instance_id`),
  KEY `idx_crc_dms_task_created_from_user` (`from_user_id`),
  KEY `idx_crc_dms_task_created_to_user` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
