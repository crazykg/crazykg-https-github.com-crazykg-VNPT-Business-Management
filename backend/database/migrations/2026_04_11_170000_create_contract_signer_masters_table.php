<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('contract_signer_masters')) {
            return;
        }

        $hasInternalUsersTable = Schema::hasTable('internal_users');

        Schema::create('contract_signer_masters', function (Blueprint $table) use ($hasInternalUsersTable): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('internal_user_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->unique('internal_user_id', 'uq_contract_signer_masters_internal_user');
            $table->index(['is_active', 'internal_user_id'], 'idx_contract_signer_masters_active_user');

            if ($hasInternalUsersTable) {
                $table->foreign('internal_user_id', 'fk_contract_signer_masters_internal_user')
                    ->references('id')
                    ->on('internal_users')
                    ->cascadeOnDelete();
                $table->foreign('created_by', 'fk_contract_signer_masters_created_by')
                    ->references('id')
                    ->on('internal_users')
                    ->nullOnDelete();
                $table->foreign('updated_by', 'fk_contract_signer_masters_updated_by')
                    ->references('id')
                    ->on('internal_users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_signer_masters');
    }
};
