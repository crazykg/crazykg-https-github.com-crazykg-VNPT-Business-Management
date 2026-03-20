<?php

namespace App\Shared\Contracts;

interface ProjectLookupInterface
{
    public function findById(int $id): ?array;

    public function exists(int $id): bool;
}
