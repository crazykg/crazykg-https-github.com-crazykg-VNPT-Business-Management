<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\CustomerPersonnelDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerPersonnelController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly CustomerPersonnelDomainService $customerPersonnelService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->customerPersonnelService->index($request);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->customerPersonnelService->store($request);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return $this->customerPersonnelService->update($request, $id);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return $this->customerPersonnelService->destroy($request, $id);
    }
}
