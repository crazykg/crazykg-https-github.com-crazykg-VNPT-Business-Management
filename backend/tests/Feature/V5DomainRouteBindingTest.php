<?php

namespace Tests\Feature;

use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Collection;
use Tests\TestCase;

class V5DomainRouteBindingTest extends TestCase
{
    public function test_domain_routes_are_bound_to_domain_controllers(): void
    {
        $expectations = [
            ['GET', 'api/v5/health/tables', 'App\Http\Controllers\Api\V5\SystemHealthController@tables', 'permission:system.health.view'],

            ['GET', 'api/v5/roles', 'App\Http\Controllers\Api\V5\UserAccessController@roles', 'permission:authz.manage'],
            ['GET', 'api/v5/permissions', 'App\Http\Controllers\Api\V5\UserAccessController@permissions', 'permission:authz.manage'],
            ['GET', 'api/v5/user-access', 'App\Http\Controllers\Api\V5\UserAccessController@index', 'permission:authz.manage'],
            ['PUT', 'api/v5/user-access/{id}/roles', 'App\Http\Controllers\Api\V5\UserAccessController@updateRoles', 'permission:authz.manage'],
            ['PUT', 'api/v5/user-access/{id}/permissions', 'App\Http\Controllers\Api\V5\UserAccessController@updatePermissions', 'permission:authz.manage'],
            ['PUT', 'api/v5/user-access/{id}/dept-scopes', 'App\Http\Controllers\Api\V5\UserAccessController@updateDeptScopes', 'permission:authz.manage'],

            ['GET', 'api/v5/departments', 'App\Http\Controllers\Api\V5\DepartmentController@index', 'permission:departments.read'],
            ['POST', 'api/v5/departments', 'App\Http\Controllers\Api\V5\DepartmentController@store', 'permission:departments.write'],
            ['PUT', 'api/v5/departments/{id}', 'App\Http\Controllers\Api\V5\DepartmentController@update', 'permission:departments.write'],
            ['DELETE', 'api/v5/departments/{id}', 'App\Http\Controllers\Api\V5\DepartmentController@destroy', 'permission:departments.delete'],

            ['GET', 'api/v5/internal-users', 'App\Http\Controllers\Api\V5\EmployeeController@index', 'permission:employees.read'],
            ['POST', 'api/v5/internal-users', 'App\Http\Controllers\Api\V5\EmployeeController@store', 'permission:employees.write'],
            ['POST', 'api/v5/internal-users/bulk', 'App\Http\Controllers\Api\V5\EmployeeController@storeBulk', 'permission:employees.write'],
            ['POST', 'api/v5/internal-users/{id}/reset-password', 'App\Http\Controllers\Api\V5\EmployeeController@resetPassword', 'permission:employees.write'],
            ['PUT', 'api/v5/internal-users/{id}', 'App\Http\Controllers\Api\V5\EmployeeController@update', 'permission:employees.write'],
            ['DELETE', 'api/v5/internal-users/{id}', 'App\Http\Controllers\Api\V5\EmployeeController@destroy', 'permission:employees.delete'],
            ['GET', 'api/v5/employees', 'App\Http\Controllers\Api\V5\EmployeeController@index', 'permission:employees.read'],
            ['POST', 'api/v5/employees', 'App\Http\Controllers\Api\V5\EmployeeController@store', 'permission:employees.write'],
            ['POST', 'api/v5/employees/bulk', 'App\Http\Controllers\Api\V5\EmployeeController@storeBulk', 'permission:employees.write'],
            ['POST', 'api/v5/employees/{id}/reset-password', 'App\Http\Controllers\Api\V5\EmployeeController@resetPassword', 'permission:employees.write'],
            ['PUT', 'api/v5/employees/{id}', 'App\Http\Controllers\Api\V5\EmployeeController@update', 'permission:employees.write'],
            ['DELETE', 'api/v5/employees/{id}', 'App\Http\Controllers\Api\V5\EmployeeController@destroy', 'permission:employees.delete'],

            ['GET', 'api/v5/customers', 'App\Http\Controllers\Api\V5\CustomerController@index', 'permission:customers.read'],
            ['POST', 'api/v5/customers', 'App\Http\Controllers\Api\V5\CustomerController@store', 'permission:customers.write'],
            ['PUT', 'api/v5/customers/{id}', 'App\Http\Controllers\Api\V5\CustomerController@update', 'permission:customers.write'],
            ['DELETE', 'api/v5/customers/{id}', 'App\Http\Controllers\Api\V5\CustomerController@destroy', 'permission:customers.delete'],

            ['GET', 'api/v5/vendors', 'App\Http\Controllers\Api\V5\VendorController@index', 'permission:vendors.read'],
            ['POST', 'api/v5/vendors', 'App\Http\Controllers\Api\V5\VendorController@store', 'permission:vendors.write'],
            ['PUT', 'api/v5/vendors/{id}', 'App\Http\Controllers\Api\V5\VendorController@update', 'permission:vendors.write'],
            ['DELETE', 'api/v5/vendors/{id}', 'App\Http\Controllers\Api\V5\VendorController@destroy', 'permission:vendors.delete'],

            ['GET', 'api/v5/businesses', 'App\Http\Controllers\Api\V5\BusinessController@index', 'permission:businesses.read'],
            ['POST', 'api/v5/businesses', 'App\Http\Controllers\Api\V5\BusinessController@store', 'permission:businesses.write'],
            ['PUT', 'api/v5/businesses/{id}', 'App\Http\Controllers\Api\V5\BusinessController@update', 'permission:businesses.write'],
            ['DELETE', 'api/v5/businesses/{id}', 'App\Http\Controllers\Api\V5\BusinessController@destroy', 'permission:businesses.delete'],

            ['GET', 'api/v5/products', 'App\Http\Controllers\Api\V5\ProductController@index', 'permission:products.read'],
            ['POST', 'api/v5/products', 'App\Http\Controllers\Api\V5\ProductController@store', 'permission:products.write'],
            ['PUT', 'api/v5/products/{id}', 'App\Http\Controllers\Api\V5\ProductController@update', 'permission:products.write'],
            ['DELETE', 'api/v5/products/{id}', 'App\Http\Controllers\Api\V5\ProductController@destroy', 'permission:products.delete'],

            ['GET', 'api/v5/customer-personnel', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@index', 'permission:customer_personnel.read'],
            ['POST', 'api/v5/customer-personnel', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@store', 'permission:customer_personnel.write'],
            ['PUT', 'api/v5/customer-personnel/{id}', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@update', 'permission:customer_personnel.write'],
            ['DELETE', 'api/v5/customer-personnel/{id}', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@destroy', 'permission:customer_personnel.delete'],
            ['GET', 'api/v5/customer_personnel', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@index', 'permission:customer_personnel.read'],
            ['POST', 'api/v5/customer_personnel', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@store', 'permission:customer_personnel.write'],
            ['PUT', 'api/v5/customer_personnel/{id}', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@update', 'permission:customer_personnel.write'],
            ['DELETE', 'api/v5/customer_personnel/{id}', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@destroy', 'permission:customer_personnel.delete'],
            ['GET', 'api/v5/cus-personnel', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@index', 'permission:customer_personnel.read'],
            ['POST', 'api/v5/cus-personnel', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@store', 'permission:customer_personnel.write'],
            ['PUT', 'api/v5/cus-personnel/{id}', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@update', 'permission:customer_personnel.write'],
            ['DELETE', 'api/v5/cus-personnel/{id}', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@destroy', 'permission:customer_personnel.delete'],
            ['GET', 'api/v5/cus_personnel', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@index', 'permission:customer_personnel.read'],
            ['POST', 'api/v5/cus_personnel', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@store', 'permission:customer_personnel.write'],
            ['PUT', 'api/v5/cus_personnel/{id}', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@update', 'permission:customer_personnel.write'],
            ['DELETE', 'api/v5/cus_personnel/{id}', 'App\Http\Controllers\Api\V5\CustomerPersonnelController@destroy', 'permission:customer_personnel.delete'],

            ['GET', 'api/v5/monthly-calendars', 'App\Http\Controllers\Api\V5\MonthlyCalendarController@index', 'permission:support_requests.read'],
            ['PUT', 'api/v5/monthly-calendars/{date}', 'App\Http\Controllers\Api\V5\MonthlyCalendarController@update', 'permission:support_requests.write'],
            ['POST', 'api/v5/monthly-calendars/generate', 'App\Http\Controllers\Api\V5\MonthlyCalendarController@generateYear', 'permission:support_requests.write'],

            ['GET', 'api/v5/audit-logs', 'App\Http\Controllers\Api\V5\AuditLogController@index', 'permission:audit_logs.read'],
            ['GET', 'api/v5/audit_logs', 'App\Http\Controllers\Api\V5\AuditLogController@index', 'permission:audit_logs.read'],

            ['GET', 'api/v5/support-contact-positions', 'App\Http\Controllers\Api\V5\SupportContactPositionController@index', 'permission:support_contact_positions.read'],
            ['POST', 'api/v5/support-contact-positions', 'App\Http\Controllers\Api\V5\SupportContactPositionController@store', 'permission:support_contact_positions.write'],
            ['POST', 'api/v5/support-contact-positions/bulk', 'App\Http\Controllers\Api\V5\SupportContactPositionController@storeBulk', 'permission:support_contact_positions.write'],
            ['PUT', 'api/v5/support-contact-positions/{id}', 'App\Http\Controllers\Api\V5\SupportContactPositionController@update', 'permission:support_contact_positions.write'],
            ['GET', 'api/v5/support_contact_positions', 'App\Http\Controllers\Api\V5\SupportContactPositionController@index', 'permission:support_contact_positions.read'],
            ['POST', 'api/v5/support_contact_positions', 'App\Http\Controllers\Api\V5\SupportContactPositionController@store', 'permission:support_contact_positions.write'],
            ['POST', 'api/v5/support_contact_positions/bulk', 'App\Http\Controllers\Api\V5\SupportContactPositionController@storeBulk', 'permission:support_contact_positions.write'],
            ['PUT', 'api/v5/support_contact_positions/{id}', 'App\Http\Controllers\Api\V5\SupportContactPositionController@update', 'permission:support_contact_positions.write'],

            ['GET', 'api/v5/workflow-status-catalogs', 'App\Http\Controllers\Api\V5\WorkflowConfigController@statusCatalogs', 'permission:support_requests.read'],
            ['POST', 'api/v5/workflow-status-catalogs', 'App\Http\Controllers\Api\V5\WorkflowConfigController@storeStatusCatalog', 'permission:support_requests.write'],
            ['PUT', 'api/v5/workflow-status-catalogs/{id}', 'App\Http\Controllers\Api\V5\WorkflowConfigController@updateStatusCatalog', 'permission:support_requests.write'],
            ['GET', 'api/v5/workflow_status_catalogs', 'App\Http\Controllers\Api\V5\WorkflowConfigController@statusCatalogs', 'permission:support_requests.read'],
            ['POST', 'api/v5/workflow_status_catalogs', 'App\Http\Controllers\Api\V5\WorkflowConfigController@storeStatusCatalog', 'permission:support_requests.write'],
            ['PUT', 'api/v5/workflow_status_catalogs/{id}', 'App\Http\Controllers\Api\V5\WorkflowConfigController@updateStatusCatalog', 'permission:support_requests.write'],

            ['GET', 'api/v5/workflow-status-transitions', 'App\Http\Controllers\Api\V5\WorkflowConfigController@statusTransitions', 'permission:support_requests.read'],
            ['POST', 'api/v5/workflow-status-transitions', 'App\Http\Controllers\Api\V5\WorkflowConfigController@storeStatusTransition', 'permission:support_requests.write'],
            ['PUT', 'api/v5/workflow-status-transitions/{id}', 'App\Http\Controllers\Api\V5\WorkflowConfigController@updateStatusTransition', 'permission:support_requests.write'],
            ['GET', 'api/v5/workflow_status_transitions', 'App\Http\Controllers\Api\V5\WorkflowConfigController@statusTransitions', 'permission:support_requests.read'],
            ['POST', 'api/v5/workflow_status_transitions', 'App\Http\Controllers\Api\V5\WorkflowConfigController@storeStatusTransition', 'permission:support_requests.write'],
            ['PUT', 'api/v5/workflow_status_transitions/{id}', 'App\Http\Controllers\Api\V5\WorkflowConfigController@updateStatusTransition', 'permission:support_requests.write'],

            ['GET', 'api/v5/workflow-form-field-configs', 'App\Http\Controllers\Api\V5\WorkflowConfigController@formFieldConfigs', 'permission:support_requests.read'],
            ['POST', 'api/v5/workflow-form-field-configs', 'App\Http\Controllers\Api\V5\WorkflowConfigController@storeFormFieldConfig', 'permission:support_requests.write'],
            ['PUT', 'api/v5/workflow-form-field-configs/{id}', 'App\Http\Controllers\Api\V5\WorkflowConfigController@updateFormFieldConfig', 'permission:support_requests.write'],
            ['GET', 'api/v5/workflow_form_field_configs', 'App\Http\Controllers\Api\V5\WorkflowConfigController@formFieldConfigs', 'permission:support_requests.read'],
            ['POST', 'api/v5/workflow_form_field_configs', 'App\Http\Controllers\Api\V5\WorkflowConfigController@storeFormFieldConfig', 'permission:support_requests.write'],
            ['PUT', 'api/v5/workflow_form_field_configs/{id}', 'App\Http\Controllers\Api\V5\WorkflowConfigController@updateFormFieldConfig', 'permission:support_requests.write'],

            ['GET', 'api/v5/projects', 'App\Http\Controllers\Api\V5\ProjectController@index', 'permission:projects.read'],
            ['GET', 'api/v5/projects/raci-assignments', 'App\Http\Controllers\Api\V5\ProjectController@raciAssignments', 'permission:projects.read'],
            ['GET', 'api/v5/projects/{id}', 'App\Http\Controllers\Api\V5\ProjectController@show', 'permission:projects.read'],
            ['GET', 'api/v5/project-items', 'App\Http\Controllers\Api\V5\ProjectController@projectItems', 'permission:projects.read'],
            ['GET', 'api/v5/project_items', 'App\Http\Controllers\Api\V5\ProjectController@projectItems', 'permission:projects.read'],
            ['GET', 'api/v5/project-types', 'App\Http\Controllers\Api\V5\ProjectController@projectTypes', 'permission:projects.read'],
            ['POST', 'api/v5/project-types', 'App\Http\Controllers\Api\V5\ProjectController@storeProjectType', 'permission:projects.write'],
            ['PUT', 'api/v5/project-types/{id}', 'App\Http\Controllers\Api\V5\ProjectController@updateProjectType', 'permission:projects.write'],
            ['POST', 'api/v5/projects', 'App\Http\Controllers\Api\V5\ProjectController@store', 'permission:projects.write'],
            ['PUT', 'api/v5/projects/{id}', 'App\Http\Controllers\Api\V5\ProjectController@update', 'permission:projects.write'],
            ['DELETE', 'api/v5/projects/{id}', 'App\Http\Controllers\Api\V5\ProjectController@destroy', 'permission:projects.delete'],

            ['GET', 'api/v5/contracts', 'App\Http\Controllers\Api\V5\ContractController@index', 'permission:contracts.read'],
            ['POST', 'api/v5/contracts', 'App\Http\Controllers\Api\V5\ContractController@store', 'permission:contracts.write'],
            ['PUT', 'api/v5/contracts/{id}', 'App\Http\Controllers\Api\V5\ContractController@update', 'permission:contracts.write'],
            ['DELETE', 'api/v5/contracts/{id}', 'App\Http\Controllers\Api\V5\ContractController@destroy', 'permission:contracts.delete'],

            ['GET', 'api/v5/opportunities', 'App\Http\Controllers\Api\V5\OpportunityController@index', 'permission:opportunities.read'],
            ['GET', 'api/v5/opportunities/raci-assignments', 'App\Http\Controllers\Api\V5\OpportunityController@raciAssignments', 'permission:opportunities.read'],
            ['GET', 'api/v5/opportunity-stages', 'App\Http\Controllers\Api\V5\OpportunityController@opportunityStages', 'permission:opportunities.read'],
            ['GET', 'api/v5/opportunity_stages', 'App\Http\Controllers\Api\V5\OpportunityController@opportunityStages', 'permission:opportunities.read'],
            ['POST', 'api/v5/opportunity-stages', 'App\Http\Controllers\Api\V5\OpportunityController@storeOpportunityStage', 'permission:opportunities.write'],
            ['PUT', 'api/v5/opportunity-stages/{id}', 'App\Http\Controllers\Api\V5\OpportunityController@updateOpportunityStage', 'permission:opportunities.write'],
            ['POST', 'api/v5/opportunity_stages', 'App\Http\Controllers\Api\V5\OpportunityController@storeOpportunityStage', 'permission:opportunities.write'],
            ['PUT', 'api/v5/opportunity_stages/{id}', 'App\Http\Controllers\Api\V5\OpportunityController@updateOpportunityStage', 'permission:opportunities.write'],
            ['POST', 'api/v5/opportunities', 'App\Http\Controllers\Api\V5\OpportunityController@store', 'permission:opportunities.write'],
            ['PUT', 'api/v5/opportunities/{id}', 'App\Http\Controllers\Api\V5\OpportunityController@update', 'permission:opportunities.write'],
            ['DELETE', 'api/v5/opportunities/{id}', 'App\Http\Controllers\Api\V5\OpportunityController@destroy', 'permission:opportunities.delete'],

            ['GET', 'api/v5/customer-requests', 'App\Http\Controllers\Api\V5\CustomerRequestController@index', 'permission:support_requests.read'],
            ['GET', 'api/v5/customer-requests/dashboard-summary', 'App\Http\Controllers\Api\V5\CustomerRequestController@dashboardSummary', 'permission:support_requests.read'],
            ['GET', 'api/v5/customer-requests/dashboard-summary/export', 'App\Http\Controllers\Api\V5\CustomerRequestController@exportDashboardSummary', 'permission:support_requests.export'],
            ['POST', 'api/v5/customer-requests', 'App\Http\Controllers\Api\V5\CustomerRequestController@store', 'permission:support_requests.write'],
            ['PUT', 'api/v5/customer-requests/{id}', 'App\Http\Controllers\Api\V5\CustomerRequestController@update', 'permission:support_requests.write'],
            ['DELETE', 'api/v5/customer-requests/{id}', 'App\Http\Controllers\Api\V5\CustomerRequestController@destroy', 'permission:support_requests.delete'],
            ['GET', 'api/v5/customer-requests/reference-search', 'App\Http\Controllers\Api\V5\CustomerRequestController@referenceSearch', 'permission:support_requests.read'],
            ['GET', 'api/v5/customer-requests/{id}/history', 'App\Http\Controllers\Api\V5\CustomerRequestController@history', 'permission:support_requests.read'],
            ['GET', 'api/v5/customer-request-history', 'App\Http\Controllers\Api\V5\CustomerRequestController@histories', 'permission:support_requests.read'],
            ['POST', 'api/v5/customer-requests/import', 'App\Http\Controllers\Api\V5\CustomerRequestController@import', 'permission:support_requests.import'],
            ['GET', 'api/v5/customer-requests/export', 'App\Http\Controllers\Api\V5\CustomerRequestController@export', 'permission:support_requests.export'],
            ['GET', 'api/v5/customer-requests/receivers', 'App\Http\Controllers\Api\V5\CustomerRequestController@receivers', 'permission:support_requests.read'],
            ['GET', 'api/v5/customer-requests/project-items', 'App\Http\Controllers\Api\V5\CustomerRequestController@projectItems', 'permission:support_requests.read'],
            ['GET', 'api/v5/customer_requests', 'App\Http\Controllers\Api\V5\CustomerRequestController@index', 'permission:support_requests.read'],
            ['GET', 'api/v5/customer_requests/dashboard_summary', 'App\Http\Controllers\Api\V5\CustomerRequestController@dashboardSummary', 'permission:support_requests.read'],
            ['GET', 'api/v5/customer_requests/dashboard_summary/export', 'App\Http\Controllers\Api\V5\CustomerRequestController@exportDashboardSummary', 'permission:support_requests.export'],
            ['POST', 'api/v5/customer_requests', 'App\Http\Controllers\Api\V5\CustomerRequestController@store', 'permission:support_requests.write'],
            ['PUT', 'api/v5/customer_requests/{id}', 'App\Http\Controllers\Api\V5\CustomerRequestController@update', 'permission:support_requests.write'],
            ['DELETE', 'api/v5/customer_requests/{id}', 'App\Http\Controllers\Api\V5\CustomerRequestController@destroy', 'permission:support_requests.delete'],
            ['GET', 'api/v5/customer_requests/reference_search', 'App\Http\Controllers\Api\V5\CustomerRequestController@referenceSearch', 'permission:support_requests.read'],
            ['GET', 'api/v5/customer_requests/{id}/history', 'App\Http\Controllers\Api\V5\CustomerRequestController@history', 'permission:support_requests.read'],
            ['GET', 'api/v5/customer_request_history', 'App\Http\Controllers\Api\V5\CustomerRequestController@histories', 'permission:support_requests.read'],
            ['POST', 'api/v5/customer_requests/import', 'App\Http\Controllers\Api\V5\CustomerRequestController@import', 'permission:support_requests.import'],
            ['GET', 'api/v5/customer_requests/export', 'App\Http\Controllers\Api\V5\CustomerRequestController@export', 'permission:support_requests.export'],
            ['GET', 'api/v5/customer_requests/receivers', 'App\Http\Controllers\Api\V5\CustomerRequestController@receivers', 'permission:support_requests.read'],
            ['GET', 'api/v5/customer_requests/project_items', 'App\Http\Controllers\Api\V5\CustomerRequestController@projectItems', 'permission:support_requests.read'],
        ];

        foreach ($expectations as [$method, $uri, $expectedAction, $expectedPermission]) {
            $route = $this->findRoute($method, $uri);
            $this->assertSame($expectedAction, $route->getActionName(), "Unexpected action for {$method} {$uri}.");
            $this->assertContains(
                $expectedPermission,
                $route->middleware(),
                "Missing permission middleware for {$method} {$uri}."
            );
        }
    }

    private function findRoute(string $method, string $uri): LaravelRoute
    {
        /** @var Collection<int, LaravelRoute> $routes */
        $routes = collect(app('router')->getRoutes()->getRoutes());
        $route = $routes->first(
            fn (LaravelRoute $item): bool => $item->uri() === $uri
                && in_array(strtoupper($method), $item->methods(), true)
        );

        $this->assertInstanceOf(LaravelRoute::class, $route, "Route {$method} {$uri} was not found.");

        return $route;
    }
}
