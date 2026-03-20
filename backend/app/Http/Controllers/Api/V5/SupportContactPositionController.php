<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\SupportContactPositionDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportContactPositionController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly SupportContactPositionDomainService $positionService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->positionService->index($request);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->positionService->store($request);
    }

    public function storeBulk(Request $request): JsonResponse
    {
        return $this->positionService->storeBulk($request);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->positionService->update($request, $id);
    }
}
