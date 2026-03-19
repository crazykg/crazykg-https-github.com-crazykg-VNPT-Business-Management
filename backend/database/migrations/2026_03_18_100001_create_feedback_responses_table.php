<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('feedback_responses')) {
            return;
        }

        Schema::create('feedback_responses', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('feedback_id')->comment('Góp ý cha');
            $table->text('content')->comment('Nội dung phản hồi');
            $table->boolean('is_admin_response')->default(false)->comment('Có phải phản hồi của admin');
            $table->unsignedBigInteger('created_by')->nullable()->comment('Người tạo phản hồi');
            $table->softDeletes();
            $table->timestamps();

            $table->index(['feedback_id', 'created_at'], 'idx_feedback_responses_feedback_created');
            $table->foreign('feedback_id', 'fk_feedback_responses_feedback')
                ->references('id')
                ->on('feedback_requests')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_responses');
    }
};
