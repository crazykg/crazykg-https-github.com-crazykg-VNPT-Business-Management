<?php

namespace App\Shared\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class ColumnDetectionService
{
    public function hasTable(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (\Throwable) {
            return false;
        }
    }

    public function hasColumn(string $table, string $column): bool
    {
        if (! $this->hasTable($table)) {
            return false;
        }

        try {
            return Schema::hasColumn($table, $column);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Filter a list of column names to only those that exist on the given table.
     *
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

    /**
     * Filter a payload array to only keys that correspond to actual table columns.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function filterPayloadByTableColumns(string $table, array $payload): array
    {
        $filtered = [];
        foreach ($payload as $key => $value) {
            if ($this->hasColumn($table, $key)) {
                $filtered[$key] = $value;
            }
        }

        return $filtered;
    }

    /**
     * Set a model attribute only if the column exists on the table.
     */
    public function setAttributeIfColumn(Model $model, string $table, string $column, mixed $value): void
    {
        if ($this->hasColumn($table, $column)) {
            $model->setAttribute($column, $value);
        }
    }

    /**
     * Set the same value on multiple columns, only if each column exists.
     *
     * @param array<int, string> $columns
     */
    public function setAttributeByColumns(Model $model, string $table, array $columns, mixed $value): void
    {
        foreach ($columns as $column) {
            $this->setAttributeIfColumn($model, $table, $column, $value);
        }
    }

    /**
     * Return a 503 JSON response when a table does not exist.
     */
    public function missingTable(string $table): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'message' => "Table {$table} is not available. Run enterprise v5 migrations first.",
            'data' => [],
        ], 503);
    }
}
