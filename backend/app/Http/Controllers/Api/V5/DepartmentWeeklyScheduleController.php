<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\DepartmentWeeklyScheduleDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentWeeklyScheduleController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly DepartmentWeeklyScheduleDomainService $scheduleService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->scheduleService->index($request);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return $this->scheduleService->show($request, $id);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->scheduleService->store($request);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->scheduleService->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->scheduleService->destroy($request, $id);
    }

    public function destroyEntry(Request $request, int $scheduleId, int $entryId): JsonResponse
    {
        return $this->scheduleService->destroyEntry($request, $scheduleId, $entryId);
    }
}
