<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\Domain\DocumentDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DocumentController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly DocumentDomainService $service
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->service->index($request);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->service->store($request);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return $this->service->update($request, $id);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return $this->service->destroy($request, $id);
    }

    public function uploadAttachment(Request $request): JsonResponse
    {
        return $this->service->uploadAttachment($request);
    }

    public function deleteUploadedAttachment(Request $request): JsonResponse
    {
        return $this->service->deleteUploadedAttachment($request);
    }

    public function downloadDocumentAttachment(Request $request, int $id): Response
    {
        return $this->service->downloadDocumentAttachment($request, $id);
    }

    public function downloadAttachment(Request $request, int $id): Response
    {
        return $this->service->downloadAttachment($request, $id);
    }

    public function downloadTemporaryAttachment(Request $request): Response
    {
        return $this->service->downloadTemporaryAttachment($request);
    }
}
