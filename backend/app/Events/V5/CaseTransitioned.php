<?php

namespace App\Events\V5;

use App\Models\CustomerRequestCase;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CaseTransitioned
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly CustomerRequestCase $case,
        public readonly string $targetStatus,
        public readonly ?int $actorId,
    ) {}
}
