<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BulkBackfillMigrationChunkingTest extends TestCase
{
    private const DEFAULT_PASSWORD_HASH = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

    protected function tearDown(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('customer_request_status_instances');
        Schema::dropIfExists('customer_request_status_catalogs');
        Schema::dropIfExists('customer_request_new_intakes');
        Schema::dropIfExists('customer_request_cases');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('customers');
        Schema::enableForeignKeyConstraints();

        parent::tearDown();
    }

    public function test_customer_code_backfill_preserves_manual_codes_and_generates_unique_codes(): void
    {
        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_code')->nullable();
            $table->string('customer_name')->nullable();
            $table->string('company_name')->nullable();
        });

        DB::table('customers')->insert([
            ['id' => 1, 'customer_code' => 'BV_MANUAL', 'customer_name' => 'Benh vien manual', 'company_name' => null],
            ['id' => 2, 'customer_code' => null, 'customer_name' => 'Benh Vien Da Khoa Trung Tam', 'company_name' => null],
            ['id' => 3, 'customer_code' => ' ', 'customer_name' => null, 'company_name' => 'Benh Vien Da Khoa Trung Tam'],
            ['id' => 4, 'customer_code' => null, 'customer_name' => null, 'company_name' => null],
        ]);

        $migration = require base_path('database/migrations/2026_03_28_130000_add_customer_code_auto_generated_to_customers.php');
        $migration->up();

        $rows = DB::table('customers')->orderBy('id')->get()->keyBy('id');

        $this->assertTrue(Schema::hasColumn('customers', 'customer_code_auto_generated'));
        $this->assertSame('BV_MANUAL', $rows[1]->customer_code);
        $this->assertFalse((bool) $rows[1]->customer_code_auto_generated);
        $this->assertTrue((bool) $rows[2]->customer_code_auto_generated);
        $this->assertTrue((bool) $rows[3]->customer_code_auto_generated);
        $this->assertTrue((bool) $rows[4]->customer_code_auto_generated);
        $this->assertNotSame('', trim((string) $rows[2]->customer_code));
        $this->assertNotSame('', trim((string) $rows[3]->customer_code));
        $this->assertStringStartsWith('KHACH_HANG', (string) $rows[4]->customer_code);

        $codes = collect($rows)->pluck('customer_code')->map(fn ($value): string => trim((string) $value));
        $this->assertCount(4, $codes->unique()->all());
    }

    public function test_merge_new_intake_backfill_updates_case_and_status_instance_targets(): void
    {
        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
        });

        Schema::create('customer_request_cases', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('current_status_instance_id')->nullable();
        });

        Schema::create('customer_request_new_intakes', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('request_case_id');
            $table->unsignedBigInteger('received_by_user_id')->nullable();
            $table->dateTime('received_at')->nullable();
        });

        Schema::create('customer_request_status_catalogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('status_code')->nullable();
            $table->string('table_name')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('customer_request_status_instances', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('status_code')->nullable();
            $table->unsignedBigInteger('request_case_id')->nullable();
            $table->string('status_table')->nullable();
            $table->unsignedBigInteger('status_row_id')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        DB::table('internal_users')->insert(['id' => 7]);
        DB::table('customer_request_cases')->insert(['id' => 11, 'product_id' => 3, 'current_status_instance_id' => 21]);
        DB::table('customer_request_new_intakes')->insert([
            'id' => 1,
            'request_case_id' => 11,
            'received_by_user_id' => 7,
            'received_at' => '2026-03-18 08:30:00',
        ]);
        DB::table('customer_request_status_catalogs')->insert([
            'id' => 1,
            'status_code' => 'new_intake',
            'table_name' => 'customer_request_new_intakes',
            'updated_at' => null,
        ]);
        DB::table('customer_request_status_instances')->insert([
            'id' => 21,
            'status_code' => 'new_intake',
            'request_case_id' => 11,
            'status_table' => 'customer_request_new_intakes',
            'status_row_id' => 1,
            'updated_at' => null,
        ]);

        $migration = require base_path('database/migrations/2026_03_17_090000_merge_new_intake_into_customer_request_cases.php');
        $migration->up();

        $this->assertSame(7, (int) DB::table('customer_request_cases')->where('id', 11)->value('received_by_user_id'));
        $this->assertSame('2026-03-18 08:30:00', DB::table('customer_request_cases')->where('id', 11)->value('received_at'));
        $this->assertSame('customer_request_cases', DB::table('customer_request_status_catalogs')->where('id', 1)->value('table_name'));
        $this->assertSame('customer_request_cases', DB::table('customer_request_status_instances')->where('id', 21)->value('status_table'));
        $this->assertSame(11, (int) DB::table('customer_request_status_instances')->where('id', 21)->value('status_row_id'));
    }

    public function test_rotate_default_internal_user_passwords_updates_only_default_hash_rows(): void
    {
        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('password')->nullable();
            $table->boolean('must_change_password')->default(false);
            $table->timestamp('password_reset_required_at')->nullable();
            $table->timestamp('password_changed_at')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        DB::table('internal_users')->insert([
            [
                'id' => 1,
                'password' => self::DEFAULT_PASSWORD_HASH,
                'must_change_password' => 0,
                'password_reset_required_at' => null,
                'password_changed_at' => now(),
                'status' => 'ACTIVE',
                'updated_at' => null,
            ],
            [
                'id' => 2,
                'password' => 'custom-hash',
                'must_change_password' => 0,
                'password_reset_required_at' => null,
                'password_changed_at' => now(),
                'status' => 'ACTIVE',
                'updated_at' => null,
            ],
        ]);

        $migration = require base_path('database/migrations/2026_03_04_120100_rotate_default_internal_user_passwords.php');
        $migration->up();

        $rotated = DB::table('internal_users')->where('id', 1)->first();
        $untouched = DB::table('internal_users')->where('id', 2)->first();

        $this->assertNotSame(self::DEFAULT_PASSWORD_HASH, $rotated->password);
        $this->assertSame(1, (int) $rotated->must_change_password);
        $this->assertSame('INACTIVE', $rotated->status);
        $this->assertNull($rotated->password_changed_at);
        $this->assertNotNull($rotated->password_reset_required_at);

        $this->assertSame('custom-hash', $untouched->password);
        $this->assertSame('ACTIVE', $untouched->status);
        $this->assertSame(0, (int) $untouched->must_change_password);
    }
}
