<?php

namespace Tests\Feature;

use App\Services\V5\Workflow\WorkflowFlowResolver;
use Tests\TestCase;

class WorkflowFlowResolverTest extends TestCase
{
    public function test_it_resolves_flow_by_status_and_sub_status_without_request_code_prefix(): void
    {
        $resolver = app(WorkflowFlowResolver::class);

        $support = $resolver->resolve(' in_progress ', null);
        $this->assertSame('GD3', $support['flow_step']);
        $this->assertSame('support.dang_xu_ly', $support['form_key']);

        $programming = $resolver->resolve('lap_trinh', 'upcode');
        $this->assertSame('GD12', $programming['flow_step']);
        $this->assertSame('programming.lap_trinh.upcode', $programming['form_key']);

        $legacyProgramming = $resolver->resolve('PENDING_UPCODE', null);
        $this->assertSame('GD12', $legacyProgramming['flow_step']);
        $this->assertSame('programming.lap_trinh.upcode', $legacyProgramming['form_key']);

        $approvalPending = $resolver->resolve('CHO_DUYET', null);
        $this->assertSame('GD1A', $approvalPending['flow_step']);
        $this->assertSame('support.cho_duyet', $approvalPending['form_key']);

        $closed = $resolver->resolve('DONG', null);
        $this->assertSame('GD19', $closed['flow_step']);
        $this->assertSame('support.dong', $closed['form_key']);
    }

    public function test_it_returns_fallback_for_unmapped_status(): void
    {
        $resolver = app(WorkflowFlowResolver::class);

        $resolved = $resolver->resolve('UNKNOWN_STATUS', null);
        $this->assertSame(WorkflowFlowResolver::FALLBACK_FLOW_STEP, $resolved['flow_step']);
        $this->assertSame(WorkflowFlowResolver::FALLBACK_FORM_KEY, $resolved['form_key']);
    }
}
