<?php

namespace App\Shared\Controllers;

use App\Http\Controllers\Controller;
use App\Shared\Services\ColumnDetectionService;
use App\Shared\Services\NormalizationService;
use App\Shared\Services\PaginationService;
use App\Shared\Services\SortingService;
use App\Services\V5\V5AccessAuditService;

/**
 * Base controller for modular controllers.
 *
 * Injects the shared infrastructure services that most module controllers need.
 * Module controllers extend this instead of V5BaseController.
 */
abstract class BaseModuleController extends Controller
{
    public function __construct(
        protected readonly PaginationService $pagination,
        protected readonly SortingService $sorting,
        protected readonly ColumnDetectionService $columns,
        protected readonly NormalizationService $normalization,
        protected readonly V5AccessAuditService $accessAudit
    ) {}
}
