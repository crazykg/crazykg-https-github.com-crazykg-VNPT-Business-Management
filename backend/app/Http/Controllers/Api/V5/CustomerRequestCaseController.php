<?php

namespace App\Http\Controllers\Api\V5;

use App\Http\Requests\V5\StoreCustomerRequestCaseEstimateRequest;
use App\Http\Requests\V5\StoreCustomerRequestCaseRequest;
use App\Http\Requests\V5\StoreCustomerRequestCaseWorklogRequest;
use App\Http\Requests\V5\TransitionCustomerRequestCaseRequest;
use App\Http\Requests\V5\UpdateCustomerRequestCaseStatusRequest;
use App\Http\Requests\V5\UpdateCustomerRequestCaseSubStatusRequest;
use App\Models\CustomerRequestCase;
use App\Services\V5\Domain\CustomerRequestCaseDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

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

    public function store(StoreCustomerRequestCaseRequest $request): JsonResponse
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

    public function storeEstimate(StoreCustomerRequestCaseEstimateRequest $request, int $id): JsonResponse
    {
        if (auth()->check()) {
            Gate::authorize('update', CustomerRequestCase::query()->findOrFail($id));
        }

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

    public function storeWorklog(StoreCustomerRequestCaseWorklogRequest $request, int $id): JsonResponse
    {
        if (auth()->check()) {
            Gate::authorize('update', CustomerRequestCase::query()->findOrFail($id));
        }

        return $this->service->storeWorklog($request, $id);
    }

    public function showStatus(Request $request, int $id, string $statusCode): JsonResponse
    {
        return $this->service->showStatus($request, $id, $statusCode);
    }

    public function saveStatus(UpdateCustomerRequestCaseStatusRequest $request, int $id, string $statusCode): JsonResponse
    {
        if (auth()->check()) {
            Gate::authorize('update', CustomerRequestCase::query()->findOrFail($id));
        }

        return $this->service->saveStatus($request, $id, $statusCode);
    }

    public function transition(TransitionCustomerRequestCaseRequest $request, int $id): JsonResponse
    {
        if (auth()->check()) {
            Gate::authorize('update', CustomerRequestCase::query()->findOrFail($id));
        }

        return $this->service->transition($request, $id);
    }

    public function updateSubStatus(UpdateCustomerRequestCaseSubStatusRequest $request, int $id): JsonResponse
    {
        if (auth()->check()) {
            Gate::authorize('update', CustomerRequestCase::query()->findOrFail($id));
        }

        return $this->service->updateSubStatus($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (auth()->check()) {
            Gate::authorize('delete', CustomerRequestCase::query()->findOrFail($id));
        }

        return $this->service->destroy($request, $id);
    }
}
