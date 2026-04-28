<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('internal_users') || Schema::hasColumn('internal_users', 'gmail')) {
            return;
        }

        $hasEmail = Schema::hasColumn('internal_users', 'email');

        Schema::table('internal_users', function (Blueprint $table) use ($hasEmail): void {
            $column = $table->string('gmail', 255)->nullable();
            if ($hasEmail) {
                $column->after('email');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('internal_users') || ! Schema::hasColumn('internal_users', 'gmail')) {
            return;
        }

        Schema::table('internal_users', function (Blueprint $table): void {
            $table->dropColumn('gmail');
        });
    }
};
