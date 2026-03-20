<?php

namespace App\Shared\Services;

use Illuminate\Http\Request;

class SortingService
{
    public function resolveSortDirection(Request $request): string
    {
        $dir = strtolower(trim((string) $request->query('sort_direction', 'asc')));

        return in_array($dir, ['asc', 'desc'], true) ? $dir : 'asc';
    }

    /**
     * @param array<int, string> $allowed
     */
    public function resolveSortColumn(Request $request, array $allowed, string $fallback): string
    {
        $column = trim((string) $request->query('sort_key', $fallback));

        return in_array($column, $allowed, true) ? $column : $fallback;
    }
}
