<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('request_ref_tasks')) {
            return;
        }

        if (! Schema::hasColumn('request_ref_tasks', 'task_source')) {
            return;
        }

        $query = DB::table('request_ref_tasks')
            ->where(function ($builder): void {
                $builder
                    ->whereNull('task_source')
                    ->orWhere('task_source', '')
                    ->orWhereRaw('UPPER(TRIM(task_source)) = ?', ['IT360']);
            });

        if (Schema::hasColumn('request_ref_tasks', 'source_type')) {
            $query->where('source_type', 'TRANSITION');
        }

        $payload = ['task_source' => 'REFERENCE'];
        if (Schema::hasColumn('request_ref_tasks', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $query->update($payload);
    }

    public function down(): void
    {
        if (! Schema::hasTable('request_ref_tasks') || ! Schema::hasColumn('request_ref_tasks', 'task_source')) {
            return;
        }

        $query = DB::table('request_ref_tasks')
            ->whereRaw('UPPER(TRIM(task_source)) = ?', ['REFERENCE']);

        if (Schema::hasColumn('request_ref_tasks', 'source_type')) {
            $query->where('source_type', 'TRANSITION');
        }

        $payload = ['task_source' => 'IT360'];
        if (Schema::hasColumn('request_ref_tasks', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $query->update($payload);
    }
};
