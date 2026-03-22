<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\LeadershipDashboardService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeadershipDashboardController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly LeadershipDashboardService $service
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function dashboard(Request $request): JsonResponse
    {
        return $this->service->dashboard($request);
    }

    public function risks(Request $request): JsonResponse
    {
        return $this->service->risks($request);
    }

    public function teamComparison(Request $request): JsonResponse
    {
        return $this->service->teamComparison($request);
    }
}
