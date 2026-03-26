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
            if (! Schema::hasColumn('projects', 'payment_cycle')) {
                $table->string('payment_cycle', 20)->nullable()->after('status_reason');
            }
            if (! Schema::hasColumn('projects', 'estimated_value')) {
                $table->decimal('estimated_value', 18, 2)->nullable()->after('payment_cycle');
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
            if (Schema::hasColumn('projects', 'payment_cycle')) {
                $columns[] = 'payment_cycle';
            }
            if (Schema::hasColumn('projects', 'estimated_value')) {
                $columns[] = 'estimated_value';
            }
            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
