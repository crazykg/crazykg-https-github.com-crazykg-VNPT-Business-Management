<?php

namespace App\Listeners\V5;

use App\Events\V5\CaseTransitioned;
use App\Services\V5\CacheService;

class FlushCaseCache
{
    public bool $afterCommit = true;

    public function __construct(
        private readonly CacheService $cache,
    ) {}

    public function handle(CaseTransitioned $event): void
    {
        $this->cache->flushTags(['customer-request-cases']);
        $this->cache->flushTags(["customer-request-cases:{$event->case->id}"]);
    }
}
