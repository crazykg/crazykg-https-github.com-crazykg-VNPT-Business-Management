<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * @var array<int, array{unit_code: string, unit_name: string}>
     */
    private array $defaultUnits = [
        ['unit_code' => 'LICENSE', 'unit_name' => 'License'],
        ['unit_code' => 'THANG', 'unit_name' => 'Tháng'],
        ['unit_code' => 'GOI', 'unit_name' => 'Gói'],
        ['unit_code' => 'BO', 'unit_name' => 'Bộ'],
        ['unit_code' => 'CAI', 'unit_name' => 'Cái'],
        ['unit_code' => 'THIET_BI', 'unit_name' => 'Thiết bị'],
        ['unit_code' => 'USER', 'unit_name' => 'User'],
        ['unit_code' => 'MODULE', 'unit_name' => 'Module'],
        ['unit_code' => 'GIUONG_BENH', 'unit_name' => 'Giường bệnh'],
        ['unit_code' => 'CA_CHUP', 'unit_name' => 'Ca chụp'],
        ['unit_code' => 'BENH_AN', 'unit_name' => 'Bệnh án'],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('product_unit_masters')) {
            Schema::create('product_unit_masters', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('unit_code', 50)->unique('uq_product_unit_masters_code');
                $table->string('unit_name', 120)->unique('uq_product_unit_masters_name');
                $table->string('description', 255)->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamp('created_at')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->index(['is_active', 'unit_name'], 'idx_product_unit_masters_active_name');
            });
        }

        foreach ($this->defaultUnits as $item) {
            $payload = [
                'unit_code' => $this->sanitizeCode($item['unit_code']),
                'unit_name' => trim($item['unit_name']),
                'description' => null,
                'is_active' => true,
            ];

            if (Schema::hasColumn('product_unit_masters', 'created_at')) {
                $payload['created_at'] = now();
            }
            if (Schema::hasColumn('product_unit_masters', 'updated_at')) {
                $payload['updated_at'] = now();
            }

            DB::table('product_unit_masters')->updateOrInsert(
                ['unit_code' => $payload['unit_code']],
                $payload,
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_unit_masters');
    }

    private function sanitizeCode(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }
};
