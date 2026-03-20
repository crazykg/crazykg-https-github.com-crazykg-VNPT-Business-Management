<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\UserAccessDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserAccessController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly UserAccessDomainService $userAccessService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function roles(): JsonResponse
    {
        return $this->userAccessService->roles();
    }

    public function permissions(): JsonResponse
    {
        return $this->userAccessService->permissions();
    }

    public function index(Request $request): JsonResponse
    {
        return $this->userAccessService->userAccess($request);
    }

    public function updateRoles(Request $request, int $id): JsonResponse
    {
        return $this->userAccessService->updateUserRoles($request, $id);
    }

    public function updatePermissions(Request $request, int $id): JsonResponse
    {
        return $this->userAccessService->updateUserPermissions($request, $id);
    }
}
