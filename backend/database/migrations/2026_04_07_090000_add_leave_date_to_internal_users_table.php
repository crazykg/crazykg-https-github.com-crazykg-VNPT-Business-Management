<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('internal_users') || Schema::hasColumn('internal_users', 'leave_date')) {
            return;
        }

        $hasDateOfBirth = Schema::hasColumn('internal_users', 'date_of_birth');

        Schema::table('internal_users', function (Blueprint $table) use ($hasDateOfBirth): void {
            $column = $table->date('leave_date')->nullable();
            if ($hasDateOfBirth) {
                $column->after('date_of_birth');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('internal_users') || ! Schema::hasColumn('internal_users', 'leave_date')) {
            return;
        }

        Schema::table('internal_users', function (Blueprint $table): void {
            $table->dropColumn('leave_date');
        });
    }
};
