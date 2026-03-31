<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withEvents(discover: false)
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withBroadcasting(__DIR__.'/../routes/channels.php', [
        'prefix' => 'api',
        'middleware' => ['api', 'auth:sanctum', 'password.change', 'active.tab', 'throttle:api.access'],
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \App\Http\Middleware\RejectOversizedRequest::class,
            \App\Http\Middleware\UseSanctumCookieToken::class,
            \App\Http\Middleware\SecurityHeaders::class,
        ]);

        $middleware->alias([
            'permission'       => \App\Http\Middleware\EnsurePermission::class,
            'sanctum.cookie'   => \App\Http\Middleware\UseSanctumCookieToken::class,
            'deprecated.route' => \App\Http\Middleware\DeprecatedApiAlias::class,
            'password.change'  => \App\Http\Middleware\EnforcePasswordChange::class,
            'active.tab'       => \App\Http\Middleware\EnsureActiveTab::class,
        ]);
    })
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('exports:prune --hours=24')->hourly();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Validation\ValidationException $exception, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return \App\Support\ApiErrorResponse::make(
                    code: 'VALIDATION_FAILED',
                    message: $exception->getMessage(),
                    httpStatus: 422,
                    extra: ['errors' => $exception->errors()],
                );
            }

            return null;
        });

        $exceptions->render(function (AuthenticationException $exception, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return \App\Support\ApiErrorResponse::make(
                    code: 'UNAUTHENTICATED',
                    message: 'Unauthenticated.',
                    httpStatus: 401,
                );
            }

            return null;
        });

        $exceptions->render(function (\Illuminate\Database\Eloquent\ModelNotFoundException $exception, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $model = class_basename($exception->getModel());

                return \App\Support\ApiErrorResponse::make(
                    code: 'NOT_FOUND',
                    message: "{$model} not found.",
                    httpStatus: 404,
                );
            }

            return null;
        });

        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $exception, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return \App\Support\ApiErrorResponse::make(
                    code: 'UNAUTHORIZED',
                    message: $exception->getMessage() ?: 'This action is unauthorized.',
                    httpStatus: 403,
                );
            }

            return null;
        });

        $exceptions->render(function (\Illuminate\Http\Exceptions\ThrottleRequestsException $exception, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return \App\Support\ApiErrorResponse::make(
                    code: 'RATE_LIMITED',
                    message: 'Too many requests. Please try again later.',
                    httpStatus: 429,
                    extra: ['retry_after' => $exception->getHeaders()['Retry-After'] ?? null],
                );
            }

            return null;
        });

        $exceptions->render(function (\Throwable $exception, $request) {
            if (($request->is('api/*') || $request->expectsJson()) && ! config('app.debug')) {
                return \App\Support\ApiErrorResponse::make(
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred.',
                    httpStatus: 500,
                );
            }

            return null;
        });
    })->create();
