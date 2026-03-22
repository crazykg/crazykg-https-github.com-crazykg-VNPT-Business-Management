<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestCompatibilityLookupTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
    }

    public function test_reference_search_uses_customer_request_tables_and_keeps_primary_task_code(): void
    {
        $this->setUpCommonSchema();

        Schema::create('customer_requests', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code', 50)->nullable();
            $table->string('summary', 255)->nullable();
            $table->string('status', 50)->nullable();
            $table->date('requested_date')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('request_ref_tasks', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code', 50)->nullable();
            $table->string('task_code', 50)->nullable();
            $table->string('task_source', 50)->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamp('deleted_at')->nullable();
        });

        DB::table('projects')->insert([
            ['id' => 1, 'project_code' => 'PA-01', 'project_name' => 'Project A', 'customer_id' => 1, 'dept_id' => 10, 'deleted_at' => null],
            ['id' => 2, 'project_code' => 'PA-02', 'project_name' => 'Project B', 'customer_id' => 1, 'dept_id' => 20, 'deleted_at' => null],
        ]);

        DB::table('customer_requests')->insert([
            [
                'id' => 1,
                'request_code' => 'CR-001',
                'summary' => 'Khach hang bao loi',
                'status' => 'RESOLVED',
                'requested_date' => '2026-03-20',
                'project_id' => 1,
                'created_by' => 99,
                'deleted_at' => null,
            ],
            [
                'id' => 2,
                'request_code' => 'CR-002',
                'summary' => 'Ngoai pham vi',
                'status' => 'OPEN',
                'requested_date' => '2026-03-21',
                'project_id' => 2,
                'created_by' => 99,
                'deleted_at' => null,
            ],
        ]);

        DB::table('request_ref_tasks')->insert([
            [
                'id' => 1,
                'request_code' => 'CR-001',
                'task_code' => 'TASK-001',
                'task_source' => 'REFERENCE',
                'sort_order' => 1,
                'deleted_at' => null,
            ],
        ]);

        $this->actingAs(InternalUser::query()->findOrFail(1));

        $this->getJson('/api/v5/customer-requests/reference-search?q=CR-001')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 1)
            ->assertJsonPath('data.0.request_code', 'CR-001')
            ->assertJsonPath('data.0.task_code', 'TASK-001')
            ->assertJsonPath('data.0.ticket_code', 'TASK-001')
            ->assertJsonPath('data.0.status', 'COMPLETED');
    }

    public function test_reference_search_falls_back_to_support_request_tables_when_customer_request_table_is_absent(): void
    {
        $this->setUpCommonSchema();

        Schema::create('support_requests', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->string('request_code', 50)->nullable();
            $table->string('summary', 255)->nullable();
            $table->string('status', 50)->nullable();
            $table->date('requested_date')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('support_request_tasks', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('request_id')->nullable();
            $table->string('task_code', 50)->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamp('deleted_at')->nullable();
        });

        DB::table('support_requests')->insert([
            [
                'id' => 1,
                'dept_id' => 10,
                'request_code' => 'SR-001',
                'summary' => 'Yeu cau support',
                'status' => 'PENDING',
                'requested_date' => '2026-03-19',
                'created_by' => 99,
                'deleted_at' => null,
            ],
            [
                'id' => 2,
                'dept_id' => 20,
                'request_code' => 'SR-002',
                'summary' => 'An',
                'status' => 'OPEN',
                'requested_date' => '2026-03-19',
                'created_by' => 99,
                'deleted_at' => null,
            ],
        ]);

        DB::table('support_request_tasks')->insert([
            ['id' => 1, 'request_id' => 1, 'task_code' => 'CV-001', 'sort_order' => 1, 'deleted_at' => null],
            ['id' => 2, 'request_id' => 2, 'task_code' => 'CV-002', 'sort_order' => 1, 'deleted_at' => null],
        ]);

        $this->actingAs(InternalUser::query()->findOrFail(1));

        $this->getJson('/api/v5/customer-requests/reference-search?q=CV-001')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 1)
            ->assertJsonPath('data.0.request_code', 'SR-001')
            ->assertJsonPath('data.0.task_code', 'CV-001')
            ->assertJsonPath('data.0.ticket_code', 'CV-001')
            ->assertJsonPath('data.0.status', 'WAITING_CUSTOMER');
    }

    public function test_receivers_returns_project_raci_options_and_default_assignee(): void
    {
        $this->setUpCommonSchema();

        Schema::create('raci_assignments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('entity_type', 50);
            $table->unsignedBigInteger('entity_id');
            $table->unsignedBigInteger('user_id');
            $table->string('raci_role', 5);
        });

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'PA-01',
            'project_name' => 'Project A',
            'customer_id' => 1,
            'dept_id' => 10,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            ['id' => 2, 'user_code' => 'U002', 'username' => 'approver', 'full_name' => 'Nguoi A', 'department_id' => 10, 'status' => 'ACTIVE', 'password' => bcrypt('secret'), 'remember_token' => null, 'deleted_at' => null],
            ['id' => 3, 'user_code' => 'U003', 'username' => 'resolver', 'full_name' => 'Nguoi R', 'department_id' => 10, 'status' => 'ACTIVE', 'password' => bcrypt('secret'), 'remember_token' => null, 'deleted_at' => null],
        ]);

        DB::table('raci_assignments')->insert([
            ['id' => 1, 'entity_type' => 'project', 'entity_id' => 1, 'user_id' => 3, 'raci_role' => 'R'],
            ['id' => 2, 'entity_type' => 'project', 'entity_id' => 1, 'user_id' => 2, 'raci_role' => 'A'],
        ]);

        $this->actingAs(InternalUser::query()->findOrFail(1));

        $this->getJson('/api/v5/customer-requests/receivers?project_id=1')
            ->assertOk()
            ->assertJsonPath('data.project_id', 1)
            ->assertJsonPath('data.default_receiver_user_id', 2)
            ->assertJsonPath('data.options.0.user_id', 2)
            ->assertJsonPath('data.options.0.raci_role', 'A')
            ->assertJsonPath('data.options.0.is_default', true)
            ->assertJsonPath('data.options.1.user_id', 3)
            ->assertJsonPath('data.options.1.raci_role', 'R');
    }

    public function test_project_items_filters_by_raci_but_keeps_explicitly_included_item(): void
    {
        $this->setUpCommonSchema();

        Schema::create('raci_assignments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('entity_type', 50);
            $table->unsignedBigInteger('entity_id');
            $table->unsignedBigInteger('user_id');
            $table->string('raci_role', 5);
        });

        DB::table('projects')->insert([
            ['id' => 1, 'project_code' => 'PA-01', 'project_name' => 'Project A', 'customer_id' => 1, 'dept_id' => 10, 'deleted_at' => null],
            ['id' => 2, 'project_code' => 'PA-02', 'project_name' => 'Project B', 'customer_id' => 1, 'dept_id' => 20, 'deleted_at' => null],
        ]);

        DB::table('products')->insert([
            ['id' => 1, 'product_code' => 'SP-01', 'product_name' => 'San pham 1', 'unit' => 'bo', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'product_code' => 'SP-02', 'product_name' => 'San pham 2', 'unit' => 'cai', 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('project_items')->insert([
            ['id' => 1, 'project_id' => 1, 'product_id' => 1, 'quantity' => 2, 'unit_price' => 10, 'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null],
            ['id' => 2, 'project_id' => 2, 'product_id' => 2, 'quantity' => 1, 'unit_price' => 20, 'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null],
        ]);

        DB::table('raci_assignments')->insert([
            ['id' => 1, 'entity_type' => 'project', 'entity_id' => 1, 'user_id' => 1, 'raci_role' => 'R'],
        ]);

        $this->actingAs(InternalUser::query()->findOrFail(1));

        $this->getJson('/api/v5/customer-requests/project-items?include_project_item_id=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', 2)
            ->assertJsonPath('data.1.id', 1)
            ->assertJsonPath('data.0.project_code', 'PA-02')
            ->assertJsonPath('data.1.project_code', 'PA-01');
    }

    private function setUpCommonSchema(): void
    {
        foreach ([
            'request_ref_tasks',
            'customer_requests',
            'support_request_tasks',
            'support_requests',
            'raci_assignments',
            'project_items',
            'products',
            'projects',
            'customers',
            'user_dept_scopes',
            'roles',
            'user_roles',
            'internal_users',
            'departments',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('status', 50)->nullable();
            $table->string('password')->nullable();
            $table->rememberToken();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_code', 50)->nullable();
            $table->string('customer_name', 255)->nullable();
            $table->string('company_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_code', 100)->nullable();
            $table->string('project_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
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
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        DB::table('departments')->insert([
            ['id' => 10, 'dept_code' => 'P10', 'dept_name' => 'Phong 10', 'parent_id' => null, 'deleted_at' => null],
            ['id' => 20, 'dept_code' => 'P20', 'dept_name' => 'Phong 20', 'parent_id' => null, 'deleted_at' => null],
        ]);

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'C001',
            'customer_name' => 'Khach hang A',
            'company_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('internal_users')->insert([
            'id' => 1,
            'user_code' => 'U001',
            'username' => 'tester',
            'full_name' => 'Tester',
            'department_id' => 10,
            'status' => 'ACTIVE',
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);
    }
}
