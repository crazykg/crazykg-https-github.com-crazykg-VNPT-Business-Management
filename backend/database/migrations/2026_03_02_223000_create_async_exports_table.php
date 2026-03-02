<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'async_exports';

    public function up(): void
    {
        if (Schema::hasTable(self::TABLE)) {
            return;
        }

        Schema::create(self::TABLE, function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('module', 80);
            $table->string('format', 20)->default('csv');
            $table->string('status', 30)->default('QUEUED');
            $table->longText('filters_json')->nullable();
            $table->string('file_path', 500)->nullable();
            $table->string('file_name', 255)->nullable();
            $table->unsignedBigInteger('requested_by');
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['requested_by', 'status', 'created_at'], 'idx_async_exports_requested_status_created');
            $table->index(['status', 'expires_at'], 'idx_async_exports_status_expires');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(self::TABLE);
    }
};
