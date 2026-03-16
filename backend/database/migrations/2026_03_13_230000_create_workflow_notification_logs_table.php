<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'workflow_notification_logs';

    public function up(): void
    {
        if (Schema::hasTable(self::TABLE)) {
            return;
        }

        Schema::create(self::TABLE, function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('customer_request_id')->nullable();
            $table->unsignedBigInteger('request_transition_id')->nullable();
            $table->string('request_code', 80)->nullable();
            $table->string('action_code', 80)->nullable();
            $table->string('target_role', 50);
            $table->unsignedBigInteger('recipient_user_id')->nullable();
            $table->string('channel', 30)->default('IN_APP');
            $table->string('delivery_status', 30)->default('RESOLVED');
            $table->json('payload_json')->nullable();
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->index(['customer_request_id', 'created_at'], 'idx_workflow_notification_request');
            $table->index(['request_transition_id'], 'idx_workflow_notification_transition');
            $table->index(['recipient_user_id', 'created_at'], 'idx_workflow_notification_recipient');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(self::TABLE);
    }
};
