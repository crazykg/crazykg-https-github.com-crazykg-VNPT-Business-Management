<?php

namespace App\Services\V5\Realtime;

use App\Events\V5\DashboardMetricsUpdated;

class DashboardRealtimeNotifier
{
    /**
     * @param array<int, string> $domains
     */
    public function notify(array $domains, ?int $actorId = null, string $reason = 'mutation'): void
    {
        if (! (bool) config('vnpt_realtime.enabled', false)) {
            return;
        }

        $normalizedDomains = array_values(array_unique(array_filter(array_map(
            static fn (mixed $domain): string => is_string($domain) ? trim($domain) : '',
            $domains
        ), static fn (string $domain): bool => $domain !== '')));

        if ($normalizedDomains === []) {
            return;
        }

        DashboardMetricsUpdated::dispatch(
            $normalizedDomains,
            $actorId,
            $reason,
            now()->toIso8601String(),
        );
    }
}
