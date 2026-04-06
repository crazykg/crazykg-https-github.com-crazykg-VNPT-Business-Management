<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('documents') || Schema::hasColumn('documents', 'commission_policy_text')) {
            return;
        }

        Schema::table('documents', function (Blueprint $table): void {
            $table->text('commission_policy_text')->nullable()->after('document_name');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('documents') || ! Schema::hasColumn('documents', 'commission_policy_text')) {
            return;
        }

        Schema::table('documents', function (Blueprint $table): void {
            $table->dropColumn('commission_policy_text');
        });
    }
};
