<?php
// Simple test to check if the issue is in the ProductPackageDomainService::index method
require_once 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    // Manually instantiate the service with minimal dependencies
    $supportService = $app->make(App\Services\V5\V5DomainSupportService::class);
    $accessAuditService = $app->make(App\Services\V5\V5AccessAuditService::class);
    $productService = $app->make(App\Services\V5\Domain\ProductDomainService::class);

    $service = new App\Services\V5\Domain\ProductPackageDomainService($supportService, $accessAuditService, $productService);

    // Create a basic request
    $request = new Illuminate\Http\Request();

    // Call the index method
    $result = $service->index($request);

    echo "Success! Response: " . $result->getContent() . "\n";
} catch (Exception $e) {
    echo "Error occurred: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . " Line: " . $e->getLine() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
}