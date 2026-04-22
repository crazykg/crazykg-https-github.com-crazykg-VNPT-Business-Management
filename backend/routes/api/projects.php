<?php

use App\Http\Controllers\Api\V5\ProjectController;
use App\Http\Controllers\Api\V5\ProjectProcedureController;
use Illuminate\Support\Facades\Route;

Route::get('/projects', [ProjectController::class, 'index'])
    ->middleware('permission:projects.read');
Route::get('/projects/raci-assignments', [ProjectController::class, 'raciAssignments'])
    ->middleware('permission:projects.read');
Route::get('/projects/implementation-unit-options', [ProjectController::class, 'implementationUnitOptions'])
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

Route::get('/projects/{projectId}/revenue-schedules', [ProjectController::class, 'revenueSchedules'])
    ->middleware('permission:projects.read');
Route::post('/projects/{projectId}/revenue-schedules/sync', [ProjectController::class, 'syncRevenueSchedules'])
    ->middleware('permission:projects.write');
Route::post('/projects/{projectId}/revenue-schedules/generate', [ProjectController::class, 'generateRevenueSchedules'])
    ->middleware('permission:projects.write');

Route::get('/project-procedure-templates', [ProjectProcedureController::class, 'templates'])
    ->middleware('permission:projects.read');
Route::post('/project-procedure-templates', [ProjectProcedureController::class, 'storeTemplate'])
    ->middleware('permission:projects.write');
Route::put('/project-procedure-templates/{id}', [ProjectProcedureController::class, 'updateTemplate'])
    ->middleware('permission:projects.write');
Route::delete('/project-procedure-templates/{id}', [ProjectProcedureController::class, 'deleteTemplate'])
    ->middleware('permission:projects.write');
Route::get('/project-procedure-templates/{templateId}/steps', [ProjectProcedureController::class, 'templateSteps'])
    ->middleware('permission:projects.read');
Route::delete('/project-procedure-templates/{templateId}/steps', [ProjectProcedureController::class, 'deleteTemplateSteps'])
    ->middleware('permission:projects.write');
Route::post('/project-procedure-templates/{templateId}/steps/import', [ProjectProcedureController::class, 'importTemplateSteps'])
    ->middleware('permission:projects.write');
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
Route::get('/project-procedure-steps/{stepId}/worklogs', [ProjectProcedureController::class, 'stepWorklogs'])
    ->middleware('permission:projects.read');
Route::post('/project-procedure-steps/{stepId}/worklogs', [ProjectProcedureController::class, 'addWorklog'])
    ->middleware('permission:projects.write');
Route::patch('/project-procedure-worklogs/{logId}', [ProjectProcedureController::class, 'updateWorklog'])
    ->middleware('permission:projects.write');
Route::delete('/project-procedure-worklogs/{logId}', [ProjectProcedureController::class, 'deleteWorklog'])
    ->middleware('permission:projects.write');
Route::get('/project-procedures/{procedureId}/worklogs', [ProjectProcedureController::class, 'procedureWorklogs'])
    ->middleware('permission:projects.read');
Route::patch('/shared-issues/{issueId}/status', [ProjectProcedureController::class, 'updateIssueStatus'])
    ->middleware('permission:projects.write');
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
Route::get('/project-procedure-steps/{stepId}/attachments', [ProjectProcedureController::class, 'stepAttachments'])
    ->middleware('permission:projects.read');
Route::post('/project-procedure-steps/{stepId}/attachments', [ProjectProcedureController::class, 'linkStepAttachment'])
    ->middleware('permission:projects.write');
Route::delete('/project-procedure-steps/{stepId}/attachments/{attachmentId}', [ProjectProcedureController::class, 'deleteStepAttachment'])
    ->middleware('permission:projects.delete');

Route::get('/project-types', [ProjectController::class, 'projectTypes'])
    ->middleware('permission:projects.read');
Route::post('/project-types', [ProjectController::class, 'storeProjectType'])
    ->middleware('permission:projects.write');
Route::put('/project-types/{id}', [ProjectController::class, 'updateProjectType'])
    ->middleware('permission:projects.write');
