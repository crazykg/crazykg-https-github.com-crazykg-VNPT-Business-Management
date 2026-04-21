<?php

namespace Tests\Feature;

use App\Services\V5\CacheService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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

    public function test_dashboard_filters_by_multiple_status_codes(): void
    {
        $newIntake = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'summary' => 'Dashboard case new intake',
            ],
        ]))->assertCreated();
        $newIntakeId = (int) $newIntake->json('data.request_case.id');

        $inProgress = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'summary' => 'Dashboard case in progress',
            ],
        ]))->assertCreated();
        $inProgressId = (int) $inProgress->json('data.request_case.id');

        $completed = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'summary' => 'Dashboard case completed',
            ],
        ]))->assertCreated();
        $completedId = (int) $completed->json('data.request_case.id');

        DB::table('customer_request_cases')->where('id', $newIntakeId)->update([
            'current_status_code' => 'new_intake',
            'updated_at' => '2026-04-22 09:00:00',
        ]);

        DB::table('customer_request_cases')->where('id', $inProgressId)->update([
            'current_status_code' => 'analysis',
            'updated_at' => '2026-04-22 09:01:00',
        ]);

        DB::table('customer_request_cases')->where('id', $completedId)->update([
            'current_status_code' => 'completed',
            'updated_at' => '2026-04-22 09:02:00',
        ]);

        $this->getJson('/api/v5/customer-request-cases/dashboard/overview?status_code[]=new_intake&status_code[]=analysis')
            ->assertOk()
            ->assertJsonPath('data.summary.total_cases', 2);
    }

    public function test_dashboard_overview_returns_operational_kpis_units_backlog_and_top_performers(): void
    {
        Schema::dropIfExists('departments');
        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255)->nullable();
        });

        try {
            DB::table('departments')->insert([
                ['id' => 10, 'dept_code' => 'SUPPORT', 'dept_name' => 'Trung tâm hỗ trợ'],
                ['id' => 11, 'dept_code' => 'DEV', 'dept_name' => 'Trung tâm lập trình'],
            ]);

            DB::table('internal_users')->insert([
                ['id' => 5, 'user_code' => 'U005', 'username' => 'developer', 'full_name' => 'Lập trình viên', 'department_id' => 11],
                ['id' => 6, 'user_code' => 'U006', 'username' => 'cancelled', 'full_name' => 'Người không thực hiện', 'department_id' => 11],
            ]);

            $supportActive = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
                'master_payload' => [
                    'summary' => 'Yêu cầu hỗ trợ đang thực hiện',
                ],
            ]))->assertCreated();
            $supportActiveId = (int) $supportActive->json('data.request_case.id');

            $supportWaiting = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
                'master_payload' => [
                    'summary' => 'Yêu cầu chờ khách hàng phản hồi',
                ],
            ]))->assertCreated();
            $supportWaitingId = (int) $supportWaiting->json('data.request_case.id');

            $supportSecondCustomer = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
                'master_payload' => [
                    'summary' => 'Yêu cầu hỗ trợ của khách hàng khác',
                ],
            ]))->assertCreated();
            $supportSecondCustomerId = (int) $supportSecondCustomer->json('data.request_case.id');

            $supportUnknownCustomer = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
                'master_payload' => [
                    'summary' => 'Yêu cầu hỗ trợ chưa xác định khách hàng',
                ],
            ]))->assertCreated();
            $supportUnknownCustomerId = (int) $supportUnknownCustomer->json('data.request_case.id');

            $programmingCompleted = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
                'master_payload' => [
                    'summary' => 'Yêu cầu lập trình đã hoàn thành',
                ],
            ]))->assertCreated();
            $programmingCompletedId = (int) $programmingCompleted->json('data.request_case.id');

            $notExecuted = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
                'master_payload' => [
                    'summary' => 'Yêu cầu không thực hiện',
                ],
            ]))->assertCreated();
            $notExecutedId = (int) $notExecuted->json('data.request_case.id');

            DB::table('customer_request_cases')->where('id', $supportActiveId)->update([
                'current_status_code' => 'in_progress',
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => '2026-04-01 08:00:00',
            ]);

            DB::table('customer_request_cases')->where('id', $supportWaitingId)->update([
                'current_status_code' => 'waiting_customer_feedback',
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => '2026-04-01 09:00:00',
            ]);

            DB::table('customer_request_cases')->where('id', $supportSecondCustomerId)->update([
                'customer_id' => 11,
                'current_status_code' => 'in_progress',
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => '2026-04-01 09:30:00',
            ]);

            DB::table('customer_request_cases')->where('id', $supportUnknownCustomerId)->update([
                'customer_id' => null,
                'current_status_code' => 'in_progress',
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => '2026-04-01 09:45:00',
            ]);

            DB::table('customer_request_cases')->where('id', $programmingCompletedId)->update([
                'customer_id' => 11,
                'current_status_code' => 'completed',
                'completed_at' => '2026-04-01 10:00:00',
                'dispatcher_user_id' => 2,
                'performer_user_id' => 5,
                'updated_at' => '2026-04-01 10:00:00',
            ]);

            DB::table('customer_request_cases')->where('id', $notExecutedId)->update([
                'current_status_code' => 'not_executed',
                'dispatcher_user_id' => 2,
                'performer_user_id' => 6,
                'updated_at' => '2026-04-01 11:00:00',
            ]);

            DB::table('customer_request_status_instances')->insert([
                'request_case_id' => $programmingCompletedId,
                'status_code' => 'coding',
                'status_table' => 'customer_request_coding',
                'is_current' => false,
                'entered_at' => '2026-04-01 09:30:00',
                'exited_at' => '2026-04-01 09:55:00',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $response = $this->getJson('/api/v5/customer-request-cases/dashboard/overview?updated_by=9&dashboard_test=operational')
                ->assertOk()
                ->assertJsonPath('data.summary.total_cases', 6)
                ->assertJsonPath('data.summary.operational.total_cases', 5)
                ->assertJsonPath('data.summary.operational.active_cases', 4)
                ->assertJsonPath('data.summary.operational.completed_cases', 1)
                ->assertJsonPath('data.summary.operational.waiting_customer_feedback_cases', 1)
                ->assertJsonPath('data.summary.operational.by_type.support.total_cases', 4)
                ->assertJsonPath('data.summary.operational.by_type.programming.total_cases', 1)
                ->assertJsonPath('data.top_backlog_units.0.customer_name', 'TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang')
                ->assertJsonPath('data.top_backlog_units.0.active_cases', 2)
                ->assertJsonPath('data.top_performers.0.department_name', 'Trung tâm hỗ trợ')
                ->assertJsonPath('data.top_performers.0.performer_name', 'Người xử lý')
                ->assertJsonPath('data.top_performers.0.count', 4)
                ->assertJsonFragment(['customer_name' => 'TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang'])
                ->assertJsonFragment(['customer_name' => 'Trung tâm Y tế khu vực Long Mỹ'])
                ->assertJsonFragment(['customer_name' => 'Chưa xác định khách hàng']);

            $operational = $response->json('data.summary.operational');
            $this->assertSame(
                $operational['total_cases'],
                $operational['active_cases'] + $operational['completed_cases']
            );
            $this->assertLessThanOrEqual(
                $operational['active_cases'],
                $operational['waiting_customer_feedback_cases']
            );
            $this->assertCount(3, $response->json('data.unit_chart'));
            $this->assertLessThanOrEqual(5, count($response->json('data.top_backlog_units')));
            $this->assertLessThanOrEqual(10, count($response->json('data.top_performers')));
        } finally {
            Schema::dropIfExists('departments');
        }
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
