<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserDeptHistoryDeletionPolicyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->seedBaseData();
    }

    public function test_non_admin_cannot_delete_someone_elses_transfer_row(): void
    {
        $this->actingAs(InternalUser::query()->findOrFail(3));

        $this->getJson('/api/v5/user-dept-history')
            ->assertOk()
            ->assertJsonFragment([
                'id' => '1',
                'canDelete' => false,
                'deleteRestrictionMessage' => 'Chỉ người tạo dòng hoặc admin mới được xóa lịch sử luân chuyển này.',
            ]);

        $this->deleteJson('/api/v5/user-dept-history/1')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Chỉ người tạo dòng hoặc admin mới được xóa lịch sử luân chuyển này.');

        $this->assertDatabaseHas('user_dept_history', ['id' => 1]);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_creator_can_delete_their_own_transfer_row(): void
    {
        $this->actingAs(InternalUser::query()->findOrFail(2));

        DB::table('integration_settings')->insert([
            'provider' => 'EMAIL_SMTP',
            'is_enabled' => 1,
            'smtp_host' => 'smtp.example.com',
            'smtp_port' => 587,
            'smtp_encryption' => 'tls',
            'smtp_username' => 'no-reply@example.com',
            'smtp_password' => Crypt::encryptString('smtp-secret'),
            'smtp_from_address' => 'no-reply@example.com',
            'smtp_from_name' => 'VNPT Business',
            'smtp_recipient_emails' => 'audit@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Mail::shouldReceive('raw')->once();

        $this->deleteJson('/api/v5/user-dept-history/1')
            ->assertOk()
            ->assertJsonPath('message', 'Đã xóa lịch sử luân chuyển.');

        $this->assertDatabaseMissing('user_dept_history', ['id' => 1]);
        $this->assertSame(1, (int) DB::table('internal_users')->where('id', 2)->value('department_id'));
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'DELETE',
            'auditable_type' => 'user_dept_history',
            'auditable_id' => 1,
            'created_by' => 2,
        ]);
    }

    public function test_admin_can_delete_other_users_row_and_it_records_audit_and_sends_email(): void
    {
        $this->actingAs(InternalUser::query()->findOrFail(1));

        DB::table('integration_settings')->insert([
            'provider' => 'EMAIL_SMTP',
            'is_enabled' => 1,
            'smtp_host' => 'smtp.example.com',
            'smtp_port' => 587,
            'smtp_encryption' => 'tls',
            'smtp_username' => 'no-reply@example.com',
            'smtp_password' => Crypt::encryptString('smtp-secret'),
            'smtp_from_address' => 'no-reply@example.com',
            'smtp_from_name' => 'VNPT Business',
            'smtp_recipient_emails' => 'audit@example.com,notify@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Mail::shouldReceive('raw')
            ->once()
            ->withArgs(function (string $messageBody, \Closure $callback): bool {
                $this->assertStringContainsString('Hệ thống vừa xóa một bản ghi lịch sử điều động nhân sự.', $messageBody);
                $this->assertStringContainsString('Mã lịch sử: LC002', $messageBody);
                $this->assertStringContainsString('Nhân sự: VNPT000003 - Nhân sự bị xóa', $messageBody);
                $this->assertStringContainsString('Người xóa: Admin User (admin)', $messageBody);

                $message = new class {
                    public array $to = [];
                    public ?string $subject = null;
                    public ?array $from = null;

                    public function to($recipients): self
                    {
                        $this->to = is_array($recipients) ? array_values($recipients) : [$recipients];

                        return $this;
                    }

                    public function subject($subject): self
                    {
                        $this->subject = $subject;

                        return $this;
                    }

                    public function from($address, $name = null): self
                    {
                        $this->from = [$address, $name];

                        return $this;
                    }
                };

                $callback($message);

                $this->assertSame(['audit@example.com', 'notify@example.com'], $message->to);
                $this->assertSame('[VNPT Business] Xóa lịch sử điều động - LC002', $message->subject);
                $this->assertSame(['no-reply@example.com', 'VNPT Business'], $message->from);

                return true;
            });

        $this->deleteJson('/api/v5/user-dept-history/2')
            ->assertOk()
            ->assertJsonPath('message', 'Đã xóa lịch sử luân chuyển.');

        $this->assertDatabaseMissing('user_dept_history', ['id' => 2]);
        $this->assertSame(1, (int) DB::table('internal_users')->where('id', 3)->value('department_id'));

        $auditLog = DB::table('audit_logs')
            ->where('auditable_type', 'user_dept_history')
            ->where('auditable_id', 2)
            ->latest('id')
            ->first();

        $this->assertNotNull($auditLog);
        $this->assertSame('DELETE', $auditLog->event);
        $this->assertSame(1, (int) $auditLog->created_by);

        $oldValues = json_decode((string) $auditLog->old_values, true);
        $this->assertIsArray($oldValues);
        $this->assertSame('2', $oldValues['id'] ?? null);
        $this->assertSame('VNPT000003', $oldValues['userCode'] ?? null);
        $this->assertSame('Nhân sự bị xóa', $oldValues['userName'] ?? null);
    }

    private function seedBaseData(): void
    {
        DB::table('departments')->insert([
            ['id' => 1, 'dept_code' => 'P01', 'dept_name' => 'Phong 1'],
            ['id' => 2, 'dept_code' => 'P02', 'dept_name' => 'Phong 2'],
        ]);

        InternalUser::query()->create([
            'id' => 1,
            'uuid' => 'user-1',
            'user_code' => 'VNPT000001',
            'username' => 'admin',
            'password' => bcrypt('secret'),
            'full_name' => 'Admin User',
            'email' => 'admin@example.com',
            'status' => 'ACTIVE',
            'department_id' => 1,
        ]);

        InternalUser::query()->create([
            'id' => 2,
            'uuid' => 'user-2',
            'user_code' => 'VNPT000002',
            'username' => 'creator',
            'password' => bcrypt('secret'),
            'full_name' => 'Người tạo dòng',
            'email' => 'creator@example.com',
            'status' => 'ACTIVE',
            'department_id' => 2,
        ]);

        InternalUser::query()->create([
            'id' => 3,
            'uuid' => 'user-3',
            'user_code' => 'VNPT000003',
            'username' => 'other-user',
            'password' => bcrypt('secret'),
            'full_name' => 'Nhân sự bị xóa',
            'email' => 'other@example.com',
            'status' => 'ACTIVE',
            'department_id' => 2,
        ]);

        DB::table('roles')->insert([
            'id' => 1,
            'role_code' => 'ADMIN',
            'role_name' => 'Administrator',
        ]);

        DB::table('user_roles')->insert([
            'id' => 1,
            'user_id' => 1,
            'role_id' => 1,
            'is_active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('user_dept_history')->insert([
            [
                'id' => 1,
                'user_id' => 2,
                'from_dept_id' => 1,
                'to_dept_id' => 2,
                'transfer_date' => '2026-04-05',
                'decision_number' => 'QD-001',
                'transfer_type' => 'LUAN_CHUYEN',
                'reason' => 'Tự nhập bản ghi',
                'created_by' => 2,
                'updated_by' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'user_id' => 3,
                'from_dept_id' => 1,
                'to_dept_id' => 2,
                'transfer_date' => '2026-04-06',
                'decision_number' => 'QD-002',
                'transfer_type' => 'BIET_PHAI',
                'reason' => 'Admin xóa hộ',
                'created_by' => 2,
                'updated_by' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('integration_settings');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('user_dept_history');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('departments');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code')->nullable();
            $table->string('dept_name')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->string('user_code')->nullable();
            $table->string('username')->nullable();
            $table->string('password')->nullable();
            $table->string('full_name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->rememberToken();
        });

        Schema::create('user_dept_history', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('from_dept_id')->nullable();
            $table->unsignedBigInteger('to_dept_id')->nullable();
            $table->date('transfer_date')->nullable();
            $table->string('decision_number')->nullable();
            $table->string('transfer_type')->nullable();
            $table->text('reason')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('role_code')->nullable();
            $table->string('role_name')->nullable();
        });

        Schema::create('user_roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('role_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('integration_settings', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('provider')->nullable();
            $table->boolean('is_enabled')->default(false);
            $table->string('smtp_host')->nullable();
            $table->unsignedInteger('smtp_port')->nullable();
            $table->string('smtp_encryption')->nullable();
            $table->string('smtp_username')->nullable();
            $table->text('smtp_password')->nullable();
            $table->string('smtp_from_address')->nullable();
            $table->string('smtp_from_name')->nullable();
            $table->text('smtp_recipient_emails')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->string('event')->nullable();
            $table->string('auditable_type')->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->longText('old_values')->nullable();
            $table->longText('new_values')->nullable();
            $table->string('url')->nullable();
            $table->string('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }
}
