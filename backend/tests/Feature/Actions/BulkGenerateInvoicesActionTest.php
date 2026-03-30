<?php

namespace Tests\Feature\Actions;

use App\Actions\V5\Invoice\BulkGenerateInvoicesAction;
use App\Services\V5\FeeCollection\InvoiceDomainService;
use Illuminate\Http\Request;
use Mockery;
use Tests\TestCase;

class BulkGenerateInvoicesActionTest extends TestCase
{
    public function test_execute_delegates_to_invoice_domain_service(): void
    {
        $request = Request::create('/api/v5/invoices/bulk-generate', 'POST', [
            'period_from' => '2026-03-01',
            'period_to' => '2026-03-31',
        ]);
        $response = response()->json(['data' => ['created_count' => 2]], 201);

        $invoiceService = Mockery::mock(InvoiceDomainService::class);
        $invoiceService
            ->shouldReceive('bulkGenerate')
            ->once()
            ->with($request)
            ->andReturn($response);

        $action = new BulkGenerateInvoicesAction($invoiceService);

        $this->assertSame($response, $action->execute($request));
    }
}
