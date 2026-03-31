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
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['customer_sector', 'facility_type', 'is_active', 'deleted_at'], 'idx_pts_sector_lookup');
            $table->index(['product_id', 'is_active', 'deleted_at'], 'idx_pts_product_lookup');
        });

        $this->addActorForeignIfPossible('created_by');
        $this->addActorForeignIfPossible('updated_by');
    }

    public function down(): void
    {
        if (Schema::hasTable('product_target_segments')) {
            Schema::drop('product_target_segments');
        }
    }

    private function addActorForeignIfPossible(string $column): void
    {
        if (! Schema::hasTable('product_target_segments') || ! Schema::hasColumn('product_target_segments', $column)) {
            return;
        }

        $targetTable = Schema::hasTable('internal_users')
            ? 'internal_users'
            : (Schema::hasTable('users') ? 'users' : null);

        if ($targetTable === null) {
            return;
        }

        Schema::table('product_target_segments', function (Blueprint $table) use ($column, $targetTable): void {
            $table->foreign($column, "fk_product_target_segments_{$column}")
                ->references('id')
                ->on($targetTable)
                ->nullOnDelete();
        });
    }
};
