<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('internal_users') || Schema::hasColumn('internal_users', 'telechatbot')) {
            return;
        }

        $hasMobile = Schema::hasColumn('internal_users', 'mobile');
        $hasPhone = Schema::hasColumn('internal_users', 'phone');

        Schema::table('internal_users', function (Blueprint $table) use ($hasMobile, $hasPhone): void {
            $column = $table->string('telechatbot', 255)->nullable();
            if ($hasMobile) {
                $column->after('mobile');

                return;
            }

            if ($hasPhone) {
                $column->after('phone');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('internal_users') || ! Schema::hasColumn('internal_users', 'telechatbot')) {
            return;
        }

        Schema::table('internal_users', function (Blueprint $table): void {
            $table->dropColumn('telechatbot');
        });
    }
};
