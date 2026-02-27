<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const NEW_STATUSES = "'NEW','IN_PROGRESS','WAITING_CUSTOMER','COMPLETED','PAUSED','TRANSFER_DEV','TRANSFER_DMS','UNABLE_TO_EXECUTE'";

    private const LEGACY_STATUSES = "'OPEN','HOTFIXING','RESOLVED','DEPLOYED','PENDING','CANCELLED'";

    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $this->migrateSupportRequestsToNewStatuses();
        $this->migrateSupportRequestHistoryToNewStatuses();
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $this->rollbackSupportRequestsToLegacyStatuses();
        $this->rollbackSupportRequestHistoryToLegacyStatuses();
    }

    private function migrateSupportRequestsToNewStatuses(): void
    {
        if (! Schema::hasTable('support_requests') || ! Schema::hasColumn('support_requests', 'status')) {
            return;
        }

        DB::statement(sprintf(
            "ALTER TABLE `support_requests` MODIFY COLUMN `status` ENUM(%s,%s) NULL DEFAULT 'NEW'",
            self::LEGACY_STATUSES,
            self::NEW_STATUSES
        ));

        DB::statement("UPDATE `support_requests` SET `status` = 'NEW' WHERE `status` = 'OPEN'");
        DB::statement("UPDATE `support_requests` SET `status` = 'TRANSFER_DEV' WHERE `status` = 'HOTFIXING'");
        DB::statement("UPDATE `support_requests` SET `status` = 'COMPLETED' WHERE `status` IN ('RESOLVED', 'DEPLOYED')");
        DB::statement("UPDATE `support_requests` SET `status` = 'WAITING_CUSTOMER' WHERE `status` = 'PENDING'");
        DB::statement("UPDATE `support_requests` SET `status` = 'UNABLE_TO_EXECUTE' WHERE `status` = 'CANCELLED'");

        DB::statement(sprintf(
            "ALTER TABLE `support_requests` MODIFY COLUMN `status` ENUM(%s) NULL DEFAULT 'NEW'",
            self::NEW_STATUSES
        ));
    }

    private function migrateSupportRequestHistoryToNewStatuses(): void
    {
        if (! Schema::hasTable('support_request_history')) {
            return;
        }

        $this->cleanupSupportRequestHistoryOrphans();

        if (Schema::hasColumn('support_request_history', 'old_status')) {
            DB::statement(sprintf(
                "ALTER TABLE `support_request_history` MODIFY COLUMN `old_status` ENUM(%s,%s) NULL",
                self::LEGACY_STATUSES,
                self::NEW_STATUSES
            ));

            DB::statement("UPDATE `support_request_history` SET `old_status` = 'NEW' WHERE `old_status` = 'OPEN'");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'TRANSFER_DEV' WHERE `old_status` = 'HOTFIXING'");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'COMPLETED' WHERE `old_status` IN ('RESOLVED', 'DEPLOYED')");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'WAITING_CUSTOMER' WHERE `old_status` = 'PENDING'");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'UNABLE_TO_EXECUTE' WHERE `old_status` = 'CANCELLED'");

            DB::statement(sprintf(
                "ALTER TABLE `support_request_history` MODIFY COLUMN `old_status` ENUM(%s) NULL",
                self::NEW_STATUSES
            ));
        }

        if (Schema::hasColumn('support_request_history', 'new_status')) {
            DB::statement(sprintf(
                "ALTER TABLE `support_request_history` MODIFY COLUMN `new_status` ENUM(%s,%s) NOT NULL DEFAULT 'NEW'",
                self::LEGACY_STATUSES,
                self::NEW_STATUSES
            ));

            DB::statement("UPDATE `support_request_history` SET `new_status` = 'NEW' WHERE `new_status` = 'OPEN'");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'TRANSFER_DEV' WHERE `new_status` = 'HOTFIXING'");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'COMPLETED' WHERE `new_status` IN ('RESOLVED', 'DEPLOYED')");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'WAITING_CUSTOMER' WHERE `new_status` = 'PENDING'");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'UNABLE_TO_EXECUTE' WHERE `new_status` = 'CANCELLED'");

            DB::statement(sprintf(
                "ALTER TABLE `support_request_history` MODIFY COLUMN `new_status` ENUM(%s) NOT NULL DEFAULT 'NEW'",
                self::NEW_STATUSES
            ));
        }
    }

    private function rollbackSupportRequestsToLegacyStatuses(): void
    {
        if (! Schema::hasTable('support_requests') || ! Schema::hasColumn('support_requests', 'status')) {
            return;
        }

        DB::statement(sprintf(
            "ALTER TABLE `support_requests` MODIFY COLUMN `status` ENUM(%s,%s) NULL DEFAULT 'OPEN'",
            self::LEGACY_STATUSES,
            self::NEW_STATUSES
        ));

        DB::statement("UPDATE `support_requests` SET `status` = 'OPEN' WHERE `status` = 'NEW'");
        DB::statement("UPDATE `support_requests` SET `status` = 'HOTFIXING' WHERE `status` IN ('IN_PROGRESS', 'TRANSFER_DEV')");
        DB::statement("UPDATE `support_requests` SET `status` = 'PENDING' WHERE `status` IN ('WAITING_CUSTOMER', 'PAUSED')");
        DB::statement("UPDATE `support_requests` SET `status` = 'RESOLVED' WHERE `status` = 'COMPLETED'");
        DB::statement("UPDATE `support_requests` SET `status` = 'DEPLOYED' WHERE `status` = 'TRANSFER_DMS'");
        DB::statement("UPDATE `support_requests` SET `status` = 'CANCELLED' WHERE `status` = 'UNABLE_TO_EXECUTE'");

        DB::statement(sprintf(
            "ALTER TABLE `support_requests` MODIFY COLUMN `status` ENUM(%s) NULL DEFAULT 'OPEN'",
            self::LEGACY_STATUSES
        ));
    }

    private function rollbackSupportRequestHistoryToLegacyStatuses(): void
    {
        if (! Schema::hasTable('support_request_history')) {
            return;
        }

        if (Schema::hasColumn('support_request_history', 'old_status')) {
            DB::statement(sprintf(
                "ALTER TABLE `support_request_history` MODIFY COLUMN `old_status` ENUM(%s,%s) NULL",
                self::LEGACY_STATUSES,
                self::NEW_STATUSES
            ));

            DB::statement("UPDATE `support_request_history` SET `old_status` = 'OPEN' WHERE `old_status` = 'NEW'");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'HOTFIXING' WHERE `old_status` IN ('IN_PROGRESS', 'TRANSFER_DEV')");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'PENDING' WHERE `old_status` IN ('WAITING_CUSTOMER', 'PAUSED')");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'RESOLVED' WHERE `old_status` = 'COMPLETED'");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'DEPLOYED' WHERE `old_status` = 'TRANSFER_DMS'");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'CANCELLED' WHERE `old_status` = 'UNABLE_TO_EXECUTE'");

            DB::statement(sprintf(
                "ALTER TABLE `support_request_history` MODIFY COLUMN `old_status` ENUM(%s) NULL",
                self::LEGACY_STATUSES
            ));
        }

        if (Schema::hasColumn('support_request_history', 'new_status')) {
            DB::statement(sprintf(
                "ALTER TABLE `support_request_history` MODIFY COLUMN `new_status` ENUM(%s,%s) NOT NULL DEFAULT 'OPEN'",
                self::LEGACY_STATUSES,
                self::NEW_STATUSES
            ));

            DB::statement("UPDATE `support_request_history` SET `new_status` = 'OPEN' WHERE `new_status` = 'NEW'");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'HOTFIXING' WHERE `new_status` IN ('IN_PROGRESS', 'TRANSFER_DEV')");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'PENDING' WHERE `new_status` IN ('WAITING_CUSTOMER', 'PAUSED')");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'RESOLVED' WHERE `new_status` = 'COMPLETED'");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'DEPLOYED' WHERE `new_status` = 'TRANSFER_DMS'");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'CANCELLED' WHERE `new_status` = 'UNABLE_TO_EXECUTE'");

            DB::statement(sprintf(
                "ALTER TABLE `support_request_history` MODIFY COLUMN `new_status` ENUM(%s) NOT NULL DEFAULT 'OPEN'",
                self::LEGACY_STATUSES
            ));
        }
    }

    private function cleanupSupportRequestHistoryOrphans(): void
    {
        if (! Schema::hasTable('support_requests') || ! Schema::hasColumn('support_request_history', 'request_id')) {
            return;
        }

        DB::statement('
            DELETE h
            FROM `support_request_history` h
            LEFT JOIN `support_requests` sr ON sr.id = h.request_id
            WHERE sr.id IS NULL
        ');
    }
};
