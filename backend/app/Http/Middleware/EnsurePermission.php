<?php

namespace App\Http\Middleware;

use App\Support\Auth\UserAccessService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function __construct(
        private readonly UserAccessService $accessService
    ) {
    }

    public function handle(Request $request, Closure $next, string $permissions): Response
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $required = array_values(array_filter(array_map(
            fn (string $value): string => trim($value),
            explode('|', $permissions)
        )));

        if ($required === []) {
            return $next($request);
        }

        $userId = (int) ($user->id ?? 0);
        if ($userId <= 0) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        foreach ($required as $permission) {
            if ($this->accessService->hasPermission($userId, $permission)) {
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'This action is unauthorized.',
        ], 403);
    }
}

