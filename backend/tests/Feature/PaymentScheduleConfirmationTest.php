<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PaymentScheduleConfirmationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    public function test_it_persists_confirmer_and_attachments_when_confirming_payment(): void
    {
        DB::table('payment_schedules')->insert([
            'id' => 1,
            'contract_id' => 100,
            'project_id' => 1,
            'milestone_name' => 'Thanh toán kỳ 1 (quý)',
            'cycle_number' => 1,
            'expected_date' => '2026-03-15',
            'expected_amount' => 18750000,
            'actual_paid_date' => null,
            'actual_paid_amount' => 0,
            'status' => 'PENDING',
            'notes' => null,
            'confirmed_by' => null,
            'confirmed_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $payload = [
            'actual_paid_date' => '2026-03-19',
            'actual_paid_amount' => 18750000,
            'status' => 'PAID',
            'notes' => 'Đã nghiệm thu đợt 1',
            'attachments' => [
                [
                    'id' => 'upload-1',
                    'fileName' => 'bien-ban-nghiem-thu.pdf',
                    'mimeType' => 'application/pdf',
                    'fileSize' => 1024,
                    'fileUrl' => 'https://example.test/attachments/bien-ban-nghiem-thu.pdf',
                    'driveFileId' => '',
                    'createdAt' => '2026-03-19T10:00:00+07:00',
                    'storagePath' => 'attachments/payment-schedules/bien-ban-nghiem-thu.pdf',
                    'storageDisk' => 'local',
                    'storageVisibility' => 'private',
                ],
            ],
        ];

        $this->putJson('/api/v5/payment-schedules/1', $payload)
            ->assertOk()
            ->assertJsonPath('data.status', 'PAID')
            ->assertJsonPath('data.confirmed_by', 1)
            ->assertJsonPath('data.confirmed_by_name', 'Tester')
            ->assertJsonPath('data.attachments.0.fileName', 'bien-ban-nghiem-thu.pdf')
            ->assertJsonPath('data.attachments.0.storagePath', 'attachments/payment-schedules/bien-ban-nghiem-thu.pdf');

        $storedSchedule = DB::table('payment_schedules')->where('id', 1)->first();
        $this->assertNotNull($storedSchedule);
        $this->assertSame(1, (int) $storedSchedule->confirmed_by);
        $this->assertNotNull($storedSchedule->confirmed_at);
        $this->assertSame('PAID', $storedSchedule->status);
        $this->assertSame('2026-03-19', $storedSchedule->actual_paid_date);

        $storedAttachment = DB::table('attachments')
            ->where('reference_type', 'PAYMENT_SCHEDULE')
            ->where('reference_id', 1)
            ->first();

        $this->assertNotNull($storedAttachment);
        $this->assertSame('bien-ban-nghiem-thu.pdf', $storedAttachment->file_name);
        $this->assertSame('attachments/payment-schedules/bien-ban-nghiem-thu.pdf', $storedAttachment->storage_path);

        $this->getJson('/api/v5/payment-schedules?contract_id=100')
            ->assertOk()
            ->assertJsonPath('data.0.confirmed_by', 1)
            ->assertJsonPath('data.0.confirmed_by_name', 'Tester')
            ->assertJsonPath('data.0.attachments.0.fileName', 'bien-ban-nghiem-thu.pdf');
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('payment_schedules');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('departments');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('password')->nullable();
            $table->rememberToken();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('contract_code', 100)->nullable();
            $table->string('contract_name', 255)->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->date('sign_date')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->decimal('value', 18, 2)->default(0);
            $table->decimal('total_value', 18, 2)->default(0);
            $table->string('payment_cycle', 32)->nullable();
            $table->string('status', 32)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('payment_schedules', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('milestone_name', 255)->nullable();
            $table->unsignedInteger('cycle_number');
            $table->date('expected_date')->nullable();
            $table->decimal('expected_amount', 18, 2)->default(0);
            $table->date('actual_paid_date')->nullable();
            $table->decimal('actual_paid_amount', 18, 2)->default(0);
            $table->string('status', 32)->default('PENDING');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('confirmed_by')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('attachments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('reference_type', 50);
            $table->unsignedBigInteger('reference_id');
            $table->string('file_name', 255);
            $table->text('file_url')->nullable();
            $table->string('drive_file_id', 100)->nullable();
            $table->unsignedBigInteger('file_size')->default(0);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->string('storage_disk', 50)->nullable();
            $table->string('storage_path', 1024)->nullable();
            $table->string('storage_visibility', 20)->nullable();
            $table->boolean('is_primary')->default(false);
        });

        DB::table('departments')->insert([
            'id' => 10,
            'dept_code' => 'P10',
            'dept_name' => 'Phong giai phap 10',
            'parent_id' => null,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 1,
            'user_code' => 'U001',
            'username' => 'tester',
            'full_name' => 'Tester',
            'department_id' => 10,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('contracts')->insert([
            'id' => 100,
            'contract_code' => 'HD-THU-001',
            'contract_name' => 'Hop dong thu tien',
            'project_id' => 1,
            'customer_id' => 1,
            'dept_id' => 10,
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => '2026-12-31',
            'value' => 75000000,
            'total_value' => 75000000,
            'payment_cycle' => 'QUARTERLY',
            'status' => 'SIGNED',
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);
    }
}
