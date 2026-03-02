<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\V5\ContractController;
use App\Http\Controllers\Api\V5\CustomerController;
use App\Http\Controllers\Api\V5\DepartmentController;
use App\Http\Controllers\Api\V5\OpportunityController;
use App\Http\Controllers\Api\V5\ProjectController;
use App\Http\Controllers\Api\V5\VendorController;
use App\Http\Controllers\Api\V5MasterDataController;
use App\Http\Controllers\ProgrammingRequestController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');

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
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:auth.login');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::get('/bootstrap', [AuthController::class, 'bootstrap']);
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

        Route::get('/departments', [DepartmentController::class, 'index'])
            ->middleware('permission:departments.read');
        Route::post('/departments', [DepartmentController::class, 'store'])
            ->middleware('permission:departments.write');
        Route::put('/departments/{id}', [DepartmentController::class, 'update'])
            ->middleware('permission:departments.write');
        Route::delete('/departments/{id}', [DepartmentController::class, 'destroy'])
            ->middleware('permission:departments.delete');

        Route::get('/internal-users', [V5MasterDataController::class, 'employees'])
            ->middleware('permission:employees.read');
        Route::post('/internal-users', [V5MasterDataController::class, 'storeEmployee'])
            ->middleware('permission:employees.write');
        Route::post('/internal-users/bulk', [V5MasterDataController::class, 'storeEmployeesBulk'])
            ->middleware('permission:employees.write');
        Route::put('/internal-users/{id}', [V5MasterDataController::class, 'updateEmployee'])
            ->middleware('permission:employees.write');
        Route::delete('/internal-users/{id}', [V5MasterDataController::class, 'deleteEmployee'])
            ->middleware('permission:employees.delete');

        // Backward-compatible aliases for legacy frontend integrations.
        Route::get('/employees', [V5MasterDataController::class, 'employees'])
            ->middleware(['permission:employees.read', 'deprecated.route:/api/v5/internal-users,2026-04-27']);
        Route::post('/employees', [V5MasterDataController::class, 'storeEmployee'])
            ->middleware(['permission:employees.write', 'deprecated.route:/api/v5/internal-users,2026-04-27']);
        Route::post('/employees/bulk', [V5MasterDataController::class, 'storeEmployeesBulk'])
            ->middleware(['permission:employees.write', 'deprecated.route:/api/v5/internal-users/bulk,2026-04-27']);
        Route::put('/employees/{id}', [V5MasterDataController::class, 'updateEmployee'])
            ->middleware(['permission:employees.write', 'deprecated.route:/api/v5/internal-users/{id},2026-04-27']);
        Route::delete('/employees/{id}', [V5MasterDataController::class, 'deleteEmployee'])
            ->middleware(['permission:employees.delete', 'deprecated.route:/api/v5/internal-users/{id},2026-04-27']);

        Route::get('/customers', [CustomerController::class, 'index'])
            ->middleware('permission:customers.read');
        Route::post('/customers', [CustomerController::class, 'store'])
            ->middleware('permission:customers.write');
        Route::put('/customers/{id}', [CustomerController::class, 'update'])
            ->middleware('permission:customers.write');
        Route::delete('/customers/{id}', [CustomerController::class, 'destroy'])
            ->middleware('permission:customers.delete');

        Route::get('/vendors', [VendorController::class, 'index'])
            ->middleware('permission:vendors.read');
        Route::post('/vendors', [VendorController::class, 'store'])
            ->middleware('permission:vendors.write');
        Route::put('/vendors/{id}', [VendorController::class, 'update'])
            ->middleware('permission:vendors.write');
        Route::delete('/vendors/{id}', [VendorController::class, 'destroy'])
            ->middleware('permission:vendors.delete');

        Route::get('/businesses', [V5MasterDataController::class, 'businesses'])
            ->middleware('permission:businesses.read');
        Route::post('/businesses', [V5MasterDataController::class, 'storeBusiness'])
            ->middleware('permission:businesses.write');
        Route::put('/businesses/{id}', [V5MasterDataController::class, 'updateBusiness'])
            ->middleware('permission:businesses.write');
        Route::delete('/businesses/{id}', [V5MasterDataController::class, 'deleteBusiness'])
            ->middleware('permission:businesses.delete');
        Route::get('/products', [V5MasterDataController::class, 'products'])
            ->middleware('permission:products.read');
        Route::post('/products', [V5MasterDataController::class, 'storeProduct'])
            ->middleware('permission:products.write');
        Route::put('/products/{id}', [V5MasterDataController::class, 'updateProduct'])
            ->middleware('permission:products.write');
        Route::delete('/products/{id}', [V5MasterDataController::class, 'deleteProduct'])
            ->middleware('permission:products.delete');
        Route::get('/customer-personnel', [V5MasterDataController::class, 'customerPersonnel'])
            ->middleware('permission:customer_personnel.read');
        Route::post('/customer-personnel', [V5MasterDataController::class, 'storeCustomerPersonnel'])
            ->middleware('permission:customer_personnel.write');
        Route::put('/customer-personnel/{id}', [V5MasterDataController::class, 'updateCustomerPersonnel'])
            ->middleware('permission:customer_personnel.write');
        Route::delete('/customer-personnel/{id}', [V5MasterDataController::class, 'deleteCustomerPersonnel'])
            ->middleware('permission:customer_personnel.delete');
        Route::get('/customer_personnel', [V5MasterDataController::class, 'customerPersonnel'])
            ->middleware(['permission:customer_personnel.read', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::post('/customer_personnel', [V5MasterDataController::class, 'storeCustomerPersonnel'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::put('/customer_personnel/{id}', [V5MasterDataController::class, 'updateCustomerPersonnel'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
        Route::delete('/customer_personnel/{id}', [V5MasterDataController::class, 'deleteCustomerPersonnel'])
            ->middleware(['permission:customer_personnel.delete', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
        Route::get('/cus-personnel', [V5MasterDataController::class, 'customerPersonnel'])
            ->middleware(['permission:customer_personnel.read', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::post('/cus-personnel', [V5MasterDataController::class, 'storeCustomerPersonnel'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::put('/cus-personnel/{id}', [V5MasterDataController::class, 'updateCustomerPersonnel'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
        Route::delete('/cus-personnel/{id}', [V5MasterDataController::class, 'deleteCustomerPersonnel'])
            ->middleware(['permission:customer_personnel.delete', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
        Route::get('/cus_personnel', [V5MasterDataController::class, 'customerPersonnel'])
            ->middleware(['permission:customer_personnel.read', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::post('/cus_personnel', [V5MasterDataController::class, 'storeCustomerPersonnel'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::put('/cus_personnel/{id}', [V5MasterDataController::class, 'updateCustomerPersonnel'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
        Route::delete('/cus_personnel/{id}', [V5MasterDataController::class, 'deleteCustomerPersonnel'])
            ->middleware(['permission:customer_personnel.delete', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);

        Route::get('/projects', [ProjectController::class, 'index'])
            ->middleware('permission:projects.read');
        Route::get('/projects/raci-assignments', [ProjectController::class, 'raciAssignments'])
            ->middleware('permission:projects.read');
        Route::get('/projects/{id}', [ProjectController::class, 'show'])
            ->middleware('permission:projects.read');
        Route::get('/project-items', [V5MasterDataController::class, 'projectItems'])
            ->middleware('permission:projects.read');
        Route::get('/project_items', [V5MasterDataController::class, 'projectItems'])
            ->middleware(['permission:projects.read', 'deprecated.route:/api/v5/project-items,2026-04-27']);
        Route::post('/projects', [ProjectController::class, 'store'])
            ->middleware('permission:projects.write');
        Route::put('/projects/{id}', [ProjectController::class, 'update'])
            ->middleware('permission:projects.write');
        Route::delete('/projects/{id}', [ProjectController::class, 'destroy'])
            ->middleware('permission:projects.delete');

        Route::get('/contracts', [ContractController::class, 'index'])
            ->middleware('permission:contracts.read');
        Route::post('/contracts', [ContractController::class, 'store'])
            ->middleware('permission:contracts.write');
        Route::put('/contracts/{id}', [ContractController::class, 'update'])
            ->middleware('permission:contracts.write');
        Route::delete('/contracts/{id}', [ContractController::class, 'destroy'])
            ->middleware('permission:contracts.delete');
        Route::post('/contracts/{id}/generate-payments', [V5MasterDataController::class, 'generateContractPayments'])
            ->middleware('permission:contracts.payments');

        Route::get('/payment-schedules', [V5MasterDataController::class, 'paymentSchedules'])
            ->middleware('permission:contracts.read');
        Route::put('/payment-schedules/{id}', [V5MasterDataController::class, 'updatePaymentSchedule'])
            ->middleware('permission:contracts.payments');

        Route::get('/opportunities', [OpportunityController::class, 'index'])
            ->middleware('permission:opportunities.read');
        Route::post('/opportunities', [OpportunityController::class, 'store'])
            ->middleware('permission:opportunities.write');
        Route::put('/opportunities/{id}', [OpportunityController::class, 'update'])
            ->middleware('permission:opportunities.write');
        Route::delete('/opportunities/{id}', [OpportunityController::class, 'destroy'])
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
        Route::get('/utilities/contract-expiry-alert', [V5MasterDataController::class, 'contractExpiryAlertSettings'])
            ->middleware('permission:authz.manage');
        Route::put('/utilities/contract-expiry-alert', [V5MasterDataController::class, 'updateContractExpiryAlertSettings'])
            ->middleware('permission:authz.manage');
        Route::get('/utilities/contract-payment-alert', [V5MasterDataController::class, 'contractPaymentAlertSettings'])
            ->middleware('permission:authz.manage');
        Route::put('/utilities/contract-payment-alert', [V5MasterDataController::class, 'updateContractPaymentAlertSettings'])
            ->middleware('permission:authz.manage');
        Route::get('/reminders', [V5MasterDataController::class, 'reminders'])
            ->middleware('permission:reminders.read');
        Route::get('/user-dept-history', [V5MasterDataController::class, 'userDeptHistory'])
            ->middleware('permission:user_dept_history.read');
        Route::get('/user_dept_history', [V5MasterDataController::class, 'userDeptHistory'])
            ->middleware(['permission:user_dept_history.read', 'deprecated.route:/api/v5/user-dept-history,2026-04-27']);

        Route::get('/audit-logs', [V5MasterDataController::class, 'auditLogs'])
            ->middleware('permission:audit_logs.read');
        Route::get('/audit_logs', [V5MasterDataController::class, 'auditLogs'])
            ->middleware(['permission:audit_logs.read', 'deprecated.route:/api/v5/audit-logs,2026-04-27']);

        Route::get('/support-service-groups', [V5MasterDataController::class, 'supportServiceGroups'])
            ->middleware('permission:support_service_groups.read');
        Route::get('/support_service_groups', [V5MasterDataController::class, 'supportServiceGroups'])
            ->middleware(['permission:support_service_groups.read', 'deprecated.route:/api/v5/support-service-groups,2026-04-27']);
        Route::post('/support-service-groups', [V5MasterDataController::class, 'storeSupportServiceGroup'])
            ->middleware('permission:support_service_groups.write');
        Route::post('/support-service-groups/bulk', [V5MasterDataController::class, 'storeSupportServiceGroupsBulk'])
            ->middleware('permission:support_service_groups.write');
        Route::put('/support-service-groups/{id}', [V5MasterDataController::class, 'updateSupportServiceGroup'])
            ->middleware('permission:support_service_groups.write');
        Route::post('/support_service_groups', [V5MasterDataController::class, 'storeSupportServiceGroup'])
            ->middleware(['permission:support_service_groups.write', 'deprecated.route:/api/v5/support-service-groups,2026-04-27']);
        Route::post('/support_service_groups/bulk', [V5MasterDataController::class, 'storeSupportServiceGroupsBulk'])
            ->middleware(['permission:support_service_groups.write', 'deprecated.route:/api/v5/support-service-groups/bulk,2026-04-27']);
        Route::put('/support_service_groups/{id}', [V5MasterDataController::class, 'updateSupportServiceGroup'])
            ->middleware(['permission:support_service_groups.write', 'deprecated.route:/api/v5/support-service-groups/{id},2026-04-27']);

        Route::get('/support-request-statuses', [V5MasterDataController::class, 'supportRequestStatuses'])
            ->middleware('permission:support_requests.read');
        Route::get('/support_request_statuses', [V5MasterDataController::class, 'supportRequestStatuses'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/support-request-statuses,2026-04-27']);
        Route::post('/support-request-statuses', [V5MasterDataController::class, 'storeSupportRequestStatus'])
            ->middleware('permission:support_requests.write');
        Route::post('/support-request-statuses/bulk', [V5MasterDataController::class, 'storeSupportRequestStatusesBulk'])
            ->middleware('permission:support_requests.write');
        Route::put('/support-request-statuses/{id}', [V5MasterDataController::class, 'updateSupportRequestStatusDefinition'])
            ->middleware('permission:support_requests.write');
        Route::post('/support_request_statuses', [V5MasterDataController::class, 'storeSupportRequestStatus'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-request-statuses,2026-04-27']);
        Route::post('/support_request_statuses/bulk', [V5MasterDataController::class, 'storeSupportRequestStatusesBulk'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-request-statuses/bulk,2026-04-27']);
        Route::put('/support_request_statuses/{id}', [V5MasterDataController::class, 'updateSupportRequestStatusDefinition'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-request-statuses/{id},2026-04-27']);

        Route::get('/opportunity-stages', [V5MasterDataController::class, 'opportunityStages'])
            ->middleware('permission:opportunities.read');
        Route::get('/opportunity_stages', [V5MasterDataController::class, 'opportunityStages'])
            ->middleware(['permission:opportunities.read', 'deprecated.route:/api/v5/opportunity-stages,2026-04-27']);
        Route::post('/opportunity-stages', [V5MasterDataController::class, 'storeOpportunityStage'])
            ->middleware('permission:opportunities.write');
        Route::put('/opportunity-stages/{id}', [V5MasterDataController::class, 'updateOpportunityStage'])
            ->middleware('permission:opportunities.write');
        Route::post('/opportunity_stages', [V5MasterDataController::class, 'storeOpportunityStage'])
            ->middleware(['permission:opportunities.write', 'deprecated.route:/api/v5/opportunity-stages,2026-04-27']);
        Route::put('/opportunity_stages/{id}', [V5MasterDataController::class, 'updateOpportunityStage'])
            ->middleware(['permission:opportunities.write', 'deprecated.route:/api/v5/opportunity-stages/{id},2026-04-27']);

        Route::get('/support-requests/receivers', [V5MasterDataController::class, 'supportRequestReceivers'])
            ->middleware('permission:support_requests.read');
        Route::get('/support_requests/receivers', [V5MasterDataController::class, 'supportRequestReceivers'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/support-requests/receivers,2026-04-27']);
        Route::get('/support-requests/reference-search', [V5MasterDataController::class, 'supportRequestReferenceSearch'])
            ->middleware('permission:support_requests.read');
        Route::get('/support_requests/reference_search', [V5MasterDataController::class, 'supportRequestReferenceSearch'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/support-requests/reference-search,2026-04-27']);
        Route::get('/support-requests/export', [V5MasterDataController::class, 'exportSupportRequests'])
            ->middleware('permission:support_requests.read');
        Route::get('/support_requests/export', [V5MasterDataController::class, 'exportSupportRequests'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/support-requests/export,2026-04-27']);

        Route::get('/support-requests', [V5MasterDataController::class, 'supportRequests'])
            ->middleware('permission:support_requests.read');
        Route::get('/support_requests', [V5MasterDataController::class, 'supportRequests'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/support-requests,2026-04-27']);
        Route::post('/support-requests', [V5MasterDataController::class, 'storeSupportRequest'])
            ->middleware('permission:support_requests.write');
        Route::post('/support-requests/bulk', [V5MasterDataController::class, 'storeSupportRequestsBulk'])
            ->middleware('permission:support_requests.write');
        Route::post('/support_requests', [V5MasterDataController::class, 'storeSupportRequest'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-requests,2026-04-27']);
        Route::post('/support_requests/bulk', [V5MasterDataController::class, 'storeSupportRequestsBulk'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-requests/bulk,2026-04-27']);
        Route::put('/support-requests/{id}', [V5MasterDataController::class, 'updateSupportRequest'])
            ->middleware('permission:support_requests.write');
        Route::put('/support_requests/{id}', [V5MasterDataController::class, 'updateSupportRequest'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-requests/{id},2026-04-27']);
        Route::delete('/support-requests/{id}', [V5MasterDataController::class, 'deleteSupportRequest'])
            ->middleware('permission:support_requests.delete');
        Route::delete('/support_requests/{id}', [V5MasterDataController::class, 'deleteSupportRequest'])
            ->middleware(['permission:support_requests.delete', 'deprecated.route:/api/v5/support-requests/{id},2026-04-27']);
        Route::patch('/support-requests/{id}/status', [V5MasterDataController::class, 'updateSupportRequestStatus'])
            ->middleware('permission:support_requests.status');
        Route::patch('/support_requests/{id}/status', [V5MasterDataController::class, 'updateSupportRequestStatus'])
            ->middleware(['permission:support_requests.status', 'deprecated.route:/api/v5/support-requests/{id}/status,2026-04-27']);
        Route::get('/support-requests/{id}/history', [V5MasterDataController::class, 'supportRequestHistory'])
            ->middleware('permission:support_requests.history');
        Route::get('/support_requests/{id}/history', [V5MasterDataController::class, 'supportRequestHistory'])
            ->middleware(['permission:support_requests.history', 'deprecated.route:/api/v5/support-requests/{id}/history,2026-04-27']);
        Route::get('/support-request-history', [V5MasterDataController::class, 'supportRequestHistories'])
            ->middleware('permission:support_requests.history');
        Route::get('/support_request_history', [V5MasterDataController::class, 'supportRequestHistories'])
            ->middleware(['permission:support_requests.history', 'deprecated.route:/api/v5/support-request-history,2026-04-27']);

        Route::get('/programming-requests', [ProgrammingRequestController::class, 'index'])
            ->middleware('permission:support_requests.read');
        Route::get('/programming_requests', [ProgrammingRequestController::class, 'index'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/programming-requests,2026-04-27']);
        Route::get('/programming-requests/reference-search', [ProgrammingRequestController::class, 'referenceSearch'])
            ->middleware('permission:support_requests.read');
        Route::get('/programming_requests/reference_search', [ProgrammingRequestController::class, 'referenceSearch'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/programming-requests/reference-search,2026-04-27']);
        Route::get('/programming-requests/export', [ProgrammingRequestController::class, 'export'])
            ->middleware('permission:support_requests.read');
        Route::get('/programming_requests/export', [ProgrammingRequestController::class, 'export'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/programming-requests/export,2026-04-27']);
        Route::get('/programming-requests/next-code', [ProgrammingRequestController::class, 'nextCode'])
            ->middleware('permission:support_requests.read');
        Route::get('/programming_requests/next_code', [ProgrammingRequestController::class, 'nextCode'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/programming-requests/next-code,2026-04-27']);
        Route::post('/programming-requests', [ProgrammingRequestController::class, 'store'])
            ->middleware('permission:support_requests.write');
        Route::post('/programming_requests', [ProgrammingRequestController::class, 'store'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/programming-requests,2026-04-27']);
        Route::get('/programming-requests/{id}', [ProgrammingRequestController::class, 'show'])
            ->middleware('permission:support_requests.read');
        Route::get('/programming_requests/{id}', [ProgrammingRequestController::class, 'show'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/programming-requests/{id},2026-04-27']);
        Route::put('/programming-requests/{id}', [ProgrammingRequestController::class, 'update'])
            ->middleware('permission:support_requests.write');
        Route::put('/programming_requests/{id}', [ProgrammingRequestController::class, 'update'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/programming-requests/{id},2026-04-27']);
        Route::delete('/programming-requests/{id}', [ProgrammingRequestController::class, 'destroy'])
            ->middleware('permission:support_requests.delete');
        Route::delete('/programming_requests/{id}', [ProgrammingRequestController::class, 'destroy'])
            ->middleware(['permission:support_requests.delete', 'deprecated.route:/api/v5/programming-requests/{id},2026-04-27']);

        Route::get('/programming-requests/{id}/worklogs', [ProgrammingRequestController::class, 'worklogIndex'])
            ->middleware('permission:support_requests.read');
        Route::get('/programming_requests/{id}/worklogs', [ProgrammingRequestController::class, 'worklogIndex'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/programming-requests/{id}/worklogs,2026-04-27']);
        Route::post('/programming-requests/{id}/worklogs', [ProgrammingRequestController::class, 'worklogStore'])
            ->middleware('permission:support_requests.write');
        Route::post('/programming_requests/{id}/worklogs', [ProgrammingRequestController::class, 'worklogStore'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/programming-requests/{id}/worklogs,2026-04-27']);
        Route::put('/programming-requests/{id}/worklogs/{worklogId}', [ProgrammingRequestController::class, 'worklogUpdate'])
            ->middleware('permission:support_requests.write');
        Route::put('/programming_requests/{id}/worklogs/{worklogId}', [ProgrammingRequestController::class, 'worklogUpdate'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/programming-requests/{id}/worklogs/{worklogId},2026-04-27']);
        Route::delete('/programming-requests/{id}/worklogs/{worklogId}', [ProgrammingRequestController::class, 'worklogDestroy'])
            ->middleware('permission:support_requests.delete');
        Route::delete('/programming_requests/{id}/worklogs/{worklogId}', [ProgrammingRequestController::class, 'worklogDestroy'])
            ->middleware(['permission:support_requests.delete', 'deprecated.route:/api/v5/programming-requests/{id}/worklogs/{worklogId},2026-04-27']);
    });
});
