<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\V5\DocumentController;
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

    Route::middleware(['auth:sanctum', 'throttle:api.write'])->group(__DIR__.'/api/auth.php');

    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(__DIR__.'/api/admin.php');
    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(__DIR__.'/api/master-data.php');
    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(__DIR__.'/api/customers.php');
    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(__DIR__.'/api/projects.php');
    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(__DIR__.'/api/contracts.php');
    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(__DIR__.'/api/fee-collection.php');
    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(__DIR__.'/api/revenue.php');
    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(__DIR__.'/api/documents.php');
    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(__DIR__.'/api/support.php');
    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(__DIR__.'/api/customer-requests.php');
    Route::middleware(['auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])->group(__DIR__.'/api/scheduling.php');
});
