<?php

namespace App\Services\V5\Domain;

use App\Http\Controllers\Api\V5MasterDataController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerRequestDomainService
{
    public function __construct(
        private readonly V5MasterDataController $legacy
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->legacy->customerRequests($request);
    }

    public function dashboardSummary(Request $request): JsonResponse
    {
        return $this->legacy->customerRequestDashboardSummary($request);
    }

    public function exportDashboardSummary(Request $request): StreamedResponse
    {
        return $this->legacy->exportCustomerRequestDashboardSummary($request);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->legacy->storeCustomerRequest($request);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->legacy->updateCustomerRequest($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->legacy->deleteCustomerRequest($request, $id);
    }

    public function referenceSearch(Request $request): JsonResponse
    {
        return $this->legacy->supportRequestReferenceSearch($request);
    }

    public function history(Request $request, int $id): JsonResponse
    {
        return $this->legacy->customerRequestHistory($request, $id);
    }

    public function histories(Request $request): JsonResponse
    {
        return $this->legacy->customerRequestHistories($request);
    }

    public function import(Request $request): JsonResponse
    {
        return $this->legacy->importCustomerRequests($request);
    }

    public function export(Request $request): StreamedResponse
    {
        return $this->legacy->exportCustomerRequests($request);
    }

    public function receivers(Request $request): JsonResponse
    {
        return $this->legacy->customerRequestReceivers($request);
    }

    public function projectItems(Request $request): JsonResponse
    {
        return $this->legacy->customerRequestProjectItems($request);
    }
}
