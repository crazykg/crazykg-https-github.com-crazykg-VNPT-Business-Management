<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('projects')) {
            return;
        }

        Schema::table('projects', function (Blueprint $table): void {
            if (! Schema::hasColumn('projects', 'department_id')) {
                $table->unsignedBigInteger('department_id')->nullable()->after('customer_id');
            }
            if (! Schema::hasColumn('projects', 'start_date')) {
                $table->date('start_date')->nullable()->after('data_scope');
            }
            if (! Schema::hasColumn('projects', 'expected_end_date')) {
                $table->date('expected_end_date')->nullable()->after('start_date');
            }
            if (! Schema::hasColumn('projects', 'actual_end_date')) {
                $table->date('actual_end_date')->nullable()->after('expected_end_date');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('projects')) {
            return;
        }

        Schema::table('projects', function (Blueprint $table): void {
            $columns = [];
            foreach (['department_id', 'start_date', 'expected_end_date', 'actual_end_date'] as $col) {
                if (Schema::hasColumn('projects', $col)) {
                    $columns[] = $col;
                }
            }
            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
