<?php

namespace App\Http\Controllers\Api\V5;

use App\Actions\V5\Invoice\BulkGenerateInvoicesAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\V5\StoreInvoiceRequest;
use App\Http\Requests\V5\StoreReceiptRequest;
use App\Http\Requests\V5\UpdateInvoiceRequest;
use App\Http\Requests\V5\UpdateReceiptRequest;
use App\Services\V5\FeeCollection\DebtAgingReportService;
use App\Services\V5\FeeCollection\FeeCollectionDashboardService;
use App\Services\V5\FeeCollection\InvoiceDomainService;
use App\Services\V5\FeeCollection\ReceiptDomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeeCollectionController extends Controller
{
    public function __construct(
        private readonly InvoiceDomainService $invoiceService,
        private readonly ReceiptDomainService $receiptService,
        private readonly FeeCollectionDashboardService $dashboardService,
        private readonly DebtAgingReportService $agingService,
        private readonly BulkGenerateInvoicesAction $bulkGenerateInvoicesAction,
    ) {}

    // ── Invoice endpoints ─────────────────────────────────────────────────────

    public function invoiceIndex(Request $request): JsonResponse
    {
        return $this->invoiceService->index($request);
    }

    public function invoiceStore(StoreInvoiceRequest $request): JsonResponse
    {
        return $this->invoiceService->store($request);
    }

    public function invoiceShow(Request $request, int $id): JsonResponse
    {
        return $this->invoiceService->show($request, $id);
    }

    public function invoiceUpdate(UpdateInvoiceRequest $request, int $id): JsonResponse
    {
        return $this->invoiceService->update($request, $id);
    }

    public function invoiceDestroy(Request $request, int $id): JsonResponse
    {
        return $this->invoiceService->destroy($request, $id);
    }

    public function invoiceBulkGenerate(Request $request): JsonResponse
    {
        return $this->bulkGenerateInvoicesAction->execute($request);
    }

    // ── Dunning endpoints ─────────────────────────────────────────────────────

    public function dunningLogIndex(Request $request, int $invoiceId): JsonResponse
    {
        return $this->invoiceService->dunningLogIndex($request, $invoiceId);
    }

    public function dunningLogStore(Request $request, int $invoiceId): JsonResponse
    {
        return $this->invoiceService->dunningLogStore($request, $invoiceId);
    }

    // ── Receipt endpoints ─────────────────────────────────────────────────────

    public function receiptIndex(Request $request): JsonResponse
    {
        return $this->receiptService->index($request);
    }

    public function receiptStore(StoreReceiptRequest $request): JsonResponse
    {
        return $this->receiptService->store($request);
    }

    public function receiptShow(Request $request, int $id): JsonResponse
    {
        return $this->receiptService->show($request, $id);
    }

    public function receiptUpdate(UpdateReceiptRequest $request, int $id): JsonResponse
    {
        return $this->receiptService->update($request, $id);
    }

    public function receiptDestroy(Request $request, int $id): JsonResponse
    {
        return $this->receiptService->destroy($request, $id);
    }

    public function receiptReverse(Request $request, int $id): JsonResponse
    {
        return $this->receiptService->reverse($request, $id);
    }

    // ── Dashboard & Report endpoints ──────────────────────────────────────────

    public function dashboard(Request $request): JsonResponse
    {
        return $this->dashboardService->dashboard($request);
    }

    public function debtAgingReport(Request $request): JsonResponse
    {
        return $this->agingService->agingReport($request);
    }

    public function debtByCustomer(Request $request): JsonResponse
    {
        return $this->agingService->debtByCustomer($request);
    }

    public function debtTrend(Request $request): JsonResponse
    {
        return $this->agingService->debtTrend($request);
    }
}
