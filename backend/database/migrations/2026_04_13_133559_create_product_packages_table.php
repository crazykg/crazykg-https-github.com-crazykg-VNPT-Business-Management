<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('products') && ! Schema::hasColumn('products', 'has_product_packages')) {
            $anchorColumn = Schema::hasColumn('products', 'package_name') ? 'package_name' : 'product_name';

            Schema::table('products', function (Blueprint $table) use ($anchorColumn): void {
                $table->boolean('has_product_packages')->default(false)->after($anchorColumn);
            });
        }

        if (! Schema::hasTable('product_packages')) {
            Schema::create('product_packages', function (Blueprint $table): void {
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
                $table->index('product_id', 'idx_product_packages_product_id');
                $table->index('deleted_at', 'idx_product_packages_deleted_at');
                $table->unique('package_code', 'uq_product_packages_package_code');
            });
        } else {
            $this->ensureProductPackagesIndexes();
        }

        if (Schema::hasTable('attachments') && Schema::hasColumn('attachments', 'reference_type')) {
            $currentType = DB::select("SHOW COLUMNS FROM `attachments` WHERE `Field` = 'reference_type'");
            if (!empty($currentType)) {
                $typeStr = $currentType[0]->Type;

                preg_match("/^enum\((.*)\)$/", $typeStr, $matches);
                if (isset($matches[1])) {
                    $enumValues = array_map(static function ($val) {
                        return trim($val, "'");
                    }, explode(',', $matches[1]));

                    if (!in_array('PRODUCT_PACKAGE', $enumValues)) {
                        $enumValues[] = 'PRODUCT_PACKAGE';
                        $newEnumStr = "'" . implode("','", $enumValues) . "'";

                        DB::statement(
                            "ALTER TABLE `attachments` MODIFY COLUMN `reference_type` enum(" . $newEnumStr . ") "
                            . "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bảng cha của file đính kèm'"
                        );
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

    private function ensureProductPackagesIndexes(): void
    {
        $indexes = collect(DB::select('SHOW INDEX FROM `product_packages`'))
            ->pluck('Key_name')
            ->map(static fn ($value) => (string) $value)
            ->all();

        Schema::table('product_packages', function (Blueprint $table) use ($indexes): void {
            if (! in_array('idx_product_packages_product_id', $indexes, true)) {
                $table->index('product_id', 'idx_product_packages_product_id');
            }

            if (! in_array('idx_product_packages_deleted_at', $indexes, true)) {
                $table->index('deleted_at', 'idx_product_packages_deleted_at');
            }

            if (! in_array('uq_product_packages_package_code', $indexes, true)) {
                $table->unique('package_code', 'uq_product_packages_package_code');
            }
        });
    }
};
