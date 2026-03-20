<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\MonthlyCalendarDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MonthlyCalendarController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly MonthlyCalendarDomainService $calendarService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->calendarService->index($request);
    }

    public function update(Request $request, string $date): JsonResponse
    {
        return $this->calendarService->update($request, $date);
    }

    public function generateYear(Request $request): JsonResponse
    {
        return $this->calendarService->generateYear($request);
    }
}
