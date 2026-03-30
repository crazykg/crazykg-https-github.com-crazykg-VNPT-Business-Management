<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\EmployeePartyProfileDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeePartyProfileController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly EmployeePartyProfileDomainService $partyProfileService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->partyProfileService->index($request);
    }

    public function showForEmployee(int $id): JsonResponse
    {
        return $this->partyProfileService->showForEmployee($id);
    }

    public function upsertForEmployee(Request $request, int $id): JsonResponse
    {
        return $this->partyProfileService->upsertForEmployee($request, $id);
    }

    public function bulkUpsert(Request $request): JsonResponse
    {
        return $this->partyProfileService->bulkUpsert($request);
    }
}
