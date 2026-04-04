<?php

namespace App\Http\Controllers\Api\V5;

use App\Http\Requests\V5\StoreCustomerRequest;
use App\Http\Requests\V5\UpdateCustomerRequest;
use App\Models\Customer;
use App\Services\V5\Domain\CustomerDomainService;
use App\Services\V5\Domain\CustomerInsightService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;

class CustomerController extends V5BaseController
{
    private const INSIGHT_CACHE_TTL_SECONDS = 300;
    private const INSIGHT_PRODUCT_DETAIL_CACHE_TTL_SECONDS = 600;

    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly CustomerDomainService $customerService,
        private readonly CustomerInsightService $insightService,
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->customerService->index($request);
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        return $this->customerService->store($request);
    }

    public function storeBulk(Request $request): JsonResponse
    {
        return $this->customerService->storeBulk($request);
    }

    public function update(UpdateCustomerRequest $request, int $id): JsonResponse
    {
        Gate::authorize('update', Customer::query()->findOrFail($id));

        $response = $this->customerService->update($request, $id);
        if ($response->getStatusCode() < 400) {
            $this->insightService->invalidateCustomerCaches($id);
        }

        return $response;
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        Gate::authorize('delete', Customer::query()->findOrFail($id));

        $response = $this->customerService->destroy($request, $id);
        if ($response->getStatusCode() < 400) {
            $this->insightService->invalidateCustomerCaches($id);
        }

        return $response;
    }

    /**
     * GET /api/v5/customers/{id}/insight
     * Customer 360: contracts, services used, opportunities, CRC summary, upsell suggestions.
     *
     * Cache 5 phút per customer_id (key: v5:customer-insight:{id}:v2).
     * Invalidated tự động khi update/delete customer (xem trên).
     * Invalidated khi lưu contract/CRC từ CustomerInsightService::invalidateCache().
     */
    public function insight(int $id): JsonResponse
    {
        $cacheKey = "v5:customer-insight:{$id}:" . CustomerInsightService::CACHE_VERSION;
        $payload = Cache::remember(
            $cacheKey,
            self::INSIGHT_CACHE_TTL_SECONDS,
            fn () => $this->insightService->buildInsight($id)->getData(true)
        );

        return response()->json($payload);
    }

    public function insightProductDetail(int $id, int $productId): JsonResponse
    {
        $cacheKey = "v5:customer-insight:{$id}:pd:{$productId}:" . CustomerInsightService::CACHE_VERSION;

        $payload = Cache::remember(
            $cacheKey,
            self::INSIGHT_PRODUCT_DETAIL_CACHE_TTL_SECONDS,
            fn () => $this->insightService->buildUpsellProductDetail($id, $productId)->getData(true)
        );

        return response()->json($payload);
    }
}
