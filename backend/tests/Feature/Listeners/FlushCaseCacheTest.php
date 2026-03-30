<?php

namespace Tests\Feature\Listeners;

use App\Events\V5\CaseTransitioned;
use App\Listeners\V5\FlushCaseCache;
use App\Models\CustomerRequestCase;
use App\Services\V5\CacheService;
use Mockery;
use Tests\TestCase;

class FlushCaseCacheTest extends TestCase
{
    public function test_listener_flushes_case_cache_tags_after_commit(): void
    {
        $cache = Mockery::mock(CacheService::class);
        $cache->shouldReceive('flushTags')->once()->with(['customer-request-cases']);
        $cache->shouldReceive('flushTags')->once()->with(['customer-request-cases:15']);

        $listener = new FlushCaseCache($cache);
        $case = new CustomerRequestCase();
        $case->id = 15;

        $listener->handle(new CaseTransitioned($case, 'completed', 7));

        $this->assertTrue($listener->afterCommit);
    }
}
