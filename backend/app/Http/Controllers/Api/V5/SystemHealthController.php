<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\SystemHealthService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;

class SystemHealthController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly SystemHealthService $systemHealthService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function tables(): JsonResponse
    {
        return $this->systemHealthService->tables();
    }
}
