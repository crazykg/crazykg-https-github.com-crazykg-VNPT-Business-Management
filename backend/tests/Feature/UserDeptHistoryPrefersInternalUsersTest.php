<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserDeptHistoryPrefersInternalUsersTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_prefers_internal_users_without_merging_with_legacy_users_table(): void
    {
        DB::table('departments')->insert([
            [
                'id' => 1,
                'dept_code' => 'P01',
                'dept_name' => 'Phong 1',
            ],
            [
                'id' => 2,
                'dept_code' => 'P02',
                'dept_name' => 'Phong 2',
            ],
        ]);

        DB::table('internal_users')->insert([
            'id' => 101,
            'user_code' => 'VNPT123456',
            'username' => 'internal.user',
            'full_name' => 'Internal User',
        ]);

        DB::table('users')->insert([
            [
                'id' => 101,
                'name' => 'Legacy Shadow User',
            ],
            [
                'id' => 202,
                'name' => 'Legacy Only User',
            ],
        ]);

        DB::table('user_dept_history')->insert([
            [
                'id' => 1,
                'user_id' => 101,
                'from_dept_id' => 1,
                'to_dept_id' => 2,
                'transfer_date' => '2026-03-20',
                'decision_number' => 'QD-001',
                'transfer_type' => 'BIET_PHAI',
                'reason' => 'Dieu chuyen noi bo',
                'created_at' => now(),
            ],
            [
                'id' => 2,
                'user_id' => 202,
                'from_dept_id' => 2,
                'to_dept_id' => 1,
                'transfer_date' => '2026-03-19',
                'decision_number' => 'QD-002',
                'transfer_type' => null,
                'reason' => 'Ban giao',
                'created_at' => now(),
            ],
        ]);

        $response = $this->getJson('/api/v5/user-dept-history');

        $response->assertOk();

        /** @var Collection<int, array<string, mixed>> $rows */
        $rows = collect($response->json('data'));

        $internalUserRow = $rows->firstWhere('id', '1');
        $legacyOnlyRow = $rows->firstWhere('id', '2');

        $this->assertIsArray($internalUserRow);
        $this->assertSame('Internal User', $internalUserRow['userName']);
        $this->assertSame('VNPT123456', $internalUserRow['userCode']);
        $this->assertSame('BIET_PHAI', $internalUserRow['transferType']);

        $this->assertIsArray($legacyOnlyRow);
        $this->assertSame('', $legacyOnlyRow['userName']);
        $this->assertSame('VNPT000202', $legacyOnlyRow['userCode']);
        $this->assertSame('LUAN_CHUYEN', $legacyOnlyRow['transferType']);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('user_dept_history');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('users');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code')->nullable();
            $table->string('dept_name')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code')->nullable();
            $table->string('username')->nullable();
            $table->string('full_name')->nullable();
        });

        Schema::create('users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('name')->nullable();
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
            $table->timestamp('created_at')->nullable();
        });
    }
}
