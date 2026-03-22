<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\LeadershipDirectiveService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeadershipDirectiveController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly LeadershipDirectiveService $service
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->service->index($request);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return $this->service->show($request, $id);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->service->store($request);
    }

    public function acknowledge(Request $request, int $id): JsonResponse
    {
        return $this->service->acknowledge($request, $id);
    }

    public function complete(Request $request, int $id): JsonResponse
    {
        return $this->service->complete($request, $id);
    }
}
