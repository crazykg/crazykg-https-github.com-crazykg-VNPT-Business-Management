<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\CustomerRequestPlanService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerRequestPlanController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly CustomerRequestPlanService $service
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->service->index($request);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return $this->service->show($request, $id);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->service->store($request);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->service->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->service->destroy($request, $id);
    }

    public function storeItem(Request $request, int $planId): JsonResponse
    {
        return $this->service->storeItem($request, $planId);
    }

    public function updateItem(Request $request, int $planId, int $itemId): JsonResponse
    {
        return $this->service->updateItem($request, $planId, $itemId);
    }

    public function destroyItem(Request $request, int $planId, int $itemId): JsonResponse
    {
        return $this->service->destroyItem($request, $planId, $itemId);
    }

    public function carryOver(Request $request, int $planId): JsonResponse
    {
        return $this->service->carryOver($request, $planId);
    }

    public function backlog(Request $request): JsonResponse
    {
        return $this->service->backlog($request);
    }
}
