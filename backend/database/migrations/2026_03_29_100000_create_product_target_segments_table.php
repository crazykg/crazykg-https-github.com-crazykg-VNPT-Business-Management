<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('products') || Schema::hasTable('product_target_segments')) {
            return;
        }

        Schema::create('product_target_segments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('customer_sector', 50);
            $table->string('facility_type', 50)->nullable();
            $table->unsignedInteger('bed_capacity_min')->nullable();
            $table->unsignedInteger('bed_capacity_max')->nullable();
            $table->unsignedTinyInteger('priority')->default(1);
            $table->text('sales_notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['customer_sector', 'facility_type', 'is_active', 'deleted_at'], 'idx_pts_sector_lookup');
            $table->index(['product_id', 'is_active', 'deleted_at'], 'idx_pts_product_lookup');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('product_target_segments')) {
            Schema::drop('product_target_segments');
        }
    }
};
