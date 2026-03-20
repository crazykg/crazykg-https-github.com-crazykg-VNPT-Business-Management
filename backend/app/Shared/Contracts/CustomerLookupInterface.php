<?php

namespace App\Shared\Contracts;

use Illuminate\Support\Collection;

interface CustomerLookupInterface
{
    public function findById(int $id): ?array;

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function search(string $query, int $limit = 30): Collection;

    public function exists(int $id): bool;
}
