<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('projects') || ! Schema::hasColumn('projects', 'status')) {
            return;
        }

        DB::statement("UPDATE `projects` SET `status` = 'CANCELLED' WHERE UPPER(`status`) = 'SUSPENDED'");
        DB::statement("UPDATE `projects` SET `status` = 'PLANNING' WHERE `status` NOT IN ('PLANNING', 'ONGOING', 'TRIAL', 'COMPLETED', 'CANCELLED')");
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE `projects` MODIFY COLUMN `status` ENUM('PLANNING','ONGOING','TRIAL','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PLANNING'");
    }

    public function down(): void
    {
        if (! Schema::hasTable('projects') || ! Schema::hasColumn('projects', 'status')) {
            return;
        }

        DB::statement("UPDATE `projects` SET `status` = 'PLANNING' WHERE `status` = 'TRIAL'");
        DB::statement("UPDATE `projects` SET `status` = 'PLANNING' WHERE `status` NOT IN ('PLANNING', 'ONGOING', 'COMPLETED', 'CANCELLED')");
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE `projects` MODIFY COLUMN `status` ENUM('PLANNING','ONGOING','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PLANNING'");
    }
};
