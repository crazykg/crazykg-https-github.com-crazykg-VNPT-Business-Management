<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\CustomerDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly CustomerDomainService $customerService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->customerService->index($request);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->customerService->store($request);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->customerService->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->customerService->destroy($request, $id);
    }
}
