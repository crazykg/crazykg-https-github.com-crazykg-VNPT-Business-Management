<?php

namespace App\Services\V5\Domain;

use App\Services\V5\Document\DocumentAttachmentService;
use App\Services\V5\Document\DocumentCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DocumentDomainService
{
    public function __construct(
        private readonly DocumentCatalogService $catalog,
        private readonly DocumentAttachmentService $attachments,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->catalog->index($request);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->catalog->store($request);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return $this->catalog->update($request, $id);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return $this->catalog->destroy($request, $id);
    }

    public function uploadAttachment(Request $request): JsonResponse
    {
        return $this->attachments->uploadAttachment($request);
    }

    public function deleteUploadedAttachment(Request $request): JsonResponse
    {
        return $this->attachments->deleteUploadedAttachment($request);
    }

    public function linkAttachment(Request $request, int $id): JsonResponse
    {
        return $this->attachments->updateAttachmentReference($request, $id);
    }

    public function downloadDocumentAttachment(Request $request, int $id): Response
    {
        return $this->attachments->downloadDocumentAttachment($request, $id);
    }

    public function downloadAttachment(Request $request, int $id): Response
    {
        return $this->attachments->downloadAttachment($request, $id);
    }

    public function downloadTemporaryAttachment(Request $request): Response
    {
        return $this->attachments->downloadTemporaryAttachment($request);
    }
}
