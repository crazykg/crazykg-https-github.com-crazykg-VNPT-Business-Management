<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('employees')) {
            return;
        }

        $hasJobTitleRaw = Schema::hasColumn('employees', 'job_title_raw');
        $hasDateOfBirth = Schema::hasColumn('employees', 'date_of_birth');
        $hasGender = Schema::hasColumn('employees', 'gender');
        $hasVpnStatus = Schema::hasColumn('employees', 'vpn_status');
        $hasIpAddress = Schema::hasColumn('employees', 'ip_address');

        if ($hasJobTitleRaw && $hasDateOfBirth && $hasGender && $hasVpnStatus && $hasIpAddress) {
            return;
        }

        Schema::table('employees', function (Blueprint $table) use (
            $hasJobTitleRaw,
            $hasDateOfBirth,
            $hasGender,
            $hasVpnStatus,
            $hasIpAddress
        ): void {
            if (! $hasJobTitleRaw) {
                $table->string('job_title_raw')->nullable();
            }
            if (! $hasDateOfBirth) {
                $table->date('date_of_birth')->nullable();
            }
            if (! $hasGender) {
                $table->string('gender', 10)->nullable();
            }
            if (! $hasVpnStatus) {
                $table->string('vpn_status', 3)->nullable()->default('NO');
            }
            if (! $hasIpAddress) {
                $table->string('ip_address', 45)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('employees')) {
            return;
        }

        $dropColumns = [];
        foreach (['job_title_raw', 'date_of_birth', 'gender', 'vpn_status', 'ip_address'] as $column) {
            if (Schema::hasColumn('employees', $column)) {
                $dropColumns[] = $column;
            }
        }

        if ($dropColumns === []) {
            return;
        }

        Schema::table('employees', function (Blueprint $table) use ($dropColumns): void {
            $table->dropColumn($dropColumns);
        });
    }
};
