<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * CI gate to ensure API routes are never removed unintentionally.
 *
 * IMPORTANT: Before running this test for the first time, generate the baseline:
 * ```bash
 * cd backend
 * mkdir -p tests/fixtures
 * php artisan route:list --json \
 *   | jq '[.[] | select(type=="object" and (.uri|startswith("api/v5/"))) | {method: (.method | split("|") | .[0]), uri: .uri}] | sort_by(.uri, .method)' \
 *   > tests/fixtures/route-baseline.json
 * git add tests/fixtures/route-baseline.json
 * ```
 *
 * After baseline is committed, this test will verify:
 * 1. No routes have been removed from the baseline
 * 2. Route count never decreases
 */
class RouteParitySnapshotTest extends TestCase
{
    /**
     * Ensure the count of v5 API routes never decreases.
     *
     * This is a safety check to prevent accidental route removal.
     * If this fails, either:
     * - You removed a route (intended? update baseline if so)
     * - A route registration bug occurred (investigate)
     */
    public function test_v5_route_count_does_not_decrease(): void
    {
        $routes = collect(Route::getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/v5/'))
            ->count();

        // Baseline: 377 routes (verified 2026-04-05 via php artisan route:list --json)
        // Update this number ONLY when intentionally adding new routes, never decrease it.
        $this->assertGreaterThanOrEqual(
            377,
            $routes,
            "Route count decreased from 377 to {$routes}! A route may have been removed unintentionally."
        );
    }

    /**
     * Ensure current routes are a superset of the baseline.
     *
     * This prevents accidental removal of existing routes during refactoring.
     * Routes can be added (superset), but none should be removed.
     */
    public function test_v5_routes_are_superset_of_baseline(): void
    {
        // Get all current v5 routes, normalized to {method, uri} tuples
        $currentRoutes = collect(Route::getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/v5/'))
            ->map(fn ($route) => [
                'method' => $route->methods()[0],  // Normalize "GET|HEAD" → "GET"
                'uri' => $route->uri(),
            ])
            ->sortBy(['uri', 'method'])
            ->values()
            ->toArray();

        // Load baseline snapshot
        $baselinePath = base_path('tests/fixtures/route-baseline.json');
        $this->assertFileExists(
            $baselinePath,
            'Baseline file missing. Generate it with: '
                . 'php artisan route:list --json | jq \'[.[] | select(.uri | startswith("api/v5/")) | {method: (.method | split("|") | .[0]), uri: .uri}] | sort_by(.uri, .method)\' '
                . '> tests/fixtures/route-baseline.json'
        );

        $baseline = json_decode(file_get_contents($baselinePath), true);
        $this->assertIsArray($baseline, 'Baseline file is not valid JSON array');

        // Normalize baseline tuples to "METHOD URI" strings for diff comparison
        $baselineTuples = array_map(
            fn ($r) => $r['method'] . ' ' . $r['uri'],
            $baseline
        );
        $currentTuples = array_map(
            fn ($r) => $r['method'] . ' ' . $r['uri'],
            $currentRoutes
        );

        // Check for removed routes (baseline items not in current)
        $removed = array_diff($baselineTuples, $currentTuples);

        $this->assertEmpty(
            $removed,
            "Routes removed from baseline (this breaks backward compatibility):\n"
                . implode("\n", $removed) . "\n\n"
                . "If intentional, regenerate baseline: "
                . "php artisan route:list --json | jq '[.[] | select(.uri | startswith(\"api/v5/\")) | {method: (.method | split(\"|\") | .[0]), uri: .uri}] | sort_by(.uri, .method)' > tests/fixtures/route-baseline.json"
        );
    }
}
