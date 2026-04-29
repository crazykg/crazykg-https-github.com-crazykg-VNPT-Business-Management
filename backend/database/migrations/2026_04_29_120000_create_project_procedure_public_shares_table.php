<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_procedure_public_shares', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('procedure_id');
            $table->string('token_hash', 64)->unique();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamp('last_accessed_at')->nullable();
            $table->timestamps();

            $table->foreign('procedure_id')
                ->references('id')
                ->on('project_procedures')
                ->cascadeOnDelete();

            $table->index(['procedure_id', 'revoked_at', 'expires_at'], 'idx_proc_share_active');
            $table->index('expires_at', 'idx_proc_share_expires');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_procedure_public_shares');
    }
};
