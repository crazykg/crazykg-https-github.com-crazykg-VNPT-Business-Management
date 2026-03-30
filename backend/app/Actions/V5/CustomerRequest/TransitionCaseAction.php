<?php

namespace App\Actions\V5\CustomerRequest;

use App\Services\V5\CustomerRequest\CustomerRequestCaseWriteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransitionCaseAction
{
    public function __construct(
        private readonly CustomerRequestCaseWriteService $writeService,
    ) {}

    /**
     * @param callable(\App\Models\CustomerRequestCase,string,?int): array<string,mixed> $buildStatusDetailData
     */
    public function execute(Request $request, int $id, callable $buildStatusDetailData): JsonResponse
    {
        return $this->writeService->transition($request, $id, $buildStatusDetailData);
    }
}
