<?php

namespace App\Http\Controllers\Api\V5;

use App\Http\Requests\V5\StoreProductPackageRequest;
use App\Http\Requests\V5\UpdateProductPackageRequest;
use App\Services\V5\Domain\ProductPackageFeatureCatalogDomainService;
use App\Services\V5\Domain\ProductPackageDomainService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductPackageController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly ProductPackageDomainService $productPackageService,
        private readonly ProductPackageFeatureCatalogDomainService $productPackageFeatureCatalogService,
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->productPackageService->index($request);
    }

    public function store(StoreProductPackageRequest $request): JsonResponse
    {
        return $this->productPackageService->store($request);
    }

    public function storeBulk(Request $request): JsonResponse
    {
        return $this->productPackageService->storeBulk($request);
    }

    public function update(UpdateProductPackageRequest $request, int $id): JsonResponse
    {
        return $this->productPackageService->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->productPackageService->destroy($request, $id);
    }

    public function featureCatalog(Request $request, int $id): JsonResponse
    {
        return $this->productPackageFeatureCatalogService->show($request, $id);
    }

    public function featureCatalogList(Request $request, int $id): JsonResponse
    {
        return $this->productPackageFeatureCatalogService->list($request, $id);
    }

    public function updateFeatureCatalog(Request $request, int $id): JsonResponse
    {
        return $this->productPackageFeatureCatalogService->update($request, $id);
    }
}
