<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SupportServiceGroupWorkflowBindingBackfillTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
    }

    public function test_backfill_assigns_default_bindings_only_to_compatible_support_service_groups(): void
    {
        $migration = require base_path('database/migrations/2026_03_13_210000_backfill_support_service_group_workflow_defaults.php');
        $migration->up();

        $hisL3 = DB::table('support_service_groups')->where('id', 1)->first();
        $this->assertSame(8, (int) $hisL3->workflow_status_catalog_id);
        $this->assertSame('programming.phan_tich', $hisL3->workflow_form_key);

        $dms = DB::table('support_service_groups')->where('id', 2)->first();
        $this->assertSame(14, (int) $dms->workflow_status_catalog_id);
        $this->assertSame('programming.chuyen_dms', $dms->workflow_form_key);

        $hisL2 = DB::table('support_service_groups')->where('id', 3)->first();
        $this->assertNull($hisL2->workflow_status_catalog_id);
        $this->assertNull($hisL2->workflow_form_key);

        $smoke = DB::table('support_service_groups')->where('id', 4)->first();
        $this->assertNull($smoke->workflow_status_catalog_id);
        $this->assertNull($smoke->workflow_form_key);

        $customFormKey = DB::table('support_service_groups')->where('id', 5)->first();
        $this->assertNull($customFormKey->workflow_status_catalog_id);
        $this->assertSame('custom.upcode.form', $customFormKey->workflow_form_key);

        $compatiblePartial = DB::table('support_service_groups')->where('id', 6)->first();
        $this->assertSame(8, (int) $compatiblePartial->workflow_status_catalog_id);
        $this->assertSame('programming.phan_tich', $compatiblePartial->workflow_form_key);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('support_service_groups');
        Schema::dropIfExists('workflow_status_catalogs');

        Schema::create('workflow_status_catalogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('status_code', 80);
            $table->string('form_key', 120)->nullable();
        });

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('group_code', 50)->nullable();
            $table->string('group_name', 255)->nullable();
            $table->unsignedBigInteger('workflow_status_catalog_id')->nullable();
            $table->string('workflow_form_key', 120)->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        DB::table('workflow_status_catalogs')->insert([
            [
                'id' => 8,
                'status_code' => 'PHAN_TICH',
                'form_key' => 'programming.phan_tich',
            ],
            [
                'id' => 14,
                'status_code' => 'CHUYEN_DMS_GROUP',
                'form_key' => 'programming.chuyen_dms',
            ],
        ]);

        DB::table('support_service_groups')->insert([
            [
                'id' => 1,
                'group_code' => 'HIS_L3',
                'group_name' => 'HIS L3',
                'workflow_status_catalog_id' => null,
                'workflow_form_key' => null,
            ],
            [
                'id' => 2,
                'group_code' => 'DMS_CORE',
                'group_name' => 'Nhóm DMS',
                'workflow_status_catalog_id' => null,
                'workflow_form_key' => null,
            ],
            [
                'id' => 3,
                'group_code' => 'HIS_L2',
                'group_name' => 'HIS L2',
                'workflow_status_catalog_id' => null,
                'workflow_form_key' => null,
            ],
            [
                'id' => 4,
                'group_code' => 'SMOKE_GROUP_A',
                'group_name' => 'SMOKE-GROUP-A',
                'workflow_status_catalog_id' => null,
                'workflow_form_key' => null,
            ],
            [
                'id' => 5,
                'group_code' => 'UPCODE_VAN_BAN',
                'group_name' => 'UPCODE VĂN BẢN',
                'workflow_status_catalog_id' => null,
                'workflow_form_key' => 'custom.upcode.form',
            ],
            [
                'id' => 6,
                'group_code' => 'HOAN_THIEN_PHAN_MEM',
                'group_name' => 'HOÀN THIỆN PHẦN MỀM',
                'workflow_status_catalog_id' => 8,
                'workflow_form_key' => null,
            ],
        ]);
    }
}
