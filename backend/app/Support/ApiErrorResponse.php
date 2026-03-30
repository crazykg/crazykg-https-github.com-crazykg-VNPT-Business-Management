<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class ApiErrorResponse
{
    /**
     * Build a standardized API error response while mirroring legacy top-level
     * keys so older callers can migrate incrementally.
     */
    public static function make(
        string $code,
        string $message,
        int $httpStatus,
        array $extra = [],
    ): JsonResponse {
        $requestId = request()?->header('X-Request-ID');
        $normalizedRequestId = is_string($requestId) && trim($requestId) !== ''
            ? trim($requestId)
            : (string) Str::uuid();

        $error = array_merge([
            'code' => $code,
            'message' => $message,
            'request_id' => $normalizedRequestId,
        ], $extra);

        return response()->json(
            array_merge(['error' => $error], $error),
            $httpStatus
        );
    }
}
