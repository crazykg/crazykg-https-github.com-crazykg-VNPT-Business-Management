<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_request_cases')) {
            return;
        }

        Schema::table('customer_request_cases', function (Blueprint $table): void {
            if (! Schema::hasColumn('customer_request_cases', 'received_by_user_id')) {
                $table->unsignedBigInteger('received_by_user_id')->nullable()->index()->comment('Người tiếp nhận')->after('product_id');
            }
            if (! Schema::hasColumn('customer_request_cases', 'received_at')) {
                $table->dateTime('received_at')->nullable()->comment('Ngày giờ tiếp nhận')->after('current_status_instance_id');
            }
        });

        if (Schema::hasTable('internal_users')) {
            $this->addForeignIfMissing('customer_request_cases', 'received_by_user_id', 'internal_users');
        }

        if (Schema::hasTable('customer_request_new_intakes')) {
            DB::table('customer_request_new_intakes')
                ->orderBy('id')
                ->get()
                ->each(function (object $row): void {
                    $payload = array_filter([
                        'received_by_user_id' => $row->received_by_user_id ?? null,
                        'received_at' => $row->received_at ?? null,
                    ], static fn (mixed $value): bool => $value !== null);

                    if ($payload !== []) {
                        DB::table('customer_request_cases')
                            ->where('id', (int) $row->request_case_id)
                            ->update($payload);
                    }
                });
        }

        if (Schema::hasTable('customer_request_status_catalogs')) {
            DB::table('customer_request_status_catalogs')
                ->where('status_code', 'new_intake')
                ->update([
                    'table_name' => 'customer_request_cases',
                    'updated_at' => now(),
                ]);
        }

        if (Schema::hasTable('customer_request_status_instances')) {
            DB::table('customer_request_status_instances')
                ->where('status_code', 'new_intake')
                ->orderBy('id')
                ->get()
                ->each(function (object $row): void {
                    DB::table('customer_request_status_instances')
                        ->where('id', (int) $row->id)
                        ->update([
                            'status_table' => 'customer_request_cases',
                            'status_row_id' => (int) $row->request_case_id,
                            'updated_at' => now(),
                        ]);
                });
        }
    }

    public function down(): void
    {
        // Không hỗ trợ chiều ngược về schema cũ nữa.
        // Migration này chỉ dùng để gom dữ liệu cũ vào bảng master.
    }

    private function addForeignIfMissing(string $tableName, string $column, string $targetTable, string $targetColumn = 'id'): void
    {
        $foreignKey = "fk_{$tableName}_{$column}";

        if ($this->hasForeignKey($tableName, $foreignKey)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($column, $targetTable, $targetColumn, $foreignKey): void {
            $table->foreign($column, $foreignKey)
                ->references($targetColumn)
                ->on($targetTable)
                ->nullOnDelete();
        });
    }

    private function hasForeignKey(string $tableName, string $foreignKey): bool
    {
        if (DB::getDriverName() !== 'mysql') {
            return false;
        }

        $databaseName = DB::getDatabaseName();
        $result = DB::selectOne(
            'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = ? LIMIT 1',
            [$databaseName, $tableName, $foreignKey, 'FOREIGN KEY']
        );

        return $result !== null;
    }
};
