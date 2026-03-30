<?php

namespace App\Http\Controllers\Api\V5;

use App\Http\Requests\V5\StoreDepartmentRequest;
use App\Http\Requests\V5\UpdateDepartmentRequest;
use App\Services\V5\Domain\DepartmentDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly DepartmentDomainService $departmentService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->departmentService->index($request);
    }

    public function store(StoreDepartmentRequest $request): JsonResponse
    {
        return $this->departmentService->store($request);
    }

    public function update(UpdateDepartmentRequest $request, int $id): JsonResponse
    {
        return $this->departmentService->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->departmentService->destroy($request, $id);
    }
}
