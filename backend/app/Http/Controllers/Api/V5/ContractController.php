<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\ContractDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly ContractDomainService $contractService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->contractService->index($request);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->contractService->store($request);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->contractService->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->contractService->destroy($request, $id);
    }
}
