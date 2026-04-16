<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Throwable;

class ApiErrorResponse
{
    /**
     * Build a standardized API error response while mirroring legacy top-level
     * keys so older callers can migrate incrementally.
     *
     * @param array $extra Additional error details (validation errors, retry_after, etc.)
     * @param Throwable|null $exception Optional exception for debug details (only included if APP_ERROR_DEBUG=true)
     */
    public static function make(
        string $code,
        string $message,
        int $httpStatus,
        array $extra = [],
        ?Throwable $exception = null,
    ): JsonResponse {
        $requestId = request()?->header('X-Request-ID');
        $normalizedRequestId = is_string($requestId) && trim($requestId) !== ''
            ? trim($requestId)
            : (string) Str::uuid();

        // Build base error payload
        $error = array_merge([
            'code' => $code,
            'message' => $message,
            'request_id' => $normalizedRequestId,
        ], $extra);

        // Append debug details if APP_ERROR_DEBUG is enabled
        if ($exception && config('app.error_debug', false)) {
            $error['debug'] = [
                'exception' => get_class($exception),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => $exception->getTraceAsString(),
            ];
        }

        return response()->json(
            array_merge(['error' => $error], $error),
            $httpStatus
        );
    }
}
