<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\WorkflowConfigDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkflowConfigController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly WorkflowConfigDomainService $workflowConfigService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function statusCatalogs(Request $request): JsonResponse
    {
        return $this->workflowConfigService->statusCatalogs($request);
    }

    public function storeStatusCatalog(Request $request): JsonResponse
    {
        return $this->workflowConfigService->storeStatusCatalog($request);
    }

    public function updateStatusCatalog(Request $request, int $id): JsonResponse
    {
        return $this->workflowConfigService->updateStatusCatalog($request, $id);
    }

    public function statusTransitions(Request $request): JsonResponse
    {
        return $this->workflowConfigService->statusTransitions($request);
    }

    public function storeStatusTransition(Request $request): JsonResponse
    {
        return $this->workflowConfigService->storeStatusTransition($request);
    }

    public function updateStatusTransition(Request $request, int $id): JsonResponse
    {
        return $this->workflowConfigService->updateStatusTransition($request, $id);
    }

    public function formFieldConfigs(Request $request): JsonResponse
    {
        return $this->workflowConfigService->formFieldConfigs($request);
    }

    public function storeFormFieldConfig(Request $request): JsonResponse
    {
        return $this->workflowConfigService->storeFormFieldConfig($request);
    }

    public function updateFormFieldConfig(Request $request, int $id): JsonResponse
    {
        return $this->workflowConfigService->updateFormFieldConfig($request, $id);
    }
}
