<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\YeuCauDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class YeuCauController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly YeuCauDomainService $yeuCauService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function processCatalog(Request $request): JsonResponse
    {
        return $this->yeuCauService->processCatalog($request);
    }

    public function processDefinition(string $processCode): JsonResponse
    {
        return $this->yeuCauService->processDefinition($processCode);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->yeuCauService->index($request);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return $this->yeuCauService->show($request, $id);
    }

    public function timeline(Request $request, int $id): JsonResponse
    {
        return $this->yeuCauService->timeline($request, $id);
    }

    public function people(Request $request, int $id): JsonResponse
    {
        return $this->yeuCauService->people($request, $id);
    }

    public function showProcess(Request $request, int $id, string $processCode): JsonResponse
    {
        return $this->yeuCauService->showProcess($request, $id, $processCode);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->yeuCauService->store($request);
    }

    public function saveProcess(Request $request, int $id, string $processCode): JsonResponse
    {
        return $this->yeuCauService->saveProcess($request, $id, $processCode);
    }
}
