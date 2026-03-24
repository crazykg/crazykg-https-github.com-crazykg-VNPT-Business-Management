<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('projects') || Schema::hasColumn('projects', 'status_reason')) {
            return;
        }

        Schema::table('projects', function (Blueprint $table): void {
            $table->text('status_reason')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('projects') || ! Schema::hasColumn('projects', 'status_reason')) {
            return;
        }

        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn('status_reason');
        });
    }
};
