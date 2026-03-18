<?php

namespace App\Http\Middleware;

use App\Models\InternalUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Kiểm tra tab_token trong cookie có khớp với active_tab_token trong DB không.
 * Nếu không khớp → 401 TAB_EVICTED (tab này đã bị tab mới hơn thay thế).
 *
 * Chỉ áp dụng khi:
 *  - User đã authenticate qua Sanctum (auth:sanctum chạy trước)
 *  - Column active_tab_token đã tồn tại (migration đã chạy)
 *  - Request KHÔNG phải /auth/tab/claim (claim tự mình đang khởi tạo)
 */
class EnsureActiveTab
{
    /** Các path được bỏ qua — không kiểm tra tab token */
    private const SKIP_PATHS = [
        '/api/v5/auth/login',
        '/api/v5/auth/refresh',
        '/api/v5/auth/logout',
        '/api/v5/auth/tab/claim',
        '/api/v5/auth/me',
        // bootstrap tự renew tab token — phải bỏ qua để không bị evict
        // bởi chính token cũ trước khi nó kịp được replace
        '/api/v5/bootstrap',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Bỏ qua nếu chưa auth hoặc không phải InternalUser
        if (! $user instanceof InternalUser) {
            return $next($request);
        }

        // Bỏ qua các path exempt
        $path = '/' . ltrim($request->path(), '/');
        foreach (self::SKIP_PATHS as $skip) {
            if ($path === $skip || str_starts_with($path, $skip)) {
                return $next($request);
            }
        }

        // Bỏ qua nếu feature chưa được bật (migration chưa chạy)
        if (! isset($user->active_tab_token) || $user->active_tab_token === null) {
            return $next($request);
        }

        $requestTabToken = $request->cookie('vnpt_tab_token');

        // Nếu cookie không tồn tại hoặc không khớp với DB → tab đã bị evict
        if (
            ! is_string($requestTabToken)
            || trim($requestTabToken) === ''
            || $requestTabToken !== $user->active_tab_token
        ) {
            return response()->json([
                'message' => 'Phiên làm việc đã được mở trên tab khác. Vui lòng đăng nhập lại.',
                'code'    => 'TAB_EVICTED',
            ], 401);
        }

        return $next($request);
    }
}
