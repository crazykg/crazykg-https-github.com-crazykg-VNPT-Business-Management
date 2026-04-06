<?php

use App\Http\Controllers\Api\V5\BusinessController;
use App\Http\Controllers\Api\V5\DepartmentController;
use App\Http\Controllers\Api\V5\EmployeeController;
use App\Http\Controllers\Api\V5\EmployeePartyProfileController;
use App\Http\Controllers\Api\V5\ProductController;
use App\Http\Controllers\Api\V5\VendorController;
use Illuminate\Support\Facades\Route;

Route::get('/departments', [DepartmentController::class, 'index'])
    ->middleware('permission:departments.read');
Route::post('/departments', [DepartmentController::class, 'store'])
    ->middleware('permission:departments.write');
Route::put('/departments/{id}', [DepartmentController::class, 'update'])
    ->middleware('permission:departments.write');
Route::delete('/departments/{id}', [DepartmentController::class, 'destroy'])
    ->middleware('permission:departments.delete');

Route::get('/internal-users', [EmployeeController::class, 'index'])
    ->middleware('permission:employees.read');
Route::post('/internal-users', [EmployeeController::class, 'store'])
    ->middleware('permission:employees.write');
Route::post('/internal-users/bulk', [EmployeeController::class, 'storeBulk'])
    ->middleware(['permission:employees.write', 'throttle:api.write.heavy']);
Route::get('/internal-users/{id}/party-profile', [EmployeePartyProfileController::class, 'showForEmployee'])
    ->middleware('permission:employee_party.read');
Route::put('/internal-users/{id}/party-profile', [EmployeePartyProfileController::class, 'upsertForEmployee'])
    ->middleware('permission:employee_party.write');
Route::post('/internal-users/{id}/reset-password', [EmployeeController::class, 'resetPassword'])
    ->middleware('permission:employees.write');
Route::put('/internal-users/{id}', [EmployeeController::class, 'update'])
    ->middleware('permission:employees.write');
Route::delete('/internal-users/{id}', [EmployeeController::class, 'destroy'])
    ->middleware('permission:employees.delete');
Route::get('/employee-party-profiles', [EmployeePartyProfileController::class, 'index'])
    ->middleware('permission:employee_party.read');
Route::post('/employee-party-profiles/bulk-upsert', [EmployeePartyProfileController::class, 'bulkUpsert'])
    ->middleware(['permission:employee_party.import', 'throttle:api.write.heavy']);

Route::get('/employees', [EmployeeController::class, 'index'])
    ->middleware(['permission:employees.read', 'deprecated.route:/api/v5/internal-users,2026-04-27']);
Route::post('/employees', [EmployeeController::class, 'store'])
    ->middleware(['permission:employees.write', 'deprecated.route:/api/v5/internal-users,2026-04-27']);
Route::post('/employees/bulk', [EmployeeController::class, 'storeBulk'])
    ->middleware(['permission:employees.write', 'deprecated.route:/api/v5/internal-users/bulk,2026-04-27', 'throttle:api.write.heavy']);
Route::post('/employees/{id}/reset-password', [EmployeeController::class, 'resetPassword'])
    ->middleware(['permission:employees.write', 'deprecated.route:/api/v5/internal-users/{id}/reset-password,2026-04-27']);
Route::put('/employees/{id}', [EmployeeController::class, 'update'])
    ->middleware(['permission:employees.write', 'deprecated.route:/api/v5/internal-users/{id},2026-04-27']);
Route::delete('/employees/{id}', [EmployeeController::class, 'destroy'])
    ->middleware(['permission:employees.delete', 'deprecated.route:/api/v5/internal-users/{id},2026-04-27']);

Route::get('/vendors', [VendorController::class, 'index'])
    ->middleware('permission:vendors.read');
Route::post('/vendors', [VendorController::class, 'store'])
    ->middleware('permission:vendors.write');
Route::put('/vendors/{id}', [VendorController::class, 'update'])
    ->middleware('permission:vendors.write');
Route::delete('/vendors/{id}', [VendorController::class, 'destroy'])
    ->middleware('permission:vendors.delete');

Route::get('/businesses', [BusinessController::class, 'index'])
    ->middleware('permission:businesses.read');
Route::post('/businesses', [BusinessController::class, 'store'])
    ->middleware('permission:businesses.write');
Route::put('/businesses/{id}', [BusinessController::class, 'update'])
    ->middleware('permission:businesses.write');
Route::delete('/businesses/{id}', [BusinessController::class, 'destroy'])
    ->middleware('permission:businesses.delete');

Route::get('/products', [ProductController::class, 'index'])
    ->middleware('permission:products.read');
Route::get('/products/{id}/feature-catalog', [ProductController::class, 'featureCatalog'])
    ->middleware('permission:products.read');
Route::get('/products/{id}/feature-catalog/list', [ProductController::class, 'featureCatalogList'])
    ->middleware('permission:products.read');
Route::get('/products/{id}/target-segments', [ProductController::class, 'targetSegments'])
    ->middleware('permission:products.read');
Route::get('/products/quotations', [ProductController::class, 'quotations'])
    ->middleware('permission:products.read');
Route::get('/products/quotation-default-settings', [ProductController::class, 'quotationDefaultSettings'])
    ->middleware('permission:products.read');
Route::get('/products/quotations/{id}', [ProductController::class, 'showQuotation'])
    ->middleware('permission:products.read');
Route::get('/products/quotations/{id}/versions', [ProductController::class, 'quotationVersions'])
    ->middleware('permission:products.read');
Route::get('/products/quotations/{id}/versions/{versionId}', [ProductController::class, 'showQuotationVersion'])
    ->middleware('permission:products.read');
Route::get('/products/quotations/{id}/events', [ProductController::class, 'quotationEvents'])
    ->middleware('permission:products.read');
Route::post('/products/quotation/export-pdf', [ProductController::class, 'exportQuotationPdf'])
    ->middleware(['permission:products.read', 'throttle:api.write.heavy']);
Route::post('/products/quotation/export-word', [ProductController::class, 'exportQuotationWord'])
    ->middleware(['permission:products.read', 'throttle:api.write.heavy']);
Route::post('/products/quotation/export-excel', [ProductController::class, 'exportQuotationExcel'])
    ->middleware(['permission:products.read', 'throttle:api.write.heavy']);
Route::post('/products/quotations', [ProductController::class, 'storeQuotation'])
    ->middleware('permission:products.write');
Route::put('/products/quotation-default-settings', [ProductController::class, 'updateQuotationDefaultSettings'])
    ->middleware('permission:products.write');
Route::put('/products/quotations/{id}', [ProductController::class, 'updateQuotation'])
    ->middleware('permission:products.write');
Route::post('/products/quotations/{id}/print-word', [ProductController::class, 'printStoredQuotationWord'])
    ->middleware(['permission:products.write', 'throttle:api.write.heavy']);
Route::post('/products/bulk', [ProductController::class, 'storeBulk'])
    ->middleware('permission:products.write');
Route::post('/products', [ProductController::class, 'store'])
    ->middleware('permission:products.write');
Route::put('/products/{id}/feature-catalog', [ProductController::class, 'updateFeatureCatalog'])
    ->middleware('permission:products.write');
Route::put('/products/{id}/target-segments-sync', [ProductController::class, 'syncTargetSegments'])
    ->middleware('permission:products.write');
Route::put('/products/{id}', [ProductController::class, 'update'])
    ->middleware('permission:products.write');
Route::delete('/products/{id}', [ProductController::class, 'destroy'])
    ->middleware('permission:products.delete');
