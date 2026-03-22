<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\CustomerRequestCaseDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerRequestCaseController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly CustomerRequestCaseDomainService $service
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function statusCatalog(Request $request): JsonResponse
    {
        return $this->service->statusCatalog($request);
    }

    public function statusTransitions(Request $request): JsonResponse
    {
        return $this->service->statusTransitions($request);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->service->index($request);
    }

    public function indexByStatus(Request $request, string $statusCode): JsonResponse
    {
        return $this->service->indexByStatus($request, $statusCode);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->service->store($request);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return $this->service->show($request, $id);
    }

    public function timeline(Request $request, int $id): JsonResponse
    {
        return $this->service->timeline($request, $id);
    }

    public function people(Request $request, int $id): JsonResponse
    {
        return $this->service->people($request, $id);
    }

    public function estimates(Request $request, int $id): JsonResponse
    {
        return $this->service->estimates($request, $id);
    }

    public function storeEstimate(Request $request, int $id): JsonResponse
    {
        return $this->service->storeEstimate($request, $id);
    }

    public function hoursReport(Request $request, int $id): JsonResponse
    {
        return $this->service->hoursReport($request, $id);
    }

    public function attachments(Request $request, int $id): JsonResponse
    {
        return $this->service->attachments($request, $id);
    }

    public function fullDetail(Request $request, int $id): JsonResponse
    {
        return $this->service->fullDetail($request, $id);
    }

    public function summaryCard(Request $request, int $id): JsonResponse
    {
        return $this->service->summaryCard($request, $id);
    }

    public function search(Request $request): JsonResponse
    {
        return $this->service->search($request);
    }

    public function dashboardCreator(Request $request): JsonResponse
    {
        return $this->service->dashboardCreator($request);
    }

    public function dashboardDispatcher(Request $request): JsonResponse
    {
        return $this->service->dashboardDispatcher($request);
    }

    public function dashboardPerformer(Request $request): JsonResponse
    {
        return $this->service->dashboardPerformer($request);
    }

    public function performerWeeklyTimesheet(Request $request): JsonResponse
    {
        return $this->service->performerWeeklyTimesheet($request);
    }

    public function dashboardOverview(Request $request): JsonResponse
    {
        return $this->service->dashboardOverview($request);
    }

    public function worklogs(Request $request, int $id): JsonResponse
    {
        return $this->service->worklogs($request, $id);
    }

    public function storeWorklog(Request $request, int $id): JsonResponse
    {
        return $this->service->storeWorklog($request, $id);
    }

    public function showStatus(Request $request, int $id, string $statusCode): JsonResponse
    {
        return $this->service->showStatus($request, $id, $statusCode);
    }

    public function saveStatus(Request $request, int $id, string $statusCode): JsonResponse
    {
        return $this->service->saveStatus($request, $id, $statusCode);
    }

    public function transition(Request $request, int $id): JsonResponse
    {
        return $this->service->transition($request, $id);
    }

    public function updateSubStatus(Request $request, int $id): JsonResponse
    {
        return $this->service->updateSubStatus($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->service->destroy($request, $id);
    }
}
