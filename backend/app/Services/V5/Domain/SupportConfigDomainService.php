<?php

namespace App\Services\V5\Domain;

use App\Services\V5\SupportConfig\SupportSlaConfigService;
use App\Services\V5\SupportConfig\SupportRequestStatusService;
use App\Services\V5\SupportConfig\SupportServiceGroupService;
use App\Services\V5\SupportConfig\WorklogActivityTypeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportConfigDomainService
{
    public function __construct(
        private readonly SupportServiceGroupService $serviceGroups,
        private readonly SupportRequestStatusService $requestStatuses,
        private readonly WorklogActivityTypeService $worklogActivityTypes,
        private readonly SupportSlaConfigService $slaConfigs,
    ) {}

    public function serviceGroups(Request $request): JsonResponse
    {
        return $this->serviceGroups->serviceGroups($request);
    }

    public function availableServiceGroups(Request $request): JsonResponse
    {
        return $this->serviceGroups->availableServiceGroups($request);
    }

    public function storeServiceGroup(Request $request): JsonResponse
    {
        return $this->serviceGroups->storeServiceGroup($request);
    }

    public function storeServiceGroupsBulk(Request $request): JsonResponse
    {
        return $this->serviceGroups->storeServiceGroupsBulk($request);
    }

    public function updateServiceGroup(Request $request, int $id): JsonResponse
    {
        return $this->serviceGroups->updateServiceGroup($request, $id);
    }

    public function requestStatuses(Request $request): JsonResponse
    {
        return $this->requestStatuses->requestStatuses($request);
    }

    public function storeRequestStatus(Request $request): JsonResponse
    {
        return $this->requestStatuses->storeRequestStatus($request);
    }

    public function storeRequestStatusesBulk(Request $request): JsonResponse
    {
        return $this->requestStatuses->storeRequestStatusesBulk($request);
    }

    public function updateRequestStatus(Request $request, int $id): JsonResponse
    {
        return $this->requestStatuses->updateRequestStatus($request, $id);
    }

    public function worklogActivityTypes(Request $request): JsonResponse
    {
        return $this->worklogActivityTypes->worklogActivityTypes($request);
    }

    public function storeWorklogActivityType(Request $request): JsonResponse
    {
        return $this->worklogActivityTypes->storeWorklogActivityType($request);
    }

    public function updateWorklogActivityType(Request $request, int $id): JsonResponse
    {
        return $this->worklogActivityTypes->updateWorklogActivityType($request, $id);
    }

    public function slaConfigs(Request $request): JsonResponse
    {
        return $this->slaConfigs->slaConfigs($request);
    }

    public function storeSlaConfig(Request $request): JsonResponse
    {
        return $this->slaConfigs->storeSlaConfig($request);
    }

    public function updateSlaConfig(Request $request, int $id): JsonResponse
    {
        return $this->slaConfigs->updateSlaConfig($request, $id);
    }
}
