<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

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
});
