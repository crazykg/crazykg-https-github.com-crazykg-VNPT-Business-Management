<?php

namespace App\Shared\Contracts;

interface ProductLookupInterface
{
    public function findById(int $id): ?array;

    public function exists(int $id): bool;
}
