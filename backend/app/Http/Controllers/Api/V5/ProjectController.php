<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\ProjectDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly ProjectDomainService $projectService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->projectService->index($request);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return $this->projectService->show($request, $id);
    }

    public function raciAssignments(Request $request): JsonResponse
    {
        return $this->projectService->raciAssignments($request);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->projectService->store($request);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->projectService->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->projectService->destroy($request, $id);
    }

    public function projectItems(Request $request): JsonResponse
    {
        return $this->projectService->projectItems($request);
    }

    public function projectTypes(Request $request): JsonResponse
    {
        return $this->projectService->projectTypes($request);
    }

    public function storeProjectType(Request $request): JsonResponse
    {
        return $this->projectService->storeProjectType($request);
    }

    public function updateProjectType(Request $request, int $id): JsonResponse
    {
        return $this->projectService->updateProjectType($request, $id);
    }
}
