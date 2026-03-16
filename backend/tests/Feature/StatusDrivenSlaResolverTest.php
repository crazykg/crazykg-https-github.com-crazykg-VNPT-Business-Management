<?php

namespace Tests\Feature;

use App\Services\V5\Workflow\StatusDrivenSlaResolver;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class StatusDrivenSlaResolverTest extends TestCase
{
    use DatabaseTransactions;

    private bool $createdSlaConfigsTableForTest = false;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Schema::hasTable('sla_configs')) {
            Schema::create('sla_configs', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('status', 50);
                $table->string('sub_status', 50)->nullable();
                $table->string('priority', 20);
                $table->decimal('sla_hours', 6, 2)->nullable();
                $table->decimal('resolution_hours', 6, 2)->nullable();
                $table->string('request_type_prefix', 20)->nullable();
                $table->unsignedBigInteger('service_group_id')->nullable();
                $table->string('workflow_action_code', 80)->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });

            $this->createdSlaConfigsTableForTest = true;
        }
    }

    protected function tearDown(): void
    {
        if ($this->createdSlaConfigsTableForTest && Schema::hasTable('sla_configs')) {
            Schema::drop('sla_configs');
            $this->createdSlaConfigsTableForTest = false;
        }

        parent::tearDown();
    }

    public function test_it_resolves_status_driven_rule_without_prefix(): void
    {
        $status = 'UT_STATUS_'.strtoupper(substr(sha1((string) microtime(true)), 0, 8));
        $this->insertSlaConfigRule($status, null, 'MEDIUM', 8.5, null, 0);

        $resolved = app(StatusDrivenSlaResolver::class)->resolve($status, null, 'MEDIUM', null);

        $this->assertIsArray($resolved);
        $this->assertSame($status, strtoupper(trim((string) ($resolved['status'] ?? $resolved['to_status'] ?? ''))));
        $this->assertSame('8.50', $this->normalizeDecimalString($resolved['sla_hours'] ?? $resolved['resolution_hours'] ?? null));
    }

    public function test_it_prioritizes_sub_status_specific_rule_over_wildcard_sub_status(): void
    {
        $status = 'LAP_TRINH_UT_'.strtoupper(substr(sha1((string) microtime(true)), 0, 6));
        $this->insertSlaConfigRule($status, null, 'HIGH', 12, null, 10);
        $this->insertSlaConfigRule($status, 'UPCODE', 'HIGH', 4, null, 0);

        $resolved = app(StatusDrivenSlaResolver::class)->resolve($status, 'UPCODE', 'HIGH', null);

        $this->assertIsArray($resolved);
        $this->assertSame('4.00', $this->normalizeDecimalString($resolved['sla_hours'] ?? $resolved['resolution_hours'] ?? null));
        $this->assertSame('UPCODE', strtoupper(trim((string) ($resolved['sub_status'] ?? ''))));
    }

    public function test_it_prioritizes_prefix_specific_rule_when_prefix_is_provided(): void
    {
        $status = 'UT_PREFIX_'.strtoupper(substr(sha1((string) microtime(true)), 0, 8));
        $this->insertSlaConfigRule($status, null, 'LOW', 20, null, 10);
        $this->insertSlaConfigRule($status, null, 'LOW', 5, 'SUP', 0);
        $this->insertSlaConfigRule($status, null, 'LOW', 7, 'REQDEV', 0);

        $resolver = app(StatusDrivenSlaResolver::class);

        $resolvedNoPrefix = $resolver->resolve($status, null, 'LOW', null);
        $resolvedSupport = $resolver->resolve($status, null, 'LOW', 'SUP');
        $resolvedProgramming = $resolver->resolve($status, null, 'LOW', 'REQDEV');

        $this->assertIsArray($resolvedNoPrefix);
        $this->assertIsArray($resolvedSupport);
        $this->assertIsArray($resolvedProgramming);

        $this->assertSame('20.00', $this->normalizeDecimalString($resolvedNoPrefix['sla_hours'] ?? $resolvedNoPrefix['resolution_hours'] ?? null));
        $this->assertSame('5.00', $this->normalizeDecimalString($resolvedSupport['sla_hours'] ?? $resolvedSupport['resolution_hours'] ?? null));
        $this->assertSame('7.00', $this->normalizeDecimalString($resolvedProgramming['sla_hours'] ?? $resolvedProgramming['resolution_hours'] ?? null));
    }

    public function test_it_prioritizes_service_group_specific_rule_over_wildcard_group(): void
    {
        $status = 'UT_SG_'.strtoupper(substr(sha1((string) microtime(true)), 0, 8));
        $this->insertSlaConfigRule($status, null, 'MEDIUM', 18, null, 10, null, null);
        $this->insertSlaConfigRule($status, null, 'MEDIUM', 6, null, 0, 12, null);

        $resolved = app(StatusDrivenSlaResolver::class)->resolve($status, null, 'MEDIUM', null, 12, null);

        $this->assertIsArray($resolved);
        $this->assertSame('6.00', $this->normalizeDecimalString($resolved['sla_hours'] ?? $resolved['resolution_hours'] ?? null));
        $this->assertSame(12, (int) ($resolved['service_group_id'] ?? 0));
    }

    public function test_it_prioritizes_workflow_action_specific_rule_over_wildcard_action(): void
    {
        $status = 'UT_ACTION_'.strtoupper(substr(sha1((string) microtime(true)), 0, 8));
        $this->insertSlaConfigRule($status, null, 'HIGH', 16, null, 10, null, null);
        $this->insertSlaConfigRule($status, null, 'HIGH', 3, null, 0, null, 'APPROVE');

        $resolved = app(StatusDrivenSlaResolver::class)->resolve($status, null, 'HIGH', null, null, 'APPROVE');

        $this->assertIsArray($resolved);
        $this->assertSame('3.00', $this->normalizeDecimalString($resolved['sla_hours'] ?? $resolved['resolution_hours'] ?? null));
        $this->assertSame('APPROVE', strtoupper(trim((string) ($resolved['workflow_action_code'] ?? ''))));
    }

    public function test_it_prioritizes_combined_group_and_action_scope_most_specific_rule(): void
    {
        $status = 'UT_COMBINED_'.strtoupper(substr(sha1((string) microtime(true)), 0, 8));
        $this->insertSlaConfigRule($status, null, 'URGENT', 24, null, 30, null, null);
        $this->insertSlaConfigRule($status, null, 'URGENT', 12, null, 20, 5, null);
        $this->insertSlaConfigRule($status, null, 'URGENT', 8, null, 10, null, 'APPROVE');
        $this->insertSlaConfigRule($status, null, 'URGENT', 2, null, 0, 5, 'APPROVE');

        $resolved = app(StatusDrivenSlaResolver::class)->resolve($status, null, 'URGENT', null, 5, 'APPROVE');

        $this->assertIsArray($resolved);
        $this->assertSame('2.00', $this->normalizeDecimalString($resolved['sla_hours'] ?? $resolved['resolution_hours'] ?? null));
        $this->assertSame(5, (int) ($resolved['service_group_id'] ?? 0));
        $this->assertSame('APPROVE', strtoupper(trim((string) ($resolved['workflow_action_code'] ?? ''))));
    }

    private function insertSlaConfigRule(
        string $status,
        ?string $subStatus,
        string $priority,
        float $slaHours,
        ?string $requestTypePrefix,
        int $sortOrder,
        ?int $serviceGroupId = null,
        ?string $workflowActionCode = null
    ): void {
        $payload = [];

        if (Schema::hasColumn('sla_configs', 'status')) {
            $payload['status'] = $status;
        }
        if (Schema::hasColumn('sla_configs', 'to_status')) {
            $payload['to_status'] = $status;
        }
        if (Schema::hasColumn('sla_configs', 'sub_status')) {
            $payload['sub_status'] = $subStatus;
        }
        if (Schema::hasColumn('sla_configs', 'service_group_id')) {
            $payload['service_group_id'] = $serviceGroupId;
        }
        if (Schema::hasColumn('sla_configs', 'workflow_action_code')) {
            $payload['workflow_action_code'] = $workflowActionCode;
        }
        if (Schema::hasColumn('sla_configs', 'priority')) {
            $payload['priority'] = $priority;
        }
        if (Schema::hasColumn('sla_configs', 'sla_hours')) {
            $payload['sla_hours'] = $slaHours;
        }
        if (Schema::hasColumn('sla_configs', 'response_hours')) {
            $payload['response_hours'] = 4;
        }
        if (Schema::hasColumn('sla_configs', 'resolution_hours')) {
            $payload['resolution_hours'] = $slaHours;
        }
        if (Schema::hasColumn('sla_configs', 'request_type_prefix')) {
            $payload['request_type_prefix'] = $requestTypePrefix;
        }
        if (Schema::hasColumn('sla_configs', 'description')) {
            $payload['description'] = 'UT rule';
        }
        if (Schema::hasColumn('sla_configs', 'is_active')) {
            $payload['is_active'] = 1;
        }
        if (Schema::hasColumn('sla_configs', 'sort_order')) {
            $payload['sort_order'] = $sortOrder;
        }
        if (Schema::hasColumn('sla_configs', 'created_at')) {
            $payload['created_at'] = now();
        }
        if (Schema::hasColumn('sla_configs', 'updated_at')) {
            $payload['updated_at'] = now();
        }
        if (Schema::hasColumn('sla_configs', 'created_by')) {
            $payload['created_by'] = null;
        }
        if (Schema::hasColumn('sla_configs', 'updated_by')) {
            $payload['updated_by'] = null;
        }

        DB::table('sla_configs')->insert($payload);
    }

    private function normalizeDecimalString(mixed $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }
}
