<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\V5\AuditLogController;
use App\Http\Controllers\Api\V5\IntegrationSettingsController;
use App\Http\Controllers\Api\V5\SystemHealthController;
use App\Http\Controllers\Api\V5\UserAccessController;
use Illuminate\Support\Facades\Route;

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
Route::get('/integrations/telegram', [IntegrationSettingsController::class, 'telegramSettings'])
    ->middleware('permission:authz.manage');
Route::put('/integrations/telegram', [IntegrationSettingsController::class, 'updateTelegramSettings'])
    ->middleware('permission:authz.manage');
Route::post('/integrations/telegram/test', [IntegrationSettingsController::class, 'testTelegramSettings'])
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
Route::post('/reminders/{id}/send-telegram', [IntegrationSettingsController::class, 'sendReminderTelegram'])
    ->middleware('permission:reminders.write');
Route::get('/user-dept-history', [IntegrationSettingsController::class, 'userDeptHistory'])
    ->middleware('permission:user_dept_history.read');
Route::post('/user-dept-history', [IntegrationSettingsController::class, 'storeUserDeptHistory'])
    ->middleware('permission:user_dept_history.write');
Route::put('/user-dept-history/{id}', [IntegrationSettingsController::class, 'updateUserDeptHistory'])
    ->middleware('permission:user_dept_history.write');
Route::delete('/user-dept-history/{id}', [IntegrationSettingsController::class, 'destroyUserDeptHistory'])
    ->middleware('permission:user_dept_history.delete');
Route::get('/user_dept_history', [IntegrationSettingsController::class, 'userDeptHistory'])
    ->middleware(['permission:user_dept_history.read', 'deprecated.route:/api/v5/user-dept-history,2026-04-27']);
Route::post('/user_dept_history', [IntegrationSettingsController::class, 'storeUserDeptHistory'])
    ->middleware(['permission:user_dept_history.write', 'deprecated.route:/api/v5/user-dept-history,2026-04-27']);
Route::put('/user_dept_history/{id}', [IntegrationSettingsController::class, 'updateUserDeptHistory'])
    ->middleware(['permission:user_dept_history.write', 'deprecated.route:/api/v5/user-dept-history,2026-04-27']);
Route::delete('/user_dept_history/{id}', [IntegrationSettingsController::class, 'destroyUserDeptHistory'])
    ->middleware(['permission:user_dept_history.delete', 'deprecated.route:/api/v5/user-dept-history,2026-04-27']);

Route::get('/audit-logs', [AuditLogController::class, 'index'])
    ->middleware('permission:audit_logs.read');
Route::get('/audit_logs', [AuditLogController::class, 'index'])
    ->middleware(['permission:audit_logs.read', 'deprecated.route:/api/v5/audit-logs,2026-04-27']);
