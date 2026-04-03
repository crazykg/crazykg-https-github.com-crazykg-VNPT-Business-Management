<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('internal_users')) {
            return;
        }

        Schema::table('internal_users', function (Blueprint $table): void {
            if (! Schema::hasColumn('internal_users', 'avatar_data_url')) {
                $table->longText('avatar_data_url')->nullable()->after('email');
            }

            if (! Schema::hasColumn('internal_users', 'avatar_updated_at')) {
                $table->timestamp('avatar_updated_at')->nullable()->after('avatar_data_url');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('internal_users')) {
            return;
        }

        Schema::table('internal_users', function (Blueprint $table): void {
            if (Schema::hasColumn('internal_users', 'avatar_updated_at')) {
                $table->dropColumn('avatar_updated_at');
            }

            if (Schema::hasColumn('internal_users', 'avatar_data_url')) {
                $table->dropColumn('avatar_data_url');
            }
        });
    }
};
