<?php

namespace App\Support\Audit;

use DateTimeInterface;

class AuditValueSanitizer
{
    /**
    * @param mixed $value
    * @return mixed
    */
    public function sanitize(mixed $value, int $depth = 0): mixed
    {
        if ($depth > 8) {
            return '[max-depth]';
        }

        if ($value === null || is_scalar($value)) {
            return $value;
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        if (is_array($value)) {
            $sanitized = [];
            foreach ($value as $key => $item) {
                $stringKey = (string) $key;
                if ($this->isSensitiveKey($stringKey)) {
                    $sanitized[$stringKey] = $this->maskValue();
                    continue;
                }

                $sanitized[$stringKey] = $this->sanitize($item, $depth + 1);
            }

            return $sanitized;
        }

        if (is_object($value)) {
            if (method_exists($value, 'toArray')) {
                return $this->sanitize($value->toArray(), $depth + 1);
            }
            if (method_exists($value, '__toString')) {
                return (string) $value;
            }

            return $this->sanitize((array) $value, $depth + 1);
        }

        return (string) $value;
    }

    private function isSensitiveKey(string $key): bool
    {
        $normalized = $this->normalizeKey($key);
        if ($normalized === '') {
            return false;
        }

        /** @var array<int, string> $sensitiveKeys */
        $sensitiveKeys = config('audit.sensitive_keys', []);
        foreach ($sensitiveKeys as $rawKey) {
            $token = $this->normalizeKey((string) $rawKey);
            if ($token === '') {
                continue;
            }

            if ($normalized === $token || str_contains($normalized, $token)) {
                return true;
            }
        }

        return false;
    }

    private function normalizeKey(string $key): string
    {
        return trim((string) preg_replace('/[^a-z0-9_]+/', '_', strtolower($key)), '_');
    }

    private function maskValue(): string
    {
        return (string) config('audit.mask', '[REDACTED]');
    }
}

