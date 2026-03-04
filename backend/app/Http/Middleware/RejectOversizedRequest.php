<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RejectOversizedRequest
{
    public function handle(Request $request, Closure $next): Response
    {
        $maxBodyKb = max(1, (int) env('API_MAX_BODY_KB', 25600));
        $maxBytes = $maxBodyKb * 1024;
        $contentLength = (int) $request->server('CONTENT_LENGTH', 0);

        if ($contentLength > 0 && $contentLength > $maxBytes) {
            return response()->json([
                'message' => 'Payload vượt quá giới hạn cho phép.',
                'code' => 'PAYLOAD_TOO_LARGE',
                'max_kb' => $maxBodyKb,
            ], 413);
        }

        return $next($request);
    }
}

