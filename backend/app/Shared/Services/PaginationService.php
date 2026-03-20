<?php

namespace App\Shared\Services;

use Illuminate\Http\Request;

class PaginationService
{
    public function shouldPaginate(Request $request): bool
    {
        return $request->query->has('page') || $request->query->has('per_page');
    }

    public function shouldUseSimplePagination(Request $request): bool
    {
        return filter_var($request->query('simple', false), FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * @return array{0: int, 1: int}
     */
    public function resolvePaginationParams(Request $request, int $defaultPerPage = 20, int $maxPerPage = 200): array
    {
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min($maxPerPage, max(1, (int) $request->query('per_page', $defaultPerPage)));

        return [$page, $perPage];
    }

    /**
     * @return array{page: int, per_page: int, total: int, total_pages: int}
     */
    public function buildPaginationMeta(int $page, int $perPage, int $total): array
    {
        return [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => $perPage > 0 ? (int) ceil($total / $perPage) : 0,
        ];
    }

    /**
     * @return array{page: int, per_page: int, count: int, has_more_pages: bool}
     */
    public function buildSimplePaginationMeta(int $page, int $perPage, int $currentItemCount, bool $hasMorePages): array
    {
        return [
            'page' => $page,
            'per_page' => $perPage,
            'count' => $currentItemCount,
            'has_more_pages' => $hasMorePages,
        ];
    }
}
