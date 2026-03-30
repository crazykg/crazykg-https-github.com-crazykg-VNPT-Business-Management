<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/auth/me', [AuthController::class, 'me']);
Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
Route::post('/auth/logout', [AuthController::class, 'logout']);
Route::post('/auth/tab/claim', [AuthController::class, 'tabClaim']);
