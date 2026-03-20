<?php

namespace App\Shared\Services;

use Illuminate\Support\Str;

/**
 * Maps between API-facing status/stage strings and database storage formats.
 *
 * Handles legacy schema variants and normalizes incoming status values
 * for Projects, Contracts, and Opportunities.
 */
class StatusMappingService
{
    /** @var array<int, string> */
    private const PROJECT_STATUSES = ['TRIAL', 'ONGOING', 'WARRANTY', 'COMPLETED', 'CANCELLED'];

    /** @var array<int, string> */
    private const CONTRACT_STATUSES = ['DRAFT', 'SIGNED', 'RENEWED'];

    /** @var array<int, string> */
    private const PAYMENT_CYCLES = ['ONCE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

    /** @var array<int, string> */
    private const OPPORTUNITY_STAGES = ['NEW', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

    /** @var array<string, string> */
    private const LEGACY_OPPORTUNITY_STAGE_MAP = [
        'LEAD' => 'NEW',
        'QUALIFIED' => 'NEW',
        'CLOSED_WON' => 'WON',
        'CLOSED_LOST' => 'LOST',
    ];

    public function toProjectStorageStatus(string $status, bool $legacySchema = false): string
    {
        $normalized = strtoupper(trim($status));

        if ($legacySchema) {
            return match ($normalized) {
                'PLANNING', 'TRIAL', 'ONGOING' => 'ACTIVE',
                'WARRANTY', 'COMPLETED' => 'COMPLETED',
                'CANCELLED' => 'TERMINATED',
                default => 'ACTIVE',
            };
        }

        if ($normalized === 'PLANNING') {
            return 'TRIAL';
        }
        if ($normalized === 'ACTIVE') {
            return 'ONGOING';
        }
        if (in_array($normalized, ['TERMINATED', 'SUSPENDED', 'EXPIRED'], true)) {
            return 'CANCELLED';
        }

        return in_array($normalized, self::PROJECT_STATUSES, true) ? $normalized : 'TRIAL';
    }

    public function fromProjectStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'PLANNING', 'TRIAL' => 'TRIAL',
            'ONGOING', 'ACTIVE' => 'ONGOING',
            'WARRANTY' => 'WARRANTY',
            'COMPLETED' => 'COMPLETED',
            'CANCELLED', 'TERMINATED', 'SUSPENDED', 'EXPIRED' => 'CANCELLED',
            default => 'TRIAL',
        };
    }

    public function toContractStorageStatus(string $status, bool $legacySchema = false): string
    {
        $normalized = strtoupper($status);

        if ($legacySchema) {
            return match ($normalized) {
                'DRAFT', 'PENDING' => 'DRAFT',
                'SIGNED' => 'SIGNED',
                'RENEWED', 'LIQUIDATED', 'EXPIRED', 'TERMINATED' => 'RENEWED',
                default => 'DRAFT',
            };
        }

        return in_array($normalized, self::CONTRACT_STATUSES, true) ? $normalized : 'DRAFT';
    }

    public function fromContractStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'DRAFT', 'PENDING' => 'DRAFT',
            'SIGNED' => 'SIGNED',
            'RENEWED', 'EXPIRED', 'TERMINATED', 'LIQUIDATED' => 'RENEWED',
            default => 'DRAFT',
        };
    }

    public function toOpportunityStorageStage(string $stage, bool $legacySchema = false): string
    {
        $normalized = $this->mapLegacyOpportunityStageCode($stage);
        if ($normalized === '') {
            $normalized = 'NEW';
        }

        if ($legacySchema) {
            return match ($normalized) {
                'NEW' => 'LEAD',
                'PROPOSAL' => 'PROPOSAL',
                'NEGOTIATION' => 'NEGOTIATION',
                'WON' => 'CLOSED_WON',
                'LOST' => 'CLOSED_LOST',
                default => $normalized,
            };
        }

        return $normalized;
    }

    public function fromOpportunityStorageStage(string $stage): string
    {
        $normalized = $this->mapLegacyOpportunityStageCode($stage);

        return $normalized !== '' ? $normalized : 'NEW';
    }

    public function sanitizeOpportunityStageCode(string $stageCode): string
    {
        $trimmed = trim($stageCode);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }

    public function normalizePaymentCycle(string $cycle): string
    {
        $normalized = strtoupper(trim($cycle));

        return in_array($normalized, self::PAYMENT_CYCLES, true) ? $normalized : 'ONCE';
    }

    private function mapLegacyOpportunityStageCode(string $stageCode): string
    {
        $normalized = strtoupper(trim($stageCode));
        if ($normalized === '') {
            return '';
        }

        return self::LEGACY_OPPORTUNITY_STAGE_MAP[$normalized] ?? $normalized;
    }
}
