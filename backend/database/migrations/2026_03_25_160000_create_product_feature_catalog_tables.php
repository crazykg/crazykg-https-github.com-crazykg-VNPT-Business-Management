<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('products')) {
            return;
        }

        if (! Schema::hasTable('product_feature_groups')) {
            Schema::create('product_feature_groups', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->uuid('uuid')->nullable()->unique();
                $table->unsignedBigInteger('product_id');
                $table->string('group_name', 255);
                $table->unsignedInteger('display_order')->default(1);
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->foreign('product_id')
                    ->references('id')
                    ->on('products')
                    ->cascadeOnDelete();

                $table->index(['product_id', 'display_order'], 'pfg_product_order_idx');
            });
        }

        if (! Schema::hasTable('product_features')) {
            Schema::create('product_features', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->uuid('uuid')->nullable()->unique();
                $table->unsignedBigInteger('product_id');
                $table->unsignedBigInteger('group_id');
                $table->string('feature_name', 255);
                $table->longText('detail_description')->nullable();
                $table->string('status', 20)->default('ACTIVE');
                $table->unsignedInteger('display_order')->default(1);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->foreign('product_id')
                    ->references('id')
                    ->on('products')
                    ->cascadeOnDelete();
                $table->foreign('group_id')
                    ->references('id')
                    ->on('product_feature_groups')
                    ->cascadeOnDelete();

                $table->index(['product_id', 'group_id', 'display_order'], 'pf_product_group_order_idx');
                $table->index(['product_id', 'status'], 'pf_product_status_idx');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('product_features')) {
            Schema::drop('product_features');
        }

        if (Schema::hasTable('product_feature_groups')) {
            Schema::drop('product_feature_groups');
        }
    }
};
