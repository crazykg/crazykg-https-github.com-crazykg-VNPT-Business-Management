<?php

namespace App\Http\Controllers\Api\V5;

use App\Http\Requests\V5\StoreProductRequest;
use App\Http\Requests\V5\UpdateProductRequest;
use App\Services\V5\Domain\ProductDomainService;
use App\Services\V5\Domain\ProductFeatureCatalogDomainService;
use App\Services\V5\Domain\ProductQuotationDomainService;
use App\Services\V5\Domain\ProductQuotationExportService;
use App\Services\V5\Domain\ProductTargetSegmentDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ProductController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly ProductDomainService $productService,
        private readonly ProductFeatureCatalogDomainService $productFeatureCatalogService,
        private readonly ProductTargetSegmentDomainService $productTargetSegmentService,
        private readonly ProductQuotationDomainService $productQuotationService,
        private readonly ProductQuotationExportService $quotationExportService
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->productService->index($request);
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        return $this->productService->store($request);
    }

    public function update(UpdateProductRequest $request, int $id): JsonResponse
    {
        return $this->productService->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->productService->destroy($request, $id);
    }

    public function featureCatalog(Request $request, int $id): JsonResponse
    {
        return $this->productFeatureCatalogService->show($request, $id);
    }

    public function featureCatalogList(Request $request, int $id): JsonResponse
    {
        return $this->productFeatureCatalogService->list($request, $id);
    }

    public function updateFeatureCatalog(Request $request, int $id): JsonResponse
    {
        return $this->productFeatureCatalogService->update($request, $id);
    }

    public function targetSegments(Request $request, int $id): JsonResponse
    {
        return $this->productTargetSegmentService->index($request, $id);
    }

    public function syncTargetSegments(Request $request, int $id): JsonResponse
    {
        return $this->productTargetSegmentService->bulkSync($request, $id);
    }

    public function exportQuotationWord(Request $request): Response
    {
        return $this->quotationExportService->exportWord($request);
    }

    public function exportQuotationPdf(Request $request): Response
    {
        return $this->quotationExportService->exportPdf($request);
    }

    public function exportQuotationExcel(Request $request): Response
    {
        return $this->quotationExportService->exportExcel($request);
    }

    public function quotations(Request $request): JsonResponse
    {
        return $this->productQuotationService->index($request);
    }

    public function storeQuotation(Request $request): JsonResponse
    {
        return $this->productQuotationService->store($request);
    }

    public function showQuotation(Request $request, int $id): JsonResponse
    {
        return $this->productQuotationService->show($request, $id);
    }

    public function updateQuotation(Request $request, int $id): JsonResponse
    {
        return $this->productQuotationService->update($request, $id);
    }

    public function quotationVersions(Request $request, int $id): JsonResponse
    {
        return $this->productQuotationService->versions($request, $id);
    }

    public function showQuotationVersion(Request $request, int $id, int $versionId): JsonResponse
    {
        return $this->productQuotationService->showVersion($request, $id, $versionId);
    }

    public function quotationEvents(Request $request, int $id): JsonResponse
    {
        return $this->productQuotationService->events($request, $id);
    }

    public function printStoredQuotationWord(Request $request, int $id): Response
    {
        return $this->productQuotationService->printWord($request, $id);
    }
}
