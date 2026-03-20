<?php

namespace App\Services\V5\Domain;

use App\Services\V5\Legacy\V5MasterDataLegacyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportConfigDomainService
{
    public function __construct(
        private readonly V5MasterDataLegacyService $legacy
    ) {}

    public function serviceGroups(Request $request): JsonResponse
    {
        return $this->legacy->supportServiceGroups($request);
    }

    public function availableServiceGroups(Request $request): JsonResponse
    {
        return $this->legacy->availableSupportServiceGroups($request);
    }

    public function storeServiceGroup(Request $request): JsonResponse
    {
        return $this->legacy->storeSupportServiceGroup($request);
    }

    public function storeServiceGroupsBulk(Request $request): JsonResponse
    {
        return $this->legacy->storeSupportServiceGroupsBulk($request);
    }

    public function updateServiceGroup(Request $request, int $id): JsonResponse
    {
        return $this->legacy->updateSupportServiceGroup($request, $id);
    }

    public function requestStatuses(Request $request): JsonResponse
    {
        return $this->legacy->supportRequestStatuses($request);
    }

    public function storeRequestStatus(Request $request): JsonResponse
    {
        return $this->legacy->storeSupportRequestStatus($request);
    }

    public function storeRequestStatusesBulk(Request $request): JsonResponse
    {
        return $this->legacy->storeSupportRequestStatusesBulk($request);
    }

    public function updateRequestStatus(Request $request, int $id): JsonResponse
    {
        return $this->legacy->updateSupportRequestStatusDefinition($request, $id);
    }

    public function worklogActivityTypes(Request $request): JsonResponse
    {
        return $this->legacy->worklogActivityTypes($request);
    }

    public function storeWorklogActivityType(Request $request): JsonResponse
    {
        return $this->legacy->storeWorklogActivityType($request);
    }

    public function updateWorklogActivityType(Request $request, int $id): JsonResponse
    {
        return $this->legacy->updateWorklogActivityType($request, $id);
    }

    public function slaConfigs(Request $request): JsonResponse
    {
        return $this->legacy->supportSlaConfigs($request);
    }

    public function storeSlaConfig(Request $request): JsonResponse
    {
        return $this->legacy->storeSupportSlaConfig($request);
    }

    public function updateSlaConfig(Request $request, int $id): JsonResponse
    {
        return $this->legacy->updateSupportSlaConfig($request, $id);
    }
}
