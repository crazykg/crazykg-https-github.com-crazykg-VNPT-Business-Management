<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Reconciled as a bookkeeping bridge. The release surface for
        // `project_items.product_package_id` is owned by the follow-up migration
        // `2026_04_13_225500_add_product_package_id_to_project_items_table`.
    }

    public function down(): void
    {
        // No-op on purpose.
    }
};
