<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\CustomerRequestEscalationDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerRequestEscalationController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly CustomerRequestEscalationDomainService $service
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

    public function review(Request $request, int $id): JsonResponse
    {
        return $this->service->review($request, $id);
    }

    public function resolve(Request $request, int $id): JsonResponse
    {
        return $this->service->resolve($request, $id);
    }

    public function stats(Request $request): JsonResponse
    {
        return $this->service->stats($request);
    }
}
