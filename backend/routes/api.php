<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\V5\AuditLogController;
use App\Http\Controllers\Api\V5\AsyncExportController;
use App\Http\Controllers\Api\V5\BusinessController;
use App\Http\Controllers\Api\V5\ContractController;
use App\Http\Controllers\Api\V5\CustomerController;
use App\Http\Controllers\Api\V5\CustomerPersonnelController;
use App\Http\Controllers\Api\V5\CustomerRequestController;
use App\Http\Controllers\Api\V5\CustomerRequestCaseController;
use App\Http\Controllers\Api\V5\DepartmentController;
use App\Http\Controllers\Api\V5\DepartmentWeeklyScheduleController;
use App\Http\Controllers\Api\V5\DocumentController;
use App\Http\Controllers\Api\V5\EmployeeController;
use App\Http\Controllers\Api\V5\IntegrationSettingsController;
use App\Http\Controllers\Api\V5\ProjectController;
use App\Http\Controllers\Api\V5\ProjectProcedureController;
use App\Http\Controllers\Api\V5\FeedbackController;
use App\Http\Controllers\Api\V5\MonthlyCalendarController;
use App\Http\Controllers\Api\V5\SystemHealthController;
use App\Http\Controllers\Api\V5\ProductController;
use App\Http\Controllers\Api\V5\SupportConfigController;
use App\Http\Controllers\Api\V5\SupportContactPositionController;
use App\Http\Controllers\Api\V5\VendorController;
use App\Http\Controllers\Api\V5\UserAccessController;

