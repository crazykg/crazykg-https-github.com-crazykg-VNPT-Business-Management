<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_auto_generates_customer_codes_from_customer_names(): void
    {
        $this->postJson('/api/v5/customers', [
            'customer_name' => 'Trung tâm Y tế Vị Thủy',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'MEDICAL_CENTER',
        ])
            ->assertCreated()
            ->assertJsonPath('data.customer_code', 'TTYT_VI_THUY')
            ->assertJsonPath('data.customer_code_auto_generated', true);

        $this->postJson('/api/v5/customers', [
            'customer_name' => 'Trung tâm Y tế Vị Thủy',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'MEDICAL_CENTER',
        ])
            ->assertCreated()
            ->assertJsonPath('data.customer_code', 'TTYT_VI_THUY_2')
            ->assertJsonPath('data.customer_code_auto_generated', true);

        $this->postJson('/api/v5/customers', [
            'customer_name' => 'Bệnh viện Đa khoa Cần Thơ',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'PUBLIC_HOSPITAL',
        ])
            ->assertCreated()
            ->assertJsonPath('data.customer_code', 'BVĐK_CAN_THO');

        $this->postJson('/api/v5/customers', [
            'customer_name' => 'Trạm Y tế Phường 1',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'TYT_PKDK',
        ])
            ->assertCreated()
            ->assertJsonPath('data.customer_code', 'TYT_PHUONG_1');

        $this->postJson('/api/v5/customers', [
            'customer_name' => 'Phòng khám Đa khoa Khu vực',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'TYT_PKDK',
        ])
            ->assertCreated()
            ->assertJsonPath('data.customer_code', 'PKDK_KHU_VUC');

        $this->postJson('/api/v5/customers', [
            'customer_name' => 'Phòng khám tư nhân A',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'PRIVATE_CLINIC',
        ])
            ->assertCreated()
            ->assertJsonPath('data.customer_code', 'PK_TU_NHAN_A');

        $this->postJson('/api/v5/customers', [
            'customer_name' => 'Bệnh viện Sản Nhi Hậu Giang',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'PUBLIC_HOSPITAL',
        ])
            ->assertCreated()
            ->assertJsonPath('data.customer_code', 'BV_SAN_NHI_HAU_GIANG');

        $this->postJson('/api/v5/customers', [
            'customer_name' => 'UBND xã Vị Thủy',
            'customer_sector' => 'GOVERNMENT',
        ])
            ->assertCreated()
            ->assertJsonPath('data.customer_code', 'UBND_XA_VI_THUY');
    }

    public function test_it_can_bulk_create_customers_for_import_without_hitting_row_by_row_routes(): void
    {
        $response = $this->postJson('/api/v5/customers/bulk', [
            'items' => [
                [
                    'customer_name' => 'Trung tâm Y tế Vị Thủy',
                    'customer_sector' => 'HEALTHCARE',
                    'healthcare_facility_type' => 'MEDICAL_CENTER',
                ],
                [
                    'customer_name' => 'UBND xã Vị Thủy',
                    'customer_sector' => 'GOVERNMENT',
                ],
                [
                    'customer_name' => '',
                ],
            ],
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.created_count', 2);
        $response->assertJsonPath('data.failed_count', 1);
        $response->assertJsonPath('data.results.0.success', true);
        $response->assertJsonPath('data.results.0.data.customer_code', 'TTYT_VI_THUY');
        $response->assertJsonPath('data.results.1.success', true);
        $response->assertJsonPath('data.results.1.data.customer_code', 'UBND_XA_VI_THUY');
        $response->assertJsonPath('data.results.2.success', false);

        $this->assertSame(2, DB::table('customers')->count());
    }

    public function test_it_keeps_existing_auto_generated_codes_until_customer_code_is_cleared(): void
    {
        DB::table('customers')->insert([
            'id' => 91,
            'uuid' => 'customer-91',
            'customer_code' => 'TTYT_VI_THUY',
            'customer_code_auto_generated' => true,
            'customer_name' => 'Trung tâm Y tế Vị Thủy',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'MEDICAL_CENTER',
            'created_by' => 99,
            'updated_by' => 99,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAsInternalUser(99);

        $this->putJson('/api/v5/customers/91', [
            'customer_name' => 'Trung tâm Y tế Long Mỹ',
        ])
            ->assertOk()
            ->assertJsonPath('data.customer_code', 'TTYT_VI_THUY')
            ->assertJsonPath('data.customer_code_auto_generated', true);

        $this->putJson('/api/v5/customers/91', [
            'customer_name' => 'Trung tâm Y tế Long Mỹ',
            'customer_code' => '',
        ])
            ->assertOk()
            ->assertJsonPath('data.customer_code', 'TTYT_LONG_MY')
            ->assertJsonPath('data.customer_code_auto_generated', true);

        $this->putJson('/api/v5/customers/91', [
            'customer_code' => 'MA_NHAP_TAY',
        ])
            ->assertOk()
            ->assertJsonPath('data.customer_code', 'MA_NHAP_TAY')
            ->assertJsonPath('data.customer_code_auto_generated', false);

        $this->assertSame('MA_NHAP_TAY', DB::table('customers')->where('id', 91)->value('customer_code'));
        $this->assertFalse((bool) DB::table('customers')->where('id', 91)->value('customer_code_auto_generated'));
    }

    public function test_it_assigns_random_bed_capacity_for_healthcare_customers_that_support_it(): void
    {
        $medicalCenterResponse = $this->postJson('/api/v5/customers', [
            'customer_name' => 'Trung tâm Y tế Vị Thủy',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'MEDICAL_CENTER',
        ])->assertCreated();

        $medicalCenterBedCapacity = data_get($medicalCenterResponse->json(), 'data.bed_capacity');
        $this->assertIsInt($medicalCenterBedCapacity);
        $this->assertGreaterThanOrEqual(100, $medicalCenterBedCapacity);
        $this->assertLessThanOrEqual(500, $medicalCenterBedCapacity);

        $hospitalResponse = $this->postJson('/api/v5/customers', [
            'customer_name' => 'Bệnh viện Đa khoa Thành phố',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'PUBLIC_HOSPITAL',
        ])->assertCreated();

        $hospitalBedCapacity = data_get($hospitalResponse->json(), 'data.bed_capacity');
        $this->assertIsInt($hospitalBedCapacity);
        $this->assertGreaterThanOrEqual(100, $hospitalBedCapacity);
        $this->assertLessThanOrEqual(500, $hospitalBedCapacity);

        $this->postJson('/api/v5/customers', [
            'customer_name' => 'Trạm Y tế Phường I',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'TYT_PKDK',
        ])
            ->assertCreated()
            ->assertJsonPath('data.bed_capacity', null);

        $this->postJson('/api/v5/customers', [
            'customer_name' => 'Trung tâm Y tế Long Mỹ',
            'customer_sector' => 'HEALTHCARE',
            'healthcare_facility_type' => 'MEDICAL_CENTER',
            'bed_capacity' => 88,
        ])
            ->assertCreated()
            ->assertJsonPath('data.bed_capacity', 88);
    }

    public function test_it_filters_healthcare_customers_using_same_inference_as_the_ui(): void
    {
        DB::table('customers')->insert([
            [
                'id' => 201,
                'uuid' => 'customer-201',
                'customer_code' => 'KH201',
                'customer_name' => 'Bệnh viện Đa khoa Vị Thủy',
                'company_name' => 'Bệnh viện Đa khoa Vị Thủy',
                'customer_sector' => 'HEALTHCARE',
                'created_by' => 99,
                'updated_by' => 99,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 202,
                'uuid' => 'customer-202',
                'customer_code' => 'KH202',
                'customer_name' => 'Trung tâm Y tế Long Mỹ',
                'company_name' => 'Trung tâm Y tế Long Mỹ',
                'customer_sector' => null,
                'created_by' => 99,
                'updated_by' => 99,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 203,
                'uuid' => 'customer-203',
                'customer_code' => 'KH203',
                'customer_name' => 'Trạm y tế Phường I',
                'company_name' => 'Trạm y tế Phường I',
                'customer_sector' => 'OTHER',
                'created_by' => 99,
                'updated_by' => 99,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 204,
                'uuid' => 'customer-204',
                'customer_code' => 'KH204',
                'customer_name' => 'UBND Phường Vị Thanh',
                'company_name' => 'UBND Phường Vị Thanh',
                'customer_sector' => 'GOVERNMENT',
                'created_by' => 99,
                'updated_by' => 99,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 205,
                'uuid' => 'customer-205',
                'customer_code' => 'KH205',
                'customer_name' => 'Công ty ABC',
                'company_name' => 'Công ty ABC',
                'customer_sector' => 'OTHER',
                'created_by' => 99,
                'updated_by' => 99,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->actingAsInternalUser(99);

        $response = $this->getJson('/api/v5/customers?customer_sector=HEALTHCARE');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
        $response->assertJsonPath('meta.kpis.healthcare_customers', 3);
        $response->assertJsonMissing(['customer_code' => 'KH204']);
        $response->assertJsonMissing(['customer_code' => 'KH205']);
        $response->assertJsonFragment(['customer_code' => 'KH201']);
        $response->assertJsonFragment(['customer_code' => 'KH202']);
        $response->assertJsonFragment(['customer_code' => 'KH203']);
    }

    public function test_it_filters_customers_by_healthcare_facility_type_using_the_same_breakdown_logic(): void
    {
        DB::table('customers')->insert([
            [
                'id' => 211,
                'uuid' => 'customer-211',
                'customer_code' => 'KH211',
                'customer_name' => 'Bệnh viện Đa khoa Vị Thủy',
                'company_name' => 'Bệnh viện Đa khoa Vị Thủy',
                'customer_sector' => 'HEALTHCARE',
                'created_by' => 99,
                'updated_by' => 99,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 212,
                'uuid' => 'customer-212',
                'customer_code' => 'KH212',
                'customer_name' => 'Trung tâm Y tế Long Mỹ',
                'company_name' => 'Trung tâm Y tế Long Mỹ',
                'customer_sector' => null,
                'created_by' => 99,
                'updated_by' => 99,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 213,
                'uuid' => 'customer-213',
                'customer_code' => 'KH213',
                'customer_name' => 'Trạm Y tế Phường I',
                'company_name' => 'Trạm Y tế Phường I',
                'customer_sector' => 'OTHER',
                'created_by' => 99,
                'updated_by' => 99,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 214,
                'uuid' => 'customer-214',
                'customer_code' => 'KH214',
                'customer_name' => 'Trung tâm Y tế Hành chính',
                'company_name' => 'Trung tâm Y tế Hành chính',
                'customer_sector' => 'GOVERNMENT',
                'created_by' => 99,
                'updated_by' => 99,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->actingAsInternalUser(99);

        $response = $this->getJson('/api/v5/customers?healthcare_facility_type=MEDICAL_CENTER');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('meta.kpis.healthcare_customers', 1);
        $response->assertJsonFragment(['customer_code' => 'KH212']);
        $response->assertJsonMissing(['customer_code' => 'KH211']);
        $response->assertJsonMissing(['customer_code' => 'KH213']);
        $response->assertJsonMissing(['customer_code' => 'KH214']);
    }

    public function test_it_forbids_updating_customer_outside_department_scope_when_user_is_not_creator(): void
    {
        DB::table('customers')->insert([
            'id' => 301,
            'uuid' => 'customer-301',
            'customer_code' => 'KH301',
            'customer_name' => 'Khách hàng ngoài phạm vi',
            'created_by' => 777,
            'updated_by' => 777,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('contracts')->insert([
            'id' => 401,
            'customer_id' => 301,
            'dept_id' => 2,
            'contract_name' => 'Hợp đồng dept 2',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 501,
            'customer_id' => 301,
            'dept_id' => 2,
            'project_name' => 'Dự án dept 2',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAsInternalUser(99);

        $this->putJson('/api/v5/customers/301', [
            'customer_name' => 'Bị chặn',
        ])->assertForbidden();
    }

    private function actingAsInternalUser(int $id): void
    {
        DB::table('internal_users')->updateOrInsert(
            ['id' => $id],
            [
                'username' => 'test-user-'.$id,
                'full_name' => 'Test User '.$id,
                'department_id' => 1,
            ]
        );

        $user = new InternalUser();
        $user->forceFill([
            'id' => $id,
            'username' => 'test-user-'.$id,
            'full_name' => 'Test User '.$id,
        ]);
        $user->exists = true;

        $this->actingAs($user);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('username', 255)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('uuid', 100)->nullable();
            $table->string('customer_code', 100)->nullable();
            $table->boolean('customer_code_auto_generated')->default(false);
            $table->string('customer_name', 255)->nullable();
            $table->string('company_name', 255)->nullable();
            $table->string('tax_code', 100)->nullable();
            $table->text('address')->nullable();
            $table->string('customer_sector', 30)->nullable();
            $table->string('healthcare_facility_type', 50)->nullable();
            $table->unsignedInteger('bed_capacity')->nullable();
            $table->string('data_scope', 255)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->string('project_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->string('contract_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });
    }
}
