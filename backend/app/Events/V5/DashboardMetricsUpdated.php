<?php

namespace App\Events\V5;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DashboardMetricsUpdated implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    /**
     * @param array<int, string> $domains
     */
    public function __construct(
        public readonly array $domains,
        public readonly ?int $actorId = null,
        public readonly string $reason = 'mutation',
        public readonly string $occurredAt = '',
    ) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel((string) config('vnpt_realtime.dashboard_channel', 'v5.dashboards'));
    }

    public function broadcastAs(): string
    {
        return 'dashboard.metrics.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'domains' => $this->domains,
            'actor_id' => $this->actorId,
            'reason' => $this->reason,
            'occurred_at' => $this->occurredAt !== '' ? $this->occurredAt : now()->toIso8601String(),
        ];
    }
}
