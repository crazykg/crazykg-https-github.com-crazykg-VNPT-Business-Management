<?php

namespace App\Services\V5\Compatibility;

use App\Services\V5\CustomerRequest\CustomerRequestCompatibilityLookupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerRequestCompatibilityService
{
    public function __construct(
        private readonly CustomerRequestCompatibilityLookupService $lookupService
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->decommissionedJsonResponse();
    }

    public function dashboardSummary(Request $request): JsonResponse
    {
        return $this->decommissionedJsonResponse();
    }

    public function exportDashboardSummary(Request $request): StreamedResponse
    {
        return $this->decommissionedExportResponse();
    }

    public function store(Request $request): JsonResponse
    {
        return $this->decommissionedJsonResponse();
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->decommissionedJsonResponse();
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->decommissionedJsonResponse();
    }

    public function referenceSearch(Request $request): JsonResponse
    {
        return $this->lookupService->referenceSearch($request);
    }

    public function history(Request $request, int $id): JsonResponse
    {
        return $this->decommissionedJsonResponse();
    }

    public function histories(Request $request): JsonResponse
    {
        return $this->decommissionedJsonResponse();
    }

    public function import(Request $request): JsonResponse
    {
        return $this->decommissionedJsonResponse();
    }

    public function export(Request $request): StreamedResponse
    {
        return $this->decommissionedExportResponse();
    }

    public function receivers(Request $request): JsonResponse
    {
        return $this->lookupService->receivers($request);
    }

    public function projectItems(Request $request): JsonResponse
    {
        return $this->lookupService->projectItems($request);
    }

    public function customerFilterOptions(Request $request): JsonResponse
    {
        return $this->lookupService->customerFilterOptions($request);
    }

    public function projectFilterOptions(Request $request): JsonResponse
    {
        return $this->lookupService->projectFilterOptions($request);
    }

    public function productFilterOptions(Request $request): JsonResponse
    {
        return $this->lookupService->productFilterOptions($request);
    }

    private function decommissionedJsonResponse(): JsonResponse
    {
        return response()->json([
            'message' => 'This feature has been decommissioned.',
            'data' => [],
        ], 410);
    }

    private function decommissionedExportResponse(): StreamedResponse
    {
        return response()->streamDownload(
            static function (): void {},
            'decommissioned.csv',
            ['Content-Type' => 'text/csv; charset=UTF-8', 'X-Gone' => '410']
        );
    }
}
