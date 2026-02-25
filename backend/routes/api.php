<?php

use App\Http\Controllers\Api\AuthController;
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
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        Route::get('/health/tables', [V5MasterDataController::class, 'tableHealth'])
            ->middleware('permission:system.health.view');

        Route::get('/roles', [V5MasterDataController::class, 'roles'])
            ->middleware('permission:authz.manage');
        Route::get('/permissions', [V5MasterDataController::class, 'permissions'])
            ->middleware('permission:authz.manage');
        Route::get('/user-access', [V5MasterDataController::class, 'userAccess'])
            ->middleware('permission:authz.manage');
        Route::put('/user-access/{id}/roles', [V5MasterDataController::class, 'updateUserRoles'])
            ->middleware('permission:authz.manage');
        Route::put('/user-access/{id}/permissions', [V5MasterDataController::class, 'updateUserPermissions'])
            ->middleware('permission:authz.manage');
        Route::put('/user-access/{id}/dept-scopes', [V5MasterDataController::class, 'updateUserDeptScopes'])
            ->middleware('permission:authz.manage');

        Route::get('/departments', [V5MasterDataController::class, 'departments'])
            ->middleware('permission:departments.read');
        Route::post('/departments', [V5MasterDataController::class, 'storeDepartment'])
            ->middleware('permission:departments.write');
        Route::put('/departments/{id}', [V5MasterDataController::class, 'updateDepartment'])
            ->middleware('permission:departments.write');
        Route::delete('/departments/{id}', [V5MasterDataController::class, 'deleteDepartment'])
            ->middleware('permission:departments.delete');

        Route::get('/internal-users', [V5MasterDataController::class, 'employees'])
            ->middleware('permission:employees.read');
        Route::post('/internal-users', [V5MasterDataController::class, 'storeEmployee'])
            ->middleware('permission:employees.write');
        Route::put('/internal-users/{id}', [V5MasterDataController::class, 'updateEmployee'])
            ->middleware('permission:employees.write');
        Route::delete('/internal-users/{id}', [V5MasterDataController::class, 'deleteEmployee'])
            ->middleware('permission:employees.delete');

        // Backward-compatible aliases for legacy frontend integrations.
        Route::get('/employees', [V5MasterDataController::class, 'employees'])
            ->middleware('permission:employees.read');
        Route::post('/employees', [V5MasterDataController::class, 'storeEmployee'])
            ->middleware('permission:employees.write');
        Route::put('/employees/{id}', [V5MasterDataController::class, 'updateEmployee'])
            ->middleware('permission:employees.write');
        Route::delete('/employees/{id}', [V5MasterDataController::class, 'deleteEmployee'])
            ->middleware('permission:employees.delete');

        Route::get('/customers', [V5MasterDataController::class, 'customers'])
            ->middleware('permission:customers.read');
        Route::post('/customers', [V5MasterDataController::class, 'storeCustomer'])
            ->middleware('permission:customers.write');
        Route::put('/customers/{id}', [V5MasterDataController::class, 'updateCustomer'])
            ->middleware('permission:customers.write');
        Route::delete('/customers/{id}', [V5MasterDataController::class, 'deleteCustomer'])
            ->middleware('permission:customers.delete');

        Route::get('/vendors', [V5MasterDataController::class, 'vendors'])
            ->middleware('permission:vendors.read');
        Route::post('/vendors', [V5MasterDataController::class, 'storeVendor'])
            ->middleware('permission:vendors.write');
        Route::put('/vendors/{id}', [V5MasterDataController::class, 'updateVendor'])
            ->middleware('permission:vendors.write');
        Route::delete('/vendors/{id}', [V5MasterDataController::class, 'deleteVendor'])
            ->middleware('permission:vendors.delete');

        Route::get('/businesses', [V5MasterDataController::class, 'businesses'])
            ->middleware('permission:businesses.read');
        Route::get('/products', [V5MasterDataController::class, 'products'])
            ->middleware('permission:products.read');
        Route::get('/customer-personnel', [V5MasterDataController::class, 'customerPersonnel'])
            ->middleware('permission:customer_personnel.read');
        Route::get('/customer_personnel', [V5MasterDataController::class, 'customerPersonnel'])
            ->middleware('permission:customer_personnel.read');
        Route::get('/cus-personnel', [V5MasterDataController::class, 'customerPersonnel'])
            ->middleware('permission:customer_personnel.read');
        Route::get('/cus_personnel', [V5MasterDataController::class, 'customerPersonnel'])
            ->middleware('permission:customer_personnel.read');

        Route::get('/projects', [V5MasterDataController::class, 'projects'])
            ->middleware('permission:projects.read');
        Route::get('/project-items', [V5MasterDataController::class, 'projectItems'])
            ->middleware('permission:projects.read');
        Route::get('/project_items', [V5MasterDataController::class, 'projectItems'])
            ->middleware('permission:projects.read');
        Route::post('/projects', [V5MasterDataController::class, 'storeProject'])
            ->middleware('permission:projects.write');
        Route::put('/projects/{id}', [V5MasterDataController::class, 'updateProject'])
            ->middleware('permission:projects.write');
        Route::delete('/projects/{id}', [V5MasterDataController::class, 'deleteProject'])
            ->middleware('permission:projects.delete');

        Route::get('/contracts', [V5MasterDataController::class, 'contracts'])
            ->middleware('permission:contracts.read');
        Route::post('/contracts', [V5MasterDataController::class, 'storeContract'])
            ->middleware('permission:contracts.write');
        Route::put('/contracts/{id}', [V5MasterDataController::class, 'updateContract'])
            ->middleware('permission:contracts.write');
        Route::delete('/contracts/{id}', [V5MasterDataController::class, 'deleteContract'])
            ->middleware('permission:contracts.delete');
        Route::post('/contracts/{id}/generate-payments', [V5MasterDataController::class, 'generateContractPayments'])
            ->middleware('permission:contracts.payments');

        Route::get('/payment-schedules', [V5MasterDataController::class, 'paymentSchedules'])
            ->middleware('permission:contracts.read');
        Route::put('/payment-schedules/{id}', [V5MasterDataController::class, 'updatePaymentSchedule'])
            ->middleware('permission:contracts.payments');

        Route::get('/opportunities', [V5MasterDataController::class, 'opportunities'])
            ->middleware('permission:opportunities.read');
        Route::post('/opportunities', [V5MasterDataController::class, 'storeOpportunity'])
            ->middleware('permission:opportunities.write');
        Route::put('/opportunities/{id}', [V5MasterDataController::class, 'updateOpportunity'])
            ->middleware('permission:opportunities.write');
        Route::delete('/opportunities/{id}', [V5MasterDataController::class, 'deleteOpportunity'])
            ->middleware('permission:opportunities.delete');

        Route::get('/documents', [V5MasterDataController::class, 'documents'])
            ->middleware('permission:documents.read');
        Route::post('/documents', [V5MasterDataController::class, 'storeDocument'])
            ->middleware('permission:documents.write');
        Route::put('/documents/{id}', [V5MasterDataController::class, 'updateDocument'])
            ->middleware('permission:documents.write');
        Route::delete('/documents/{id}', [V5MasterDataController::class, 'deleteDocument'])
            ->middleware('permission:documents.delete');
        Route::post('/documents/upload-attachment', [V5MasterDataController::class, 'uploadDocumentAttachment'])
            ->middleware('permission:documents.write');
        Route::delete('/documents/upload-attachment', [V5MasterDataController::class, 'deleteUploadedDocumentAttachment'])
            ->middleware('permission:documents.write');
        Route::get('/integrations/google-drive', [V5MasterDataController::class, 'googleDriveIntegrationSettings'])
            ->middleware('permission:authz.manage');
        Route::put('/integrations/google-drive', [V5MasterDataController::class, 'updateGoogleDriveIntegrationSettings'])
            ->middleware('permission:authz.manage');
        Route::post('/integrations/google-drive/test', [V5MasterDataController::class, 'testGoogleDriveIntegrationSettings'])
            ->middleware('permission:authz.manage');
        Route::get('/reminders', [V5MasterDataController::class, 'reminders'])
            ->middleware('permission:reminders.read');
        Route::get('/user-dept-history', [V5MasterDataController::class, 'userDeptHistory'])
            ->middleware('permission:user_dept_history.read');
        Route::get('/user_dept_history', [V5MasterDataController::class, 'userDeptHistory'])
            ->middleware('permission:user_dept_history.read');

        Route::get('/audit-logs', [V5MasterDataController::class, 'auditLogs'])
            ->middleware('permission:audit_logs.read');
        Route::get('/audit_logs', [V5MasterDataController::class, 'auditLogs'])
            ->middleware('permission:audit_logs.read');

        Route::get('/support-service-groups', [V5MasterDataController::class, 'supportServiceGroups'])
            ->middleware('permission:support_service_groups.read');
        Route::get('/support_service_groups', [V5MasterDataController::class, 'supportServiceGroups'])
            ->middleware('permission:support_service_groups.read');
        Route::post('/support-service-groups', [V5MasterDataController::class, 'storeSupportServiceGroup'])
            ->middleware('permission:support_service_groups.write');
        Route::post('/support_service_groups', [V5MasterDataController::class, 'storeSupportServiceGroup'])
            ->middleware('permission:support_service_groups.write');

        Route::get('/support-requests', [V5MasterDataController::class, 'supportRequests'])
            ->middleware('permission:support_requests.read');
        Route::get('/support_requests', [V5MasterDataController::class, 'supportRequests'])
            ->middleware('permission:support_requests.read');
        Route::post('/support-requests', [V5MasterDataController::class, 'storeSupportRequest'])
            ->middleware('permission:support_requests.write');
        Route::post('/support_requests', [V5MasterDataController::class, 'storeSupportRequest'])
            ->middleware('permission:support_requests.write');
        Route::put('/support-requests/{id}', [V5MasterDataController::class, 'updateSupportRequest'])
            ->middleware('permission:support_requests.write');
        Route::put('/support_requests/{id}', [V5MasterDataController::class, 'updateSupportRequest'])
            ->middleware('permission:support_requests.write');
        Route::delete('/support-requests/{id}', [V5MasterDataController::class, 'deleteSupportRequest'])
            ->middleware('permission:support_requests.delete');
        Route::delete('/support_requests/{id}', [V5MasterDataController::class, 'deleteSupportRequest'])
            ->middleware('permission:support_requests.delete');
        Route::patch('/support-requests/{id}/status', [V5MasterDataController::class, 'updateSupportRequestStatus'])
            ->middleware('permission:support_requests.status');
        Route::patch('/support_requests/{id}/status', [V5MasterDataController::class, 'updateSupportRequestStatus'])
            ->middleware('permission:support_requests.status');
        Route::get('/support-requests/{id}/history', [V5MasterDataController::class, 'supportRequestHistory'])
            ->middleware('permission:support_requests.history');
        Route::get('/support_requests/{id}/history', [V5MasterDataController::class, 'supportRequestHistory'])
            ->middleware('permission:support_requests.history');
        Route::get('/support-request-history', [V5MasterDataController::class, 'supportRequestHistories'])
            ->middleware('permission:support_requests.history');
        Route::get('/support_request_history', [V5MasterDataController::class, 'supportRequestHistories'])
            ->middleware('permission:support_requests.history');
    });
});
