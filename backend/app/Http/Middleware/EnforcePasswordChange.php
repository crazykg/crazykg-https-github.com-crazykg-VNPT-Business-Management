<?php

namespace App\Http\Middleware;

use App\Models\InternalUser;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class EnforcePasswordChange
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var InternalUser|null $user */
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $this->isPasswordChangeRequired($user)) {
            return $next($request);
        }

        if ($this->isAllowedRoute($request)) {
            return $next($request);
        }

        return response()->json([
            'message' => 'PASSWORD_CHANGE_REQUIRED',
            'code' => 'PASSWORD_CHANGE_REQUIRED',
        ], 428);
    }

    private function isAllowedRoute(Request $request): bool
    {
        return $request->is('api/v5/auth/change-password')
            || $request->is('api/v5/auth/me')
            || $request->is('api/v5/auth/logout');
    }

    private function isPasswordChangeRequired(InternalUser $user): bool
    {
        try {
            if (! Schema::hasTable('internal_users') || ! Schema::hasColumn('internal_users', 'must_change_password')) {
                return false;
            }
        } catch (\Throwable) {
            return false;
        }

        return (int) ($user->must_change_password ?? 0) === 1;
    }
}

