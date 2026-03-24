SET NAMES utf8mb4;

-- VAT support on contract_items.
ALTER TABLE `contract_items`
    ADD COLUMN `vat_rate` DECIMAL(5,2) NULL AFTER `unit_price`,
    ADD COLUMN `vat_amount` DECIMAL(18,2) NULL AFTER `vat_rate`;

-- Contract renewal/addendum metadata.
ALTER TABLE `contracts`
    ADD COLUMN `parent_contract_id` BIGINT UNSIGNED NULL COMMENT 'FK → contracts.id — HĐ gốc của phụ lục này' AFTER `payment_cycle`,
    ADD COLUMN `addendum_type` VARCHAR(32) NULL COMMENT 'EXTENSION | AMENDMENT | LIQUIDATION' AFTER `parent_contract_id`,
    ADD COLUMN `gap_days` INT NULL COMMENT 'gap≤0=EARLY, gap=1=CONTINUOUS, gap>1=GAP. diffInDays(expiry, effective). NULL khi thiếu dates' AFTER `addendum_type`,
    ADD COLUMN `continuity_status` VARCHAR(32) NULL DEFAULT 'STANDALONE' COMMENT 'STANDALONE | EARLY(gap≤0) | CONTINUOUS(gap=1) | GAP(gap>1)' AFTER `gap_days`,
    ADD COLUMN `penalty_rate` DECIMAL(5,4) NULL COMMENT 'Tỷ lệ giảm thanh toán (0.0500 = 5%). NULL = không phạt' AFTER `continuity_status`,
    ADD INDEX `idx_contracts_parent` (`parent_contract_id`),
    ADD CONSTRAINT `fk_contracts_parent` FOREIGN KEY (`parent_contract_id`) REFERENCES `contracts` (`id`) ON DELETE RESTRICT;

-- Payment schedule penalty tracking and invoice linkage.
ALTER TABLE `payment_schedules`
    ADD COLUMN `original_amount` DECIMAL(18,2) NULL COMMENT 'Giá trị gốc trước penalty' AFTER `expected_amount`,
    ADD COLUMN `penalty_rate` DECIMAL(5,4) NULL COMMENT 'Copy từ contract.penalty_rate tại thời điểm generate' AFTER `original_amount`,
    ADD COLUMN `penalty_amount` DECIMAL(18,2) NULL COMMENT 'Số tiền bị trừ: original_amount * penalty_rate' AFTER `penalty_rate`,
    ADD COLUMN `invoice_id` BIGINT UNSIGNED NULL COMMENT 'Liên kết 1:1 với hóa đơn đã phát hành' AFTER `contract_id`,
    ADD INDEX `idx_ps_invoice` (`invoice_id`);

