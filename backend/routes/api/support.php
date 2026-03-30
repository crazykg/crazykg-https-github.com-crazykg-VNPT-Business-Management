<?php

use App\Http\Controllers\Api\V5\FeedbackController;
use App\Http\Controllers\Api\V5\SupportConfigController;
use App\Http\Controllers\Api\V5\SupportContactPositionController;
use Illuminate\Support\Facades\Route;

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
