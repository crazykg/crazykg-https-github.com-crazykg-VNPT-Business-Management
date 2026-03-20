<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\CustomerRequestDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerRequestController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly CustomerRequestDomainService $service
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->service->index($request);
    }

    public function dashboardSummary(Request $request): JsonResponse
    {
        return $this->service->dashboardSummary($request);
    }

    public function exportDashboardSummary(Request $request): StreamedResponse
    {
        return $this->service->exportDashboardSummary($request);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->service->store($request);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->service->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->service->destroy($request, $id);
    }

    public function referenceSearch(Request $request): JsonResponse
    {
        return $this->service->referenceSearch($request);
    }

    public function history(Request $request, int $id): JsonResponse
    {
        return $this->service->history($request, $id);
    }

    public function histories(Request $request): JsonResponse
    {
        return $this->service->histories($request);
    }

    public function import(Request $request): JsonResponse
    {
        return $this->service->import($request);
    }

    public function export(Request $request): StreamedResponse
    {
        return $this->service->export($request);
    }

    public function receivers(Request $request): JsonResponse
    {
        return $this->service->receivers($request);
    }

    public function projectItems(Request $request): JsonResponse
    {
        return $this->service->projectItems($request);
    }
}
