<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled Commands
|--------------------------------------------------------------------------
*/

// Snapshot giờ công tháng trước — chạy ngày 1 mỗi tháng lúc 00:30
Schedule::command('crc:snapshot-hours')->monthlyOn(1, '00:30');
