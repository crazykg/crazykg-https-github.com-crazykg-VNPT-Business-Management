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

        DB::statement("UPDATE `projects` SET `status` = 'TRIAL' WHERE UPPER(`status`) = 'PLANNING'");
        DB::statement("UPDATE `projects` SET `status` = 'ONGOING' WHERE UPPER(`status`) = 'ACTIVE'");
        DB::statement("UPDATE `projects` SET `status` = 'CANCELLED' WHERE UPPER(`status`) IN ('SUSPENDED','TERMINATED','EXPIRED')");
        DB::statement("UPDATE `projects` SET `status` = 'TRIAL' WHERE `status` NOT IN ('TRIAL', 'ONGOING', 'WARRANTY', 'COMPLETED', 'CANCELLED')");

        DB::statement("ALTER TABLE `projects` MODIFY COLUMN `status` ENUM('TRIAL','ONGOING','WARRANTY','COMPLETED','CANCELLED') NOT NULL DEFAULT 'TRIAL'");
    }

    public function down(): void
    {
        if (! Schema::hasTable('projects') || ! Schema::hasColumn('projects', 'status')) {
            return;
        }

        DB::statement("UPDATE `projects` SET `status` = 'COMPLETED' WHERE UPPER(`status`) = 'WARRANTY'");
        DB::statement("UPDATE `projects` SET `status` = 'PLANNING' WHERE `status` NOT IN ('PLANNING', 'ONGOING', 'TRIAL', 'COMPLETED', 'CANCELLED')");

        DB::statement("ALTER TABLE `projects` MODIFY COLUMN `status` ENUM('PLANNING','ONGOING','TRIAL','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PLANNING'");
    }
};
