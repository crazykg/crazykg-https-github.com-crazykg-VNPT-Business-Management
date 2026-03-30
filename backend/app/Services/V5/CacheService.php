<?php

namespace App\Services\V5;

use Closure;
use Illuminate\Cache\TaggableStore;
use Illuminate\Support\Facades\Cache;

class CacheService
{
    private bool $enabled;

    public function __construct()
    {
        $this->enabled = (bool) config('vnpt.cache_enabled', true);
    }

    public function rememberList(string $tag, string $key, int $ttl, Closure $callback): mixed
    {
        return $this->rememberWithTags([$tag], $key, $ttl, $callback);
    }

    /**
     * @param array<int, string> $tags
     */
    public function rememberTagged(array $tags, string $key, int $ttl, Closure $callback): mixed
    {
        return $this->rememberWithTags($tags, $key, $ttl, $callback);
    }

    public function rememberDetail(string $tag, int $id, string $key, int $ttl, Closure $callback): mixed
    {
        return $this->rememberWithTags([$tag, "{$tag}:{$id}"], $key, $ttl, $callback);
    }

    public function rememberComputation(string $tag, string $key, int $ttl, Closure $callback): mixed
    {
        return $this->rememberWithTags([$tag], $key, $ttl, $callback);
    }

    /**
     * @param array<int, string> $tags
     */
    public function flushTags(array $tags): void
    {
        if (! $this->enabled || ! $this->supportsTags()) {
            return;
        }

        Cache::tags($tags)->flush();
    }

    public function forget(string $key): void
    {
        if (! $this->enabled) {
            return;
        }

        Cache::forget($key);
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    private function rememberWithTags(array $tags, string $key, int $ttl, Closure $callback): mixed
    {
        if (! $this->enabled) {
            return $callback();
        }

        if ($this->supportsTags()) {
            return Cache::tags($tags)->remember($key, $ttl, $callback);
        }

        return Cache::remember($key, $ttl, $callback);
    }

    private function supportsTags(): bool
    {
        return Cache::getStore() instanceof TaggableStore;
    }
}
