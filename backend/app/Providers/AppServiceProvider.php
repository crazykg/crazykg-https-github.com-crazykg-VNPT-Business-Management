<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->registerModuleProviders();
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->loadModuleRoutes();
        $this->loadModuleMigrations();
        $this->registerRateLimiters();
    }

    /**
     * Auto-discover and register ServiceProviders from each module's Providers directory.
     */
    private function registerModuleProviders(): void
    {
        $modulesPath = app_path('Modules');
        if (! is_dir($modulesPath)) {
            return;
        }

        foreach (glob("{$modulesPath}/*/Providers/*ServiceProvider.php") as $providerFile) {
            // Derive FQCN: app/Modules/Vendor/Providers/VendorServiceProvider.php
            // → App\Modules\Vendor\Providers\VendorServiceProvider
            $relativePath = str_replace(app_path().DIRECTORY_SEPARATOR, '', $providerFile);
            $className = 'App\\'.str_replace(
                [DIRECTORY_SEPARATOR, '.php'],
                ['\\', ''],
                $relativePath
            );

            if (class_exists($className)) {
                $this->app->register($className);
            }
        }
    }

    /**
     * Auto-load route files from each module's Routes directory.
     */
    private function loadModuleRoutes(): void
    {
        $modulesPath = app_path('Modules');
        if (! is_dir($modulesPath)) {
            return;
        }

        foreach (glob("{$modulesPath}/*/Routes/api.php") as $routeFile) {
            Route::prefix('api/v5')
                ->middleware(['api', 'auth:sanctum', 'password.change', 'active.tab', 'throttle:api.write'])
                ->group($routeFile);
        }
    }

    /**
     * Auto-load migration directories from each module's Database/Migrations directory.
     */
    private function loadModuleMigrations(): void
    {
        $modulesPath = app_path('Modules');
        if (! is_dir($modulesPath)) {
            return;
        }

        foreach (glob("{$modulesPath}/*/Database/Migrations", GLOB_ONLYDIR) as $migrationDir) {
            $this->loadMigrationsFrom($migrationDir);
        }
    }

    /**
     * Register rate limiters for auth and API routes.
     */
    private function registerRateLimiters(): void
    {
        RateLimiter::for('auth.login', function (Request $request): Limit {
            $username = strtolower(trim((string) $request->input('username', '')));
            $key = sprintf('%s|%s', $request->ip(), $username);

            return Limit::perMinute(5)->by($key);
        });

        RateLimiter::for('auth.refresh', function (Request $request): Limit {
            $userAgentHash = substr(sha1((string) $request->userAgent()), 0, 16);
            $key = sprintf('%s|%s', $request->ip(), $userAgentHash);

            return Limit::perMinute(10)->by($key);
        });

        RateLimiter::for('api.write', function (Request $request): Limit {
            if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
                return Limit::none();
            }

            if ($request->is('api/v5/auth/login') || $request->is('api/v5/auth/refresh')) {
                return Limit::none();
            }

            $userId = $request->user()?->id;
            $principal = $userId !== null ? 'u:'.(int) $userId : 'g';
            $userAgentHash = substr(sha1((string) $request->userAgent()), 0, 16);
            $key = sprintf('%s|%s|%s', $principal, $request->ip(), $userAgentHash);

            return Limit::perMinute(30)
                ->by($key)
                ->response(fn (): \Illuminate\Http\JsonResponse => response()->json([
                    'message' => 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
                    'code' => 'TOO_MANY_REQUESTS',
                ], 429));
        });

        RateLimiter::for('api.write.heavy', function (Request $request): Limit {
            $userId = $request->user()?->id;
            $principal = $userId !== null ? 'u:'.(int) $userId : 'g';
            $userAgentHash = substr(sha1((string) $request->userAgent()), 0, 16);
            $key = sprintf('%s|%s|%s', $principal, $request->ip(), $userAgentHash);

            return Limit::perMinute(10)
                ->by($key)
                ->response(fn (): \Illuminate\Http\JsonResponse => response()->json([
                    'message' => 'Bạn đã vượt giới hạn thao tác nặng. Vui lòng thử lại sau.',
                    'code' => 'TOO_MANY_REQUESTS_HEAVY',
                ], 429));
        });
    }
}
