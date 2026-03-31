<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\InteractsWithCustomerRequestCaseFixtures;
use Tests\TestCase;

class CustomerRequestCaseMutationScopeTest extends TestCase
{
    use InteractsWithCustomerRequestCaseFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpCustomerRequestCaseSchema();
    }

    public function test_store_rejects_case_creation_outside_project_department_scope(): void
    {
        $this->postJson('/api/v5/customer-request-cases', $this->outsideDepartmentPayload())
            ->assertStatus(403)
            ->assertJsonPath('message', 'Bạn không có quyền tạo yêu cầu cho dự án này.');
    }

    public function test_status_and_estimate_mutations_reject_assigned_user_outside_project_department_scope(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->outsideDepartmentPayload([
            'created_by' => 9,
            'updated_by' => 9,
        ]))->assertCreated();
        $caseId = (int) $created->json('data.request_case.id');

        DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => now(),
            ]);

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/statuses/analysis", [
            'updated_by' => 2,
        ])
            ->assertStatus(403)
            ->assertJsonPath('message', 'Bạn không có quyền thao tác yêu cầu này.');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/estimates", [
            'updated_by' => 2,
            'estimated_hours' => 8,
            'estimate_scope' => 'total',
            'estimate_type' => 'manual',
            'note' => 'Estimate ngoài phạm vi phòng ban.',
        ])
            ->assertStatus(403)
            ->assertJsonPath('message', 'Bạn không có quyền cập nhật estimate cho yêu cầu này.');
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function outsideDepartmentPayload(array $overrides = []): array
    {
        return $this->createPayload(array_replace_recursive([
            'master_payload' => [
                'customer_id' => 11,
                'customer_personnel_id' => 21,
                'support_service_group_id' => 31,
                'project_id' => 201,
                'project_item_id' => 101,
                'summary' => 'Theo dõi cảnh báo NOC ngoài phạm vi',
                'description' => 'Kiểm tra chặn mutation ngoài dept scope cho CRC.',
            ],
        ], $overrides));
    }
}
