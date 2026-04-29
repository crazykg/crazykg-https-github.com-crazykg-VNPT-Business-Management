SET NAMES utf8mb4;

START TRANSACTION;

CREATE TABLE IF NOT EXISTS `project_procedure_public_shares` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `procedure_id` bigint unsigned NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `expires_at` timestamp NOT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `last_accessed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_procedure_public_shares_token_hash_unique` (`token_hash`),
  KEY `idx_proc_share_active` (`procedure_id`, `revoked_at`, `expires_at`),
  KEY `idx_proc_share_expires` (`expires_at`),
  CONSTRAINT `project_procedure_public_shares_procedure_id_foreign`
    FOREIGN KEY (`procedure_id`) REFERENCES `project_procedures` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

COMMIT;
