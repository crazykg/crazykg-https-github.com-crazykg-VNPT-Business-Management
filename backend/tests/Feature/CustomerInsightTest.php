<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerInsightTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->seedBaseData();
    }

    public function test_it_returns_targeted_and_popular_upsell_candidates_with_backward_compat_references(): void
    {
        $response = $this->getJson('/api/v5/customers/1/insight');

        $response
            ->assertOk()
            ->assertJsonPath('data.customer.id', 1)
            ->assertJsonPath('data.upsell_candidates.0.product_id', 2)
            ->assertJsonPath('data.upsell_candidates.0.recommendation_type', 'targeted')
            ->assertJsonPath('data.upsell_candidates.0.segment_priority', 1)
            ->assertJsonPath('data.upsell_candidates.0.sales_notes', 'Exact public hospital note')
            ->assertJsonPath('data.upsell_candidates.0.similar_customers.0.customer_name', 'BV Da Khoa A')
            ->assertJsonPath('data.upsell_candidates.0.similar_customers.0.is_same_type', true)
            ->assertJsonPath('data.upsell_candidates.0.reference_customers.0', 'BV Da Khoa A');

        $upsellCandidates = data_get($response->json(), 'data.upsell_candidates', []);
        $popularCandidates = array_values(array_filter(
            $upsellCandidates,
            static fn (array $candidate): bool => ($candidate['recommendation_type'] ?? null) === 'popular'
        ));

        $this->assertNotEmpty($popularCandidates);
        $this->assertSame(3, $popularCandidates[0]['product_id']);
    }

    public function test_it_falls_back_to_popular_candidates_when_target_segment_table_is_missing(): void
    {
        Schema::drop('product_target_segments');

        $response = $this->getJson('/api/v5/customers/1/insight');
        $response->assertOk();

        $upsellCandidates = data_get($response->json(), 'data.upsell_candidates', []);
        $this->assertCount(3, $upsellCandidates);
        $this->assertSame(3, $upsellCandidates[0]['product_id']);
        $this->assertSame(2, $upsellCandidates[1]['product_id']);
        $this->assertSame(14, $upsellCandidates[2]['product_id']);
        $this->assertTrue(collect($upsellCandidates)->every(
            static fn (array $candidate): bool => (int) ($candidate['popularity'] ?? 0) > 0
        ));
        $this->assertSame(
            ['popular'],
            array_values(array_unique(array_map(
                static fn (array $candidate): string => (string) ($candidate['recommendation_type'] ?? ''),
                $upsellCandidates
            )))
        );
    }

    public function test_it_returns_upsell_product_detail_with_feature_groups_sector_customers_and_segment_match(): void
    {
        $response = $this->getJson('/api/v5/customers/1/insight/product-detail/2');

        $response
            ->assertOk()
            ->assertJsonPath('data.product.id', 2)
            ->assertJsonPath('data.feature_groups.0.group_name', 'Kham benh')
            ->assertJsonPath('data.feature_groups.0.features.0.feature_name', 'Dang ky kham')
            ->assertJsonPath('data.sector_customers.0.customer_name', 'BV Da Khoa A')
            ->assertJsonPath('data.sector_customers.0.contract_count', 1)
            ->assertJsonPath('data.segment_match.priority', 1)
            ->assertJsonPath('data.segment_match.sales_notes', 'Exact public hospital note');
    }

    public function test_it_prefers_non_bed_his_for_tyt_customer_without_bed_capacity(): void
    {
        $response = $this->getJson('/api/v5/customers/4/insight');

        $response
            ->assertOk()
            ->assertJsonPath('data.upsell_candidates.0.product_id', 15)
            ->assertJsonPath('data.upsell_candidates.0.product_code', 'VNPT_HIS_KG_01')
            ->assertJsonPath('data.upsell_candidates.0.recommendation_type', 'targeted')
            ->assertJsonPath('data.upsell_candidates.0.segment_priority', 1)
            ->assertJsonPath('data.upsell_candidates.0.sales_notes', 'HIS khong giuong cho TYT va PKDK');

        $productIds = array_map(
            static fn (array $candidate): int => (int) ($candidate['product_id'] ?? 0),
            data_get($response->json(), 'data.upsell_candidates', [])
        );

        $this->assertContains(15, $productIds);
        $this->assertNotContains(14, $productIds);
    }

    private function setUpSchema(): void
    {
        Schema::create('customers', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->nullable();
            $table->string('customer_code')->nullable();
            $table->string('customer_name');
            $table->string('tax_code')->nullable();
            $table->string('address')->nullable();
            $table->string('customer_sector', 30)->nullable();
            $table->string('healthcare_facility_type', 50)->nullable();
            $table->unsignedInteger('bed_capacity')->nullable();
            $table->softDeletes();
        });

        Schema::create('products', function (Blueprint $table): void {
            $table->id();
            $table->string('product_code');
            $table->string('product_name');
            $table->decimal('standard_price', 15, 2)->default(0);
            $table->string('unit', 50)->nullable();
            $table->string('service_group', 20)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('vendor_id')->nullable();
            $table->unsignedBigInteger('domain_id')->nullable();
            $table->softDeletes();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('customer_id');
            $table->string('status', 20)->default('SIGNED');
            $table->decimal('total_value', 15, 2)->default(0);
            $table->softDeletes();
        });

        Schema::create('contract_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('product_id');
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
        });

        Schema::create('product_target_segments', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('customer_sector', 50);
            $table->string('facility_type', 50)->nullable();
            $table->text('facility_types')->nullable();
            $table->unsignedInteger('bed_capacity_min')->nullable();
            $table->unsignedInteger('bed_capacity_max')->nullable();
            $table->unsignedTinyInteger('priority')->default(1);
            $table->text('sales_notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->softDeletes();
        });

        Schema::create('product_feature_groups', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('group_name');
            $table->unsignedInteger('display_order')->default(1);
            $table->softDeletes();
        });

        Schema::create('product_features', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('group_id');
            $table->string('feature_name');
            $table->text('detail_description')->nullable();
            $table->string('status', 20)->default('ACTIVE');
            $table->unsignedInteger('display_order')->default(1);
            $table->softDeletes();
        });
    }

    private function seedBaseData(): void
    {
        DB::table('customers')->insert([
            [
                'id' => 1,
                'uuid' => 'customer-1',
                'customer_code' => 'KH001',
                'customer_name' => 'BV Trung Tam',
                'tax_code' => '0101',
                'address' => 'HN',
                'customer_sector' => 'HEALTHCARE',
                'healthcare_facility_type' => 'PUBLIC_HOSPITAL',
                'bed_capacity' => 320,
            ],
            [
                'id' => 2,
                'uuid' => 'customer-2',
                'customer_code' => 'KH002',
                'customer_name' => 'BV Da Khoa A',
                'tax_code' => '0102',
                'address' => 'TH',
                'customer_sector' => 'HEALTHCARE',
                'healthcare_facility_type' => 'PUBLIC_HOSPITAL',
                'bed_capacity' => 280,
            ],
            [
                'id' => 3,
                'uuid' => 'customer-3',
                'customer_code' => 'KH003',
                'customer_name' => 'UBND Quan',
                'tax_code' => '0103',
                'address' => 'HN',
                'customer_sector' => 'GOVERNMENT',
                'healthcare_facility_type' => null,
                'bed_capacity' => null,
            ],
            [
                'id' => 4,
                'uuid' => 'customer-4',
                'customer_code' => 'KH004',
                'customer_name' => 'Tram Y Te Phuong III',
                'tax_code' => '0104',
                'address' => 'HG',
                'customer_sector' => null,
                'healthcare_facility_type' => null,
                'bed_capacity' => null,
            ],
        ]);

        $products = [
            [
                'id' => 1,
                'product_code' => 'CORE_PLATFORM',
                'product_name' => 'Core Platform',
                'standard_price' => 200000000,
                'unit' => 'nam',
                'service_group' => 'GROUP_A',
                'description' => 'San pham dang su dung',
                'is_active' => true,
                'vendor_id' => 1,
                'domain_id' => 1,
            ],
            [
                'id' => 2,
                'product_code' => 'HIS_PRO',
                'product_name' => 'HIS Pro',
                'standard_price' => 600000000,
                'unit' => 'nam',
                'service_group' => 'GROUP_A',
                'description' => 'Giai phap quan ly benh vien.',
                'is_active' => true,
                'vendor_id' => 1,
                'domain_id' => 1,
            ],
            [
                'id' => 3,
                'product_code' => 'CRM_BASIC',
                'product_name' => 'CRM Basic',
                'standard_price' => 120000000,
                'unit' => 'goi',
                'service_group' => 'GROUP_B',
                'description' => 'Giai phap pho bien.',
                'is_active' => true,
                'vendor_id' => 1,
                'domain_id' => 1,
            ],
            [
                'id' => 14,
                'product_code' => 'GOI_VNPT_HIS_01',
                'product_name' => 'Phan mem VNPT-HIS',
                'standard_price' => 1500000,
                'unit' => 'goi',
                'service_group' => 'GROUP_B',
                'description' => 'Den 10 giuong benh',
                'is_active' => true,
                'vendor_id' => 1,
                'domain_id' => 1,
            ],
            [
                'id' => 15,
                'product_code' => 'VNPT_HIS_KG_01',
                'product_name' => 'Phan mem VNPT-HIS khong giuong',
                'standard_price' => 600000,
                'unit' => 'thang',
                'service_group' => 'GROUP_B',
                'description' => 'So luong luot kham toi da thang < 1500',
                'is_active' => true,
                'vendor_id' => 1,
                'domain_id' => 1,
            ],
        ];

        for ($id = 4; $id <= 13; $id++) {
            $products[] = [
                'id' => $id,
                'product_code' => 'EXTRA_' . $id,
                'product_name' => 'Extra Product ' . $id,
                'standard_price' => 1000000 * $id,
                'unit' => 'goi',
                'service_group' => $id % 2 === 0 ? 'GROUP_B' : 'GROUP_C',
                'description' => 'Fallback product ' . $id,
                'is_active' => true,
                'vendor_id' => 1,
                'domain_id' => 1,
            ];
        }
        DB::table('products')->insert($products);

        DB::table('contracts')->insert([
            ['id' => 1, 'customer_id' => 1, 'status' => 'SIGNED', 'total_value' => 200000000],
            ['id' => 2, 'customer_id' => 2, 'status' => 'SIGNED', 'total_value' => 720000000],
            ['id' => 3, 'customer_id' => 3, 'status' => 'SIGNED', 'total_value' => 150000000],
        ]);

        DB::table('contract_items')->insert([
            ['contract_id' => 1, 'product_id' => 1, 'quantity' => 1, 'unit_price' => 200000000],
            ['contract_id' => 2, 'product_id' => 2, 'quantity' => 1, 'unit_price' => 600000000],
            ['contract_id' => 2, 'product_id' => 3, 'quantity' => 1, 'unit_price' => 120000000],
            ['contract_id' => 2, 'product_id' => 14, 'quantity' => 1, 'unit_price' => 1500000],
            ['contract_id' => 3, 'product_id' => 3, 'quantity' => 1, 'unit_price' => 150000000],
        ]);

        DB::table('product_target_segments')->insert([
            [
                'id' => 1,
                'product_id' => 2,
                'customer_sector' => 'HEALTHCARE',
                'facility_type' => null,
                'facility_types' => null,
                'bed_capacity_min' => 100,
                'bed_capacity_max' => null,
                'priority' => 1,
                'sales_notes' => 'Wildcard note',
                'is_active' => true,
            ],
            [
                'id' => 2,
                'product_id' => 2,
                'customer_sector' => 'HEALTHCARE',
                'facility_type' => null,
                'facility_types' => json_encode(['PUBLIC_HOSPITAL', 'MEDICAL_CENTER'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'bed_capacity_min' => 200,
                'bed_capacity_max' => null,
                'priority' => 1,
                'sales_notes' => 'Exact public hospital note',
                'is_active' => true,
            ],
            [
                'id' => 3,
                'product_id' => 15,
                'customer_sector' => 'HEALTHCARE',
                'facility_type' => 'TYT_PKDK',
                'facility_types' => null,
                'bed_capacity_min' => null,
                'bed_capacity_max' => null,
                'priority' => 1,
                'sales_notes' => 'HIS khong giuong cho TYT va PKDK',
                'is_active' => true,
            ],
        ]);

        DB::table('product_feature_groups')->insert([
            [
                'id' => 1,
                'product_id' => 2,
                'group_name' => 'Kham benh',
                'display_order' => 1,
            ],
        ]);

        DB::table('product_features')->insert([
            [
                'id' => 1,
                'product_id' => 2,
                'group_id' => 1,
                'feature_name' => 'Dang ky kham',
                'detail_description' => 'Tiep nhan benh nhan',
                'status' => 'ACTIVE',
                'display_order' => 1,
            ],
        ]);
    }
}
