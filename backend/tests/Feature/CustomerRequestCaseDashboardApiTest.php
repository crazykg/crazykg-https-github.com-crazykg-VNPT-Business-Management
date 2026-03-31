<?php

namespace Tests\Feature;

use App\Services\V5\CacheService;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\Feature\Concerns\InteractsWithCustomerRequestCaseFixtures;
use Tests\TestCase;

class CustomerRequestCaseDashboardApiTest extends TestCase
{
    use InteractsWithCustomerRequestCaseFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpCustomerRequestCaseSchema();
    }

    public function test_dashboard_endpoints_return_role_summary_attention_lists_and_top_entities(): void
    {
        DB::table('customers')->updateOrInsert(
            ['id' => 11],
            ['customer_name' => 'Bệnh viện Số 2']
        );

        DB::table('customer_personnel')->updateOrInsert(
            ['id' => 21],
            [
                'full_name' => 'Trần Thị B',
                'customer_id' => 11,
            ]
        );

        DB::table('support_service_groups')->updateOrInsert(
            ['id' => 31],
            [
                'group_name' => 'Nhóm NOC 02',
                'customer_id' => 11,
            ]
        );

        DB::table('projects')->updateOrInsert(
            ['id' => 201],
            [
                'project_name' => 'Dự án NOC',
                'dept_id' => 10,
            ]
        );

        DB::table('project_items')->updateOrInsert(
            ['id' => 101],
            [
                'project_id' => 201,
                'product_id' => 300,
                'customer_id' => 11,
                'display_name' => 'NOC Item',
            ]
        );

        $first = $this->postJson('/api/v5/customer-request-cases', $this->createPayload())->assertCreated();
        $firstCaseId = (int) $first->json('data.request_case.id');

        $second = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'customer_id' => 11,
                'customer_personnel_id' => 21,
                'support_service_group_id' => 31,
                'project_id' => 201,
                'project_item_id' => 101,
                'summary' => 'Theo dõi cảnh báo NOC',
                'description' => 'Khách hàng cần theo dõi thêm dashboard vận hành.',
            ],
        ]))->assertCreated();
        $secondCaseId = (int) $second->json('data.request_case.id');

        DB::table('customer_request_cases')
            ->where('id', $firstCaseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => '2026-03-21 09:00:00',
            ]);

        DB::table('customer_request_cases')
            ->where('id', $secondCaseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => '2026-03-21 10:00:00',
            ]);

        $this->postJson("/api/v5/customer-request-cases/{$firstCaseId}/estimates", [
            'updated_by' => 2,
            'estimated_hours' => 6,
            'estimate_scope' => 'total',
            'estimate_type' => 'manual',
            'note' => 'Estimate cho case đầu tiên.',
        ])->assertCreated();

        $this->postJson("/api/v5/customer-request-cases/{$firstCaseId}/worklogs", [
            'updated_by' => 3,
            'performed_by_user_id' => 3,
            'work_content' => 'Phân tích và xử lý cảnh báo SOC.',
            'work_date' => '2026-03-20',
            'hours_spent' => 2.5,
            'activity_type_code' => 'analysis',
            'is_billable' => true,
        ])->assertCreated();

        $this->getJson('/api/v5/customer-request-cases/dashboard/creator?updated_by=1')
            ->assertOk()
            ->assertJsonPath('data.role', 'creator')
            ->assertJsonPath('data.summary.total_cases', 2)
            ->assertJsonPath('data.attention_cases.0.request_case.id', $secondCaseId);

        $this->getJson('/api/v5/customer-request-cases/dashboard/dispatcher?updated_by=2')
            ->assertOk()
            ->assertJsonPath('data.role', 'dispatcher')
            ->assertJsonPath('data.summary.total_cases', 2)
            ->assertJsonPath('data.summary.alert_counts.missing_estimate', 1);

        $this->getJson('/api/v5/customer-request-cases/dashboard/performer?updated_by=3')
            ->assertOk()
            ->assertJsonPath('data.role', 'performer')
            ->assertJsonPath('data.summary.total_cases', 2)
            ->assertJsonPath('data.top_customers.0.customer_name', 'TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang');

        $this->getJson('/api/v5/customer-request-cases/dashboard/overview?updated_by=9')
            ->assertOk()
            ->assertJsonPath('data.role', 'overview')
            ->assertJsonPath('data.summary.total_cases', 2)
            ->assertJsonCount(2, 'data.top_projects')
            ->assertJsonPath('data.top_projects.0.project_name', 'Dự án SOC')
            ->assertJsonFragment(['project_name' => 'Dự án NOC'])
            ->assertJsonPath('data.top_customers.0.customer_name', 'TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang')
            ->assertJsonFragment(['customer_name' => 'Bệnh viện Số 2']);
    }

    public function test_dashboard_overview_uses_cache_service_standardized_tag(): void
    {
        $this->postJson('/api/v5/customer-request-cases', $this->createPayload())->assertCreated();

        $cache = Mockery::mock(CacheService::class);
        $cache->shouldReceive('rememberTagged')
            ->once()
            ->with(
                ['customer-request-cases'],
                Mockery::type('string'),
                120,
                Mockery::type(\Closure::class)
            )
            ->andReturnUsing(fn (array $tags, string $key, int $ttl, \Closure $callback) => $callback());
        $this->app->instance(CacheService::class, $cache);

        $this->getJson('/api/v5/customer-request-cases/dashboard/overview?updated_by=1')
            ->assertOk()
            ->assertJsonPath('data.role', 'overview')
            ->assertJsonPath('data.summary.total_cases', 1);
    }
}
