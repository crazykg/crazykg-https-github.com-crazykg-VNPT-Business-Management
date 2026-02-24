<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('employees')) {
            return;
        }

        Schema::disableForeignKeyConstraints();
        Schema::drop('employees');
        Schema::enableForeignKeyConstraints();
    }

    public function down(): void
    {
        // Legacy table removal is intentional for v5; no rollback creation.
    }
};
