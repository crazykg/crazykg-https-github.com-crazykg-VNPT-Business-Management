<?php

namespace App\Http\Controllers\Api\V5;

use App\Http\Controllers\Controller;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;

abstract class V5BaseController extends Controller
{
    public function __construct(
        protected readonly V5DomainSupportService $support,
        protected readonly V5AccessAuditService $accessAudit
    ) {}
}
