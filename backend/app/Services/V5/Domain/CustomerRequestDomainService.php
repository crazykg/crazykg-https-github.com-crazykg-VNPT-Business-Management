<?php

namespace App\Services\V5\Domain;

use App\Services\V5\Compatibility\CustomerRequestCompatibilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerRequestDomainService
{
    public function __construct(
        private readonly CustomerRequestCompatibilityService $compatibility
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->compatibility->index($request);
    }

    public function dashboardSummary(Request $request): JsonResponse
    {
        return $this->compatibility->dashboardSummary($request);
    }

    public function exportDashboardSummary(Request $request): StreamedResponse
    {
        return $this->compatibility->exportDashboardSummary($request);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->compatibility->store($request);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->compatibility->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->compatibility->destroy($request, $id);
    }

    public function referenceSearch(Request $request): JsonResponse
    {
        return $this->compatibility->referenceSearch($request);
    }

    public function history(Request $request, int $id): JsonResponse
    {
        return $this->compatibility->history($request, $id);
    }

    public function histories(Request $request): JsonResponse
    {
        return $this->compatibility->histories($request);
    }

    public function import(Request $request): JsonResponse
    {
        return $this->compatibility->import($request);
    }

    public function export(Request $request): StreamedResponse
    {
        return $this->compatibility->export($request);
    }

    public function receivers(Request $request): JsonResponse
    {
        return $this->compatibility->receivers($request);
    }

    public function projectItems(Request $request): JsonResponse
    {
        return $this->compatibility->projectItems($request);
    }
}
