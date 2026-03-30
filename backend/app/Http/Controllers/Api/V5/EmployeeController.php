<?php

namespace App\Http\Controllers\Api\V5;

use App\Http\Requests\V5\StoreEmployeeRequest;
use App\Http\Requests\V5\UpdateEmployeeRequest;
use App\Services\V5\Domain\EmployeeDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly EmployeeDomainService $employeeService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->employeeService->index($request);
    }

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        return $this->employeeService->store($request);
    }

    public function storeBulk(Request $request): JsonResponse
    {
        return $this->employeeService->storeBulk($request);
    }

    public function update(UpdateEmployeeRequest $request, int $id): JsonResponse
    {
        return $this->employeeService->update($request, $id);
    }

    public function destroy(int $id): JsonResponse
    {
        return $this->employeeService->destroy($id);
    }

    public function resetPassword(Request $request, int $id): JsonResponse
    {
        return $this->employeeService->resetPassword($request, $id);
    }
}
