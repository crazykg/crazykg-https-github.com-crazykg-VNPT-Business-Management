<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \App\Http\Middleware\RejectOversizedRequest::class,
            \App\Http\Middleware\UseSanctumCookieToken::class,
            \App\Http\Middleware\SecurityHeaders::class,
        ]);

        $middleware->alias([
            'permission' => \App\Http\Middleware\EnsurePermission::class,
            'sanctum.cookie' => \App\Http\Middleware\UseSanctumCookieToken::class,
            'deprecated.route' => \App\Http\Middleware\DeprecatedApiAlias::class,
            'password.change' => \App\Http\Middleware\EnforcePasswordChange::class,
        ]);
    })
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('exports:prune --hours=24')->hourly();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticationException $exception, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            return null;
        });
    })->create();
