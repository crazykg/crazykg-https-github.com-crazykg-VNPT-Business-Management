<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contracts') || Schema::hasColumn('contracts', 'signer_user_id')) {
            return;
        }

        Schema::table('contracts', function (Blueprint $table): void {
            $table->unsignedBigInteger('signer_user_id')->nullable();
            $table->index('signer_user_id', 'idx_contracts_signer_user_id');
            $table->foreign('signer_user_id', 'fk_contracts_signer_user')
                ->references('id')
                ->on('internal_users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('contracts') || ! Schema::hasColumn('contracts', 'signer_user_id')) {
            return;
        }

        Schema::table('contracts', function (Blueprint $table): void {
            $table->dropForeign('fk_contracts_signer_user');
            $table->dropIndex('idx_contracts_signer_user_id');
            $table->dropColumn('signer_user_id');
        });
    }
};
