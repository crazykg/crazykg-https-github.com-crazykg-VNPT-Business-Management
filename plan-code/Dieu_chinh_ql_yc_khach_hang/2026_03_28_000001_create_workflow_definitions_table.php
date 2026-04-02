<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This migration creates the multi-workflow support system:
     * 1. Creates workflow_definitions table
     * 2. Adds workflow_definition_id to workflow_transitions
     * 3. Adds workflow_definition_id to customer_request_cases (optional)
     */
    public function up(): void
    {
        // =========================================================================
        // STEP 1: Create workflow_definitions table
        // =========================================================================
        Schema::create('workflow_definitions', function (Blueprint $table) {
            $table->id();
            
            // -------------------------------------------------------------------------
            // Identification
            // -------------------------------------------------------------------------
            $table->string('code', 50)->comment('Mã workflow: LUONG_A, LUONG_B, DEV_FLOW');
            $table->string('name', 255)->comment('Tên hiển thị: Luồng xử lý A');
            $table->text('description')->nullable()->comment('Mô tả chi tiết');
            
            // -------------------------------------------------------------------------
            // Classification
            // -------------------------------------------------------------------------
            $table->string('process_type', 50)->default('customer_request')->comment('Loại quy trình: customer_request, project_procedure, document_approval');
            $table->string('workflow_group', 100)->default('default')->comment('Nhóm workflow');
            
            // -------------------------------------------------------------------------
            // Status & Versioning
            // -------------------------------------------------------------------------
            $table->boolean('is_active')->default(false)->comment('Đang được sử dụng (chỉ 1 active per process_type)');
            $table->boolean('is_default')->default(false)->comment('Là workflow mặc định');
            $table->string('version', 20)->default('1.0')->comment('Phiên bản: 1.0, 1.1, 2.0');
            
            // -------------------------------------------------------------------------
            // Configuration (JSON columns)
            // -------------------------------------------------------------------------
            $table->json('config')->nullable()->comment('Cấu hình bổ sung: notification rules, SLA config');
            $table->json('metadata')->nullable()->comment('Metadata: created_from, import_source');
            
            // -------------------------------------------------------------------------
            // Audit Trail
            // -------------------------------------------------------------------------
            $table->unsignedBigInteger('created_by')->nullable()->comment('Người tạo (FK → internal_users)');
            $table->unsignedBigInteger('updated_by')->nullable()->comment('Người cập nhật');
            $table->unsignedBigInteger('activated_by')->nullable()->comment('Người kích hoạt');
            $table->unsignedBigInteger('deactivated_by')->nullable()->comment('Người vô hiệu hóa');
            $table->timestamp('activated_at')->nullable()->comment('Thời điểm kích hoạt');
            $table->timestamp('deactivated_at')->nullable()->comment('Thời điểm vô hiệu hóa');
            $table->timestamps();
            $table->timestamp('deleted_at')->nullable()->comment('Soft delete');
            
            // -------------------------------------------------------------------------
            // Indexes
            // -------------------------------------------------------------------------
            // Unique constraint: code must be unique per process_type (excluding deleted)
            $table->unique(['code', 'process_type', 'deleted_at'], 'unique_code_process');
            
            // Fast lookup for active workflow by process_type
            $table->index(['process_type', 'is_active', 'deleted_at'], 'idx_process_active');
            
            // Group filtering
            $table->index(['workflow_group', 'is_active'], 'idx_workflow_group');
            
            // Version tracking
            $table->index('version', 'idx_version');
            
            // -------------------------------------------------------------------------
            // Foreign Keys
            // -------------------------------------------------------------------------
            $table->foreign('created_by')->references('id')->on('internal_users')->onDelete('set null');
            $table->foreign('updated_by')->references('id')->on('internal_users')->onDelete('set null');
            $table->foreign('activated_by')->references('id')->on('internal_users')->onDelete('set null');
            $table->foreign('deactivated_by')->references('id')->on('internal_users')->onDelete('set null');
        });

        // =========================================================================
        // STEP 2: Add workflow_definition_id to workflow_transitions
        // =========================================================================
        Schema::table('workflow_transitions', function (Blueprint $table) {
            // Add column
            $table->unsignedBigInteger('workflow_definition_id')
                ->nullable()
                ->after('workflow_group')
                ->comment('FK → workflow_definitions.id');
            
            // Add index for performance
            $table->index(['workflow_definition_id', 'is_active'], 'idx_workflow_definition');
            
            // Add foreign key constraint (cascade delete)
            $table->foreign('workflow_definition_id')
                ->references('id')
                ->on('workflow_definitions')
                ->onDelete('cascade');
        });

        // =========================================================================
        // STEP 3: Add workflow_definition_id to customer_request_cases (OPTIONAL)
        // =========================================================================
        // This allows tracking which workflow was used for each request
        // Useful for reporting and migration
        Schema::table('customer_request_cases', function (Blueprint $table) {
            // Add column
            $table->unsignedBigInteger('workflow_definition_id')
                ->nullable()
                ->after('current_status_code')
                ->comment('FK → workflow_definitions.id (workflow tại thời điểm tạo)');
            
            // Add index for performance
            $table->index('workflow_definition_id', 'idx_case_workflow');
            
            // Add foreign key constraint (set null on delete)
            $table->foreign('workflow_definition_id')
                ->references('id')
                ->on('workflow_definitions')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     * 
     * This will:
     * 1. Remove foreign keys
     * 2. Drop columns
     * 3. Drop workflow_definitions table
     */
    public function down(): void
    {
        // -------------------------------------------------------------------------
        // Step 1: Remove foreign key and column from customer_request_cases
        // -------------------------------------------------------------------------
        Schema::table('customer_request_cases', function (Blueprint $table) {
            $table->dropForeign(['workflow_definition_id']);
            $table->dropIndex('idx_case_workflow');
            $table->dropColumn('workflow_definition_id');
        });

        // -------------------------------------------------------------------------
        // Step 2: Remove foreign key and column from workflow_transitions
        // -------------------------------------------------------------------------
        Schema::table('workflow_transitions', function (Blueprint $table) {
            $table->dropForeign(['workflow_definition_id']);
            $table->dropIndex('idx_workflow_definition');
            $table->dropColumn('workflow_definition_id');
        });

        // -------------------------------------------------------------------------
        // Step 3: Drop workflow_definitions table
        // -------------------------------------------------------------------------
        Schema::dropIfExists('workflow_definitions');
    }
};
