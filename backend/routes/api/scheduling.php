<?php

use App\Http\Controllers\Api\V5\DepartmentWeeklyScheduleController;
use App\Http\Controllers\Api\V5\MonthlyCalendarController;
use Illuminate\Support\Facades\Route;

Route::get('/department-weekly-schedules', [DepartmentWeeklyScheduleController::class, 'index'])
    ->middleware('permission:support_requests.read');
Route::get('/department-weekly-schedules/{id}', [DepartmentWeeklyScheduleController::class, 'show'])
    ->middleware('permission:support_requests.read');
Route::post('/department-weekly-schedules', [DepartmentWeeklyScheduleController::class, 'store'])
    ->middleware('permission:support_requests.write');
Route::put('/department-weekly-schedules/{id}', [DepartmentWeeklyScheduleController::class, 'update'])
    ->middleware('permission:support_requests.write');
Route::delete('/department-weekly-schedules/{scheduleId}/entries/{entryId}', [DepartmentWeeklyScheduleController::class, 'destroyEntry'])
    ->middleware('permission:support_requests.write');
Route::delete('/department-weekly-schedules/{id}', [DepartmentWeeklyScheduleController::class, 'destroy'])
    ->middleware('permission:support_requests.write');

Route::get('/monthly-calendars', [MonthlyCalendarController::class, 'index'])
    ->middleware('permission:support_requests.read');
Route::put('/monthly-calendars/{date}', [MonthlyCalendarController::class, 'update'])
    ->middleware('permission:support_requests.write');
Route::post('/monthly-calendars/generate', [MonthlyCalendarController::class, 'generateYear'])
    ->middleware('permission:support_requests.write');
