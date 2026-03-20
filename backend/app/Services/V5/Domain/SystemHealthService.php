<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class SystemHealthService
{
    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    public function tables(): JsonResponse
    {
        $tables = [
            'departments',
            'internal_users',
            'business_domains',
            'products',
            'customers',
            'customer_personnel',
            'vendors',
            'projects',
            'project_items',
            'contracts',
            'payment_schedules',
            'opportunities',
            'documents',
            'document_product_links',
            'reminders',
            'user_dept_history',
            'audit_logs',
            'support_service_groups',
            'support_contact_positions',
            'opportunity_stages',
            'support_requests',
            'support_request_history',
        ];

        $status = [];
        foreach ($tables as $table) {
            $status[$table] = $this->support->hasTable($table);
        }

        $connectionName = (string) config('database.default');
        $databaseName = null;
        try {
            $databaseName = DB::connection()->getDatabaseName();
        } catch (\Throwable) {
            $databaseName = null;
        }

        return response()->json([
            'data' => $status,
            'meta' => [
                'connection' => $connectionName,
                'database' => $databaseName,
                'employee_source' => $this->support->resolveEmployeeTable(),
            ],
        ]);
    }
}
