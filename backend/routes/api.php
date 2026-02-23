<?php

use App\Http\Controllers\Api\V5MasterDataController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
});

Route::get('/departments', function () {
    if (! Schema::hasTable('departments')) {
        return response()->json([
            'message' => 'Table departments is not available. Run domain migrations first.',
            'data' => [],
        ], 503);
    }

    return DB::table('departments')
        ->select(['dept_code', 'dept_name', 'parent_id', 'status'])
        ->orderBy('dept_code')
        ->get();
});

Route::prefix('v5')->group(function (): void {
    Route::get('/health/tables', [V5MasterDataController::class, 'tableHealth']);

    Route::get('/departments', [V5MasterDataController::class, 'departments']);
    Route::post('/departments', [V5MasterDataController::class, 'storeDepartment']);
    Route::put('/departments/{id}', [V5MasterDataController::class, 'updateDepartment']);
    Route::delete('/departments/{id}', [V5MasterDataController::class, 'deleteDepartment']);

    Route::get('/employees', [V5MasterDataController::class, 'employees']);
    Route::post('/employees', [V5MasterDataController::class, 'storeEmployee']);
    Route::put('/employees/{id}', [V5MasterDataController::class, 'updateEmployee']);
    Route::delete('/employees/{id}', [V5MasterDataController::class, 'deleteEmployee']);

    Route::get('/customers', [V5MasterDataController::class, 'customers']);
    Route::post('/customers', [V5MasterDataController::class, 'storeCustomer']);
    Route::put('/customers/{id}', [V5MasterDataController::class, 'updateCustomer']);
    Route::delete('/customers/{id}', [V5MasterDataController::class, 'deleteCustomer']);

    Route::get('/vendors', [V5MasterDataController::class, 'vendors']);
    Route::post('/vendors', [V5MasterDataController::class, 'storeVendor']);
    Route::put('/vendors/{id}', [V5MasterDataController::class, 'updateVendor']);
    Route::delete('/vendors/{id}', [V5MasterDataController::class, 'deleteVendor']);

    Route::get('/projects', [V5MasterDataController::class, 'projects']);
    Route::post('/projects', [V5MasterDataController::class, 'storeProject']);
    Route::put('/projects/{id}', [V5MasterDataController::class, 'updateProject']);
    Route::delete('/projects/{id}', [V5MasterDataController::class, 'deleteProject']);

    Route::get('/contracts', [V5MasterDataController::class, 'contracts']);
    Route::post('/contracts', [V5MasterDataController::class, 'storeContract']);
    Route::put('/contracts/{id}', [V5MasterDataController::class, 'updateContract']);
    Route::delete('/contracts/{id}', [V5MasterDataController::class, 'deleteContract']);

    Route::get('/opportunities', [V5MasterDataController::class, 'opportunities']);
    Route::post('/opportunities', [V5MasterDataController::class, 'storeOpportunity']);
    Route::put('/opportunities/{id}', [V5MasterDataController::class, 'updateOpportunity']);
    Route::delete('/opportunities/{id}', [V5MasterDataController::class, 'deleteOpportunity']);
});
