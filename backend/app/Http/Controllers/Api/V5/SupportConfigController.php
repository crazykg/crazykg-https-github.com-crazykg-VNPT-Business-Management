<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\SupportConfigDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportConfigController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly SupportConfigDomainService $service
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function serviceGroups(Request $request): JsonResponse
    {
        return $this->service->serviceGroups($request);
    }

    public function availableServiceGroups(Request $request): JsonResponse
    {
        return $this->service->availableServiceGroups($request);
    }

    public function storeServiceGroup(Request $request): JsonResponse
    {
        return $this->service->storeServiceGroup($request);
    }

    public function storeServiceGroupsBulk(Request $request): JsonResponse
    {
        return $this->service->storeServiceGroupsBulk($request);
    }

    public function updateServiceGroup(Request $request, int $id): JsonResponse
    {
        return $this->service->updateServiceGroup($request, $id);
    }

    public function requestStatuses(Request $request): JsonResponse
    {
        return $this->service->requestStatuses($request);
    }

    public function productUnitMasters(Request $request): JsonResponse
    {
        return $this->service->productUnitMasters($request);
    }

    public function storeProductUnitMaster(Request $request): JsonResponse
    {
        return $this->service->storeProductUnitMaster($request);
    }

    public function updateProductUnitMaster(Request $request, int $id): JsonResponse
    {
        return $this->service->updateProductUnitMaster($request, $id);
    }

    public function storeRequestStatus(Request $request): JsonResponse
    {
        return $this->service->storeRequestStatus($request);
    }

    public function storeRequestStatusesBulk(Request $request): JsonResponse
    {
        return $this->service->storeRequestStatusesBulk($request);
    }

    public function updateRequestStatus(Request $request, int $id): JsonResponse
    {
        return $this->service->updateRequestStatus($request, $id);
    }

    public function worklogActivityTypes(Request $request): JsonResponse
    {
        return $this->service->worklogActivityTypes($request);
    }

    public function storeWorklogActivityType(Request $request): JsonResponse
    {
        return $this->service->storeWorklogActivityType($request);
    }

    public function updateWorklogActivityType(Request $request, int $id): JsonResponse
    {
        return $this->service->updateWorklogActivityType($request, $id);
    }

    public function slaConfigs(Request $request): JsonResponse
    {
        return $this->service->slaConfigs($request);
    }

    public function storeSlaConfig(Request $request): JsonResponse
    {
        return $this->service->storeSlaConfig($request);
    }

    public function updateSlaConfig(Request $request, int $id): JsonResponse
    {
        return $this->service->updateSlaConfig($request, $id);
    }
}
