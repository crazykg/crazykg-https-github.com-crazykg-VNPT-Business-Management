<?php

namespace App\Services\V5\Contract;

use App\Models\Contract;
use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Pure business-logic service for contract renewal / addendum management.
 *
 * Semantics:
 *   gap_days = parent.expiry_date.diffInDays(addendum.effective_date)
 *   EARLY (gap ≤ 0) | CONTINUOUS (gap = 1) | GAP (gap > 1) | STANDALONE (no parent / missing dates)
 *   Penalty guard: gap_days ≤ 1 + grace_days → null  (includes EARLY, CONTINUOUS, and GAP within grace)
 *   Penalty formula: gap_days × rate_per_day → round(4, PHP_ROUND_HALF_UP) → min(result, max_rate)
 */
class ContractRenewalService
{
    private const MAX_CHAIN_DEPTH = 10;
    private const ADDENDUM_TYPES = ['EXTENSION', 'AMENDMENT', 'LIQUIDATION'];
    private const CONTINUITY_STATUSES = ['STANDALONE', 'EARLY', 'CONTINUOUS', 'GAP'];

    // Statuses that may be updated with penalty info (accounting-safe statuses are excluded)
    private const PENALTY_ELIGIBLE_PAYMENT_STATUSES = ['PENDING', 'INVOICED', 'OVERDUE'];

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    // ──────────────────────────────────────────────
    //  Pure computation methods
    // ──────────────────────────────────────────────

