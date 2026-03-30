<?php

namespace App\Actions\V5\Invoice;

use App\Services\V5\FeeCollection\InvoiceDomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BulkGenerateInvoicesAction
{
    public function __construct(
        private readonly InvoiceDomainService $invoiceService,
    ) {}

    public function execute(Request $request): JsonResponse
    {
        return $this->invoiceService->bulkGenerate($request);
    }
}
