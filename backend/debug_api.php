<?php
require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\Auth;

try {
    // Initialize Laravel application
    $app = require_once 'bootstrap/app.php';

    // Create a request to the product-packages endpoint
    $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
    $kernel->bootstrap();

    // Get the route
    $router = $app['router'];

    // Try to manually call the index method of ProductPackageDomainService
    $container = $app;
    $productPackageService = $container->make(App\Services\V5\Domain\ProductPackageDomainService::class);

    // Create a mock request
    $request = new Illuminate\Http\Request();
    $request->setMethod('GET');

    // Call the index method directly to see the actual error
    $result = $productPackageService->index($request);

    var_dump($result->getContent());
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}