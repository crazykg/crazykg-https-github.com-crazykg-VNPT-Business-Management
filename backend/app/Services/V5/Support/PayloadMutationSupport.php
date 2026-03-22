<?php

namespace App\Services\V5\Support;

use Illuminate\Database\Eloquent\Model;

class PayloadMutationSupport
{
    public function __construct(
        private readonly SchemaCapabilityService $schema
    ) {}

    public function parseNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_int($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    public function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function filterPayloadByTableColumns(string $table, array $payload): array
    {
        $filtered = [];
        foreach ($payload as $column => $value) {
            if ($this->schema->hasColumn($table, $column)) {
                $filtered[$column] = $value;
            }
        }

        return $filtered;
    }

    public function setAttributeIfColumn(Model $model, string $table, string $column, mixed $value): void
    {
        if ($this->schema->hasColumn($table, $column)) {
            $model->setAttribute($column, $value);
        }
    }

    /**
     * @param array<int, string> $columns
     */
    public function setAttributeByColumns(Model $model, string $table, array $columns, mixed $value): void
    {
        foreach ($columns as $column) {
            if ($this->schema->hasColumn($table, $column)) {
                $model->setAttribute($column, $value);

                return;
            }
        }
    }

    /**
     * @param array<string, mixed> $data
     * @param array<int, string> $keys
     */
    public function firstNonEmpty(array $data, array $keys, mixed $default = null): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $data) && $data[$key] !== null && $data[$key] !== '') {
                return $data[$key];
            }
        }

        return $default;
    }
}
