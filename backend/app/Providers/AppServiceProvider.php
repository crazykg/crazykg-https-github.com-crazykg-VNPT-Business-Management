<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

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
                ->middleware(['api', 'auth:sanctum', 'password.change', 'active.tab', 'throttle:api.access'])
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

            return Limit::perMinute((int) config('vnpt_rate_limits.auth.login_per_minute', 5))->by($key);
        });

        RateLimiter::for('auth.refresh', function (Request $request): Limit {
            $userAgentHash = substr(sha1((string) $request->userAgent()), 0, 16);
            $key = sprintf('%s|%s', $request->ip(), $userAgentHash);

            return Limit::perMinute((int) config('vnpt_rate_limits.auth.refresh_per_minute', 10))->by($key);
        });

        RateLimiter::for('api.access', function (Request $request): Limit {
            if ($this->isReadRequest($request)) {
                if ($this->isDashboardOrReportRoute($request)) {
                    return $this->buildLimiter(
                        $request,
                        'api_dashboard',
                        (int) config('vnpt_rate_limits.api.dashboard_per_minute', 120),
                        'Bạn đã vượt giới hạn truy cập dashboard/báo cáo. Vui lòng thử lại sau.',
                        'TOO_MANY_REQUESTS_DASHBOARD'
                    );
                }

                return $this->buildLimiter(
                    $request,
                    'api_read',
                    (int) config('vnpt_rate_limits.api.read_per_minute', 60),
                    'Bạn truy cập quá nhanh. Vui lòng thử lại sau ít phút.',
                    'TOO_MANY_REQUESTS_READ'
                );
            }

            return $this->buildWriteLimiter($request);
        });

        RateLimiter::for('api.write', function (Request $request): Limit {
            if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
                return Limit::none();
            }

            if ($request->is('api/v5/auth/login') || $request->is('api/v5/auth/refresh')) {
                return Limit::none();
            }

            return $this->buildWriteLimiter($request);
        });

        RateLimiter::for('api.read.export', function (Request $request): Limit {
            return $this->buildLimiter(
                $request,
                'api_export',
                (int) config('vnpt_rate_limits.api.export_per_minute', 10),
                'Bạn đã vượt giới hạn tải/xuất dữ liệu. Vui lòng thử lại sau.',
                'TOO_MANY_REQUESTS_EXPORT'
            );
        });

        RateLimiter::for('api.write.heavy', function (Request $request): Limit {
            return $this->buildLimiter(
                $request,
                'api_write_heavy',
                (int) config('vnpt_rate_limits.api.write_heavy_per_minute', 10),
                'Bạn đã vượt giới hạn thao tác nặng. Vui lòng thử lại sau.',
                'TOO_MANY_REQUESTS_HEAVY'
            );
        });

        RateLimiter::for('api.write.customer_import', function (Request $request): Limit {
            return $this->buildLimiter(
                $request,
                'api_write_customer_import',
                (int) config('vnpt_rate_limits.api.customer_import_per_minute', 20),
                'Bạn đã vượt giới hạn nhập khách hàng. Vui lòng thử lại sau.',
                'TOO_MANY_REQUESTS_CUSTOMER_IMPORT'
            );
        });
    }

    private function buildWriteLimiter(Request $request): Limit
    {
        if ($this->shouldBypassWriteLimiter($request)) {
            return Limit::none();
        }

        return $this->buildLimiter(
            $request,
            'api_write',
            (int) config('vnpt_rate_limits.api.write_per_minute', 30),
            'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
            'TOO_MANY_REQUESTS'
        );
    }

    private function buildLimiter(
        Request $request,
        string $bucket,
        int $maxAttempts,
        string $message,
        string $code,
    ): Limit {
        $userId = $request->user()?->id;
        $principal = $userId !== null ? 'u:'.(int) $userId : 'g';
        $userAgentHash = substr(sha1((string) $request->userAgent()), 0, 16);
        $key = sprintf('%s|%s|%s|%s', $bucket, $principal, $request->ip(), $userAgentHash);

        return Limit::perMinute($maxAttempts)
            ->by($key)
            ->response(fn (): \Illuminate\Http\JsonResponse => response()->json([
                'message' => $message,
                'code' => $code,
            ], 429));
    }

    private function isReadRequest(Request $request): bool
    {
        return in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true);
    }

    private function shouldBypassWriteLimiter(Request $request): bool
    {
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return false;
        }

        return $request->is('api/v5/products/bulk');
    }

    private function isDashboardOrReportRoute(Request $request): bool
    {
        $route = $request->route();
        $uri = trim((string) ($route?->uri() ?? $request->path()), '/');

        return Str::is([
            'api/v5/*/dashboard',
            'api/v5/*/dashboard/*',
            'api/v5/*/report',
            'api/v5/*/reports/*',
            'api/v5/*/overview',
            'api/v5/*/forecast',
            'api/v5/*/analytics',
            'api/v5/*/timesheet/*',
            'api/v5/leadership/*',
            'api/v5/contracts/revenue-analytics',
            'api/v5/customer-request-cases/*/hours-report',
            'api/v5/customer-request-escalations/stats',
        ], $uri);
    }
}
