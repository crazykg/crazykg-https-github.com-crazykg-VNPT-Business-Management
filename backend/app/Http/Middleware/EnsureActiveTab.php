<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Legacy single-tab middleware.
 *
 * Ứng dụng hiện đã cho phép nhiều tab dùng chung một phiên đăng nhập,
 * vì vậy middleware này được giữ lại chỉ để tương thích route alias
 * cũ và không còn chặn request nữa.
 */
class EnsureActiveTab
{
    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }
}
