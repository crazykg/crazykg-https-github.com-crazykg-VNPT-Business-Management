<?php

namespace App\Services\V5\Domain;

use App\Services\V5\Legacy\V5MasterDataLegacyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DocumentDomainService
{
    public function __construct(
        private readonly V5MasterDataLegacyService $legacy
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->legacy->documents($request);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->legacy->storeDocument($request);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return $this->legacy->updateDocument($request, $id);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return $this->legacy->deleteDocument($request, $id);
    }

    public function uploadAttachment(Request $request): JsonResponse
    {
        return $this->legacy->uploadDocumentAttachment($request);
    }

    public function deleteUploadedAttachment(Request $request): JsonResponse
    {
        return $this->legacy->deleteUploadedDocumentAttachment($request);
    }

    public function downloadDocumentAttachment(Request $request, int $id): Response
    {
        return $this->legacy->downloadDocumentAttachment($request, $id);
    }

    public function downloadAttachment(Request $request, int $id): Response
    {
        return $this->legacy->downloadAttachment($request, $id);
    }

    public function downloadTemporaryAttachment(Request $request): Response
    {
        return $this->legacy->downloadTemporaryDocumentAttachment($request);
    }
}
