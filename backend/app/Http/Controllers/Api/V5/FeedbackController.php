<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\FeedbackDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedbackController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly FeedbackDomainService $feedbackService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->feedbackService->index($request);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return $this->feedbackService->show($request, $id);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->feedbackService->store($request);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->feedbackService->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->feedbackService->destroy($request, $id);
    }

    public function storeResponse(Request $request, int $id): JsonResponse
    {
        return $this->feedbackService->storeResponse($request, $id);
    }

    public function destroyResponse(Request $request, int $feedbackId, int $responseId): JsonResponse
    {
        return $this->feedbackService->destroyResponse($request, $feedbackId, $responseId);
    }
}
