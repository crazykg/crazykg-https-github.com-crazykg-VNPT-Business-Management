<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Revenue\RevenueOverviewService;
use App\Services\V5\Revenue\RevenueTargetService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RevenueManagementController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly RevenueOverviewService $overviewService,
        private readonly RevenueTargetService $targetService
    ) {
        parent::__construct($support, $accessAudit);
    }

    // ── Overview Dashboard ────────────────────────────

    public function overview(Request $request): JsonResponse
    {
        return $this->overviewService->overview($request);
    }

    // ── Revenue Targets CRUD ──────────────────────────

    public function targetIndex(Request $request): JsonResponse
    {
        return $this->targetService->index($request);
    }

    public function targetStore(Request $request): JsonResponse
    {
        return $this->targetService->store($request);
    }

    public function targetUpdate(Request $request, int $id): JsonResponse
    {
        return $this->targetService->update($request, $id);
    }

    public function targetDestroy(Request $request, int $id): JsonResponse
    {
        return $this->targetService->destroy($request, $id);
    }

    public function targetBulkStore(Request $request): JsonResponse
    {
        return $this->targetService->bulkStore($request);
    }
}
