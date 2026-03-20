<?php

namespace App\Shared\Services;

use Illuminate\Http\Request;

class NormalizationService
{
    public function parseNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '' || $value === 'null') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    public function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null || $value === '' || $value === 'null') {
            return null;
        }

        return trim((string) $value);
    }

    /**
     * Read a filter parameter from the request, supporting dot-notation keys.
     */
    public function readFilterParam(Request $request, string $key, mixed $default = null): mixed
    {
        return $request->query($key, $default);
    }

    /**
     * Return the first non-empty value from a data array, checking multiple keys.
     *
     * @param array<string, mixed> $data
     * @param array<int, string> $keys
     */
    public function firstNonEmpty(array $data, array $keys, mixed $default = null): mixed
    {
        foreach ($keys as $key) {
            if (isset($data[$key]) && $data[$key] !== '' && $data[$key] !== null) {
                return $data[$key];
            }
        }

        return $default;
    }

    /**
     * Normalize a payment cycle string to uppercase canonical form.
     */
    public function normalizePaymentCycle(string $cycle): string
    {
        return strtoupper(trim($cycle));
    }
}
