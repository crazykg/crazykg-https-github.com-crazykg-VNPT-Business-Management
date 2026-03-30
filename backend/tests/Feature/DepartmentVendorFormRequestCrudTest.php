<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DepartmentVendorFormRequestCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_creates_and_updates_departments_via_form_requests(): void
    {
        $this->postJson('/api/v5/departments', [
            'dept_code' => 'KD',
            'dept_name' => 'Phong Kinh Doanh',
            'is_active' => true,
            'data_scope' => 'dept',
        ])
            ->assertCreated()
            ->assertJsonPath('data.dept_code', 'KD')
            ->assertJsonPath('data.dept_name', 'Phong Kinh Doanh')
            ->assertJsonPath('data.status', 'ACTIVE');

        $this->putJson('/api/v5/departments/2', [
            'dept_name' => 'Phong Kinh Doanh Moi',
            'is_active' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.dept_name', 'Phong Kinh Doanh Moi')
            ->assertJsonPath('data.status', 'INACTIVE');
    }

    public function test_it_creates_and_updates_vendors_via_form_requests(): void
    {
        $this->postJson('/api/v5/vendors', [
            'vendor_code' => 'VNPT',
            'vendor_name' => 'VNPT Hau Giang',
            'data_scope' => 'global',
        ])
            ->assertCreated()
            ->assertJsonPath('data.vendor_code', 'VNPT')
            ->assertJsonPath('data.vendor_name', 'VNPT Hau Giang');

        $this->putJson('/api/v5/vendors/1', [
            'vendor_name' => 'VNPT Hau Giang Update',
        ])
            ->assertOk()
            ->assertJsonPath('data.vendor_code', 'VNPT')
            ->assertJsonPath('data.vendor_name', 'VNPT Hau Giang Update');
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('vendors');
        Schema::dropIfExists('departments');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 100)->unique();
            $table->string('dept_name', 255);
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('dept_path', 255)->default('0/');
            $table->boolean('is_active')->default(true);
            $table->string('status', 20)->default('ACTIVE');
            $table->string('data_scope', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('vendors', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('uuid', 100)->nullable()->unique();
            $table->string('vendor_code', 100)->unique();
            $table->string('vendor_name', 255);
            $table->string('data_scope', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        DB::table('departments')->insert([
            'id' => 1,
            'dept_code' => 'BGĐVT',
            'dept_name' => 'Ban Giam Doc',
            'parent_id' => null,
            'dept_path' => '0/1/',
            'is_active' => true,
            'status' => 'ACTIVE',
            'data_scope' => 'root',
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);
    }
}
