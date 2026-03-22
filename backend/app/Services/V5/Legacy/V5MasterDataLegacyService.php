<?php

namespace App\Services\V5\Legacy;

use BadMethodCallException;

/**
 * @deprecated Legacy V5 master-data service has been retired.
 *
 * The class name is kept temporarily so any stale container resolution fails
 * fast with a clear exception instead of an autoload error.
 */
final class V5MasterDataLegacyService
{
    /**
     * @param array<int, mixed> $arguments
     */
    public function __call(string $method, array $arguments): never
    {
        throw new BadMethodCallException(sprintf(
            'V5MasterDataLegacyService has been retired. Unexpected call to %s().',
            $method
        ));
    }
}
