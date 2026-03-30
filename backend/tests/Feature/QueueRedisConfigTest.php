<?php

namespace Tests\Feature;

use Tests\TestCase;

class QueueRedisConfigTest extends TestCase
{
    public function test_testing_environment_keeps_sync_queue_connection(): void
    {
        $this->assertSame('sync', config('queue.default'));
    }

    public function test_redis_queue_connection_uses_after_commit_dispatch(): void
    {
        $redis = config('queue.connections.redis');

        $this->assertIsArray($redis);
        $this->assertSame('redis', $redis['driver'] ?? null);
        $this->assertSame('default', $redis['connection'] ?? null);
        $this->assertSame('default', $redis['queue'] ?? null);
        $this->assertSame(90, $redis['retry_after'] ?? null);
        $this->assertTrue((bool) ($redis['after_commit'] ?? false));
    }
}
