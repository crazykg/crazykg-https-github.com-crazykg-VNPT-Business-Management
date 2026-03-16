<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class YeuCauWorkflowCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpYeuCauWorkflowSchema();
    }

    public function test_process_catalog_and_definition_return_registry_metadata(): void
    {
        $this->getJson('/api/v5/yeu-cau/processes')
            ->assertOk()
            ->assertJsonPath('data.master_fields.0.name', 'khach_hang_id')
            ->assertJsonPath('data.groups.0.group_code', 'tiep_nhan');

        $this->getJson('/api/v5/yeu-cau/processes/tt_giao_yc_pm')
            ->assertOk()
            ->assertJsonPath('data.process_code', 'tt_giao_yc_pm')
            ->assertJsonPath('data.table_name', 'tt_giao_yc_pm');
    }

    public function test_store_yeu_cau_creates_master_initial_process_related_people_and_timeline(): void
    {
        $response = $this->postJson('/api/v5/yeu-cau', $this->createPayload());

        $response
            ->assertCreated()
            ->assertJsonPath('data.tien_trinh_hien_tai', 'tt_giao_yc_pm')
            ->assertJsonPath('data.trang_thai', 'moi_tiep_nhan')
            ->assertJsonPath('data.pm_id', 2)
            ->assertJsonPath('data.khach_hang_name', 'Bệnh viện A');

        $this->assertSame(1, DB::table('yeu_cau')->count());
        $this->assertSame(1, DB::table('tt_giao_yc_pm')->count());
        $this->assertSame(2, DB::table('yc_nguoi_lien_quan')->count());
        $this->assertSame(1, DB::table('yc_lich_su_trang_thai')->count());

        $maYc = (string) DB::table('yeu_cau')->value('ma_yc');
        $this->assertMatchesRegularExpression('/^YC-10-\d{6}-\d{4}$/', $maYc);
    }

    public function test_save_process_transitions_to_tt_giao_yc_r_and_detail_people_timeline_follow_master(): void
    {
        $created = $this->postJson('/api/v5/yeu-cau', $this->createPayload())->assertCreated();
        $yeuCauId = (int) $created->json('data.id');

        $saveResponse = $this->postJson("/api/v5/yeu-cau/{$yeuCauId}/processes/tt_giao_yc_r", [
            'process_payload' => [
                'pm_id' => 2,
                'r_nhan_id' => 3,
                'mo_ta_cong_viec' => 'Xu ly noi bo',
                'deadline' => '2026-03-20 08:00:00',
            ],
            'ly_do' => 'Chuyen xu ly noi bo',
        ]);

        $saveResponse
            ->assertOk()
            ->assertJsonPath('data.tien_trinh_hien_tai', 'tt_giao_yc_r')
            ->assertJsonPath('data.trang_thai', 'moi_tiep_nhan')
            ->assertJsonPath('data.pm_id', 2)
            ->assertJsonPath('data.r_id', 3);

        $this->assertSame(1, DB::table('tt_giao_yc_r')->count());
        $this->assertSame(3, DB::table('yc_nguoi_lien_quan')->count());
        $this->assertSame(2, DB::table('yc_lich_su_trang_thai')->count());

        $this->getJson("/api/v5/yeu-cau/{$yeuCauId}")
            ->assertOk()
            ->assertJsonPath('data.tien_trinh_hien_tai', 'tt_giao_yc_r')
            ->assertJsonPath('data.r_name', 'R thực hiện');

        $this->getJson("/api/v5/yeu-cau/{$yeuCauId}/processes/tt_giao_yc_r")
            ->assertOk()
            ->assertJsonPath('data.process.process_code', 'tt_giao_yc_r')
            ->assertJsonPath('data.process_row.data.r_nhan_id', 3)
            ->assertJsonPath('data.process_row.data.r_nhan_id_name', 'R thực hiện');

        $this->getJson("/api/v5/yeu-cau/{$yeuCauId}/people")
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $this->getJson("/api/v5/yeu-cau/{$yeuCauId}/timeline")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.tien_trinh', 'tt_giao_yc_r');
    }

    public function test_index_filters_by_current_process_code(): void
    {
        $first = $this->postJson('/api/v5/yeu-cau', $this->createPayload([
            'tieu_de' => 'Yêu cầu ở bước PM',
        ]))->assertCreated();

        $second = $this->postJson('/api/v5/yeu-cau', $this->createPayload([
            'tieu_de' => 'Yêu cầu đã giao R',
            'khach_hang_id' => 11,
        ]))->assertCreated();

        $secondId = (int) $second->json('data.id');
        $this->postJson("/api/v5/yeu-cau/{$secondId}/processes/tt_giao_yc_r", [
            'process_payload' => [
                'pm_id' => 2,
                'r_nhan_id' => 3,
            ],
        ])->assertOk();

        $this->getJson('/api/v5/yeu-cau?process_code=tt_giao_yc_pm')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.tieu_de', 'Yêu cầu ở bước PM');

        $this->getJson('/api/v5/yeu-cau?process_code=tt_giao_yc_r')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $secondId);
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function createPayload(array $overrides = []): array
    {
        return array_replace_recursive([
            'don_vi_id' => 10,
            'created_by' => 1,
            'khach_hang_id' => 10,
            'tieu_de' => 'Yêu cầu hỗ trợ LIS',
            'mo_ta' => 'Mô tả yêu cầu',
            'do_uu_tien' => 3,
            'loai_yc' => 'Hỗ trợ',
            'kenh_tiep_nhan' => 'Phone',
            'process_payload' => [
                'pm_nhan_id' => 2,
                'deadline_phan_hoi' => '2026-03-16 09:00:00',
            ],
        ], $overrides);
    }

    private function setUpYeuCauWorkflowSchema(): void
    {
        $this->dropYeuCauWorkflowTables();

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        DB::table('customers')->insert([
            ['id' => 10, 'customer_name' => 'Bệnh viện A'],
            ['id' => 11, 'customer_name' => 'Bệnh viện B'],
        ]);

        DB::table('internal_users')->insert([
            ['id' => 1, 'user_code' => 'U001', 'username' => 'creator', 'full_name' => 'Người nhập', 'department_id' => 10],
            ['id' => 2, 'user_code' => 'U002', 'username' => 'pm', 'full_name' => 'PM phụ trách', 'department_id' => 10],
            ['id' => 3, 'user_code' => 'U003', 'username' => 'r', 'full_name' => 'R thực hiện', 'department_id' => 10],
        ]);

        $migration = require base_path('database/migrations/2026_03_15_235500_create_yeu_cau_workflow_tables.php');
        $migration->up();
    }

    private function dropYeuCauWorkflowTables(): void
    {
        Schema::disableForeignKeyConstraints();

        $migration = require base_path('database/migrations/2026_03_15_235500_create_yeu_cau_workflow_tables.php');
        $migration->down();

        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');

        Schema::enableForeignKeyConstraints();
    }
}
