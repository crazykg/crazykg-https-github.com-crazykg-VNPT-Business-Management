<?php

namespace App\Jobs;

use App\Models\Contract;
use App\Services\V5\Contract\ContractRenewalService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Dispatched whenever a parent contract's expiry_date changes.
 * Walks every direct child that has parent_contract_id = $parentId,
 * recomputes gap_days / continuity_status / penalty_rate and saves.
 *
 * Depth is bounded by ContractRenewalService::MAX_CHAIN_DEPTH (10).
 * Each generation dispatches the next, so the traversal is lazy.
 */
class RecomputeChildRenewalMetaJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /** Maximum number of re-dispatch generations to prevent runaway chains. */
    private const MAX_DEPTH = 10;

    public function __construct(
        private readonly int $parentId,
        private readonly int $depth = 0
    ) {}

    public function handle(ContractRenewalService $renewalService, V5DomainSupportService $support): void
    {
        if ($this->depth >= self::MAX_DEPTH) {
            return;
        }

        if (! $support->hasColumn('contracts', 'parent_contract_id')) {
            return;
        }

        $parent = Contract::withTrashed()->find($this->parentId);
        if ($parent === null) {
            return;
        }

        $children = Contract::query()
            ->where('parent_contract_id', $this->parentId)
            ->whereNull('deleted_at')
            ->get();

        foreach ($children as $child) {
            $renewalService->applyRenewalMetaToContract($child, $parent);
            $child->save();

            // Propagate one generation deeper
            self::dispatch((int) $child->getKey(), $this->depth + 1);
        }
    }
}
