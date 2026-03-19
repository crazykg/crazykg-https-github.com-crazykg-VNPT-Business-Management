<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('feedback_requests')) {
            Schema::create('feedback_requests', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique('uq_feedback_requests_uuid')->comment('UUID góp ý');
                $table->string('title', 255)->comment('Tiêu đề góp ý');
                $table->text('description')->nullable()->comment('Nội dung chi tiết góp ý');
                $table->enum('priority', ['UNRATED', 'LOW', 'MEDIUM', 'HIGH'])
                    ->default('UNRATED')
                    ->comment('Mức độ ưu tiên');
                $table->enum('status', ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
                    ->default('OPEN')
                    ->comment('Trạng thái xử lý góp ý');
                $table->unsignedBigInteger('created_by')->nullable()->comment('Người tạo góp ý');
                $table->unsignedBigInteger('updated_by')->nullable()->comment('Người cập nhật cuối');
                $table->unsignedBigInteger('status_changed_by')->nullable()->comment('Người đổi trạng thái gần nhất');
                $table->dateTime('status_changed_at')->nullable()->comment('Thời gian đổi trạng thái gần nhất');
                $table->softDeletes();
                $table->timestamps();

                $table->index(['created_by', 'status', 'created_at'], 'idx_feedback_creator_status_created');
                $table->index(['status', 'priority', 'created_at'], 'idx_feedback_status_priority_created');
            });
        }

        $this->ensurePermissions();
    }

    public function down(): void
    {
        $this->dropPermissions();
        Schema::dropIfExists('feedback_requests');
    }

    private function ensurePermissions(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasColumn('permissions', 'perm_key')) {
            return;
        }

        $definitions = [
            [
                'perm_key' => 'feedback_requests.read',
                'perm_name' => 'Xem góp ý người dùng',
                'perm_group' => 'Góp ý',
            ],
            [
                'perm_key' => 'feedback_requests.write',
                'perm_name' => 'Tạo/Cập nhật góp ý người dùng',
                'perm_group' => 'Góp ý',
            ],
            [
                'perm_key' => 'feedback_requests.delete',
                'perm_name' => 'Xóa góp ý người dùng',
                'perm_group' => 'Góp ý',
            ],
        ];

        foreach ($definitions as $definition) {
            $permKey = trim((string) ($definition['perm_key'] ?? ''));
            if ($permKey === '') {
                continue;
            }

            $existing = DB::table('permissions')
                ->select(['id'])
                ->where('perm_key', $permKey)
                ->first();

            $payload = [
                'perm_key' => $permKey,
                'perm_name' => (string) ($definition['perm_name'] ?? $permKey),
                'perm_group' => (string) ($definition['perm_group'] ?? 'Hệ thống'),
            ];

            if (Schema::hasColumn('permissions', 'is_active')) {
                $payload['is_active'] = true;
            }

            if ($existing === null) {
                if (Schema::hasColumn('permissions', 'created_at')) {
                    $payload['created_at'] = now();
                }
                if (Schema::hasColumn('permissions', 'updated_at')) {
                    $payload['updated_at'] = now();
                }

                DB::table('permissions')->insert($payload);
                continue;
            }

            if (Schema::hasColumn('permissions', 'updated_at')) {
                $payload['updated_at'] = now();
            }

            DB::table('permissions')->where('id', (int) $existing->id)->update($payload);
        }
    }

    private function dropPermissions(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasColumn('permissions', 'perm_key')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('perm_key', [
                'feedback_requests.read',
                'feedback_requests.write',
                'feedback_requests.delete',
            ])
            ->delete();
    }
};
