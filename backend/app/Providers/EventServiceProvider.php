<?php

namespace App\Providers;

use App\Events\V5\CaseTransitioned;
use App\Listeners\V5\FlushCaseCache;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    /**
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        CaseTransitioned::class => [
            FlushCaseCache::class,
        ],
    ];

    public function shouldDiscoverEvents(): bool
    {
        return false;
    }
}
