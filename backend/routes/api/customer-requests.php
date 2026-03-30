<?php

use App\Http\Controllers\Api\V5\CustomerRequestCaseController;
use App\Http\Controllers\Api\V5\CustomerRequestController;
use App\Http\Controllers\Api\V5\CustomerRequestEscalationController;
use App\Http\Controllers\Api\V5\CustomerRequestPlanController;
use App\Http\Controllers\Api\V5\CustomerRequestReportController;
use App\Http\Controllers\Api\V5\LeadershipDashboardController;
use App\Http\Controllers\Api\V5\LeadershipDirectiveController;
use Illuminate\Support\Facades\Route;

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

Route::get('/customer-request-cases/reports/monthly-hours', [CustomerRequestReportController::class, 'monthlyHours'])
    ->middleware('permission:support_requests.read');
Route::get('/customer-request-cases/reports/pain-points', [CustomerRequestReportController::class, 'painPoints'])
    ->middleware('permission:support_requests.read');
Route::get('/customer-request-cases/reports/weekly-hours', [CustomerRequestReportController::class, 'weeklyHours'])
    ->middleware('permission:support_requests.read');
Route::get('/customer-request-cases/reports/trend', [CustomerRequestReportController::class, 'trend'])
    ->middleware('permission:support_requests.read');

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

Route::get('/leadership/dashboard', [LeadershipDashboardController::class, 'dashboard'])
    ->middleware('permission:support_requests.read');
Route::get('/leadership/risks', [LeadershipDashboardController::class, 'risks'])
    ->middleware('permission:support_requests.read');
Route::get('/leadership/team-comparison', [LeadershipDashboardController::class, 'teamComparison'])
    ->middleware('permission:support_requests.read');

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
