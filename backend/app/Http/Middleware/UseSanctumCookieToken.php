<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class UseSanctumCookieToken
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->bearerToken() !== null) {
            return $next($request);
        }

        $cookieName = (string) config('vnpt_auth.cookie_name', 'vnpt_business_auth_token');
        $token = $request->cookie($cookieName);

        if (is_string($token) && trim($token) !== '') {
            $decoded = urldecode($token);
            $request->headers->set('Authorization', 'Bearer '.trim($decoded));
        }

        return $next($request);
    }
}
