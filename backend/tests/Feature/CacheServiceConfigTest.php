<?php

namespace Tests\Feature;

use App\Services\V5\CacheService;
use Tests\TestCase;

class CacheServiceConfigTest extends TestCase
{
    public function test_cache_service_is_disabled_in_phpunit_environment(): void
    {
        $cache = app(CacheService::class);

        $this->assertFalse($cache->isEnabled());
    }

    public function test_cache_service_passthrough_executes_callback_when_disabled(): void
    {
        $cache = app(CacheService::class);
        $calls = 0;

        $payload = $cache->rememberList('invoices', 'tests:invoices:list', 900, function () use (&$calls): array {
            $calls++;

            return ['ok' => true];
        });

        $this->assertSame(1, $calls);
        $this->assertSame(['ok' => true], $payload);
    }

    public function test_cache_service_tagged_passthrough_executes_callback_when_disabled(): void
    {
        $cache = app(CacheService::class);
        $calls = 0;

        $payload = $cache->rememberTagged(['cases', 'dashboard'], 'tests:cases:dashboard', 120, function () use (&$calls): array {
            $calls++;

            return ['cached' => true];
        });

        $this->assertSame(1, $calls);
        $this->assertSame(['cached' => true], $payload);
    }
}
