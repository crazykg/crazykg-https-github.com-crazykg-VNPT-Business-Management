SET NAMES utf8mb4;

START TRANSACTION;

ALTER TABLE `invoices`
  ADD INDEX `idx_inv_overdue_cover` (`status`, `deleted_at`, `due_date`, `total_amount`, `paid_amount`),
  ADD INDEX `idx_inv_cust_status` (`customer_id`, `status`, `deleted_at`),
  DROP INDEX `idx_inv_code`,
  ADD UNIQUE KEY `uq_inv_code` (`invoice_code`);

ALTER TABLE `receipts`
  ADD INDEX `idx_rcp_reconcile` (`invoice_id`, `status`, `deleted_at`, `amount`),
  DROP INDEX `idx_rcp_code`,
  ADD UNIQUE KEY `uq_rcp_code` (`receipt_code`);

COMMIT;
