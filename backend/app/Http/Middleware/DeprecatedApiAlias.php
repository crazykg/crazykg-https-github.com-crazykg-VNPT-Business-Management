<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class DeprecatedApiAlias
{
    public function handle(Request $request, Closure $next, string $canonicalPath, string $sunsetDate = '2026-04-27'): Response
    {
        $response = $next($request);

        $sunset = gmdate('D, d M Y H:i:s', strtotime($sunsetDate.' 00:00:00 UTC')).' GMT';
        $canonicalUrl = rtrim((string) config('app.url', ''), '/').$canonicalPath;

        $response->headers->set('Deprecation', 'true');
        $response->headers->set('Sunset', $sunset);
        $response->headers->set('Link', sprintf('<%s>; rel="successor-version"', $canonicalUrl));
        $response->headers->set('X-Deprecated-Route', '/'.$request->path());

        Log::warning('Deprecated API alias route invoked.', [
            'method' => $request->getMethod(),
            'path' => '/'.$request->path(),
            'canonical_path' => $canonicalPath,
            'ip' => $request->ip(),
            'user_id' => $request->user()?->id,
        ]);

        return $response;
    }
}

