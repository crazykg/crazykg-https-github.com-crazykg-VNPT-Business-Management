<?php

use App\Http\Controllers\Api\V5\RevenueManagementController;
use Illuminate\Support\Facades\Route;

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