-- Fee collection schema.
CREATE TABLE `invoices` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `invoice_code` VARCHAR(50) NOT NULL COMMENT 'Mã hóa đơn: INV-YYYYMM-NNNN',
    `invoice_series` VARCHAR(20) DEFAULT NULL COMMENT 'Ký hiệu hóa đơn (series)',
    `contract_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `project_id` BIGINT UNSIGNED DEFAULT NULL,
    `invoice_date` DATE NOT NULL COMMENT 'Ngày xuất hóa đơn',
    `due_date` DATE NOT NULL COMMENT 'Hạn thanh toán',
    `period_from` DATE DEFAULT NULL COMMENT 'Kỳ cước từ ngày',
    `period_to` DATE DEFAULT NULL COMMENT 'Kỳ cước đến ngày',
    `subtotal` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Tổng trước thuế',
    `vat_rate` DECIMAL(5,2) DEFAULT '10.00' COMMENT 'Thuế suất %',
    `vat_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Tiền thuế',
    `total_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Tổng sau thuế',
    `paid_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Đã thu (cập nhật từ receipts)',
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT | ISSUED | PARTIAL | PAID | CANCELLED | VOID',
    `notes` TEXT NULL,
    `data_scope` VARCHAR(50) DEFAULT NULL,
    `created_by` BIGINT UNSIGNED DEFAULT NULL,
    `updated_by` BIGINT UNSIGNED DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_inv_code` (`invoice_code`),
    KEY `idx_inv_contract` (`contract_id`),
    KEY `idx_inv_customer` (`customer_id`),
    KEY `idx_inv_status` (`status`),
    KEY `idx_inv_due_date` (`due_date`),
    KEY `idx_inv_date_status` (`invoice_date`, `status`),
    KEY `idx_inv_amounts` (`paid_amount`, `total_amount`),
    CONSTRAINT `invoices_contract_id_foreign` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`id`),
    CONSTRAINT `invoices_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `invoice_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `invoice_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED DEFAULT NULL,
    `description` VARCHAR(500) NOT NULL COMMENT 'Mô tả dịch vụ/sản phẩm',
    `unit` VARCHAR(50) DEFAULT NULL COMMENT 'Đơn vị tính',
    `quantity` DECIMAL(12,2) NOT NULL DEFAULT '1.00',
    `unit_price` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `vat_rate` DECIMAL(5,2) DEFAULT '10.00',
    `payment_schedule_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Map 1:1 với payment_schedule nếu có',
    `sort_order` INT NOT NULL DEFAULT '0',
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_ii_invoice` (`invoice_id`),
    CONSTRAINT `invoice_items_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `receipts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `receipt_code` VARCHAR(50) NOT NULL COMMENT 'Mã phiếu thu: RCP-YYYYMM-NNNN',
    `invoice_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'NULL nếu thu trước khi có hóa đơn',
    `contract_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `receipt_date` DATE NOT NULL COMMENT 'Ngày thu',
    `amount` DECIMAL(15,2) NOT NULL COMMENT 'Số tiền thu',
    `payment_method` VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER' COMMENT 'CASH | BANK_TRANSFER | ONLINE | OFFSET | OTHER',
    `bank_name` VARCHAR(200) DEFAULT NULL,
    `bank_account` VARCHAR(50) DEFAULT NULL,
    `transaction_ref` VARCHAR(100) DEFAULT NULL COMMENT 'Mã giao dịch ngân hàng',
    `status` VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED' COMMENT 'CONFIRMED | PENDING_CONFIRM | REJECTED',
    `is_reversed` TINYINT(1) NOT NULL DEFAULT '0' COMMENT 'true if this receipt has a reversal offset entry',
    `is_reversal_offset` TINYINT(1) NOT NULL DEFAULT '0' COMMENT 'true if this is a negative offset entry (amount < 0)',
    `original_receipt_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'FK to original receipt being reversed',
    `notes` TEXT NULL,
    `confirmed_by` BIGINT UNSIGNED DEFAULT NULL,
    `confirmed_at` TIMESTAMP NULL DEFAULT NULL,
    `data_scope` VARCHAR(50) DEFAULT NULL,
    `created_by` BIGINT UNSIGNED DEFAULT NULL,
    `updated_by` BIGINT UNSIGNED DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_rcp_code` (`receipt_code`),
    KEY `idx_rcp_invoice` (`invoice_id`),
    KEY `idx_rcp_contract` (`contract_id`),
    KEY `idx_rcp_customer` (`customer_id`),
    KEY `idx_rcp_date` (`receipt_date`),
    KEY `idx_rcp_status` (`status`),
    KEY `idx_rcp_trend` (`receipt_date`, `invoice_id`, `status`),
    CONSTRAINT `receipts_contract_id_foreign` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`id`),
    CONSTRAINT `receipts_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
    CONSTRAINT `receipts_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `dunning_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `invoice_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `dunning_level` TINYINT NOT NULL DEFAULT '1' COMMENT '1=nhắc lần 1, 2=nhắc lần 2, 3=cảnh báo',
    `sent_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `sent_via` VARCHAR(30) NOT NULL DEFAULT 'SYSTEM' COMMENT 'SYSTEM | EMAIL | MANUAL',
    `message` TEXT NULL COMMENT 'Nội dung nhắc',
    `response_note` TEXT NULL COMMENT 'Ghi chú phản hồi từ KH',
    `created_by` BIGINT UNSIGNED DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_dl_invoice` (`invoice_id`),
    KEY `idx_dl_customer` (`customer_id`),
    KEY `idx_dl_level` (`dunning_level`),
    CONSTRAINT `dunning_logs_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
    CONSTRAINT `dunning_logs_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
