<?php

namespace Tests\Feature;

use App\Models\Contract;
use App\Models\Customer;
use App\Models\CustomerRequestCase;
use App\Models\InternalUser;
use App\Models\Invoice;
use App\Models\Project;
use App\Policies\ContractPolicy;
use App\Policies\CustomerPolicy;
use App\Policies\CustomerRequestCasePolicy;
use App\Policies\InvoicePolicy;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuthorizationPolicyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
        $this->seedAuthorizationFixtures();
    }

    public function test_policies_are_auto_discovered_for_upgrade_targets(): void
    {
        $this->assertInstanceOf(CustomerPolicy::class, Gate::getPolicyFor(Customer::class));
        $this->assertInstanceOf(InvoicePolicy::class, Gate::getPolicyFor(Invoice::class));
        $this->assertInstanceOf(ContractPolicy::class, Gate::getPolicyFor(Contract::class));
        $this->assertInstanceOf(CustomerRequestCasePolicy::class, Gate::getPolicyFor(CustomerRequestCase::class));
    }

    /**
     * InvoicePolicy guards WHO can access (permission + dept scope).
     * Terminal-status restrictions (e.g. PAID cannot be mutated) are a business rule
     * enforced by InvoiceDomainService → returns 422, not 403.
     */
    public function test_invoice_policy_checks_permission_and_department_scope(): void
    {
        $staff = InternalUser::query()->findOrFail(2);
        $outsider = InternalUser::query()->findOrFail(3);
        $admin = InternalUser::query()->findOrFail(1);
        $invoice = Invoice::query()->findOrFail(100);
        $paidInvoice = Invoice::query()->findOrFail(101);

        // Authorized staff can view, update, delete their dept's invoices
        $this->assertTrue(Gate::forUser($staff)->allows('view', $invoice));
        $this->assertTrue(Gate::forUser($staff)->allows('update', $invoice));
        $this->assertTrue(Gate::forUser($admin)->allows('delete', $invoice));

        // Wrong-dept staff is denied (scope check)
        $this->assertFalse(Gate::forUser($outsider)->allows('view', $invoice));

        // PAID invoice: policy still ALLOWS (terminal-status is a business rule → 422 in service)
        $this->assertTrue(Gate::forUser($staff)->allows('update', $paidInvoice));
        $this->assertTrue(Gate::forUser($staff)->allows('delete', $paidInvoice));

        // But wrong-dept staff is still denied even for a PAID invoice
        $this->assertFalse(Gate::forUser($outsider)->allows('update', $paidInvoice));
    }

    public function test_contract_policy_uses_department_scope(): void
    {
        $staff = InternalUser::query()->findOrFail(2);
        $outsider = InternalUser::query()->findOrFail(3);
        $contract = Contract::query()->findOrFail(200);

        $this->assertTrue(Gate::forUser($staff)->allows('view', $contract));
        $this->assertTrue(Gate::forUser($staff)->allows('update', $contract));
        $this->assertFalse(Gate::forUser($outsider)->allows('delete', $contract));
    }

    public function test_customer_request_case_policy_allows_direct_assignee_fallback(): void
    {
        $staff = InternalUser::query()->findOrFail(2);
        $outsider = InternalUser::query()->findOrFail(3);
        $caseWithDept = CustomerRequestCase::query()->findOrFail(300);
        $caseWithoutProjectButAssigned = CustomerRequestCase::query()->findOrFail(301);

        $this->assertTrue(Gate::forUser($staff)->allows('view', $caseWithDept));
        $this->assertTrue(Gate::forUser($staff)->allows('update', $caseWithoutProjectButAssigned));
        $this->assertFalse(Gate::forUser($outsider)->allows('view', $caseWithoutProjectButAssigned));
    }

    private function setUpSchema(): void
    {
        Schema::create('internal_users', function (Blueprint $table): void {
            $table->id();
            $table->string('username')->nullable();
            $table->string('password')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->timestamps();
        });

        Schema::create('departments', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table): void {
            $table->id();
            $table->string('role_code');
        });

        Schema::create('permissions', function (Blueprint $table): void {
            $table->id();
            $table->string('perm_key');
            $table->boolean('is_active')->default(true);
        });

        Schema::create('role_permission', function (Blueprint $table): void {
            $table->unsignedBigInteger('role_id');
            $table->unsignedBigInteger('permission_id');
        });

        Schema::create('user_roles', function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('role_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
        });

        Schema::create('user_dept_scopes', function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('dept_id');
            $table->string('scope_type')->default('DEPT_ONLY');
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('status')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->id();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('invoices', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('contract_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('status')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('customer_request_cases', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('current_status_code')->nullable();
            $table->unsignedBigInteger('received_by_user_id')->nullable();
            $table->unsignedBigInteger('dispatcher_user_id')->nullable();
            $table->unsignedBigInteger('performer_user_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    private function seedAuthorizationFixtures(): void
    {
        DB::table('departments')->insert([
            ['id' => 10, 'parent_id' => null],
            ['id' => 11, 'parent_id' => null],
        ]);

        DB::table('internal_users')->insert([
            ['id' => 1, 'username' => 'admin', 'password' => 'secret', 'department_id' => 10],
            ['id' => 2, 'username' => 'staff', 'password' => 'secret', 'department_id' => 10],
            ['id' => 3, 'username' => 'outsider', 'password' => 'secret', 'department_id' => 11],
        ]);

        DB::table('roles')->insert([
            ['id' => 1, 'role_code' => 'ADMIN'],
            ['id' => 2, 'role_code' => 'OPS'],
        ]);

        $permissions = [
            ['id' => 1, 'perm_key' => 'fee_collection.read', 'is_active' => 1],
            ['id' => 2, 'perm_key' => 'fee_collection.write', 'is_active' => 1],
            ['id' => 3, 'perm_key' => 'fee_collection.delete', 'is_active' => 1],
            ['id' => 4, 'perm_key' => 'contracts.read', 'is_active' => 1],
            ['id' => 5, 'perm_key' => 'contracts.write', 'is_active' => 1],
            ['id' => 6, 'perm_key' => 'contracts.delete', 'is_active' => 1],
            ['id' => 7, 'perm_key' => 'support_requests.read', 'is_active' => 1],
            ['id' => 8, 'perm_key' => 'support_requests.write', 'is_active' => 1],
            ['id' => 9, 'perm_key' => 'support_requests.delete', 'is_active' => 1],
        ];
        DB::table('permissions')->insert($permissions);

        foreach (range(1, 9) as $permissionId) {
            DB::table('role_permission')->insert([
                'role_id' => 2,
                'permission_id' => $permissionId,
            ]);
        }

        DB::table('user_roles')->insert([
            ['user_id' => 1, 'role_id' => 1, 'is_active' => 1, 'expires_at' => null],
            ['user_id' => 2, 'role_id' => 2, 'is_active' => 1, 'expires_at' => null],
        ]);

        DB::table('user_dept_scopes')->insert([
            ['user_id' => 2, 'dept_id' => 10, 'scope_type' => 'DEPT_ONLY'],
            ['user_id' => 3, 'dept_id' => 11, 'scope_type' => 'DEPT_ONLY'],
        ]);

        DB::table('projects')->insert([
            ['id' => 1000, 'dept_id' => 10],
            ['id' => 1001, 'dept_id' => 11],
        ]);

        DB::table('customers')->insert([
            ['id' => 1],
        ]);

        DB::table('contracts')->insert([
            ['id' => 200, 'project_id' => 1000, 'status' => 'DRAFT', 'created_by' => 2],
            ['id' => 201, 'project_id' => 1001, 'status' => 'DRAFT', 'created_by' => 3],
        ]);

        DB::table('invoices')->insert([
            ['id' => 100, 'contract_id' => 200, 'project_id' => 1000, 'customer_id' => 1, 'status' => 'DRAFT', 'created_by' => 2],
            ['id' => 101, 'contract_id' => 200, 'project_id' => 1000, 'customer_id' => 1, 'status' => 'PAID', 'created_by' => 2],
        ]);

        DB::table('customer_request_cases')->insert([
            [
                'id' => 300,
                'project_id' => 1000,
                'current_status_code' => 'new_intake',
                'received_by_user_id' => 2,
                'dispatcher_user_id' => 2,
                'performer_user_id' => 2,
                'created_by' => 2,
            ],
            [
                'id' => 301,
                'project_id' => null,
                'current_status_code' => 'analysis',
                'received_by_user_id' => 2,
                'dispatcher_user_id' => null,
                'performer_user_id' => 2,
                'created_by' => 2,
            ],
        ]);
    }
}
