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

    Route::get('/internal-users', [V5MasterDataController::class, 'employees']);
    Route::post('/internal-users', [V5MasterDataController::class, 'storeEmployee']);
    Route::put('/internal-users/{id}', [V5MasterDataController::class, 'updateEmployee']);
    Route::delete('/internal-users/{id}', [V5MasterDataController::class, 'deleteEmployee']);

    // Backward-compatible aliases for legacy frontend integrations.
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

    Route::get('/businesses', [V5MasterDataController::class, 'businesses']);
    Route::get('/products', [V5MasterDataController::class, 'products']);
    Route::get('/customer-personnel', [V5MasterDataController::class, 'customerPersonnel']);
    Route::get('/customer_personnel', [V5MasterDataController::class, 'customerPersonnel']);
    Route::get('/cus-personnel', [V5MasterDataController::class, 'customerPersonnel']);
    Route::get('/cus_personnel', [V5MasterDataController::class, 'customerPersonnel']);

    Route::get('/projects', [V5MasterDataController::class, 'projects']);
    Route::post('/projects', [V5MasterDataController::class, 'storeProject']);
    Route::put('/projects/{id}', [V5MasterDataController::class, 'updateProject']);
    Route::delete('/projects/{id}', [V5MasterDataController::class, 'deleteProject']);

    Route::get('/contracts', [V5MasterDataController::class, 'contracts']);
    Route::post('/contracts', [V5MasterDataController::class, 'storeContract']);
    Route::put('/contracts/{id}', [V5MasterDataController::class, 'updateContract']);
    Route::delete('/contracts/{id}', [V5MasterDataController::class, 'deleteContract']);
    Route::post('/contracts/{id}/generate-payments', [V5MasterDataController::class, 'generateContractPayments']);

    Route::get('/payment-schedules', [V5MasterDataController::class, 'paymentSchedules']);
    Route::put('/payment-schedules/{id}', [V5MasterDataController::class, 'updatePaymentSchedule']);

    Route::get('/opportunities', [V5MasterDataController::class, 'opportunities']);
    Route::post('/opportunities', [V5MasterDataController::class, 'storeOpportunity']);
    Route::put('/opportunities/{id}', [V5MasterDataController::class, 'updateOpportunity']);
    Route::delete('/opportunities/{id}', [V5MasterDataController::class, 'deleteOpportunity']);

    Route::get('/documents', [V5MasterDataController::class, 'documents']);
    Route::get('/reminders', [V5MasterDataController::class, 'reminders']);
    Route::get('/user-dept-history', [V5MasterDataController::class, 'userDeptHistory']);
    Route::get('/user_dept_history', [V5MasterDataController::class, 'userDeptHistory']);

    Route::get('/audit-logs', [V5MasterDataController::class, 'auditLogs']);
    Route::get('/audit_logs', [V5MasterDataController::class, 'auditLogs']);
});
