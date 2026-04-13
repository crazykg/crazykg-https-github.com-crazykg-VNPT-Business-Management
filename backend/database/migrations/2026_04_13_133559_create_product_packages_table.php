<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add has_product_packages column to products table if it doesn't exist
        if (Schema::hasTable('products') && !Schema::hasColumn('products', 'has_product_packages')) {
            Schema::table('products', function (Blueprint $table) {
                $table->boolean('has_product_packages')->default(false)->after('product_name');
            });
        }

        // Create product_packages table if it doesn't exist
        if (!Schema::hasTable('product_packages')) {
            Schema::create('product_packages', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('product_id');
                $table->string('package_code', 100);
                $table->string('package_name', 255);
                $table->decimal('standard_price', 15, 2)->default('0.00');
                $table->string('unit', 50)->nullable();
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->timestamps();

                $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            });

            // Add indexes
            Schema::table('product_packages', function (Blueprint $table) {
                $table->index('product_id', 'idx_product_packages_product_id');
                $table->index('deleted_at', 'idx_product_packages_deleted_at');
                $table->unique('package_code', 'uq_product_packages_package_code');
            });
        }

        // Update attachments table to include PRODUCT_PACKAGE reference type
        if (Schema::hasTable('attachments') && Schema::hasColumn('attachments', 'reference_type')) {
            $currentType = DB::select("SHOW COLUMNS FROM attachments WHERE Field = 'reference_type'");
            if (!empty($currentType)) {
                $typeStr = $currentType[0]->Type;

                // Extract current enum values
                preg_match("/^enum\((.*)\)$/", $typeStr, $matches);
                if (isset($matches[1])) {
                    $enumValues = array_map(function($val) {
                        return trim($val, "'");
                    }, explode(',', $matches[1]));

                    // Add PRODUCT_PACKAGE if not already present
                    if (!in_array('PRODUCT_PACKAGE', $enumValues)) {
                        $enumValues[] = 'PRODUCT_PACKAGE';
                        $newEnumStr = "'" . implode("','", $enumValues) . "'";

                        DB::statement("ALTER TABLE `attachments` MODIFY COLUMN `reference_type` enum(" . $newEnumStr . ") NOT NULL COMMENT 'Bảng cha của file đính kèm'");
                    }
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_packages');
    }
};
