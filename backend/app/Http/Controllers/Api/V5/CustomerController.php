<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\CustomerDomainService;
use App\Services\V5\Domain\CustomerInsightService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CustomerController extends V5BaseController
{
    // Insight thường được xem nhiều lần, dữ liệu ít thay đổi trong 1 phiên làm việc.
    // Cache 5 phút: đủ fresh để phản ánh cập nhật hợp đồng vừa lưu.
    private const INSIGHT_CACHE_TTL_SECONDS = 300;

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

    public function store(Request $request): JsonResponse
    {
        return $this->customerService->store($request);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        // Xoá cache insight khi thông tin KH được cập nhật
        Cache::forget("v5:customer-insight:{$id}:v1");
        return $this->customerService->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        Cache::forget("v5:customer-insight:{$id}:v1");
        return $this->customerService->destroy($request, $id);
    }

    /**
     * GET /api/v5/customers/{id}/insight
     * Customer 360: contracts, services used, opportunities, CRC summary, upsell suggestions.
     *
     * Cache 5 phút per customer_id (key: v5:customer-insight:{id}:v1).
     * Invalidated tự động khi update/delete customer (xem trên).
     * Invalidated khi lưu contract/CRC từ CustomerInsightService::invalidateCache().
     */
    public function insight(int $id): JsonResponse
    {
        $cacheKey = "v5:customer-insight:{$id}:v1";

        // Cache::remember trả về Response nếu đã có trong cache,
        // hoặc gọi buildInsight và lưu kết quả vào cache.
        // Lưu ý: Laravel cache lưu object response — serialize toàn bộ JSON body.
        $payload = Cache::remember(
            $cacheKey,
            self::INSIGHT_CACHE_TTL_SECONDS,
            fn () => $this->insightService->buildInsight($id)->getData(true)
        );

        return response()->json($payload);
    }
}
