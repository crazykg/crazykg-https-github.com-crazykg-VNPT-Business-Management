<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Legacy migration disabled in v5.
        // Employee data has been consolidated into `internal_users`.
    }

    public function down(): void
    {
        // No-op: legacy migration is intentionally disabled.
    }
};
