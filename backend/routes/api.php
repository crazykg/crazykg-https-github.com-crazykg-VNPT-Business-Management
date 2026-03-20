<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\V5\AuditLogController;
use App\Http\Controllers\Api\V5\AsyncExportController;
use App\Http\Controllers\Api\V5\BusinessController;
use App\Http\Controllers\Api\V5\ContractController;
use App\Http\Controllers\Api\V5\CustomerController;
use App\Http\Controllers\Api\V5\CustomerPersonnelController;
use App\Http\Controllers\Api\V5\CustomerRequestCaseController;
use App\Http\Controllers\Api\V5\DepartmentController;
use App\Http\Controllers\Api\V5\DepartmentWeeklyScheduleController;
use App\Http\Controllers\Api\V5\EmployeeController;
use App\Http\Controllers\Api\V5\OpportunityController;
use App\Http\Controllers\Api\V5\ProjectController;
use App\Http\Controllers\Api\V5\ProjectProcedureController;
use App\Http\Controllers\Api\V5\FeedbackController;
use App\Http\Controllers\Api\V5\MonthlyCalendarController;
use App\Http\Controllers\Api\V5\SystemHealthController;
use App\Http\Controllers\Api\V5\ProductController;
use App\Http\Controllers\Api\V5\SupportContactPositionController;
use App\Http\Controllers\Api\V5\VendorController;
use App\Http\Controllers\Api\V5\UserAccessController;
use App\Http\Controllers\Api\V5\WorkflowConfigController;
use App\Http\Controllers\Api\V5\YeuCauController;
use App\Http\Controllers\Api\V5MasterDataController;
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
    Route::post('/auth/refresh', [AuthController::class, 'refresh'])
        ->middleware('throttle:auth.refresh');

    Route::get('/documents/attachments/{id}/download', [V5MasterDataController::class, 'downloadDocumentAttachment'])
        ->name('v5.documents.attachments.download')
        ->middleware('signed:relative');
    Route::get('/attachments/{id}/download', [V5MasterDataController::class, 'downloadAttachment'])
        ->name('v5.attachments.download')
        ->middleware('signed:relative');
    Route::get('/documents/attachments/temp-download', [V5MasterDataController::class, 'downloadTemporaryDocumentAttachment'])
        ->name('v5.documents.attachments.temp-download')
        ->middleware('signed:relative');

    Route::middleware(['auth:sanctum', 'throttle:api.write'])->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        // ★ Tab claim — không cần EnsureActiveTab (tab đang khởi tạo session của mình)
        Route::post('/auth/tab/claim', [AuthController::class, 'tabClaim']);
    });

    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(function (): void {
        Route::get('/bootstrap', [AuthController::class, 'bootstrap']);

        Route::get('/health/tables', [SystemHealthController::class, 'tables'])
            ->middleware('permission:system.health.view');

        Route::get('/roles', [UserAccessController::class, 'roles'])
            ->middleware('permission:authz.manage');
        Route::get('/permissions', [UserAccessController::class, 'permissions'])
            ->middleware('permission:authz.manage');
        Route::get('/user-access', [UserAccessController::class, 'index'])
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

        Route::get('/department-weekly-schedules', [DepartmentWeeklyScheduleController::class, 'index'])
            ->middleware('permission:support_requests.read');
        Route::get('/department-weekly-schedules/{id}', [DepartmentWeeklyScheduleController::class, 'show'])
            ->middleware('permission:support_requests.read');
        Route::post('/department-weekly-schedules', [DepartmentWeeklyScheduleController::class, 'store'])
            ->middleware('permission:support_requests.write');
        Route::put('/department-weekly-schedules/{id}', [DepartmentWeeklyScheduleController::class, 'update'])
            ->middleware('permission:support_requests.write');
        Route::delete('/department-weekly-schedules/{scheduleId}/entries/{entryId}', [DepartmentWeeklyScheduleController::class, 'destroyEntry'])
            ->middleware('permission:support_requests.write');
        Route::delete('/department-weekly-schedules/{id}', [DepartmentWeeklyScheduleController::class, 'destroy'])
            ->middleware('permission:support_requests.write');

        Route::get('/yeu-cau/processes', [YeuCauController::class, 'processCatalog'])
            ->middleware('permission:support_requests.read');
        Route::get('/yeu-cau/processes/{processCode}', [YeuCauController::class, 'processDefinition'])
            ->middleware('permission:support_requests.read');
        Route::get('/yeu-cau', [YeuCauController::class, 'index'])
            ->middleware('permission:support_requests.read');
        Route::post('/yeu-cau', [YeuCauController::class, 'store'])
            ->middleware('permission:support_requests.write');
        Route::get('/yeu-cau/{id}/timeline', [YeuCauController::class, 'timeline'])
            ->middleware('permission:support_requests.read');
        Route::get('/yeu-cau/{id}/people', [YeuCauController::class, 'people'])
            ->middleware('permission:support_requests.read');
        Route::get('/yeu-cau/{id}/processes/{processCode}', [YeuCauController::class, 'showProcess'])
            ->middleware('permission:support_requests.read');
        Route::post('/yeu-cau/{id}/processes/{processCode}', [YeuCauController::class, 'saveProcess'])
            ->middleware('permission:support_requests.write');
        Route::get('/yeu-cau/{id}', [YeuCauController::class, 'show'])
            ->middleware('permission:support_requests.read');

        Route::get('/customer-request-statuses', [CustomerRequestCaseController::class, 'statusCatalog'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-status-transitions', [CustomerRequestCaseController::class, 'statusTransitions'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases', [CustomerRequestCaseController::class, 'index'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/statuses/{statusCode}', [CustomerRequestCaseController::class, 'indexByStatus'])
            ->middleware('permission:support_requests.read');
        Route::post('/customer-request-cases', [CustomerRequestCaseController::class, 'store'])
            ->middleware('permission:support_requests.write');
        Route::get('/customer-request-cases/{id}/timeline', [CustomerRequestCaseController::class, 'timeline'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/{id}/people', [CustomerRequestCaseController::class, 'people'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/{id}/worklogs', [CustomerRequestCaseController::class, 'worklogs'])
            ->middleware('permission:support_requests.read');
        Route::post('/customer-request-cases/{id}/worklogs', [CustomerRequestCaseController::class, 'storeWorklog'])
            ->middleware('permission:support_requests.write');
        Route::get('/customer-request-cases/{id}/statuses/{statusCode}', [CustomerRequestCaseController::class, 'showStatus'])
            ->middleware('permission:support_requests.read');
        Route::post('/customer-request-cases/{id}/statuses/{statusCode}', [CustomerRequestCaseController::class, 'saveStatus'])
            ->middleware('permission:support_requests.write');
        Route::post('/customer-request-cases/{id}/transition', [CustomerRequestCaseController::class, 'transition'])
            ->middleware('permission:support_requests.write');
        Route::delete('/customer-request-cases/{id}', [CustomerRequestCaseController::class, 'destroy'])
            ->middleware('permission:support_requests.delete');
        Route::get('/customer-request-cases/{id}', [CustomerRequestCaseController::class, 'show'])
            ->middleware('permission:support_requests.read');

        Route::get('/internal-users', [EmployeeController::class, 'index'])
            ->middleware('permission:employees.read');
        Route::post('/internal-users', [EmployeeController::class, 'store'])
            ->middleware('permission:employees.write');
        Route::post('/internal-users/bulk', [EmployeeController::class, 'storeBulk'])
            ->middleware(['permission:employees.write', 'throttle:api.write.heavy']);
        Route::post('/internal-users/{id}/reset-password', [EmployeeController::class, 'resetPassword'])
            ->middleware('permission:employees.write');
        Route::put('/internal-users/{id}', [EmployeeController::class, 'update'])
            ->middleware('permission:employees.write');
        Route::delete('/internal-users/{id}', [EmployeeController::class, 'destroy'])
            ->middleware('permission:employees.delete');

        // Backward-compatible aliases for legacy frontend integrations.
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
        Route::post('/products', [ProductController::class, 'store'])
            ->middleware('permission:products.write');
        Route::put('/products/{id}', [ProductController::class, 'update'])
            ->middleware('permission:products.write');
        Route::delete('/products/{id}', [ProductController::class, 'destroy'])
            ->middleware('permission:products.delete');
        Route::get('/customer-personnel', [CustomerPersonnelController::class, 'index'])
            ->middleware('permission:customer_personnel.read');
        Route::post('/customer-personnel', [CustomerPersonnelController::class, 'store'])
            ->middleware('permission:customer_personnel.write');
        Route::put('/customer-personnel/{id}', [CustomerPersonnelController::class, 'update'])
            ->middleware('permission:customer_personnel.write');
        Route::delete('/customer-personnel/{id}', [CustomerPersonnelController::class, 'destroy'])
            ->middleware('permission:customer_personnel.delete');
        Route::get('/customer_personnel', [CustomerPersonnelController::class, 'index'])
            ->middleware(['permission:customer_personnel.read', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::post('/customer_personnel', [CustomerPersonnelController::class, 'store'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::put('/customer_personnel/{id}', [CustomerPersonnelController::class, 'update'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
        Route::delete('/customer_personnel/{id}', [CustomerPersonnelController::class, 'destroy'])
            ->middleware(['permission:customer_personnel.delete', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
        Route::get('/cus-personnel', [CustomerPersonnelController::class, 'index'])
            ->middleware(['permission:customer_personnel.read', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::post('/cus-personnel', [CustomerPersonnelController::class, 'store'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::put('/cus-personnel/{id}', [CustomerPersonnelController::class, 'update'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
        Route::delete('/cus-personnel/{id}', [CustomerPersonnelController::class, 'destroy'])
            ->middleware(['permission:customer_personnel.delete', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
        Route::get('/cus_personnel', [CustomerPersonnelController::class, 'index'])
            ->middleware(['permission:customer_personnel.read', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::post('/cus_personnel', [CustomerPersonnelController::class, 'store'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel,2026-04-27']);
        Route::put('/cus_personnel/{id}', [CustomerPersonnelController::class, 'update'])
            ->middleware(['permission:customer_personnel.write', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);
        Route::delete('/cus_personnel/{id}', [CustomerPersonnelController::class, 'destroy'])
            ->middleware(['permission:customer_personnel.delete', 'deprecated.route:/api/v5/customer-personnel/{id},2026-04-27']);

        Route::get('/projects', [ProjectController::class, 'index'])
            ->middleware('permission:projects.read');
        Route::get('/projects/raci-assignments', [ProjectController::class, 'raciAssignments'])
            ->middleware('permission:projects.read');
        Route::get('/projects/{id}', [ProjectController::class, 'show'])
            ->middleware('permission:projects.read');
        Route::get('/project-items', [ProjectController::class, 'projectItems'])
            ->middleware('permission:projects.read');
        Route::get('/project_items', [ProjectController::class, 'projectItems'])
            ->middleware(['permission:projects.read', 'deprecated.route:/api/v5/project-items,2026-04-27']);
        Route::post('/projects', [ProjectController::class, 'store'])
            ->middleware('permission:projects.write');
        Route::put('/projects/{id}', [ProjectController::class, 'update'])
            ->middleware('permission:projects.write');
        Route::delete('/projects/{id}', [ProjectController::class, 'destroy'])
            ->middleware('permission:projects.delete');

        // Project Procedure (Checklist) routes
        Route::get('/project-procedure-templates', [ProjectProcedureController::class, 'templates'])
            ->middleware('permission:projects.read');
        Route::post('/project-procedure-templates', [ProjectProcedureController::class, 'storeTemplate'])
            ->middleware('permission:projects.write');
        Route::put('/project-procedure-templates/{id}', [ProjectProcedureController::class, 'updateTemplate'])
            ->middleware('permission:projects.write');
        Route::get('/project-procedure-templates/{templateId}/steps', [ProjectProcedureController::class, 'templateSteps'])
            ->middleware('permission:projects.read');
        Route::post('/project-procedure-templates/{templateId}/steps', [ProjectProcedureController::class, 'storeTemplateStep'])
            ->middleware('permission:projects.write');
        Route::put('/project-procedure-templates/{templateId}/steps/{stepId}', [ProjectProcedureController::class, 'updateTemplateStep'])
            ->middleware('permission:projects.write');
        Route::delete('/project-procedure-templates/{templateId}/steps/{stepId}', [ProjectProcedureController::class, 'deleteTemplateStep'])
            ->middleware('permission:projects.write');
        Route::get('/projects/{projectId}/procedures', [ProjectProcedureController::class, 'projectProcedures'])
            ->middleware('permission:projects.read');
        Route::post('/projects/{projectId}/procedures', [ProjectProcedureController::class, 'createProcedure'])
            ->middleware('permission:projects.write');
        Route::get('/project-procedures/{procedureId}/steps', [ProjectProcedureController::class, 'procedureSteps'])
            ->middleware('permission:projects.read');
        Route::post('/project-procedures/{procedureId}/resync', [ProjectProcedureController::class, 'resyncProcedure'])
            ->middleware('permission:projects.write');
        Route::post('/project-procedure-steps/reorder', [ProjectProcedureController::class, 'reorderSteps'])
            ->middleware('permission:projects.write');
        Route::put('/project-procedure-steps/batch', [ProjectProcedureController::class, 'batchUpdateSteps'])
            ->middleware('permission:projects.write');
        Route::put('/project-procedure-steps/{stepId}', [ProjectProcedureController::class, 'updateStep'])
            ->middleware('permission:projects.write');
        Route::post('/project-procedures/{procedureId}/steps', [ProjectProcedureController::class, 'addCustomStep'])
            ->middleware('permission:projects.write');
        Route::put('/project-procedures/{procedureId}/phase-label', [ProjectProcedureController::class, 'updatePhaseLabel'])
            ->middleware('permission:projects.write');
        Route::delete('/project-procedure-steps/{stepId}', [ProjectProcedureController::class, 'deleteStep'])
            ->middleware('permission:projects.delete');
        // Worklog routes
        Route::get('/project-procedure-steps/{stepId}/worklogs', [ProjectProcedureController::class, 'stepWorklogs'])
            ->middleware('permission:projects.read');
        Route::post('/project-procedure-steps/{stepId}/worklogs', [ProjectProcedureController::class, 'addWorklog'])
            ->middleware('permission:projects.write');
        Route::patch('/project-procedure-worklogs/{logId}', [ProjectProcedureController::class, 'updateWorklog'])
            ->middleware('permission:projects.write');
        Route::get('/project-procedures/{procedureId}/worklogs', [ProjectProcedureController::class, 'procedureWorklogs'])
            ->middleware('permission:projects.read');
        // Shared issues
        Route::patch('/shared-issues/{issueId}/status', [ProjectProcedureController::class, 'updateIssueStatus'])
            ->middleware('permission:projects.write');
        // RACI routes
        Route::get('/project-procedures/{procedureId}/raci', [ProjectProcedureController::class, 'getRaci'])
            ->middleware('permission:projects.read');
        Route::post('/project-procedures/{procedureId}/raci', [ProjectProcedureController::class, 'addRaci'])
            ->middleware('permission:projects.write');
        Route::delete('/project-procedure-raci/{raciId}', [ProjectProcedureController::class, 'removeRaci'])
            ->middleware('permission:projects.delete');
        Route::get('/project-procedures/{procedureId}/step-raci', [ProjectProcedureController::class, 'getStepRaciBulk'])
            ->middleware('permission:projects.read');
        Route::post('/project-procedures/{procedureId}/step-raci/batch', [ProjectProcedureController::class, 'batchSetStepRaci'])
            ->middleware('permission:projects.write');
        Route::get('/project-procedure-steps/{stepId}/raci', [ProjectProcedureController::class, 'getStepRaci'])
            ->middleware('permission:projects.read');
        Route::post('/project-procedure-steps/{stepId}/raci', [ProjectProcedureController::class, 'setStepRaci'])
            ->middleware('permission:projects.write');
        Route::delete('/project-procedure-step-raci/{raciId}', [ProjectProcedureController::class, 'removeStepRaci'])
            ->middleware('permission:projects.delete');

        // Step Attachments
        Route::get('/project-procedure-steps/{stepId}/attachments', [ProjectProcedureController::class, 'stepAttachments'])
            ->middleware('permission:projects.read');
        Route::post('/project-procedure-steps/{stepId}/attachments', [ProjectProcedureController::class, 'linkStepAttachment'])
            ->middleware('permission:projects.write');
        Route::delete('/project-procedure-steps/{stepId}/attachments/{attachmentId}', [ProjectProcedureController::class, 'deleteStepAttachment'])
            ->middleware('permission:projects.delete');

        Route::get('/contracts', [ContractController::class, 'index'])
            ->middleware('permission:contracts.read');
        Route::get('/contracts/{id}', [ContractController::class, 'show'])
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
        Route::get('/opportunities/raci-assignments', [OpportunityController::class, 'raciAssignments'])
            ->middleware('permission:opportunities.read');
        Route::post('/opportunities', [OpportunityController::class, 'store'])
            ->middleware('permission:opportunities.write');
        Route::put('/opportunities/{id}', [OpportunityController::class, 'update'])
            ->middleware('permission:opportunities.write');
        Route::delete('/opportunities/{id}', [OpportunityController::class, 'destroy'])
            ->middleware('permission:opportunities.delete');

        // Feedback (góp ý người dùng)
        Route::get('/feedback-requests', [FeedbackController::class, 'index'])
            ->middleware('permission:feedback_requests.read');
        Route::post('/feedback-requests', [FeedbackController::class, 'store'])
            ->middleware('permission:feedback_requests.write');
        Route::get('/feedback-requests/{id}', [FeedbackController::class, 'show'])
            ->middleware('permission:feedback_requests.read');
        Route::put('/feedback-requests/{id}', [FeedbackController::class, 'update'])
            ->middleware('permission:feedback_requests.write');
        Route::delete('/feedback-requests/{id}', [FeedbackController::class, 'destroy'])
            ->middleware('permission:feedback_requests.delete');
        Route::post('/feedback-requests/{id}/responses', [FeedbackController::class, 'storeResponse'])
            ->middleware('permission:feedback_requests.write');
        Route::delete('/feedback-requests/{feedbackId}/responses/{responseId}', [FeedbackController::class, 'destroyResponse'])
            ->middleware('permission:feedback_requests.delete');

        Route::get('/documents', [V5MasterDataController::class, 'documents'])
            ->middleware('permission:documents.read');
        Route::post('/documents', [V5MasterDataController::class, 'storeDocument'])
            ->middleware('permission:documents.write');
        Route::post('/documents/upload-attachment', [V5MasterDataController::class, 'uploadDocumentAttachment'])
            ->middleware(['permission:documents.write', 'throttle:api.write.heavy']);
        Route::delete('/documents/upload-attachment', [V5MasterDataController::class, 'deleteUploadedDocumentAttachment'])
            ->middleware('permission:documents.write');
        Route::put('/documents/{id}', [V5MasterDataController::class, 'updateDocument'])
            ->middleware('permission:documents.write');
        Route::delete('/documents/{id}', [V5MasterDataController::class, 'deleteDocument'])
            ->middleware('permission:documents.delete');
        Route::get('/integrations/backblaze-b2', [V5MasterDataController::class, 'backblazeB2IntegrationSettings'])
            ->middleware('permission:authz.manage');
        Route::put('/integrations/backblaze-b2', [V5MasterDataController::class, 'updateBackblazeB2IntegrationSettings'])
            ->middleware('permission:authz.manage');
        Route::post('/integrations/backblaze-b2/test', [V5MasterDataController::class, 'testBackblazeB2IntegrationSettings'])
            ->middleware('permission:authz.manage');
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

        Route::get('/audit-logs', [AuditLogController::class, 'index'])
            ->middleware('permission:audit_logs.read');
        Route::get('/audit_logs', [AuditLogController::class, 'index'])
            ->middleware(['permission:audit_logs.read', 'deprecated.route:/api/v5/audit-logs,2026-04-27']);

        Route::get('/support-service-groups', [V5MasterDataController::class, 'supportServiceGroups'])
            ->middleware('permission:support_service_groups.read');
        Route::get('/support-service-groups/available', [V5MasterDataController::class, 'availableSupportServiceGroups'])
            ->middleware('permission:support_requests.read');
        Route::get('/support_service_groups', [V5MasterDataController::class, 'supportServiceGroups'])
            ->middleware(['permission:support_service_groups.read', 'deprecated.route:/api/v5/support-service-groups,2026-04-27']);
        Route::get('/support_service_groups/available', [V5MasterDataController::class, 'availableSupportServiceGroups'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/support-service-groups/available,2026-04-27']);
        Route::post('/support-service-groups', [V5MasterDataController::class, 'storeSupportServiceGroup'])
            ->middleware('permission:support_service_groups.write');
        Route::post('/support-service-groups/bulk', [V5MasterDataController::class, 'storeSupportServiceGroupsBulk'])
            ->middleware(['permission:support_service_groups.write', 'throttle:api.write.heavy']);
        Route::put('/support-service-groups/{id}', [V5MasterDataController::class, 'updateSupportServiceGroup'])
            ->middleware('permission:support_service_groups.write');
        Route::post('/support_service_groups', [V5MasterDataController::class, 'storeSupportServiceGroup'])
            ->middleware(['permission:support_service_groups.write', 'deprecated.route:/api/v5/support-service-groups,2026-04-27']);
        Route::post('/support_service_groups/bulk', [V5MasterDataController::class, 'storeSupportServiceGroupsBulk'])
            ->middleware(['permission:support_service_groups.write', 'deprecated.route:/api/v5/support-service-groups/bulk,2026-04-27', 'throttle:api.write.heavy']);
        Route::put('/support_service_groups/{id}', [V5MasterDataController::class, 'updateSupportServiceGroup'])
            ->middleware(['permission:support_service_groups.write', 'deprecated.route:/api/v5/support-service-groups/{id},2026-04-27']);

        Route::get('/support-contact-positions', [SupportContactPositionController::class, 'index'])
            ->middleware('permission:support_contact_positions.read');
        Route::get('/support_contact_positions', [SupportContactPositionController::class, 'index'])
            ->middleware(['permission:support_contact_positions.read', 'deprecated.route:/api/v5/support-contact-positions,2026-04-27']);
        Route::post('/support-contact-positions', [SupportContactPositionController::class, 'store'])
            ->middleware('permission:support_contact_positions.write');
        Route::post('/support-contact-positions/bulk', [SupportContactPositionController::class, 'storeBulk'])
            ->middleware(['permission:support_contact_positions.write', 'throttle:api.write.heavy']);
        Route::put('/support-contact-positions/{id}', [SupportContactPositionController::class, 'update'])
            ->middleware('permission:support_contact_positions.write');
        Route::post('/support_contact_positions', [SupportContactPositionController::class, 'store'])
            ->middleware(['permission:support_contact_positions.write', 'deprecated.route:/api/v5/support-contact-positions,2026-04-27']);
        Route::post('/support_contact_positions/bulk', [SupportContactPositionController::class, 'storeBulk'])
            ->middleware(['permission:support_contact_positions.write', 'deprecated.route:/api/v5/support-contact-positions/bulk,2026-04-27', 'throttle:api.write.heavy']);
        Route::put('/support_contact_positions/{id}', [SupportContactPositionController::class, 'update'])
            ->middleware(['permission:support_contact_positions.write', 'deprecated.route:/api/v5/support-contact-positions/{id},2026-04-27']);

        Route::get('/support-request-statuses', [V5MasterDataController::class, 'supportRequestStatuses'])
            ->middleware('permission:support_requests.read');
        Route::get('/support_request_statuses', [V5MasterDataController::class, 'supportRequestStatuses'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/support-request-statuses,2026-04-27']);
        Route::post('/support-request-statuses', [V5MasterDataController::class, 'storeSupportRequestStatus'])
            ->middleware('permission:support_requests.write');
        Route::post('/support-request-statuses/bulk', [V5MasterDataController::class, 'storeSupportRequestStatusesBulk'])
            ->middleware(['permission:support_requests.write', 'throttle:api.write.heavy']);
        Route::put('/support-request-statuses/{id}', [V5MasterDataController::class, 'updateSupportRequestStatusDefinition'])
            ->middleware('permission:support_requests.write');
        Route::post('/support_request_statuses', [V5MasterDataController::class, 'storeSupportRequestStatus'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-request-statuses,2026-04-27']);
        Route::post('/support_request_statuses/bulk', [V5MasterDataController::class, 'storeSupportRequestStatusesBulk'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-request-statuses/bulk,2026-04-27', 'throttle:api.write.heavy']);
        Route::put('/support_request_statuses/{id}', [V5MasterDataController::class, 'updateSupportRequestStatusDefinition'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-request-statuses/{id},2026-04-27']);

        Route::get('/worklog-activity-types', [V5MasterDataController::class, 'worklogActivityTypes'])
            ->middleware('permission:support_requests.read');
        Route::post('/worklog-activity-types', [V5MasterDataController::class, 'storeWorklogActivityType'])
            ->middleware('permission:support_requests.write');
        Route::put('/worklog-activity-types/{id}', [V5MasterDataController::class, 'updateWorklogActivityType'])
            ->middleware('permission:support_requests.write');
        Route::get('/worklog_activity_types', [V5MasterDataController::class, 'worklogActivityTypes'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/worklog-activity-types,2026-04-27']);
        Route::post('/worklog_activity_types', [V5MasterDataController::class, 'storeWorklogActivityType'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/worklog-activity-types,2026-04-27']);
        Route::put('/worklog_activity_types/{id}', [V5MasterDataController::class, 'updateWorklogActivityType'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/worklog-activity-types/{id},2026-04-27']);

        Route::get('/support-sla-configs', [V5MasterDataController::class, 'supportSlaConfigs'])
            ->middleware('permission:support_requests.read');
        Route::post('/support-sla-configs', [V5MasterDataController::class, 'storeSupportSlaConfig'])
            ->middleware('permission:support_requests.write');
        Route::put('/support-sla-configs/{id}', [V5MasterDataController::class, 'updateSupportSlaConfig'])
            ->middleware('permission:support_requests.write');
        Route::get('/support_sla_configs', [V5MasterDataController::class, 'supportSlaConfigs'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/support-sla-configs,2026-04-27']);
        Route::post('/support_sla_configs', [V5MasterDataController::class, 'storeSupportSlaConfig'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-sla-configs,2026-04-27']);
        Route::put('/support_sla_configs/{id}', [V5MasterDataController::class, 'updateSupportSlaConfig'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-sla-configs/{id},2026-04-27']);

        Route::get('/workflow-status-catalogs', [WorkflowConfigController::class, 'statusCatalogs'])
            ->middleware('permission:support_requests.read');
        Route::post('/workflow-status-catalogs', [WorkflowConfigController::class, 'storeStatusCatalog'])
            ->middleware('permission:support_requests.write');
        Route::put('/workflow-status-catalogs/{id}', [WorkflowConfigController::class, 'updateStatusCatalog'])
            ->middleware('permission:support_requests.write');
        Route::get('/workflow_status_catalogs', [WorkflowConfigController::class, 'statusCatalogs'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/workflow-status-catalogs,2026-04-27']);
        Route::post('/workflow_status_catalogs', [WorkflowConfigController::class, 'storeStatusCatalog'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/workflow-status-catalogs,2026-04-27']);
        Route::put('/workflow_status_catalogs/{id}', [WorkflowConfigController::class, 'updateStatusCatalog'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/workflow-status-catalogs/{id},2026-04-27']);

        Route::get('/workflow-status-transitions', [WorkflowConfigController::class, 'statusTransitions'])
            ->middleware('permission:support_requests.read');
        Route::post('/workflow-status-transitions', [WorkflowConfigController::class, 'storeStatusTransition'])
            ->middleware('permission:support_requests.write');
        Route::put('/workflow-status-transitions/{id}', [WorkflowConfigController::class, 'updateStatusTransition'])
            ->middleware('permission:support_requests.write');
        Route::get('/workflow_status_transitions', [WorkflowConfigController::class, 'statusTransitions'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/workflow-status-transitions,2026-04-27']);
        Route::post('/workflow_status_transitions', [WorkflowConfigController::class, 'storeStatusTransition'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/workflow-status-transitions,2026-04-27']);
        Route::put('/workflow_status_transitions/{id}', [WorkflowConfigController::class, 'updateStatusTransition'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/workflow-status-transitions/{id},2026-04-27']);

        Route::get('/workflow-form-field-configs', [WorkflowConfigController::class, 'formFieldConfigs'])
            ->middleware('permission:support_requests.read');
        Route::post('/workflow-form-field-configs', [WorkflowConfigController::class, 'storeFormFieldConfig'])
            ->middleware('permission:support_requests.write');
        Route::put('/workflow-form-field-configs/{id}', [WorkflowConfigController::class, 'updateFormFieldConfig'])
            ->middleware('permission:support_requests.write');
        Route::get('/workflow_form_field_configs', [WorkflowConfigController::class, 'formFieldConfigs'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/workflow-form-field-configs,2026-04-27']);
        Route::post('/workflow_form_field_configs', [WorkflowConfigController::class, 'storeFormFieldConfig'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/workflow-form-field-configs,2026-04-27']);
        Route::put('/workflow_form_field_configs/{id}', [WorkflowConfigController::class, 'updateFormFieldConfig'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/workflow-form-field-configs/{id},2026-04-27']);

        Route::get('/customer-requests', [V5MasterDataController::class, 'customerRequests'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-requests/dashboard-summary', [V5MasterDataController::class, 'customerRequestDashboardSummary'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-requests/dashboard-summary/export', [V5MasterDataController::class, 'exportCustomerRequestDashboardSummary'])
            ->middleware('permission:support_requests.export');
        Route::post('/customer-requests', [V5MasterDataController::class, 'storeCustomerRequest'])
            ->middleware('permission:support_requests.write');
        Route::put('/customer-requests/{id}', [V5MasterDataController::class, 'updateCustomerRequest'])
            ->middleware('permission:support_requests.write');
        Route::delete('/customer-requests/{id}', [V5MasterDataController::class, 'deleteCustomerRequest'])
            ->middleware('permission:support_requests.delete');
        Route::get('/customer-requests/reference-search', [V5MasterDataController::class, 'supportRequestReferenceSearch'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-requests/{id}/history', [V5MasterDataController::class, 'customerRequestHistory'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-history', [V5MasterDataController::class, 'customerRequestHistories'])
            ->middleware('permission:support_requests.read');
        Route::post('/customer-requests/import', [V5MasterDataController::class, 'importCustomerRequests'])
            ->middleware(['permission:support_requests.import', 'throttle:api.write.heavy']);
        Route::get('/customer-requests/export', [V5MasterDataController::class, 'exportCustomerRequests'])
            ->middleware('permission:support_requests.export');
        Route::get('/customer-requests/receivers', [V5MasterDataController::class, 'customerRequestReceivers'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-requests/project-items', [V5MasterDataController::class, 'customerRequestProjectItems'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer_requests/project_items', [V5MasterDataController::class, 'customerRequestProjectItems'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests/project-items,2026-04-27']);
        Route::get('/customer_requests', [V5MasterDataController::class, 'customerRequests'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests,2026-04-27']);
        Route::get('/customer_requests/dashboard_summary', [V5MasterDataController::class, 'customerRequestDashboardSummary'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests/dashboard-summary,2026-04-27']);
        Route::get('/customer_requests/dashboard_summary/export', [V5MasterDataController::class, 'exportCustomerRequestDashboardSummary'])
            ->middleware(['permission:support_requests.export', 'deprecated.route:/api/v5/customer-requests/dashboard-summary/export,2026-04-27']);
        Route::post('/customer_requests', [V5MasterDataController::class, 'storeCustomerRequest'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/customer-requests,2026-04-27']);
        Route::put('/customer_requests/{id}', [V5MasterDataController::class, 'updateCustomerRequest'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/customer-requests/{id},2026-04-27']);
        Route::delete('/customer_requests/{id}', [V5MasterDataController::class, 'deleteCustomerRequest'])
            ->middleware(['permission:support_requests.delete', 'deprecated.route:/api/v5/customer-requests/{id},2026-04-27']);
        Route::get('/customer_requests/reference_search', [V5MasterDataController::class, 'supportRequestReferenceSearch'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests/reference-search,2026-04-27']);
        Route::get('/customer_requests/{id}/history', [V5MasterDataController::class, 'customerRequestHistory'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests/{id}/history,2026-04-27']);
        Route::get('/customer_request_history', [V5MasterDataController::class, 'customerRequestHistories'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-request-history,2026-04-27']);
        Route::post('/customer_requests/import', [V5MasterDataController::class, 'importCustomerRequests'])
            ->middleware(['permission:support_requests.import', 'deprecated.route:/api/v5/customer-requests/import,2026-04-27']);
        Route::get('/customer_requests/export', [V5MasterDataController::class, 'exportCustomerRequests'])
            ->middleware(['permission:support_requests.export', 'deprecated.route:/api/v5/customer-requests/export,2026-04-27']);
        Route::get('/customer_requests/receivers', [V5MasterDataController::class, 'customerRequestReceivers'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests/receivers,2026-04-27']);

        Route::get('/opportunity-stages', [OpportunityController::class, 'opportunityStages'])
            ->middleware('permission:opportunities.read');
        Route::get('/opportunity_stages', [OpportunityController::class, 'opportunityStages'])
            ->middleware(['permission:opportunities.read', 'deprecated.route:/api/v5/opportunity-stages,2026-04-27']);
        Route::post('/opportunity-stages', [OpportunityController::class, 'storeOpportunityStage'])
            ->middleware('permission:opportunities.write');
        Route::put('/opportunity-stages/{id}', [OpportunityController::class, 'updateOpportunityStage'])
            ->middleware('permission:opportunities.write');
        Route::post('/opportunity_stages', [OpportunityController::class, 'storeOpportunityStage'])
            ->middleware(['permission:opportunities.write', 'deprecated.route:/api/v5/opportunity-stages,2026-04-27']);
        Route::put('/opportunity_stages/{id}', [OpportunityController::class, 'updateOpportunityStage'])
            ->middleware(['permission:opportunities.write', 'deprecated.route:/api/v5/opportunity-stages/{id},2026-04-27']);

        Route::get('/project-types', [ProjectController::class, 'projectTypes'])
            ->middleware('permission:projects.read');
        Route::post('/project-types', [ProjectController::class, 'storeProjectType'])
            ->middleware('permission:projects.write');
        Route::put('/project-types/{id}', [ProjectController::class, 'updateProjectType'])
            ->middleware('permission:projects.write');

        // Lịch làm việc
        Route::get('/monthly-calendars', [MonthlyCalendarController::class, 'index'])
            ->middleware('permission:support_requests.read');
        Route::put('/monthly-calendars/{date}', [MonthlyCalendarController::class, 'update'])
            ->middleware('permission:support_requests.write');
        Route::post('/monthly-calendars/generate', [MonthlyCalendarController::class, 'generateYear'])
            ->middleware('permission:support_requests.write');

        Route::get('/exports/{uuid}/download', [AsyncExportController::class, 'download'])
            ->middleware('permission:support_requests.read');
        Route::get('/exports/{uuid}', [AsyncExportController::class, 'show'])
            ->middleware('permission:support_requests.read');
    });
});
