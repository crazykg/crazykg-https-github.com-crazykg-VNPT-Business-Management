<?php

namespace App\Http\Controllers\Api\V5;

use App\Http\Requests\V5\StoreContractRequest;
use App\Http\Requests\V5\UpdateContractRequest;
use App\Models\Contract;
use App\Services\V5\Contract\ContractRevenueAnalyticsService;
use App\Services\V5\Domain\ContractDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ContractController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly ContractDomainService $contractService,
        private readonly ContractRevenueAnalyticsService $revenueAnalyticsService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->contractService->index($request);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return $this->contractService->show($request, $id);
    }

    public function revenueAnalytics(Request $request): JsonResponse
    {
        return $this->revenueAnalyticsService->analytics($request);
    }

    public function signerOptions(Request $request): JsonResponse
    {
        return $this->contractService->signerOptions($request);
    }

    public function store(StoreContractRequest $request): JsonResponse
    {
        return $this->contractService->store($request);
    }

    public function update(UpdateContractRequest $request, int $id): JsonResponse
    {
        if (auth()->check()) {
            Gate::authorize('update', Contract::query()->findOrFail($id));
        }

        return $this->contractService->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (auth()->check()) {
            Gate::authorize('delete', Contract::query()->findOrFail($id));
        }

        return $this->contractService->destroy($request, $id);
    }

    public function generatePayments(Request $request, int $id): JsonResponse
    {
        return $this->contractService->generatePayments($request, $id);
    }

    public function paymentSchedules(Request $request): JsonResponse
    {
        return $this->contractService->paymentSchedules($request);
    }

    public function updatePaymentSchedule(Request $request, int $id): JsonResponse
    {
        return $this->contractService->updatePaymentSchedule($request, $id);
    }
}
