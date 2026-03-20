<?php

namespace App\Shared\Contracts;

use Illuminate\Support\Collection;

interface DepartmentLookupInterface
{
    public function findById(int $id): ?array;

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function getHierarchy(): Collection;

    public function exists(int $id): bool;
}
