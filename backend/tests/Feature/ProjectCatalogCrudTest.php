<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use App\Services\V5\Domain\ProjectDomainService;
use App\Support\Auth\UserAccessService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProjectCatalogCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_creates_lists_and_updates_project_types_via_api(): void
    {
        $createResponse = $this->postJson('/api/v5/project-types', [
            'type_code' => 'THI_DIEM',
            'type_name' => 'Thi diem',
            'sort_order' => 5,
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.id', 1)
            ->assertJsonPath('data.type_code', 'THI_DIEM')
            ->assertJsonPath('data.type_name', 'Thi diem')
            ->assertJsonPath('data.used_in_projects', 0)
            ->assertJsonPath('data.is_code_editable', true);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'THI_DIEM',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $updateResponse = $this->putJson('/api/v5/project-types/1', [
            'type_name' => 'Thi diem moi',
            'is_active' => false,
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.type_code', 'THI_DIEM')
            ->assertJsonPath('data.type_name', 'Thi diem moi')
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.used_in_projects', 1)
            ->assertJsonPath('data.is_code_editable', false);

        $listResponse = $this->getJson('/api/v5/project-types?include_inactive=1');

        $listResponse->assertOk();

        /** @var Collection<int, array<string, mixed>> $rows */
        $rows = collect($listResponse->json('data'));
        $this->assertCount(4, $rows);

        $projectType = $rows->firstWhere('type_code', 'THI_DIEM');
        $this->assertIsArray($projectType);
        $this->assertSame('Thi diem moi', $projectType['type_name']);
        $this->assertFalse((bool) $projectType['is_active']);
        $this->assertSame(1, (int) $projectType['used_in_projects']);
    }

    public function test_it_lists_project_items_via_canonical_and_alias_routes(): void
    {
        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('products')->insert([
            'id' => 10,
            'product_code' => 'SP01',
            'product_name' => 'San pham cha A',
            'unit' => 'bo',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('product_packages')->insert([
            'id' => 101,
            'product_id' => 10,
            'package_code' => 'PKG01',
            'package_name' => 'Goi dich vu A',
            'unit' => 'goi',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_items')->insert([
            'id' => 1,
            'project_id' => 1,
            'product_id' => 10,
            'product_package_id' => 101,
            'quantity' => 2,
            'unit_price' => 3.5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $canonicalResponse = $this->getJson('/api/v5/project-items?search=PA-001');
        $canonicalResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.project_code', 'PA-001')
            ->assertJsonPath('data.0.product_package_id', 101)
            ->assertJsonPath('data.0.product_code', 'PKG01')
            ->assertJsonPath('data.0.display_name', 'PA-001 - Du an A | PKG01 - Goi dich vu A');

        $aliasResponse = $this->getJson('/api/v5/project_items?search=PKG01');
        $aliasResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.customer_name', 'Khach hang A')
            ->assertJsonPath('data.0.unit', 'goi')
            ->assertJsonPath('data.0.quantity', 2)
            ->assertJsonPath('data.0.unit_price', 3.5);
    }

    public function test_it_stores_project_items_with_product_package_id_and_keeps_parent_product_id(): void
    {
        $user = new InternalUser();
        $user->id = 1;
        $user->username = 'admin';
        $this->actingAs($user);

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('products')->insert([
            'id' => 10,
            'product_code' => 'SP01',
            'product_name' => 'San pham cha A',
            'unit' => 'bo',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('product_packages')->insert([
            'id' => 101,
            'product_id' => 10,
            'package_code' => 'PKG01',
            'package_name' => 'Goi dich vu A',
            'unit' => 'goi',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postJson('/api/v5/projects', [
            'project_code' => 'PA-NEW-01',
            'project_name' => 'Du an moi',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'sync_items' => true,
            'items' => [[
                'product_id' => 10,
                'product_package_id' => 101,
                'quantity' => 3,
                'unit_price' => 12.5,
            ]],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.project_code', 'PA-NEW-01')
            ->assertJsonPath('data.items.0.product_id', 10)
            ->assertJsonPath('data.items.0.product_package_id', 101)
            ->assertJsonPath('data.items.0.product_name', 'Goi dich vu A')
            ->assertJsonPath('data.items.0.unit', 'goi');

        $projectId = DB::table('projects')->where('project_code', 'PA-NEW-01')->value('id');
        $this->assertNotNull($projectId);

        $this->assertDatabaseHas('project_items', [
            'project_id' => $projectId,
            'product_id' => 10,
            'product_package_id' => 101,
        ]);
    }

    public function test_it_allows_duplicate_project_items_when_saving_a_project(): void
    {
        $user = new InternalUser();
        $user->id = 1;
        $user->username = 'admin';
        $this->actingAs($user);

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('products')->insert([
            'id' => 10,
            'product_code' => 'SP01',
            'product_name' => 'San pham cha A',
            'unit' => 'bo',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postJson('/api/v5/projects', [
            'project_code' => 'PA-DUP-01',
            'project_name' => 'Du an trung hang muc',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'sync_items' => true,
            'items' => [
                [
                    'product_id' => 10,
                    'quantity' => 1,
                    'unit_price' => 12.5,
                ],
                [
                    'product_id' => 10,
                    'quantity' => 2,
                    'unit_price' => 9.5,
                ],
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.project_code', 'PA-DUP-01');

        $projectId = DB::table('projects')->where('project_code', 'PA-DUP-01')->value('id');
        $this->assertNotNull($projectId);

        $this->assertSame(
            2,
            DB::table('project_items')
                ->where('project_id', $projectId)
                ->where('product_id', 10)
                ->count()
        );
    }

    public function test_it_lists_project_with_department_labels_when_departments_use_dept_columns(): void
    {
        $user = new InternalUser();
        $user->id = 1;
        $user->username = 'admin';
        $this->actingAs($user);
        $this->partialMock(UserAccessService::class, function ($mock): void {
            $mock->shouldReceive('resolveDepartmentIdsForUser')->andReturn([1]);
        });

        DB::table('departments')->insert([
            'id' => 1,
            'dept_code' => 'TTKDGP',
            'dept_name' => 'Trung tam Kinh doanh Giai phap',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'department_id' => 1,
            'investment_mode' => 'DAU_TU',
            'start_date' => '2026-04-15',
            'estimated_value' => 162186000,
            'created_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v5/projects?page=1&per_page=10&department_id=1&start_date_from=2026-01-01&start_date_to=2026-04-30');

        $response
            ->assertOk()
            ->assertJsonPath('data.0.project_code', 'PA-001')
            ->assertJsonPath('data.0.department_id', 1)
            ->assertJsonPath('data.0.department_code', 'TTKDGP')
            ->assertJsonPath('data.0.department_name', 'Trung tam Kinh doanh Giai phap')
            ->assertJsonPath('meta.kpis.total_estimated_value', 162186000);
    }

    public function test_it_caches_project_index_until_the_list_cache_is_flushed(): void
    {
        config(['vnpt.cache_enabled' => true]);
        $user = new InternalUser();
        $user->id = 1;
        $user->username = 'admin';
        $this->actingAs($user);
        $this->partialMock(UserAccessService::class, function ($mock): void {
            $mock->shouldReceive('resolveDepartmentIdsForUser')->andReturn(null);
        });

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $firstResponse = $this->getJson('/api/v5/projects?page=1&per_page=10');
        $firstResponse
            ->assertOk()
            ->assertJsonPath('data.0.project_name', 'Du an A');

        DB::table('projects')
            ->where('id', 1)
            ->update([
                'project_name' => 'Du an B',
                'updated_at' => now(),
            ]);

        $cachedResponse = $this->getJson('/api/v5/projects?page=1&per_page=10');
        $cachedResponse
            ->assertOk()
            ->assertJsonPath('data.0.project_name', 'Du an A');

        app(ProjectDomainService::class)->flushListCache();

        $refreshedResponse = $this->getJson('/api/v5/projects?page=1&per_page=10');
        $refreshedResponse
            ->assertOk()
            ->assertJsonPath('data.0.project_name', 'Du an B');
    }

    public function test_it_blocks_project_delete_when_related_records_exist(): void
    {
        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('contracts')->insert([
            'id' => 1,
            'contract_code' => 'HD-001',
            'project_id' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_procedures')->insert([
            'id' => 1,
            'project_id' => 1,
            'procedure_name' => 'Quy trinh A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('raci_assignments')->insert([
            'id' => 1,
            'entity_type' => 'project',
            'entity_id' => 1,
            'user_id' => 99,
            'raci_role' => 'R',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->deleteJson('/api/v5/projects/1');

        $response
            ->assertStatus(422)
            ->assertJsonPath('data.references.0.table', 'project_procedures')
            ->assertJsonPath('data.references.1.table', 'contracts')
            ->assertJsonPath('data.references.2.table', 'raci_assignments');

        $this->assertStringContainsString('quy trình dự án', (string) $response->json('message'));
        $this->assertStringContainsString('hợp đồng', (string) $response->json('message'));
        $this->assertStringContainsString('phân công RACI', (string) $response->json('message'));
        $this->assertDatabaseHas('projects', [
            'id' => 1,
            'deleted_at' => null,
        ]);
    }

    public function test_it_blocks_project_update_when_revenue_schedules_exist(): void
    {
        $user = new InternalUser();
        $user->id = 1;
        $user->username = 'admin';
        $this->actingAs($user);
        $this->partialMock(UserAccessService::class, function ($mock): void {
            $mock->shouldReceive('isAdmin')->andReturn(true);
        });

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_revenue_schedules')->insert([
            'id' => 1,
            'project_id' => 1,
            'cycle_number' => 1,
            'expected_date' => '2026-05-01',
            'expected_amount' => 1000000,
            'notes' => 'Ky 1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->putJson('/api/v5/projects/1', [
            'project_name' => 'Du an A cap nhat',
        ]);

        $response->assertStatus(422);

        $this->assertStringContainsString(
            'xóa phân kỳ doanh thu',
            (string) $response->json('message')
        );
        $this->assertSame(
            'Du an A',
            DB::table('projects')->where('id', 1)->value('project_name')
        );
    }

    public function test_it_allows_project_raci_update_when_revenue_schedules_exist(): void
    {
        $user = new InternalUser();
        $user->id = 1;
        $user->username = 'admin';
        $this->actingAs($user);
        $this->partialMock(UserAccessService::class, function ($mock): void {
            $mock->shouldReceive('isAdmin')->andReturn(true);
        });

        DB::table('internal_users')->insert([
            ['id' => 22, 'username' => 'user22', 'full_name' => 'User 22', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 23, 'username' => 'user23', 'full_name' => 'User 23', 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'start_date' => '2026-04-01',
            'expected_end_date' => '2026-12-31',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_revenue_schedules')->insert([
            'id' => 1,
            'project_id' => 1,
            'cycle_number' => 1,
            'expected_date' => '2026-05-01',
            'expected_amount' => 1000000,
            'notes' => 'Ky 1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('raci_assignments')->insert([
            'id' => 1,
            'entity_type' => 'project',
            'entity_id' => 1,
            'user_id' => 22,
            'raci_role' => 'R',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->putJson('/api/v5/projects/1', [
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'status' => 'CHUAN_BI',
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'start_date' => '2026-04-01',
            'expected_end_date' => '2026-12-31',
            'opportunity_score' => 0,
            'sync_raci' => true,
            'raci' => [[
                'user_id' => 23,
                'raci_role' => 'A',
                'assigned_date' => '2026-04-02',
            ]],
        ]);

        $response->assertOk();

        $this->assertDatabaseMissing('raci_assignments', [
            'entity_type' => 'project',
            'entity_id' => 1,
            'user_id' => 22,
        ]);
        $this->assertDatabaseHas('raci_assignments', [
            'entity_type' => 'project',
            'entity_id' => 1,
            'user_id' => 23,
            'raci_role' => 'A',
        ]);
    }

    public function test_it_keeps_only_the_last_accountable_when_project_raci_payload_contains_multiple_a_roles(): void
    {
        $user = new InternalUser();
        $user->id = 1;
        $user->username = 'admin';
        $this->actingAs($user);
        $this->partialMock(UserAccessService::class, function ($mock): void {
            $mock->shouldReceive('isAdmin')->andReturn(true);
        });

        DB::table('internal_users')->insert([
            ['id' => 22, 'username' => 'user22', 'full_name' => 'User 22', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 23, 'username' => 'user23', 'full_name' => 'User 23', 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'start_date' => '2026-04-01',
            'expected_end_date' => '2026-12-31',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->putJson('/api/v5/projects/1', [
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'status' => 'CHUAN_BI',
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'start_date' => '2026-04-01',
            'expected_end_date' => '2026-12-31',
            'opportunity_score' => 0,
            'sync_raci' => true,
            'raci' => [
                [
                    'user_id' => 22,
                    'raci_role' => 'A',
                    'assigned_date' => '2026-04-02',
                ],
                [
                    'user_id' => 23,
                    'raci_role' => 'A',
                    'assigned_date' => '2026-04-03',
                ],
            ],
        ]);

        $response->assertOk();

        $this->assertSame(
            1,
            DB::table('raci_assignments')
                ->where('entity_type', 'project')
                ->where('entity_id', 1)
                ->where('raci_role', 'A')
                ->count()
        );
        $this->assertDatabaseHas('raci_assignments', [
            'entity_type' => 'project',
            'entity_id' => 1,
            'user_id' => 22,
            'raci_role' => 'R',
        ]);
        $this->assertDatabaseHas('raci_assignments', [
            'entity_type' => 'project',
            'entity_id' => 1,
            'user_id' => 23,
            'raci_role' => 'A',
        ]);
    }

    public function test_it_drops_the_old_accountable_row_when_demotion_would_duplicate_an_existing_r_role(): void
    {
        $user = new InternalUser();
        $user->id = 1;
        $user->username = 'admin';
        $this->actingAs($user);
        $this->partialMock(UserAccessService::class, function ($mock): void {
            $mock->shouldReceive('isAdmin')->andReturn(true);
        });

        DB::table('internal_users')->insert([
            ['id' => 22, 'username' => 'user22', 'full_name' => 'User 22', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 23, 'username' => 'user23', 'full_name' => 'User 23', 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'start_date' => '2026-04-01',
            'expected_end_date' => '2026-12-31',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->putJson('/api/v5/projects/1', [
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'status' => 'CHUAN_BI',
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'start_date' => '2026-04-01',
            'expected_end_date' => '2026-12-31',
            'opportunity_score' => 0,
            'sync_raci' => true,
            'raci' => [
                [
                    'user_id' => 22,
                    'raci_role' => 'A',
                    'assigned_date' => '2026-04-02',
                ],
                [
                    'user_id' => 22,
                    'raci_role' => 'R',
                    'assigned_date' => '2026-04-02',
                ],
                [
                    'user_id' => 23,
                    'raci_role' => 'A',
                    'assigned_date' => '2026-04-03',
                ],
            ],
        ]);

        $response->assertOk();

        $this->assertSame(
            2,
            DB::table('raci_assignments')
                ->where('entity_type', 'project')
                ->where('entity_id', 1)
                ->count()
        );
        $this->assertSame(
            1,
            DB::table('raci_assignments')
                ->where('entity_type', 'project')
                ->where('entity_id', 1)
                ->where('user_id', 22)
                ->where('raci_role', 'R')
                ->count()
        );
        $this->assertDatabaseHas('raci_assignments', [
            'entity_type' => 'project',
            'entity_id' => 1,
            'user_id' => 23,
            'raci_role' => 'A',
        ]);
    }

    public function test_it_blocks_removing_project_team_member_when_references_still_exist(): void
    {
        $user = new InternalUser();
        $user->id = 1;
        $user->username = 'admin';
        $this->actingAs($user);
        $this->partialMock(UserAccessService::class, function ($mock): void {
            $mock->shouldReceive('isAdmin')->andReturn(true);
        });

        DB::table('internal_users')->insert([
            'id' => 22,
            'username' => 'user22',
            'full_name' => 'User 22',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('raci_assignments')->insert([
            'id' => 1,
            'entity_type' => 'project',
            'entity_id' => 1,
            'user_id' => 22,
            'raci_role' => 'R',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_procedures')->insert([
            'id' => 10,
            'project_id' => 1,
            'procedure_name' => 'Quy trinh A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_procedure_steps')->insert([
            'id' => 100,
            'procedure_id' => 10,
            'step_name' => 'Buoc 1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_procedure_raci')->insert([
            'id' => 1000,
            'procedure_id' => 10,
            'user_id' => 22,
            'raci_role' => 'A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_procedure_step_raci')->insert([
            'id' => 1001,
            'step_id' => 100,
            'user_id' => 22,
            'raci_role' => 'R',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('customer_request_cases')->insert([
            'id' => 2000,
            'request_code' => 'CRC-001',
            'project_id' => 1,
            'performer_user_id' => 22,
            'summary' => 'Case A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->putJson('/api/v5/projects/1', [
            'sync_raci' => true,
            'raci' => [],
        ]);

        $response->assertStatus(422);

        $message = (string) data_get($response->json(), 'errors.raci.0', '');
        $this->assertStringContainsString('phân công RACI thủ tục dự án', $message);
        $this->assertStringContainsString('phân công RACI bước thủ tục', $message);
        $this->assertStringContainsString('yêu cầu khách hàng', $message);

        $this->assertDatabaseHas('raci_assignments', [
            'entity_type' => 'project',
            'entity_id' => 1,
            'user_id' => 22,
            'raci_role' => 'R',
        ]);
    }

    public function test_it_syncs_project_revenue_schedules_while_preserving_creator_metadata(): void
    {
        $user = new InternalUser();
        $user->id = 1;
        $user->username = 'admin';
        $this->actingAs($user);

        DB::table('internal_users')->insert([
            'id' => 1,
            'username' => 'admin',
            'full_name' => 'Admin Revenue',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'estimated_value' => 15000000,
            'payment_cycle' => 'QUARTERLY',
            'start_date' => '2026-04-01',
            'expected_end_date' => '2026-06-30',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_revenue_schedules')->insert([
            [
                'id' => 1,
                'project_id' => 1,
                'cycle_number' => 1,
                'expected_date' => '2026-04-15',
                'expected_amount' => 7000000,
                'notes' => 'Ky 1',
                'created_by' => 1,
                'updated_by' => 1,
                'created_at' => '2026-04-01 08:00:00',
                'updated_at' => '2026-04-01 08:00:00',
            ],
            [
                'id' => 2,
                'project_id' => 1,
                'cycle_number' => 2,
                'expected_date' => '2026-05-15',
                'expected_amount' => 8000000,
                'notes' => 'Ky 2',
                'created_by' => 1,
                'updated_by' => 1,
                'created_at' => '2026-04-01 08:05:00',
                'updated_at' => '2026-04-01 08:05:00',
            ],
        ]);

        $response = $this->postJson('/api/v5/projects/1/revenue-schedules/sync', [
            'schedules' => [
                [
                    'id' => 1,
                    'expected_date' => '2026-04-20',
                    'expected_amount' => 9000000,
                    'notes' => 'Ky 1 sua',
                ],
                [
                    'id' => 2,
                    'expected_date' => '2026-06-15',
                    'expected_amount' => 6000000,
                    'notes' => 'Ky 2 sua',
                ],
            ],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.0.id', 1)
            ->assertJsonPath('data.0.expected_date', '2026-04-20')
            ->assertJsonPath('data.0.expected_amount', 9000000)
            ->assertJsonPath('data.0.created_by', 1)
            ->assertJsonPath('data.0.created_by_name', 'Admin Revenue')
            ->assertJsonPath('data.0.created_at', '2026-04-01 08:00:00');

        $this->assertDatabaseHas('project_revenue_schedules', [
            'id' => 1,
            'project_id' => 1,
            'cycle_number' => 1,
            'expected_date' => '2026-04-20',
            'expected_amount' => 9000000,
            'created_by' => 1,
        ]);
        $this->assertSame(
            2,
            DB::table('project_revenue_schedules')->where('project_id', 1)->count()
        );
    }

    public function test_it_allows_deleting_all_project_revenue_schedules_via_empty_sync_payload(): void
    {
        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'estimated_value' => 15000000,
            'payment_cycle' => 'QUARTERLY',
            'start_date' => '2026-04-01',
            'expected_end_date' => '2026-06-30',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_revenue_schedules')->insert([
            [
                'id' => 1,
                'project_id' => 1,
                'cycle_number' => 1,
                'expected_date' => '2026-04-15',
                'expected_amount' => 7000000,
                'notes' => 'Ky 1',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'project_id' => 1,
                'cycle_number' => 2,
                'expected_date' => '2026-05-15',
                'expected_amount' => 8000000,
                'notes' => 'Ky 2',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->postJson('/api/v5/projects/1/revenue-schedules/sync', [
            'schedules' => [],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data', []);

        $this->assertSame(
            0,
            DB::table('project_revenue_schedules')->where('project_id', 1)->count()
        );
    }

    public function test_it_rejects_project_revenue_schedule_sync_when_total_or_dates_are_invalid(): void
    {
        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'estimated_value' => 15000000,
            'payment_cycle' => 'QUARTERLY',
            'start_date' => '2026-04-01',
            'expected_end_date' => '2026-06-30',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postJson('/api/v5/projects/1/revenue-schedules/sync', [
            'schedules' => [
                [
                    'expected_date' => '2026-05-20',
                    'expected_amount' => 9000000,
                    'notes' => 'Ky 1',
                ],
                [
                    'expected_date' => '2026-05-10',
                    'expected_amount' => 4000000,
                    'notes' => 'Ky 2',
                ],
            ],
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(['schedules', 'schedules.1.expected_date']);

        $errors = $response->json('errors');
        $this->assertStringContainsString(
            'Tổng phân kỳ phải giữ nguyên',
            (string) ($errors['schedules'][0] ?? '')
        );
        $this->assertStringContainsString(
            'Ngày dự kiến kỳ 2 phải sau kỳ 1',
            (string) ($errors['schedules.1.expected_date'][0] ?? '')
        );
    }

    public function test_it_soft_deletes_project_when_no_related_records_exist(): void
    {
        $user = new InternalUser();
        $user->id = 1;
        $user->username = 'admin';
        $this->actingAs($user);
        $this->partialMock(UserAccessService::class, function ($mock): void {
            $mock->shouldReceive('isAdmin')->andReturn(true);
        });

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->deleteJson('/api/v5/projects/1');

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Project deleted.');

        $this->assertDatabaseMissing('projects', [
            'id' => 1,
            'deleted_at' => null,
        ]);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('project_revenue_schedules');
        Schema::dropIfExists('raci_assignments');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('project_procedures');
        Schema::dropIfExists('project_items');
        Schema::dropIfExists('product_packages');
        Schema::dropIfExists('products');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('project_types');

        Schema::create('project_types', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('type_code', 100);
            $table->string('type_name', 120);
            $table->string('description', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_code', 50)->nullable();
            $table->string('customer_name', 255)->nullable();
            $table->string('company_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 100)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_code', 100)->nullable();
            $table->string('project_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('investment_mode', 100)->nullable();
            $table->decimal('estimated_value', 15, 2)->nullable();
            $table->string('payment_cycle', 50)->nullable();
            $table->date('start_date')->nullable();
            $table->date('expected_end_date')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('username', 120)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('project_procedures', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('procedure_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('project_procedure_steps', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('procedure_id')->nullable();
            $table->string('step_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('project_procedure_raci', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('procedure_id');
            $table->unsignedBigInteger('user_id');
            $table->string('raci_role', 5);
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('project_procedure_step_raci', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('step_id');
            $table->unsignedBigInteger('user_id');
            $table->string('raci_role', 5);
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('contract_code', 100)->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('raci_assignments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('entity_type', 50);
            $table->unsignedBigInteger('entity_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('raci_role', 10)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('products', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('product_code', 100)->nullable();
            $table->string('product_name', 255)->nullable();
            $table->string('unit', 50)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('product_packages', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('package_code', 100)->nullable();
            $table->string('package_name', 255)->nullable();
            $table->string('unit', 50)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('project_items', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('product_package_id')->nullable();
            $table->decimal('quantity', 12, 2)->nullable();
            $table->decimal('unit_price', 12, 2)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('project_revenue_schedules', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id');
            $table->unsignedInteger('cycle_number')->default(1);
            $table->date('expected_date')->nullable();
            $table->decimal('expected_amount', 15, 2)->default(0);
            $table->string('notes', 500)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('customer_request_cases', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code', 50)->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('received_by_user_id')->nullable();
            $table->unsignedBigInteger('receiver_user_id')->nullable();
            $table->unsignedBigInteger('dispatcher_user_id')->nullable();
            $table->unsignedBigInteger('performer_user_id')->nullable();
            $table->unsignedBigInteger('estimated_by_user_id')->nullable();
            $table->string('summary', 500)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });
    }
}
