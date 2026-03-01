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
            ['GET', 'api/v5/departments', 'App\Http\Controllers\Api\V5\DepartmentController@index', 'permission:departments.read'],
            ['POST', 'api/v5/departments', 'App\Http\Controllers\Api\V5\DepartmentController@store', 'permission:departments.write'],
            ['PUT', 'api/v5/departments/{id}', 'App\Http\Controllers\Api\V5\DepartmentController@update', 'permission:departments.write'],
            ['DELETE', 'api/v5/departments/{id}', 'App\Http\Controllers\Api\V5\DepartmentController@destroy', 'permission:departments.delete'],

            ['GET', 'api/v5/customers', 'App\Http\Controllers\Api\V5\CustomerController@index', 'permission:customers.read'],
            ['POST', 'api/v5/customers', 'App\Http\Controllers\Api\V5\CustomerController@store', 'permission:customers.write'],
            ['PUT', 'api/v5/customers/{id}', 'App\Http\Controllers\Api\V5\CustomerController@update', 'permission:customers.write'],
            ['DELETE', 'api/v5/customers/{id}', 'App\Http\Controllers\Api\V5\CustomerController@destroy', 'permission:customers.delete'],

            ['GET', 'api/v5/vendors', 'App\Http\Controllers\Api\V5\VendorController@index', 'permission:vendors.read'],
            ['POST', 'api/v5/vendors', 'App\Http\Controllers\Api\V5\VendorController@store', 'permission:vendors.write'],
            ['PUT', 'api/v5/vendors/{id}', 'App\Http\Controllers\Api\V5\VendorController@update', 'permission:vendors.write'],
            ['DELETE', 'api/v5/vendors/{id}', 'App\Http\Controllers\Api\V5\VendorController@destroy', 'permission:vendors.delete'],

            ['GET', 'api/v5/businesses', 'App\Http\Controllers\Api\V5MasterDataController@businesses', 'permission:businesses.read'],
            ['POST', 'api/v5/businesses', 'App\Http\Controllers\Api\V5MasterDataController@storeBusiness', 'permission:businesses.write'],
            ['PUT', 'api/v5/businesses/{id}', 'App\Http\Controllers\Api\V5MasterDataController@updateBusiness', 'permission:businesses.write'],
            ['DELETE', 'api/v5/businesses/{id}', 'App\Http\Controllers\Api\V5MasterDataController@deleteBusiness', 'permission:businesses.delete'],

            ['GET', 'api/v5/projects', 'App\Http\Controllers\Api\V5\ProjectController@index', 'permission:projects.read'],
            ['POST', 'api/v5/projects', 'App\Http\Controllers\Api\V5\ProjectController@store', 'permission:projects.write'],
            ['PUT', 'api/v5/projects/{id}', 'App\Http\Controllers\Api\V5\ProjectController@update', 'permission:projects.write'],
            ['DELETE', 'api/v5/projects/{id}', 'App\Http\Controllers\Api\V5\ProjectController@destroy', 'permission:projects.delete'],

            ['GET', 'api/v5/contracts', 'App\Http\Controllers\Api\V5\ContractController@index', 'permission:contracts.read'],
            ['POST', 'api/v5/contracts', 'App\Http\Controllers\Api\V5\ContractController@store', 'permission:contracts.write'],
            ['PUT', 'api/v5/contracts/{id}', 'App\Http\Controllers\Api\V5\ContractController@update', 'permission:contracts.write'],
            ['DELETE', 'api/v5/contracts/{id}', 'App\Http\Controllers\Api\V5\ContractController@destroy', 'permission:contracts.delete'],

            ['GET', 'api/v5/opportunities', 'App\Http\Controllers\Api\V5\OpportunityController@index', 'permission:opportunities.read'],
            ['POST', 'api/v5/opportunities', 'App\Http\Controllers\Api\V5\OpportunityController@store', 'permission:opportunities.write'],
            ['PUT', 'api/v5/opportunities/{id}', 'App\Http\Controllers\Api\V5\OpportunityController@update', 'permission:opportunities.write'],
            ['DELETE', 'api/v5/opportunities/{id}', 'App\Http\Controllers\Api\V5\OpportunityController@destroy', 'permission:opportunities.delete'],
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
