<?php

use App\Http\Controllers\Api\V5\FeeCollectionController;
use Illuminate\Support\Facades\Route;

Route::get('/fee-collection/dashboard', [FeeCollectionController::class, 'dashboard'])
    ->middleware('permission:fee_collection.read');
Route::get('/fee-collection/debt-aging', [FeeCollectionController::class, 'debtAgingReport'])
    ->middleware('permission:fee_collection.read');
Route::get('/fee-collection/debt-by-customer', [FeeCollectionController::class, 'debtByCustomer'])
    ->middleware('permission:fee_collection.read');
Route::get('/fee-collection/debt-trend', [FeeCollectionController::class, 'debtTrend'])
    ->middleware('permission:fee_collection.read');

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

Route::get('/invoices/{invoiceId}/dunning-logs', [FeeCollectionController::class, 'dunningLogIndex'])
    ->middleware('permission:fee_collection.read');
Route::post('/invoices/{invoiceId}/dunning-logs', [FeeCollectionController::class, 'dunningLogStore'])
    ->middleware('permission:fee_collection.write');

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
