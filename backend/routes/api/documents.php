<?php

use App\Http\Controllers\Api\V5\AsyncExportController;
use App\Http\Controllers\Api\V5\DocumentController;
use Illuminate\Support\Facades\Route;

Route::get('/documents', [DocumentController::class, 'index'])
    ->middleware('permission:documents.read');
Route::post('/documents', [DocumentController::class, 'store'])
    ->middleware('permission:documents.write');
Route::post('/documents/upload-attachment', [DocumentController::class, 'uploadAttachment'])
    ->middleware(['permission:documents.write', 'throttle:api.write.heavy']);
Route::delete('/documents/upload-attachment', [DocumentController::class, 'deleteUploadedAttachment'])
    ->middleware('permission:documents.write');
Route::post('/documents/attachments/{id}/link', [DocumentController::class, 'linkAttachment'])
    ->middleware('permission:documents.write');
Route::put('/documents/{id}', [DocumentController::class, 'update'])
    ->middleware('permission:documents.write');
Route::delete('/documents/{id}', [DocumentController::class, 'destroy'])
    ->middleware('permission:documents.delete');

Route::get('/exports/{uuid}/download', [AsyncExportController::class, 'download'])
    ->middleware('permission:support_requests.read');
Route::get('/exports/{uuid}', [AsyncExportController::class, 'show'])
    ->middleware('permission:support_requests.read');
