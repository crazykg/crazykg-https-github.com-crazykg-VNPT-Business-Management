<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\WorkloadSummaryService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class WorkloadSummaryController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly WorkloadSummaryService $service,
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function summary(Request $request): JsonResponse
    {
        return $this->service->summary($request);
    }

    public function dailySeries(Request $request): JsonResponse
    {
        return $this->service->dailySeries($request);
    }

    public function dailyComparison(Request $request): JsonResponse
    {
        return $this->service->dailyComparison($request);
    }

    public function projectSummary(Request $request): JsonResponse
    {
        return $this->service->projectSummary($request);
    }

    public function capacity(Request $request): JsonResponse
    {
        return $this->service->capacity($request);
    }

    public function weeklyAlerts(Request $request): JsonResponse
    {
        return $this->service->weeklyAlerts($request);
    }

    public function plannedActual(Request $request): JsonResponse
    {
        return $this->service->plannedActual($request);
    }

    public function entries(Request $request): JsonResponse
    {
        return $this->service->entries($request);
    }

    public function export(Request $request): Response
    {
        return $this->service->export($request);
    }
}
