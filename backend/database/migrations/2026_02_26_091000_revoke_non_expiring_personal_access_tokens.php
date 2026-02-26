<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('personal_access_tokens') || ! Schema::hasColumn('personal_access_tokens', 'expires_at')) {
            return;
        }

        DB::table('personal_access_tokens')
            ->whereNull('expires_at')
            ->update([
                'expires_at' => now(),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // One-way revocation.
    }
};

