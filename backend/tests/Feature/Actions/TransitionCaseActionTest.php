<?php

namespace Tests\Feature\Actions;

use App\Actions\V5\CustomerRequest\TransitionCaseAction;
use App\Services\V5\CustomerRequest\Write\CaseWriteOrchestrator;
use Illuminate\Http\Request;
use Mockery;
use Tests\TestCase;

class TransitionCaseActionTest extends TestCase
{
    public function test_execute_delegates_to_write_service(): void
    {
        $request = Request::create('/api/v5/customer-request-cases/42/transition', 'POST', [
            'to_status_code' => 'completed',
        ]);
        $callback = static fn (): array => ['ok' => true];
        $response = response()->json(['data' => ['id' => 42]]);

        $writeService = Mockery::mock(CaseWriteOrchestrator::class);
        $writeService
            ->shouldReceive('transition')
            ->once()
            ->with($request, 42, $callback)
            ->andReturn($response);

        $action = new TransitionCaseAction($writeService);

        $this->assertSame($response, $action->execute($request, 42, $callback));
    }
}
