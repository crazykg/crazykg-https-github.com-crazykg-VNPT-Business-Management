<?php

use App\Http\Controllers\Api\V5\ContractController;
use Illuminate\Support\Facades\Route;

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
