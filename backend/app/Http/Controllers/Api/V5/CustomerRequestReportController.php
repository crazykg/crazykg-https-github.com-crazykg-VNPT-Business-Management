<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\CustomerRequestReportService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerRequestReportController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly CustomerRequestReportService $service
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function monthlyHours(Request $request): JsonResponse
    {
        return $this->service->monthlyHours($request);
    }

    public function painPoints(Request $request): JsonResponse
    {
        return $this->service->painPoints($request);
    }

    public function weeklyHours(Request $request): JsonResponse
    {
        return $this->service->weeklyHours($request);
    }

    public function trend(Request $request): JsonResponse
    {
        return $this->service->trend($request);
    }
}