use App\Http\Controllers\Api\V5\CustomerRequestPlanController;
use App\Http\Controllers\Api\V5\CustomerRequestReportController;
use App\Http\Controllers\Api\V5\CustomerRequestEscalationController;
use App\Http\Controllers\Api\V5\LeadershipDashboardController;
use App\Http\Controllers\Api\V5\LeadershipDirectiveController;
use App\Http\Controllers\Api\V5\FeeCollectionController;
use App\Http\Controllers\Api\V5\RevenueManagementController;
use App\Http\Controllers\Api\V5\WorkflowDefinitionController;
use App\Http\Controllers\Api\V5\WorkflowTransitionController;
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

    Route::get('/documents/attachments/{id}/download', [DocumentController::class, 'downloadDocumentAttachment'])
        ->name('v5.documents.attachments.download')
        ->middleware('signed:relative');
    Route::get('/attachments/{id}/download', [DocumentController::class, 'downloadAttachment'])
        ->name('v5.attachments.download')
        ->middleware('signed:relative');
    Route::get('/documents/attachments/temp-download', [DocumentController::class, 'downloadTemporaryAttachment'])
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
        Route::put('/user-access/{id}/roles', [UserAccessController::class, 'updateRoles'])
            ->middleware('permission:authz.manage');
        Route::put('/user-access/{id}/permissions', [UserAccessController::class, 'updatePermissions'])
            ->middleware('permission:authz.manage');
        Route::put('/user-access/{id}/dept-scopes', [UserAccessController::class, 'updateDeptScopes'])
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


        Route::get('/customer-request-statuses', [CustomerRequestCaseController::class, 'statusCatalog'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-status-transitions', [CustomerRequestCaseController::class, 'statusTransitions'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases', [CustomerRequestCaseController::class, 'index'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/search', [CustomerRequestCaseController::class, 'search'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/dashboard/creator', [CustomerRequestCaseController::class, 'dashboardCreator'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/dashboard/dispatcher', [CustomerRequestCaseController::class, 'dashboardDispatcher'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/dashboard/performer', [CustomerRequestCaseController::class, 'dashboardPerformer'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/timesheet/performer-weekly', [CustomerRequestCaseController::class, 'performerWeeklyTimesheet'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/dashboard/overview', [CustomerRequestCaseController::class, 'dashboardOverview'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/statuses/{statusCode}', [CustomerRequestCaseController::class, 'indexByStatus'])
            ->middleware('permission:support_requests.read');
        Route::post('/customer-request-cases', [CustomerRequestCaseController::class, 'store'])
            ->middleware('permission:support_requests.write');
        Route::get('/customer-request-cases/{id}/timeline', [CustomerRequestCaseController::class, 'timeline'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/{id}/people', [CustomerRequestCaseController::class, 'people'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/{id}/estimates', [CustomerRequestCaseController::class, 'estimates'])
            ->middleware('permission:support_requests.read');
        Route::post('/customer-request-cases/{id}/estimates', [CustomerRequestCaseController::class, 'storeEstimate'])
            ->middleware('permission:support_requests.write');
        Route::get('/customer-request-cases/{id}/hours-report', [CustomerRequestCaseController::class, 'hoursReport'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/{id}/attachments', [CustomerRequestCaseController::class, 'attachments'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/{id}/full-detail', [CustomerRequestCaseController::class, 'fullDetail'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/{id}/summary-card', [CustomerRequestCaseController::class, 'summaryCard'])
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
        Route::patch('/customer-request-cases/{id}/sub-status', [CustomerRequestCaseController::class, 'updateSubStatus'])
            ->middleware('permission:support_requests.write');
        Route::delete('/customer-request-cases/{id}', [CustomerRequestCaseController::class, 'destroy'])
            ->middleware('permission:support_requests.delete');
        Route::get('/customer-request-cases/{id}', [CustomerRequestCaseController::class, 'show'])
            ->middleware('permission:support_requests.read');

        // Plans (§8 Kế hoạch giao việc)
        Route::get('/customer-request-plans/backlog', [CustomerRequestPlanController::class, 'backlog'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-plans', [CustomerRequestPlanController::class, 'index'])
            ->middleware('permission:support_requests.read');
        Route::post('/customer-request-plans', [CustomerRequestPlanController::class, 'store'])
            ->middleware('permission:support_requests.write');
        Route::get('/customer-request-plans/{id}', [CustomerRequestPlanController::class, 'show'])
            ->middleware('permission:support_requests.read');
        Route::put('/customer-request-plans/{id}', [CustomerRequestPlanController::class, 'update'])
            ->middleware('permission:support_requests.write');
        Route::delete('/customer-request-plans/{id}', [CustomerRequestPlanController::class, 'destroy'])
            ->middleware('permission:support_requests.delete');
        Route::post('/customer-request-plans/{planId}/items', [CustomerRequestPlanController::class, 'storeItem'])
            ->middleware('permission:support_requests.write');
        Route::put('/customer-request-plans/{planId}/items/{itemId}', [CustomerRequestPlanController::class, 'updateItem'])
            ->middleware('permission:support_requests.write');
        Route::delete('/customer-request-plans/{planId}/items/{itemId}', [CustomerRequestPlanController::class, 'destroyItem'])
            ->middleware('permission:support_requests.write');
        Route::post('/customer-request-plans/{planId}/carry-over', [CustomerRequestPlanController::class, 'carryOver'])
            ->middleware('permission:support_requests.write');

        // Reports (§P6.1-6.4)
        Route::get('/customer-request-cases/reports/monthly-hours', [CustomerRequestReportController::class, 'monthlyHours'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/reports/pain-points', [CustomerRequestReportController::class, 'painPoints'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/reports/weekly-hours', [CustomerRequestReportController::class, 'weeklyHours'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-cases/reports/trend', [CustomerRequestReportController::class, 'trend'])
            ->middleware('permission:support_requests.read');

        // Escalations (§P6.5-6.7) — /stats MUST be before /{id}
        Route::get('/customer-request-escalations/stats', [CustomerRequestEscalationController::class, 'stats'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-escalations', [CustomerRequestEscalationController::class, 'index'])
            ->middleware('permission:support_requests.read');
        Route::post('/customer-request-escalations', [CustomerRequestEscalationController::class, 'store'])
            ->middleware('permission:support_requests.write');
        Route::get('/customer-request-escalations/{id}', [CustomerRequestEscalationController::class, 'show'])
            ->middleware('permission:support_requests.read');
        Route::post('/customer-request-escalations/{id}/review', [CustomerRequestEscalationController::class, 'review'])
            ->middleware('permission:support_requests.write');
        Route::post('/customer-request-escalations/{id}/resolve', [CustomerRequestEscalationController::class, 'resolve'])
            ->middleware('permission:support_requests.write');

        // Leadership Dashboard (§P6.8-6.9)
        Route::get('/leadership/dashboard', [LeadershipDashboardController::class, 'dashboard'])
            ->middleware('permission:support_requests.read');
        Route::get('/leadership/risks', [LeadershipDashboardController::class, 'risks'])
            ->middleware('permission:support_requests.read');
        Route::get('/leadership/team-comparison', [LeadershipDashboardController::class, 'teamComparison'])
            ->middleware('permission:support_requests.read');

        // Leadership Directives (§P6.10)
        Route::get('/leadership/directives', [LeadershipDirectiveController::class, 'index'])
            ->middleware('permission:support_requests.read');
        Route::post('/leadership/directives', [LeadershipDirectiveController::class, 'store'])
            ->middleware('permission:support_requests.write');
        Route::get('/leadership/directives/{id}', [LeadershipDirectiveController::class, 'show'])
            ->middleware('permission:support_requests.read');
        Route::post('/leadership/directives/{id}/acknowledge', [LeadershipDirectiveController::class, 'acknowledge'])
            ->middleware('permission:support_requests.write');
        Route::post('/leadership/directives/{id}/complete', [LeadershipDirectiveController::class, 'complete'])
            ->middleware('permission:support_requests.write');

        // Revenue Management (§Quản trị Doanh thu)
        Route::get('/revenue/overview', [RevenueManagementController::class, 'overview'])
            ->middleware('permission:revenue.read');
        Route::get('/revenue/targets', [RevenueManagementController::class, 'targetIndex'])
            ->middleware('permission:revenue.read');
        Route::post('/revenue/targets', [RevenueManagementController::class, 'targetStore'])
            ->middleware('permission:revenue.targets');
        Route::put('/revenue/targets/{id}', [RevenueManagementController::class, 'targetUpdate'])
            ->middleware('permission:revenue.targets');
        Route::delete('/revenue/targets/{id}', [RevenueManagementController::class, 'targetDestroy'])
            ->middleware('permission:revenue.targets');
        Route::post('/revenue/targets/bulk', [RevenueManagementController::class, 'targetBulkStore'])
            ->middleware('permission:revenue.targets');
        Route::get('/revenue/targets/suggest', [RevenueManagementController::class, 'targetSuggest'])
            ->middleware('permission:revenue.read');
        Route::get('/revenue/by-contract', [RevenueManagementController::class, 'byContract'])
            ->middleware('permission:revenue.read');
        Route::get('/revenue/by-contract/{contractId}', [RevenueManagementController::class, 'byContractDetail'])
            ->middleware('permission:revenue.read');
        Route::get('/revenue/by-collection', [RevenueManagementController::class, 'byCollection'])
            ->middleware('permission:revenue.read');
        Route::get('/revenue/forecast', [RevenueManagementController::class, 'forecast'])
            ->middleware('permission:revenue.read');
        Route::get('/revenue/report', [RevenueManagementController::class, 'report'])
            ->middleware('permission:revenue.read');

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
        Route::get('/customers/{id}/insight', [CustomerController::class, 'insight'])
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
        Route::get('/products/{id}/feature-catalog', [ProductController::class, 'featureCatalog'])
            ->middleware('permission:products.read');
        Route::get('/products/quotations', [ProductController::class, 'quotations'])
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
            ->middleware('permission:products.read');
        Route::post('/products/quotation/export-word', [ProductController::class, 'exportQuotationWord'])
            ->middleware('permission:products.read');
        Route::post('/products/quotation/export-excel', [ProductController::class, 'exportQuotationExcel'])
            ->middleware('permission:products.read');
        Route::post('/products/quotations', [ProductController::class, 'storeQuotation'])
            ->middleware('permission:products.write');
        Route::put('/products/quotations/{id}', [ProductController::class, 'updateQuotation'])
            ->middleware('permission:products.write');
        Route::post('/products/quotations/{id}/print-word', [ProductController::class, 'printStoredQuotationWord'])
            ->middleware('permission:products.write');
        Route::post('/products', [ProductController::class, 'store'])
            ->middleware('permission:products.write');
        Route::put('/products/{id}/feature-catalog', [ProductController::class, 'updateFeatureCatalog'])
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

        // Project Revenue Schedules
        Route::get('/projects/{projectId}/revenue-schedules', [ProjectController::class, 'revenueSchedules'])
            ->middleware('permission:projects.read');
        Route::post('/projects/{projectId}/revenue-schedules/sync', [ProjectController::class, 'syncRevenueSchedules'])
            ->middleware('permission:projects.write');
        Route::post('/projects/{projectId}/revenue-schedules/generate', [ProjectController::class, 'generateRevenueSchedules'])
            ->middleware('permission:projects.write');

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
        Route::get('/contracts/revenue-analytics', [ContractController::class, 'revenueAnalytics'])
            ->middleware('permission:contracts.read');
        Route::get('/contracts/{id}', [ContractController::class, 'show'])
            ->middleware('permission:contracts.read');
        Route::post('/contracts', [ContractController::class, 'store'])
            ->middleware('permission:contracts.write');
        Route::put('/contracts/{id}', [ContractController::class, 'update'])
            ->middleware('permission:contracts.write');
        Route::delete('/contracts/{id}', [ContractController::class, 'destroy'])
            ->middleware('permission:contracts.delete');
        Route::post('/contracts/{id}/generate-payments', [ContractController::class, 'generatePayments'])
            ->middleware('permission:contracts.payments');

        Route::get('/payment-schedules', [ContractController::class, 'paymentSchedules'])
            ->middleware('permission:contracts.read');
        Route::put('/payment-schedules/{id}', [ContractController::class, 'updatePaymentSchedule'])
            ->middleware('permission:contracts.payments');

        // ── Fee Collection (Thu Cước) ─────────────────────────────────────────
        // Dashboard & Reports (register BEFORE /invoices/{id} to avoid wildcard conflict)
        Route::get('/fee-collection/dashboard', [FeeCollectionController::class, 'dashboard'])
            ->middleware('permission:fee_collection.read');
        Route::get('/fee-collection/debt-aging', [FeeCollectionController::class, 'debtAgingReport'])
            ->middleware('permission:fee_collection.read');
        Route::get('/fee-collection/debt-by-customer', [FeeCollectionController::class, 'debtByCustomer'])
            ->middleware('permission:fee_collection.read');
        Route::get('/fee-collection/debt-trend', [FeeCollectionController::class, 'debtTrend'])
            ->middleware('permission:fee_collection.read');

        // Invoice CRUD + bulk-generate (static routes before {id})
        Route::get('/invoices', [FeeCollectionController::class, 'invoiceIndex'])
            ->middleware('permission:fee_collection.read');
        Route::post('/invoices/bulk-generate', [FeeCollectionController::class, 'invoiceBulkGenerate'])
            ->middleware('permission:fee_collection.write');
        Route::post('/invoices', [FeeCollectionController::class, 'invoiceStore'])
            ->middleware('permission:fee_collection.write');
        Route::get('/invoices/{id}', [FeeCollectionController::class, 'invoiceShow'])
            ->middleware('permission:fee_collection.read');
        Route::put('/invoices/{id}', [FeeCollectionController::class, 'invoiceUpdate'])
            ->middleware('permission:fee_collection.write');
        Route::delete('/invoices/{id}', [FeeCollectionController::class, 'invoiceDestroy'])
            ->middleware('permission:fee_collection.delete');

        // Dunning logs (nested under invoice)
        Route::get('/invoices/{invoiceId}/dunning-logs', [FeeCollectionController::class, 'dunningLogIndex'])
            ->middleware('permission:fee_collection.read');
        Route::post('/invoices/{invoiceId}/dunning-logs', [FeeCollectionController::class, 'dunningLogStore'])
            ->middleware('permission:fee_collection.write');

        // Receipt CRUD
        Route::get('/receipts', [FeeCollectionController::class, 'receiptIndex'])
            ->middleware('permission:fee_collection.read');
        Route::post('/receipts', [FeeCollectionController::class, 'receiptStore'])
            ->middleware('permission:fee_collection.write');
        Route::get('/receipts/{id}', [FeeCollectionController::class, 'receiptShow'])
            ->middleware('permission:fee_collection.read');
        Route::put('/receipts/{id}', [FeeCollectionController::class, 'receiptUpdate'])
            ->middleware('permission:fee_collection.write');
        Route::delete('/receipts/{id}', [FeeCollectionController::class, 'receiptDestroy'])
            ->middleware('permission:fee_collection.delete');
        Route::post('/receipts/{id}/reverse', [FeeCollectionController::class, 'receiptReverse'])
            ->middleware('permission:fee_collection.write');

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

        Route::get('/documents', [DocumentController::class, 'index'])
            ->middleware('permission:documents.read');
        Route::post('/documents', [DocumentController::class, 'store'])
            ->middleware('permission:documents.write');
        Route::post('/documents/upload-attachment', [DocumentController::class, 'uploadAttachment'])
            ->middleware(['permission:documents.write', 'throttle:api.write.heavy']);
        Route::delete('/documents/upload-attachment', [DocumentController::class, 'deleteUploadedAttachment'])
            ->middleware('permission:documents.write');
        Route::put('/documents/{id}', [DocumentController::class, 'update'])
            ->middleware('permission:documents.write');
        Route::delete('/documents/{id}', [DocumentController::class, 'destroy'])
            ->middleware('permission:documents.delete');
        Route::get('/integrations/backblaze-b2', [IntegrationSettingsController::class, 'backblazeSettings'])
            ->middleware('permission:authz.manage');
        Route::put('/integrations/backblaze-b2', [IntegrationSettingsController::class, 'updateBackblazeSettings'])
            ->middleware('permission:authz.manage');
        Route::post('/integrations/backblaze-b2/test', [IntegrationSettingsController::class, 'testBackblazeSettings'])
            ->middleware('permission:authz.manage');
        Route::get('/integrations/google-drive', [IntegrationSettingsController::class, 'googleDriveSettings'])
            ->middleware('permission:authz.manage');
        Route::put('/integrations/google-drive', [IntegrationSettingsController::class, 'updateGoogleDriveSettings'])
            ->middleware('permission:authz.manage');
        Route::post('/integrations/google-drive/test', [IntegrationSettingsController::class, 'testGoogleDriveSettings'])
            ->middleware('permission:authz.manage');
        Route::get('/integrations/email-smtp', [IntegrationSettingsController::class, 'emailSmtpSettings'])
            ->middleware('permission:authz.manage');
        Route::put('/integrations/email-smtp', [IntegrationSettingsController::class, 'updateEmailSmtpSettings'])
            ->middleware('permission:authz.manage');
        Route::post('/integrations/email-smtp/test', [IntegrationSettingsController::class, 'testEmailSmtpSettings'])
            ->middleware('permission:authz.manage');
        Route::get('/utilities/contract-expiry-alert', [IntegrationSettingsController::class, 'contractExpiryAlertSettings'])
            ->middleware('permission:authz.manage');
        Route::put('/utilities/contract-expiry-alert', [IntegrationSettingsController::class, 'updateContractExpiryAlertSettings'])
            ->middleware('permission:authz.manage');
        Route::get('/utilities/contract-payment-alert', [IntegrationSettingsController::class, 'contractPaymentAlertSettings'])
            ->middleware('permission:authz.manage');
        Route::put('/utilities/contract-payment-alert', [IntegrationSettingsController::class, 'updateContractPaymentAlertSettings'])
            ->middleware('permission:authz.manage');
        Route::get('/utilities/contract-renewal-settings', [IntegrationSettingsController::class, 'contractRenewalSettings'])
            ->middleware('permission:authz.manage');
        Route::put('/utilities/contract-renewal-settings', [IntegrationSettingsController::class, 'updateContractRenewalSettings'])
            ->middleware('permission:authz.manage');
        Route::post('/utilities/contract-renewal-settings/recalculate', [IntegrationSettingsController::class, 'recalculateRenewalMeta'])
            ->middleware('permission:authz.manage');
        Route::get('/reminders', [IntegrationSettingsController::class, 'reminders'])
            ->middleware('permission:reminders.read');
        Route::post('/reminders', [IntegrationSettingsController::class, 'storeReminder'])
            ->middleware('permission:reminders.write');
        Route::put('/reminders/{id}', [IntegrationSettingsController::class, 'updateReminder'])
            ->middleware('permission:reminders.write');
        Route::delete('/reminders/{id}', [IntegrationSettingsController::class, 'destroyReminder'])
            ->middleware('permission:reminders.delete');
        Route::post('/reminders/{id}/send-email', [IntegrationSettingsController::class, 'sendReminderEmail'])
            ->middleware('permission:reminders.write');
        Route::get('/user-dept-history', [IntegrationSettingsController::class, 'userDeptHistory'])
            ->middleware('permission:user_dept_history.read');
        Route::get('/user_dept_history', [IntegrationSettingsController::class, 'userDeptHistory'])
            ->middleware(['permission:user_dept_history.read', 'deprecated.route:/api/v5/user-dept-history,2026-04-27']);

        Route::get('/audit-logs', [AuditLogController::class, 'index'])
            ->middleware('permission:audit_logs.read');
        Route::get('/audit_logs', [AuditLogController::class, 'index'])
            ->middleware(['permission:audit_logs.read', 'deprecated.route:/api/v5/audit-logs,2026-04-27']);

        Route::get('/support-service-groups', [SupportConfigController::class, 'serviceGroups'])
            ->middleware('permission:support_service_groups.read|support_requests.read');
        Route::get('/support-service-groups/available', [SupportConfigController::class, 'availableServiceGroups'])
            ->middleware('permission:support_requests.read');
        Route::get('/support_service_groups', [SupportConfigController::class, 'serviceGroups'])
            ->middleware(['permission:support_service_groups.read|support_requests.read', 'deprecated.route:/api/v5/support-service-groups,2026-04-27']);
        Route::get('/support_service_groups/available', [SupportConfigController::class, 'availableServiceGroups'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/support-service-groups/available,2026-04-27']);
        Route::post('/support-service-groups', [SupportConfigController::class, 'storeServiceGroup'])
            ->middleware('permission:support_service_groups.write');
        Route::post('/support-service-groups/bulk', [SupportConfigController::class, 'storeServiceGroupsBulk'])
            ->middleware(['permission:support_service_groups.write', 'throttle:api.write.heavy']);
        Route::put('/support-service-groups/{id}', [SupportConfigController::class, 'updateServiceGroup'])
            ->middleware('permission:support_service_groups.write');
        Route::post('/support_service_groups', [SupportConfigController::class, 'storeServiceGroup'])
            ->middleware(['permission:support_service_groups.write', 'deprecated.route:/api/v5/support-service-groups,2026-04-27']);
        Route::post('/support_service_groups/bulk', [SupportConfigController::class, 'storeServiceGroupsBulk'])
            ->middleware(['permission:support_service_groups.write', 'deprecated.route:/api/v5/support-service-groups/bulk,2026-04-27', 'throttle:api.write.heavy']);
        Route::put('/support_service_groups/{id}', [SupportConfigController::class, 'updateServiceGroup'])
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

        Route::get('/support-request-statuses', [SupportConfigController::class, 'requestStatuses'])
            ->middleware('permission:support_requests.read');
        Route::get('/support_request_statuses', [SupportConfigController::class, 'requestStatuses'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/support-request-statuses,2026-04-27']);
        Route::post('/support-request-statuses', [SupportConfigController::class, 'storeRequestStatus'])
            ->middleware('permission:support_requests.write');
        Route::post('/support-request-statuses/bulk', [SupportConfigController::class, 'storeRequestStatusesBulk'])
            ->middleware(['permission:support_requests.write', 'throttle:api.write.heavy']);
        Route::put('/support-request-statuses/{id}', [SupportConfigController::class, 'updateRequestStatus'])
            ->middleware('permission:support_requests.write');
        Route::post('/support_request_statuses', [SupportConfigController::class, 'storeRequestStatus'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-request-statuses,2026-04-27']);
        Route::post('/support_request_statuses/bulk', [SupportConfigController::class, 'storeRequestStatusesBulk'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-request-statuses/bulk,2026-04-27', 'throttle:api.write.heavy']);
        Route::put('/support_request_statuses/{id}', [SupportConfigController::class, 'updateRequestStatus'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-request-statuses/{id},2026-04-27']);

        Route::get('/worklog-activity-types', [SupportConfigController::class, 'worklogActivityTypes'])
            ->middleware('permission:support_requests.read');
        Route::post('/worklog-activity-types', [SupportConfigController::class, 'storeWorklogActivityType'])
            ->middleware('permission:support_requests.write');
        Route::put('/worklog-activity-types/{id}', [SupportConfigController::class, 'updateWorklogActivityType'])
            ->middleware('permission:support_requests.write');
        Route::get('/worklog_activity_types', [SupportConfigController::class, 'worklogActivityTypes'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/worklog-activity-types,2026-04-27']);
        Route::post('/worklog_activity_types', [SupportConfigController::class, 'storeWorklogActivityType'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/worklog-activity-types,2026-04-27']);
        Route::put('/worklog_activity_types/{id}', [SupportConfigController::class, 'updateWorklogActivityType'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/worklog-activity-types/{id},2026-04-27']);

        Route::get('/support-sla-configs', [SupportConfigController::class, 'slaConfigs'])
            ->middleware('permission:support_requests.read');
        Route::post('/support-sla-configs', [SupportConfigController::class, 'storeSlaConfig'])
            ->middleware('permission:support_requests.write');
        Route::put('/support-sla-configs/{id}', [SupportConfigController::class, 'updateSlaConfig'])
            ->middleware('permission:support_requests.write');
        Route::get('/support_sla_configs', [SupportConfigController::class, 'slaConfigs'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/support-sla-configs,2026-04-27']);
        Route::post('/support_sla_configs', [SupportConfigController::class, 'storeSlaConfig'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-sla-configs,2026-04-27']);
        Route::put('/support_sla_configs/{id}', [SupportConfigController::class, 'updateSlaConfig'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/support-sla-configs/{id},2026-04-27']);


        Route::get('/customer-requests', [CustomerRequestController::class, 'index'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-requests/dashboard-summary', [CustomerRequestController::class, 'dashboardSummary'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-requests/dashboard-summary/export', [CustomerRequestController::class, 'exportDashboardSummary'])
            ->middleware('permission:support_requests.export');
        Route::post('/customer-requests', [CustomerRequestController::class, 'store'])
            ->middleware('permission:support_requests.write');
        Route::put('/customer-requests/{id}', [CustomerRequestController::class, 'update'])
            ->middleware('permission:support_requests.write');
        Route::delete('/customer-requests/{id}', [CustomerRequestController::class, 'destroy'])
            ->middleware('permission:support_requests.delete');
        Route::get('/customer-requests/reference-search', [CustomerRequestController::class, 'referenceSearch'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-requests/{id}/history', [CustomerRequestController::class, 'history'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-request-history', [CustomerRequestController::class, 'histories'])
            ->middleware('permission:support_requests.read');
        Route::post('/customer-requests/import', [CustomerRequestController::class, 'import'])
            ->middleware(['permission:support_requests.import', 'throttle:api.write.heavy']);
        Route::get('/customer-requests/export', [CustomerRequestController::class, 'export'])
            ->middleware('permission:support_requests.export');
        Route::get('/customer-requests/receivers', [CustomerRequestController::class, 'receivers'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer-requests/project-items', [CustomerRequestController::class, 'projectItems'])
            ->middleware('permission:support_requests.read');
        Route::get('/customer_requests/project_items', [CustomerRequestController::class, 'projectItems'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests/project-items,2026-04-27']);
        Route::get('/customer_requests', [CustomerRequestController::class, 'index'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests,2026-04-27']);
        Route::get('/customer_requests/dashboard_summary', [CustomerRequestController::class, 'dashboardSummary'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests/dashboard-summary,2026-04-27']);
        Route::get('/customer_requests/dashboard_summary/export', [CustomerRequestController::class, 'exportDashboardSummary'])
            ->middleware(['permission:support_requests.export', 'deprecated.route:/api/v5/customer-requests/dashboard-summary/export,2026-04-27']);
        Route::post('/customer_requests', [CustomerRequestController::class, 'store'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/customer-requests,2026-04-27']);
        Route::put('/customer_requests/{id}', [CustomerRequestController::class, 'update'])
            ->middleware(['permission:support_requests.write', 'deprecated.route:/api/v5/customer-requests/{id},2026-04-27']);
        Route::delete('/customer_requests/{id}', [CustomerRequestController::class, 'destroy'])
            ->middleware(['permission:support_requests.delete', 'deprecated.route:/api/v5/customer-requests/{id},2026-04-27']);
        Route::get('/customer_requests/reference_search', [CustomerRequestController::class, 'referenceSearch'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests/reference-search,2026-04-27']);
        Route::get('/customer_requests/{id}/history', [CustomerRequestController::class, 'history'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests/{id}/history,2026-04-27']);
        Route::get('/customer_request_history', [CustomerRequestController::class, 'histories'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-request-history,2026-04-27']);
        Route::post('/customer_requests/import', [CustomerRequestController::class, 'import'])
            ->middleware(['permission:support_requests.import', 'deprecated.route:/api/v5/customer-requests/import,2026-04-27']);
        Route::get('/customer_requests/export', [CustomerRequestController::class, 'export'])
            ->middleware(['permission:support_requests.export', 'deprecated.route:/api/v5/customer-requests/export,2026-04-27']);
        Route::get('/customer_requests/receivers', [CustomerRequestController::class, 'receivers'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests/receivers,2026-04-27']);
        Route::get('/customer_requests/project_items', [CustomerRequestController::class, 'projectItems'])
            ->middleware(['permission:support_requests.read', 'deprecated.route:/api/v5/customer-requests/project-items,2026-04-27']);

        // =============================================================================
        // WORKFLOW DEFINITIONS
        // =============================================================================
        Route::get('/workflow-definitions', [WorkflowDefinitionController::class, 'index'])
            ->middleware('permission:workflow.manage');
        Route::get('/workflow-definitions/statistics', [WorkflowDefinitionController::class, 'statistics'])
            ->middleware('permission:workflow.manage');
        Route::get('/workflow-definitions/active', [WorkflowDefinitionController::class, 'active'])
            ->middleware('permission:workflow.manage');
        Route::get('/workflow-definitions/default', [WorkflowDefinitionController::class, 'default'])
            ->middleware('permission:workflow.manage');
        Route::get('/workflow-definitions/code/{code}', [WorkflowDefinitionController::class, 'getByCode'])
            ->middleware('permission:workflow.manage');
        Route::get('/workflow-definitions/{id}', [WorkflowDefinitionController::class, 'show'])
            ->middleware('permission:workflow.manage');
        Route::post('/workflow-definitions', [WorkflowDefinitionController::class, 'store'])
            ->middleware('permission:workflow.manage');
        Route::put('/workflow-definitions/{id}', [WorkflowDefinitionController::class, 'update'])
            ->middleware('permission:workflow.manage');
        Route::post('/workflow-definitions/{id}/activate', [WorkflowDefinitionController::class, 'activate'])
            ->middleware('permission:workflow.manage');
        Route::post('/workflow-definitions/{id}/deactivate', [WorkflowDefinitionController::class, 'deactivate'])
            ->middleware('permission:workflow.manage');
        Route::delete('/workflow-definitions/{id}', [WorkflowDefinitionController::class, 'destroy'])
            ->middleware('permission:workflow.manage');

        // =============================================================================
        // WORKFLOW TRANSITIONS
        // =============================================================================
        Route::get('/workflow-definitions/{workflowId}/transitions', [WorkflowTransitionController::class, 'index'])
            ->middleware('permission:workflow.manage');
        Route::get('/workflow-definitions/{workflowId}/transitions/statistics', [WorkflowTransitionController::class, 'statistics'])
            ->middleware('permission:workflow.manage');
        Route::get('/workflow-definitions/{workflowId}/transitions/from/{fromStatusCode}', [WorkflowTransitionController::class, 'fromStatus'])
            ->middleware('permission:workflow.manage');
        Route::get('/workflow-definitions/{workflowId}/transitions/check', [WorkflowTransitionController::class, 'check'])
            ->middleware('permission:workflow.manage');
        Route::get('/workflow-transitions/{id}', [WorkflowTransitionController::class, 'show'])
            ->middleware('permission:workflow.manage');
        Route::post('/workflow-definitions/{workflowId}/transitions', [WorkflowTransitionController::class, 'store'])
            ->middleware('permission:workflow.manage');
        Route::post('/workflow-definitions/{workflowId}/transitions/bulk', [WorkflowTransitionController::class, 'bulkStore'])
            ->middleware('permission:workflow.manage');
        Route::post('/workflow-definitions/{workflowId}/transitions/import', [WorkflowTransitionController::class, 'import'])
            ->middleware('permission:workflow.manage');
        Route::put('/workflow-transitions/{id}', [WorkflowTransitionController::class, 'update'])
            ->middleware('permission:workflow.manage');
        Route::delete('/workflow-transitions/{id}', [WorkflowTransitionController::class, 'destroy'])
            ->middleware('permission:workflow.manage');

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
