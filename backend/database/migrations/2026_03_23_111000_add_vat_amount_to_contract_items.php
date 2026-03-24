<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contract_items') || Schema::hasColumn('contract_items', 'vat_amount')) {
            return;
        }

        Schema::table('contract_items', function (Blueprint $table): void {
            $table->decimal('vat_amount', 18, 2)->nullable()->after('vat_rate');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('contract_items') || ! Schema::hasColumn('contract_items', 'vat_amount')) {
            return;
        }

        Schema::table('contract_items', function (Blueprint $table): void {
            $table->dropColumn('vat_amount');
        });
    }
};
