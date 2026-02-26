<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('auth_login_attempts')) {
            return;
        }

        Schema::create('auth_login_attempts', function (Blueprint $table): void {
            $table->id();
            $table->string('username', 100);
            $table->unsignedBigInteger('internal_user_id')->nullable();
            $table->enum('status', ['SUCCESS', 'FAILED']);
            $table->string('reason', 255)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();

            $table->index(['username', 'created_at'], 'idx_auth_login_username_created');
            $table->index(['ip_address', 'created_at'], 'idx_auth_login_ip_created');
            $table->index(['internal_user_id', 'created_at'], 'idx_auth_login_user_created');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auth_login_attempts');
    }
};