    /**
     * Compute gap in calendar days between parent expiry and addendum effective date.
     *
     * @return int|null  null when either date is missing
     */
    public function computeGapDays(?string $parentExpiryDate, ?string $addendumEffectiveDate): ?int
    {
        if ($parentExpiryDate === null || $parentExpiryDate === '' ||
            $addendumEffectiveDate === null || $addendumEffectiveDate === '') {
            return null;
        }

        try {
            $parentExpiry = Carbon::parse($parentExpiryDate)->startOfDay();
            $actualStart  = Carbon::parse($addendumEffectiveDate)->startOfDay();

            // diffInDays($other, false): positive when actualStart > parentExpiry
            return (int) $parentExpiry->diffInDays($actualStart, false);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Classify continuity based purely on calendar gap (no grace involvement).
     */
    public function computeContinuityStatus(?int $gapDays): string
    {
        if ($gapDays === null) {
            return 'STANDALONE';
        }

        if ($gapDays <= 0) {
            return 'EARLY';
        }

        if ($gapDays === 1) {
            return 'CONTINUOUS';
        }

        return 'GAP';
    }

    /**
     * Compute penalty rate from gap and config.
     *
     * @param array{grace_days: int, rate_per_day: float, max_rate: float} $config
     * @return float|null  null = no penalty; float(4dp) otherwise
     */
    public function computePenaltyRate(?int $gapDays, array $config): ?float
    {
        $graceDays = (int) ($config['grace_days'] ?? 0);
        $ratePerDay = (float) ($config['rate_per_day'] ?? 0);
        $maxRate = (float) ($config['max_rate'] ?? 1.0);

        // Guard: null, EARLY (gap≤0), CONTINUOUS (gap=1), or within grace (gap ≤ 1+grace)
        if ($gapDays === null || $gapDays <= 1 + $graceDays) {
            return null;
        }

        // gap_days is the raw penalty basis — no subtraction
        $rawRate = $gapDays * $ratePerDay;
        $rounded = round($rawRate, 4, PHP_ROUND_HALF_UP);

        return min($rounded, $maxRate);
    }

    // ──────────────────────────────────────────────
    //  Orchestration methods
    // ──────────────────────────────────────────────

    /**
     * Apply renewal metadata (gap_days, continuity_status, penalty_rate) to a contract model.
     * Does NOT save — caller must persist.
     *
     * @param Contract      $addendum               The addendum contract model
     * @param Contract|null $parent                  The parent contract (null → reset to STANDALONE)
     * @param string|null   $effectiveDateOverride   When effective_date has changed but not yet saved on model
     */
    public function applyRenewalMetaToContract(
        Contract $addendum,
        ?Contract $parent,
        ?string $effectiveDateOverride = null,
    ): void {
        if ($parent === null) {
            $this->resetRenewalMeta($addendum);

            return;
        }

        $effectiveDate = $effectiveDateOverride ?? $this->extractDateString($addendum, 'effective_date');
        $parentExpiryDate = $this->extractDateString($parent, 'expiry_date');

        $gapDays = $this->computeGapDays($parentExpiryDate, $effectiveDate);
        $continuityStatus = $this->computeContinuityStatus($gapDays);
        $config = $this->resolveRenewalConfig();
        $penaltyRate = $this->computePenaltyRate($gapDays, $config);

        // Set on model — hasColumn guards for schema resilience
        if ($this->support->hasColumn('contracts', 'gap_days')) {
            $addendum->gap_days = $gapDays;
        }
        if ($this->support->hasColumn('contracts', 'continuity_status')) {
            $addendum->continuity_status = $continuityStatus;
        }
        if ($this->support->hasColumn('contracts', 'penalty_rate')) {
            $addendum->penalty_rate = $penaltyRate;
        }
    }

    /**
     * Reset addendum's renewal meta to STANDALONE defaults.
     */
    private function resetRenewalMeta(Contract $addendum): void
    {
        if ($this->support->hasColumn('contracts', 'gap_days')) {
            $addendum->gap_days = null;
        }
        if ($this->support->hasColumn('contracts', 'continuity_status')) {
            $addendum->continuity_status = 'STANDALONE';
        }
        if ($this->support->hasColumn('contracts', 'penalty_rate')) {
            $addendum->penalty_rate = null;
        }
    }

    /**
     * Apply (or remove) penalty to existing payment schedules for a contract.
     * Only modifies PENDING / INVOICED / OVERDUE schedules (accounting-safe).
     */
    public function applyPenaltyToSchedules(int $contractId, ?float $penaltyRate): void
    {
        if (! $this->support->hasTable('payment_schedules') ||
            ! $this->support->hasColumn('payment_schedules', 'original_amount')) {
            return;
        }

        $schedules = DB::table('payment_schedules')
            ->where('contract_id', $contractId)
            ->whereIn('status', self::PENALTY_ELIGIBLE_PAYMENT_STATUSES)
            ->get(['id', 'expected_amount', 'original_amount']);

        foreach ($schedules as $schedule) {
            // Resolve base amount — use original_amount if already set, else current expected_amount
            $baseAmount = $schedule->original_amount !== null
                ? (float) $schedule->original_amount
                : (float) $schedule->expected_amount;

            if ($penaltyRate !== null && $penaltyRate > 0) {
                $penaltyAmount = floor($baseAmount * $penaltyRate); // round down to 0 VND
                $expectedAmount = $baseAmount - $penaltyAmount;

                $update = [
                    'original_amount' => $baseAmount,
                    'penalty_rate'    => $penaltyRate,
                    'penalty_amount'  => $penaltyAmount,
                    'expected_amount' => max(0, $expectedAmount),
                ];
            } else {
                // No penalty — restore original_amount to expected_amount
                $update = [
                    'original_amount' => $baseAmount,
                    'penalty_rate'    => null,
                    'penalty_amount'  => null,
                    'expected_amount' => $baseAmount,
                ];
            }

            DB::table('payment_schedules')
                ->where('id', $schedule->id)
                ->update($update);
        }
    }

    // ──────────────────────────────────────────────
    //  Config resolution
    // ──────────────────────────────────────────────

    /**
     * @return array{grace_days: int, rate_per_day: float, max_rate: float}
     */
    public function resolveRenewalConfig(): array
    {
        $graceDays = 0;
        $ratePerDay = 0.003333;
        $maxRate = 0.1500;

        if ($this->support->hasTable('integration_settings')) {
            $settings = DB::table('integration_settings')
                ->whereIn('provider', [
                    'contract_renewal_grace_days',
                    'contract_renewal_penalty_rate_per_day',
                    'contract_renewal_max_penalty_rate',
                ])
                ->pluck(
                    DB::getDriverName() === 'sqlite' ? 'is_enabled' : 'setting_value',
                    'provider'
                )
                ->toArray();

            // If setting_value column doesn't exist, try contract_expiry_warning_days pattern
            if ($this->support->hasColumn('integration_settings', 'setting_value')) {
                $graceDays = (int) ($settings['contract_renewal_grace_days'] ?? $graceDays);
                $ratePerDay = (float) ($settings['contract_renewal_penalty_rate_per_day'] ?? $ratePerDay);
                $maxRate = (float) ($settings['contract_renewal_max_penalty_rate'] ?? $maxRate);
            }
        }

        return [
            'grace_days'  => max(0, $graceDays),
            'rate_per_day' => max(0.0, $ratePerDay),
            'max_rate'    => max(0.0, $maxRate),
        ];
    }

    // ──────────────────────────────────────────────
    //  Parent status management
    // ──────────────────────────────────────────────

    /**
     * Mark the parent contract as RENEWED when an EXTENSION addendum is created.
     *
     * Rules:
     *  - Only triggers for addendum_type = 'EXTENSION' (not AMENDMENT / LIQUIDATION)
     *  - Only promotes SIGNED → RENEWED (guards against overwriting DRAFT or already-RENEWED)
     *  - Returns true if the parent was actually updated, false if no change was needed
     *
     * Does NOT persist — caller must call $parent->save() or use setAttributeIfColumn pattern.
     * Designed to be called inside the same DB::transaction as the addendum save.
     */
    public function markParentAsRenewed(Contract $parent, string $addendumType): bool
    {
        if (strtoupper(trim($addendumType)) !== 'EXTENSION') {
            return false;
        }

        if (! $this->support->hasColumn('contracts', 'status')) {
            return false;
        }

        $currentStatus = strtoupper(trim((string) ($parent->getAttribute('status') ?? '')));

        // Only promote SIGNED → RENEWED
        if ($currentStatus !== 'SIGNED') {
            return false;
        }

        $parent->status = 'RENEWED';

        return true;
    }

    // ──────────────────────────────────────────────
    //  Validation methods
    // ──────────────────────────────────────────────

    /**
     * Validate that setting $proposedParentId on $existingContractId does not create a cycle.
     *
     * @throws ValidationException
     */
    public function validateNoCircularParent(int $existingContractId, int $proposedParentId): void
    {
        if ($existingContractId === $proposedParentId) {
            throw ValidationException::withMessages([
                'parent_contract_id' => ['Hợp đồng không thể là phụ lục của chính nó.'],
            ]);
        }

        // Walk up the ancestor chain from proposedParentId
        $currentId = $proposedParentId;
        $visited = [$existingContractId, $proposedParentId];
        $depth = 0;

        while ($depth < self::MAX_CHAIN_DEPTH + 1) {
            $parentId = DB::table('contracts')
                ->where('id', $currentId)
                ->value('parent_contract_id');

            if ($parentId === null) {
                break; // Reached root — no cycle
            }

            $parentId = (int) $parentId;

            if ($parentId === $existingContractId) {
                throw ValidationException::withMessages([
                    'parent_contract_id' => ['Phát hiện vòng lặp trong chuỗi phụ lục. Không thể gán HĐ gốc này.'],
                ]);
            }

            if (in_array($parentId, $visited, true)) {
                throw ValidationException::withMessages([
                    'parent_contract_id' => ['Phát hiện vòng lặp trong chuỗi phụ lục.'],
                ]);
            }

            $visited[] = $parentId;
            $currentId = $parentId;
            $depth++;
        }
    }

    /**
     * Validate that creating a child under $parentId won't exceed max chain depth.
     *
     * @throws ValidationException
     */
    public function validateChainDepthForCreate(int $parentId): void
    {
        $depth = $this->getAncestorDepth($parentId);

        if ($depth + 1 > self::MAX_CHAIN_DEPTH) {
            throw ValidationException::withMessages([
                'parent_contract_id' => [
                    "Chuỗi phụ lục đã đạt giới hạn tối đa {$depth} cấp. Không thể tạo thêm phụ lục.",
                ],
            ]);
        }
    }

    /**
     * Count how many ancestors $contractId has (0 = root contract).
     */
    public function getAncestorDepth(int $contractId): int
    {
        $currentId = $contractId;
        $depth = 0;

        while ($depth < self::MAX_CHAIN_DEPTH + 1) {
            $parentId = DB::table('contracts')
                ->where('id', $currentId)
                ->value('parent_contract_id');

            if ($parentId === null) {
                break;
            }

            $depth++;
            $currentId = (int) $parentId;
        }

        return $depth;
    }

    // ──────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────

    /**
     * @return string[]
     */
    public static function addendumTypes(): array
    {
        return self::ADDENDUM_TYPES;
    }

    /**
     * @return string[]
     */
    public static function continuityStatuses(): array
    {
        return self::CONTINUITY_STATUSES;
    }

    /**
     * Extract a date attribute from a Contract model as Y-m-d string.
     * Handles Carbon cast, raw string, and null.
     */
    private function extractDateString(Contract $contract, string $attribute): ?string
    {
        $value = $contract->getAttribute($attribute);

        if ($value === null) {
            return null;
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        $str = (string) $value;

        return $str !== '' ? $str : null;
    }

    // -------------------------------------------------------------------------
    // Batch recalculation (admin utility)
    // -------------------------------------------------------------------------

    /**
     * Walk every contract that has parent_contract_id set and recompute
     * gap_days / continuity_status / penalty_rate in memory, then bulk-update.
     * Safe to call repeatedly — idempotent.
     */
    public function recalculateAllRenewalMeta(): \Illuminate\Http\JsonResponse
    {
        if (! $this->support->hasColumn('contracts', 'parent_contract_id')) {
            return response()->json(['message' => 'Cột parent_contract_id chưa tồn tại. Vui lòng chạy migration mới nhất.'], 422);
        }

        $children = Contract::query()
            ->whereNotNull('parent_contract_id')
            ->whereNull('deleted_at')
            ->get();

        $parentIds = $children->pluck('parent_contract_id')->filter()->unique()->values()->all();
        $parents = Contract::withTrashed()
            ->whereIn('id', $parentIds)
            ->get()
            ->keyBy('id');

        $updated = 0;
        foreach ($children as $child) {
            $parentId = (int) $child->getAttribute('parent_contract_id');
            $parent = $parents->get($parentId);
            $this->applyRenewalMetaToContract($child, $parent ?: null);
            if ($child->isDirty()) {
                $child->save();
                $updated++;
            }
        }

        return response()->json([
            'message' => "Đã tính lại meta gia hạn cho {$updated} hợp đồng.",
            'updated_count' => $updated,
            'scanned_count' => $children->count(),
        ]);
    }
}
