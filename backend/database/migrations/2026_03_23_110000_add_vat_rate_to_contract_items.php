<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contract_items') || Schema::hasColumn('contract_items', 'vat_rate')) {
            return;
        }

        Schema::table('contract_items', function (Blueprint $table): void {
            $table->decimal('vat_rate', 5, 2)->nullable()->after('unit_price');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('contract_items') || ! Schema::hasColumn('contract_items', 'vat_rate')) {
            return;
        }

        Schema::table('contract_items', function (Blueprint $table): void {
            $table->dropColumn('vat_rate');
        });
    }
};
