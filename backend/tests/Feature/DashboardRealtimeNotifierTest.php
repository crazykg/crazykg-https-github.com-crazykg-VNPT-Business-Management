<?php

namespace Tests\Feature;

use App\Events\V5\DashboardMetricsUpdated;
use App\Services\V5\Realtime\DashboardRealtimeNotifier;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class DashboardRealtimeNotifierTest extends TestCase
{
    public function test_notifier_is_noop_when_realtime_is_disabled(): void
    {
        Event::fake([DashboardMetricsUpdated::class]);
        config()->set('vnpt_realtime.enabled', false);

        app(DashboardRealtimeNotifier::class)->notify(['fee_collection', 'revenue'], 7, 'invoice.updated');

        Event::assertNotDispatched(DashboardMetricsUpdated::class);
    }

    public function test_notifier_dispatches_broadcast_event_with_expected_metadata(): void
    {
        Event::fake([DashboardMetricsUpdated::class]);
        config()->set('vnpt_realtime.enabled', true);
        config()->set('vnpt_realtime.dashboard_channel', 'v5.dashboards');

        app(DashboardRealtimeNotifier::class)->notify(['fee_collection', 'revenue', 'fee_collection'], 11, 'receipt.updated');

        Event::assertDispatched(DashboardMetricsUpdated::class, function (DashboardMetricsUpdated $event): bool {
            $channel = $event->broadcastOn();

            return $channel instanceof PrivateChannel
                && $channel->name === 'private-v5.dashboards'
                && $event->broadcastAs() === 'dashboard.metrics.updated'
                && $event->broadcastWith()['reason'] === 'receipt.updated'
                && $event->broadcastWith()['actor_id'] === 11
                && $event->domains === ['fee_collection', 'revenue'];
        });
    }
}
