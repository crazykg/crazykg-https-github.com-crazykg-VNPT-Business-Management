<?php

namespace App\Services\V5\Support;

use Illuminate\Support\Facades\Schema;

class SchemaCapabilityService
{
    /**
     * @var array<string, bool>
     */
    private array $tableCache = [];

    /**
     * @var array<string, bool>
     */
    private array $columnCache = [];

    public function hasTable(string $table): bool
    {
        if (array_key_exists($table, $this->tableCache)) {
            return $this->tableCache[$table];
        }

        try {
            return $this->tableCache[$table] = Schema::hasTable($table);
        } catch (\Throwable) {
            return $this->tableCache[$table] = false;
        }
    }

    public function hasColumn(string $table, string $column): bool
    {
        $cacheKey = $table.'.'.$column;
        if (array_key_exists($cacheKey, $this->columnCache)) {
            return $this->columnCache[$cacheKey];
        }

        if (! $this->hasTable($table)) {
            return $this->columnCache[$cacheKey] = false;
        }

        try {
            return $this->columnCache[$cacheKey] = Schema::hasColumn($table, $column);
        } catch (\Throwable) {
            return $this->columnCache[$cacheKey] = false;
        }
    }

    /**
     * @param array<int, string> $columns
     * @return array<int, string>
     */
    public function selectColumns(string $table, array $columns): array
    {
        return array_values(array_filter(
            $columns,
            fn (string $column): bool => $this->hasColumn($table, $column)
        ));
    }
}
