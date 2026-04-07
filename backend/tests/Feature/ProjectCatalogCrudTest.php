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
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('products')->insert([
            'id' => 1,
            'product_code' => 'SP01',
            'product_name' => 'San pham A',
            'unit' => 'bo',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_items')->insert([
            'id' => 1,
            'project_id' => 1,
            'product_id' => 1,
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
            ->assertJsonPath('data.0.product_code', 'SP01')
            ->assertJsonPath('data.0.display_name', 'PA-001 - Du an A | SP01 - San pham A');

        $aliasResponse = $this->getJson('/api/v5/project_items?search=SP01');
        $aliasResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.customer_name', 'Khach hang A')
            ->assertJsonPath('data.0.unit', 'bo')
            ->assertJsonPath('data.0.quantity', 2)
            ->assertJsonPath('data.0.unit_price', 3.5);
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
        Schema::dropIfExists('raci_assignments');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('project_procedures');
        Schema::dropIfExists('project_items');
        Schema::dropIfExists('products');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
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

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_code', 100)->nullable();
            $table->string('project_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('investment_mode', 100)->nullable();
            $table->timestamp('deleted_at')->nullable();
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

        Schema::create('project_items', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->decimal('quantity', 12, 2)->nullable();
            $table->decimal('unit_price', 12, 2)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });
    }
}
