<?php

use App\Http\Controllers\Api\V5\CustomerController;
use App\Http\Controllers\Api\V5\CustomerPersonnelController;
use Illuminate\Support\Facades\Route;

Route::get('/customers', [CustomerController::class, 'index'])
    ->middleware('permission:customers.read');
Route::get('/customers/{id}/insight', [CustomerController::class, 'insight'])
    ->middleware('permission:customers.read');
Route::get('/customers/{id}/insight/product-detail/{productId}', [CustomerController::class, 'insightProductDetail'])
    ->middleware('permission:customers.read');
Route::post('/customers', [CustomerController::class, 'store'])
    ->middleware('permission:customers.write');
Route::put('/customers/{id}', [CustomerController::class, 'update'])
    ->middleware('permission:customers.write');
Route::delete('/customers/{id}', [CustomerController::class, 'destroy'])
    ->middleware('permission:customers.delete');

Route::get('/customer-personnel', [CustomerPersonnelController::class, 'index'])
    ->middleware('permission:customer_personnel.read');
Route::post('/customer-personnel', [CustomerPersonnelController::class, 'store'])
    ->middleware('permission:customer_personnel.write');
Route::post('/customer-personnel/bulk', [CustomerPersonnelController::class, 'storeBulk'])
    ->middleware(['permission:customer_personnel.write']);
Route::put('/customer-personnel/{id}', [CustomerPersonnelController::class, 'update'])
    ->middleware('permission:customer_personnel.write');
Route::delete('/customer-personnel/{id}', [CustomerPersonnelController::class, 'destroy'])
    ->middleware('permission:customer_personnel.delete');
Route::get('/customer_personnel', [CustomerPersonnelController::class, 'index'])
    ->middleware(['permission:customer_personnel.read', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
Route::post('/customer_personnel', [CustomerPersonnelController::class, 'store'])
    ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
Route::post('/customer_personnel/bulk', [CustomerPersonnelController::class, 'storeBulk'])
    ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/bulk,2026-04-27']);
Route::put('/customer_personnel/{id}', [CustomerPersonnelController::class, 'update'])
    ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
Route::delete('/customer_personnel/{id}', [CustomerPersonnelController::class, 'destroy'])
    ->middleware(['permission:customer_personnel.delete', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
Route::get('/cus-personnel', [CustomerPersonnelController::class, 'index'])
    ->middleware(['permission:customer_personnel.read', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
Route::post('/cus-personnel', [CustomerPersonnelController::class, 'store'])
    ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
Route::post('/cus-personnel/bulk', [CustomerPersonnelController::class, 'storeBulk'])
    ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/bulk,2026-04-27']);
Route::put('/cus-personnel/{id}', [CustomerPersonnelController::class, 'update'])
    ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
Route::delete('/cus-personnel/{id}', [CustomerPersonnelController::class, 'destroy'])
    ->middleware(['permission:customer_personnel.delete', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
Route::get('/cus_personnel', [CustomerPersonnelController::class, 'index'])
    ->middleware(['permission:customer_personnel.read', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
Route::post('/cus_personnel', [CustomerPersonnelController::class, 'store'])
    ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
Route::post('/cus_personnel/bulk', [CustomerPersonnelController::class, 'storeBulk'])
    ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/bulk,2026-04-27']);
Route::put('/cus_personnel/{id}', [CustomerPersonnelController::class, 'update'])
    ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
Route::delete('/cus_personnel/{id}', [CustomerPersonnelController::class, 'destroy'])
    ->middleware(['permission:customer_personnel.delete', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
